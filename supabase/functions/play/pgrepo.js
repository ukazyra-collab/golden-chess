// Storage adapter over a direct Postgres connection (postgres.js), used by the edge function.
// Rows come back through to_jsonb so their shape matches the REST API (ISO timestamps, arrays as JSON).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME_COLS = new Set(['status', 'white_id', 'black_id', 'white_name', 'black_name', 'white_rating', 'black_rating', 'host_id', 'host_color',
  'tc_base', 'tc_inc', 'pool', 'rated', 'start_fen', 'moves', 'sans', 'fen', 'clock_w', 'clock_b', 'turn_started_at', 'result', 'reason',
  'white_diff', 'black_diff', 'white_after', 'black_after', 'draw_offer', 'rematch_offer', 'rematch_game', 'version', 'created_at', 'updated_at',
  'house', 'house_style']);

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
    async setAvatar(uid, v) {
      return first(await sql`update public.profiles p set avatar_v = ${v} where p.id = ${uid} returning to_jsonb(p) as j`);
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
    async housePair(a) {
      const r = await sql`select public.gc_house_pair(${a.user}::uuid, ${a.tc}::text, ${a.pool}::text, ${a.rating}::float8, ${a.rated}::boolean,
        ${a.base}::int, ${a.inc}::int, ${a.startFen}::text) as j`;
      return r[0].j;
    },
    async isAdmin(uid) {
      if (!UUID.test(String(uid))) return false;
      try { return (await sql`select 1 from public.admins where user_id = ${uid}`).length > 0; } catch (e) { return false; } // no admins table yet: nobody is
    },
    async houseOf(uid) {
      if (!UUID.test(String(uid))) return null;
      return first(await sql`select to_jsonb(h) as j from public.house h where h.user_id = ${uid}`);
    },
    // who of the game's players was last seen when (the play function's `seen`)
    async seenAt(gameId) {
      if (!UUID.test(String(gameId))) return [];
      return (await sql`select to_jsonb(s) as j from public.seen s where s.game_id = ${gameId}`).map((r) => r.j);
    },
    async touch(gameId, uid, at) {
      await sql`insert into public.seen (game_id, user_id, at) values (${gameId}, ${uid}, ${at}) on conflict (game_id, user_id) do update set at = excluded.at`;
    },
    async abortWaiting(uid) {
      await sql`update public.games set status = 'aborted', result = '*', reason = 'abort' where host_id = ${uid} and status = 'waiting'`;
    },
    // two accounts of one person become one (both proven by the caller): see gc_merge_accounts
    async mergeAccounts(a, b) {
      try {
        const r = await sql`select public.gc_merge_accounts(${a}::uuid, ${b}::uuid) as j`;
        return r[0].j;
      } catch (e) {
        const m = /live_game|same_account|no_account/.exec(String(e && e.message));
        if (m) return { error: m[0] };
        throw e;
      }
    },
    async deleteSeek(uid) {
      await sql`delete from public.seeks where user_id = ${uid}`;
    },
    // the app opened (hello): the player is around
    async touchSeen(uid) {
      if (!UUID.test(String(uid))) return;
      try { await sql`update public.profiles set last_seen = now() where id = ${uid}`; } catch (e) { /* older schema */ }
    },
    // who is around right now: people seen by the app in the last minutes, heartbeating in a game or looking for a
    // game, and the house players whose hours these are (about half of them at any moment, a different half every half
    // minute, so the number lives); faces: a handful of them for the search dialog's carousel
    async lobby() {
      const r = await sql`with hr as (select extract(hour from now() at time zone 'utc')::int as h, floor(extract(epoch from now()) / 30)::bigint as b),
        people as (select x.u from (
          select id as u from public.profiles where last_seen > now() - interval '5 minutes' and not house
          union select user_id from public.seen where at > now() - interval '5 minutes'
          union select user_id from public.seeks where updated_at > now() - interval '30 seconds') x),
        house as (select hp.user_id as u from public.house hp, hr
          where ((hr.h - hp.online_from + 24) % 24) < hp.online_hours and abs(hashtext(hp.user_id::text || hr.b::text)) % 100 < 55)
        select
          (select count(*) from public.seeks where updated_at > now() - interval '30 seconds') as seeking,
          (select count(*) from public.games where status = 'playing' and updated_at > now() - interval '1 hour') as games,
          (select count(distinct u) from (select u from people union select u from house) z) as online,
          (select coalesce(jsonb_agg(jsonb_build_object('uid', p.id, 'name', p.username, 'avatar_v', p.avatar_v)), '[]'::jsonb) from
            (select p.id, p.username, p.avatar_v from public.profiles p where p.id in (select u from people union select u from house) order by random() limit 14) p) as faces`;
      return { seeking: Number(r[0].seeking), games: Number(r[0].games), online: Number(r[0].online), faces: r[0].faces || [] };
    },
    async top(pool, n) {
      return plain(await sql`select r.user_id as uid, p.username as name, p.avatar_v, round(r.rating)::int as rating, round(r.rd)::int as rd, r.games, r.wins, r.draws, r.losses
        from public.ratings r join public.profiles p on p.id = r.user_id where r.pool = ${pool} and r.games > 0 order by r.rating desc limit ${n}`);
    },
    // the player's place in the pool and the pool's size (rank null when unrated there)
    async rankOf(uid, pool) {
      if (!UUID.test(String(uid))) return null;
      const r = await sql`select (select count(*) from public.ratings x where x.pool = ${pool} and x.games > 0 and x.rating > r.rating) + 1 as rank
        from public.ratings r where r.user_id = ${uid} and r.pool = ${pool} and r.games > 0`;
      return r.length ? Number(r[0].rank) : null;
    },
    async poolSize(pool) {
      const r = await sql`select count(*) as n from public.ratings where pool = ${pool} and games > 0`;
      return Number(r[0].n);
    },
    // one player's leaderboard row (null when unrated in the pool)
    async rowOf(uid, pool) {
      if (!UUID.test(String(uid))) return null;
      return first(await sql`select to_jsonb(q) as j from (select r.user_id as uid, p.username as name, p.avatar_v, round(r.rating)::int as rating, round(r.rd)::int as rd, r.games, r.wins, r.draws, r.losses
        from public.ratings r join public.profiles p on p.id = r.user_id where r.user_id = ${uid} and r.pool = ${pool} and r.games > 0) q`);
    },
  };
}
