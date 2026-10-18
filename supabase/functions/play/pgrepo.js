// Storage adapter over a direct Postgres connection (postgres.js), used by the edge function.
// Rows come back through to_jsonb so their shape matches the REST API (ISO timestamps, arrays as JSON).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME_COLS = new Set(['status', 'white_id', 'black_id', 'white_name', 'black_name', 'white_rating', 'black_rating', 'host_id', 'host_color',
  'tc_base', 'tc_inc', 'pool', 'rated', 'start_fen', 'moves', 'sans', 'fen', 'clock_w', 'clock_b', 'turn_started_at', 'result', 'reason',
  'white_diff', 'black_diff', 'white_after', 'black_after', 'draw_offer', 'rematch_offer', 'rematch_game', 'version', 'created_at', 'updated_at']);

function cols(obj) {
  const keys = Object.keys(obj);
  for (const k of keys) if (!GAME_COLS.has(k)) throw new Error('unknown column ' + k);
  return keys;
}
const first = (rows) => (rows.length ? rows[0].j : null);
const plain = (rows) => rows.map((r) => Object.assign({}, r));

export function createPgRepo(sql) {
  return {
    async getGame(id) {
      if (!UUID.test(String(id))) return null;
      return first(await sql`select to_jsonb(g) as j from public.games g where g.id = ${id}`);
    },
    async updateGame(id, version, patch) {
      return first(await sql`update public.games g set ${sql(patch, cols(patch))} where g.id = ${id} and g.version = ${version} returning to_jsonb(g) as j`);
    },
    async setGameFields(id, patch) {
      return first(await sql`update public.games g set ${sql(patch, cols(patch))} where g.id = ${id} returning to_jsonb(g) as j`);
    },
    async insertGame(row) {
      return first(await sql`insert into public.games ${sql(row, cols(row))} returning to_jsonb(games.*) as j`);
    },
    async getProfile(uid) {
      return first(await sql`select to_jsonb(p) as j from public.profiles p where p.id = ${uid}`);
    },
    async insertProfile(uid, name, guest = true) {
      try {
        return first(await sql`insert into public.profiles as p (id, username, is_guest) values (${uid}, ${name}, ${!!guest}) returning to_jsonb(p) as j`);
      } catch (e) {
        if (e && e.code === '23505') return null; // name taken or profile already there
        throw e;
      }
    },
    async setGuest(uid, guest) {
      return first(await sql`update public.profiles p set is_guest = ${!!guest} where p.id = ${uid} returning to_jsonb(p) as j`);
    },
    async renameProfile(uid, name) {
      try {
        return { row: first(await sql`update public.profiles p set username = ${name} where p.id = ${uid} returning to_jsonb(p) as j`) };
      } catch (e) {
        if (e && e.code === '23505') return { taken: true };
        throw e;
      }
    },
    async getRating(uid, pool) {
      return first(await sql`select to_jsonb(r) as j from public.ratings r where r.user_id = ${uid} and r.pool = ${pool}`);
    },
    async getRatings(uid) {
      return plain(await sql`select pool, rating, rd, games, wins, draws, losses from public.ratings where user_id = ${uid}`);
    },
    async upsertRatings(rows) {
      if (!rows.length) return;
      await sql`insert into public.ratings ${sql(rows, 'user_id', 'pool', 'rating', 'rd', 'vol', 'games', 'wins', 'draws', 'losses', 'updated_at')}
        on conflict (user_id, pool) do update set rating = excluded.rating, rd = excluded.rd, vol = excluded.vol, games = excluded.games,
          wins = excluded.wins, draws = excluded.draws, losses = excluded.losses, updated_at = excluded.updated_at`;
    },
    async liveGame(uid) {
      return first(await sql`select jsonb_build_object('id', id, 'status', status) as j from public.games
        where (white_id = ${uid} or black_id = ${uid} or host_id = ${uid}) and status in ('playing', 'waiting') order by created_at desc limit 1`);
    },
    async pair(a) {
      const r = await sql`select public.gc_pair(${a.user}::uuid, ${a.tc}::text, ${a.pool}::text, ${a.rating}::float8, ${a.rated}::boolean,
        ${a.base}::int, ${a.inc}::int, ${a.startFen}::text) as j`;
      return r[0].j;
    },
    async abortWaiting(uid) {
      await sql`update public.games set status = 'aborted', result = '*', reason = 'abort' where host_id = ${uid} and status = 'waiting'`;
    },
    async deleteSeek(uid) {
      await sql`delete from public.seeks where user_id = ${uid}`;
    },
    async top(pool, n) {
      return plain(await sql`select p.username as name, round(r.rating)::int as rating, round(r.rd)::int as rd, r.games, r.wins, r.draws, r.losses
        from public.ratings r join public.profiles p on p.id = r.user_id where r.pool = ${pool} and r.games > 0 order by r.rating desc limit ${n}`);
    },
  };
}
