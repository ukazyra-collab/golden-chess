// Joker Pro bought in the Android app: what Google Play says about a purchase, turned into what the account gets, and
// the service account's sign-in. Everything here needs no database; the network goes through the fetch it is given.
// Shared with the tests (test/server/store.test.mjs runs it under Node).
//
// Google Play: one subscription (jokerpro_sub) with two base plans (month, year; the year has a free-trial offer),
// and one one-time product (jokerpro_founder). A purchase is known by its purchase token; the Android Publisher API
// (purchases.subscriptionsv2.get, purchases.products.get) says what it is worth right now.
export const GOOGLE_SUB = 'jokerpro_sub';
export const GOOGLE_FOUNDER = 'jokerpro_founder';
export const GOOGLE_PLANS = { month: 'month', year: 'year' }; // base plan id → our plan
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ms = (t) => { const v = typeof t === 'string' ? Date.parse(t) : NaN; return isFinite(v) ? v : null; };
const account = (ids) => { const a = ids && ids.obfuscatedExternalAccountId; return typeof a === 'string' && UUID.test(a) ? a.toLowerCase() : null; };

// a subscription as purchases.subscriptionsv2.get describes it → the row the purchase leaves:
// { id, kind: 'sub', plan, product, tx (the newest order), token, status, expires (ms: when Pro from it ends), autoRenew,
//   trial, sandbox, account (the account the app named when buying), linked (the token this purchase replaced),
//   ack (it still has to be acknowledged, or Google gives the money back in three days) }
export function googleSub(v, token, nowMs) {
  if (!v || typeof v !== 'object' || !token) return null;
  const item = Array.isArray(v.lineItems) ? v.lineItems.find((x) => x && x.productId === GOOGLE_SUB) : null;
  if (!item) return null;
  const plan = GOOGLE_PLANS[(item.offerDetails && item.offerDetails.basePlanId) || ''] || null;
  const expiry = ms(item.expiryTime), state = String(v.subscriptionState || '').replace(/^SUBSCRIPTION_STATE_/, '');
  let status, expires;
  if (state === 'ACTIVE' || state === 'CANCELED') { status = 'active'; expires = expiry; }
  else if (state === 'IN_GRACE_PERIOD') { status = 'grace'; expires = expiry; }
  else if (state === 'ON_HOLD' || state === 'PAUSED') { status = 'paused'; expires = Math.min(nowMs, expiry || nowMs); }
  else if (state === 'PENDING') { status = 'pending'; expires = null; }
  else { status = 'expired'; expires = Math.min(nowMs, expiry || nowMs); }
  if ((status === 'active' || status === 'grace') && expires === null) return null;
  const auto = item.autoRenewingPlan ? item.autoRenewingPlan.autoRenewEnabled === true : null;
  const start = ms(v.startTime);
  return {
    id: 'google:' + token, kind: 'sub', plan, product: GOOGLE_SUB, tx: v.latestOrderId || item.latestSuccessfulOrderId || null, token, status, expires,
    autoRenew: state === 'CANCELED' ? false : auto,
    // (the API has no word for "in its free week"; the offer and a start within the last eight days say it)
    trial: !!(item.offerDetails && item.offerDetails.offerId === 'trial' && start !== null && nowMs - start < 8 * 864e5 && status === 'active'),
    sandbox: !!v.testPurchase, account: account(v.externalAccountIdentifiers), linked: typeof v.linkedPurchaseToken === 'string' && v.linkedPurchaseToken ? v.linkedPurchaseToken : null,
    ack: v.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && (status === 'active' || status === 'grace'),
  };
}
// the one-time product as purchases.products.get describes it
export function googleFounder(p, token) {
  if (!p || typeof p !== 'object' || !token) return null;
  const st = p.purchaseState; // 0 purchased, 1 cancelled (refunded), 2 pending
  if (st !== 0 && st !== 1 && st !== 2) return null;
  return {
    id: 'google:' + token, kind: 'founder', plan: 'founder', product: GOOGLE_FOUNDER, tx: p.orderId || null, token,
    status: st === 0 ? 'active' : st === 1 ? 'revoked' : 'pending', expires: null, autoRenew: null, trial: false,
    sandbox: p.purchaseType === 0, account: typeof p.obfuscatedExternalAccountId === 'string' && UUID.test(p.obfuscatedExternalAccountId) ? p.obfuscatedExternalAccountId.toLowerCase() : null,
    linked: null, ack: st === 0 && p.acknowledgementState === 0,
  };
}

// ---- the service account signs in: a JWT signed with its key is exchanged for an access token
const b64u = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const enc = new TextEncoder();
// the key file Google gives for a service account (JSON): who it is, its key, where it signs in
export function serviceAccount(json) {
  let k = null;
  try { k = typeof json === 'string' ? JSON.parse(json) : json; } catch (_e) { k = null; }
  if (!k || typeof k.client_email !== 'string' || typeof k.private_key !== 'string' || !/BEGIN PRIVATE KEY/.test(k.private_key)) return null;
  return { email: k.client_email, key: k.private_key, tokenUrl: typeof k.token_uri === 'string' ? k.token_uri : 'https://oauth2.googleapis.com/token' };
}
export async function serviceJwt(acct, nowSec, aud) {
  const der = Uint8Array.from(atob(acct.key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64u(enc.encode(JSON.stringify({ iss: acct.email, scope: GOOGLE_SCOPE, aud, iat: nowSec, exp: nowSec + 3600 })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}
