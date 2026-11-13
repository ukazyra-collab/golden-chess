// Joker Pro bought in the apps: the pay function (supabase/functions/pay/index.ts) under Deno, against Postgres
// (PGlite) with the migrations, a stand-in for Apple's signing (a certificate chain shaped like the App Store's) and a
// stand-in for Google (the service account's sign-in and the Android Publisher API). What the app shows is checked
// and put on the account; renewals, ends and refunds follow; a purchase moves to the account that restores it; and
// what Stripe sold the same account is weighed against it.
// Run: DENO=/path/to/deno node test/server/store-local.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createDb } from './pg-harness.mjs';
import { makeChain, signJws, transaction, notification } from './apple-standin.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const DENO = process.env.DENO || 'deno';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 864e5;

// ---- the database: Dan a guest (most app players are), Eve and Fay with saved accounts, the owner
const DAN = 'aaaaaaaa-5555-4000-8000-000000000001', EVE = 'bbbbbbbb-5555-4000-8000-000000000002', FAY = 'cccccccc-5555-4000-8000-000000000003', OWNER = 'dddddddd-5555-4000-8000-000000000004';
const pg = await createDb([DAN, EVE, FAY, OWNER]);
const q = async (s, a) => (await pg.query(s, a)).rows;
await q("update auth.users set email = case id when $1 then 'eve@example.com' when $2 then 'fay@example.com' when $3 then 'owner@example.com' else null end", [EVE, FAY, OWNER]);
await q("insert into public.profiles (id, username, is_guest) values ($1, 'Dan', true), ($2, 'Eve', false), ($3, 'Fay', false), ($4, 'Owner', false)", [DAN, EVE, FAY, OWNER]);
await q('insert into public.admins (user_id) values ($1)', [OWNER]);
const pgServer = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 8 });
await pgServer.start();
const pgPort = pgServer.server ? pgServer.server.address().port : pgServer.port;
const prof = async (u) => (await q('select pro_until, pro_plan, pro_founder from public.profiles where id = $1', [u]))[0];
const row = async (id) => (await q('select * from public.store_purchases where id = $1', [id]))[0] || null;
const isOn = async (u) => { const p = await prof(u); return !!(p.pro_founder || (p.pro_until && new Date(p.pro_until).getTime() > Date.now())); };
const until = async (u) => { const p = await prof(u); return p.pro_until ? new Date(p.pro_until).getTime() : null; };

// ---- Apple: a chain of our own stands in for the App Store's
const chain = makeChain(), stranger = makeChain();
// ---- Google: a service account of our own, and the API it calls
const svc = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SVC_EMAIL = 'pay@standin.iam.gserviceaccount.com', PKG = 'com.kozyramedia.goldenchess';
const G = { subs: new Map(), products: new Map(), acks: [], voided: [], calls: [], signins: 0, access: null, gone: new Set() };
const iso = (ms) => new Date(ms).toISOString();
function gSub(token, o = {}) {
  const v = { kind: 'androidpublisher#subscriptionPurchaseV2', startTime: iso(o.start || Date.now()), regionCode: 'AE', subscriptionState: 'SUBSCRIPTION_STATE_' + (o.state || 'ACTIVE'), latestOrderId: o.order || 'GPA.1111-' + token.slice(-6),
    acknowledgementState: o.acked ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING',
    lineItems: [{ productId: o.product || 'jokerpro_sub', expiryTime: iso(o.expires || Date.now() + 30 * DAY), autoRenewingPlan: { autoRenewEnabled: o.auto !== false }, offerDetails: { basePlanId: o.plan || 'month', offerId: o.offer || undefined } }] };
  if (o.account) v.externalAccountIdentifiers = { obfuscatedExternalAccountId: o.account };
  if (o.test) v.testPurchase = {};
  if (o.linked) v.linkedPurchaseToken = o.linked;
  G.subs.set(token, v);
  return v;
}
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'ES256', use: 'sig' });
const fake = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/auth/v1/.well-known/jwks.json') return send(200, { keys: [jwk] });
    if (u.pathname === '/token' && req.method === 'POST') { // the service account signs in
      const f = new URLSearchParams(data), jwt = String(f.get('assertion') || ''), parts = jwt.split('.');
      let claims = null, ok = false;
      try {
        claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        ok = crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), svc.publicKey, Buffer.from(parts[2], 'base64url'));
      } catch (e) { ok = false; }
      G.lastClaims = claims;
      if (f.get('grant_type') !== 'urn:ietf:params:oauth:grant-type:jwt-bearer' || !ok || !claims || claims.iss !== SVC_EMAIL || claims.scope !== 'https://www.googleapis.com/auth/androidpublisher' || claims.aud !== fakeUrl + '/token' || claims.exp - claims.iat !== 3600)
        return send(400, { error: 'invalid_grant' });
      G.signins++; G.access = 'ya29.standin-' + crypto.randomBytes(8).toString('hex');
      return send(200, { access_token: G.access, expires_in: 3600, token_type: 'Bearer' });
    }
    const pre = '/androidpublisher/v3/applications/' + PKG + '/';
    if (!u.pathname.startsWith(pre)) return send(404, { error: { status: 'NOT_FOUND' } });
    if ((req.headers.authorization || '') !== 'Bearer ' + G.access || !G.access) return send(401, { error: { status: 'UNAUTHENTICATED' } });
    const path = decodeURIComponent(u.pathname.slice(pre.length));
    G.calls.push(req.method + ' ' + path);
    let m;
    if (G.down) return send(503, { error: { status: 'UNAVAILABLE' } });
    if ((m = /^purchases\/subscriptionsv2\/tokens\/(.+)$/.exec(path)) && req.method === 'GET') {
      if (G.gone.has(m[1])) return send(410, { error: { status: 'FAILED_PRECONDITION' } });
      return G.subs.has(m[1]) ? send(200, G.subs.get(m[1])) : send(404, { error: { status: 'NOT_FOUND' } });
    }
    if ((m = /^purchases\/products\/jokerpro_founder\/tokens\/(.+)$/.exec(path)) && req.method === 'GET') return G.products.has(m[1]) ? send(200, G.products.get(m[1])) : send(404, { error: { status: 'NOT_FOUND' } });
    if ((m = /^purchases\/subscriptions\/jokerpro_sub\/tokens\/(.+):acknowledge$/.exec(path)) && req.method === 'POST') { G.acks.push(m[1]); const v = G.subs.get(m[1]); if (v) v.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; res.writeHead(204); return res.end(); }
    if ((m = /^purchases\/products\/jokerpro_founder\/tokens\/(.+):acknowledge$/.exec(path)) && req.method === 'POST') { G.acks.push(m[1]); const v = G.products.get(m[1]); if (v) v.acknowledgementState = 1; res.writeHead(204); return res.end(); }
    if (path === 'purchases/voidedpurchases' && req.method === 'GET') return send(200, { voidedPurchases: G.voided.map((t) => ({ purchaseToken: t, voidedTimeMillis: String(Date.now()) })) });
    send(404, { error: { status: 'NOT_FOUND' } });
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const fakeUrl = 'http://127.0.0.1:' + fake.address().port;
const SVC_KEY = JSON.stringify({ type: 'service_account', client_email: SVC_EMAIL, private_key: svc.privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: fakeUrl + '/token' });

const b64u = (b) => Buffer.from(b).toString('base64url');
function token(sub, guest) {
  const t = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' }));
  const body = b64u(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: t, exp: t + 3600, iss: fakeUrl + '/auth/v1', is_anonymous: !!guest }));
  return head + '.' + body + '.' + b64u(crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privateKey, dsaEncoding: 'ieee-p1363' }));
}
const fnPort = 21000 + Math.floor(Math.random() * 1000);
const FN = `http://127.0.0.1:${fnPort}/pay`;
let deno = null, logs = '';
async function start(extra) {
  if (deno) { deno.kill(); await sleep(400); }
  const env = Object.assign({}, process.env, { SUPABASE_URL: fakeUrl, SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_DB_URL: `postgres://postgres:x@127.0.0.1:${pgPort}/postgres`,
    PAY_SITE: 'https://joker-chess.com/', PG_POOL_MAX: '1', DENO_DIR: process.env.DENO_DIR || '', APPLE_ROOT: chain.root, GOOGLE_API_URL: fakeUrl }, extra || {});
  for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_TEST_KEY', 'GOOGLE_PLAY_KEY']) if (!(extra && k in extra)) delete env[k];
  fs.writeFileSync('/tmp/gc-store-wrapper.ts', `Deno.serve = ((orig) => (h) => orig({ port: ${fnPort}, hostname: '127.0.0.1', onListen() {} }, h))(Deno.serve);\nawait import('${ROOT}supabase/functions/pay/index.ts');\n`);
  deno = spawn(DENO, ['run', '-A', '--no-lock', '/tmp/gc-store-wrapper.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  deno.stdout.on('data', (d) => (logs += d)); deno.stderr.on('data', (d) => (logs += d));
  for (let i = 0; i < 160; i++) { try { await fetch(`http://127.0.0.1:${fnPort}/`, { method: 'OPTIONS' }); return; } catch { await sleep(250); } }
  throw new Error('the function did not start\n' + logs);
}
async function call(tok, body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(Object.assign({}, body, tok ? { token: tok } : {})) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const post = async (raw) => { const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw }); return { status: r.status, body: await r.json().catch(() => null) }; };
const apple = (uid, guest, jws) => call(token(uid, guest), { action: 'store', store: 'apple', jws: Array.isArray(jws) ? jws : [jws] });
const google = (uid, guest, items) => call(token(uid, guest), { action: 'store', store: 'google', items });
const state = async (uid) => (await call(token(uid), { action: 'state' })).body;
const near = (a, b) => a !== null && Math.abs(a - b) < 1500;

try {
  // ================================================================ Apple
  await start({});
  let r = await state(DAN);
  check('before anything: no Pro, bought nowhere', r.pro.on === false && r.pro.via === null && r.foundersLeft === 1000, r);

  // ---- a guest buys the month in the iPhone app
  const t1 = transaction({ transactionId: '1001', originalTransactionId: '1001', appAccountToken: DAN, expiresDate: Date.now() + 30 * DAY });
  const j1 = signJws(t1, chain);
  r = await apple(DAN, true, j1);
  let p = await prof(DAN), sr = await row('apple:1001');
  check('a guest\'s purchase in the app: Pro at once, on that account', r.status === 200 && r.body.notes[0] === 'active month' && r.body.pro.on === true && r.body.pro.via === 'apple' && r.body.pro.sub === true &&
    r.body.pro.cancel === false && near(r.body.pro.until, t1.expiresDate) && p.pro_plan === 'month' && near(new Date(p.pro_until).getTime(), t1.expiresDate), [r.body, p]);
  check('the purchase is on file: whose, what, until when; real money, not a tester\'s', sr.user_id === DAN && sr.store === 'apple' && sr.kind === 'sub' && sr.plan === 'month' && sr.product === 'jokerpro_month' && sr.tx === '1001' &&
    sr.status === 'active' && sr.sandbox === false && sr.revoked_at === null && sr.token === null, sr);
  r = await apple(DAN, true, j1);
  check('shown again: nothing changes', r.body.pro.on === true && (await q('select count(*)::int as n from public.store_purchases'))[0].n === 1 && near(await until(DAN), t1.expiresDate));

  // ---- what is not Apple's, or not ours
  r = await apple(EVE, false, [signJws(transaction({ transactionId: '6001', originalTransactionId: '6001' }), stranger), 'not.a.jws', signJws(transaction({ transactionId: '6002', originalTransactionId: '6002', bundleId: 'com.other.app' }), chain),
    signJws(transaction({ transactionId: '6003', originalTransactionId: '6003', productId: 'gems_100' }), chain), signJws(transaction({ transactionId: '6004', originalTransactionId: '6004', isUpgraded: true }), chain)]);
  check('a forged transaction, a broken one, another app\'s, another product, a plan left behind: each refused, no Pro', r.body.notes.join() === 'refused:chain,refused:jws,not_ours,not_ours,upgraded' && r.body.pro.on === false &&
    !(await isOn(EVE)) && (await q("select count(*)::int as n from public.store_purchases where id like 'apple:600%'"))[0].n === 0, r.body.notes);
  r = await call(token(DAN, true), { action: 'store', store: 'steam', jws: [j1] });
  check('a store we do not know: refused', r.body.error === 'bad_store');
  check('no token: refused', (await call(null, { action: 'store', store: 'apple', jws: [j1] })).status === 401);

  // ---- Apple's notifications: a renewal, every notification once
  const t2 = transaction({ transactionId: '1002', originalTransactionId: '1001', appAccountToken: DAN, purchaseDate: Date.now(), expiresDate: Date.now() + 60 * DAY, transactionReason: 'RENEWAL' });
  const n2 = notification('DID_RENEW', t2, chain, { renewal: { autoRenewStatus: 1 } });
  r = await post(n2);
  sr = await row('apple:1001');
  check('a renewal told by Apple: Pro runs on', r.status === 200 && r.body.note === 'active month' && near(await until(DAN), t2.expiresDate) && sr.tx === '1002' && sr.auto_renew === true, [r, sr]);
  r = await post(n2);
  check('the same notification again: taken once', r.status === 200 && r.body.seen === true && (await q("select count(*)::int as n from public.billing_events where id like 'apple:%'"))[0].n === 1);
  const ev = (await q("select type, note, user_id, livemode from public.billing_events where id like 'apple:%'"))[0];
  check('it is on record: what, for whom', ev.type === 'apple.DID_RENEW' && ev.note === 'active month' && ev.user_id === DAN && ev.livemode === true, ev);
  r = await apple(DAN, true, j1);
  check('the first period\'s transaction shown again: the end date does not go back', near(await until(DAN), t2.expiresDate) && (await row('apple:1001')).tx === '1002' && r.body.pro.on === true);

  // ---- forged, foreign and test notifications
  r = await post(notification('DID_RENEW', transaction({ transactionId: '1003', originalTransactionId: '1001', expiresDate: Date.now() + 900 * DAY }), stranger));
  check('a notification that is not Apple\'s: refused, nothing changes', r.status === 400 && r.body.error === 'signature' && near(await until(DAN), t2.expiresDate));
  r = await post(notification('DID_RENEW', transaction({ transactionId: '1004', originalTransactionId: '1001', expiresDate: Date.now() + 900 * DAY }), chain, { chain: stranger }));
  check('Apple\'s transaction inside somebody else\'s envelope: refused', r.status === 400 && near(await until(DAN), t2.expiresDate));
  r = await post(JSON.stringify({ signedPayload: signJws({ notificationType: 'DID_RENEW', notificationUUID: crypto.randomUUID(), data: { bundleId: 'com.kozyramedia.goldenchess', environment: 'Production',
    signedTransactionInfo: signJws(transaction({ transactionId: '1005', originalTransactionId: '1001', expiresDate: Date.now() + 900 * DAY }), stranger) } }, chain) }));
  check('a forged transaction inside Apple\'s envelope: not taken (Apple may send it again)', r.status === 500 && near(await until(DAN), t2.expiresDate) && (await q("select count(*)::int as n from public.billing_events where id like 'apple:%'"))[0].n === 1, r);
  r = await post(JSON.stringify({ signedPayload: signJws({ notificationType: 'TEST', notificationUUID: crypto.randomUUID(), version: '2.0', signedDate: Date.now(), data: { bundleId: 'com.kozyramedia.goldenchess', environment: 'Sandbox' } }, chain) }));
  check('Apple\'s test notification is answered', r.status === 200 && r.body.note === 'test');
  r = await post(notification('DID_RENEW', transaction({ transactionId: '7001', originalTransactionId: '7001', bundleId: 'com.other.app' }), chain));
  check('another app\'s notification: taken and left alone', r.status === 200 && r.body.note === 'other_app' && (await row('apple:7001')) === null);

  // ---- auto-renew switched off, then the end
  r = await post(notification('DID_CHANGE_RENEWAL_STATUS', t2, chain, { subtype: 'AUTO_RENEW_DISABLED', renewal: { autoRenewStatus: 0 } }));
  r = await state(DAN);
  check('cancelled in the App Store: Pro runs to the end of what is paid, and says so', r.pro.on === true && r.pro.cancel === true && r.pro.via === 'apple' && near(r.pro.until, t2.expiresDate), r.pro);
  const t3 = transaction({ transactionId: '1002', originalTransactionId: '1001', appAccountToken: DAN, expiresDate: Date.now() - 1000 });
  await q("update public.store_purchases set expires_at = now() - interval '1 second' where id = 'apple:1001'"); await q('select public.gc_pro_refresh($1::uuid)', [DAN]);
  r = await post(notification('EXPIRED', t3, chain, { subtype: 'VOLUNTARY', renewal: { autoRenewStatus: 0 } }));
  sr = await row('apple:1001');
  check('the subscription ran out: no Pro, the purchase stays on file as ended', r.body.note === 'expired month' && !(await isOn(DAN)) && sr.status === 'expired' && sr.revoked_at === null && (await state(DAN)).pro.on === false, [r.body, sr]);
  // ---- they subscribe again: the same subscription comes back to life
  const t4 = transaction({ transactionId: '1010', originalTransactionId: '1001', appAccountToken: DAN, productId: 'jokerpro_year', expiresDate: Date.now() + 365 * DAY, offerType: 1, offerDiscountType: 'FREE_TRIAL', price: 0 });
  r = await apple(DAN, true, signJws(t4, chain));
  check('subscribed again, a year with its free week: Pro, a trial, the plan changed', r.body.notes[0] === 'active year' && r.body.pro.on === true && r.body.pro.trial === true && r.body.pro.plan === 'year' && r.body.pro.cancel === true && near(await until(DAN), t4.expiresDate), r.body);
  r = await post(notification('SUBSCRIBED', t4, chain, { subtype: 'RESUBSCRIBE', renewal: { autoRenewStatus: 1 } }));
  check('and Apple says it renews by itself again', (await state(DAN)).pro.cancel === false);

  // ---- a refund: only the refund of what runs now ends Pro
  r = await post(notification('REFUND', Object.assign({}, t1, { revocationDate: Date.now() - 5000, revocationReason: 0 }), chain));
  check('a refund for a period long over: Pro stays', r.body.note === 'old_refund' && (await isOn(DAN)) && near(await until(DAN), t4.expiresDate), r.body);
  const t4r = Object.assign({}, t4, { revocationDate: Date.now() - 2000, revocationReason: 1, signedDate: Date.now() });
  r = await post(notification('REFUND', t4r, chain));
  sr = await row('apple:1001');
  check('the refund of what runs now: Pro ends at once', r.body.note === 'revoked year' && !(await isOn(DAN)) && sr.status === 'revoked' && sr.revoked_at !== null && sr.auto_renew === false, [r.body, sr]);
  r = await apple(DAN, true, signJws(t4, chain));
  check('the refunded transaction shown again (as it was signed before the refund): no Pro', r.body.notes[0] === 'refunded' && r.body.pro.on === false && !(await isOn(DAN)), r.body);
  const t5 = transaction({ transactionId: '1020', originalTransactionId: '1001', appAccountToken: DAN, expiresDate: Date.now() + 30 * DAY });
  r = await apple(DAN, true, signJws(t5, chain));
  sr = await row('apple:1001');
  check('a new purchase after the refund counts again', r.body.pro.on === true && sr.status === 'active' && sr.revoked_at === null && sr.tx === '1020' && r.body.pro.plan === 'month', [r.body.pro, sr]);

  // ---- a purchase the app never told us about: Apple's notification names the account
  const t6 = transaction({ transactionId: '2001', originalTransactionId: '2001', appAccountToken: EVE.toUpperCase(), productId: 'jokerpro_year', expiresDate: Date.now() + 365 * DAY });
  r = await post(notification('SUBSCRIBED', t6, chain, { subtype: 'INITIAL_BUY', renewal: { autoRenewStatus: 1 } }));
  check('Apple\'s word alone is enough: the account named at the purchase gets Pro', r.body.note === 'active year' && (await isOn(EVE)) && (await row('apple:2001')).user_id === EVE && (await state(EVE)).pro.via === 'apple');
  const t7 = transaction({ transactionId: '2101', originalTransactionId: '2101', appAccountToken: 'eeeeeeee-5555-4000-8000-00000000dead', expiresDate: Date.now() + 30 * DAY });
  r = await post(notification('SUBSCRIBED', t7, chain));
  check('a purchase for an account that is gone: kept, nobody\'s', r.status === 200 && (await row('apple:2101')).user_id === null);
  r = await apple(FAY, false, signJws(t7, chain));
  check('until the app that holds it shows it: then it is that account\'s', r.body.pro.on === true && (await row('apple:2101')).user_id === FAY);

  // ---- restore on another account: the purchase moves (one account holds it at a time)
  r = await apple(FAY, false, signJws(t5, chain));
  check('Dan\'s subscription restored on Fay\'s account: Fay holds it now, Dan does not', (await row('apple:1001')).user_id === FAY && !(await isOn(DAN)) && (await isOn(FAY)) && (await state(DAN)).pro.on === false);
  r = await post(notification('DID_RENEW', transaction({ transactionId: '1021', originalTransactionId: '1001', appAccountToken: DAN, expiresDate: Date.now() + 61 * DAY }), chain));
  check('Apple still names the first account at renewals: the holder on file keeps it', (await row('apple:1001')).user_id === FAY && !(await isOn(DAN)) && r.body.note === 'active month');
  r = await apple(DAN, true, signJws(t5, chain));
  check('and back again by showing it', (await row('apple:1001')).user_id === DAN && (await isOn(DAN)) && near(await until(DAN), Date.now() + 61 * DAY));

  // ---- the founder's purchase; a tester's takes no place
  const f1 = transaction({ transactionId: '3001', originalTransactionId: '3001', productId: 'jokerpro_founder', appAccountToken: EVE });
  r = await apple(EVE, false, signJws(f1, chain));
  p = await prof(EVE);
  check('a founder in the app: Pro for life, one place taken', r.body.notes[0] === 'active founder' && r.body.pro.founder === true && r.body.pro.via === 'apple' && p.pro_founder === true && p.pro_plan === 'founder' && r.body.foundersLeft === 999, [r.body, p]);
  const f2 = transaction({ transactionId: '3002', originalTransactionId: '3002', productId: 'jokerpro_founder', environment: 'Sandbox' });
  r = await apple(OWNER, false, signJws(f2, chain));
  check('a tester\'s founder purchase works, and takes no place', r.body.pro.founder === true && r.body.notes[0] === 'active founder (sandbox)' && r.body.foundersLeft === 999 && (await row('apple:3002')).sandbox === true &&
    (await q('select public.pro_public() as j'))[0].j.founders_left === 999, r.body);
  r = await post(notification('REFUND', Object.assign({}, f1, { revocationDate: Date.now() - 1000 }), chain));
  p = await prof(EVE);
  check('the founder\'s money given back: no founder; the subscription they also hold still runs', r.body.note === 'revoked founder' && p.pro_founder === false && p.pro_plan === 'year' && (await isOn(EVE)) && (await state(EVE)).foundersLeft === 1000, [r.body, p]);
  r = await apple(EVE, false, signJws(f1, chain));
  check('the refunded founder purchase shown again: nothing', r.body.notes[0] === 'refunded' && (await prof(EVE)).pro_founder === false);

  // ---- with what Stripe sold the same account
  await q("insert into public.billing (user_id, customer, subscription, status, plan, period_end, until, livemode) values ($1, 'cus_eve', 'sub_eve', 'active', 'month', now() + interval '10 days', now() + interval '10 days', true)", [EVE]);
  await q('select public.gc_pro_refresh($1::uuid)', [EVE]);
  r = await state(EVE);
  check('a Stripe subscription beside a longer one from the App Store: the longer one counts', r.pro.via === 'apple' && near(r.pro.until, t6.expiresDate) && r.pro.plan === 'year', r.pro);
  r = await post(notification('REFUND', Object.assign({}, t6, { revocationDate: Date.now() - 1000 }), chain));
  r = await state(EVE);
  check('the App Store one refunded: Pro falls back to what Stripe sold', r.pro.on === true && r.pro.via === 'stripe' && near(r.pro.until, Date.now() + 10 * DAY) && (await prof(EVE)).pro_plan === 'month', r.pro);
  await q("update public.billing set status = 'canceled', until = now() where user_id = $1", [EVE]); await q('select public.gc_pro_refresh($1::uuid)', [EVE]);
  check('and with that one over too: no Pro', !(await isOn(EVE)) && (await state(EVE)).pro.via === null);

  // ---- an account deleted, two accounts become one
  await q('delete from auth.users where id = $1', [FAY]);
  check('an account deleted: its purchases stay on file, nobody\'s', (await row('apple:2101')).user_id === null && (await q('select count(*)::int as n from public.profiles where id = $1', [FAY]))[0].n === 0);
  const GAL = 'ffffffff-5555-4000-8000-000000000006';
  await q("insert into auth.users (id, email) values ($1, 'gal@example.com')", [GAL]);
  await q("insert into public.profiles (id, username, is_guest) values ($1, 'Gal', false)", [GAL]);
  const merged = (await q('select public.gc_merge_accounts($1::uuid, $2::uuid) as j', [DAN, GAL]))[0].j;
  check('two accounts become one: what the app bought goes to the kept account, with its Pro', (await row('apple:1001')).user_id === merged.keep && (await isOn(merged.keep)) &&
    (await q('select count(*)::int as n from public.profiles where id = $1', [merged.gone]))[0].n === 0, merged);
  const KEEP = merged.keep;

  // ================================================================ Google
  r = await google(KEEP, false, [{ token: 'tok-android-000000000000000001', type: 'subs' }]);
  check('no service account set: the Android side says so, nothing breaks', r.status === 200 && r.body.error === 'google_not_set_up');
  r = await call(null, { action: 'sweep', key: 'x'.repeat(40) });
  check('the hourly look needs the cron\'s key', r.status === 401);
  const CRON = (await q("select value #>> '{}' as k from public.billing_config where key = 'cron_key'"))[0].k;
  check('the cron\'s key was made by the database', typeof CRON === 'string' && CRON.length === 64);
  r = await call(null, { action: 'sweep', key: CRON });
  check('without a service account the look does nothing', r.status === 200 && r.body.google === 'not_set_up');
  await start({ GOOGLE_PLAY_KEY: SVC_KEY });

  const A1 = 'tok-android-aaaaaaaaaaaaaaaaaaaaaaaa.AO-J1Oxyz_0001';
  gSub(A1, { plan: 'year', offer: 'trial', expires: Date.now() + 7 * DAY, account: OWNER });
  await q('delete from public.store_purchases where user_id = $1', [OWNER]); await q('select public.gc_pro_refresh($1::uuid)', [OWNER]);
  r = await google(OWNER, false, [{ token: A1, type: 'subs' }]);
  sr = await row('google:' + A1);
  check('a year with its free week bought in the Android app: Pro, a trial, bought at Google', r.body.notes[0] === 'active year' && r.body.pro.on === true && r.body.pro.via === 'google' && r.body.pro.trial === true && r.body.pro.plan === 'year' &&
    r.body.pro.cancel === false && near(r.body.pro.until, Date.now() + 7 * DAY) && sr.user_id === OWNER && sr.token === A1 && sr.tx !== null && sr.checked_at !== null, [r.body, sr]);
  check('the service account signed in properly, once', G.signins === 1 && G.lastClaims.iss === SVC_EMAIL);
  check('the purchase was acknowledged (Google refunds after three days otherwise)', G.acks.length === 1 && G.acks[0] === A1);
  r = await google(OWNER, false, [{ token: A1, type: 'subs' }]);
  check('shown again: no second acknowledgement, no second sign-in', G.acks.length === 1 && G.signins === 1 && r.body.pro.on === true);
  r = await google(OWNER, false, [{ token: 'tok-android-unknown-0000000000000001', type: 'subs' }, { token: 'short', type: 'subs' }, { type: 'subs' }]);
  check('a token Google does not know, a malformed one, none: refused', r.body.notes.join() === 'unknown_token,bad_token,bad_token' && (await q("select count(*)::int as n from public.store_purchases where store = 'google'"))[0].n === 1, r.body.notes);
  gSub('tok-android-other-product-0000000001', { product: 'another_sub' });
  r = await google(OWNER, false, [{ token: 'tok-android-other-product-0000000001', type: 'subs' }]);
  check('another product\'s token: not ours', r.body.notes[0] === 'not_ours');

  // ---- the hourly look: renewed, cancelled, on hold, back, expired
  r = await call(null, { action: 'sweep', key: CRON });
  check('a trial with days to run is left alone by the look', r.body.ok === true && r.body.checked === 0, r.body);
  await q("update public.store_purchases set expires_at = now() + interval '3 hours' where id = $1", ['google:' + A1]); // (the free week is nearly over)
  gSub(A1, { plan: 'year', expires: Date.now() + 365 * DAY, start: Date.now() - 8 * DAY, acked: true, account: OWNER });
  r = await call(null, { action: 'sweep', key: CRON });
  check('the look finds the trial became a paid year', r.body.ok === true && r.body.checked === 1 && near(await until(OWNER), Date.now() + 365 * DAY) && (await state(OWNER)).pro.trial === false, r.body);
  r = await call(null, { action: 'sweep', key: CRON });
  check('a subscription with months to run is not asked about every hour', r.body.checked === 0);
  await q("update public.store_purchases set expires_at = now() + interval '2 hours' where id = $1", ['google:' + A1]);
  gSub(A1, { plan: 'year', state: 'CANCELED', auto: false, expires: Date.now() + 2 * 3600e3, acked: true });
  r = await call(null, { action: 'sweep', key: CRON });
  check('cancelled at Google: runs to its end, and says so', r.body.checked === 1 && (await state(OWNER)).pro.cancel === true && (await isOn(OWNER)));
  gSub(A1, { plan: 'year', state: 'ON_HOLD', expires: Date.now() - 60e3, acked: true });
  await q("update public.store_purchases set expires_at = now() + interval '1 hour' where id = $1", ['google:' + A1]);
  r = await call(null, { action: 'sweep', key: CRON });
  check('a payment that failed, on hold: no Pro meanwhile', !(await isOn(OWNER)) && (await row('google:' + A1)).status === 'paused');
  gSub(A1, { plan: 'year', state: 'ACTIVE', expires: Date.now() + 300 * DAY, acked: true });
  r = await call(null, { action: 'sweep', key: CRON });
  check('the payment went through later: Pro is back', (await isOn(OWNER)) && (await row('google:' + A1)).status === 'active');
  G.down = true;
  await q("update public.store_purchases set expires_at = now() + interval '1 hour' where id = $1", ['google:' + A1]);
  r = await call(null, { action: 'sweep', key: CRON });
  check('Google not answering: nothing is taken away, the look says it failed', r.body.ok === false && r.body.failed >= 1 && (await isOn(OWNER)));
  G.down = false;

  // ---- a change of plan: a new token replaces the old one
  const A2 = 'tok-android-bbbbbbbbbbbbbbbbbbbbbbbb.AO-J1Oxyz_0002';
  gSub(A2, { plan: 'month', expires: Date.now() + 30 * DAY, linked: A1, account: OWNER });
  r = await google(OWNER, false, [{ token: A2, type: 'subs' }]);
  check('a change of plan: the new purchase counts, the one it replaced is over', r.body.pro.on === true && r.body.pro.plan === 'month' && near(await until(OWNER), Date.now() + 30 * DAY) && (await row('google:' + A1)).status === 'expired', [r.body.pro, await row('google:' + A1)]);

  // ---- restored on another account, a tester's purchase, the founder
  r = await google(KEEP, false, [{ token: A2, type: 'subs' }]);
  check('restored on another account: it moves there', (await row('google:' + A2)).user_id === KEEP && !(await isOn(OWNER)));
  const A3 = 'tok-android-cccccccccccccccccccccccc.AO-J1Oxyz_0003';
  G.products.set(A3, { purchaseTimeMillis: String(Date.now()), purchaseState: 0, consumptionState: 0, orderId: 'GPA.3333-0003', acknowledgementState: 0, obfuscatedExternalAccountId: OWNER, regionCode: 'AE' });
  r = await google(OWNER, false, [{ token: A3, type: 'inapp' }]);
  check('a founder in the Android app: Pro for life, acknowledged, one place taken', r.body.notes[0] === 'active founder' && r.body.pro.founder === true && r.body.pro.via === 'google' && G.acks.includes(A3) && r.body.foundersLeft === 999, r.body);
  const A4 = 'tok-android-dddddddddddddddddddddddd.AO-J1Oxyz_0004';
  G.products.set(A4, { purchaseState: 0, purchaseType: 0, acknowledgementState: 1, orderId: 'GPA.3333-0004' });
  r = await google(EVE, false, [{ token: A4, type: 'inapp' }]);
  check('a licence tester\'s founder purchase: works, takes no place', r.body.pro.founder === true && (await row('google:' + A4)).sandbox === true && r.body.foundersLeft === 999);
  G.products.set('tok-android-pending-00000000000000000001', { purchaseState: 2, acknowledgementState: 0 });
  r = await google(DAN, true, [{ token: 'tok-android-pending-00000000000000000001', type: 'inapp' }]);
  check('a purchase still waiting for its payment gives nothing yet', r.body.notes[0] === 'pending founder' && r.body.pro.founder === false && !G.acks.includes('tok-android-pending-00000000000000000001'));

  // ---- money given back at Google: found by the daily look
  G.voided = [A3];
  await q("delete from public.billing_config where key = 'google_voided'");
  const askedBefore = G.calls.filter((c) => c === 'GET purchases/voidedpurchases').length;
  r = await call(null, { action: 'sweep', key: CRON });
  p = await prof(OWNER);
  check('Google gave the founder\'s money back: no founder any more', r.body.voided === 1 && p.pro_founder === false && (await row('google:' + A3)).status === 'revoked' && (await state(OWNER)).foundersLeft === 1000, [r.body, p]);
  r = await call(null, { action: 'sweep', key: CRON });
  check('the list of refunds is asked for once a day', r.body.voided === 0 && G.calls.filter((c) => c === 'GET purchases/voidedpurchases').length === askedBefore + 1 && askedBefore === 1);
  // ---- a token Google has forgotten
  G.gone.add(A2);
  await q("update public.store_purchases set checked_at = now() - interval '4 days' where id = $1", ['google:' + A2]);
  r = await call(null, { action: 'sweep', key: CRON });
  check('a purchase Google no longer knows: it ends', !(await isOn(KEEP)) || (await row('apple:1001')).user_id === KEEP, await row('google:' + A2));
  check('and is marked so', (await row('google:' + A2)).status === 'expired');

  // ---- what everybody may ask, and what stays closed
  const pub = (await q('select public.pro_public() as j'))[0].j;
  check('the public answer says which apps sell (none yet) and the places left', pub.on === false && pub.ios === false && pub.android === false && pub.founders_left === 1000, pub);
  await q("update public.billing_config set value = '{\"ios\": \"on\", \"android\": \"test\"}'::jsonb where key = 'stores'");
  const pub2 = (await q('select public.pro_public() as j'))[0].j;
  check('only "on" counts for it', pub2.ios === true && pub2.android === false, pub2);
  const grants = await q("select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'store_purchases' and grantee in ('anon', 'authenticated')");
  check('the page\'s roles hold no rights on the purchases', grants.length === 0 && (await q("select relrowsecurity as r from pg_class where relname = 'store_purchases'"))[0].r === true, grants);
  const fn = await q("select has_function_privilege('anon', 'public.gc_pro_refresh(uuid)', 'execute') as a, has_function_privilege('authenticated', 'public.gc_pro_refresh(uuid)', 'execute') as b");
  check('nor may they work a profile\'s Pro out themselves', fn[0].a === false && fn[0].b === false);
  r = await call(null, { action: 'admin_state', key: 'k'.repeat(40) });
  check('the owner\'s view needs the owner\'s key', r.status === 401);

  // ---- nothing leaks into the function's log
  check('the log holds no purchase token, no access token, no key', !logs.includes(A1) && !logs.includes(A2) && !logs.includes('ya29.standin') && !logs.includes('BEGIN PRIVATE KEY') && !logs.includes(CRON));
} catch (e) {
  fail++; console.log('FAIL crashed:', (e && e.stack) || e, '\n--- function log ---\n' + logs.slice(-3000));
} finally {
  if (deno) deno.kill();
  fake.close(); await pgServer.stop().catch(() => {}); await pg.close().catch(() => {});
}
console.log(`store purchases under Deno: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
