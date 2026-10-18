// Golden Chess game server (Supabase Edge Function). HTTP, auth, storage and realtime wiring only;
// the game logic lives in logic.js and is shared with the local test server.
//
// Hosted edge workers are often fresh for every request, so the cold path is what counts:
// - no supabase-js: tokens are verified with WebCrypto against the project's public signing key
//   (bundled below; the live JWKS is fetched only for an unknown key id, e.g. after a key rotation);
// - storage goes straight to Postgres (postgres.js over SUPABASE_DB_URL), connecting while the request
//   is being parsed and authorized;
// - clients send CORS-simple requests (text/plain body with the token inside), so browsers skip the preflight.
// Every response carries a Server-Timing header (body, auth, db, total, worker).
import postgres from 'npm:postgres@3.4.9';
import GC from './core.js';
import { createLogic, CORS } from './logic.js';
import { createPgRepo } from './pgrepo.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || SERVICE_KEY;
const DB_URL = Deno.env.get('SUPABASE_DB_URL');
const ISSUER = SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1';

// ---- storage
const sql = DB_URL ? postgres(DB_URL, { prepare: false, max: +(Deno.env.get('PG_POOL_MAX') || 4), idle_timeout: 120, connect_timeout: 6, onnotice: () => {} }) : null;
const pgRepo = sql ? createPgRepo(sql) : null;
const t0module = performance.now();
let tConnect = -1;
const pgReady: Promise<boolean> = sql
  ? sql`select 1`.then(() => { tConnect = performance.now() - t0module; return true; }, (e: unknown) => { console.error('pg connect failed', String(e)); return false; })
  : Promise.resolve(false);

// per-request view of the repo that adds up time spent in the database
// deno-lint-ignore no-explicit-any
function timed(repo: any, acc: { db: number; n: number }) {
  // deno-lint-ignore no-explicit-any
  const out: any = {};
  for (const k of Object.keys(repo)) {
    // deno-lint-ignore no-explicit-any
    out[k] = async (...args: any[]) => {
      const t = performance.now();
      try { return await repo[k](...args); } finally { acc.db += performance.now() - t; acc.n++; }
    };
  }
  return out;
}

// ---- realtime
async function broadcast(topic: string, event: string, payload: unknown) {
  try {
    const r = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }),
    });
    if (!r.ok) console.error('broadcast', r.status, await r.text());
  } catch (e) { console.error('broadcast', e); }
}
// deno-lint-ignore no-explicit-any
const background = (p: Promise<unknown>) => { const rt = (globalThis as any).EdgeRuntime; if (rt && rt.waitUntil) rt.waitUntil(p); else p.catch(() => {}); };

// ---- auth: Supabase access tokens (ES256 JWTs)
// The project's public signing key (public by definition: served at /auth/v1/.well-known/jwks.json).
// Tokens signed with another key id are checked against the live JWKS. If this key is ever revoked, tokens it
// signed keep working here until they expire (an hour), which is acceptable for a game server.
const BUNDLED_JWKS = [
  { kty: 'EC', crv: 'P-256', kid: '8f1d5c83-1f13-43e4-96bd-2a645387c33c',
    x: 'srMq_5NETMVHl2GHg5KVqMSTUImvSA6WMABYJRM-5rc', y: 'Wg04I6PSSqJUH4WQWb1bhR809NkSz4S_Fywy34XIhzA' },
];
type Jwk = { kty: string; crv: string; kid: string; x: string; y: string };
const keys = new Map<string, Promise<CryptoKey | null>>();
const importKey = (k: Jwk) => crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: k.x, y: k.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
function keyFor(kid: string): Promise<CryptoKey | null> {
  let p = keys.get(kid);
  if (!p) {
    const known = BUNDLED_JWKS.find((k) => k.kid === kid);
    p = known ? importKey(known) : fetch(`${ISSUER}/.well-known/jwks.json`, { headers: { apikey: ANON_KEY } })
      .then((r) => r.json())
      .then((j: { keys?: Jwk[] }) => { const k = (j.keys || []).find((x) => x.kid === kid && x.kty === 'EC' && x.crv === 'P-256'); return k ? importKey(k) : null; })
      .catch(() => null);
    keys.set(kid, p);
    p.then((k) => { if (!k) keys.delete(kid); });
  }
  return p;
}
function b64u(s: string): Uint8Array<ArrayBuffer> {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t), out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const AUTH = { code: 'auth' };
const verified = new Map<string, { sub: string; exp: number }>();
async function userId(token: string): Promise<{ sub: string; how: string }> {
  if (!token) throw AUTH;
  const hit = verified.get(token);
  if (hit) {
    if (hit.exp * 1000 > Date.now()) return { sub: hit.sub, how: 'cached' };
    verified.delete(token);
    throw AUTH;
  }
  const parts = token.split('.');
  if (parts.length !== 3) throw AUTH;
  // deno-lint-ignore no-explicit-any
  let header: any, claims: any;
  try {
    header = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  } catch { throw AUTH; }
  if (!claims || typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw AUTH;
  if (claims.role !== 'authenticated' || (typeof claims.iss === 'string' && !/\/auth\/v1$/.test(claims.iss))) throw AUTH;
  let how = 'verified';
  if (header && header.alg === 'ES256' && typeof header.kid === 'string') {
    const key = await keyFor(header.kid);
    if (!key) throw AUTH;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) throw AUTH;
  } else {
    // a legacy symmetric token: only the auth server can check it
    const r = await fetch(`${ISSUER}/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw AUTH;
    const u = await r.json().catch(() => null);
    if (!u || u.id !== claims.sub) throw AUTH;
    how = 'auth-server';
  }
  if (verified.size >= 5000) verified.delete(verified.keys().next().value as string);
  verified.set(token, { sub: claims.sub, exp: claims.exp });
  return { sub: claims.sub, how };
}

// ---- HTTP
const HEADERS = { ...CORS, 'Content-Type': 'application/json', 'Timing-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Server-Timing' };
const WORKER = crypto.randomUUID().slice(0, 8);
let served = 0;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const t0 = performance.now(), nth = ++served;
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = JSON.parse((await req.text()) || '{}'); } catch { body = {}; }
  if (!body || typeof body !== 'object') body = {};
  const tBody = performance.now() - t0;
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || (typeof body.token === 'string' ? body.token : '');
  delete body.token; delete body.via;
  let tAuth = 0, how = 'none';
  const ta = performance.now();
  const authP = userId(token).then((r) => { how = r.how; return r.sub; }).finally(() => { tAuth = performance.now() - ta; });
  const acc = { db: 0, n: 0 };
  let status: number, out: unknown;
  if (!pgRepo || !(await pgReady)) {
    authP.catch(() => {});
    status = 503; out = { error: 'unavailable' };
  } else {
    const logic = createLogic({ repo: timed(pgRepo, acc), broadcast, GC, background });
    ({ status, body: out } = await logic.handle(authP, body));
  }
  const total = performance.now() - t0;
  const timing = `body;dur=${tBody.toFixed(1)}, auth;dur=${tAuth.toFixed(1)};desc="${how}", db;dur=${acc.db.toFixed(1)};desc="${acc.n} queries", ` +
    `total;dur=${total.toFixed(1)}, worker;desc="${WORKER} #${nth}${tConnect >= 0 ? ' pg ' + tConnect.toFixed(0) + 'ms' : ''}"`;
  return new Response(JSON.stringify(out), { status, headers: { ...HEADERS, 'Server-Timing': timing } });
});
