// In-memory storage adapter with the same semantics as the SQL schema (used by the local test server and logic tests).
import crypto from 'node:crypto';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export function createMemoryRepo(now) {
  const iso = (t) => new Date(t).toISOString();
  const db = { games: new Map(), profiles: new Map(), ratings: new Map(), seeks: new Map() };
  const GAME_DEFAULTS = { status: 'playing', white_id: null, black_id: null, white_name: null, black_name: null, white_rating: null, black_rating: null,
    host_id: null, host_color: null, rated: true, moves: [], sans: [], turn_started_at: null, result: null, reason: null, white_diff: null, black_diff: null,
    white_after: null, black_after: null, draw_offer: null, rematch_offer: null, rematch_game: null, version: 0 };
  function insertGame(row) {
    const t = iso(now());
    const g = Object.assign({}, GAME_DEFAULTS, { id: crypto.randomUUID(), created_at: t, updated_at: t }, clone(row));
    db.games.set(g.id, g);
    return clone(g);
  }
  const repo = {
    async getGame(id) { return clone(db.games.get(id) || null); },
    async updateGame(id, version, patch) {
      const g = db.games.get(id);
      if (!g || g.version !== version) return null;
      Object.assign(g, clone(patch));
      return clone(g);
    },
    async setGameFields(id, patch) { const g = db.games.get(id); if (!g) return null; Object.assign(g, clone(patch)); return clone(g); },
    async insertGame(row) { return insertGame(row); },
    async getProfile(uid) { return clone(db.profiles.get(uid) || null); },
    async insertProfile(uid, name, guest = true) {
      if (db.profiles.has(uid)) return null;
      for (const p of db.profiles.values()) if (p.username.toLowerCase() === name.toLowerCase()) return null;
      const p = { id: uid, username: name, is_guest: !!guest, name_chosen: false, created_at: iso(now()) };
      db.profiles.set(uid, p);
      return clone(p);
    },
    async setGuest(uid, guest) { const p = db.profiles.get(uid); if (!p) return null; p.is_guest = !!guest; return clone(p); },
    async renameProfile(uid, name) {
      for (const p of db.profiles.values()) if (p.id !== uid && p.username.toLowerCase() === name.toLowerCase()) return { taken: true };
      const p = db.profiles.get(uid);
      p.username = name; p.name_chosen = true;
      return { row: clone(p) };
    },
    async getRating(uid, pool) { return clone(db.ratings.get(uid + '|' + pool) || null); },
    async getRatings(uid) { return [...db.ratings.values()].filter((r) => r.user_id === uid).map(clone); },
    async upsertRatings(rows) { for (const r of rows) db.ratings.set(r.user_id + '|' + r.pool, Object.assign(db.ratings.get(r.user_id + '|' + r.pool) || {}, clone(r))); },
    async liveGame(uid) {
      const live = [...db.games.values()].filter((g) => ['playing', 'waiting'].includes(g.status) && [g.white_id, g.black_id, g.host_id].includes(uid))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return live[0] ? { id: live[0].id, status: live[0].status } : null;
    },
    async pair(a) {
      const mine = [...db.games.values()].filter((g) => g.status === 'playing' && (g.white_id === a.user || g.black_id === a.user))
        .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
      if (mine) { db.seeks.delete(a.user); return { game: mine.id }; }
      const t = now();
      const cands = [...db.seeks.values()].filter((s) => s.tc === a.tc && s.rated === a.rated && s.user_id !== a.user && t - s.updated < 30000)
        .sort((x, y) => Math.abs(x.rating - a.rating) - Math.abs(y.rating - a.rating) || x.updated - y.updated);
      if (!cands.length) { db.seeks.set(a.user, { user_id: a.user, tc: a.tc, pool: a.pool, rating: a.rating, rated: a.rated, updated: t }); return { waiting: true }; }
      const opp = cands[0];
      db.seeks.delete(opp.user_id); db.seeks.delete(a.user);
      const [w, b] = Math.random() < 0.5 ? [a.user, opp.user_id] : [opp.user_id, a.user];
      const rr = (u) => { const r = db.ratings.get(u + '|' + a.pool); return r ? Math.round(r.rating) : 1500; };
      const g = insertGame({ white_id: w, black_id: b, white_name: db.profiles.get(w)?.username, black_name: db.profiles.get(b)?.username,
        white_rating: rr(w), black_rating: rr(b), tc_base: a.base, tc_inc: a.inc, pool: a.pool, rated: a.rated, start_fen: a.startFen, fen: a.startFen,
        clock_w: a.base, clock_b: a.base });
      return { game: g.id, opponent: opp.user_id };
    },
    async abortWaiting(uid) { for (const g of db.games.values()) if (g.host_id === uid && g.status === 'waiting') Object.assign(g, { status: 'aborted', result: '*', reason: 'abort' }); },
    async deleteSeek(uid) { db.seeks.delete(uid); },
    async top(pool, n) {
      return [...db.ratings.values()].filter((r) => r.pool === pool && r.games > 0).sort((a, b) => b.rating - a.rating).slice(0, n)
        .map((r) => ({ name: db.profiles.get(r.user_id)?.username || '?', rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games, wins: r.wins, draws: r.draws, losses: r.losses }));
    },
  };


  return { repo, db, clone };
}
