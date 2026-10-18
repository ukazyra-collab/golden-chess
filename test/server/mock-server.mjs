// Local stand-in for the Supabase backend: the same game logic (supabase/functions/play/logic.js) over an
// in-memory store, Server-Sent Events instead of Realtime, and a few test hooks under /admin.
// Usage: node test/server/mock-server.mjs [port]   (serves dist/mock/index.html at /)
import http from 'node:http';
import fs from 'node:fs';
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
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const auth = token ? Promise.resolve(token) : Promise.reject({ code: 'auth' });
    const delay = +(process.env.MOCK_LATENCY || 0);
    if (delay) await new Promise((r) => setTimeout(r, delay / 2));
    const { status, body: out } = await logic.handle(auth, body);
    if (delay) await new Promise((r) => setTimeout(r, delay / 2));
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }
  if (req.method === 'POST' && u.pathname === '/admin') {
    const b = await readBody(req);
    let out = { ok: true };
    if (b.op === 'shift') shift += b.ms || 0;
    else if (b.op === 'drop') dropBroadcasts = !!b.on;
    else if (b.op === 'game') out = clone(db.games.get(b.game) || null);
    else if (b.op === 'games') out = [...db.games.values()].map(clone);
    else if (b.op === 'ratings') out = [...db.ratings.values()].map(clone);
    else if (b.op === 'setclock') {
      const g = db.games.get(b.game);
      // keep the running side's clock running: restart its turn now
      Object.assign(g, { clock_w: b.clock_w ?? g.clock_w, clock_b: b.clock_b ?? g.clock_b, version: g.version + 1, updated_at: iso(now()) });
      if (g.moves.length >= 2) g.turn_started_at = iso(now());
      await broadcast('g:' + g.id, 'state', Object.assign(clone(g), { now: now() }));
      out = clone(g);
    } else if (b.op === 'reset') { for (const k of Object.keys(db)) db[k].clear(); shift = 0; dropBroadcasts = false; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, '127.0.0.1', () => console.log('mock server on http://127.0.0.1:' + PORT));
