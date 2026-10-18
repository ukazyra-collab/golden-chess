// Golden Chess game server logic. Runtime-agnostic: the Supabase edge function (Deno) and the local
// test server (Node) both run this file with their own storage adapter (`repo`) and broadcaster.
// The server is the source of truth for legality (same rules module as the client), clocks (server
// time) and ratings (Glicko-2 per pool).

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export const TCS = {
  '1+0': [60000, 0], '2+1': [120000, 1000], '3+0': [180000, 0], '3+2': [180000, 2000], '5+0': [300000, 0],
  '5+3': [300000, 3000], '10+0': [600000, 0], '10+5': [600000, 5000], '15+10': [900000, 10000],
};
export const LAG_COMP = 150;        // ms credited back per move for network lag
export const FIRST_MOVE_MS = 30000; // each side must make its first move within this time or the game is aborted

const ADJ = ['Golden', 'Swift', 'Silent', 'Brave', 'Clever', 'Royal', 'Lucky', 'Bold', 'Quiet', 'Sharp', 'Wild', 'Calm', 'Bright', 'Sly'];
const NOUN = ['Knight', 'Bishop', 'Rook', 'Queen', 'Pawn', 'Castle', 'Gambit', 'Fork', 'Pin', 'Tempo', 'Fianchetto', 'Endgame'];

class Fail extends Error {
  constructor(code, extra) { super(code); this.code = code; this.extra = extra; }
}

export function poolOf(base, inc) {
  const s = base / 1000 + (40 * inc) / 1000;
  return s < 180 ? 'bullet' : s < 480 ? 'blitz' : 'rapid';
}

// Glicko-2 for one game as one rating period (tau 0.75, RD kept in [45, 350]).
export function glicko2(r, rd, vol, or, ord, score) {
  const q = 173.7178, tau = 0.75;
  const mu = (r - 1500) / q, phi = rd / q, muj = (or - 1500) / q, phij = ord / q;
  const g = 1 / Math.sqrt(1 + (3 * phij * phij) / (Math.PI * Math.PI));
  const E = 1 / (1 + Math.exp(-g * (mu - muj)));
  const v = 1 / (g * g * E * (1 - E));
  const delta = v * g * (score - E);
  const a = Math.log(vol * vol);
  const f = (x) => { const ex = Math.exp(x); return (ex * (delta * delta - phi * phi - v - ex)) / (2 * Math.pow(phi * phi + v + ex, 2)) - (x - a) / (tau * tau); };
  let A = a, B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * tau) < 0 && k < 60) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B), n = 0;
  while (Math.abs(B - A) > 1e-6 && n++ < 100) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const volNew = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + volNew * volNew);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * g * (score - E);
  return { rating: muNew * q + 1500, rd: Math.max(45, Math.min(350, phiNew * q)), vol: volNew };
}

export function createLogic(opts) {
  const { repo, GC } = opts;
  const broadcast = opts.broadcast || (async () => {});
  const now = opts.now || (() => Date.now());
  const rnd = opts.random || Math.random;
  // fire-and-forget hook (EdgeRuntime.waitUntil in production); awaited when absent
  const later = (p) => (opts.background ? (opts.background(p), undefined) : p);

  const iso = (t) => new Date(t).toISOString();
  const colorOf = (g, uid) => (g.white_id === uid ? 'w' : g.black_id === uid ? 'b' : null);
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const view = (g) => Object.assign({}, g, { now: now() });

  async function game(id) {
    if (!id || typeof id !== 'string') throw new Fail('no_game');
    const g = await repo.getGame(id);
    if (!g) throw new Fail('no_game');
    return g;
  }
  async function rating(uid, pool) {
    return (await repo.getRating(uid, pool)) || { user_id: uid, pool, rating: 1500, rd: 350, vol: 0.06, games: 0, wins: 0, draws: 0, losses: 0 };
  }

  // ---- rules ----
  function replay(g) {
    const pos = new GC.Position(g.start_fen);
    const counts = {};
    counts[pos.hashKey()] = 1;
    for (const u of g.moves || []) {
      const m = pos.moveFromUci(u);
      if (!m) throw new Fail('corrupt');
      pos.makeMove(m);
      const k = pos.hashKey(); counts[k] = (counts[k] || 0) + 1;
    }
    return { pos, counts };
  }
  function endOf(pos, counts) {
    if (!pos.hasLegalMove()) return pos.inCheck() ? { result: pos.side === 0 ? '0-1' : '1-0', reason: 'checkmate' } : { result: '1/2-1/2', reason: 'stalemate' };
    if ((counts[pos.hashKey()] || 0) >= 3) return { result: '1/2-1/2', reason: 'repetition' };
    if (pos.halfmove >= 100) return { result: '1/2-1/2', reason: 'fifty' };
    if (pos.insufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient' };
    return null;
  }
  function timeoutEnd(pos, flagged) {
    const winner = other(flagged);
    if (!pos.hasMatingMaterial(winner === 'w' ? 0 : 1)) return { result: '1/2-1/2', reason: 'timeout-insufficient' };
    return { result: winner === 'w' ? '1-0' : '0-1', reason: 'timeout' };
  }
  const sideToMove = (g) => (new GC.Position(g.fen).side === 0 ? 'w' : 'b');
  const runningSince = (g) => (g.moves.length >= 2 && g.turn_started_at ? Date.parse(g.turn_started_at) : null);
  // both clocks as of time t (the running side's time deducted)
  function clocksAt(g, t) {
    const side = sideToMove(g), since = runningSince(g), used = since == null ? 0 : Math.max(0, t - since);
    return {
      clock_w: side === 'w' ? Math.max(0, Math.round(g.clock_w - used)) : g.clock_w,
      clock_b: side === 'b' ? Math.max(0, Math.round(g.clock_b - used)) : g.clock_b,
    };
  }
  // side whose flag has fallen at time t (with the same lag allowance a move gets), else null
  function flagged(g, t) {
    if (g.status !== 'playing') return null;
    const since = runningSince(g);
    if (since == null) return null;
    const side = sideToMove(g);
    return (side === 'w' ? g.clock_w : g.clock_b) - (t - since) + LAG_COMP <= 0 ? side : null;
  }
  function overPatch(g, t, end, extra) {
    return Object.assign(clocksAt(g, t), { status: 'over', result: end.result, reason: end.reason, draw_offer: null }, extra || {});
  }
  function abortPatch(g, t) {
    return Object.assign(clocksAt(g, t), { status: 'aborted', result: '*', reason: 'abort', draw_offer: null });
  }

  // ---- writes: every state change is guarded by the row version, then broadcast to the game topic ----
  async function commit(g, patch) {
    const t = now();
    const row = await repo.updateGame(g.id, g.version, Object.assign({}, patch, { version: g.version + 1, updated_at: iso(t) }));
    if (!row) throw new Fail('conflict', view(await game(g.id)));
    let out = row;
    if (out.status === 'over' && out.rated && out.white_id && out.black_id && out.white_diff == null) out = await rate(out);
    const v = view(out);
    await later(broadcast('g:' + out.id, 'state', v));
    return v;
  }

  async function rate(g) {
    const [w, b] = await Promise.all([rating(g.white_id, g.pool), rating(g.black_id, g.pool)]);
    const sw = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : 0.5;
    const nw = glicko2(w.rating, w.rd, w.vol, b.rating, b.rd, sw);
    const nb = glicko2(b.rating, b.rd, b.vol, w.rating, w.rd, 1 - sw);
    const stamp = iso(now());
    const row = (p, n, s) => ({ user_id: p.user_id, pool: g.pool, rating: n.rating, rd: n.rd, vol: n.vol, games: p.games + 1,
      wins: p.wins + (s === 1 ? 1 : 0), draws: p.draws + (s === 0.5 ? 1 : 0), losses: p.losses + (s === 0 ? 1 : 0), updated_at: stamp });
    await repo.upsertRatings([row(Object.assign({}, w, { user_id: g.white_id }), nw, sw), row(Object.assign({}, b, { user_id: g.black_id }), nb, 1 - sw)]);
    const diffs = { white_diff: Math.round(nw.rating) - Math.round(w.rating), black_diff: Math.round(nb.rating) - Math.round(b.rating),
      white_after: Math.round(nw.rating), black_after: Math.round(nb.rating) };
    return (await repo.setGameFields(g.id, diffs)) || Object.assign({}, g, diffs);
  }

  // Settle a game whose clock ran out or whose first move never came; otherwise return it unchanged.
  async function settle(g) {
    if (g.status !== 'playing') return view(g);
    const t = now();
    if (g.moves.length < 2) {
      const since = Date.parse(g.moves.length === 0 ? g.created_at : g.updated_at);
      return t - since > FIRST_MOVE_MS ? commit(g, abortPatch(g, t)) : view(g);
    }
    const f = flagged(g, t);
    if (!f) return view(g);
    const { pos } = replay(g);
    return commit(g, overPatch(g, t, timeoutEnd(pos, f), f === 'w' ? { clock_w: 0 } : { clock_b: 0 }));
  }

  // ---- actions ----
  const A = {};

  A.hello = async (uid) => {
    let prof = await repo.getProfile(uid);
    for (let i = 0; !prof && i < 8; i++) {
      const name = ADJ[Math.floor(rnd() * ADJ.length)] + NOUN[Math.floor(rnd() * NOUN.length)] + Math.floor(rnd() * (i < 4 ? 100 : 10000));
      prof = (await repo.insertProfile(uid, name)) || (await repo.getProfile(uid));
    }
    if (!prof) throw new Fail('profile');
    const [ratings, live] = await Promise.all([repo.getRatings(uid), repo.liveGame(uid)]);
    return { profile: prof, ratings: ratings || [], live: live || null, now: now() };
  };

  A.rename = async (uid, b) => {
    const name = String(b.name || '').trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N}_\- ]{2,20}$/u.test(name)) throw new Fail('bad_name');
    const r = await repo.renameProfile(uid, name);
    if (r.taken) throw new Fail('name_taken');
    return { profile: r.row };
  };

  A.seek = async (uid, b) => {
    const t = TCS[b.tc];
    if (!t) throw new Fail('bad_tc');
    const pool = poolOf(t[0], t[1]), rated = b.rated !== false;
    for (let i = 0; i < 3; i++) {
      const r = await rating(uid, pool);
      const res = await repo.pair({ user: uid, tc: b.tc, pool, rating: r.rating, rated, base: t[0], inc: t[1], startFen: GC.START_FEN });
      if (!res || !res.game) return { waiting: true, now: now() };
      const g = await game(res.game);
      if (res.opponent) {
        await later(broadcast('u:' + res.opponent, 'paired', { game: g.id }));
        return { game: view(g) };
      }
      // one of our own games is still marked as playing: settle it if it's dead, else send the player back to it
      const s = await settle(g);
      if (s.status === 'playing') return { game: s };
    }
    return { waiting: true, now: now() };
  };

  A.cancel = async (uid) => { await repo.deleteSeek(uid); return { ok: true }; };

  A.challenge = async (uid, b) => {
    const t = TCS[b.tc];
    if (!t) throw new Fail('bad_tc');
    const color = ['w', 'b', 'r'].includes(b.color) ? b.color : 'r';
    await repo.abortWaiting(uid);
    const row = await repo.insertGame({ status: 'waiting', host_id: uid, host_color: color, tc_base: t[0], tc_inc: t[1], pool: poolOf(t[0], t[1]),
      rated: !!b.rated, start_fen: GC.START_FEN, fen: GC.START_FEN, moves: [], sans: [], clock_w: t[0], clock_b: t[0], version: 0 });
    if (!row || !row.id) throw new Error('insert failed');
    return { game: view(row) };
  };

  A.join = async (uid, b) => {
    const g = await game(b.game);
    if (g.status !== 'waiting') {
      if (colorOf(g, uid) || g.host_id === uid) return { game: view(g) };
      throw new Fail('taken', view(g));
    }
    if (g.host_id === uid) return { game: view(g) };
    const hostWhite = g.host_color === 'w' || (g.host_color === 'r' && rnd() < 0.5);
    const w = hostWhite ? g.host_id : uid, bl = hostWhite ? uid : g.host_id;
    const [pw, pb, rw, rb] = await Promise.all([repo.getProfile(w), repo.getProfile(bl), rating(w, g.pool), rating(bl, g.pool)]);
    const out = await commit(g, { status: 'playing', white_id: w, black_id: bl, white_name: pw ? pw.username : 'Guest', black_name: pb ? pb.username : 'Guest',
      white_rating: Math.round(rw.rating), black_rating: Math.round(rb.rating), created_at: iso(now()) });
    await later(broadcast('u:' + g.host_id, 'paired', { game: g.id }));
    return { game: out };
  };

  A.game = async (uid, b) => ({ game: view(await game(b.game)) });

  A.move = async (_, b, auth) => {
    const [uid, g] = await Promise.all([auth, game(b.game)]);
    if (g.status !== 'playing') throw new Fail('not_playing', view(g));
    const color = colorOf(g, uid);
    if (!color) throw new Fail('not_player', view(g));
    if (g.moves.length !== b.ply) throw new Fail('stale', view(g));
    const { pos, counts } = replay(g);
    if ((pos.side === 0 ? 'w' : 'b') !== color) throw new Fail('not_your_turn', view(g));
    const m = typeof b.uci === 'string' ? pos.moveFromUci(b.uci) : 0;
    if (!m) throw new Fail('illegal', view(g));
    const t = now();
    let cw = g.clock_w, cb = g.clock_b;
    const since = runningSince(g);
    if (since != null) {
      let rem = (color === 'w' ? cw : cb) - Math.max(0, t - since - LAG_COMP);
      if (rem <= 0) return { game: await commit(g, overPatch(g, t, timeoutEnd(pos, color), color === 'w' ? { clock_w: 0 } : { clock_b: 0 })) };
      rem = Math.round(rem + g.tc_inc);
      if (color === 'w') cw = rem; else cb = rem;
    }
    const san = pos.san(m);
    pos.makeMove(m);
    const k = pos.hashKey(); counts[k] = (counts[k] || 0) + 1;
    const moves = g.moves.concat([GC.moveToUci(m)]);
    const patch = { moves, sans: (g.sans || []).concat([san]), fen: pos.fen(), clock_w: cw, clock_b: cb,
      draw_offer: g.draw_offer === other(color) ? null : g.draw_offer, // moving declines the opponent's offer, keeps your own
      turn_started_at: moves.length >= 2 ? iso(t) : null };
    const end = endOf(pos, counts);
    if (end) Object.assign(patch, { status: 'over', result: end.result, reason: end.reason, draw_offer: null });
    return { game: await commit(g, patch) };
  };

  A.claim = async (uid, b) => {
    const g = await game(b.game);
    try { return { game: await settle(g) }; } catch (e) { if (e.code === 'conflict') return { game: e.extra }; throw e; }
  };

  A.resign = async (uid, b) => {
    const g = await game(b.game);
    if (g.status === 'waiting') {
      if (g.host_id !== uid) throw new Fail('not_player', view(g));
      return { game: await commit(g, { status: 'aborted', result: '*', reason: 'abort' }) };
    }
    if (g.status !== 'playing') return { game: view(g) };
    const color = colorOf(g, uid);
    if (!color) throw new Fail('not_player', view(g));
    const t = now();
    if (flagged(g, t)) return { game: await settle(g) };
    if (g.moves.length < 2) return { game: await commit(g, abortPatch(g, t)) };
    return { game: await commit(g, overPatch(g, t, { result: color === 'w' ? '0-1' : '1-0', reason: 'resign' })) };
  };

  A.draw = async (uid, b) => {
    const g = await game(b.game);
    if (g.status !== 'playing') return { game: view(g) };
    const color = colorOf(g, uid);
    if (!color) throw new Fail('not_player', view(g));
    const t = now();
    if (flagged(g, t)) return { game: await settle(g) };
    if (b.op === 'decline') return { game: g.draw_offer === other(color) ? await commit(g, { draw_offer: null }) : view(g) };
    if (g.draw_offer === other(color)) return { game: await commit(g, overPatch(g, t, { result: '1/2-1/2', reason: 'agreement' })) };
    if (b.op === 'offer' && g.moves.length >= 2 && !g.draw_offer) return { game: await commit(g, { draw_offer: color }) };
    return { game: view(g) };
  };

  A.rematch = async (uid, b) => {
    const g = await game(b.game);
    if (g.status !== 'over' && g.status !== 'aborted') throw new Fail('not_over', view(g));
    const color = colorOf(g, uid);
    if (!color) throw new Fail('not_player', view(g));
    if (g.rematch_game) return { game: view(g), next: g.rematch_game };
    if (g.rematch_offer !== other(color)) return { game: g.rematch_offer === color ? view(g) : await commit(g, { rematch_offer: color }) };
    const w = g.black_id, bl = g.white_id;
    const [pw, pb, rw, rb] = await Promise.all([repo.getProfile(w), repo.getProfile(bl), rating(w, g.pool), rating(bl, g.pool)]);
    const ng = await repo.insertGame({ status: 'playing', white_id: w, black_id: bl, white_name: pw ? pw.username : g.black_name, black_name: pb ? pb.username : g.white_name,
      white_rating: Math.round(rw.rating), black_rating: Math.round(rb.rating), tc_base: g.tc_base, tc_inc: g.tc_inc, pool: g.pool, rated: g.rated,
      start_fen: GC.START_FEN, fen: GC.START_FEN, moves: [], sans: [], clock_w: g.tc_base, clock_b: g.tc_base, version: 0, created_at: iso(now()) });
    const out = await commit(g, { rematch_game: ng.id, rematch_offer: null });
    return { game: out, next: ng.id };
  };

  A.top = async (uid, b) => {
    const pool = ['bullet', 'blitz', 'rapid'].includes(b.pool) ? b.pool : 'blitz';
    return { pool, rows: (await repo.top(pool, 30)) || [] };
  };

  // auth: a promise of the caller's user id (resolved lazily so `move` can overlap it with the game read)
  async function handle(authPromise, body) {
    authPromise.catch(() => {}); // rejections are handled where it's awaited
    try {
      const b = body && typeof body === 'object' ? body : {};
      const fn = Object.prototype.hasOwnProperty.call(A, b.action) ? A[b.action] : null;
      if (!fn) throw new Fail('bad_action');
      const out = b.action === 'move' ? await fn(null, b, authPromise) : await fn(await authPromise, b);
      return { status: 200, body: out };
    } catch (e) {
      if (e instanceof Fail) {
        const body = { error: e.code };
        if (e.extra && typeof e.extra === 'object') body.game = e.extra;
        // expected refusals (stale move, taken game, ...) are normal answers, not HTTP errors
        return { status: e.code === 'auth' ? 401 : 200, body };
      }
      if (e && e.code === 'auth') return { status: 401, body: { error: 'auth' } };
      console.error(e);
      return { status: 500, body: { error: 'server' } };
    }
  }

  return { handle, Fail, settle, _test: { replay, clocksAt, flagged } };
}
