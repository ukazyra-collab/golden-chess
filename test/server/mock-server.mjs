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

const { repo, db } = createMemoryRepo(now);

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
  const uids = [...new Set([...set].map((c) => c.uid))];
  for (const c of set) send(c.res, 'presence', uids);
}

const logic = createLogic({ repo, broadcast, GC, now });

// ---- "Supabase Auth": a guest links an email (same account), or an email signs in (existing or new account).
// Same answers as the real service: 422 email_exists / otp_disabled, 403 otp_expired, 429 when a code is
// requested again within a minute.
const accounts = { emailOf: new Map(), uidOf: new Map(), pending: new Map(), lastSent: new Map(), outbox: [] };
const OTP_TTL = 10 * 60000, RESEND_MS = 60000;
const REVIEW = { email: 'review@golden-chess.com', password: 'review-test-pass' }; // the stores' review account (test only)
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
  if (b.op === 'whoami') { const e = accounts.emailOf.get(uid) || null; return { status: 200, body: { uid, email: e, guest: !e } }; }
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
    if (!id) { id = 'u' + crypto.randomUUID().slice(0, 8); accounts.emailOf.set(id, email); accounts.uidOf.set(email, id); }
    return { status: 200, body: { uid: id, email } };
  }
  if (b.op === 'verify') { // verifyOtp({ email, token, type })
    const p = accounts.pending.get(email), type = b.type === 'email_change' ? 'email_change' : 'email';
    if (!p || p.code !== String(b.code) || p.type !== type || now() - p.at > OTP_TTL || (type === 'email_change' && p.uid !== uid)) return { status: 403, body: { error: 'otp_expired' } };
    accounts.pending.delete(email);
    accounts.emailOf.set(p.uid, email); accounts.uidOf.set(email, p.uid);
    return { status: 200, body: { uid: p.uid, email } };
  }
  return { status: 400, body: { error: 'bad_op' } };
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
    const auth = token ? Promise.resolve({ sub: token, guest: !accounts.emailOf.has(token) }) : Promise.reject({ code: 'auth' });
    const delay = +(process.env.MOCK_LATENCY || 0) + extraLatency;
    if (delay) await new Promise((r) => setTimeout(r, delay / 2));
    const { status, body: out } = await logic.handle(auth, body);
    if (delay) await new Promise((r) => setTimeout(r, delay / 2));
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
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
