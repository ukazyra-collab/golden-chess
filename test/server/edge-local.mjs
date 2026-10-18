// Runs the production edge function (supabase/functions/play/index.ts) under Deno, locally:
//   Postgres  -> PGlite behind a socket, with the production migration applied
//   Auth      -> a fake JWKS endpoint; tokens are ES256 JWTs signed here (same path as Supabase's asymmetric keys)
//   Realtime  -> a fake broadcast endpoint that records what the function sends
// Then plays a short game through plain HTTP the way the browser does (text/plain body, token in the body).
// Run: DENO=/path/to/deno node test/server/edge-local.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createDb } from './pg-harness.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const DENO = process.env.DENO || 'deno';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

// ---- Postgres (production migrations on top of stand-ins for Supabase's auth and realtime schemas)
const A = 'aaaaaaaa-0000-4000-8000-00000000000a', B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const pg = await createDb([A, B]);
const pgServer = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 8 });
await pgServer.start();
const pgPort = pgServer.server ? pgServer.server.address().port : pgServer.port;

// ---- fake Supabase: JWKS + realtime broadcast sink
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'ES256', use: 'sig' });
const b64u = (b) => Buffer.from(b).toString('base64url');
function token(sub) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' }));
  const body = b64u(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, iss: ISS(), is_anonymous: true }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}
const broadcasts = [];
let ISS = () => 'http://127.0.0.1/auth/v1';
const legacyTok = (sub) => b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iss: ISS() })) + '.c2ln';
const fake = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    if (req.url.startsWith('/auth/v1/.well-known/jwks.json')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ keys: [jwk] })); return; }
    if (req.url.startsWith('/auth/v1/user')) {
      const tok = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
      if (tok === legacyTok(B)) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ id: B })); return; }
      res.writeHead(401); res.end('{}'); return;
    }
    if (req.url.startsWith('/realtime/v1/api/broadcast')) { broadcasts.push(JSON.parse(data)); res.writeHead(202); res.end(); return; }
    res.writeHead(404); res.end();
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const fakeUrl = 'http://127.0.0.1:' + fake.address().port;
ISS = () => fakeUrl + '/auth/v1';

// ---- the edge function under Deno
const fnPort = 18000 + Math.floor(Math.random() * 1000);
const env = Object.assign({}, process.env, { SUPABASE_URL: fakeUrl, SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_DB_URL: `postgres://postgres:x@127.0.0.1:${pgPort}/postgres`, PG_POOL_MAX: '1', // PGlite serves one connection at a time
  DENO_DIR: process.env.DENO_DIR || '' });
const wrapper = `Deno.serve = ((orig) => (h) => orig({ port: ${fnPort}, hostname: '127.0.0.1', onListen() {} }, h))(Deno.serve);\nawait import('${ROOT}supabase/functions/play/index.ts');\n`;
fs.writeFileSync('/tmp/gc-edge-wrapper.ts', wrapper);
const deno = spawn(DENO, ['run', '-A', '--no-lock', '/tmp/gc-edge-wrapper.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
deno.stdout.on('data', (d) => (logs += d)); deno.stderr.on('data', (d) => (logs += d));

const BASE = `http://127.0.0.1:${fnPort}/play?forceFunctionRegion=eu-central-1`;
async function call(tok, body, opts = {}) {
  const r = await fetch(BASE, { method: 'POST', headers: opts.headers || { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(Object.assign({}, body, tok ? { token: tok } : {})) });
  return { status: r.status, body: await r.json(), timing: r.headers.get('server-timing'), cors: r.headers.get('access-control-allow-origin'), expose: r.headers.get('access-control-expose-headers') };
}
let up = false;
for (let i = 0; i < 120 && !up; i++) { try { await fetch(`http://127.0.0.1:${fnPort}/`, { method: 'OPTIONS' }); up = true; } catch { await new Promise((r) => setTimeout(r, 250)); } }
check('function boots under Deno', up, logs.slice(-2000));

try {
  const ta = token(A), tb = token(B);
  let r = await call(null, { action: 'hello' });
  check('no token -> 401', r.status === 401 && r.body.error === 'auth', r);
  r = await call('garbage', { action: 'hello' });
  check('bad token -> 401', r.status === 401, r);
  r = await call(ta, { action: 'hello' });
  check('hello A', r.status === 200 && r.body.profile && r.body.profile.id === A, r);
  check('CORS + timing headers', r.cors === '*' && /auth;dur=.*db;dur=.*total;dur=.*worker;desc=/.test(r.timing) && r.expose === 'Server-Timing', r);
  r = await call(null, { action: 'hello' }, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tb } });
  check('hello B (Authorization header also accepted)', r.status === 200 && r.body.profile && r.body.profile.id === B, r);
  r = await call(ta, { action: 'challenge', tc: '3+2', rated: true, color: 'w' });
  const gid = r.body.game && r.body.game.id;
  check('challenge created', r.status === 200 && r.body.game.status === 'waiting', r);
  r = await call(tb, { action: 'join', game: gid });
  check('join -> playing, A white', r.body.game && r.body.game.status === 'playing' && r.body.game.white_id === A, r);
  const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'];
  for (let i = 0; i < moves.length; i++) {
    r = await call(i % 2 ? tb : ta, { action: 'move', game: gid, uci: moves[i], ply: i });
    if (r.status !== 200 || r.body.error) break;
  }
  check('six moves accepted', r.body.game && r.body.game.moves.length === 6, r);
  // instant moves: each side got its 2 s increment twice once the clock started (after move 2)
  check('server clock running after two moves', r.body.game && !!r.body.game.turn_started_at && r.body.game.clock_w === 184000 && r.body.game.clock_b === 184000, r.body.game);
  r = await call(tb, { action: 'move', game: gid, uci: 'a7a6', ply: 6 });
  check('out-of-turn move refused softly (200 + error)', r.status === 200 && r.body.error === 'not_your_turn', r);
  r = await call(ta, { action: 'move', game: gid, uci: 'e1e8', ply: 6 });
  check('illegal move refused', r.body.error === 'illegal', r);
  r = await call(ta, { action: 'move', game: gid, uci: 'c4f7*', ply: 6 });
  check('golden move onto an occupied square refused', r.body.error === 'illegal', r);
  r = await call(ta, { action: 'move', game: gid, uci: 'c4a6*', ply: 6 });
  check('golden move accepted', r.body.game && r.body.game.sans[6] === 'Bc4★a6', r.body.game && r.body.game.sans);
  r = await call(tb, { action: 'resign', game: gid });
  check('resign -> over, rated', r.body.game && r.body.game.status === 'over' && r.body.game.result === '1-0' && r.body.game.white_diff > 0 && r.body.game.black_diff < 0, r.body.game);
  await new Promise((res) => setTimeout(res, 300));
  const topics = broadcasts.flatMap((b) => b.messages.map((m) => m.topic + ':' + m.event + ':' + m.private));
  check('broadcasts sent on private game topic', topics.filter((t) => t === 'g:' + gid + ':state:true').length >= 8, topics);
  check('host told about the pairing', topics.includes('u:' + A + ':paired:true'), topics);
  const row = gid ? (await pg.query('select status, version, array_length(moves, 1) as n from public.games where id = $1', [gid])).rows[0] : null;
  check('database row matches', !!row && row.status === 'over' && row.n === 7, row);
  const rat = (await pg.query('select count(*)::int as n from public.ratings')).rows[0].n;
  check('ratings written', rat === 2, rat);
  // timing sample
  const t = [];
  for (let i = 0; i < 5; i++) { const s = Date.now(); r = await call(ta, { action: 'game', game: gid }); t.push(Date.now() - s); }
  console.log('local round trips (ms):', t.join(' '), '| last Server-Timing:', r.timing);
  check('token verified once, then served from the cache', /auth;dur=[\d.]+;desc="cached"/.test(r.timing), r.timing);
  // an expired token is refused even if it was cached
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' }));
  const body = b64u(JSON.stringify({ sub: A, role: 'authenticated', iat: now - 7200, exp: now - 3600 }));
  const expired = head + '.' + body + '.' + b64u(crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privateKey, dsaEncoding: 'ieee-p1363' }));
  r = await call(expired, { action: 'hello' });
  check('expired token refused', r.status === 401, r);
  const forged = head + '.' + b64u(JSON.stringify({ sub: B, role: 'authenticated', exp: now + 3600 })) + '.' + b64u(Buffer.alloc(64, 1));
  r = await call(forged, { action: 'hello' });
  check('forged signature refused', r.status === 401, r);
  r = await call(legacyTok(B), { action: 'hello' });
  check('legacy symmetric token checked by the auth server', r.status === 200 && r.body.profile && r.body.profile.id === B && /desc="auth-server"/.test(r.timing), r);
  r = await call(legacyTok(A), { action: 'hello' });
  check('legacy token the auth server rejects is refused', r.status === 401, r);
} finally {
  deno.kill();
  fake.close();
  await pgServer.stop();
  await pg.close();
}
if (fail) console.log(logs.slice(-3000));
console.log(`edge function under Deno: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
