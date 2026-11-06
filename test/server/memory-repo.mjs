// In-memory storage adapter with the same semantics as the SQL schema (used by the local test server and logic tests).
import crypto from 'node:crypto';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export function createMemoryRepo(now) {
  const iso = (t) => new Date(t).toISOString();
  const db = { games: new Map(), profiles: new Map(), ratings: new Map(), seeks: new Map(), house: new Map(), admins: new Set() };
  const GAME_DEFAULTS = { status: 'playing', white_id: null, black_id: null, white_name: null, black_name: null, white_rating: null, black_rating: null,
    host_id: null, host_color: null, rated: true, moves: [], sans: [], turn_started_at: null, result: null, reason: null, white_diff: null, black_diff: null,
    white_after: null, black_after: null, draw_offer: null, rematch_offer: null, rematch_game: null, version: 0, house: null, house_style: null };
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
    // a house player (test setups add them with addHouse): the same choice as gc_house_pair, in memory
    async housePair(a) {
      const mine = [...db.games.values()].filter((g) => g.status === 'playing' && (g.white_id === a.user || g.black_id === a.user))
        .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
      db.seeks.delete(a.user);
      if (mine) return { game: mine.id };
      const over = [...db.games.values()].filter((g) => g.status === 'over' && (g.white_id === a.user || g.black_id === a.user)).sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1))[0];
      const lastOpp = over ? (over.white_id === a.user ? over.black_id : over.white_id) : null;
      const hour = new Date(now()).getUTCHours();
      const busy = new Set([...db.games.values()].filter((g) => g.status === 'playing').flatMap((g) => [g.white_id, g.black_id]));
      const cands = [...db.house.values()].filter((h) => !busy.has(h.user_id)).map((h) => {
        const r = db.ratings.get(h.user_id + '|' + a.pool), rating = r ? r.rating : h.target;
        const away = ((hour - h.online_from + 24) % 24) < h.online_hours ? 0 : 1, dist = Math.abs(rating - a.rating);
        return { h, rating, key: away + (dist > 250 ? 1 : 0) + (h.user_id === lastOpp ? 2 : 0), dist: dist + Math.random() * 150 };
      }).sort((x, y) => x.key - y.key || x.dist - y.dist);
      if (!cands.length) return { none: true };
      const { h, rating } = cands[0];
      const [w, b] = Math.random() < 0.5 ? [a.user, h.user_id] : [h.user_id, a.user];
      const rr = (u) => { const r = db.ratings.get(u + '|' + a.pool); return r ? Math.round(r.rating) : u === h.user_id ? Math.round(rating) : 1500; };
      const g = insertGame({ white_id: w, black_id: b, white_name: db.profiles.get(w)?.username, black_name: db.profiles.get(b)?.username,
        white_rating: rr(w), black_rating: rr(b), tc_base: a.base, tc_inc: a.inc, pool: a.pool, rated: a.rated, start_fen: a.startFen, fen: a.startFen,
        clock_w: a.base, clock_b: a.base, house: w === h.user_id ? 'w' : 'b', house_style: Object.assign({}, h.style, { level: h.level }) });
      return { game: g.id, house: h.user_id };
    },
    async houseOf(uid) { return clone(db.house.get(uid) || null); },
    async isAdmin(uid) { return db.admins.has(uid); },
    async abortWaiting(uid) { for (const g of db.games.values()) if (g.host_id === uid && g.status === 'waiting') Object.assign(g, { status: 'aborted', result: '*', reason: 'abort' }); },
    async deleteSeek(uid) { db.seeks.delete(uid); },
    async top(pool, n) {
      return [...db.ratings.values()].filter((r) => r.pool === pool && r.games > 0).sort((a, b) => b.rating - a.rating).slice(0, n)
        .map((r) => ({ name: db.profiles.get(r.user_id)?.username || '?', rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games, wins: r.wins, draws: r.draws, losses: r.losses }));
    },
  };


  // a house player for tests: a profile marked house, its house row, a rating at its target
  function addHouse(o) {
    const id = o.id || 'h' + crypto.randomUUID().slice(0, 8), t = iso(now());
    db.profiles.set(id, { id, username: o.name, is_guest: false, name_chosen: true, house: true, created_at: t });
    db.house.set(id, { user_id: id, level: o.level || 5, target: o.target || 1500, style: o.style || {}, online_from: o.online_from || 0, online_hours: o.online_hours || 24, created_at: t });
    for (const pool of ['bullet', 'blitz', 'rapid']) db.ratings.set(id + '|' + pool, { user_id: id, pool, rating: o.target || 1500, rd: 70, vol: 0.06, games: o.games || 0, wins: 0, draws: 0, losses: 0, updated_at: t });
    return id;
  }
  return { repo, db, clone, addHouse };
}
