// Golden Chess game server (Supabase Edge Function). HTTP, storage and realtime wiring only;
// the game logic lives in logic.js and is shared with the local test server.
//
// Latency notes:
// - Storage goes straight to Postgres (postgres.js over SUPABASE_DB_URL), with the REST API as a fallback.
// - Clients send "simple" CORS requests (text/plain body, token inside the body, region in the query string),
//   so browsers never wait for a preflight.
// - Every response carries a Server-Timing header (auth, db, total).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import postgres from 'npm:postgres@3.4.9';
import GC from './core.js';
import { createLogic, CORS } from './logic.js';
import { createPgRepo } from './pgrepo.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DB_URL = Deno.env.get('SUPABASE_DB_URL');
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// deno-lint-ignore no-explicit-any
async function one(q: PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await q;
  if (error) throw new Error(error.message || String(error));
  return data;
}

// ---- storage over the REST API (fallback)
const restRepo = {
  getGame: (id: string) => one(db.from('games').select('*').eq('id', id).maybeSingle()),
  updateGame: (id: string, version: number, patch: Record<string, unknown>) =>
    one(db.from('games').update(patch).eq('id', id).eq('version', version).select().maybeSingle()),
  setGameFields: (id: string, patch: Record<string, unknown>) => one(db.from('games').update(patch).eq('id', id).select().maybeSingle()),
  insertGame: (row: Record<string, unknown>) => one(db.from('games').insert(row).select().single()),
  getProfile: (uid: string) => one(db.from('profiles').select('*').eq('id', uid).maybeSingle()),
  insertProfile: async (uid: string, name: string) => {
    const { data, error } = await db.from('profiles').insert({ id: uid, username: name }).select().maybeSingle();
    if (error) { if (error.code === '23505') return null; throw new Error(error.message); }
    return data;
  },
  renameProfile: async (uid: string, name: string) => {
    const { data, error } = await db.from('profiles').update({ username: name }).eq('id', uid).select().maybeSingle();
    if (error) { if (error.code === '23505') return { taken: true }; throw new Error(error.message); }
    return { row: data };
  },
  getRating: (uid: string, pool: string) => one(db.from('ratings').select('*').eq('user_id', uid).eq('pool', pool).maybeSingle()),
  getRatings: (uid: string) => one(db.from('ratings').select('pool,rating,rd,games,wins,draws,losses').eq('user_id', uid)),
  upsertRatings: (rows: Record<string, unknown>[]) => one(db.from('ratings').upsert(rows)),
  liveGame: async (uid: string) => {
    const rows = await one(db.from('games').select('id,status').or(`white_id.eq.${uid},black_id.eq.${uid},host_id.eq.${uid}`)
      .in('status', ['playing', 'waiting']).order('created_at', { ascending: false }).limit(1));
    return rows && rows[0] ? rows[0] : null;
  },
  // deno-lint-ignore no-explicit-any
  pair: (a: any) => one(db.rpc('gc_pair', { p_user: a.user, p_tc: a.tc, p_pool: a.pool, p_rating: a.rating, p_rated: a.rated,
    p_base: a.base, p_inc: a.inc, p_start_fen: a.startFen })),
  abortWaiting: (uid: string) => one(db.from('games').update({ status: 'aborted', result: '*', reason: 'abort' }).eq('host_id', uid).eq('status', 'waiting')),
  deleteSeek: (uid: string) => one(db.from('seeks').delete().eq('user_id', uid)),
  top: async (pool: string, n: number) => {
    const rows = await one(db.from('ratings').select('rating,rd,games,wins,draws,losses,profiles(username)').eq('pool', pool).gt('games', 0)
      .order('rating', { ascending: false }).limit(n));
    // deno-lint-ignore no-explicit-any
    return (rows || []).map((r: any) => ({ name: r.profiles ? r.profiles.username : '?', rating: Math.round(r.rating), rd: Math.round(r.rd),
      games: r.games, wins: r.wins, draws: r.draws, losses: r.losses }));
  },
};

// ---- storage straight over Postgres (preferred); on connection trouble fall back to REST for a minute
const sql = DB_URL ? postgres(DB_URL, { prepare: false, max: +(Deno.env.get('PG_POOL_MAX') || 4), idle_timeout: 120, connect_timeout: 4, onnotice: () => {} }) : null;
const pgRepo = sql ? createPgRepo(sql) : null;
// open the connection while the first request is still being parsed and authorized
const pgOk: Promise<boolean> = sql ? sql`select 1`.then(() => true, (e: unknown) => { console.error('pg connect failed, using REST', String(e)); return false; }) : Promise.resolve(false);
let pgDownUntil = 0;
// deno-lint-ignore no-explicit-any
const isSqlError = (e: any) => e && typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) && !!e.severity;

// per-request view of a repo that adds up time spent in storage
// deno-lint-ignore no-explicit-any
function timed(repo: any, acc: { db: number; n: number }, isPg: boolean) {
  // deno-lint-ignore no-explicit-any
  const out: any = {};
  for (const k of Object.keys(repo)) {
    // deno-lint-ignore no-explicit-any
    out[k] = async (...args: any[]) => {
      const t = performance.now();
      try { return await repo[k](...args); }
      catch (e) { if (isPg && !isSqlError(e)) { pgDownUntil = Date.now() + 60000; console.error('pg unavailable, using REST', String(e)); } throw e; }
      finally { acc.db += performance.now() - t; acc.n++; }
    };
  }
  return out;
}

async function broadcast(topic: string, event: string, payload: unknown) {
  const t = performance.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }),
    });
    const ms = Math.round(performance.now() - t);
    if (!r.ok) console.error('broadcast', r.status, await r.text());
    else if (ms > 150) console.log('broadcast slow', ms, 'ms');
  } catch (e) { console.error('broadcast', e); }
}
// deno-lint-ignore no-explicit-any
const background = (p: Promise<unknown>) => { const rt = (globalThis as any).EdgeRuntime; if (rt && rt.waitUntil) rt.waitUntil(p); else p.catch(() => {}); };

// A player sends the same access token (valid for an hour) with every move: verify it once per isolate,
// then only check its expiry. Verification itself measured 60-150 ms per call in production.
const verified = new Map<string, { sub: string; exp: number }>();
async function userId(token: string): Promise<{ sub: string; how: string }> {
  if (!token) throw { code: 'auth' };
  const hit = verified.get(token);
  if (hit) {
    if (hit.exp * 1000 > Date.now() + 1000) return { sub: hit.sub, how: 'cached' };
    verified.delete(token);
    throw { code: 'auth' };
  }
  let sub = '', exp = 0;
  // deno-lint-ignore no-explicit-any
  const auth = db.auth as any;
  if (typeof auth.getClaims === 'function') {
    const { data, error } = await auth.getClaims(token);
    if (error || !data || !data.claims || !data.claims.sub) throw { code: 'auth' };
    sub = data.claims.sub; exp = +data.claims.exp || 0;
  } else {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data || !data.user) throw { code: 'auth' };
    sub = data.user.id;
  }
  if (exp) {
    if (verified.size >= 5000) verified.delete(verified.keys().next().value as string);
    verified.set(token, { sub, exp });
  }
  return { sub, how: 'verified' };
}

const HEADERS = { ...CORS, 'Content-Type': 'application/json', 'Timing-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Server-Timing' };
let served = 0;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const t0 = performance.now(), cold = served++ === 0;
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = JSON.parse((await req.text()) || '{}'); } catch { body = {}; }
  if (!body || typeof body !== 'object') body = {};
  const tBody = performance.now() - t0;
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || (typeof body.token === 'string' ? body.token : '');
  delete body.token;
  const acc = { db: 0, n: 0 };
  let tAuth = 0, how = '';
  const ta = performance.now();
  const authP = userId(token).then((r) => { how = r.how; return r.sub; }).finally(() => { tAuth = performance.now() - ta; });
  const usePg = !!pgRepo && body.via !== 'rest' && Date.now() > pgDownUntil && (await pgOk);
  delete body.via;
  const logic = createLogic({ repo: timed(usePg ? pgRepo : restRepo, acc, usePg), broadcast, GC, background });
  const { status, body: out } = await logic.handle(authP, body);
  const total = performance.now() - t0;
  const timing = `body;dur=${tBody.toFixed(1)}, auth;dur=${tAuth.toFixed(1)};desc="${how}", db;dur=${acc.db.toFixed(1)};desc="${acc.n}x ${usePg ? 'pg' : 'rest'}", total;dur=${total.toFixed(1)}` + (cold ? ', cold;dur=0' : '');
  return new Response(JSON.stringify(out), { status, headers: { ...HEADERS, 'Server-Timing': timing } });
});
