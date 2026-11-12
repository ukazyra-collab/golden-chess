// In-memory storage adapter with the same semantics as the SQL schema (used by the local test server and logic tests).
import crypto from 'node:crypto';

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export function createMemoryRepo(now) {
  // as gc_house_pair's house_wait; the browser suites set MOCK_HOUSE_WAIT=0 (their other pages are always "around")
  const HOUSE_WAIT = process.env.MOCK_HOUSE_WAIT != null ? +process.env.MOCK_HOUSE_WAIT : 5000;
  const iso = (t) => new Date(t).toISOString();
  const db = { games: new Map(), profiles: new Map(), ratings: new Map(), seeks: new Map(), house: new Map(), admins: new Set(), seen: new Map(), progress: new Map(),
    blurs: [], reports: [], fairScores: [], refunds: new Set() };
  const closed = (uid) => (db.profiles.get(uid) || {}).fair === 'closed'; // out of the leaderboard (fair play)
  const GAME_DEFAULTS = { status: 'playing', white_id: null, black_id: null, white_name: null, black_name: null, white_rating: null, black_rating: null,
    host_id: null, host_color: null, rated: true, moves: [], sans: [], turn_started_at: null, result: null, reason: null, white_diff: null, black_diff: null,
    white_after: null, black_after: null, draw_offer: null, rematch_offer: null, rematch_game: null, version: 0, house: null, house_style: null, code: null };
  function insertGame(row) {
    // as the database's games_waiting_code: one waiting game per code
    if (row.code && row.status === 'waiting' && [...db.games.values()].some((g) => g.status === 'waiting' && g.code === row.code)) {
      const e = new Error('duplicate code'); e.code = '23505'; throw e;
    }
    const t = iso(now());
    const g = Object.assign({}, GAME_DEFAULTS, { id: crypto.randomUUID(), created_at: t, updated_at: t }, clone(row));
    db.games.set(g.id, g);
    return clone(g);
  }
  // the fresh seeks for the same game by someone else, closest in rating first, then the longest waiting
  // (not someone they have just played: a finished game between the two in the last 15 minutes)
  const justPlayed = (u, v, t) => [...db.games.values()].some((g) => g.status === 'over' && t - Date.parse(g.updated_at) < 15 * 60000 &&
    ((g.white_id === u && g.black_id === v) || (g.white_id === v && g.black_id === u)));
  const fresh = (a, t) => [...db.seeks.values()].filter((s) => s.tc === a.tc && s.rated === a.rated && s.user_id !== a.user && t - s.updated < 30000 && !justPlayed(a.user, s.user_id, t))
    .sort((x, y) => Math.abs(x.rating - a.rating) - Math.abs(y.rating - a.rating) || x.since - y.since);
  // the game between two people (colours by lot), the seeks of both cleared
  function pairGame(a, other) {
    db.seeks.delete(other); db.seeks.delete(a.user);
    const [w, b] = Math.random() < 0.5 ? [a.user, other] : [other, a.user];
    const rr = (u) => { const r = db.ratings.get(u + '|' + a.pool); return r ? Math.round(r.rating) : 1500; };
    return insertGame({ white_id: w, black_id: b, white_name: db.profiles.get(w)?.username, black_name: db.profiles.get(b)?.username,
      white_rating: rr(w), black_rating: rr(b), tc_base: a.base, tc_inc: a.inc, pool: a.pool, rated: a.rated, start_fen: a.startFen, fen: a.startFen,
      clock_w: a.base, clock_b: a.base });
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
      const p = { id: uid, username: name, is_guest: !!guest, name_chosen: false, avatar_v: 0, xp: 0, created_at: iso(now()) };
      db.profiles.set(uid, p);
      return clone(p);
    },
    async setGuest(uid, guest) { const p = db.profiles.get(uid); if (!p) return null; p.is_guest = !!guest; return clone(p); },
    async setAvatar(uid, v) { const p = db.profiles.get(uid); if (!p) return null; p.avatar_v = v; return clone(p); },
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
      const own = db.seeks.get(a.user);
      const since = own && own.tc === a.tc && own.rated === a.rated && t - own.updated < 30000 ? own.since : t;
      // close in rating: 150 points at once, 50 more for every second the longer-waiting of the two has searched
      const cands = fresh(a, t).filter((s) => Math.abs(s.rating - a.rating) <= 150 + 50 * (t - Math.min(s.since, since)) / 1000);
      if (!cands.length) { db.seeks.set(a.user, { user_id: a.user, tc: a.tc, pool: a.pool, rating: a.rating, rated: a.rated, updated: t, since }); return { waiting: true }; }
      const opp = cands[0];
      return { game: pairGame(a, opp.user_id).id, opponent: opp.user_id };
    },
    // a house player (test setups add them with addHouse): the same choice as gc_house_pair, in memory
    async housePair(a) {
      const mine = [...db.games.values()].filter((g) => g.status === 'playing' && (g.white_id === a.user || g.black_id === a.user))
        .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
      if (mine) { db.seeks.delete(a.user); return { game: mine.id }; }
      // a person searching for the same game comes before any house player, whatever the gap in rating
      const t = now(), people = fresh(a, t);
      if (people.length) return { game: pairGame(a, people[0].user_id).id, opponent: people[0].user_id };
      // other people have the app open (and are not in a game): the house waits HOUSE_WAIT of search
      const own = db.seeks.get(a.user);
      const since = own && own.tc === a.tc && own.rated === a.rated && t - own.updated < 30000 ? own.since : t;
      const playing = new Set([...db.games.values()].filter((g) => g.status === 'playing' && t - Date.parse(g.updated_at) < 600000).flatMap((g) => [g.white_id, g.black_id]));
      const around = [...db.profiles.values()].some((p) => p.id !== a.user && !p.house && p.last_seen && t - Date.parse(p.last_seen) < 120000 && !playing.has(p.id));
      if (around && t - since < HOUSE_WAIT) return { waiting: true };
      db.seeks.delete(a.user);
      const over = [...db.games.values()].filter((g) => g.status === 'over' && (g.white_id === a.user || g.black_id === a.user)).sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1))[0];
      const lastOpp = over ? (over.white_id === a.user ? over.black_id : over.white_id) : null;
      const hour = new Date(now()).getUTCHours();
      const busy = new Set([...db.games.values()].filter((g) => g.status === 'playing' && now() - Date.parse(g.updated_at) < 3600000).flatMap((g) => [g.white_id, g.black_id]));
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
    async seenAt(gameId) { return [...db.seen.values()].filter((s) => s.game_id === gameId).map(clone); },
    async touch(gameId, uid, at) { db.seen.set(gameId + '|' + uid, { game_id: gameId, user_id: uid, at }); },
    async isAdmin(uid) { return db.admins.has(uid); },
    async waitingByCode(code) { for (const g of db.games.values()) if (g.status === 'waiting' && g.code === code) return clone(g); return null; },
    async abortWaiting(uid) { for (const g of db.games.values()) if (g.host_id === uid && g.status === 'waiting') Object.assign(g, { status: 'aborted', result: '*', reason: 'abort' }); },
    // as gc_merge_accounts (the sign-in side lives in the test server's stand-in for Auth)
    async mergeAccounts(a, b) {
      if (!a || !b || a === b) return { error: 'same_account' };
      if (!db.profiles.has(a) || !db.profiles.has(b)) return { error: 'no_account' };
      const games = [...db.games.values()];
      if (games.some((g) => g.status === 'playing' && [a, b].some((u) => g.white_id === u || g.black_id === u))) return { error: 'live_game' };
      const n = (u) => games.filter((g) => g.status === 'over' && (g.white_id === u || g.black_id === u)).length;
      const [ga, gb] = [n(a), n(b)];
      const older = (db.profiles.get(a).created_at || '') <= (db.profiles.get(b).created_at || '');
      const [keep, gone] = ga > gb || (ga === gb && older) ? [a, b] : [b, a];
      for (const g of games) for (const k of ['white_id', 'black_id', 'host_id']) if (g[k] === gone) g[k] = keep;
      for (const [key, r] of [...db.ratings.entries()]) {
        if (r.user_id !== gone) continue;
        const kk = keep + '|' + r.pool, mine = db.ratings.get(kk);
        if (!mine || r.games > mine.games) db.ratings.set(kk, Object.assign({}, r, { user_id: keep }));
        db.ratings.delete(key);
      }
      if (db.admins.has(gone)) db.admins.add(keep);
      db.admins.delete(gone);
      const gp = db.profiles.get(gone), kp = db.profiles.get(keep);
      db.profiles.delete(gone); db.seeks.delete(gone); db.house.delete(gone);
      if (gp.name_chosen && !kp.name_chosen && ![...db.profiles.values()].some((p) => p.username.toLowerCase() === gp.username.toLowerCase())) { kp.username = gp.username; kp.name_chosen = true; }
      return { keep, gone };
    },
    async deleteSeek(uid) { db.seeks.delete(uid); },
    async top(pool, n) {
      return [...db.ratings.values()].filter((r) => r.pool === pool && r.games > 0 && !closed(r.user_id)).sort((a, b) => b.rating - a.rating).slice(0, n)
        .map((r) => ({ uid: r.user_id, name: db.profiles.get(r.user_id)?.username || '?', avatar_v: db.profiles.get(r.user_id)?.avatar_v || 0, xp: db.profiles.get(r.user_id)?.xp || 0, rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games, wins: r.wins, draws: r.draws, losses: r.losses }));
    },
    async rankOf(uid, pool) {
      const r = db.ratings.get(uid + '|' + pool);
      if (!r || !r.games || closed(uid)) return null;
      return [...db.ratings.values()].filter((x) => x.pool === pool && x.games > 0 && x.rating > r.rating && !closed(x.user_id)).length + 1;
    },
    async poolSize(pool) { return [...db.ratings.values()].filter((x) => x.pool === pool && x.games > 0 && !closed(x.user_id)).length; },
    async rowOf(uid, pool) {
      const r = db.ratings.get(uid + '|' + pool);
      if (!r || !r.games || closed(uid)) return null;
      return { uid, name: db.profiles.get(uid)?.username || '?', avatar_v: db.profiles.get(uid)?.avatar_v || 0, xp: db.profiles.get(uid)?.xp || 0, rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games, wins: r.wins, draws: r.draws, losses: r.losses };
    },
    // ---- the game layer on the account (as supabase/pending/*_progress.sql)
    async progress(uid, data, xp) {
      const p = db.profiles.get(uid);
      if (data != null) { db.progress.set(uid, { data: clone(data), at: iso(now()) }); if (p) p.xp = Math.max(0, Math.min(5000000, xp || 0)); }
      const r = db.progress.get(uid);
      return { data: r ? clone(r.data) : null, xp: (p && p.xp) || 0, at: r ? r.at : null };
    },
    async setPrefs(uid, lang, tz, opt) {
      const p = db.profiles.get(uid);
      if (lang) p.lang = lang;
      if (tz) p.tz = tz;
      if (opt !== null && opt !== p.email_opt) { p.email_opt = opt; p.email_opt_at = iso(now()); }
      return { lang: p.lang || 'en', tz: p.tz || null, email_opt: p.email_opt == null ? null : p.email_opt };
    },
    // ---- fair play (as supabase/pending/*_fair_play.sql)
    async noteBlur(row) { db.blurs.push(Object.assign({ at: iso(now()) }, row)); },
    async addReport(o) {
      if (db.reports.some((x) => x.reporter === o.reporter && x.game_id === o.game_id)) return { again: true };
      const day = now() - 86400000;
      if (db.reports.filter((x) => x.reporter === o.reporter && Date.parse(x.at) > day).length >= o.limit) return { limited: true };
      db.reports.push({ id: db.reports.length + 1, at: iso(now()), reporter: o.reporter, accused: o.accused, game_id: o.game_id, why: o.why, note: o.note, status: 'open' });
      return {};
    },
    async fairList(n) {
      const by = new Map();
      for (const x of db.reports) {
        const p = db.profiles.get(x.accused) || {};
        const e = by.get(x.accused) || { uid: x.accused, name: p.username || '?', fair: p.fair || 'ok', open: 0, reports: 0, reporters: new Set(), why: {}, games: [], last_at: null, score: null };
        e.reports++; if (x.status === 'open') e.open++;
        e.reporters.add(x.reporter); e.why[x.why] = (e.why[x.why] || 0) + 1;
        if (!e.games.includes(x.game_id)) e.games.push(x.game_id);
        if (!e.last_at || x.at > e.last_at) e.last_at = x.at;
        by.set(x.accused, e);
      }
      for (const sc of db.fairScores) {
        const p = db.profiles.get(sc.user_id) || {};
        const e = by.get(sc.user_id) || { uid: sc.user_id, name: p.username || '?', fair: p.fair || 'ok', open: 0, reports: 0, reporters: new Set(), why: {}, games: [], last_at: null, score: null };
        if (!e.score || sc.at > e.score.at) e.score = clone(sc);
        by.set(sc.user_id, e);
      }
      return [...by.values()].map((e) => Object.assign(e, { reporters: e.reporters.size }))
        .filter((e) => e.open > 0 || (e.score && e.score.verdict !== 'ok') || e.fair === 'watch')
        .sort((a, b) => b.open - a.open || (b.score ? b.score.z : 0) - (a.score ? a.score.z : 0)).slice(0, n);
    },
    async fairSet(uid, state, by) {
      const p = db.profiles.get(uid);
      p.fair = state;
      let refunds = 0;
      for (const x of db.reports) if (x.accused === uid && x.status === 'open' && state !== 'watch') { x.status = state === 'closed' ? 'confirmed' : 'cleared'; x.handled_by = by; x.handled_at = iso(now()); }
      if (state === 'closed') {
        // the rating its opponents lost to it in the last 30 days goes back to them (once per game)
        for (const g of db.games.values()) {
          if (g.status !== 'over' || !g.rated || Date.parse(g.updated_at) < now() - 30 * 86400000) continue;
          const side = g.white_id === uid ? 'w' : g.black_id === uid ? 'b' : null;
          if (!side) continue;
          const victim = side === 'w' ? g.black_id : g.white_id, lost = side === 'w' ? g.black_diff : g.white_diff;
          if (!(lost < 0) || db.refunds.has(g.id + '|' + victim) || closed(victim)) continue;
          const r = db.ratings.get(victim + '|' + g.pool);
          if (!r) continue;
          db.refunds.add(g.id + '|' + victim); r.rating -= lost; refunds++;
        }
      }
      return { refunds };
    },
    async noteActivity(uid, platform, kind) {
      db.activity = db.activity || new Map();
      const key = uid + '|' + iso(now()).slice(0, 10), row = db.activity.get(key) || { user_id: uid, day: iso(now()).slice(0, 10), platform, kinds: [] };
      row.platform = platform; if (!row.kinds.includes(kind)) row.kinds.push(kind);
      db.activity.set(key, row);
    },
    async touchSeen(uid) { const p = db.profiles.get(uid); if (p) p.last_seen = iso(now()); },
    async lobby() {
      const t = now(), fresh = (x) => x && t - Date.parse(x) < 5 * 60000;
      const seeks = [...db.seeks.values()].filter((s) => t - s.updated < 30000);
      const games = [...db.games.values()].filter((g) => g.status === 'playing' && t - Date.parse(g.updated_at) < 3600000).length;
      const hr = new Date(t).getUTCHours();
      const house = [...db.house.values()].filter((h) => ((hr - h.online_from + 24) % 24) < h.online_hours).map((h) => h.user_id);
      const online = new Set([...[...db.profiles.values()].filter((p) => fresh(p.last_seen)).map((p) => p.id),
        ...[...db.seen.values()].filter((s) => fresh(s.at)).map((s) => s.user_id), ...seeks.map((s) => s.user_id), ...house]);
      const faces = [...online].slice(0, 14).map((id) => ({ uid: id, name: db.profiles.get(id)?.username || '?', avatar_v: db.profiles.get(id)?.avatar_v || 0 }));
      return { seeking: seeks.length, games, online: online.size, faces };
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
