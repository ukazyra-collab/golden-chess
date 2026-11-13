// Joker Pro, the paying side (Supabase Edge Function; the database part is the pro migration, the rules billing.js).
//
// A player's requests (POST, text/plain JSON with their access token inside, like the play function):
//   state     what their account has
//   checkout  { plan: 'month' | 'year' | 'founder', back?, lang? } → { url }: Stripe's own payment page. A guest saves
//             the account first; a running subscription gets the page that manages it instead ({ already, url })
//   confirm   { sid } → their state: the payment page sent them back, and the account is brought up to date at once
//             (the webhook says the same a moment later, or earlier)
//   portal    { back? } → { url }: Stripe's page for the card, the plan, the invoices, cancelling
// Stripe's webhook (POST with a Stripe-Signature header): every event once (billing_events); the account follows the
// subscription as Stripe has it at that moment, whatever order the events come in.
// The owner's requests (POST with the one-time key kept in billing_config): setup (the product, the prices, the page
// that manages a subscription, the webhook: made at Stripe once for each of its two modes), selftest (test mode only:
// a subscription made and cancelled through Stripe's API, to see the webhook bring the account along), admin_state.
//
// Settings: STRIPE_SECRET_KEY and STRIPE_TEST_KEY (Stripe's live and test secret keys; the owner enters them in the
// Supabase dashboard; which is which is read off the key itself), PAY_SITE (default https://joker-chess.com/),
// STRIPE_API_URL (the tests point it at a stand-in).
// billing_config's mode decides who sees Pro and which side of Stripe serves them: 'off' nobody; 'test' the owner's
// accounts, on the test side (no money moves); 'on' everyone, with real money. A test key never sells to players.
// Deployed without JWT checks (config.toml): Stripe has no token, players' tokens are checked here.
import postgres from 'npm:postgres@3.4.9';
import { PLANS, PRODUCT, LIVE, EVENTS, form, keyMode, access, verify, entitlement, replaces, publicState, backUrl } from './billing.js';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || SERVICE_KEY;
const DB_URL = Deno.env.get('SUPABASE_DB_URL')!;
const ISSUER = SUPABASE_URL + '/auth/v1';
// the two sides of Stripe: real money and the test mode, each with its own key, customers, prices and webhook
type Side = { km: 'test' | 'live'; key: string; live: boolean };
const SIDES: { test: Side | null; live: Side | null } = { test: null, live: null };
for (const v of [Deno.env.get('STRIPE_SECRET_KEY') || '', Deno.env.get('STRIPE_TEST_KEY') || '']) {
  const m = keyMode(v);
  if (m && !SIDES[m as 'test' | 'live']) SIDES[m as 'test' | 'live'] = { km: m as 'test' | 'live', key: v, live: m === 'live' };
}
// which side serves the players now: real money once the mode is 'on', else the test side (whichever exists)
const sideFor = (mode: string): Side | null => (mode === 'on' ? SIDES.live || SIDES.test : SIDES.test || SIDES.live);
const API = (Deno.env.get('STRIPE_API_URL') || 'https://api.stripe.com').replace(/\/+$/, '');
const SITE = Deno.env.get('PAY_SITE') || 'https://joker-chess.com/';
const LOCAL = !!Deno.env.get('STRIPE_API_URL'); // under the tests the player comes back to a local page
const HOOK_URL = SUPABASE_URL + '/functions/v1/pay';

const sql = postgres(DB_URL, { max: +(Deno.env.get('PG_POOL_MAX') || 2), prepare: false, idle_timeout: 60, onnotice: () => {} });

class Fail extends Error { code: string; extra?: Record<string, unknown>; constructor(code: string, extra?: Record<string, unknown>) { super(code); this.code = code; this.extra = extra; } }

// ---- Stripe's API (form bodies in, JSON out)
// deno-lint-ignore no-explicit-any
async function stripe(S: Side | null, method: string, path: string, params?: unknown, idem?: string): Promise<any> {
  if (!S) throw new Fail('not_set_up');
  const get = method === 'GET';
  const headers: Record<string, string> = { Authorization: 'Bearer ' + S.key };
  if (!get) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idem) headers['Idempotency-Key'] = idem;
  const q = params ? form(params) : '';
  const r = await fetch(API + '/v1/' + path + (get && q ? '?' + q : ''), { method, headers, body: get ? undefined : q });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const err = (j && j.error) || {};
    console.error('stripe', method, path, r.status, err.type || '', err.code || '', err.message || '');
    throw new Fail('stripe', { status: r.status, type: err.type || null, code: err.code || null, message: err.message || null });
  }
  return j;
}

// ---- the database
// deno-lint-ignore no-explicit-any
const one = (rows: any[]) => (rows.length ? rows[0] : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// deno-lint-ignore no-explicit-any
async function config(key: string): Promise<any> { const r = await sql`select value from public.billing_config where key = ${key}`; return r.length ? r[0].value : null; }
async function setConfig(key: string, value: unknown) {
  // deno-lint-ignore no-explicit-any
  await sql`insert into public.billing_config (key, value) values (${key}, ${sql.json(value as any)}) on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
const profileOf = async (uid: string) => one(await sql`select p.id, p.username, p.is_guest, p.pro_until, p.pro_plan, p.pro_founder, coalesce(to_jsonb(p)->>'lang', 'en') as lang from public.profiles p where p.id = ${uid}`);
const rowOf = async (uid: string) => one(await sql`select * from public.billing where user_id = ${uid}`);
const isAdmin = async (uid: string) => (await sql`select 1 from public.admins where user_id = ${uid}`).length > 0;
const emailOf = async (uid: string) => { const r = one(await sql`select email from auth.users where id = ${uid}`); return (r && r.email) || ''; };
const modeNow = async () => String((await config('mode')) || 'off');

// the prices by plan, found at Stripe by their lookup keys (kept while the worker lives)
const pricesP: Record<string, Promise<Record<string, string>> | null> = { test: null, live: null };
function priceIds(S: Side | null, fresh = false): Promise<Record<string, string>> {
  if (!S) return Promise.reject(new Fail('not_set_up'));
  if (!pricesP[S.km] || fresh) {
    const p = stripe(S, 'GET', 'prices', { lookup_keys: Object.values(PLANS).map((x) => x.lookup), active: true, limit: 20 }).then((r) => {
      const out: Record<string, string> = {};
      // deno-lint-ignore no-explicit-any
      for (const pr of (r.data || []) as any[]) for (const [plan, def] of Object.entries(PLANS)) if (pr.lookup_key === def.lookup) out[plan] = pr.id;
      return out;
    });
    pricesP[S.km] = p;
    p.catch(() => { if (pricesP[S.km] === p) pricesP[S.km] = null; });
  }
  return pricesP[S.km]!;
}

// the account's customer at Stripe, on the side (test or live) of the key in use. An account that only ever tried the
// test mode starts clean with real money; real money on file is never touched from the test side.
// deno-lint-ignore no-explicit-any
async function customerFor(S: Side, uid: string, prof: any, row: any): Promise<string> {
  if (row && row.customer && row.livemode === S.live) return row.customer;
  if (row && row.livemode && !S.live && (row.subscription || row.founder_at)) throw new Fail('live_account');
  const email = await emailOf(uid);
  if (!email) throw new Fail('guest');
  const c = await stripe(S, 'POST', 'customers', { email, name: prof.username, metadata: { user_id: uid, app: 'joker-chess' } });
  await sql.begin(async (tx) => {
    await tx`insert into public.billing (user_id, customer, livemode) values (${uid}, ${c.id}, ${S.live})
      on conflict (user_id) do update set customer = excluded.customer, livemode = excluded.livemode, subscription = null, status = null, plan = null,
        period_end = null, cancel_at_period_end = false, trial_used = false, founder_at = null, founder_payment = null, updated_at = now()`;
    if (row && row.livemode !== S.live) await tx`update public.profiles set pro_until = null, pro_plan = null, pro_founder = false where id = ${uid}`;
  });
  return c.id;
}

// ---- the account follows Stripe
// a subscription as Stripe has it now
// deno-lint-ignore no-explicit-any
async function applySub(sub: any, hint?: string): Promise<string> {
  const ent = entitlement(sub, Date.now());
  let uid = (sub.metadata && sub.metadata.user_id) || hint || '';
  const byCustomer = ent.customer ? one(await sql`select user_id from public.billing where customer = ${ent.customer}`) : null;
  if (byCustomer) uid = byCustomer.user_id; // (the customer on file knows best: two accounts may have become one since)
  if (!UUID.test(uid)) return 'no_user';
  const prof = await profileOf(uid);
  if (!prof) return 'no_profile';
  const row = await rowOf(uid);
  if (row && row.livemode && !ent.livemode) return 'test_news_for_a_live_account'; // (the test side never writes over real money's side)
  if (!replaces(row, ent)) return 'older_subscription';
  const until = ent.until ? new Date(ent.until) : null, end = ent.periodEnd ? new Date(ent.periodEnd) : null;
  await sql.begin(async (tx) => {
    await tx`insert into public.billing (user_id, customer, subscription, status, plan, period_end, cancel_at_period_end, trial_used, livemode)
      values (${uid}, ${ent.customer}, ${ent.id}, ${ent.status}, ${ent.plan}, ${end}, ${ent.cancel}, ${ent.trial}, ${ent.livemode})
      on conflict (user_id) do update set customer = coalesce(excluded.customer, billing.customer), subscription = excluded.subscription, status = excluded.status,
        plan = coalesce(excluded.plan, billing.plan), period_end = excluded.period_end, cancel_at_period_end = excluded.cancel_at_period_end,
        trial_used = billing.trial_used or excluded.trial_used, livemode = excluded.livemode, updated_at = now()`;
    await tx`update public.profiles set pro_until = ${until}, pro_plan = case when pro_founder then 'founder' else coalesce(${ent.plan}, pro_plan) end where id = ${uid}`;
  });
  return ent.status + (ent.plan ? ' ' + ent.plan : '');
}
// the one payment for life
// deno-lint-ignore no-explicit-any
async function applyFounder(S: Side | null, uid: string, s: any): Promise<string> {
  if (!UUID.test(uid) || !(await profileOf(uid))) return 'no_profile';
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent && s.payment_intent.id) || null;
  const cus = typeof s.customer === 'string' ? s.customer : (s.customer && s.customer.id) || null;
  const row = await rowOf(uid);
  if (row && row.livemode && !s.livemode) return 'test_news_for_a_live_account';
  await sql.begin(async (tx) => {
    await tx`insert into public.billing (user_id, customer, founder_at, founder_payment, livemode) values (${uid}, ${cus}, now(), ${pi}, ${!!s.livemode})
      on conflict (user_id) do update set customer = coalesce(billing.customer, excluded.customer), founder_at = coalesce(billing.founder_at, now()),
        founder_payment = coalesce(excluded.founder_payment, billing.founder_payment), updated_at = now()`;
    await tx`update public.profiles set pro_founder = true, pro_plan = 'founder' where id = ${uid}`;
  });
  // a founder pays nothing more: a subscription still running stops here
  if (row && row.subscription && LIVE.includes(row.status || '')) {
    try { await applySub(await stripe(S, 'DELETE', 'subscriptions/' + row.subscription), uid); } catch (e) { console.error('founder: the subscription stays', String(e)); }
  }
  return 'founder';
}
// deno-lint-ignore no-explicit-any
async function applySession(S: Side | null, s: any): Promise<string> {
  const uid = String(s.client_reference_id || (s.metadata && s.metadata.user_id) || '');
  if (s.mode === 'subscription' && s.subscription) {
    const id = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
    return applySub(await stripe(S, 'GET', 'subscriptions/' + id), uid);
  }
  if (s.mode === 'payment' && s.payment_status === 'paid' && s.metadata && s.metadata.plan === 'founder') return applyFounder(S, uid, s);
  return 'nothing_to_apply';
}
// a founder's payment given back in full
// deno-lint-ignore no-explicit-any
async function applyRefund(charge: any): Promise<string> {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  if (!pi || !charge.refunded) return 'not_a_full_refund';
  const row = one(await sql`select user_id, status, plan from public.billing where founder_payment = ${pi}`);
  if (!row) return 'not_a_founder_payment';
  await sql.begin(async (tx) => {
    await tx`update public.billing set founder_at = null, updated_at = now() where user_id = ${row.user_id}`;
    await tx`update public.profiles set pro_founder = false, pro_plan = ${LIVE.includes(row.status || '') ? row.plan : null} where id = ${row.user_id}`;
  });
  return 'founder_refunded';
}

// ---- the webhook
async function hook(raw: string, header: string): Promise<Response> {
  const secrets: string[] = [];
  for (const k of ['hook:live', 'hook:test']) { const c = await config(k); if (c && c.secret) secrets.push(c.secret); }
  const env = Deno.env.get('STRIPE_WEBHOOK_SECRET'); if (env) secrets.push(env);
  let ok = false, why = 'no_secret';
  for (const s of secrets) { const v = await verify(header, raw, s, Math.floor(Date.now() / 1000)); if (v.ok) { ok = true; break; } why = v.why || why; }
  if (!ok) { console.error('webhook refused', why); return json({ error: 'signature' }, 400); }
  // deno-lint-ignore no-explicit-any
  let ev: any = null;
  try { ev = JSON.parse(raw); } catch { /* not JSON */ }
  if (!ev || typeof ev.id !== 'string' || typeof ev.type !== 'string' || !ev.data || !ev.data.object) return json({ error: 'bad_event' }, 400);
  const fresh = await sql`insert into public.billing_events (id, type, livemode) values (${ev.id}, ${ev.type}, ${!!ev.livemode}) on conflict (id) do nothing returning id`;
  if (!fresh.length) return json({ ok: true, seen: true });
  const obj = ev.data.object;
  let note = 'ignored';
  try {
    const S = ev.livemode ? SIDES.live : SIDES.test; // the side the event came from (its key looks things up there)
    if (ev.type === 'checkout.session.completed') note = await applySession(S, obj);
    else if (ev.type.startsWith('customer.subscription.')) {
      // deno-lint-ignore no-explicit-any
      let sub: any = obj;
      if (S) { try { sub = await stripe(S, 'GET', 'subscriptions/' + obj.id); } catch (e) { if (!(e instanceof Fail && e.extra && e.extra.status === 404)) throw e; } }
      note = await applySub(sub);
    } else if (ev.type === 'charge.refunded') note = await applyRefund(obj);
  } catch (e) {
    // not handled: the row goes, so Stripe's next delivery of this event is taken up again
    await sql`delete from public.billing_events where id = ${ev.id}`;
    console.error('webhook failed', ev.type, ev.id, String(e));
    return json({ error: 'failed' }, 500);
  }
  const uid = String((obj.metadata && obj.metadata.user_id) || obj.client_reference_id || '');
  await sql`update public.billing_events set note = ${note}, user_id = ${UUID.test(uid) ? uid : null} where id = ${ev.id}`;
  return json({ ok: true, note });
}

// ---- a player's requests
type Caller = { sub: string; guest: boolean | null };
// deno-lint-ignore no-explicit-any
async function stateOf(uid: string): Promise<any> {
  const [prof, row, admin, mode, founders] = await Promise.all([profileOf(uid), rowOf(uid), isAdmin(uid), modeNow(),
    sql`select count(*)::int as n from public.profiles where pro_founder`]);
  if (!prof) throw new Fail('profile');
  const S = sideFor(mode), mine = row && S && row.livemode === S.live ? row : null;
  return { pro: publicState(prof, mine, Date.now()), can: access(mode, S ? S.km : null, admin), test: (S && !S.live) || undefined,
    foundersLeft: Math.max(0, PLANS.founder.seats - Number(founders[0].n)), now: Date.now() };
}
// deno-lint-ignore no-explicit-any
async function checkout(uid: string, caller: Caller, b: any) {
  const plan = String(b.plan || '');
  if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) throw new Fail('bad_plan');
  const [prof, row, admin, mode] = await Promise.all([profileOf(uid), rowOf(uid), isAdmin(uid), modeNow()]);
  if (!prof) throw new Fail('profile');
  const S = sideFor(mode);
  if (!S || !access(mode, S.km, admin)) throw new Fail('off');
  if (caller.guest === true || prof.is_guest) throw new Fail('guest');
  const mine = row && row.livemode === S.live ? row : null;
  const back = backUrl(b.back, SITE, LOCAL);
  if (plan === 'founder') {
    if (prof.pro_founder) throw new Fail('already');
    const n = Number((await sql`select count(*)::int as n from public.profiles where pro_founder`)[0].n);
    if (n >= PLANS.founder.seats) throw new Fail('sold_out');
  } else if (mine && LIVE.includes(mine.status || '')) {
    return { already: true, url: (await portalUrl(S, mine.customer, back, prof.lang)) };
  }
  const prices = await priceIds(S);
  if (!prices[plan]) throw new Fail('not_set_up');
  const customer = await customerFor(S, uid, prof, row);
  const lang = b.lang === 'ru' || (b.lang == null && prof.lang === 'ru') ? 'ru' : 'auto';
  // deno-lint-ignore no-explicit-any
  const params: any = { mode: plan === 'founder' ? 'payment' : 'subscription', customer, client_reference_id: uid, locale: lang,
    line_items: [{ price: prices[plan], quantity: 1 }], allow_promotion_codes: true, metadata: { user_id: uid, plan },
    success_url: back + '?pro=ok&sid={CHECKOUT_SESSION_ID}', cancel_url: back + '?pro=back' };
  if (plan === 'founder') params.payment_intent_data = { metadata: { user_id: uid, plan } };
  else {
    params.subscription_data = { metadata: { user_id: uid, plan } };
    const days = (PLANS as Record<string, { trialDays?: number }>)[plan].trialDays;
    if (days && !(mine && mine.trial_used)) params.subscription_data.trial_period_days = days;
  }
  const s = await stripe(S, 'POST', 'checkout/sessions', params);
  return { url: s.url };
}
async function portalUrl(S: Side, customer: string, back: string, lang?: string): Promise<string> {
  const cfg = await config('portal:' + S.km);
  const s = await stripe(S, 'POST', 'billing_portal/sessions', { customer, return_url: back, locale: lang === 'ru' ? 'ru' : 'auto', configuration: cfg && cfg.id ? cfg.id : undefined });
  return s.url;
}
// deno-lint-ignore no-explicit-any
async function portal(uid: string, b: any) {
  const [prof, row] = await Promise.all([profileOf(uid), rowOf(uid)]);
  const S = row ? (row.livemode ? SIDES.live : SIDES.test) : null; // (the side the account's customer lives on)
  if (!row || !row.customer || !S) throw new Fail('no_customer');
  return { url: await portalUrl(S, row.customer, backUrl(b.back, SITE, LOCAL), b.lang || (prof && prof.lang)) };
}
// deno-lint-ignore no-explicit-any
async function confirm(uid: string, b: any) {
  const sid = String(b.sid || '');
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) throw new Fail('bad_session');
  const S = /^cs_live_/.test(sid) ? SIDES.live : SIDES.test;
  const s = await stripe(S, 'GET', 'checkout/sessions/' + sid);
  if (s.client_reference_id !== uid) throw new Fail('not_yours');
  const note = s.status === 'complete' ? await applySession(S, s) : 'not_complete';
  return Object.assign(await stateOf(uid), { note });
}

// ---- the owner's requests
// what Pro needs at Stripe, made once on each side that has a key; safe to run again (it makes only what is missing)
async function setupSide(S: Side) {
  const made: string[] = [];
  let prices = await priceIds(S, true);
  let product = ((await config('product:' + S.km)) || {}).id as string | undefined;
  if (Object.keys(PLANS).some((p) => !prices[p])) {
    if (!product) {
      const p = await stripe(S, 'POST', 'products', { name: PRODUCT.name, description: PRODUCT.description, metadata: { app: 'joker-chess' } });
      product = p.id; await setConfig('product:' + S.km, { id: p.id }); made.push('product');
    }
    for (const [plan, def] of Object.entries(PLANS) as [string, { cents: number; interval?: string; lookup: string; name: string }][]) {
      if (prices[plan]) continue;
      await stripe(S, 'POST', 'prices', { product, currency: 'usd', unit_amount: def.cents, lookup_key: def.lookup, nickname: def.name,
        recurring: def.interval ? { interval: def.interval } : undefined, metadata: { app: 'joker-chess', plan } });
      made.push('price ' + plan);
    }
    prices = await priceIds(S, true);
  }
  if (!product && prices.month) product = (await stripe(S, 'GET', 'prices/' + prices.month)).product;
  if (!(await config('portal:' + S.km))) {
    const pc = await stripe(S, 'POST', 'billing_portal/configurations', {
      business_profile: { headline: 'Joker Pro', privacy_policy_url: SITE + 'privacy.html', terms_of_service_url: SITE + 'terms.html' },
      features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations', products: [{ product, prices: [prices.month, prices.year] }] } },
    });
    await setConfig('portal:' + S.km, { id: pc.id }); made.push('portal');
  }
  if (!(await config('hook:' + S.km))) {
    const eps = await stripe(S, 'GET', 'webhook_endpoints', { limit: 100 });
    // (an endpoint of ours whose secret we don't hold can't check anything: it is switched off, and a new one made)
    // deno-lint-ignore no-explicit-any
    for (const old of ((eps.data || []) as any[]).filter((e) => e.url === HOOK_URL && e.status === 'enabled')) await stripe(S, 'POST', 'webhook_endpoints/' + old.id, { disabled: true });
    const ep = await stripe(S, 'POST', 'webhook_endpoints', { url: HOOK_URL, enabled_events: EVENTS, description: 'Joker Chess: Joker Pro' });
    await setConfig('hook:' + S.km, { id: ep.id, secret: ep.secret }); made.push('webhook');
  }
  return { made, prices: Object.keys(prices).sort() };
}
// deno-lint-ignore no-explicit-any
async function setup(b: any) {
  const want = b.side === 'test' || b.side === 'live' ? [b.side as 'test' | 'live'] : (['test', 'live'] as const);
  // deno-lint-ignore no-explicit-any
  const out: any = { ok: true, mode: await modeNow() };
  for (const k of want) out[k] = SIDES[k] ? await setupSide(SIDES[k]!) : 'no_key';
  return out;
}
// the test side only: a subscription made and cancelled through the API, each time waiting for the webhook to bring
// the account along
// deno-lint-ignore no-explicit-any
async function selftest(b: any) {
  const S = SIDES.test;
  if (!S) throw new Fail('test_key_only');
  const uid = UUID.test(String(b.user || '')) ? String(b.user) : ((one(await sql`select user_id from public.admins order by created_at limit 1`) || {}).user_id as string);
  if (!uid || !(await isAdmin(uid))) throw new Fail('no_admin');
  const prof = await profileOf(uid);
  if (!prof) throw new Fail('profile');
  const prices = await priceIds(S, true);
  if (!prices.month) throw new Fail('not_set_up');
  const customer = await customerFor(S, uid, prof, await rowOf(uid));
  const pm = await stripe(S, 'POST', 'payment_methods/pm_card_visa/attach', { customer });
  await stripe(S, 'POST', 'customers/' + customer, { invoice_settings: { default_payment_method: pm.id } });
  const sub = await stripe(S, 'POST', 'subscriptions', { customer, items: [{ price: prices.month }], metadata: { user_id: uid, plan: 'month', selftest: '1' } });
  const wait = async (status: string) => {
    for (let i = 0; i < 40; i++) {
      const r = await rowOf(uid);
      if (r && r.subscription === sub.id && r.status === status) return true;
      await new Promise((res) => setTimeout(res, 500));
    }
    return false;
  };
  const started = await wait('active');
  const proOn = publicState(await profileOf(uid), await rowOf(uid), Date.now()).on;
  await stripe(S, 'DELETE', 'subscriptions/' + sub.id);
  const ended = await wait('canceled');
  const proOff = !publicState(await profileOf(uid), await rowOf(uid), Date.now()).on;
  return { ok: started && proOn && ended && proOff, subscription: sub.status, webhookOnStart: started, proOn, webhookOnCancel: ended, proOff };
}
async function adminState() {
  const [mode, hookT, hookL, portT, portL, n] = await Promise.all([modeNow(), config('hook:test'), config('hook:live'), config('portal:test'), config('portal:live'),
    sql`select count(*) filter (where status in ('trialing', 'active', 'past_due'))::int as subs, count(*) filter (where founder_at is not null)::int as founders, count(*)::int as rows from public.billing`]);
  const prices: Record<string, string[] | string> = {};
  for (const k of ['test', 'live'] as const) { try { prices[k] = SIDES[k] ? Object.keys(await priceIds(SIDES[k], true)).sort() : 'no_key'; } catch { prices[k] = 'unreachable'; } }
  const ev = await sql`select type, note, livemode, created_at from public.billing_events order by created_at desc limit 8`;
  const S = sideFor(mode);
  return { keys: { test: !!SIDES.test, live: !!SIDES.live }, mode, serving: S ? S.km : null, hook: { test: !!(hookT && hookT.secret), live: !!(hookL && hookL.secret) },
    portal: { test: !!portT, live: !!portL }, prices, billing: n[0], events: ev };
}

// ---- auth: Supabase access tokens, checked the way the play function checks them (its comments say why)
const BUNDLED_JWKS = [
  { kty: 'EC', crv: 'P-256', kid: '8f1d5c83-1f13-43e4-96bd-2a645387c33c',
    x: 'srMq_5NETMVHl2GHg5KVqMSTUImvSA6WMABYJRM-5rc', y: 'Wg04I6PSSqJUH4WQWb1bhR809NkSz4S_Fywy34XIhzA' },
];
type Jwk = { kty: string; crv: string; kid: string; x: string; y: string };
const keys = new Map<string, Promise<CryptoKey | null>>();
const importKey = (k: Jwk) => crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: k.x, y: k.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
function keyFor(kid: string): Promise<CryptoKey | null> {
  let p = keys.get(kid);
  if (!p) {
    const known = BUNDLED_JWKS.find((k) => k.kid === kid);
    p = known ? importKey(known) : fetch(`${ISSUER}/.well-known/jwks.json`, { headers: { apikey: ANON_KEY } })
      .then((r) => r.json())
      .then((j: { keys?: Jwk[] }) => { const k = (j.keys || []).find((x) => x.kid === kid && x.kty === 'EC' && x.crv === 'P-256'); return k ? importKey(k) : null; })
      .catch(() => null);
    keys.set(kid, p);
    p.then((k) => { if (!k) keys.delete(kid); });
  }
  return p;
}
function b64u(s: string): Uint8Array<ArrayBuffer> {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t), out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function userId(token: string): Promise<Caller> {
  const AUTH = new Fail('auth');
  if (!token) throw AUTH;
  const parts = token.split('.');
  if (parts.length !== 3) throw AUTH;
  // deno-lint-ignore no-explicit-any
  let header: any, claims: any;
  try {
    header = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  } catch { throw AUTH; }
  if (!claims || typeof claims.sub !== 'string' || !UUID.test(claims.sub) || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw AUTH;
  if (claims.role !== 'authenticated' || (typeof claims.iss === 'string' && !/\/auth\/v1$/.test(claims.iss))) throw AUTH;
  if (header && header.alg === 'ES256' && typeof header.kid === 'string') {
    const key = await keyFor(header.kid);
    if (!key) throw AUTH;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) throw AUTH;
  } else {
    const r = await fetch(`${ISSUER}/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw AUTH;
    const u = await r.json().catch(() => null);
    if (!u || u.id !== claims.sub) throw AUTH;
  }
  return { sub: claims.sub, guest: typeof claims.is_anonymous === 'boolean' ? claims.is_anonymous : null };
}
// the owner's key: made in the database for a short while, used from there
async function ownerKey(key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || key.length < 24) return false;
  const k = await config('admin_key');
  return !!(k && typeof k.key === 'string' && k.key === key && Date.parse(k.until || '') > Date.now());
}

// ---- HTTP
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const raw = await req.text();
  try {
    const sig = req.headers.get('stripe-signature');
    if (sig) return await hook(raw, sig);
    // deno-lint-ignore no-explicit-any
    let b: any = {};
    try { b = JSON.parse(raw || '{}'); } catch { b = {}; }
    if (!b || typeof b !== 'object') b = {};
    const action = String(b.action || '');
    if (['setup', 'selftest', 'admin_state'].includes(action)) {
      if (!(await ownerKey(b.key))) return json({ error: 'auth' }, 401);
      return json(action === 'setup' ? await setup(b) : action === 'selftest' ? await selftest(b) : await adminState());
    }
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || (typeof b.token === 'string' ? b.token : '');
    const caller = await userId(token);
    if (action === 'state') return json(await stateOf(caller.sub));
    if (action === 'checkout') return json(await checkout(caller.sub, caller, b));
    if (action === 'confirm') return json(await confirm(caller.sub, b));
    if (action === 'portal') return json(await portal(caller.sub, b));
    return json({ error: 'bad_action' });
  } catch (e) {
    if (e instanceof Fail) return json(Object.assign({ error: e.code }, e.code === 'stripe' && e.extra ? { stripe: { type: e.extra.type, code: e.extra.code } } : {}), e.code === 'auth' ? 401 : 200);
    console.error(e);
    return json({ error: 'server' }, 500);
  }
});
