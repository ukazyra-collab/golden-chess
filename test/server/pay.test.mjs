// Joker Pro, the paying side without network or database (supabase/functions/pay/billing.js): the plans against the
// client's own table, Stripe's request bodies, the webhook's signature, what a subscription gives an account.
// Run: node test/server/pay.test.mjs
import { createRequire } from 'module';
import crypto from 'node:crypto';
import * as B from '../../supabase/functions/pay/billing.js';
const require = createRequire(import.meta.url);
// the client's own table of plans (src/pro.js), when this tree has it: the prices must be the same in both
let Pro = { PLANS: { month: { usd: 3.99 }, year: { usd: 29.99, trialDays: 7 }, founder: { usd: 79.99, seats: 1000 } } };
try { Pro = require('../../src/pro.js'); } catch { /* the server side alone */ }
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

// ---- the plans: what Stripe charges is what the game shows
check('a month costs what the game says', B.PLANS.month.cents === Math.round(Pro.PLANS.month.usd * 100) && B.PLANS.month.interval === 'month');
check('a year costs what the game says, with its trial', B.PLANS.year.cents === Math.round(Pro.PLANS.year.usd * 100) && B.PLANS.year.interval === 'year' && B.PLANS.year.trialDays === Pro.PLANS.year.trialDays);
check('a founder pays once, for a thousand seats', B.PLANS.founder.cents === Math.round(Pro.PLANS.founder.usd * 100) && !B.PLANS.founder.interval && B.PLANS.founder.seats === Pro.PLANS.founder.seats);
check('each plan has its own lookup key', new Set(Object.values(B.PLANS).map((p) => p.lookup)).size === 3);

// ---- Stripe's bodies
check('nested keys', B.form({ mode: 'subscription', line_items: [{ price: 'p_1', quantity: 1 }], metadata: { user_id: 'u', plan: 'year' } }) ===
  'mode=subscription&line_items%5B0%5D%5Bprice%5D=p_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buser_id%5D=u&metadata%5Bplan%5D=year');
check('nothing for what is not there', B.form({ a: undefined, b: null, c: { d: undefined }, e: true, f: 0 }) === 'e=true&f=0');
check('lists of plain values', B.form({ enabled_events: ['a.b', 'c.d'] }) === 'enabled_events%5B0%5D=a.b&enabled_events%5B1%5D=c.d');
check('the session id placeholder survives', decodeURIComponent(B.form({ success_url: 'https://joker-chess.com/?pro=ok&sid={CHECKOUT_SESSION_ID}' })) === 'success_url=https://joker-chess.com/?pro=ok&sid={CHECKOUT_SESSION_ID}');

// ---- the keys and who may buy
check('a key says which side it is', B.keyMode('sk_test_abc') === 'test' && B.keyMode('sk_live_abc') === 'live' && B.keyMode('rk_live_x') === 'live' && B.keyMode('rk_test_x') === 'test' &&
  B.keyMode('pk_live_abc') === null && B.keyMode('') === null && B.keyMode(undefined) === null);
check('off: nobody', !B.access('off', 'live', true) && !B.access('off', 'test', true) && !B.access(null, 'live', true));
check('test: the owner only', B.access('test', 'test', true) && !B.access('test', 'test', false) && B.access('test', 'live', true) && !B.access('test', 'live', false));
check('on with real money: everyone', B.access('on', 'live', false) && B.access('on', 'live', true));
check('a test key never sells to players', !B.access('on', 'test', false) && B.access('on', 'test', true));
check('no key: nobody', !B.access('on', null, true) && !B.access('test', undefined, true));

// ---- the webhook's signature
const secret = 'whsec_test_secret', body = JSON.stringify({ id: 'evt_1', type: 'x' }), t = 1794550000;
const sig = crypto.createHmac('sha256', secret).update(t + '.' + body).digest('hex');
check('our signing is Stripe\'s', (await B.sign(secret, t, body)) === sig);
check('a good signature', (await B.verify(`t=${t},v1=${sig}`, body, secret, t + 10)).ok === true);
check('with spaces and an older scheme beside it', (await B.verify(`t=${t}, v0=abc, v1=${sig}`, body, secret, t)).ok === true);
check('one of two signatures is enough (a rolled secret)', (await B.verify(`t=${t},v1=${'0'.repeat(64)},v1=${sig}`, body, secret, t)).ok === true);
check('another body: refused', (await B.verify(`t=${t},v1=${sig}`, body + ' ', secret, t)).why === 'mismatch');
check('another secret: refused', (await B.verify(`t=${t},v1=${sig}`, body, 'whsec_other', t)).why === 'mismatch');
check('another time in the header: refused', (await B.verify(`t=${t + 1},v1=${sig}`, body, secret, t)).why === 'mismatch');
check('too old: refused', (await B.verify(`t=${t},v1=${sig}`, body, secret, t + 301)).why === 'stale' && (await B.verify(`t=${t},v1=${sig}`, body, secret, t + 300)).ok === true);
check('from the future: refused', (await B.verify(`t=${t},v1=${sig}`, body, secret, t - 301)).why === 'stale');
check('no header, no secret, a broken header', (await B.verify('', body, secret, t)).why === 'no_signature' && (await B.verify(`t=${t},v1=${sig}`, body, '', t)).why === 'no_signature' &&
  (await B.verify('v1=' + sig, body, secret, t)).why === 'bad_header' && (await B.verify('t=abc,v1=' + sig, body, secret, t)).why === 'bad_header' && (await B.verify('t=' + t, body, secret, t)).why === 'bad_header');

// ---- a subscription → what the account gets
const NOW = Date.UTC(2026, 10, 13, 12), S = Math.floor(NOW / 1000), DAY = 86400;
const sub = (o) => Object.assign({ id: 'sub_1', customer: 'cus_1', status: 'active', livemode: false, cancel_at_period_end: false, current_period_start: S - DAY, current_period_end: S + 29 * DAY,
  items: { data: [{ price: { lookup_key: 'joker_pro_month', recurring: { interval: 'month' } } }] } }, o || {});
let e = B.entitlement(sub(), NOW);
check('active: until the paid period ends', e.live && e.status === 'active' && e.plan === 'month' && e.until === (S + 29 * DAY) * 1000 && e.periodEnd === e.until && !e.cancel && !e.trial && e.customer === 'cus_1' && e.id === 'sub_1', e);
e = B.entitlement(sub({ status: 'trialing', trial_start: S, trial_end: S + 7 * DAY, current_period_end: S + 7 * DAY, items: { data: [{ price: { lookup_key: 'joker_pro_year', recurring: { interval: 'year' } } }] } }), NOW);
check('on trial: until the trial ends, a year after it', e.live && e.trial && e.plan === 'year' && e.until === (S + 7 * DAY) * 1000, e);
// newer API versions keep the period on the item
e = B.entitlement({ id: 'sub_2', customer: { id: 'cus_2' }, status: 'active', livemode: true, items: { data: [{ current_period_start: S, current_period_end: S + 365 * DAY, price: { lookup_key: null, recurring: { interval: 'year' } } }] } }, NOW);
check('the period on the item, the plan by its interval, the customer as an object', e.until === (S + 365 * DAY) * 1000 && e.plan === 'year' && e.customer === 'cus_2' && e.livemode === true, e);
e = B.entitlement(sub({ status: 'past_due', current_period_start: S - DAY, current_period_end: S + 29 * DAY }), NOW);
check('a renewal that failed: three days of grace from the period\'s start', e.live && e.until === (S - DAY) * 1000 + 3 * 864e5, e);
e = B.entitlement(sub({ status: 'past_due', current_period_start: S - 10 * DAY }), NOW);
check('grace runs out', e.until < NOW, e);
e = B.entitlement(sub({ status: 'canceled', ended_at: S - 5 }), NOW);
check('cancelled: ended when it ended', !e.live && e.until === (S - 5) * 1000, e);
e = B.entitlement(sub({ status: 'canceled', ended_at: S + 5000 }), NOW);
check('never later than now', e.until === NOW);
for (const st of ['unpaid', 'incomplete', 'incomplete_expired', 'paused']) { e = B.entitlement(sub({ status: st }), NOW); check(st + ': no Pro', !e.live && e.until <= NOW, e); }
check('cancelling at the period\'s end keeps Pro until then', (() => { const x = B.entitlement(sub({ cancel_at_period_end: true }), NOW); return x.live && x.cancel && x.until === (S + 29 * DAY) * 1000; })());
check('a set end date counts as cancelling', B.entitlement(sub({ cancel_at: S + 29 * DAY }), NOW).cancel === true && B.entitlement(sub({ status: 'canceled', cancel_at: S }), NOW).cancel === false);
check('a price we don\'t know', B.planOf({ items: { data: [{ price: { lookup_key: 'other', recurring: { interval: 'week' } } }] } }) === null && B.planOf({}) === null && B.planOf(null) === null);

// late news of an old subscription doesn't switch off a newer one
const live = B.entitlement(sub({ id: 'sub_new' }), NOW), dead = B.entitlement(sub({ id: 'sub_old', status: 'canceled' }), NOW);
check('nothing on file: anything goes in', B.replaces(null, live) && B.replaces({}, dead) && B.replaces({ subscription: null }, dead));
check('the same subscription: its news', B.replaces({ subscription: 'sub_old', status: 'active' }, dead));
check('a new running one replaces the old', B.replaces({ subscription: 'sub_old', status: 'active' }, live) && B.replaces({ subscription: 'sub_old', status: 'canceled' }, live));
check('an old ended one doesn\'t replace a running one', !B.replaces({ subscription: 'sub_new', status: 'active' }, dead) && !B.replaces({ subscription: 'sub_new', status: 'trialing' }, dead) && !B.replaces({ subscription: 'sub_new', status: 'past_due' }, dead));
check('one ended replaces another ended', B.replaces({ subscription: 'sub_x', status: 'canceled' }, dead));

// ---- what the client hears
const iso = (ms) => new Date(ms).toISOString();
let p = B.publicState({ pro_until: iso(NOW + 5000), pro_plan: 'year', pro_founder: false }, { status: 'trialing', cancel_at_period_end: false, trial_used: true, customer: 'cus_secret', subscription: 'sub_secret' }, NOW);
check('Pro on trial', p.on && p.trial && p.sub && p.plan === 'year' && p.until === NOW + 5000 && !p.founder && p.trialUsed && !p.cancel, p);
check('nothing of Stripe\'s ids goes out', !JSON.stringify(p).includes('secret'));
p = B.publicState({ pro_until: iso(NOW - 1), pro_plan: 'month', pro_founder: false }, { status: 'canceled' }, NOW);
check('over', !p.on && !p.sub && p.plan === 'month', p);
p = B.publicState({ pro_until: null, pro_plan: 'founder', pro_founder: true }, null, NOW);
check('a founder: on, with no end', p.on && p.founder && p.until === null && !p.sub, p);
p = B.publicState({ pro_until: null, pro_plan: null, pro_founder: false }, null, NOW);
check('never bought', !p.on && !p.founder && p.plan === null && p.status === null, p);
check('no profile', !B.publicState(null, null, NOW).on);

// ---- where the player comes back
const SITE = 'https://joker-chess.com/';
check('our own pages', B.backUrl('https://joker-chess.com/', SITE) === 'https://joker-chess.com/' && B.backUrl('https://golden-chess.com/?p=2#x', SITE) === 'https://golden-chess.com/' && B.backUrl('https://www.joker-chess.com/play', SITE) === 'https://www.joker-chess.com/play');
check('nobody else\'s', B.backUrl('https://evil.example/', SITE) === SITE && B.backUrl('https://joker-chess.com.evil.example/', SITE) === SITE && B.backUrl('javascript:alert(1)', SITE) === SITE &&
  B.backUrl(undefined, SITE) === SITE && B.backUrl('http://joker-chess.com/', SITE) === SITE && B.backUrl('http://localhost:8080/', SITE) === SITE);
check('a local page under the tests only', B.backUrl('http://127.0.0.1:8123/', SITE, true) === 'http://127.0.0.1:8123/' && B.backUrl('http://localhost/x', SITE, true) === 'http://localhost/x' && B.backUrl('http://evil.example/', SITE, true) === SITE);

console.log(`pay (rules): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
