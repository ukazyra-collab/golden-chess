// Joker Pro bought in the apps, the part with no network and no database: Apple's signed data
// (supabase/functions/pay/apple.js), Google's answers (google.js), and what news does to a purchase on file
// (billing.js: storeMerge, withStore). Run: node test/server/store.test.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import { APPLE_ROOT_G3, parseCert, issued, verifyJws, appleEntitlement, appleNotice, b64 } from '../../supabase/functions/pay/apple.js';
import { storeMerge, withStore } from '../../supabase/functions/pay/billing.js';
import { googleSub, googleFounder, serviceAccount, serviceJwt } from '../../supabase/functions/pay/google.js';
import { makeChain, signJws, transaction } from './apple-standin.mjs';

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } }
const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e.code || String(e); } };
const fx = (f) => new Uint8Array(fs.readFileSync(new URL('./fixtures/' + f, import.meta.url)));

// ---- Apple's own certificates (as published at apple.com/certificateauthority)
{
  const root = parseCert(b64(APPLE_ROOT_G3)), rootFile = fx('AppleRootCA-G3.cer'), g6 = parseCert(fx('AppleWWDRCAG6.cer'));
  check('the root kept in the function is Apple Root CA - G3, byte for byte', Buffer.from(b64(APPLE_ROOT_G3)).equals(Buffer.from(rootFile)) &&
    crypto.createHash('sha256').update(rootFile).digest('hex') === '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179');
  check('the root: its dates, its curve', new Date(root.notBefore).toISOString() === '2014-04-30T18:19:06.000Z' && new Date(root.notAfter).toISOString() === '2039-04-30T18:19:06.000Z' && root.curve === '1.3.132.0.34', [root.notBefore, root.notAfter, root.curve]);
  check('the root signed itself', await issued(root, root));
  check('the developer relations certificate (G6): its dates, Apple\'s mark, signed by the root', new Date(g6.notAfter).toISOString() === '2036-03-19T00:00:00.000Z' && g6.exts['1.2.840.113635.100.6.2.1'] === true &&
    g6.sigAlg === '1.2.840.10045.4.3.3' && await issued(root, g6), [g6.notAfter, Object.keys(g6.exts)]);
  check('and not the other way round', !(await issued(g6, root)));
  const flipped = fx('AppleWWDRCAG6.cer'); flipped[300] ^= 1;
  let r = false; try { r = await issued(root, parseCert(flipped)); } catch (e) { r = false; }
  check('one bit changed in it: not the root\'s any more', r === false);
  check('a certificate cut short does not parse', await code((async () => parseCert(fx('AppleWWDRCAG6.cer').subarray(0, 500)))()) === 'der');
}

// ---- a JWS with a chain shaped like the App Store's
const chain = makeChain(), opts = { root: chain.root };
{
  const tx = transaction({ appAccountToken: 'AAAAAAAA-1111-4000-8000-000000000001' });
  const jws = signJws(tx, chain);
  const p = await verifyJws(jws, opts);
  check('a transaction signed by the chain: its payload comes back', p.transactionId === tx.transactionId && p.productId === 'jokerpro_month' && p.bundleId === 'com.kozyramedia.goldenchess', p);
  check('the same data against Apple\'s real root: refused', await code(verifyJws(jws, {})) === 'chain');
  const parts = jws.split('.');
  const forged = parts[0] + '.' + Buffer.from(JSON.stringify(Object.assign({}, tx, { productId: 'jokerpro_founder' }))).toString('base64url') + '.' + parts[2];
  check('a payload changed after signing: refused', await code(verifyJws(forged, opts)) === 'signature');
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  check('signed by a key that is not the leaf\'s: refused', await code(verifyJws(signJws(tx, chain, { key: other }), opts)) === 'signature');
  const stranger = makeChain();
  check('somebody else\'s chain: refused', await code(verifyJws(signJws(tx, stranger), opts)) === 'chain');
  check('their leaf under our intermediate: refused', await code(verifyJws(signJws(tx, stranger, { x5c: [stranger.leaf, chain.mid, chain.root] }), opts)) === 'chain');
  check('a root in the header that is not the one we keep: refused', await code(verifyJws(signJws(tx, chain, { x5c: [chain.leaf, chain.mid, stranger.root] }), opts)) === 'chain');
  check('the header may leave the root out', (await verifyJws(signJws(tx, chain, { x5c: [chain.leaf, chain.mid] }), opts)).transactionId === tx.transactionId);
  check('a leaf alone: refused', await code(verifyJws(signJws(tx, chain, { x5c: [chain.leaf] }), opts)) === 'alg');
  const noLeafMark = makeChain({ leafOid: false }), noMidMark = makeChain({ midOid: false });
  check('a leaf without the receipt-signing mark: refused', await code(verifyJws(signJws(tx, noLeafMark), { root: noLeafMark.root })) === 'chain');
  check('an intermediate without Apple\'s mark: refused', await code(verifyJws(signJws(tx, noMidMark), { root: noMidMark.root })) === 'chain');
  check('another algorithm in the header: refused', await code(verifyJws(signJws(tx, chain, { alg: 'none' }), opts)) === 'alg' && await code(verifyJws(signJws(tx, chain, { alg: 'HS256' }), opts)) === 'alg');
  check('not a JWS: refused', await code(verifyJws('abc', opts)) === 'jws' && await code(verifyJws('a.b.c', opts)) === 'jws' && await code(verifyJws(null, opts)) === 'jws' && await code(verifyJws('', opts)) === 'jws');
  check('signed before the certificates existed: refused', await code(verifyJws(signJws(transaction({ signedDate: Date.UTC(2020, 0, 1) }), chain), opts)) === 'dates');
  const short = makeChain({ leafDays: 1 });
  check('a leaf that has run out since: data signed while it was valid still holds', (await verifyJws(signJws(transaction({ signedDate: Date.now() }), short), { root: short.root, now: Date.now() + 40 * 864e5 })).productId === 'jokerpro_month');
  check('data dated after the leaf ran out: refused', await code(verifyJws(signJws(transaction({ signedDate: Date.now() + 30 * 864e5 }), short), { root: short.root, now: Date.now() + 40 * 864e5 })) === 'dates');
  check('a date from the future does not count as the signing time', await code(verifyJws(signJws(transaction({ signedDate: Date.now() + 900 * 864e5 }), chain), opts)) === 'ok');
}

// ---- what a transaction gives
{
  const B = 'com.kozyramedia.goldenchess', now = Date.now();
  let e = appleEntitlement(transaction({ productId: 'jokerpro_year', expiresDate: now + 7 * 864e5, offerType: 1, offerDiscountType: 'FREE_TRIAL', price: 0, appAccountToken: 'AAAAAAAA-1111-4000-8000-00000000000A', environment: 'Sandbox' }), null, B);
  check('a yearly subscription in its trial', e.kind === 'sub' && e.plan === 'year' && e.trial === true && e.expires === now + 7 * 864e5 && e.sandbox === true && e.token === 'aaaaaaaa-1111-4000-8000-00000000000a' && e.autoRenew === null && !e.revoked, e);
  const tx = transaction({ transactionId: '31', originalTransactionId: '30', expiresDate: now + 864e5 });
  e = appleEntitlement(tx, { originalTransactionId: '30', autoRenewStatus: 0 }, B);
  check('a renewal keeps the first transaction\'s id; auto-renew off is told', e.id === '30' && e.tx === '31' && e.autoRenew === false && e.plan === 'month' && e.sandbox === false, e);
  e = appleEntitlement(tx, { originalTransactionId: '30', autoRenewStatus: 1, gracePeriodExpiresDate: now + 5 * 864e5 }, B);
  check('days of grace after a failed renewal: Pro until they end', e.expires === now + 5 * 864e5 && e.autoRenew === true, e);
  check('renewal info of another subscription is not used', appleEntitlement(tx, { originalTransactionId: '99', autoRenewStatus: 0, gracePeriodExpiresDate: now + 9 * 864e5 }, B).expires === now + 864e5);
  e = appleEntitlement(transaction({ productId: 'jokerpro_founder' }), null, B);
  check('the founder\'s purchase', e.kind === 'founder' && e.plan === 'founder' && e.expires === null, e);
  e = appleEntitlement(transaction({ revocationDate: now - 5, revocationReason: 0 }), null, B);
  check('a refunded transaction says when', e.revoked === now - 5, e);
  check('family sharing and an upgrade are told', appleEntitlement(transaction({ inAppOwnershipType: 'FAMILY_SHARED', isUpgraded: true }), null, B).shared === true && appleEntitlement(transaction({ isUpgraded: true }), null, B).upgraded === true);
  check('another app\'s transaction: nothing', appleEntitlement(transaction({ bundleId: 'com.other.app' }), null, B) === null);
  check('a product we do not sell: nothing', appleEntitlement(transaction({ productId: 'gems_100' }), null, B) === null);
  check('a subscription product posing as a one-time purchase (and the reverse): nothing', appleEntitlement(transaction({ productId: 'jokerpro_month', type: 'Non-Consumable' }), null, B) === null &&
    appleEntitlement(transaction({ productId: 'jokerpro_founder', type: 'Auto-Renewable Subscription', expiresDate: now + 1 }), null, B) === null);
  check('a subscription with no end date: nothing', appleEntitlement(Object.assign(transaction(), { expiresDate: undefined }), null, B) === null);
  check('an account token that is not an id is dropped', appleEntitlement(transaction({ appAccountToken: 'drop table' }), null, B).token === null);
  check('what a notification asks', appleNotice('REFUND') === 'refund' && appleNotice('REVOKE') === 'refund' && appleNotice('EXPIRED') === 'expired' && appleNotice('GRACE_PERIOD_EXPIRED') === 'expired' && appleNotice('DID_RENEW') === '' && appleNotice('TEST') === '');
}

// ---- what a store's news does to the purchase on file
{
  const now = Date.now(), D = 864e5;
  const sub = (o) => Object.assign({ store: 'apple', kind: 'sub', tx: '1', expires: now + 30 * D, revoked: null, autoRenew: null, trial: false, signed: now }, o);
  const kept = (o) => Object.assign({ tx: '1', expires_at: new Date(now + 30 * D).toISOString(), revoked_at: null, auto_renew: true, trial: false, signed_at: new Date(now - 1000).toISOString() }, o);
  let m = storeMerge(null, sub({ trial: true }), '', now);
  check('a first purchase goes on file as it is', m.status === 'active' && m.expires === now + 30 * D && m.revokedAt === null && m.trial === true && m.tx === '1' && m.autoRenew === null, m);
  m = storeMerge(kept(), sub({ tx: '2', expires: now + 60 * D, autoRenew: false }), '', now);
  check('a renewal moves the end forward', m.expires === now + 60 * D && m.tx === '2' && m.autoRenew === false && m.status === 'active', m);
  m = storeMerge(kept({ tx: '2', expires_at: new Date(now + 60 * D).toISOString() }), sub({ tx: '1', expires: now + 30 * D }), '', now);
  check('older news never moves it back, and auto-renew is kept when the news does not say', m.expires === now + 60 * D && m.tx === '2' && m.autoRenew === true, m);
  m = storeMerge(kept(), sub({ expires: now - 5 }), 'expired', now);
  check('an end in the past: expired', storeMerge(kept({ expires_at: new Date(now - 10).toISOString() }), sub({ expires: now - 10 }), 'expired', now).status === 'expired' && m.expires === now + 30 * D, m);
  m = storeMerge(kept(), sub({ revoked: now - 3000 }), '', now);
  check('the refund of what runs now ends it then', m.status === 'revoked' && m.expires === now - 3000 && m.revokedAt === now - 3000 && m.autoRenew === false, m);
  check('a notification of a refund without a date ends it now', storeMerge(kept(), sub(), 'refund', now).expires === now);
  check('a refund dated in the future ends it now', storeMerge(kept(), sub({ revoked: now + 9 * D }), '', now).expires === now);
  check('the refund of a period long over changes nothing', storeMerge(kept({ tx: '5', expires_at: new Date(now + 60 * D).toISOString() }), sub({ tx: '2', expires: now - 40 * D, revoked: now - 39 * D }), 'refund', now).skip === 'old_refund');
  const refunded = kept({ expires_at: new Date(now - 3000).toISOString(), revoked_at: new Date(now - 3000).toISOString(), auto_renew: false });
  check('the refunded transaction shown again: nothing', storeMerge(refunded, sub(), '', now).skip === 'refunded');
  m = storeMerge(refunded, sub({ tx: '0', expires: now - 50 * D }), '', now);
  check('an older one after the refund: still refunded', m.status === 'revoked' && m.revokedAt === now - 3000 && m.expires === now - 3000, m);
  m = storeMerge(refunded, sub({ tx: '7', expires: now + 30 * D }), '', now);
  check('a new purchase after the refund runs again', m.status === 'active' && m.revokedAt === null && m.tx === '7', m);
  check('a subscription without an end is not put on file', storeMerge(null, sub({ expires: null }), '', now).skip === 'no_end');
  const f = { store: 'apple', kind: 'founder', tx: '9', expires: null, revoked: null, autoRenew: null, trial: false, signed: now };
  m = storeMerge(null, f, '', now);
  check('a founder\'s purchase', m.status === 'active' && m.expires === null && m.revokedAt === null, m);
  m = storeMerge({ tx: '9', revoked_at: null }, Object.assign({}, f, { revoked: now - 1 }), '', now);
  check('its refund', m.status === 'revoked' && m.revokedAt === now - 1);
  check('the refunded founder shown again: nothing', storeMerge({ tx: '9', revoked_at: new Date(now - 1).toISOString() }, f, '', now).skip === 'refunded');
  m = storeMerge(kept({ expires_at: new Date(now + 300 * D).toISOString() }), { store: 'google', kind: 'sub', tx: 'GPA.2', status: 'paused', expires: now - 60e3, autoRenew: true, trial: false }, '', now);
  check('Google is asked at that moment: what it says is how things are, even an earlier end', m.status === 'paused' && m.expires === now - 60e3 && m.revokedAt === null && m.tx === 'GPA.2', m);
  m = storeMerge(kept(), { store: 'google', kind: 'founder', tx: null, status: 'revoked', expires: null, autoRenew: null, trial: false }, '', now);
  check('Google\'s refund is dated when we learn of it', m.status === 'revoked' && m.revokedAt === now && m.tx === '1', m);

  // ---- what the client is told
  const st = { on: true, founder: false, until: now + 200 * D, plan: 'year', status: null, cancel: false, trial: false, trialUsed: false, sub: false };
  const s1 = { store: 'apple', kind: 'sub', plan: 'year', status: 'active', expires_at: new Date(now + 200 * D).toISOString(), auto_renew: false, trial: true, sandbox: false };
  let w = withStore(st, null, s1, now);
  check('Pro from the App Store: bought there, managed there', w.via === 'apple' && w.sub === true && w.cancel === true && w.trial === true && w.status === 'active' && st.via === undefined, w);
  w = withStore(Object.assign({}, st, { until: now + 300 * D, status: 'active', sub: true }), { until: new Date(now + 300 * D).toISOString() }, s1, now);
  check('a longer one from Stripe: Stripe\'s', w.via === 'stripe' && w.sub === true && w.cancel === false && w.status === 'active', w);
  check('a founder: where the payment was made', withStore({ on: true, founder: true }, { founder_at: new Date().toISOString() }, null, now).via === 'stripe' &&
    withStore({ on: true, founder: true }, null, { store: 'google', kind: 'founder', status: 'active' }, now).via === 'google');
  check('no Pro: bought nowhere', withStore({ on: false, founder: false }, null, Object.assign({}, s1, { expires_at: new Date(now - 5).toISOString() }), now).via === null);
}

// ---- Google's answers
{
  const now = Date.now(), D = 864e5, T = 'tok-android-0000000000000000000001', A = 'AAAAAAAA-1111-4000-8000-00000000000B';
  const v = (o = {}) => Object.assign({ startTime: new Date(now - D).toISOString(), subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', latestOrderId: 'GPA.1', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    externalAccountIdentifiers: { obfuscatedExternalAccountId: A }, lineItems: [{ productId: 'jokerpro_sub', expiryTime: new Date(now + 6 * D).toISOString(), autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: 'year', offerId: 'trial' } }] }, o);
  let e = googleSub(v(), T, now);
  check('a running yearly subscription in its free week', e.id === 'google:' + T && e.kind === 'sub' && e.plan === 'year' && e.status === 'active' && Math.abs(e.expires - (now + 6 * D)) < 1000 && e.autoRenew === true && e.trial === true &&
    e.sandbox === false && e.account === A.toLowerCase() && e.ack === true && e.linked === null && e.tx === 'GPA.1', e);
  e = googleSub(v({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', testPurchase: {}, linkedPurchaseToken: 'old-token' }), T, now);
  check('cancelled: runs to its end, will not renew; a tester\'s; replaces another', e.status === 'active' && e.autoRenew === false && e.sandbox === true && e.ack === false && e.linked === 'old-token', e);
  check('in grace: Pro stays', googleSub(v({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' }), T, now).status === 'grace');
  for (const st of ['ON_HOLD', 'PAUSED']) { e = googleSub(v({ subscriptionState: 'SUBSCRIPTION_STATE_' + st }), T, now); check(st + ': no Pro meanwhile', e.status === 'paused' && e.expires <= now && e.ack === false, e); }
  for (const st of ['EXPIRED', 'PENDING_PURCHASE_CANCELED', 'SOMETHING_NEW']) { e = googleSub(v({ subscriptionState: 'SUBSCRIPTION_STATE_' + st }), T, now); check(st + ': over', e.status === 'expired' && e.expires <= now, e); }
  e = googleSub(v({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }), T, now);
  check('waiting for its first payment: nothing yet', e.status === 'pending' && e.expires === null && e.ack === false, e);
  check('the trial is told only in its first days', googleSub(v({ startTime: new Date(now - 9 * D).toISOString() }), T, now).trial === false);
  check('another product, no token, nothing: not ours', googleSub(v({ lineItems: [{ productId: 'other', expiryTime: new Date(now + D).toISOString() }] }), T, now) === null && googleSub(v(), '', now) === null && googleSub(null, T, now) === null);
  check('an account id that is not one is dropped', googleSub(v({ externalAccountIdentifiers: { obfuscatedExternalAccountId: 'x' } }), T, now).account === null);
  e = googleFounder({ purchaseState: 0, acknowledgementState: 0, orderId: 'GPA.9', obfuscatedExternalAccountId: A }, T);
  check('the founder\'s purchase at Google', e.kind === 'founder' && e.status === 'active' && e.ack === true && e.sandbox === false && e.account === A.toLowerCase() && e.tx === 'GPA.9', e);
  check('refunded, pending, a tester\'s', googleFounder({ purchaseState: 1 }, T).status === 'revoked' && googleFounder({ purchaseState: 2, acknowledgementState: 0 }, T).status === 'pending' && googleFounder({ purchaseState: 2, acknowledgementState: 0 }, T).ack === false &&
    googleFounder({ purchaseState: 0, purchaseType: 0, acknowledgementState: 1 }, T).sandbox === true && googleFounder({}, T) === null);
  // the service account's sign-in
  const k = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const acct = serviceAccount(JSON.stringify({ client_email: 'a@b.iam.gserviceaccount.com', private_key: k.privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' }));
  const jwt = await serviceJwt(acct, 1700000000, acct.tokenUrl), parts = jwt.split('.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  check('the service account\'s JWT: who, for what, for an hour, signed with its key', claims.iss === 'a@b.iam.gserviceaccount.com' && claims.scope === 'https://www.googleapis.com/auth/androidpublisher' && claims.aud === 'https://oauth2.googleapis.com/token' &&
    claims.exp - claims.iat === 3600 && crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), k.publicKey, Buffer.from(parts[2], 'base64url')), claims);
  check('a key file that is not one: no account', serviceAccount('') === null && serviceAccount('{}') === null && serviceAccount('not json') === null && serviceAccount(JSON.stringify({ client_email: 'a', private_key: 'x' })) === null);
}

console.log(`store (Apple's signed data, Google's answers, the rules): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
