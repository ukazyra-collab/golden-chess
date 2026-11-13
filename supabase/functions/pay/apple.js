// Joker Pro bought in the iPhone app: Apple's signed data, checked with no network and no key of ours. Shared with the
// tests (test/server/store.test.mjs runs it under Node).
//
// StoreKit 2 hands the app each transaction as a JWS (header.payload.signature, ES256), and App Store Server
// Notifications V2 arrive as one too. The header carries the certificate chain (x5c: leaf, intermediate, root). It is
// Apple's when: the root is Apple Root CA - G3 (kept here), the intermediate is signed by that root and marked as a
// Worldwide Developer Relations one, the leaf is signed by the intermediate and marked as App Store receipt signing,
// both were valid when the data was signed, and the leaf's key made the JWS's signature.
//
// Apple Root CA - G3 (https://www.apple.com/certificateauthority/AppleRootCA-G3.cer, SHA-256
// 63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179)
export const APPLE_ROOT_G3 = 'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';
const OID_LEAF = '1.2.840.113635.100.6.11.1'; // App Store receipt signing
const OID_INTERMEDIATE = '1.2.840.113635.100.6.2.1'; // Apple Worldwide Developer Relations
const CURVES = { '1.2.840.10045.3.1.7': ['P-256', 32], '1.3.132.0.34': ['P-384', 48] };
const HASHES = { '1.2.840.10045.4.3.2': 'SHA-256', '1.2.840.10045.4.3.3': 'SHA-384' };

class Bad extends Error { constructor(code) { super(code); this.code = code; } }
const bad = (code) => { throw new Bad(code); };

// ---- base64 (the certificates) and base64url (the JWS parts)
export function b64(s) {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  while (t.length % 4) t += '=';
  const bin = atob(t), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

// ---- a little DER: one element at pos → its tag, where its content starts and ends, where the element ends
function el(buf, pos) {
  if (pos + 2 > buf.length) bad('der');
  const tag = buf[pos];
  let len = buf[pos + 1], at = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (!n || n > 3 || at + n > buf.length) bad('der');
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[at + i];
    at += n;
  }
  if (at + len > buf.length) bad('der');
  return { tag, from: pos, start: at, end: at + len };
}
function kids(buf, e) { const out = []; let p = e.start; while (p < e.end) { const c = el(buf, p); out.push(c); p = c.end; } return out; }
const bytes = (buf, e) => buf.subarray(e.start, e.end);
const whole = (buf, e) => buf.subarray(e.from, e.end);
function oid(buf, e) {
  if (e.tag !== 0x06) bad('der');
  const b = bytes(buf, e), out = [Math.floor(b[0] / 40), b[0] % 40];
  let v = 0;
  for (let i = 1; i < b.length; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { out.push(v); v = 0; } }
  return out.join('.');
}
function time(buf, e) { // UTCTime YYMMDDHHMMSSZ, GeneralizedTime YYYYMMDDHHMMSSZ
  const s = String.fromCharCode.apply(null, bytes(buf, e));
  const m = e.tag === 0x17 ? /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s) : e.tag === 0x18 ? /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s) : null;
  if (!m) bad('der');
  const y = e.tag === 0x17 ? (+m[1] < 50 ? 2000 + +m[1] : 1900 + +m[1]) : +m[1];
  return Date.UTC(y, +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// a certificate: what is signed, by which algorithm, the signature, its own key, its names, its dates, its extensions
export function parseCert(buf) {
  const cert = el(buf, 0);
  if (cert.tag !== 0x30 || cert.end !== buf.length) bad('der');
  const [tbs, alg, sig] = kids(buf, cert);
  if (!tbs || !alg || !sig || tbs.tag !== 0x30 || sig.tag !== 0x03) bad('der');
  const t = kids(buf, tbs);
  let i = 0;
  if (t[0] && t[0].tag === 0xa0) i = 1; // [0] version
  const issuer = t[i + 2], validity = t[i + 3], subject = t[i + 4], spki = t[i + 5];
  if (!issuer || !validity || !subject || !spki) bad('der');
  const [nb, na] = kids(buf, validity);
  const sp = kids(buf, spki), keyAlg = sp[0] ? kids(buf, sp[0]) : [];
  const exts = {};
  for (const x of t.slice(i + 6)) {
    if (x.tag !== 0xa3) continue; // [3] extensions
    const seq = kids(buf, x)[0];
    for (const ext of seq ? kids(buf, seq) : []) { const f = kids(buf, ext); if (f[0] && f[0].tag === 0x06) exts[oid(buf, f[0])] = true; }
  }
  return {
    tbs: whole(buf, tbs), sigAlg: oid(buf, kids(buf, alg)[0]), sig: bytes(buf, sig).subarray(1), // (a BIT STRING: its first byte counts unused bits)
    spki: whole(buf, spki), curve: keyAlg[1] && keyAlg[1].tag === 0x06 ? oid(buf, keyAlg[1]) : '',
    issuer: whole(buf, issuer), subject: whole(buf, subject), notBefore: time(buf, nb), notAfter: time(buf, na), exts, raw: buf,
  };
}
// an ECDSA signature as certificates carry it (SEQUENCE { r, s }) → as WebCrypto takes it (r | s, each `size` bytes)
function rawSig(der, size) {
  const seq = el(der, 0), [r, s] = kids(der, seq);
  if (seq.tag !== 0x30 || !r || !s || r.tag !== 0x02 || s.tag !== 0x02) bad('der');
  const out = new Uint8Array(size * 2);
  [r, s].forEach((e, k) => {
    let b = bytes(der, e);
    while (b.length > size && b[0] === 0) b = b.subarray(1);
    if (b.length > size) bad('der');
    out.set(b, k * size + size - b.length);
  });
  return out;
}
function keyOf(cert) {
  const c = CURVES[cert.curve];
  if (!c) bad('key');
  return crypto.subtle.importKey('spki', cert.spki, { name: 'ECDSA', namedCurve: c[0] }, false, ['verify']).then((key) => ({ key, size: c[1] }));
}
// is `child` signed by `parent`, and named as issued by it?
export async function issued(parent, child) {
  if (!same(child.issuer, parent.subject)) return false;
  const hash = HASHES[child.sigAlg];
  if (!hash) return false;
  const k = await keyOf(parent);
  return crypto.subtle.verify({ name: 'ECDSA', hash }, k.key, rawSig(child.sig, k.size), child.tbs);
}

// ---- a JWS of Apple's → its payload. opts: { root (base64 DER; Apple's own unless a test says otherwise), now (ms) }
// Throws Bad with a code: 'jws' (not one), 'alg', 'chain' (not Apple's certificates), 'dates' (a certificate out of
// its dates when the data was signed), 'signature'.
export async function verifyJws(jws, opts) {
  const o = opts || {}, now = o.now || Date.now();
  const parts = typeof jws === 'string' ? jws.split('.') : [];
  if (parts.length !== 3) bad('jws');
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64(parts[1])));
  } catch (_e) { bad('jws'); }
  if (!header || header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length < 2 || header.x5c.length > 3) bad('alg');
  if (!payload || typeof payload !== 'object') bad('jws');
  let leaf, mid, root;
  try {
    root = parseCert(b64(o.root || APPLE_ROOT_G3));
    leaf = parseCert(b64(header.x5c[0])); mid = parseCert(b64(header.x5c[1]));
    if (header.x5c[2] && !same(b64(header.x5c[2]), root.raw)) bad('chain');
  } catch (_e) { bad('chain'); }
  if (!mid.exts[OID_INTERMEDIATE] || !leaf.exts[OID_LEAF]) bad('chain');
  let ok = false;
  try { ok = (await issued(root, mid)) && (await issued(mid, leaf)); } catch (_e) { ok = false; }
  if (!ok) bad('chain');
  // the certificates' dates, at the moment the data was signed (a transaction kept on a phone for a year is still Apple's)
  const signed = typeof payload.signedDate === 'number' && payload.signedDate > 0 && payload.signedDate <= now + 864e5 ? payload.signedDate : now;
  for (const c of [leaf, mid, root]) if (signed < c.notBefore || signed > c.notAfter) bad('dates');
  let good = false;
  try {
    const k = await keyOf(leaf);
    if (k.size !== 32) bad('alg');
    good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.key, b64(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  } catch (_e) { good = false; }
  if (!good) bad('signature');
  return payload;
}

// ---- what a transaction gives. PRODUCTS: the App Store's product ids → our plans.
export const APPLE_PRODUCTS = { jokerpro_month: 'month', jokerpro_year: 'year', jokerpro_founder: 'founder' };
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
// tx: a transaction's payload; renewal: its renewal info's payload, when there is one. → the row a purchase leaves:
// { id (the first transaction of the subscription: the same through every renewal and change of plan), kind: 'sub' |
//   'founder', plan, product, tx, expires (ms; a subscription), revoked (ms), autoRenew, trial, sandbox, token (the
//   account the app named when buying), signed, shared (family sharing: somebody else's purchase), upgraded }
export function appleEntitlement(tx, renewal, bundle) {
  if (!tx || typeof tx !== 'object') return null;
  if (bundle && tx.bundleId !== bundle) return null;
  const plan = APPLE_PRODUCTS[tx.productId];
  if (!plan || !tx.originalTransactionId) return null;
  const founder = plan === 'founder';
  if (founder ? tx.type !== 'Non-Consumable' : tx.type !== 'Auto-Renewable Subscription') return null;
  let expires = founder ? null : num(tx.expiresDate);
  if (!founder && expires === null) return null;
  const r = renewal && renewal.originalTransactionId === tx.originalTransactionId ? renewal : null;
  // a renewal that didn't go through, with Apple's days of grace: Pro stays until they are over
  if (r && num(r.gracePeriodExpiresDate) !== null && r.gracePeriodExpiresDate > expires) expires = r.gracePeriodExpiresDate;
  const token = typeof tx.appAccountToken === 'string' && /^[0-9a-f-]{36}$/i.test(tx.appAccountToken) ? tx.appAccountToken.toLowerCase() : null;
  return {
    id: String(tx.originalTransactionId), kind: founder ? 'founder' : 'sub', plan, product: String(tx.productId), tx: String(tx.transactionId || tx.originalTransactionId),
    expires, revoked: num(tx.revocationDate), autoRenew: r ? r.autoRenewStatus === 1 : null,
    trial: tx.offerDiscountType === 'FREE_TRIAL' || (tx.offerType === 1 && tx.price === 0), sandbox: tx.environment !== 'Production', token,
    signed: num(tx.signedDate) || 0, shared: tx.inAppOwnershipType === 'FAMILY_SHARED', upgraded: tx.isUpgraded === true,
  };
}
// what a notification asks of the purchase beyond its transaction: 'refund' (the money went back: Pro ends now),
// 'expired', or nothing more
export function appleNotice(type) {
  if (type === 'REFUND' || type === 'REVOKE') return 'refund';
  if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED') return 'expired';
  return '';
}
