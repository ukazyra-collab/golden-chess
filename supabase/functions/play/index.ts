// Golden Chess game server (Supabase Edge Function). HTTP + storage + realtime wiring only;
// the game logic lives in logic.js and is shared with the local test server.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import GC from './core.js';
import { createLogic, CORS } from './logic.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// deno-lint-ignore no-explicit-any
async function one(q: PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await q;
  if (error) throw new Error(error.message || String(error));
  return data;
}

const repo = {
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

const logic = createLogic({
  repo, broadcast, GC,
  // deno-lint-ignore no-explicit-any
  background: (p: Promise<unknown>) => { const rt = (globalThis as any).EdgeRuntime; if (rt && rt.waitUntil) rt.waitUntil(p); else p.catch(() => {}); },
});

async function userId(req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw { code: 'auth' };
  // deno-lint-ignore no-explicit-any
  const auth = db.auth as any;
  if (typeof auth.getClaims === 'function') {
    const { data, error } = await auth.getClaims(token);
    if (!error && data && data.claims && data.claims.sub) return data.claims.sub;
    throw { code: 'auth' };
  }
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) throw { code: 'auth' };
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const { status, body: out } = await logic.handle(userId(req), body);
  return new Response(JSON.stringify(out), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
