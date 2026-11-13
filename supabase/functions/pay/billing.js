// Joker Pro, the paying side: everything that needs no network and no database (index.ts does those). Shared with the
// tests (test/server/pay.test.mjs runs it under Node).
//
// The plans. The prices live at Stripe under these lookup keys (the setup creates them); the amounts here are what the
// setup creates and what the tests hold the client's own table (src/pro.js) against.
export const PLANS = {
  month: { cents: 399, interval: 'month', lookup: 'joker_pro_month', name: 'Joker Pro, monthly' },
  year: { cents: 2999, interval: 'year', lookup: 'joker_pro_year', name: 'Joker Pro, yearly', trialDays: 7 },
  founder: { cents: 7999, lookup: 'joker_pro_founder', name: 'Joker Pro Founder, for life', seats: 1000 },
};
export const PRODUCT = { name: 'Joker Pro', description: 'Joker Chess with the coach without limits, 50% more XP, the whole Road, a gold name and streak freezes.' };
// a subscription in one of these states is running: it will charge again, and a second one must not start beside it
export const LIVE = ['trialing', 'active', 'past_due'];
export const GRACE_MS = 3 * 864e5; // a renewal that didn't go through: Pro stays this long into the unpaid period
// what the webhook listens to
export const EVENTS = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'charge.refunded'];

// ---- Stripe's request bodies: nested keys as a[b][0][c]=v
export function form(obj) {
  const out = [];
  const walk = (key, v) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(key + '[' + i + ']', x));
    else if (typeof v === 'object') Object.keys(v).forEach((k) => walk(key ? key + '[' + k + ']' : k, v[k]));
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  };
  walk('', obj || {});
  return out.join('&');
}

// which side of Stripe a key belongs to: real money, or the test mode
export function keyMode(key) {
  if (/^(sk|rk)_live_/.test(key || '')) return 'live';
  if (/^(sk|rk)_test_/.test(key || '')) return 'test';
  return null;
}

// who may see and buy Pro. mode: billing_config's ('off' | 'test' | 'on'); key: which Stripe key is set ('test' |
// 'live' | null); admin: one of the owner's accounts. Everyone only with real money behind it; a test key never sells
// to players, whatever the mode says.
export function access(mode, key, admin) {
  if (!key || mode === 'off' || !mode) return false;
  if (mode === 'on' && key === 'live') return true;
  return !!admin;
}

// ---- the webhook's signature (Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>]): HMAC-SHA256 of "<t>.<body>" with the
// endpoint's secret; refused when older than `tolerance` seconds
const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
export async function sign(secret, t, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(t + '.' + body)));
}
function same(a, b) { // (the same time whatever differs)
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function verify(header, body, secret, nowSec, tolerance = 300) {
  if (!secret || typeof header !== 'string' || !header) return { ok: false, why: 'no_signature' };
  let t = null;
  const sigs = [];
  header.split(',').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = v; else if (k === 'v1') sigs.push(v);
  });
  if (!t || !/^\d+$/.test(t) || !sigs.length) return { ok: false, why: 'bad_header' };
  if (Math.abs(nowSec - Number(t)) > tolerance) return { ok: false, why: 'stale' };
  const want = await sign(secret, t, body);
  return sigs.some((s) => same(s, want)) ? { ok: true } : { ok: false, why: 'mismatch' };
}

// ---- a subscription as Stripe describes it → what the account gets
// (current_period_* sit on the subscription in older API versions and on its items in newer ones)
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
function period(sub, which) {
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  return num(sub && sub['current_period_' + which]) ?? num(item && item['current_period_' + which]);
}
export function planOf(sub) {
  const item = sub && sub.items && sub.items.data && sub.items.data[0], price = item && item.price;
  if (!price) return null;
  if (price.lookup_key === PLANS.month.lookup) return 'month';
  if (price.lookup_key === PLANS.year.lookup) return 'year';
  const iv = price.recurring && price.recurring.interval;
  return iv === 'year' ? 'year' : iv === 'month' ? 'month' : null;
}
// until: when Pro ends (ms). A running or trial period: its end. A renewal that failed: a few days of grace into the
// new period. Anything else (cancelled, unpaid, never completed, paused): it has ended.
export function entitlement(sub, nowMs) {
  const status = String((sub && sub.status) || ''), end = period(sub, 'end'), start = period(sub, 'start');
  const endMs = end ? end * 1000 : null;
  let until;
  if (status === 'trialing' || status === 'active') until = endMs;
  else if (status === 'past_due') until = start ? Math.min(start * 1000 + GRACE_MS, endMs || Infinity) : nowMs;
  else until = Math.min(nowMs, sub && num(sub.ended_at) ? sub.ended_at * 1000 : nowMs);
  return {
    id: sub.id, customer: typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || null,
    status, plan: planOf(sub), periodEnd: endMs, cancel: !!sub.cancel_at_period_end || (num(sub.cancel_at) !== null && LIVE.includes(status)),
    trial: num(sub.trial_start) !== null, live: LIVE.includes(status), until, livemode: !!sub.livemode,
  };
}
// should this subscription's news replace what the account has on file? Late news of an old, ended subscription must
// not switch off a newer one that runs.
export function replaces(row, ent) {
  if (!row || !row.subscription || row.subscription === ent.id) return true;
  if (ent.live) return true;
  return !LIVE.includes(row.status || '');
}

// what the client is told about its own account (and nothing of Stripe's ids)
export function publicState(profile, row, nowMs) {
  const until = profile && profile.pro_until ? Date.parse(profile.pro_until) : null, founder = !!(profile && profile.pro_founder);
  return {
    on: founder || (until !== null && until > nowMs), founder, until: founder ? null : until, plan: (profile && profile.pro_plan) || null,
    status: (row && row.status) || null, cancel: !!(row && row.cancel_at_period_end), trial: !!(row && row.status === 'trialing'),
    trialUsed: !!(row && row.trial_used), sub: !!(row && LIVE.includes(row.status || '')),
  };
}

// ---- Joker Pro bought in the apps (the App Store, Google Play): what a store's news does to the purchase on file.
// row: the purchase as kept (store_purchases), or null. e: the news ({ store, kind: 'sub' | 'founder', tx, expires (ms),
// revoked (ms: Apple's refund date), status (Google's), autoRenew, trial, signed (ms) }). notice: what an Apple
// notification adds ('refund': the money went back; 'expired'; ''). → { skip: why } when nothing is to change, or
// { status, expires (ms | null), revokedAt (ms | null), autoRenew, trial, tx, signed (ms | null) }.
// Google is asked at that very moment, so what it says is how things are. Apple's data is signed and may come late,
// twice, or out of order: an end date only moves forward, only the refund of what runs now ends Pro, and a refunded
// transaction shown again changes nothing.
export function storeMerge(row, e, notice, nowMs) {
  const t = (v) => (v ? (typeof v === 'number' ? v : Date.parse(v)) : null);
  const had = row ? t(row.expires_at) : null, hadRevoked = row ? t(row.revoked_at) : null;
  const auto = e.autoRenew !== null && e.autoRenew !== undefined ? e.autoRenew : row ? row.auto_renew : null;
  if (e.store === 'google') {
    const revoked = e.status === 'revoked';
    return { status: e.status, expires: e.expires, revokedAt: revoked ? hadRevoked || nowMs : null, autoRenew: auto, trial: !!e.trial, tx: e.tx || (row && row.tx) || null, signed: null };
  }
  const signed = Math.max(e.signed || 0, (row && t(row.signed_at)) || 0) || null;
  const refund = (e.revoked !== null && e.revoked !== undefined) || notice === 'refund';
  if (e.kind === 'founder') {
    if (refund) return { status: 'revoked', expires: null, revokedAt: Math.min(e.revoked || nowMs, nowMs), autoRenew: null, trial: false, tx: e.tx, signed };
    if (hadRevoked !== null && row.tx === e.tx) return { skip: 'refunded' };
    return { status: 'active', expires: null, revokedAt: null, autoRenew: null, trial: false, tx: e.tx, signed };
  }
  if (e.expires === null || e.expires === undefined) return { skip: 'no_end' };
  if (refund) {
    if (had !== null && e.expires < had && row.tx !== e.tx) return { skip: 'old_refund' };
    const at = Math.min(e.revoked || nowMs, nowMs);
    return { status: 'revoked', expires: at, revokedAt: at, autoRenew: false, trial: false, tx: e.tx, signed };
  }
  if (hadRevoked !== null && row.tx === e.tx) return { skip: 'refunded' };
  const newer = had === null || e.expires > had;
  const expires = newer ? e.expires : had;
  const revokedAt = hadRevoked !== null && !newer ? hadRevoked : null;
  return { status: expires > nowMs ? 'active' : revokedAt !== null ? 'revoked' : 'expired', expires, revokedAt, autoRenew: auto,
    trial: newer ? !!e.trial : !!(row && row.trial), tx: newer ? e.tx : row.tx, signed };
}
// what the client is told when Pro comes from a store: where it was bought (so that it is managed there), and the
// subscription's state in the client's own words. st: publicState's answer; row: Stripe's side; s: the store purchase
// that counts now (a founder's, else the subscription that lasts longest), or null.
export function withStore(st, row, s, nowMs) {
  const out = Object.assign({}, st, { via: null });
  const stripeUntil = row && row.until ? Date.parse(row.until) : null, storeUntil = s && s.kind === 'sub' && s.expires_at ? Date.parse(s.expires_at) : null;
  if (st.founder) out.via = row && row.founder_at ? 'stripe' : s && s.kind === 'founder' ? s.store : null;
  else if (st.on) out.via = storeUntil !== null && storeUntil > nowMs && (stripeUntil === null || storeUntil >= stripeUntil) ? s.store : 'stripe';
  if (out.via && out.via !== 'stripe' && s && s.kind === 'sub') {
    out.status = s.status; out.cancel = s.auto_renew === false; out.trial = !!s.trial && storeUntil > nowMs; out.sub = storeUntil > nowMs; out.sandbox = !!s.sandbox || undefined;
  }
  return out;
}

// where Stripe sends the player back: only to our own pages
const HOSTS = /^https:\/\/(joker-chess\.com|www\.joker-chess\.com|golden-chess\.com|www\.golden-chess\.com)\//;
export function backUrl(back, site, local) {
  const b = typeof back === 'string' ? back.split('#')[0].split('?')[0] : '';
  if (HOSTS.test(b) || (local && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(b))) return b;
  return site;
}
