// A stand-in for Apple's signing: a certificate chain shaped like the App Store's (a P-384 root, a P-384 intermediate
// marked as Worldwide Developer Relations, a P-256 leaf marked as App Store receipt signing), made with openssl, and
// JWS signed with the leaf. The pay function is pointed at this root (APPLE_ROOT) under the tests.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ssl = (dir, args) => execFileSync('openssl', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
const der = (pem) => pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
// opts: { midOid: false (an intermediate without Apple's mark), leafOid: false, leafDays }
export function makeChain(opts = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-standin-'));
  fs.writeFileSync(path.join(d, 'ext.cnf'), [
    '[root]', 'basicConstraints=critical,CA:TRUE', 'keyUsage=critical,keyCertSign,cRLSign', 'subjectKeyIdentifier=hash',
    '[mid]', 'basicConstraints=critical,CA:TRUE,pathlen:0', 'keyUsage=critical,keyCertSign,cRLSign', opts.midOid === false ? '' : '1.2.840.113635.100.6.2.1=DER:0500',
    '[leaf]', 'basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature', opts.leafOid === false ? '' : '1.2.840.113635.100.6.11.1=DER:0500', ''].join('\n'));
  ssl(d, ['ecparam', '-name', 'secp384r1', '-genkey', '-noout', '-out', 'root.key']);
  ssl(d, ['req', '-new', '-key', 'root.key', '-subj', '/CN=Stand-in Root CA/O=Tests', '-out', 'root.csr']);
  ssl(d, ['x509', '-req', '-in', 'root.csr', '-signkey', 'root.key', '-sha384', '-days', '3650', '-extfile', 'ext.cnf', '-extensions', 'root', '-out', 'root.pem']);
  ssl(d, ['ecparam', '-name', 'secp384r1', '-genkey', '-noout', '-out', 'mid.key']);
  ssl(d, ['req', '-new', '-key', 'mid.key', '-subj', '/CN=Stand-in Developer Relations/O=Tests', '-out', 'mid.csr']);
  ssl(d, ['x509', '-req', '-in', 'mid.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-sha384', '-days', '3000', '-extfile', 'ext.cnf', '-extensions', 'mid', '-out', 'mid.pem']);
  ssl(d, ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key']);
  ssl(d, ['req', '-new', '-key', 'leaf.key', '-subj', '/CN=Stand-in Receipt Signing/O=Tests', '-out', 'leaf.csr']);
  ssl(d, ['x509', '-req', '-in', 'leaf.csr', '-CA', 'mid.pem', '-CAkey', 'mid.key', '-CAcreateserial', '-sha384', '-days', String(opts.leafDays || 700), '-extfile', 'ext.cnf', '-extensions', 'leaf', '-out', 'leaf.pem']);
  const read = (f) => fs.readFileSync(path.join(d, f), 'utf8');
  const chain = { root: der(read('root.pem')), mid: der(read('mid.pem')), leaf: der(read('leaf.pem')), leafKey: crypto.createPrivateKey(read('leaf.key')) };
  fs.rmSync(d, { recursive: true, force: true });
  return chain;
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// a JWS as StoreKit and the App Store server make them. opts: { key (another key signs), x5c (another chain in the header), alg }
export function signJws(payload, chain, opts = {}) {
  const header = { alg: opts.alg || 'ES256', x5c: opts.x5c || [chain.leaf, chain.mid, chain.root] };
  const head = b64u(JSON.stringify(header)), body = b64u(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: opts.key || chain.leafKey, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}
// a transaction's payload, as the App Store signs it
let seq = 2000001000000000;
export function transaction(o = {}) {
  const now = Date.now(), id = String(o.transactionId || ++seq);
  const sub = o.productId !== 'jokerpro_founder';
  return Object.assign({
    transactionId: id, originalTransactionId: id, bundleId: 'com.kozyramedia.goldenchess', productId: 'jokerpro_month',
    purchaseDate: now, originalPurchaseDate: now, quantity: 1, type: sub ? 'Auto-Renewable Subscription' : 'Non-Consumable',
    inAppOwnershipType: 'PURCHASED', signedDate: now, environment: 'Production', storefront: 'USA', transactionReason: 'PURCHASE', price: 3990, currency: 'USD',
  }, sub ? { subscriptionGroupIdentifier: '21500000', webOrderLineItemId: id, expiresDate: now + 30 * 864e5 } : {}, o);
}
export function notification(type, tx, chain, o = {}) {
  const env = tx.environment || 'Production';
  const data = { bundleId: tx.bundleId, environment: env, signedTransactionInfo: signJws(tx, chain) };
  if (o.renewal) data.signedRenewalInfo = signJws(Object.assign({ originalTransactionId: tx.originalTransactionId, productId: tx.productId, autoRenewProductId: tx.productId, autoRenewStatus: 1, environment: env, signedDate: Date.now() }, o.renewal), chain);
  const payload = { notificationType: type, subtype: o.subtype, notificationUUID: o.uuid || crypto.randomUUID(), version: '2.0', signedDate: Date.now(), data };
  return JSON.stringify({ signedPayload: signJws(payload, o.chain || chain) });
}
