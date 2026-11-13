// Local stand-in for the Supabase backend: the same game logic (supabase/functions/play/logic.js) over an
// in-memory store, Server-Sent Events instead of Realtime, a small stand-in for Supabase Auth's email codes
// (/auth; the codes land in an outbox), and a few test hooks under /admin.
// Usage: node test/server/mock-server.mjs [port]   (serves dist/mock/index.html at /)
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createLogic } from '../../supabase/functions/play/logic.js';
import { createMemoryRepo } from './memory-repo.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GC = require(path.join(ROOT, 'src/core.js'));
const PORT = +process.argv[2] || 8787;

let shift = 0; // test hook: server clock offset
const now = () => Date.now() + shift;
const iso = (t) => new Date(t).toISOString();
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

const { repo, db, addHouse } = createMemoryRepo(now);
const avatars = new Map(); // uid -> JPEG bytes
// Joker Pro's paying side in memory: what Stripe would hold about an account, the payment pages asked for
const billing = new Map(), sessions = new Map(), portalVisits = [];
let founderBase = 0;
// ... and what the App Store or Google Play would hold: the purchases shown by the apps (store_purchases), by id.
// A test purchase is its own description: 'apple.<base64 of JSON>' stands for a signed transaction, 'gp.<base64 of
// JSON>' for a purchase token. { id (the purchase), product, base (Google's base plan), days (from now until it ends),
// trial, cancel (it will not renew), refund, pending }
const storeRows = new Map(), storeClaims = [];
const APPLE_PLANS = { jokerpro_month: 'month', jokerpro_year: 'year', jokerpro_founder: 'founder' };
function readPurchase(store, text) {
  const pre = store === 'apple' ? 'apple.' : 'gp.';
  if (typeof text !== 'string' || !text.startsWith(pre)) return null;
  let d = null; try { d = JSON.parse(Buffer.from(text.slice(pre.length), 'base64').toString('utf8')); } catch { return null; }
  if (!d || typeof d.id !== 'string') return null;
  const plan = store === 'apple' ? APPLE_PLANS[d.product] : d.product === 'jokerpro_founder' ? 'founder' : d.product === 'jokerpro_sub' && ['month', 'year'].includes(d.base) ? d.base : null;
  if (!plan) return null;
  return { id: store + ':' + d.id, store, kind: plan === 'founder' ? 'founder' : 'sub', plan, expires: plan === 'founder' ? null : now() + (d.days == null ? (d.trial ? 7 : plan === 'year' ? 365 : 30) : d.days) * 86400000,
    trial: !!d.trial, cancel: !!d.cancel, refund: !!d.refund, pending: !!d.pending };
}
// as gc_pro_refresh: the account's Pro is what Stripe's side and the stores' purchases give together
function proRefresh(uid) {
  const p = db.profiles.get(uid); if (!p) return;
  const row = billing.get(uid) || null, mine = [...storeRows.values()].filter((r) => r.uid === uid && !r.refund && !r.pending);
  const sub = mine.filter((r) => r.kind === 'sub').sort((a, b) => b.expires - a.expires)[0] || null;
  const founder = !!(row && row.founder) || mine.some((r) => r.kind === 'founder');
  const stripeUntil = row && row.until ? row.until : null, until = Math.max(stripeUntil || 0, sub ? sub.expires : 0) || null;
  p.pro_until = until ? iso(until) : null; p.pro_founder = founder;
  p.pro_plan = founder ? 'founder' : until === null ? p.pro_plan || null : sub && sub.expires === until ? sub.plan : (row && row.plan) || p.pro_plan || null;
}
// where the account's Pro comes from (the pay function's withStore)
function storeOf(uid) {
  const mine = [...storeRows.values()].filter((r) => r.uid === uid && !r.refund && !r.pending);
  return mine.filter((r) => r.kind === 'sub').sort((a, b) => b.expires - a.expires)[0] || mine.find((r) => r.kind === 'founder') || null;
}

// ---- SSE "realtime"
const subs = new Map(); // topic -> Set<{res, uid}>
let dropBroadcasts = false; // test hook: simulate a dead realtime channel
let dropPeer = false; // test hook: peer messages lost (server broadcasts still arrive)
let extraLatency = 0; // test hook: a slow server (added to MOCK_LATENCY)
function send(res, event, payload) { res.write('data: ' + JSON.stringify({ event, payload }) + '\n\n'); }
async function broadcast(topic, event, payload) {
  if (dropBroadcasts) return;
  const set = subs.get(topic);
  if (set) for (const c of set) send(c.res, event, payload);
}
function presence(topic) {
  const set = subs.get(topic);
  if (!set) return;
  const uids = [...new Set([...set].filter((c) => !c.away).map((c) => c.uid))]; // away: the app is in the background (untracked)
  for (const c of set) send(c.res, 'presence', uids);
}

const logic = createLogic({ repo, broadcast, GC, now, fair: process.env.GC_FAIR !== 'off', mail: process.env.GC_MAIL !== 'off', prog: process.env.GC_PROG !== 'off' });

// ---- "Supabase Auth": a guest links an email (same account), or an email signs in (existing or new account).
// Same answers as the real service: 422 email_exists / otp_disabled, 403 otp_expired, 429 when a code is
// requested again within a minute.
const accounts = { ids: new Map(), emailOf: new Map(), uidOf: new Map(), pending: new Map(), lastSent: new Map(), outbox: [] };
const OTP_TTL = 10 * 60000, RESEND_MS = 60000;
const REVIEW = { email: 'review@kozyramedia.com', password: 'review-test-pass' }; // the stores' review account (test only)
function sendCode(email, uid, type) {
  const t = now();
  if (t - (accounts.lastSent.get(email) ?? -Infinity) < RESEND_MS) return { status: 429, body: { error: 'over_email_send_rate_limit' } };
  const code = String(100000 + crypto.randomInt(900000));
  accounts.pending.set(email, { code, uid, type, at: t });
  accounts.lastSent.set(email, t);
  accounts.outbox.push({ to: email, code, type, at: t });
  return { status: 200, body: { ok: true } };
}
function authOp(b) {
  const uid = typeof b.token === 'string' && b.token ? b.token : null;
  if (!uid) return { status: 401, body: { error: 'no_authorization' } };
  if (b.op === 'whoami') {
    const e = accounts.emailOf.get(uid) || null;
    const methods = [...accounts.ids.entries()].filter(([, u]) => u === uid).map(([k]) => ({ provider: k.split(':')[0], email: k.slice(k.indexOf(':') + 1) }));
    return { status: 200, body: { uid, email: e, guest: !e, methods } };
  }
  if (b.op === 'idtoken') { // signInWithIdToken / linkIdentity: a test token "<provider>:<email>" stands for the provider's ID token
    const m = /^(apple|google):(.+)$/.exec(String(b.idtoken || ''));
    if (!m || m[1] !== b.provider) return { status: 400, body: { error: 'bad_id_token' } };
    // as Supabase: the provider's own account first, else (linking off) the account with that email
    const em = m[2].toLowerCase(), key = m[1] + ':' + em;
    let id = accounts.ids.get(key) || (b.link ? null : accounts.uidOf.get(em));
    if (b.link) {
      if (id && id !== uid) return { status: 422, body: { error: 'identity_already_exists' } };
      const ownerOfEmail = accounts.uidOf.get(em);
      if (ownerOfEmail && ownerOfEmail !== uid) return { status: 422, body: { error: 'email_exists' } };
      id = uid;
    } else if (!id) id = accounts.emailOf.has(uid) ? 'u' + crypto.randomUUID().slice(0, 8) : uid; // a signed-in player signing in elsewhere: a new account
    if (!accounts.emailOf.has(id)) accounts.emailOf.set(id, em);
    if (!accounts.uidOf.has(em)) accounts.uidOf.set(em, id);
    accounts.ids.set(key, id);
    return { status: 200, body: { uid: id, email: accounts.emailOf.get(id) } };
  }
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { error: 'validation_failed' } };
  const owner = accounts.uidOf.get(email);
  if (b.op === 'link') { // updateUser({ email }) for a guest
    if (owner && owner !== uid) return { status: 422, body: { error: 'email_exists' } };
    return sendCode(email, uid, 'email_change');
  }
  if (b.op === 'signin') { // signInWithOtp({ email, options: { shouldCreateUser } })
    if (!owner && !b.create) return { status: 422, body: { error: 'otp_disabled' } };
    return sendCode(email, owner || 'u' + crypto.randomUUID().slice(0, 8), 'email');
  }
  if (b.op === 'password') { // signInWithPassword({ email, password }): only the stores' review account has one
    if (email !== REVIEW.email || b.password !== REVIEW.password) return { status: 400, body: { error: 'invalid_credentials' } };
    let id = owner;
    if (!id) { id = 'u' + crypto.randomUUID().slice(0, 8); accounts.emailOf.set(id, email); accounts.uidOf.set(email, id); accounts.ids.set('email:' + email, id); }
    return { status: 200, body: { uid: id, email } };
  }
  if (b.op === 'verify') { // verifyOtp({ email, token, type })
    const p = accounts.pending.get(email), type = b.type === 'email_change' ? 'email_change' : 'email';
    if (!p || p.code !== String(b.code) || p.type !== type || now() - p.at > OTP_TTL || (type === 'email_change' && p.uid !== uid)) return { status: 403, body: { error: 'otp_expired' } };
    accounts.pending.delete(email);
    accounts.emailOf.set(p.uid, email); accounts.uidOf.set(email, p.uid); accounts.ids.set('email:' + email, p.uid);
    return { status: 200, body: { uid: p.uid, email } };
  }
  return { status: 400, body: { error: 'bad_op' } };
}
// as gc_merge_accounts on the sign-in side: the methods move over; the email too if the kept account has no real one
function mergeAuth(keep, gone) {
  const relay = (e) => !e || /privaterelay\.appleid\.com$/i.test(e);
  for (const [k, u] of accounts.ids) if (u === gone) { if (k.startsWith('email:') && !relay(accounts.emailOf.get(keep))) accounts.ids.delete(k); else accounts.ids.set(k, keep); }
  const ge = accounts.emailOf.get(gone);
  if (ge && !relay(ge) && relay(accounts.emailOf.get(keep))) accounts.emailOf.set(keep, ge);
  for (const [e, u] of accounts.uidOf) if (u === gone) accounts.uidOf.set(e, keep);
  accounts.emailOf.delete(gone);
}
const page = () => fs.readFileSync(path.join(ROOT, 'dist/mock/index.html'));

function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(page());
    return;
  }
  if (req.method === 'GET' && u.pathname === '/events') {
    const topic = u.searchParams.get('topic'), uid = u.searchParams.get('uid') || '';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': hi\n\n');
    const c = { res, uid };
    if (!subs.has(topic)) subs.set(topic, new Set());
    subs.get(topic).add(c);
    presence(topic);
    req.on('close', () => { subs.get(topic)?.delete(c); presence(topic); });
    return;
  }
  if (req.method === 'POST' && u.pathname === '/play') {
    const body = await readBody(req);
    // same contract as the edge function: token in the Authorization header or in the body
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || (typeof body.token === 'string' ? body.token : '');
    delete body.token; delete body.via;
    // merge: the second account's token (here: its id) proves the caller holds it too
    const other = typeof body.other === 'string' ? body.other : ''; delete body.other; delete body.__other;
    if (body.action === 'merge' && other) body.__other = other;
    const auth = token ? Promise.resolve({ sub: token, guest: !accounts.emailOf.has(token) }) : Promise.reject({ code: 'auth' });
    const delay = +(process.env.MOCK_LATENCY || 0) + extraLatency;
    if (delay) await new Promise((r) => setTimeout(r, delay / 2));
    const { status, body: out } = await logic.handle(auth, body);
    if (body.action === 'merge' && out && out.gone) mergeAuth(out.keep, out.gone);
    if (delay) await new Promise((r) => setTimeout(r, delay / 2));
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }
  // ---- Joker Pro's paying side (supabase/functions/pay), in memory: the same answers to the page, and two pages
  // of its own in place of Stripe's (the payment page, the page that manages a subscription)
  if (req.method === 'POST' && u.pathname === '/pay') {
    const b = await readBody(req), uid = typeof b.token === 'string' ? b.token : '';
    const send = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const mode = db.proMode === undefined ? 'off' : db.proMode, founders = () => founderBase + [...db.profiles.values()].filter((p) => p.pro_founder).length;
    const shops = db.proStores || { ios: 'off', android: 'off' };
    if (b.action === 'public') return send(200, { on: mode === 'on', ios: shops.ios === 'on', android: shops.android === 'on', founders_left: Math.max(0, 1000 - founders()) });
    const p = db.profiles.get(uid);
    if (!uid || !p) return send(401, { error: 'auth' });
    const admin = db.admins.has(uid), can = mode === 'on' || (mode === 'test' && admin), row = billing.get(uid) || null;
    const state = () => {
      const until = p.pro_until ? Date.parse(p.pro_until) : null, f = !!p.pro_founder, on = f || (until !== null && until > now()), row = billing.get(uid) || null;
      const pro = { on, founder: f, until: f ? null : until, plan: p.pro_plan || null, status: (row && row.status) || null, cancel: !!(row && row.cancel),
        trial: !!(row && row.trial), trialUsed: !!(row && row.trialUsed), sub: !!(row && row.sub), via: null };
      // (as the pay function's withStore: a store's purchase that runs longest speaks for the account)
      const st = storeOf(uid), stripeUntil = row && row.until ? row.until : null;
      if (f) pro.via = row && row.founder ? 'stripe' : st && st.kind === 'founder' ? st.store : null;
      else if (on) pro.via = st && st.kind === 'sub' && st.expires > now() && (stripeUntil === null || st.expires >= stripeUntil) ? st.store : 'stripe';
      if (pro.via && pro.via !== 'stripe' && st && st.kind === 'sub') Object.assign(pro, { status: 'active', cancel: st.cancel, trial: st.trial, sub: true });
      return { pro, can, test: mode === 'test' || undefined, foundersLeft: Math.max(0, 1000 - founders()), now: now() };
    };
    const origin = 'http://' + req.headers.host, back = typeof b.back === 'string' && b.back.startsWith(origin) ? b.back.split('#')[0].split('?')[0] : origin + '/';
    if (b.action === 'state') return send(200, state());
    if (b.action === 'checkout') {
      if (!['month', 'year', 'founder'].includes(b.plan)) return send(200, { error: 'bad_plan' });
      if (!can) return send(200, { error: 'off' });
      if (!accounts.emailOf.has(uid) || p.is_guest) return send(200, { error: 'guest' });
      if (b.plan === 'founder') { if (p.pro_founder) return send(200, { error: 'already' }); if (founders() >= 1000) return send(200, { error: 'sold_out' }); }
      else if (row && row.sub) return send(200, { already: true, url: origin + '/pay/portal?uid=' + encodeURIComponent(uid) + '&back=' + encodeURIComponent(back) });
      else { const st = storeOf(uid); if (st && st.kind === 'sub' && st.expires > now()) return send(200, { error: 'store_sub', store: st.store }); }
      const sid = 'cs_test_' + crypto.randomBytes(8).toString('hex');
      sessions.set(sid, { sid, uid, plan: b.plan, back, lang: b.lang || '', status: 'open', trial: b.plan === 'year' && !(row && row.trialUsed) });
      return send(200, { url: origin + '/pay/checkout?sid=' + sid });
    }
    if (b.action === 'confirm') {
      const s = sessions.get(String(b.sid || ''));
      if (!s) return send(200, { error: 'bad_session' });
      if (s.uid !== uid) return send(200, { error: 'not_yours' });
      return send(200, Object.assign(state(), { note: s.status === 'complete' ? 'applied' : 'not_complete' }));
    }
    if (b.action === 'portal') {
      if (!row || !row.customer) return send(200, { error: 'no_customer' });
      return send(200, { url: origin + '/pay/portal?uid=' + encodeURIComponent(uid) + '&back=' + encodeURIComponent(back) });
    }
    // what an app bought, or found again in its store: it goes on the caller's account (the last account to show a
    // purchase holds it), guests included
    if (b.action === 'store') {
      if (b.store !== 'apple' && b.store !== 'google') return send(200, { error: 'bad_store' });
      const list = b.store === 'apple' ? (Array.isArray(b.jws) ? b.jws : [b.jws]) : (Array.isArray(b.items) ? b.items : []).map((x) => x && x.token), notes = [];
      storeClaims.push({ uid, store: b.store, n: list.length, quiet: b.quiet === true, at: now() });
      if (db.storeDown) return send(500, { error: 'server' }); // (test hook: the pay function cannot reach the store)
      for (const text of list.slice(0, 25)) {
        const e = readPurchase(b.store, text);
        if (!e) { notes.push('refused'); continue; }
        const was = storeRows.get(e.id), old = was ? was.uid : null;
        const owner = b.quiet === true && old ? old : uid; // (a quiet look by the app: a purchase on file stays with whoever holds it)
        storeRows.set(e.id, Object.assign(e, { uid: owner }));
        proRefresh(owner); if (old && old !== owner) proRefresh(old); if (owner !== uid) proRefresh(uid);
        notes.push(e.pending ? 'pending' : e.refund ? 'revoked' : 'active ' + e.plan);
      }
      return send(200, Object.assign(state(), { notes }));
    }
    return send(200, { error: 'bad_action' });
  }
  // "Stripe's payment page": what is bought, Pay, Back
  if (req.method === 'GET' && u.pathname === '/pay/checkout') {
    const s = sessions.get(u.searchParams.get('sid') || '');
    res.writeHead(s ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    if (!s) return res.end('no such session');
    const price = { month: '$3.99 / month', year: s.trial ? '7 days free, then $29.99 / year' : '$29.99 / year', founder: '$79.99 once' }[s.plan];
    return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Payment page (stand-in)</title>' +
      '<body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px"><h1 style="font-size:20px">Stand-in for Stripe\'s payment page</h1><p id="what">Joker Pro, ' + s.plan + ': <b id="price">' + price + '</b></p>' +
      '<p><a id="pay" href="/pay/complete?sid=' + s.sid + '" style="display:inline-block;padding:12px 20px;background:#635bff;color:#fff;border-radius:8px;text-decoration:none">Pay</a> ' +
      '<a id="back" href="' + s.back + '?pro=back" style="margin-left:14px">Back</a></p></body>');
  }
  // paid (or the trial started): what the webhook would do to the account, then back to the game
  if (req.method === 'GET' && u.pathname === '/pay/complete') {
    const s = sessions.get(u.searchParams.get('sid') || ''), p = s && db.profiles.get(s.uid);
    if (!s || !p) { res.writeHead(404); return res.end('no such session'); }
    if (s.status !== 'complete') {
      s.status = 'complete';
      const row = billing.get(s.uid) || { customer: true };
      if (s.plan === 'founder') { p.pro_founder = true; p.pro_plan = 'founder'; row.sub = false; row.status = row.status ? 'canceled' : null; row.founder = true; }
      else {
        p.pro_until = iso(now() + (s.trial ? 7 : s.plan === 'year' ? 365 : 30) * 86400000); if (!p.pro_founder) p.pro_plan = s.plan;
        Object.assign(row, { sub: true, cancel: false, status: s.trial ? 'trialing' : 'active', trial: !!s.trial, trialUsed: !!(row.trialUsed || s.trial), until: Date.parse(p.pro_until), plan: s.plan });
      }
      billing.set(s.uid, row);
    }
    res.writeHead(302, { Location: s.back + '?pro=ok&sid=' + s.sid }); return res.end();
  }
  // "Stripe's page that manages a subscription": cancel (it then ends with the paid period), back to the game
  if (req.method === 'GET' && u.pathname === '/pay/portal') {
    const uid = u.searchParams.get('uid') || '', back = u.searchParams.get('back') || '/', row = billing.get(uid);
    if (u.searchParams.get('cancel') && row) { row.cancel = true; res.writeHead(302, { Location: back }); return res.end(); }
    portalVisits.push(uid);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end('<!doctype html><meta charset="utf-8"><title>Subscription page (stand-in)</title><body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px"><h1 style="font-size:20px">Stand-in for Stripe\'s subscription page</h1>' +
      '<p><a id="cancel" href="/pay/portal?uid=' + encodeURIComponent(uid) + '&back=' + encodeURIComponent(back) + '&cancel=1">Cancel the subscription</a></p><p><a id="back" href="' + back + '">Back to the game</a></p></body>');
  }
  // a player's finished games, newest first (the page reads them straight from the games table on Supabase)
  if (req.method === 'POST' && u.pathname === '/history') {
    const b = await readBody(req);
    let rows = [...db.games.values()].filter((g) => g.status === 'over' && b.token && (g.white_id === b.token || g.black_id === b.token));
    if (b.opp) rows = rows.filter((g) => g.white_id === b.opp || g.black_id === b.opp);
    if (b.before) rows = rows.filter((g) => g.updated_at < b.before);
    rows.sort((x, y) => (x.updated_at < y.updated_at ? 1 : x.updated_at > y.updated_at ? -1 : 0));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ games: rows.slice(0, b.limit || 50).map(clone) }));
    return;
  }
  // a player deletes their own account (delete_my_account() on Supabase)
  if (req.method === 'POST' && u.pathname === '/delete') {
    const b = await readBody(req), uid = b.token;
    const send = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (!uid) return send(401, { error: 'not_signed_in' });
    if ([...db.games.values()].some((g) => g.status === 'playing' && (g.white_id === uid || g.black_id === uid))) return send(400, { error: 'live_game' });
    { const bl = billing.get(uid); if (bl && bl.sub && !bl.cancel) return send(400, { error: 'active_subscription' }); }
    for (const g of db.games.values()) {
      if (g.status === 'waiting' && g.host_id === uid) Object.assign(g, { status: 'aborted', result: '*', reason: 'abort' });
      for (const k of ['white_id', 'black_id', 'host_id']) if (g[k] === uid) g[k] = null;
    }
    db.profiles.delete(uid); db.seeks.delete(uid);
    for (const k of [...db.ratings.keys()]) if (k.startsWith(uid + '|')) db.ratings.delete(k);
    const email = accounts.emailOf.get(uid); accounts.emailOf.delete(uid); if (email) accounts.uidOf.delete(email);
    return send(200, { ok: true });
  }
  // the score against each opponent over all finished games (head_to_head() on Supabase)
  if (req.method === 'POST' && u.pathname === '/h2h') {
    const b = await readBody(req), me = b.token, by = new Map();
    const rows = [...db.games.values()].filter((g) => g.status === 'over' && me && (g.white_id === me || g.black_id === me))
      .sort((x, y) => (x.updated_at < y.updated_at ? 1 : x.updated_at > y.updated_at ? -1 : 0));
    for (const g of rows) {
      const white = g.white_id === me, opp = white ? g.black_id : g.white_id;
      const r = g.result === '1/2-1/2' ? 0 : (g.result === '1-0') === white ? 1 : -1;
      const o = by.get(opp) || { opp_id: opp, opp_name: white ? g.black_name : g.white_name, wins: 0, draws: 0, losses: 0, games: 0, last_at: g.updated_at };
      o.games++; if (r === 1) o.wins++; else if (r === 0) o.draws++; else o.losses++;
      by.set(opp, o);
    }
    const out = [...by.values()].sort((x, y) => y.games - x.games || (x.last_at < y.last_at ? 1 : -1));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rows: out }));
    return;
  }
  if (req.method === 'POST' && u.pathname === '/auth') {
    const { status, body } = authOp(await readBody(req));
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }
  // avatars (Supabase Storage's stand-in): the picture goes up as base64, comes back as a JPEG
  if (req.method === 'POST' && u.pathname === '/avatar') {
    const b = await readBody(req);
    if (b.remove) avatars.delete(b.token); else if (typeof b.data === 'string' && b.data.length < 800000) avatars.set(b.token, Buffer.from(b.data, 'base64'));
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
    return;
  }
  if (req.method === 'GET' && u.pathname.startsWith('/avatar/')) {
    const img = avatars.get(decodeURIComponent(u.pathname.slice(8)));
    if (!img) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }); res.end(img);
    return;
  }
  // several players' names and pictures at once (profiles are public on Supabase)
  if (req.method === 'POST' && u.pathname === '/profiles') {
    const b = await readBody(req), rows = (Array.isArray(b.uids) ? b.uids : []).map((id) => db.profiles.get(id)).filter(Boolean)
      .map((p) => ({ id: p.id, username: p.username, avatar_v: p.avatar_v || 0, xp: p.xp || 0, pro_until: p.pro_until || null, pro_founder: !!p.pro_founder }));
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ rows }));
    return;
  }
  // a player's page (profiles and ratings are public on Supabase)
  if (req.method === 'POST' && u.pathname === '/player') {
    const b = await readBody(req), p = db.profiles.get(b.uid) || null;
    const profile = p ? { id: p.id, username: p.username, created_at: p.created_at, house: !!p.house, avatar_v: p.avatar_v || 0, xp: p.xp || 0, pro_until: p.pro_until || null, pro_founder: !!p.pro_founder } : null;
    const ratings = [...db.ratings.values()].filter((r) => r.user_id === b.uid).map(({ pool, rating, rd, games, wins, draws, losses }) => ({ pool, rating, rd, games, wins, draws, losses }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ profile, ratings }));
    return;
  }
  // presence track / untrack (the app went to the background or came back)
  if (req.method === 'POST' && u.pathname === '/presence') {
    const b = await readBody(req), set = subs.get(b.topic);
    if (set) { for (const c of set) if (c.uid === b.token) c.away = !!b.away; presence(b.topic); }
    res.writeHead(202); res.end();
    return;
  }
  // peer-to-peer broadcast (Realtime "m:<game>" topic): only players of that game may send, never to themselves
  if (req.method === 'POST' && u.pathname === '/peer') {
    const b = await readBody(req);
    const g = typeof b.topic === 'string' && b.topic.startsWith('m:') ? db.games.get(b.topic.slice(2)) : null;
    const allowed = !!g && !!b.token && (g.white_id === b.token || g.black_id === b.token);
    if (allowed && !dropBroadcasts && !dropPeer) {
      const set = subs.get(b.topic);
      if (set) for (const c of set) if (c.uid !== b.token) send(c.res, b.event, b.payload);
    }
    res.writeHead(allowed ? 202 : 403); res.end();
    return;
  }
  if (req.method === 'POST' && u.pathname === '/admin') {
    const b = await readBody(req);
    let out = { ok: true };
    if (b.op === 'shift') shift += b.ms || 0;
    else if (b.op === 'drop') dropBroadcasts = !!b.on;
    else if (b.op === 'droppeer') dropPeer = !!b.on;
    else if (b.op === 'latency') extraLatency = +b.ms || 0;
    else if (b.op === 'game') out = clone(db.games.get(b.game) || null);
    else if (b.op === 'games') out = [...db.games.values()].map(clone);
    else if (b.op === 'ratings') out = [...db.ratings.values()].map(clone);
    else if (b.op === 'profiles') out = [...db.profiles.values()].map(clone);
    else if (b.op === 'addhouse') out = { id: addHouse(b) };   // a house player: { name, level, target, style, online_from, online_hours }
    else if (b.op === 'addadmin') db.admins.add(b.uid);
    else if (b.op === 'promode') db.proMode = b.mode;            // Joker Pro: 'off' | 'test' | 'on' (billing_config's mode)
    else if (b.op === 'pro') {                                   // a player's Pro set straight: { uid, days (from now; negative: ended), founder, plan, sub, cancel, trialUsed, status }
      const p = db.profiles.get(b.uid);
      if (p) { p.pro_until = b.days == null ? null : iso(now() + b.days * 86400000); p.pro_founder = !!b.founder; p.pro_plan = b.founder ? 'founder' : b.plan || (b.days != null ? 'year' : null); }
      billing.set(b.uid, { sub: !!b.sub, cancel: !!b.cancel, trialUsed: !!b.trialUsed, status: b.status || (b.sub ? 'active' : null), trial: !!b.trial, customer: true,
        until: p && p.pro_until ? Date.parse(p.pro_until) : null, plan: p ? p.pro_plan : null, founder: !!b.founder });
      out = { profile: clone(p), billing: billing.get(b.uid) };
    }
    else if (b.op === 'prostores') db.proStores = { ios: b.ios || 'off', android: b.android || 'off' }; // may the apps sell: 'off' | 'test' | 'on' each (billing_config's stores)
    else if (b.op === 'storedown') db.storeDown = !!b.on;        // the pay function cannot reach the store
    else if (b.op === 'storelog') out = { rows: [...storeRows.values()].map(clone), claims: storeClaims.slice() };
    else if (b.op === 'storeend') {                              // a store's purchase ends (expired, refunded): { id }
      const r = storeRows.get(b.id); if (r) { r.expires = now() - 3600000; r.refund = !!b.refund; proRefresh(r.uid); } // (an hour ago: past the ten minutes a device waits for a renewal)
      out = { row: clone(r || null) };
    }
    else if (b.op === 'founders') founderBase = +b.n || 0;        // Founder places already taken by others
    else if (b.op === 'paylog') out = { sessions: [...sessions.values()].map(clone), portal: portalVisits.slice() };
    else if (b.op === 'forgetgames') { for (const g of db.games.values()) if (g.status === 'over') g.updated_at = iso(now() - 3600000); } // the finished games are an hour old (the search keeps just-met players apart)
    else if (b.op === 'rate') {                                  // a rating row for a player (tests of the leaderboard): { uid, pool, rating, games, wins, draws, losses }
      const t = new Date(now()).toISOString();
      db.ratings.set(b.uid + '|' + b.pool, { user_id: b.uid, pool: b.pool, rating: +b.rating, rd: b.rd || 80, vol: 0.06, games: b.games || 1, wins: b.wins || 0, draws: b.draws || 0, losses: b.losses || 0, updated_at: t });
    }
    else if (b.op === 'stats') {                                 // admin_stats() in memory (the shape the Profile card draws)
      if (!db.admins.has(b.token)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'not_admin' })); return; }
      const t = now(), day = (x) => new Date(x).toISOString().slice(0, 10), over = [...db.games.values()].filter((g) => g.status === 'over');
      const human = (u) => db.profiles.has(u) && !db.profiles.get(u).house, players = (gs) => new Set(gs.flatMap((g) => [g.white_id, g.black_id]).filter(human)).size;
      const since = (d) => over.filter((g) => Date.parse(g.updated_at) > t - d * 86400000);
      const profs = [...db.profiles.values()].filter((p) => !p.house), days = [];
      for (let i = 30; i >= 0; i--) { const d = day(t - i * 86400000); const gs = over.filter((g) => day(Date.parse(g.updated_at)) === d); days.push({ d, games: gs.length, new: profs.filter((p) => day(Date.parse(p.created_at)) === d).length, players: players(gs) }); }
      const seen = new Map(); over.forEach((g) => [g.white_id, g.black_id].filter(human).forEach((u) => { if (!seen.has(u)) seen.set(u, new Set()); seen.get(u).add(day(Date.parse(g.updated_at))); }));
      out = { accounts: profs.length, registered: profs.filter((p) => !p.is_guest).length, guests: profs.filter((p) => p.is_guest).length, house: db.house.size,
        methods: { email: [...accounts.emailOf.keys()].filter(human).length }, new7: profs.filter((p) => Date.parse(p.created_at) > t - 7 * 86400000).length, new30: profs.length,
        games: over.length, games7: since(7).length, games30: since(30).length, games_house30: since(30).filter((g) => g.house).length, live: [...db.games.values()].filter((g) => g.status === 'playing').length,
        active7: players(since(7)), active30: players(since(30)), returned: [...seen.values()].filter((s) => s.size >= 2).length,
        pools: since(30).reduce((a, g) => (a[g.pool] = (a[g.pool] || 0) + 1, a), {}), days };
      // the day log (activity): people a day by platform, retention, cohorts, what was done this week
      const act = [...(db.activity || new Map()).values()].filter((a) => human(a.user_id) && !db.admins.has(a.user_id)), people = profs.filter((p) => !db.admins.has(p.id));
      const on = (u, d) => act.some((a) => a.user_id === u && a.day === d), plus = (d, n) => day(Date.parse(d) + n * 86400000), today = day(t);
      out.dau = []; for (let i = 13; i >= 0; i--) { const d = day(t - i * 86400000), rows = act.filter((a) => a.day === d); out.dau.push({ d, n: rows.length, ios: rows.filter((a) => a.platform === 'ios').length, android: rows.filter((a) => a.platform === 'android').length, web: rows.filter((a) => a.platform === 'web').length }); }
      const first = (p) => day(Date.parse(p.created_at)), rate = (k, test) => { const base = people.filter((p) => plus(first(p), k) <= today); return { n: base.filter(test).length, of: base.length }; };
      out.ret = { d1: rate(1, (p) => on(p.id, plus(first(p), 1))), d7: rate(7, (p) => on(p.id, plus(first(p), 7))), back: rate(1, (p) => act.some((a) => a.user_id === p.id && a.day > first(p))) };
      const byDay = new Map(); people.forEach((p) => { const c = first(p); if (!byDay.has(c)) byDay.set(c, []); byDay.get(c).push(p); });
      out.cohorts = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, ps]) => ({ d, size: ps.length, d1: ps.filter((p) => on(p.id, plus(d, 1))).length, d7: ps.filter((p) => on(p.id, plus(d, 7))).length, back: ps.filter((p) => act.some((a) => a.user_id === p.id && a.day > d)).length }));
      out.kinds7 = {}; act.filter((a) => a.day > day(t - 7 * 86400000)).forEach((a) => a.kinds.forEach((k) => { out.kinds7[k] = (out.kinds7[k] || 0) + 1; }));
    }
    else if (b.op === 'house') out = [...db.house.values()].map(clone);
    else if (b.op === 'outbox') out = accounts.outbox.filter((m) => !b.to || m.to === b.to);
    else if (b.op === 'addgames') {
      // older copies of a finished game with the given results (long histories without playing them)
      const src = db.games.get(b.from), t0 = Date.parse(src.updated_at);
      b.results.forEach((r, k) => {
        const t = t0 - (k + 1) * 60000, g = Object.assign(clone(src), { id: crypto.randomUUID(), result: r, reason: 'resign', created_at: iso(t - 300000), updated_at: iso(t) });
        db.games.set(g.id, g);
      });
      out = { added: b.results.length };
    }
    else if (b.op === 'setclock') {
      const g = db.games.get(b.game);
      // keep the running side's clock running: restart its turn now
      Object.assign(g, { clock_w: b.clock_w ?? g.clock_w, clock_b: b.clock_b ?? g.clock_b, version: g.version + 1, updated_at: iso(now()) });
      if (g.moves.length >= 2) g.turn_started_at = iso(now());
      await broadcast('g:' + g.id, 'state', Object.assign(clone(g), { now: now() }));
      out = clone(g);
    } else if (b.op === 'reset') {
      delete db.proMode; delete db.proStores; delete db.storeDown; billing.clear(); sessions.clear(); portalVisits.length = 0; founderBase = 0; storeRows.clear(); storeClaims.length = 0;
      for (const k of Object.keys(db)) db[k].clear();
      for (const k of ['emailOf', 'uidOf', 'pending', 'lastSent']) accounts[k].clear();
      accounts.outbox.length = 0;
      shift = 0; dropBroadcasts = false; dropPeer = false;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, '127.0.0.1', () => console.log('mock server on http://127.0.0.1:' + PORT));
