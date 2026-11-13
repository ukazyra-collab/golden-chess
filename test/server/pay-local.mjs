// The pay function (supabase/functions/pay/index.ts) under Deno, against Postgres (PGlite) with the migrations and a
// stand-in for Stripe that keeps customers, prices, payment pages and subscriptions and sends signed webhooks:
// who may buy in each mode, the setup made once, a year with its trial from the payment page to the account, every
// event once, forged and stale webhooks refused, renewals, failed renewals, cancelling, late news of an old
// subscription, the page that manages a subscription, a founder's payment and its refund, real money next to the test
// side, the owner's self-test, and what the database does when a paying account is deleted or merged.
// Run: DENO=/path/to/deno node test/server/pay-local.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createDb } from './pg-harness.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const DENO = process.env.DENO || 'deno';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the database: the owner (an admin), Ann and Bob with saved accounts, Gus a guest
const OWNER = 'aaaaaaaa-3333-4000-8000-000000000001', ANN = 'bbbbbbbb-3333-4000-8000-000000000002', BOB = 'cccccccc-3333-4000-8000-000000000003', GUS = 'dddddddd-3333-4000-8000-000000000004';
const pg = await createDb([OWNER, ANN, BOB, GUS]);
const q = async (s, a) => (await pg.query(s, a)).rows;
await q("update auth.users set email = case id when $1 then 'owner@example.com' when $2 then 'ann@example.com' when $3 then 'bob@example.com' else null end", [OWNER, ANN, BOB]);
await q("insert into public.profiles (id, username, is_guest) values ($1, 'Owner', false), ($2, 'Ann', false), ($3, 'Bob', false), ($4, 'Gus', true)", [OWNER, ANN, BOB, GUS]);
await q('insert into public.admins (user_id) values ($1)', [OWNER]);
const pgServer = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 8 });
await pgServer.start();
const pgPort = pgServer.server ? pgServer.server.address().port : pgServer.port;
const prof = async (u) => (await q('select pro_until, pro_plan, pro_founder from public.profiles where id = $1', [u]))[0];
const bill = async (u) => (await q('select * from public.billing where user_id = $1', [u]))[0] || null;
const isOn = async (u) => { const p = await prof(u); return !!(p.pro_founder || (p.pro_until && new Date(p.pro_until).getTime() > Date.now())); };

// ---- a stand-in for Stripe (and for Supabase's auth keys): two sides, each with its own key and objects
const TEST_KEY = 'sk_test_standin', LIVE_KEY = 'sk_live_standin';
const sides = { test: mkSide(false), live: mkSide(true) };
function mkSide(livemode) { return { livemode, n: 0, products: [], prices: [], customers: new Map(), sessions: new Map(), subs: new Map(), hooks: [], portals: [], portalSessions: [], calls: [], deleted: [] }; }
const id = (S, pre) => pre + '_' + (S.livemode ? 'live' : 'test') + '_' + (++S.n).toString().padStart(4, '0');
function parseForm(s) { // a[b][0][c]=v → nested objects and lists
  const out = {};
  for (const [k, v] of new URLSearchParams(s)) {
    const path = k.replace(/\]/g, '').split('[');
    let o = out;
    path.forEach((p, i) => {
      const last = i === path.length - 1, key = /^\d+$/.test(p) ? Number(p) : p;
      if (last) o[key] = v; else { if (o[key] === undefined) o[key] = /^\d+$/.test(path[i + 1]) ? [] : {}; o = o[key]; }
    });
  }
  return out;
}
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
function mkSub(S, o) {
  const price = S.prices.find((p) => p.id === o.price);
  const trial = o.trial_days ? { trial_start: now(), trial_end: now() + o.trial_days * DAY } : {};
  const len = o.trial_days ? o.trial_days * DAY : price.recurring.interval === 'year' ? 365 * DAY : 30 * DAY;
  const sub = Object.assign({ id: id(S, 'sub'), object: 'subscription', customer: o.customer, status: o.trial_days ? 'trialing' : 'active', livemode: S.livemode, cancel_at_period_end: false,
    current_period_start: now(), current_period_end: now() + len, metadata: o.metadata || {}, items: { data: [{ price: { id: price.id, lookup_key: price.lookup_key, recurring: price.recurring } }] } }, trial);
  S.subs.set(sub.id, sub);
  return sub;
}
let FN = ''; // the function's own address (webhooks go there)
async function sendHook(S, type, object, opts = {}) {
  const ep = S.hooks.filter((h) => h.status === 'enabled').pop();
  const ev = { id: opts.id || id(S, 'evt'), object: 'event', type, livemode: S.livemode, created: now(), data: { object } };
  const body = JSON.stringify(ev), t = opts.t || now();
  const secret = opts.secret || (ep && ep.secret) || 'whsec_none';
  const sig = crypto.createHmac('sha256', secret).update(t + '.' + (opts.signedBody || body)).digest('hex');
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body });
  return { status: r.status, body: await r.json().catch(() => null), id: ev.id };
}
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'ES256', use: 'sig' });
const fake = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', async () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/auth/v1/.well-known/jwks.json') return send(200, { keys: [jwk] });
    if (!u.pathname.startsWith('/v1/')) return send(404, {});
    const key = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    const S = key === TEST_KEY ? sides.test : key === LIVE_KEY ? sides.live : null;
    if (!S) return send(401, { error: { type: 'invalid_request_error', message: 'Invalid API Key provided' } });
    const path = u.pathname.slice(4), b = req.method === 'GET' ? parseForm(u.search.slice(1)) : parseForm(data);
    S.calls.push({ method: req.method, path, body: b });
    const m = (re) => (req.method + ' ' + path).match(re);
    let x;
    if (m(/^GET prices$/)) return send(200, { data: S.prices.filter((p) => (b.lookup_keys || []).includes(p.lookup_key) && p.active) });
    if ((x = m(/^GET prices\/(\w+)$/))) return send(200, S.prices.find((p) => p.id === x[1]) || {});
    if (m(/^POST products$/)) { const p = { id: id(S, 'prod'), name: b.name }; S.products.push(p); return send(200, p); }
    if (m(/^POST prices$/)) {
      if (S.prices.some((p) => p.lookup_key === b.lookup_key)) return send(400, { error: { type: 'invalid_request_error', message: 'lookup key in use' } });
      const p = { id: id(S, 'price'), product: b.product, unit_amount: Number(b.unit_amount), currency: b.currency, lookup_key: b.lookup_key, active: true, recurring: b.recurring ? { interval: b.recurring.interval } : null };
      S.prices.push(p); return send(200, p);
    }
    if (m(/^POST billing_portal\/configurations$/)) { const c = { id: id(S, 'bpc'), features: b.features, business_profile: b.business_profile }; S.portals.push(c); return send(200, c); }
    if (m(/^GET webhook_endpoints$/)) return send(200, { data: S.hooks.map((h) => ({ id: h.id, url: h.url, status: h.status })) });
    if (m(/^POST webhook_endpoints$/)) { const h = { id: id(S, 'we'), url: b.url, enabled_events: b.enabled_events, status: 'enabled', secret: 'whsec_' + crypto.randomBytes(12).toString('hex') }; S.hooks.push(h); return send(200, h); }
    if ((x = m(/^POST webhook_endpoints\/(\w+)$/))) { const h = S.hooks.find((e) => e.id === x[1]); if (h && b.disabled === 'true') h.status = 'disabled'; return send(200, { id: x[1], status: h ? h.status : null }); }
    if (m(/^POST customers$/)) { const c = { id: id(S, 'cus'), email: b.email, name: b.name, metadata: b.metadata || {} }; S.customers.set(c.id, c); return send(200, c); }
    if ((x = m(/^POST customers\/(\w+)$/))) { const c = S.customers.get(x[1]); if (!c) return send(404, { error: { message: 'No such customer' } }); Object.assign(c, b); return send(200, c); }
    if (m(/^POST checkout\/sessions$/)) {
      if (!S.customers.has(b.customer)) return send(400, { error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such customer' } });
      const sid = 'cs_' + (S.livemode ? 'live' : 'test') + '_' + crypto.randomBytes(8).toString('hex');
      const s = { id: sid, object: 'checkout.session', mode: b.mode, customer: b.customer, client_reference_id: b.client_reference_id, metadata: b.metadata || {}, status: 'open', payment_status: 'unpaid',
        livemode: S.livemode, url: 'https://checkout.stripe.test/c/' + sid, subscription: null, payment_intent: null, params: b };
      S.sessions.set(sid, s); return send(200, s);
    }
    if ((x = m(/^GET checkout\/sessions\/(\w+)$/))) { const s = S.sessions.get(x[1]); return s ? send(200, s) : send(404, { error: { message: 'No such checkout.session' } }); }
    if (m(/^POST billing_portal\/sessions$/)) { const p = { id: id(S, 'bps'), customer: b.customer, configuration: b.configuration || null, return_url: b.return_url, url: 'https://billing.stripe.test/p/' + S.n }; S.portalSessions.push(p); return send(200, p); }
    if ((x = m(/^GET subscriptions\/(\w+)$/))) { const s = S.subs.get(x[1]); return s ? send(200, s) : send(404, { error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such subscription' } }); }
    if ((x = m(/^DELETE subscriptions\/(\w+)$/))) {
      const s = S.subs.get(x[1]); if (!s) return send(404, { error: { message: 'No such subscription' } });
      Object.assign(s, { status: 'canceled', ended_at: now() }); S.deleted.push(s.id);
      send(200, s);
      if (S.autoHooks) setTimeout(() => sendHook(S, 'customer.subscription.deleted', s), 300);
      return;
    }
    if (m(/^POST payment_methods\/pm_card_visa\/attach$/)) return send(200, { id: id(S, 'pm'), customer: b.customer });
    if (m(/^POST subscriptions$/)) { // (the owner's self-test makes one through the API; Stripe then tells the webhook)
      const s = mkSub(S, { customer: b.customer, price: b.items[0].price, metadata: b.metadata });
      send(200, s);
      if (S.autoHooks) setTimeout(() => sendHook(S, 'customer.subscription.created', s), 300);
      return;
    }
    send(404, { error: { type: 'invalid_request_error', message: 'Unrecognized request URL (' + req.method + ' ' + u.pathname + ')' } });
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const fakeUrl = 'http://127.0.0.1:' + fake.address().port;
// the player "pays" on Stripe's page: the session completes, a subscription (or a payment) appears
function pay(S, sid) {
  const s = S.sessions.get(sid), p = s.params;
  s.status = 'complete';
  if (s.mode === 'subscription') {
    const sub = mkSub(S, { customer: s.customer, price: p.line_items[0].price, trial_days: p.subscription_data && p.subscription_data.trial_period_days ? Number(p.subscription_data.trial_period_days) : 0, metadata: (p.subscription_data || {}).metadata });
    s.subscription = sub.id; s.payment_status = sub.status === 'trialing' ? 'no_payment_required' : 'paid';
    return sub;
  }
  s.payment_status = 'paid'; s.payment_intent = id(S, 'pi');
  return null;
}
const b64u = (b) => Buffer.from(b).toString('base64url');
function token(sub, guest) {
  const t = now();
  const head = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' }));
  const body = b64u(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: t, exp: t + 3600, iss: fakeUrl + '/auth/v1', is_anonymous: !!guest }));
  return head + '.' + body + '.' + b64u(crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privateKey, dsaEncoding: 'ieee-p1363' }));
}

// ---- the function under Deno (started again whenever its keys change)
const fnPort = 20000 + Math.floor(Math.random() * 1000);
FN = `http://127.0.0.1:${fnPort}/pay`;
let deno = null, logs = '';
async function start(extra) {
  if (deno) { deno.kill(); await sleep(400); }
  const env = Object.assign({}, process.env, { SUPABASE_URL: fakeUrl, SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_DB_URL: `postgres://postgres:x@127.0.0.1:${pgPort}/postgres`,
    STRIPE_API_URL: fakeUrl, PAY_SITE: 'https://joker-chess.com/', PG_POOL_MAX: '1', DENO_DIR: process.env.DENO_DIR || '' }, extra || {}); // (PGlite serves one connection at a time)
  for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_TEST_KEY']) if (!(extra && k in extra)) delete env[k];
  const wrapper = `Deno.serve = ((orig) => (h) => orig({ port: ${fnPort}, hostname: '127.0.0.1', onListen() {} }, h))(Deno.serve);\nawait import('${ROOT}supabase/functions/pay/index.ts');\n`;
  fs.writeFileSync('/tmp/gc-pay-wrapper.ts', wrapper);
  deno = spawn(DENO, ['run', '-A', '--no-lock', '/tmp/gc-pay-wrapper.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  deno.stdout.on('data', (d) => (logs += d)); deno.stderr.on('data', (d) => (logs += d));
  for (let i = 0; i < 160; i++) { try { await fetch(`http://127.0.0.1:${fnPort}/`, { method: 'OPTIONS' }); return; } catch { await sleep(250); } }
  throw new Error('the function did not start\n' + logs);
}
async function call(tok, body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(Object.assign({}, body, tok ? { token: tok } : {})) });
  return { status: r.status, body: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') };
}
const setMode = (m) => q("update public.billing_config set value = to_jsonb($1::text) where key = 'mode'", [m]);
const KEYV = 'k'.repeat(40);
const ownerKey = (mins) => q("insert into public.billing_config (key, value) values ('admin_key', jsonb_build_object('key', $1::text, 'until', (now() + ($2 || ' minutes')::interval)::text)) on conflict (key) do update set value = excluded.value", [KEYV, String(mins)]);
const own = (action, extra) => call(null, Object.assign({ action, key: KEYV }, extra || {}));

try {
  // ================================================================ no key yet
  await start({});
  let r = await call(token(ANN), { action: 'state' });
  check('no key: a player\'s state, nothing to buy', r.status === 200 && r.body.pro && r.body.pro.on === false && r.body.can === false && r.body.foundersLeft === 1000 && r.cors === '*', r);
  await setMode('on');
  r = await call(token(ANN), { action: 'checkout', plan: 'year' });
  check('no key: no payment page, whatever the mode', r.body.error === 'off', r.body);
  await setMode('off');
  check('no token: refused', (await call(null, { action: 'state' })).status === 401 && (await call('abc.def.ghi', { action: 'state' })).status === 401);
  check('a GET is not for this', (await fetch(FN)).status === 405);

  // ================================================================ the test side
  await start({ STRIPE_TEST_KEY: TEST_KEY });
  // the owner's key: none, a wrong one, one that has run out
  check('the setup needs the owner\'s key', (await own('setup')).status === 401);
  await ownerKey(-1);
  check('a key that has run out: refused', (await own('setup')).status === 401);
  await ownerKey(30);
  check('a wrong key: refused', (await call(null, { action: 'setup', key: 'x'.repeat(40) })).status === 401 && (await call(null, { action: 'admin_state', key: 'short' })).status === 401);
  r = await own('admin_state');
  check('before the setup: a key, nothing made', r.body.keys.test === true && r.body.keys.live === false && r.body.mode === 'off' && !r.body.hook.test && JSON.stringify(r.body.prices.test) === '[]' && r.body.prices.live === 'no_key', r.body);
  r = await call(token(OWNER), { action: 'checkout', plan: 'year' });
  check('mode off: not even the owner', r.body.error === 'off', r.body);
  await setMode('test');
  r = await call(token(OWNER), { action: 'checkout', plan: 'year' });
  check('before the setup: no prices to sell', r.body.error === 'not_set_up', r.body);

  r = await own('setup');
  const T = sides.test;
  check('the setup makes the product, three prices, the portal and the webhook', r.status === 200 && r.body.ok && r.body.live === 'no_key' &&
    JSON.stringify(r.body.test.made) === JSON.stringify(['product', 'price month', 'price year', 'price founder', 'portal', 'webhook']) && r.body.test.prices.join() === 'founder,month,year', r.body);
  const price = (k) => T.prices.find((p) => p.lookup_key === 'joker_pro_' + k);
  check('the prices are the plans', price('month').unit_amount === 399 && price('month').recurring.interval === 'month' && price('year').unit_amount === 2999 && price('year').recurring.interval === 'year' &&
    price('founder').unit_amount === 7999 && price('founder').recurring === null && T.prices.every((p) => p.currency === 'usd' && p.product === T.products[0].id), T.prices);
  check('the webhook comes to this function, for the events it reads', T.hooks.length === 1 && T.hooks[0].url === fakeUrl + '/functions/v1/pay' && T.hooks[0].enabled_events.includes('checkout.session.completed') &&
    T.hooks[0].enabled_events.includes('customer.subscription.deleted') && T.hooks[0].enabled_events.includes('charge.refunded'), T.hooks[0]);
  check('the portal lets a player cancel and change the plan', T.portals.length === 1 && T.portals[0].features.subscription_cancel.enabled === 'true' && T.portals[0].features.subscription_cancel.mode === 'at_period_end' &&
    T.portals[0].features.subscription_update.products[0].prices.length === 2 && T.portals[0].business_profile.terms_of_service_url === 'https://joker-chess.com/terms.html', T.portals[0]);
  const cfg = async (k) => ((await q('select value from public.billing_config where key = $1', [k]))[0] || {}).value;
  check('the signing secret is kept in the database', (await cfg('hook:test')).secret === T.hooks[0].secret && (await cfg('portal:test')).id === T.portals[0].id);
  r = await own('setup');
  check('the setup again makes nothing', r.body.test.made.length === 0 && T.products.length === 1 && T.prices.length === 3 && T.hooks.length === 1 && T.portals.length === 1, r.body);
  r = await own('admin_state');
  check('the owner\'s view never shows a secret', r.body.hook.test === true && r.body.serving === 'test' && !JSON.stringify(r.body).includes('whsec_') && !JSON.stringify(r.body).includes('sk_test'), r.body);

  // who may buy while the mode is 'test'
  r = await call(token(ANN), { action: 'checkout', plan: 'year' });
  check('test mode: a player gets no payment page', r.body.error === 'off', r.body);
  check('and is told so', (await call(token(ANN), { action: 'state' })).body.can === false && (await call(token(OWNER), { action: 'state' })).body.can === true);
  check('a plan we don\'t have', (await call(token(OWNER), { action: 'checkout', plan: 'week' })).body.error === 'bad_plan');
  await q('insert into public.admins (user_id) values ($1)', [GUS]);
  check('a guest saves the account first', (await call(token(GUS, true), { action: 'checkout', plan: 'year' })).body.error === 'guest');
  await q('delete from public.admins where user_id = $1', [GUS]);

  // ---- a year, with its trial: the payment page, the way back, the webhook
  r = await call(token(OWNER), { action: 'checkout', plan: 'year', back: 'https://golden-chess.com/?x=1', lang: 'ru' });
  let sid = (r.body.url || '').split('/').pop(), ses = T.sessions.get(sid);
  check('the owner gets Stripe\'s page', /^https:\/\/checkout\.stripe\.test\/c\/cs_test_/.test(r.body.url || '') && !!ses, r.body);
  check('for a subscription to the year, with the trial', ses.mode === 'subscription' && ses.params.line_items[0].price === price('year').id && ses.params.subscription_data.trial_period_days === '7' &&
    ses.params.subscription_data.metadata.user_id === OWNER && ses.client_reference_id === OWNER && ses.params.locale === 'ru', ses.params);
  check('and the way back to the page they came from', ses.params.success_url === 'https://golden-chess.com/?pro=ok&sid={CHECKOUT_SESSION_ID}' && ses.params.cancel_url === 'https://golden-chess.com/?pro=back', ses.params);
  const cus = T.customers.get(ses.customer);
  check('the customer carries the account', cus && cus.email === 'owner@example.com' && cus.metadata.user_id === OWNER && (await bill(OWNER)).customer === cus.id && (await bill(OWNER)).livemode === false, cus);
  check('nothing is Pro before the payment', !(await isOn(OWNER)));
  // the page was opened and left: a second ask reuses the customer
  r = await call(token(OWNER), { action: 'checkout', plan: 'year', back: 'https://evil.example/' });
  check('one customer an account; a stranger\'s address is not a way back', T.customers.size === 1 && T.sessions.get(r.body.url.split('/').pop()).params.success_url.startsWith('https://joker-chess.com/?pro=ok'));
  let sub = pay(T, sid);
  // forged and stale webhooks
  let h = await sendHook(T, 'checkout.session.completed', ses, { secret: 'whsec_forged' });
  check('a forged webhook: refused, nothing changes', h.status === 400 && !(await isOn(OWNER)), h);
  h = await sendHook(T, 'checkout.session.completed', ses, { t: now() - 1000 });
  check('a stale one: refused', h.status === 400);
  h = await sendHook(T, 'checkout.session.completed', ses, { signedBody: '{}' });
  check('a signature for another body: refused', h.status === 400 && (await q('select count(*)::int as n from public.billing_events'))[0].n === 0);
  h = await sendHook(T, 'checkout.session.completed', ses);
  let p = await prof(OWNER), bl = await bill(OWNER);
  check('the webhook starts the trial', h.status === 200 && h.body.note === 'trialing year' && (await isOn(OWNER)) && p.pro_plan === 'year' && !p.pro_founder &&
    Math.abs(new Date(p.pro_until).getTime() / 1000 - sub.trial_end) < 2, [h, p]);
  check('the account\'s Stripe side is on file', bl.subscription === sub.id && bl.status === 'trialing' && bl.plan === 'year' && bl.trial_used === true && bl.cancel_at_period_end === false, bl);
  const again = await sendHook(T, 'checkout.session.completed', ses, { id: h.id });
  check('the same event again: seen, done nothing', again.status === 200 && again.body.seen === true && (await q('select count(*)::int as n from public.billing_events'))[0].n === 1, again);
  // the way back: confirm brings the state at once (also when the webhook is late)
  r = await call(token(ANN), { action: 'confirm', sid });
  check('someone else\'s payment page is not theirs', r.body.error === 'not_yours', r.body);
  check('a made-up session id', (await call(token(OWNER), { action: 'confirm', sid: 'nope' })).body.error === 'bad_session');
  r = await call(token(OWNER), { action: 'confirm', sid });
  check('the owner comes back to Pro on trial', r.body.pro.on && r.body.pro.trial && r.body.pro.plan === 'year' && r.body.pro.sub && r.body.pro.trialUsed && r.body.test === true, r.body);
  check('the state says nothing of Stripe\'s ids', !JSON.stringify(r.body).includes('cus_') && !JSON.stringify(r.body).includes('sub_'));

  // ---- a running subscription: the page that manages it instead of a second one
  r = await call(token(OWNER), { action: 'checkout', plan: 'month' });
  check('already subscribed: the page that manages it', r.body.already === true && /^https:\/\/billing\.stripe\.test\//.test(r.body.url) && T.subs.size === 1, r.body);
  r = await call(token(OWNER), { action: 'portal', back: 'https://joker-chess.com/' });
  const ps = T.portalSessions[T.portalSessions.length - 1];
  check('the portal, with our settings, back to the game', /^https:\/\/billing\.stripe\.test\//.test(r.body.url) && ps.customer === cus.id && ps.configuration === T.portals[0].id && ps.return_url === 'https://joker-chess.com/', ps);
  check('nobody without a customer has a portal', (await call(token(ANN), { action: 'portal' })).body.error === 'no_customer');

  // ---- the trial ends and the year is paid; a renewal fails; the card is fixed; the player cancels
  Object.assign(sub, { status: 'active', current_period_start: now(), current_period_end: now() + 365 * DAY });
  h = await sendHook(T, 'customer.subscription.updated', sub);
  p = await prof(OWNER);
  check('paid: Pro for the year', h.body.note === 'active year' && Math.abs(new Date(p.pro_until).getTime() / 1000 - sub.current_period_end) < 2 && (await bill(OWNER)).status === 'active', [h, p]);
  // (the event's own copy may be older than what Stripe has now: the function reads the subscription afresh)
  h = await sendHook(T, 'customer.subscription.updated', Object.assign({}, sub, { status: 'trialing', current_period_end: now() + 5 }));
  check('an old copy in an event changes nothing', (await bill(OWNER)).status === 'active' && Math.abs(new Date((await prof(OWNER)).pro_until).getTime() / 1000 - sub.current_period_end) < 2, h);
  Object.assign(sub, { status: 'past_due', current_period_start: now() - DAY, current_period_end: now() + 364 * DAY });
  await sendHook(T, 'customer.subscription.updated', sub);
  p = await prof(OWNER);
  check('a renewal fails: three days of grace, not the unpaid year', (await isOn(OWNER)) && Math.abs(new Date(p.pro_until).getTime() / 1000 - (sub.current_period_start + 3 * DAY)) < 2 && (await bill(OWNER)).status === 'past_due', p);
  Object.assign(sub, { status: 'past_due', current_period_start: now() - 5 * DAY });
  await sendHook(T, 'customer.subscription.updated', sub);
  check('the grace runs out: Pro off, the subscription still on file', !(await isOn(OWNER)) && (await bill(OWNER)).status === 'past_due');
  Object.assign(sub, { status: 'active', current_period_start: now() - 5 * DAY, current_period_end: now() + 360 * DAY });
  await sendHook(T, 'customer.subscription.updated', sub);
  check('the card is fixed: Pro again', await isOn(OWNER));
  sub.cancel_at_period_end = true;
  await sendHook(T, 'customer.subscription.updated', sub);
  r = await call(token(OWNER), { action: 'state' });
  check('cancelled in the portal: Pro until the year ends, marked as ending', r.body.pro.on && r.body.pro.cancel && r.body.pro.sub && (await bill(OWNER)).cancel_at_period_end === true, r.body);

  // the database: a running subscription holds the account; one that ends by itself doesn't
  const as = async (uid, sqlText) => { await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`); try { await pg.query(sqlText); return null; } catch (e) { return e.message; } finally { await pg.exec('reset role'); } };
  await q('update public.billing set cancel_at_period_end = false where user_id = $1', [OWNER]);
  check('an account with a running subscription can\'t be deleted from under it', /active_subscription/.test((await as(OWNER, 'select public.delete_my_account()')) || ''));
  await q('update public.billing set cancel_at_period_end = true where user_id = $1', [OWNER]);

  Object.assign(sub, { status: 'canceled', ended_at: now() });
  h = await sendHook(T, 'customer.subscription.deleted', sub);
  check('the year ends: Pro off', h.body.note === 'canceled year' && !(await isOn(OWNER)) && (await bill(OWNER)).status === 'canceled', h);
  check('the account keeps what it bought last', (await prof(OWNER)).pro_plan === 'year');

  // ---- a second subscription: no second trial; late news of the first doesn't end it
  r = await call(token(OWNER), { action: 'checkout', plan: 'year' });
  sid = r.body.url.split('/').pop(); ses = T.sessions.get(sid);
  check('one trial an account', ses.params.subscription_data.trial_period_days === undefined, ses.params.subscription_data);
  r = await call(token(OWNER), { action: 'checkout', plan: 'month' });
  sid = r.body.url.split('/').pop(); ses = T.sessions.get(sid);
  const sub2 = pay(T, sid);
  r = await call(token(OWNER), { action: 'confirm', sid }); // (the webhook hasn't come yet)
  check('confirm alone brings the month', r.body.pro.on && r.body.pro.plan === 'month' && !r.body.pro.trial && r.body.note === 'active month' && (await bill(OWNER)).subscription === sub2.id, r.body);
  h = await sendHook(T, 'customer.subscription.deleted', sub); // Stripe sends the old one's end once more
  check('late news of the old subscription changes nothing', h.body.note === 'older_subscription' && (await isOn(OWNER)) && (await bill(OWNER)).subscription === sub2.id && (await bill(OWNER)).status === 'active', h);
  h = await sendHook(T, 'checkout.session.completed', ses);
  check('the webhook after the confirm: the same state', h.status === 200 && (await bill(OWNER)).status === 'active' && (await prof(OWNER)).pro_plan === 'month');

  // ---- a founder: one payment, for life; the subscription stops; a full refund takes it back
  r = await call(token(OWNER), { action: 'checkout', plan: 'founder' });
  sid = r.body.url.split('/').pop(); ses = T.sessions.get(sid);
  check('a founder\'s page is one payment', ses.mode === 'payment' && ses.params.line_items[0].price === price('founder').id && ses.params.payment_intent_data.metadata.plan === 'founder' && ses.params.subscription_data === undefined, ses.params);
  pay(T, sid);
  h = await sendHook(T, 'checkout.session.completed', ses);
  p = await prof(OWNER); bl = await bill(OWNER);
  check('the payment makes a founder', h.body.note === 'founder' && p.pro_founder === true && p.pro_plan === 'founder' && bl.founder_payment === ses.payment_intent && !!bl.founder_at, [h, p]);
  check('the running subscription is stopped at Stripe', T.deleted.includes(sub2.id) && T.subs.get(sub2.id).status === 'canceled' && bl.status === 'canceled');
  r = await call(token(OWNER), { action: 'state' });
  check('a founder is Pro with no end', r.body.pro.on && r.body.pro.founder && r.body.pro.until === null && r.body.pro.plan === 'founder' && r.body.foundersLeft === 999, r.body);
  check('a founder buys it once', (await call(token(OWNER), { action: 'checkout', plan: 'founder' })).body.error === 'already');
  check('a founder\'s account can be deleted (nothing would charge again)', !/active_subscription/.test((await as(OWNER, "select 1 where exists (select 1 from public.billing b where b.user_id = '" + OWNER + "' and b.status in ('trialing', 'active', 'past_due') and not b.cancel_at_period_end)")) || '') &&
    (await q("select count(*)::int as n from public.billing b where b.user_id = $1 and b.status in ('trialing', 'active', 'past_due') and not b.cancel_at_period_end", [OWNER]))[0].n === 0);
  h = await sendHook(T, 'charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: ses.payment_intent, refunded: false, amount_refunded: 1000 });
  check('a part given back changes nothing', h.body.note === 'not_a_full_refund' && (await prof(OWNER)).pro_founder === true, h);
  h = await sendHook(T, 'charge.refunded', { id: 'ch_2', object: 'charge', payment_intent: 'pi_someone_else', refunded: true });
  check('another payment\'s refund changes nothing', h.body.note === 'not_a_founder_payment' && (await prof(OWNER)).pro_founder === true);
  h = await sendHook(T, 'charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: ses.payment_intent, refunded: true });
  p = await prof(OWNER);
  check('the whole payment given back: no founder, no Pro', h.body.note === 'founder_refunded' && p.pro_founder === false && p.pro_plan === null && !(await isOn(OWNER)), [h, p]);

  // ---- the seats run out
  await q("insert into auth.users (id) select ('eeeeeeee-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 1000) i");
  await q("insert into public.profiles (id, username, is_guest, pro_founder) select ('eeeeeeee-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'F' || i, false, true from generate_series(1, 1000) i");
  r = await call(token(OWNER), { action: 'checkout', plan: 'founder' });
  check('a thousand founders: no more seats', r.body.error === 'sold_out' && (await call(token(OWNER), { action: 'state' })).body.foundersLeft === 0, r.body);
  await q("delete from auth.users where id::text like 'eeeeeeee-0000-4000-8000-%'");

  // ---- an event we don't read; an unknown account
  h = await sendHook(T, 'invoice.paid', { id: 'in_1', object: 'invoice' });
  check('other events are taken and left alone', h.status === 200 && h.body.note === 'ignored');
  const ghost = mkSub(T, { customer: 'cus_unknown', price: price('month').id, metadata: {} });
  h = await sendHook(T, 'customer.subscription.created', ghost);
  check('a subscription of nobody we know', h.status === 200 && h.body.note === 'no_user', h);

  // ---- 'on' with only a test key: still nothing for players
  await setMode('on');
  check('a test key never sells to players', (await call(token(ANN), { action: 'checkout', plan: 'month' })).body.error === 'off' && (await call(token(ANN), { action: 'state' })).body.can === false);
  check('the owner still can, on the test side', /cs_test_/.test((await call(token(OWNER), { action: 'checkout', plan: 'month' })).body.url || ''));

  // ---- the owner's self-test: a subscription through the API, the webhook brings the account along both ways
  await setMode('test');
  T.autoHooks = true;
  r = await own('selftest');
  check('the self-test passes', r.body.ok === true && r.body.webhookOnStart && r.body.proOn && r.body.webhookOnCancel && r.body.proOff, r.body);
  check('and leaves the owner without Pro', !(await isOn(OWNER)) && (await bill(OWNER)).status === 'canceled');
  T.autoHooks = false;

  // ================================================================ real money next to the test side
  await start({ STRIPE_TEST_KEY: TEST_KEY, STRIPE_SECRET_KEY: LIVE_KEY });
  const L = sides.live;
  r = await own('setup');
  check('the setup makes the live side too, and leaves the test side alone', r.body.live.made.length === 6 && r.body.test.made.length === 0 && L.prices.length === 3 && L.hooks.length === 1 && T.hooks.length === 1 && T.prices.length === 3, r.body);
  check('each side has its own signing secret', (await cfg('hook:live')).secret === L.hooks[0].secret && (await cfg('hook:live')).secret !== (await cfg('hook:test')).secret);
  await setMode('test');
  r = await call(token(OWNER), { action: 'checkout', plan: 'month' });
  check('mode test with both keys: the owner pays nothing (the test side)', /cs_test_/.test(r.body.url || '') && L.customers.size === 0, r.body);
  check('players still see nothing', (await call(token(ANN), { action: 'state' })).body.can === false);
  r = await own('admin_state');
  check('the owner\'s view: both keys, serving the test side', r.body.keys.test && r.body.keys.live && r.body.serving === 'test' && r.body.hook.live && r.body.prices.live.length === 3, r.body);

  await setMode('on');
  r = await call(token(ANN), { action: 'state' });
  check('on: a player may buy, with real money', r.body.can === true && r.body.test === undefined, r.body);
  r = await call(token(ANN), { action: 'checkout', plan: 'year', back: 'https://joker-chess.com/' });
  sid = (r.body.url || '').split('/').pop(); ses = L.sessions.get(sid);
  check('Ann gets the live payment page, with the trial', /cs_live_/.test(sid) && !!ses && ses.params.subscription_data.trial_period_days === '7' && L.customers.get(ses.customer).email === 'ann@example.com' && (await bill(ANN)).livemode === true, r.body);
  const subL = pay(L, sid);
  h = await sendHook(L, 'checkout.session.completed', ses, { secret: T.hooks[0].secret });
  check('a live event signed with the test side\'s secret still checks out (both are ours)', h.status === 200, h);
  check('Ann is Pro', (await isOn(ANN)) && (await bill(ANN)).subscription === subL.id && (await bill(ANN)).status === 'trialing');
  r = await call(token(ANN), { action: 'confirm', sid });
  check('her way back, on the live side', r.body.pro.on && r.body.pro.trial && r.body.test === undefined, r.body);
  r = await call(token(ANN), { action: 'portal' });
  check('her portal is the live one', L.portalSessions.length === 1 && L.portalSessions[0].configuration === L.portals[0].id, L.portalSessions);
  // the owner tried the test side before: real money starts their account clean
  await q("update public.profiles set pro_until = now() + interval '9 days', pro_plan = 'month' where id = $1", [OWNER]);
  r = await call(token(OWNER), { action: 'checkout', plan: 'founder' });
  bl = await bill(OWNER); p = await prof(OWNER);
  check('the owner\'s test leftovers go when real money comes', /cs_live_/.test(r.body.url || '') && bl.livemode === true && bl.subscription === null && bl.status === null && bl.trial_used === false && p.pro_until === null && p.pro_plan === null, [bl, p]);
  // test news can't touch an account with real money on file
  const ownerLive = await bill(OWNER);
  h = await sendHook(T, 'customer.subscription.updated', sub2); // (the owner's old test subscription; their account is on the live side now)
  check('test news for an account on the live side: left alone', h.body.note === 'test_news_for_a_live_account' && JSON.stringify(await bill(OWNER)) === JSON.stringify(ownerLive) && (await bill(OWNER)).livemode === true, [h, await bill(OWNER)]);
  const annTest = mkSub(T, { customer: 'cus_test_ann', price: price('month').id, metadata: { user_id: ANN } });
  h = await sendHook(T, 'customer.subscription.created', annTest);
  check('nor can a test subscription claim a paying account', h.body.note === 'test_news_for_a_live_account' && (await bill(ANN)).subscription === subL.id && (await bill(ANN)).livemode === true, h);
  // and the test side can't start over an account that pays for real
  await setMode('test');
  await q('insert into public.admins (user_id) values ($1)', [ANN]);
  r = await call(token(ANN), { action: 'checkout', plan: 'founder' });
  check('an account with real money is not taken to the test side', r.body.error === 'live_account' && (await bill(ANN)).livemode === true && (await isOn(ANN)), r.body);
  await q('delete from public.admins where user_id = $1', [ANN]);
  await setMode('on');

  // ---- the database, two accounts of one person: what was paid for moves to the kept one
  // Bob has played more: he is kept, Ann's subscription becomes his
  for (let i = 0; i < 2; i++) await q(`insert into public.games (status, white_id, black_id, white_name, black_name, tc_base, tc_inc, pool, start_fen, fen, clock_w, clock_b, result, reason)
    values ('over', $1, $2, 'B', 'O', 180000, 2000, 'blitz', 'x', 'x', 0, 0, '1-0', 'resign')`, [BOB, OWNER]);
  const annBill = await bill(ANN), annProf = await prof(ANN);
  const merged = (await q('select public.gc_merge_accounts($1::uuid, $2::uuid) as j', [ANN, BOB]))[0].j;
  bl = await bill(BOB); p = await prof(BOB);
  check('the merge keeps the account that played more', merged.keep === BOB && merged.gone === ANN && (await q('select 1 from public.profiles where id = $1', [ANN])).length === 0, merged);
  check('her subscription and her Pro are now his', bl && bl.customer === annBill.customer && bl.subscription === annBill.subscription && bl.status === 'trialing' && bl.trial_used === true && bl.livemode === true &&
    new Date(p.pro_until).getTime() === new Date(annProf.pro_until).getTime() && p.pro_plan === 'year' && (await isOn(BOB)), [bl, p]);
  Object.assign(subL, { status: 'active', current_period_start: now(), current_period_end: now() + 365 * DAY });
  h = await sendHook(L, 'customer.subscription.updated', subL); // (its metadata still names Ann's old account)
  check('Stripe\'s news finds the kept account by its customer', h.body.note === 'active year' && (await bill(BOB)).status === 'active' && Math.abs(new Date((await prof(BOB)).pro_until).getTime() / 1000 - subL.current_period_end) < 2, h);
  // two running subscriptions can't become one
  const CAT = 'ffffffff-3333-4000-8000-000000000005';
  await q("insert into auth.users (id, email) values ($1, 'cat@example.com')", [CAT]);
  await q("insert into public.profiles (id, username, is_guest, pro_until, pro_plan) values ($1, 'Cat', false, now() + interval '20 days', 'month')", [CAT]);
  await q("insert into public.billing (user_id, customer, subscription, status, plan, livemode) values ($1, 'cus_cat', 'sub_cat', 'active', 'month', true)", [CAT]);
  let err = null;
  try { await q('select public.gc_merge_accounts($1::uuid, $2::uuid)', [CAT, BOB]); } catch (e) { err = e.message; }
  check('two running subscriptions: the merge is refused, both accounts stay', /two_subscriptions/.test(err || '') && (await q('select count(*)::int as n from public.profiles where id in ($1, $2)', [CAT, BOB]))[0].n === 2, err);
  // a founder merged into an account with nothing: the founder's seat moves
  await q("update public.billing set status = 'canceled', founder_at = now(), founder_payment = 'pi_cat' where user_id = $1", [CAT]);
  await q("update public.profiles set pro_founder = true, pro_plan = 'founder', pro_until = null where id = $1", [CAT]);
  await q('select public.gc_merge_accounts($1::uuid, $2::uuid)', [CAT, BOB]);
  bl = await bill(BOB); p = await prof(BOB);
  check('a founder\'s seat moves to the kept account, which keeps its own subscription', p.pro_founder === true && p.pro_plan === 'founder' && bl.founder_payment === 'pi_cat' && bl.subscription === subL.id && bl.status === 'active' && bl.customer === annBill.customer, [bl, p]);

  // ---- nothing leaks into the function's log
  check('the log holds no key and no signing secret', !logs.includes(TEST_KEY) && !logs.includes(LIVE_KEY) && !/whsec_[0-9a-f]{8}/.test(logs));
} catch (e) {
  fail++; console.log('FAIL crashed:', e && e.stack || e, '\n--- function log ---\n' + logs.slice(-3000));
} finally {
  if (deno) deno.kill();
  fake.close(); await pgServer.stop().catch(() => {}); await pg.close().catch(() => {});
}
console.log(`pay function under Deno: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
