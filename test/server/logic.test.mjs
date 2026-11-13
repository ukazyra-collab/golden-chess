// Server logic tests: pairing, invites, legality, clocks (with a controllable clock), flags, aborts,
// draw offers, resign, rematch, ratings, concurrent writes.
// Run: node test/server/logic.test.mjs          (in-memory store)
//      PG=1 node test/server/logic.test.mjs     (real Postgres + postgres.js + the production migration)
import { createRequire } from 'node:module';
import { createLogic, glicko2, poolOf, LAG_COMP } from '../../supabase/functions/play/logic.js';
import { createMemoryRepo } from './memory-repo.mjs';

const require = createRequire(import.meta.url);
const GC = require('../../src/core.js');
const PG = process.env.PG === '1';

let T = Date.parse('2026-10-18T12:00:00Z');
const now = () => T;
const A = PG ? 'aaaaaaaa-0000-4000-8000-000000000001' : 'alice';
const B = PG ? 'bbbbbbbb-0000-4000-8000-000000000002' : 'bob';
const C = PG ? 'cccccccc-0000-4000-8000-000000000003' : 'carol';
const D = PG ? 'dddddddd-0000-4000-8000-000000000004' : 'dave';
const H = PG ? 'eeeeeeee-0000-4000-8000-000000000005' : 'house1';
const [E, F, G] = PG ? ['ffffffff-0000-4000-8000-000000000006', 'ffffffff-0000-4000-8000-000000000007', 'ffffffff-0000-4000-8000-000000000008'] : ['erin', 'frank', 'grace'];
const [M1, M2, M3] = PG ? ['99999999-0000-4000-8000-000000000011', '99999999-0000-4000-8000-000000000012', '99999999-0000-4000-8000-000000000013'] : ['mona', 'milo', 'mira'];
const [X1, X2] = PG ? ['77777777-0000-4000-8000-000000000021', '77777777-0000-4000-8000-000000000022'] : ['xena', 'xavi']; // fair play
// GC_FAIR=off: as production runs (fair play off; with PG=1 and PG_SKIP=<its migration> the database lacks it too)
const FAIR = process.env.GC_FAIR !== 'off';
let repo, inspect, cleanup = async () => {}, addHouse, pg;
// test knobs for matchmaking: when a player last opened the app (null: not lately), how long a search has run, a rating
let setSeen, quietAll, ageSeek, setRating, playedAgo;
// playedAgo(u, v, ms): the finished games between two players ended ms ago (the search keeps just-met players apart)
if (PG) {
  const { setupPg } = await import('./pg-harness.mjs');
  ({ repo, inspect, cleanup, pg } = await setupPg([A, B, C, D, H, E, F, G, M1, M2, M3, X1, X2]));
  inspect.activity = async (uid) => (await pg.query('select platform, kinds from public.activity where user_id = $1', [uid])).rows;
  inspect.blurs = async (gid) => (await pg.query('select user_id, ply, n, away_ms from public.fair_blurs where game_id = $1', [gid])).rows;
  inspect.houseGame = async () => (await pg.query('select id from public.games where house is not null limit 1')).rows[0]?.id;
  inspect.makeAdmin = (uid) => pg.query('insert into public.admins (user_id) values ($1) on conflict do nothing', [uid]);
  setSeen = (uid, on) => pg.query('update public.profiles set last_seen = ' + (on ? 'now()' : 'null') + ' where id = $1', [uid]);
  quietAll = () => pg.query('update public.profiles set last_seen = null');
  ageSeek = (uid, ms) => pg.query('update public.seeks set since = since - make_interval(secs => $2) where user_id = $1', [uid, ms / 1000]);
  playedAgo = (u, v, ms) => pg.query("update public.games set updated_at = now() - make_interval(secs => $3) where status = 'over' and ((white_id = $1 and black_id = $2) or (white_id = $2 and black_id = $1))", [u, v, ms / 1000]);
  setRating = (uid, pool, rating) => pg.query('insert into public.ratings (user_id, pool, rating, rd, vol, games) values ($1, $2, $3, 80, 0.06, 10) on conflict (user_id, pool) do update set rating = excluded.rating', [uid, pool, rating]);
  // a house player as the seed script makes one: a profile marked house, its house row, a rating at its target
  addHouse = async (o) => {
    await pg.query('insert into public.profiles (id, username, is_guest, house) values ($1, $2, false, true)', [o.id, o.name]);
    await pg.query('insert into public.house (user_id, level, target, style, online_from, online_hours) values ($1, $2, $3, $4, $5, $6)', [o.id, o.level, o.target, JSON.stringify(o.style || {}), o.online_from || 0, o.online_hours || 24]);
    for (const pool of ['bullet', 'blitz', 'rapid']) await pg.query('insert into public.ratings (user_id, pool, rating, rd, vol, games) values ($1, $2, $3, 70, 0.06, $4)', [o.id, pool, o.target, o.games || 0]);
    return o.id;
  };
} else {
  const m = createMemoryRepo(now);
  repo = m.repo;
  inspect = { profiles: async () => [...m.db.profiles.values()], ratings: async () => [...m.db.ratings.values()], game: async (id) => m.db.games.get(id),
    activity: async (uid) => [...(m.db.activity || new Map()).values()].filter((x) => x.user_id === uid),
    blurs: async (gid) => m.db.blurs.filter((x) => x.game_id === gid), houseGame: async () => [...m.db.games.values()].find((g) => g.house)?.id,
    makeAdmin: async (uid) => m.db.admins.add(uid) };
  addHouse = async (o) => m.addHouse(o);
  setSeen = async (uid, on) => { const p = m.db.profiles.get(uid); if (p) p.last_seen = on ? new Date(T).toISOString() : null; };
  quietAll = async () => { for (const p of m.db.profiles.values()) p.last_seen = null; };
  ageSeek = async (uid, ms) => { const x = m.db.seeks.get(uid); if (x) x.since -= ms; };
  playedAgo = async (u, v, ms) => { for (const g of m.db.games.values()) if (g.status === 'over' && ((g.white_id === u && g.black_id === v) || (g.white_id === v && g.black_id === u))) g.updated_at = new Date(T - ms).toISOString(); };
  setRating = async (uid, pool, rating) => { const k = uid + '|' + pool; m.db.ratings.set(k, Object.assign(m.db.ratings.get(k) || { user_id: uid, pool, rd: 80, vol: 0.06, games: 10, wins: 0, draws: 0, losses: 0 }, { rating })); };
}
const sent = [];
const logic = createLogic({ repo, GC, now, fair: FAIR, mail: true, prog: true, broadcast: async (topic, event, payload) => { sent.push({ topic, event, payload }); } });
const call = async (uid, body) => { const r = await logic.handle(Promise.resolve(uid), body); return r; };
const ok = async (uid, body) => { const r = await call(uid, body); if (r.status !== 200 || r.body.error) throw new Error(body.action + ' failed: ' + JSON.stringify(r.body)); return r.body; };

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

for (const u of [A, B, C]) await ok(u, { action: 'hello' });
const profs = await inspect.profiles();
check('profiles created', profs.length === 3);
check('names unique', new Set(profs.map((p) => p.username.toLowerCase())).size === 3);
check('a made-up name is not one the player chose', profs.every((p) => p.name_chosen === false), profs);

// rename
let r = await call(A, { action: 'rename', name: 'x' });
check('short name rejected', r.body.error && r.body.error === 'bad_name');
r = await call(A, { action: 'rename', name: 'Алиса_1' });
check('unicode name ok', r.status === 200 && r.body.profile.username === 'Алиса_1');
check('a picked name is marked as chosen', r.body.profile.name_chosen === true, r.body.profile);
r = await call(B, { action: 'rename', name: 'алиса_1' });
check('case-insensitive taken', r.body.error && r.body.error === 'name_taken');
check('a refused name changes nothing', (await ok(B, { action: 'hello' })).profile.name_chosen === false);
await ok(B, { action: 'rename', name: 'Bob' });
// keeping the made-up name is a choice too
const cName = (await ok(C, { action: 'hello' })).profile.username;
r = await call(C, { action: 'rename', name: ' ' + cName.toLowerCase() + ' ' });
check('keeping the made-up name (any case): accepted, marked as chosen', r.status === 200 && r.body.profile.name_chosen === true && r.body.profile.username === cName.toLowerCase(), r.body);
check('hello returns the mark', (await ok(C, { action: 'hello' })).profile.name_chosen === true);

// auth
r = await logic.handle(Promise.reject({ code: 'auth' }), { action: 'hello' });
check('auth 401', r.status === 401);
r = await logic.handle(Promise.reject({ code: 'auth' }), { action: 'move', game: 'x', uci: 'e2e4', ply: 0 });
check('auth 401 on move', r.status === 401, r);
r = await call(A, { action: 'nope' });
check('bad action', r.body.error && r.body.error === 'bad_action');

// seek + pair
r = await ok(A, { action: 'seek', tc: '3+2', rated: true });
check('A waits', r.waiting === true);
r = await ok(C, { action: 'seek', tc: '5+0', rated: true });
check('C waits on other tc', r.waiting === true);
r = await ok(B, { action: 'seek', tc: '3+2', rated: true });
check('B paired', r.game && r.game.status === 'playing', r);
const g1 = r.game;
check('pool blitz', g1.pool === 'blitz' && g1.tc_base === 180000 && g1.tc_inc === 2000);
check('paired broadcast to A', sent.some((s) => s.topic === 'u:' + A && s.event === 'paired' && s.payload.game === g1.id));
r = await ok(A, { action: 'seek', tc: '3+2', rated: true });
check('A seeking again gets the same live game', r.game && r.game.id === g1.id);
const W = g1.white_id, Bk = g1.black_id;
check('colors assigned', [W, Bk].sort().join() === [A, B].sort().join());

// moves
r = await call(Bk, { action: 'move', game: g1.id, uci: 'e7e5', ply: 0 });
check('black cannot move first', r.body.error && r.body.error === 'not_your_turn', r.body);
r = await call(W, { action: 'move', game: g1.id, uci: 'e2e5', ply: 0 });
check('illegal rejected', r.body.error && r.body.error === 'illegal' && r.body.game);
r = await call(C, { action: 'move', game: g1.id, uci: 'e2e4', ply: 0 });
check('outsider rejected', r.body.error && r.body.error === 'not_player');
T += 5000;
r = await ok(W, { action: 'move', game: g1.id, uci: 'e2e4', ply: 0 });
check('first move: no clock running', r.game.clock_w === 180000 && r.game.turn_started_at === null && r.game.moves.length === 1);
r = await call(W, { action: 'move', game: g1.id, uci: 'd2d4', ply: 1 });
check('not your turn after moving', !!r.body.error);
r = await call(Bk, { action: 'move', game: g1.id, uci: 'e7e5', ply: 0 });
check('stale ply rejected', r.body.error && r.body.error === 'stale');
T += 7000;
r = await ok(Bk, { action: 'move', game: g1.id, uci: 'e7e5', ply: 1 });
check('second move starts clock', r.game.clock_b === 180000 && Date.parse(r.game.turn_started_at) === T, r.game.turn_started_at);
T += 10000;
r = await ok(W, { action: 'move', game: g1.id, uci: 'g1f3', ply: 2 });
check('clock: 10s used, lag credited, +2s inc', r.game.clock_w === 180000 - 10000 + LAG_COMP + 2000, r.game.clock_w);
T += 3000;
// a golden move: black knight b8 teleports to d4? must not give check and target empty
r = await call(Bk, { action: 'move', game: g1.id, uci: 'b8c3*', ply: 3 });
check('golden move ok', r.status === 200 && r.body.game.sans[3].includes('★'), r.body);
check('golden rights consumed', r.body.game.fen.endsWith(' G'), r.body.game.fen);
r = await call(W, { action: 'move', game: g1.id, uci: 'f3g5*', ply: 4 });
T += 1000;
check('golden rights consumed (white)', r.status === 200 && / -$/.test(r.body.game.fen), r.body.game && r.body.game.fen);
r = await call(Bk, { action: 'move', game: g1.id, uci: 'c3e2*', ply: 5 });
check('second golden move rejected', r.body.error && r.body.error === 'illegal');

// draw offers
let st = (await ok(A, { action: 'game', game: g1.id })).game;
r = await ok(W, { action: 'draw', game: g1.id, op: 'offer' });
check('offer recorded', r.game.draw_offer === 'w');
r = await ok(W, { action: 'draw', game: g1.id, op: 'offer' });
check('double offer no-op', r.game.draw_offer === 'w' && r.game.version === st.version + 1);
r = await ok(Bk, { action: 'draw', game: g1.id, op: 'decline' });
check('decline clears', r.game.draw_offer === null);
r = await ok(W, { action: 'draw', game: g1.id, op: 'offer' });
check('re-offer after decline allowed', r.game.draw_offer === 'w');
// black moves: declines white's offer implicitly
r = await ok(Bk, { action: 'move', game: g1.id, uci: 'd7d6', ply: 5 });
check('moving declines opponent offer', r.game.draw_offer === null);
r = await ok(W, { action: 'draw', game: g1.id, op: 'offer' });
r = await ok(W, { action: 'move', game: g1.id, uci: 'd2d3', ply: 6 });
check('own offer survives own move', r.game.draw_offer === 'w');
T += 2000;
r = await ok(Bk, { action: 'draw', game: g1.id, op: 'accept' });
check('accept -> draw by agreement', r.game.status === 'over' && r.game.result === '1/2-1/2' && r.game.reason === 'agreement');
check('ratings updated (draw, equal)', r.game.white_diff === 0 && r.game.black_diff === 0, [r.game.white_diff, r.game.black_diff]);
check('clocks frozen at end', r.game.clock_b < 180000 + 2000 * 3);
const rrows = await inspect.ratings();
check('rating rows', rrows.length === 2 && rrows.every((x) => x.games === 1 && x.draws === 1 && x.rd < 350), rrows);

// rematch
r = await ok(W, { action: 'rematch', game: g1.id });
check('rematch offered', r.game.rematch_offer === (W === g1.white_id ? 'w' : 'b') && !r.next);
r = await ok(Bk, { action: 'rematch', game: g1.id });
check('rematch created', !!r.next && r.game.rematch_game === r.next);
const g2 = (await ok(A, { action: 'game', game: r.next })).game;
check('rematch colors swapped', g2.white_id === Bk && g2.black_id === W && g2.status === 'playing' && g2.moves.length === 0);
r = await ok(W, { action: 'rematch', game: g1.id });
check('rematch idempotent', r.next === g2.id);

// first-move abort
T += 10000;
r = await ok(A, { action: 'claim', game: g2.id });
check('no abort before 30s', r.game.status === 'playing');
T += 21000;
r = await ok(A, { action: 'claim', game: g2.id });
check('abort after 30s without a first move', r.game.status === 'aborted' && r.game.reason === 'abort');

// a new game for flag tests: invite flow
r = await ok(C, { action: 'challenge', tc: '1+0', color: 'w', rated: true });
const inv = r.game;
check('challenge waiting', inv.status === 'waiting' && inv.host_id === C);
check('challenge has a 4-digit code', /^\d{4}$/.test(inv.code || ''), inv.code);
r = await ok(C, { action: 'join', game: inv.id });
check('host join is no-op', r.game.status === 'waiting');
r = await call(A, { action: 'join', code: inv.code === '0000' ? '0001' : String((+inv.code + 1) % 10000).padStart(4, '0') });
check('a wrong code: no_code', r.body.error === 'no_code', r.body);
r = await ok(A, { action: 'join', code: inv.code });
check('joined, host plays white', r.game.status === 'playing' && r.game.white_id === C && r.game.black_id === A && r.game.pool === 'bullet');
r = await call(B, { action: 'join', game: inv.id });
check('third joiner gets taken + state', r.body.error && r.body.error === 'taken' && r.body.game.id === inv.id);
r = await call(B, { action: 'join', code: inv.code });
check('a code is free again once its game started', r.body.error === 'no_code', r.body);
await ok(C, { action: 'move', game: inv.id, uci: 'e2e4', ply: 0 });
T += 1000;
await ok(A, { action: 'move', game: inv.id, uci: 'e7e5', ply: 1 });
T += 59000;
r = await ok(A, { action: 'claim', game: inv.id });
check('no flag at exactly 59s', r.game.status === 'playing');
T += 1000 + LAG_COMP;
r = await ok(A, { action: 'claim', game: inv.id });
check('flag after 60s + lag allowance', r.game.status === 'over' && r.game.reason === 'timeout' && r.game.result === '0-1' && r.game.clock_w === 0, r.game);
check('bullet ratings: winner up', r.game.black_diff > 0 && r.game.white_diff < 0, [r.game.white_diff, r.game.black_diff]);

// late move = timeout
r = await ok(B, { action: 'challenge', tc: '1+0', color: 'b', rated: false });
const g3 = r.game;
r = await ok(C, { action: 'join', game: g3.id });
check('casual game', r.game.rated === false && r.game.white_id === C);
await ok(C, { action: 'move', game: g3.id, uci: 'd2d4', ply: 0 });
await ok(B, { action: 'move', game: g3.id, uci: 'd7d5', ply: 1 });
T += 61000;
r = await ok(C, { action: 'move', game: g3.id, uci: 'c2c4', ply: 2 });
check('move after flag -> timeout loss', r.game.status === 'over' && r.game.reason === 'timeout' && r.game.result === '0-1' && r.game.moves.length === 2);
check('casual: no rating change', r.game.white_diff === null);

// resign + abort
r = await ok(A, { action: 'challenge', tc: '5+0' });
const g4 = r.game;
await ok(B, { action: 'join', game: g4.id });
r = await ok(A, { action: 'resign', game: g4.id });
check('resign before 2 moves aborts', r.game.status === 'aborted');
r = await ok(A, { action: 'challenge', tc: '5+0' });
const g5 = r.game;
r = await ok(A, { action: 'challenge', tc: '3+0' });
check('new challenge aborts the old waiting one', (await inspect.game(g5.id)).status === 'aborted');
const g6 = r.game;
await ok(B, { action: 'join', game: g6.id });
const g6s = (await ok(B, { action: 'game', game: g6.id })).game;
const wh = g6s.white_id, bl = g6s.black_id;
// fool's mate is not mate while White still has the golden move (a piece can teleport to g3/f2 and block)
await ok(wh, { action: 'move', game: g6.id, uci: 'f2f3', ply: 0 });
await ok(bl, { action: 'move', game: g6.id, uci: 'e7e5', ply: 1 });
await ok(wh, { action: 'move', game: g6.id, uci: 'g2g4', ply: 2 });
r = await ok(bl, { action: 'move', game: g6.id, uci: 'd8h4', ply: 3 });
check('golden block keeps the game alive', r.game.status === 'playing' && r.game.sans[3] === 'Qh4+', r.game.sans);
await ok(wh, { action: 'move', game: g6.id, uci: 'f1g3*', ply: 4 });
r = await ok(bl, { action: 'move', game: g6.id, uci: 'h4g3', ply: 5 });
check('capture on g3 is check again', r.game.sans[5] === 'Qxg3+' || r.game.sans[5] === 'Qxg3#', r.game.sans);
r = await ok(A, { action: 'challenge', tc: '3+0', color: 'w' });
const g6b = r.game;
await ok(B, { action: 'join', game: g6b.id });
const mate = ['b1a3*', 'e7e5', 'f2f3', 'a7a6', 'g2g4', 'd8h4'];
for (let i = 0; i < mate.length; i++) r = await ok(i % 2 ? B : A, { action: 'move', game: g6b.id, uci: mate[i], ply: i });
check('checkmate detected (golden move used)', r.game.status === 'over' && r.game.reason === 'checkmate' && r.game.result === '0-1', r.game.sans);
r = await call(A, { action: 'move', game: g6b.id, uci: 'a2a3', ply: 6 });
check('no moves after the end', r.body.error && r.body.error === 'not_playing');

// repetition
r = await ok(A, { action: 'challenge', tc: '10+0', color: 'w' });
const g7 = r.game;
await ok(B, { action: 'join', game: g7.id });
const seq = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
for (let i = 0; i < seq.length; i++) r = await ok(i % 2 ? B : A, { action: 'move', game: g7.id, uci: seq[i], ply: i });
check('threefold repetition', r.game.status === 'over' && r.game.reason === 'repetition', r.game.reason);

// concurrent writes: optimistic concurrency
r = await ok(A, { action: 'challenge', tc: '10+0', color: 'w' });
const g8 = r.game;
await ok(B, { action: 'join', game: g8.id });
await ok(A, { action: 'move', game: g8.id, uci: 'e2e4', ply: 0 });
await ok(B, { action: 'move', game: g8.id, uci: 'e7e5', ply: 1 });
const [x1, x2] = await Promise.all([call(A, { action: 'move', game: g8.id, uci: 'g1f3', ply: 2 }), call(A, { action: 'move', game: g8.id, uci: 'g1f3', ply: 2 })]);
check('duplicate move: exactly one applied', [x1, x2].filter((x) => !x.body.error).length === 1 && (await inspect.game(g8.id)).moves.length === 3, [x1.body.error, x2.body.error]);

// a reply that reaches the server before the move it answers (the player saw that move peer-to-peer)
{
  const T0 = T;
  const early = call(A, { action: 'move', game: g8.id, uci: 'f1c4', ply: 4 }); // White answers before Black's move landed
  await new Promise((res) => setTimeout(res, 120));
  T = T0 + 5000; // Black spent 5 s
  await ok(B, { action: 'move', game: g8.id, uci: 'b8c6', ply: 3 });
  const re = await early;
  check('early reply applied after the move it answers', !re.body.error && re.body.game.moves.join(' ') === 'e2e4 e7e5 g1f3 b8c6 f1c4', re.body);
  check('early reply costs no clock time; the mover paid for its think', re.body.game && re.body.game.clock_w === 600000 && re.body.game.clock_b === 600000 - 5000 + LAG_COMP,
    re.body.game && [re.body.game.clock_w, re.body.game.clock_b]);
  const t1 = Date.now();
  r = await call(A, { action: 'move', game: g8.id, uci: 'e1g1', ply: 6 }); // Black's ply 5 never comes
  check('reply to a move that never lands: refused as stale after a short wait', r.body.error === 'stale' && Date.now() - t1 >= 1000 && r.body.game.moves.length === 5,
    [r.body.error, Date.now() - t1]);
  r = await call(A, { action: 'move', game: g8.id, uci: 'g1f3', ply: 9 }); // far ahead: no waiting
  check('far-ahead ply refused at once', r.body.error === 'stale');
}

// accounts: the token says whether the caller is still a guest (anonymous sign-in) or has an email login
{
  const prof = async (u) => (await inspect.profiles()).find((p) => p.id === u);
  const as = (sub, guest, body) => logic.handle(Promise.resolve({ sub, guest }), body);
  check('profiles start as guests', (await prof(A)).is_guest === true);
  let h = await as(A, true, { action: 'hello' });
  check('guest token: still a guest', h.status === 200 && h.body.profile.is_guest === true && (await prof(A)).is_guest === true, h.body);
  const ratingsBefore = JSON.stringify(h.body.ratings);
  h = await as(A, false, { action: 'hello' });
  check('email added: no longer a guest, same profile and ratings', h.body.profile && h.body.profile.id === A && h.body.profile.is_guest === false &&
    (await prof(A)).is_guest === false && JSON.stringify(h.body.ratings) === ratingsBefore, h.body);
  h = await logic.handle(Promise.resolve(A), { action: 'hello' });
  check('a token that does not say leaves it alone', h.body.profile.is_guest === false);
  h = await as(D, false, { action: 'hello' });
  check('signing up with an email: a registered profile from the start', h.body.profile && h.body.profile.is_guest === false && (await prof(D)).is_guest === false, h.body);
  h = await as(A, false, { action: 'move', game: 'x', uci: 'e2e4', ply: 0 });
  check('moves work with the new caller shape', h.body.error === 'no_game', h.body);
}

// ---- house players: seated by `house` when the search found no one; played by the human's device
{
  await addHouse({ id: H, name: 'abc256', level: 3, target: 1300, style: { tempo: 0.9 }, games: 120 });
  await ok(D, { action: 'hello' });
  await quietAll(); // nobody else has the app open: the house needn't wait (see "humans first" below)
  const hp = (await inspect.profiles()).find((p) => p.id === H);
  check('house: the profile is marked as run by the developer', hp && hp.house === true && hp.username === 'abc256', hp);
  r = await ok(D, { action: 'seek', tc: '3+2' });
  check('house: a lone seek waits', r.waiting === true, r);
  r = await ok(D, { action: 'house', tc: '3+2' });
  let g = r.game;
  check('house: seated when nobody came', g && g.status === 'playing' && [g.white_id, g.black_id].includes(H) && [g.white_id, g.black_id].includes(D), r);
  check('house: the game says which side it plays, and how', g && g.house === (g.white_id === H ? 'w' : 'b') && g.house_style && g.house_style.level === 3 && g.house_style.tempo === 0.9, g && [g.house, g.house_style]);
  check('house: its rating on the game is its own', g && (g.white_id === H ? g.white_rating : g.black_rating) === 1300, g && [g.white_rating, g.black_rating]);
  r = await ok(D, { action: 'house', tc: '3+2' });
  check('house: asked again, the same game comes back', r.game && r.game.id === g.id, r.game && r.game.id);
  const hw = g.house === 'w';
  const mv = async (asHouse, uci, extra) => {
    const gg = await inspect.game(g.id);
    return call(D, Object.assign({ action: 'move', game: g.id, uci, ply: gg.moves.length }, asHouse ? { house: true } : {}, extra || {}));
  };
  // whoever is white moves first; the human's device sends both sides' moves
  const seq = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'g8f6', 'c2c3', 'd7d6'];
  for (let i = 0; i < 4; i++) {
    const white = i % 2 === 0, asHouse = white === hw;
    r = await mv(asHouse, seq[i], asHouse ? { think: 1500 } : {});
    check('house: move ' + (i + 1) + (asHouse ? ' (house)' : ' (human)') + ' accepted', r.status === 200 && !r.body.error && r.body.game.moves.length === i + 1, r.body);
    T += 2000;
  }
  r = await call(B, { action: 'move', game: g.id, uci: seq[4], ply: 4, house: true });
  check('house: someone else cannot move for the house player', r.body.error === 'not_player', r.body);
  g = await inspect.game(g.id);
  const sideToMove = g.moves.length % 2 === 0 ? 'w' : 'b';
  r = await mv(sideToMove !== g.house, seq[4]);
  check('house: a human move flagged as the house (or the reverse) is refused', r.body.error === 'not_player' || r.body.error === 'not_your_turn', r.body);
  // clocks: the house side's time is what its device says the move took (not the wall clock), plus the increment
  g = await inspect.game(g.id);
  const hc = () => (hw ? 'clock_w' : 'clock_b'), pc = () => (hw ? 'clock_b' : 'clock_w');
  const before = g[hc()];
  if (sideToMove === g.house) { T += 20000; r = await mv(true, seq[4], { think: 5000 }); }
  else { T += 20000; r = await mv(false, seq[4]); g = await inspect.game(g.id); T += 20000; r = await mv(true, seq[5], { think: 5000 }); }
  g = await inspect.game(g.id);
  check('house: its clock went down by the think time, not the 20 s on the wall', before - g[hc()] === 5000 - 2000, [before, g[hc()]]);
  // the human walks away during the house player's turn: the game waits for them, however long
  const hum = g.moves.length % 2 === 0 ? 'w' : 'b';
  if (hum !== g.house) { r = await mv(false, seq[g.moves.length]); g = await inspect.game(g.id); }
  check('house: the house side is to move', (g.moves.length % 2 === 0 ? 'w' : 'b') === g.house);
  T += 600000;
  r = await ok(D, { action: 'claim', game: g.id });
  check('house: ten minutes without the house move change nothing: its clock does not run on the wall, the game waits', r.game.status === 'playing', r.game.status);
  // back: the house move is taken; then the human's device goes quiet on their own turn: 20 s of that and they have left
  r = await mv(true, seq[g.moves.length], { think: 1200 });
  check('house: on the human\'s return the house move is taken', r.status === 200 && !r.body.error && r.body.game.status === 'playing', r.body);
  r = await ok(D, { action: 'seen', game: g.id });
  check('house: the human\'s device says it is there', r.ok === true, r);
  T += 15000;
  r = await ok(D, { action: 'claim', game: g.id });
  check('house: 15 s of silence on their own turn: still playing', r.game.status === 'playing', r.game.status);
  T += 6000;
  r = await ok(D, { action: 'seen', game: g.id });
  check('house: 21 s of silence on their own turn: the human has left and loses', r.game && r.game.status === 'over' && r.game.reason === 'left' && r.game.result === (hw ? '1-0' : '0-1'), r.game && [r.game.status, r.game.reason, r.game.result]);
  const rh = Object.assign({}, (await inspect.ratings()).find((x) => x.user_id === H && x.pool === 'blitz')), rd = (await inspect.ratings()).find((x) => x.user_id === D && x.pool === 'blitz');
  check('house: both rated; the house player won a little and stays near its target', rh && rh.rating > 1300 && rh.rating < 1340 && rh.games === 121 && rd && rd.rating < 1500 && rd.games === 1, [rh, rd]);
  // next game: the house player resigns; its rating drifts back towards the target; a rematch keeps it, colours swapped
  r = await ok(D, { action: 'house', tc: '3+2' });
  g = r.game;
  check('house: a second game found', g && g.status === 'playing' && g.house, g && g.house);
  const first = g.house === 'w';
  r = await mv(first, 'e2e4', first ? { think: 800 } : {}); r = await mv(!first, 'e7e5', first ? {} : { think: 800 });
  r = await call(D, { action: 'house_act', game: g.id, op: 'resign' });
  g = r.body.game;
  check('house: it resigns on its device\'s word', g.status === 'over' && g.reason === 'resign' && g.result === (g.house === 'w' ? '0-1' : '1-0'), [g.status, g.reason, g.result]);
  const rh2 = Object.assign({}, (await inspect.ratings()).find((x) => x.user_id === H && x.pool === 'blitz'));
  check('house: after a loss its rating is pulled towards the target (1300)', rh2.rating < rh.rating && rh2.rating > 1270 && rh2.rd >= 60, [rh.rating, rh2.rating, rh2.rd]);
  r = await ok(D, { action: 'rematch', game: g.id });
  check('house: the human asks for a rematch', r.game.rematch_offer === (g.house === 'w' ? 'b' : 'w'), r.game.rematch_offer);
  r = await call(D, { action: 'house_act', game: g.id, op: 'rematch' });
  check('house: the house player takes it: a new game', r.status === 200 && r.body.next, r.body);
  const ng = await inspect.game(r.body.next);
  check('house: the rematch swaps colours and keeps the house player', ng && ng.house === (g.house === 'w' ? 'b' : 'w') && ng.house_style && ng.house_style.level === 3 && [ng.white_id, ng.black_id].includes(H), ng && [ng.house, ng.white_id, ng.black_id]);
  r = await call(B, { action: 'house_act', game: g.id, op: 'resign' });
  check('house: nobody else acts for it', r.body.error === 'not_player', r.body);
  // the house player loses on time: its device says the move took longer than it had
  g = ng;
  const w1 = g.house === 'w';
  await mv(w1, 'e2e4', w1 ? { think: 500 } : {}); await mv(!w1, 'e7e5', w1 ? {} : { think: 500 }); await mv(w1, 'g1f3', w1 ? { think: 500 } : {}); await mv(!w1, 'b8c6', w1 ? {} : { think: 500 });
  g = await inspect.game(g.id);
  if ((g.moves.length % 2 === 0 ? 'w' : 'b') !== g.house) { await mv(false, g.moves.length % 2 === 0 ? 'f1c4' : 'f8c5'); g = await inspect.game(g.id); }
  r = await mv(true, g.moves.length % 2 === 0 ? 'f1c4' : 'f8c5', { think: 999999 });
  check('house: a move that took longer than its clock: it loses on time', r.body.game && r.body.game.status === 'over' && r.body.game.reason === 'timeout' && r.body.game.result === (g.house === 'w' ? '0-1' : '1-0'), r.body.game && [r.body.game.status, r.body.game.reason, r.body.game.result]);
  // nobody for the human's seek when every house player is busy: waiting
  r = await ok(C, { action: 'seek', tc: '1+0' });
  r = await ok(C, { action: 'house', tc: '1+0' });
  check('house: a free house player is seated for anyone', r.game && r.game.house, r);
  // the house player walks away (its device's word): before move two the game is aborted, later it is a loss
  g = r.game;
  r = await call(C, { action: 'house_act', game: g.id, op: 'leave' });
  check('house: leaving before move two aborts the game', r.body.game && r.body.game.status === 'aborted', r.body);
  r = await ok(C, { action: 'house', tc: '1+0' });
  g = r.game;
  const w2 = g.house === 'w';
  await call(C, Object.assign({ action: 'move', game: g.id, uci: 'e2e4', ply: 0 }, w2 ? { house: true, think: 500 } : {}));
  await call(C, Object.assign({ action: 'move', game: g.id, uci: 'e7e5', ply: 1 }, w2 ? {} : { house: true, think: 500 }));
  r = await call(C, { action: 'house_act', game: g.id, op: 'leave' });
  check('house: leaving later loses the game', r.body.game && r.body.game.status === 'over' && r.body.game.reason === 'left' && r.body.game.result === (w2 ? '0-1' : '1-0'), r.body.game && [r.body.game.status, r.body.game.reason, r.body.game.result]);
}

// ---- leaving: the side to move whose device has been quiet for 20 s loses; away during the opponent's turn is fine
{
  await ok(C, { action: 'seek', tc: '3+2' });
  r = await ok(D, { action: 'seek', tc: '3+2' });
  let g = r.game;
  check('left: C and D paired', g && g.status === 'playing' && [g.white_id, g.black_id].includes(C) && [g.white_id, g.black_id].includes(D), r);
  const W = g.white_id, Bk = g.black_id;
  const mv2 = async (uid, uci) => { const gg = await inspect.game(g.id); return call(uid, { action: 'move', game: g.id, uci, ply: gg.moves.length }); };
  r = await call(A, { action: 'seen', game: g.id });
  check('left: only a player of the game is seen', r.body.error === 'not_player', r.body);
  for (const u of [W, Bk]) { r = await ok(u, { action: 'seen', game: g.id }); check('left: seen answers ok while playing', r.ok === true && r.now === T, r); }
  await mv2(W, 'e2e4'); await mv2(Bk, 'e7e5');
  // Black's device goes quiet during White's turn: White thinks for a minute (seen all along); the game waits for Black
  for (let i = 0; i < 12; i++) { T += 5000; r = await ok(W, { action: 'seen', game: g.id }); }
  check('left: a minute away during the opponent\'s turn changes nothing', r.ok === true && (await inspect.game(g.id)).status === 'playing', r);
  r = await mv2(W, 'g1f3');
  check('left: the long think is a normal move (white has the game in front)', r.status === 200 && !r.body.error && r.body.game.moves.length === 3, r.body);
  // now it is Black's turn and Black has been quiet for over a minute: 20 s into the turn White's own heartbeat settles it
  T += 19000; r = await ok(W, { action: 'seen', game: g.id });
  check('left: 19 s into the turn: still waiting for black', r.ok === true && (await inspect.game(g.id)).status === 'playing', r);
  T += 1000; r = await ok(W, { action: 'seen', game: g.id });
  check('left: 20 s into the turn: black has left, white wins', r.game && r.game.status === 'over' && r.game.reason === 'left' && r.game.result === '1-0', r.game && [r.game.status, r.game.reason, r.game.result]);
  const rW = (await inspect.ratings()).find((x) => x.user_id === W && x.pool === 'blitz'), rB = (await inspect.ratings()).find((x) => x.user_id === Bk && x.pool === 'blitz');
  check('left: rated as a win and a loss', rW && rB && rW.rating > rB.rating && rW.wins >= 1 && rB.losses >= 1, [rW, rB]);
  // the other way round: the one who went away comes back too late and learns of the loss from their own move
  await playedAgo(C, D, 20 * 60000); await ok(C, { action: 'seek', tc: '3+2' }); await ageSeek(C, 60000); r = await ok(D, { action: 'seek', tc: '3+2' });
  g = r.game; const W2 = g.white_id, B2 = g.black_id;
  for (const u of [W2, B2]) await ok(u, { action: 'seen', game: g.id });
  await mv2(W2, 'e2e4'); await mv2(B2, 'e7e5'); await mv2(W2, 'g1f3');
  T += 12000; await ok(W2, { action: 'seen', game: g.id });
  r = await mv2(B2, 'b8c6');
  check('left: a move 12 s into the turn is fine, quiet or not', r.status === 200 && !r.body.error && r.body.game.moves.length === 4, r.body);
  await mv2(W2, 'f1c4');
  T += 25000;
  r = await mv2(B2, 'f8c5');
  check('left: 25 s of silence on one\'s own turn: the move comes too late, the game is lost', r.status === 200 && r.body.game && r.body.game.status === 'over' && r.body.game.reason === 'left' && r.body.game.result === '1-0', r.body);
  // before move two the first-move rule decides (an abort, no loss), and a player whose device never said hello is judged by the clock alone
  await playedAgo(C, D, 20 * 60000); await ok(C, { action: 'seek', tc: '3+2' }); await ageSeek(C, 60000); r = await ok(D, { action: 'seek', tc: '3+2' });
  g = r.game;
  await mv2(g.white_id, 'e2e4'); await mv2(g.black_id, 'e7e5'); await mv2(g.white_id, 'g1f3');
  T += 60000; r = await ok(g.white_id, { action: 'claim', game: g.id });
  check('left: no seen row for the side to move (older client): not judged as gone', r.game.status === 'playing', r.game.status);
  T += 130000; r = await ok(g.white_id, { action: 'claim', game: g.id });
  check('left: ... its clock still runs out', r.game.status === 'over' && r.game.reason === 'timeout', [r.game.status, r.game.reason]);
}

// ---- the owner's statistics (admin_stats(): only for accounts in admins; house players left out)
if (PG) {
  const stats = async (uid) => (await pg.query("select set_config('request.jwt.claim.sub', $1, true), public.admin_stats() as s", [uid])).rows[0].s;
  let failed = null;
  try { await stats(A); } catch (e) { failed = String(e.message || e); }
  check('stats: not for an ordinary player', failed && /not_admin/.test(failed), failed);
  await pg.query('insert into public.admins (user_id) values ($1)', [A]);
  await pg.query("insert into auth.identities (user_id, provider) values ($1, 'google'), ($2, 'email')", [A, B]);
  r = await ok(A, { action: 'hello' });
  check('stats: hello tells the owner they are an admin', r.admin === true, r);
  check('stats: an ordinary player is not told so', (await ok(B, { action: 'hello' })).admin === undefined);
  const st = await stats(A);
  check('stats: accounts counted without the house player', st.accounts === 4 && st.house === 1, st);
  check('stats: sign-in methods', st.methods && st.methods.google === 1 && st.methods.email === 1, st.methods);
  check('stats: games, active players, the last 30 days by day', st.games >= 5 && st.active30 >= 2 && Array.isArray(st.days) && st.days.length === 31 && st.days.some((d) => d.games >= 1), [st.games, st.active30, st.days && st.days.length]);
  check('stats: house games counted apart', st.games_house30 >= 3 && st.games_house30 <= st.games30, [st.games_house30, st.games30]);
  // the day log: B came yesterday and is back today; the owner (A) is left out of everything
  await pg.query("update public.profiles set created_at = now() - interval '1 day' where id = $1", [B]);
  await pg.query("insert into public.activity (user_id, day, platform, kinds) values ($1, current_date - 1, 'android', '{open}') on conflict do nothing", [B]);
  await ok(B, { action: 'hello', platform: 'android' });
  const st2 = await stats(A);
  check('stats: people a day for two weeks, by platform', Array.isArray(st2.dau) && st2.dau.length === 14 && st2.dau[13].android >= 1 && st2.dau.every((d) => d.n >= d.ios + d.android + d.web), st2.dau && st2.dau.slice(-2));
  check('stats: D1 retention counts B', st2.ret && st2.ret.d1.n >= 1 && st2.ret.d1.of >= st2.ret.d1.n && st2.ret.back.n >= 1, st2.ret);
  check('stats: cohorts by first day, newest first', Array.isArray(st2.cohorts) && st2.cohorts.length >= 1 && st2.cohorts.some((c) => c.size >= 1 && c.d1 >= 1), st2.cohorts);
  check('stats: what was done this week', st2.kinds7 && st2.kinds7.open >= 1, st2.kinds7);
}

// ---- matchmaking: people play people first; close ratings first; the house only fills in
{
  for (const u of [E, F, G]) await ok(u, { action: 'hello' });
  await setRating(E, 'blitz', 1500); await setRating(F, 'blitz', 1950); await setRating(G, 'blitz', 1560);
  await quietAll();
  // far apart in rating: not paired at once...
  r = await ok(E, { action: 'seek', tc: '3+2' });
  check('mm: E waits', r.waiting === true, r);
  r = await ok(F, { action: 'seek', tc: '3+2' });
  check('mm: 450 points apart, not paired at once', r.waiting === true, r);
  // ...but the window widens with the wait: 6 s of search, 150 + 50*6 = 450
  await ageSeek(E, 6000);
  r = await ok(F, { action: 'seek', tc: '3+2' });
  check('mm: after 6 s of search the two are paired', r.game && [r.game.white_id, r.game.black_id].includes(E) && [r.game.white_id, r.game.black_id].includes(F), r);
  if (r.game) await ok(E, { action: 'resign', game: r.game.id });
  // closest rating first among the people searching
  await ok(F, { action: 'seek', tc: '3+2' }); await ok(G, { action: 'seek', tc: '3+2' }); await ageSeek(F, 60000); await ageSeek(G, 60000);
  r = await ok(E, { action: 'seek', tc: '3+2' });
  check('mm: E (1500) gets G (1560), not F (1950)', r.game && [r.game.white_id, r.game.black_id].includes(G), r.game && [r.game.white_id, r.game.black_id]);
  if (r.game) await ok(E, { action: 'resign', game: r.game.id });
  // two people who have just played each other are not sent to each other again by the search
  {
    const ng = r.game ? r.game.id : null; // E vs G above (resigned: aborted before move two, so it doesn't count)
    await ok(F, { action: 'cancel' });
    await setRating(E, 'blitz', 1500); await setRating(G, 'blitz', 1500);
    await ok(E, { action: 'seek', tc: '3+2' });
    let rr = await ok(G, { action: 'seek', tc: '3+2' });
    const pg1 = rr.game;
    await ok(pg1.white_id, { action: 'move', game: pg1.id, uci: 'e2e4', ply: 0 }); await ok(pg1.black_id, { action: 'move', game: pg1.id, uci: 'e7e5', ply: 1 });
    await ok(G, { action: 'resign', game: pg1.id });
    await playedAgo(E, G, 60000);
    await ok(E, { action: 'seek', tc: '3+2' });
    rr = await ok(G, { action: 'seek', tc: '3+2' });
    check('mm: just played each other: the search does not pair them again', rr.waiting === true && !rr.game, rr);
    rr = await ok(G, { action: 'house', tc: '3+2' });
    check('mm: ...nor does the house fallback: G gets a house player', rr.game && rr.game.house && ![rr.game.white_id, rr.game.black_id].includes(E), rr.game && [rr.game.white_id, rr.game.black_id, rr.game.house]);
    if (rr.game) await ok(G, { action: 'resign', game: rr.game.id });
    await ok(E, { action: 'cancel' });
    await playedAgo(E, G, 16 * 60000);
    await ok(E, { action: 'seek', tc: '3+2' });
    rr = await ok(G, { action: 'seek', tc: '3+2' });
    check('mm: a quarter of an hour later they may meet again', rr.game && [rr.game.white_id, rr.game.black_id].includes(E), rr);
    if (rr.game) await ok(E, { action: 'resign', game: rr.game.id });
    void ng;
  }
  // the house is never seated while a person is searching for the same game, whatever the gap
  await ok(F, { action: 'cancel' });
  await ok(F, { action: 'seek', tc: '3+2' });
  sent.length = 0;
  r = await ok(E, { action: 'house', tc: '3+2' });
  check('mm: house asked while F searches: E plays F, not a house player', r.game && [r.game.white_id, r.game.black_id].includes(F) && !r.game.house, r.game && [r.game.white_id, r.game.black_id, r.game.house]);
  check('mm: F is told about it', sent.some((x) => x.topic === 'u:' + F && x.event === 'paired' && r.game && x.payload.game === r.game.id), sent);
  if (r.game) await ok(E, { action: 'resign', game: r.game.id });
  // different game (time control): the house may fill in
  await ok(F, { action: 'seek', tc: '1+0' });
  await ok(E, { action: 'seek', tc: '3+2' });
  r = await ok(E, { action: 'house', tc: '3+2' });
  check('mm: someone searching another time control does not hold the house back', r.game && r.game.house, r.game && r.game.house);
  if (r.game) await ok(E, { action: 'resign', game: r.game.id });
  await ok(F, { action: 'cancel' });
  // someone else has the app open (not in a game): the house waits 6 s of search
  await setSeen(G, true);
  r = await ok(E, { action: 'seek', tc: '3+2' });
  r = await ok(E, { action: 'house', tc: '3+2' });
  check('mm: G has the app open: the house waits', r.waiting === true && !r.game, r);
  await ageSeek(E, 6500);
  r = await ok(E, { action: 'house', tc: '3+2' });
  check('mm: 6.5 s on, the house steps in', r.game && r.game.house, r);
  if (r.game) await ok(E, { action: 'resign', game: r.game.id });
  await quietAll();
}

// ---- one person, two accounts: merged into the one with more games
{
  for (const u of [M1, M2, M3]) await ok(u, { action: 'hello' });
  if (PG) {
    await pg.query("update auth.users set email = 'zz1@privaterelay.appleid.com', created_at = now() - interval '1 day' where id = $1", [M1]);
    await pg.query("insert into auth.identities (provider, provider_id, user_id, identity_data) values ('apple', 'apple-sub-1', $1, '{\"email\":\"zz1@privaterelay.appleid.com\"}')", [M1]);
    await pg.query("update auth.users set email = 'milo@example.com' where id = $1", [M2]);
    await pg.query("insert into auth.identities (provider, provider_id, user_id, identity_data) values ('email', $2, $1, '{\"email\":\"milo@example.com\"}'), ('google', 'g-sub-2', $1, '{\"email\":\"milo@example.com\"}')", [M2, M2]);
  }
  r = await call(M1, { action: 'merge' });
  check('merge: without the other account proven, refused', r.body.error === 'unproven', r.body);
  await ok(M2, { action: 'rename', name: 'MiloReal' });
  // M2 plays a game (and so has more): it is the one that stays
  await setRating(M2, 'blitz', 1500); await setRating(M3, 'blitz', 1500); await quietAll();
  await ok(M2, { action: 'seek', tc: '3+2' });
  r = await ok(M3, { action: 'seek', tc: '3+2' });
  const mg = r.game;
  r = await call(M1, { action: 'merge', __other: M2 });
  check('merge: not while either account is in a live game', r.body.error === 'live_game', r.body);
  await ok(mg.white_id, { action: 'move', game: mg.id, uci: 'e2e4', ply: 0 }); await ok(mg.black_id, { action: 'move', game: mg.id, uci: 'e7e5', ply: 1 });
  await ok(M3, { action: 'resign', game: mg.id });
  await setRating(M1, 'rapid', 1720);
  r = await call(M1, { action: 'merge', __other: M2 });
  check('merge: the account with more games stays', r.status === 200 && r.body.keep === M2 && r.body.gone === M1, r.body);
  const profs2 = await inspect.profiles();
  check('merge: the other profile is gone', !profs2.some((p) => p.id === M1) && profs2.some((p) => p.id === M2 && p.username === 'MiloReal'), profs2.filter((p) => [M1, M2].includes(p.id)));
  const rts = (await inspect.ratings()).filter((x) => [M1, M2].includes(x.user_id));
  check('merge: ratings came over (a pool only the other one had)', rts.some((x) => x.user_id === M2 && x.pool === 'rapid' && Math.round(x.rating) === 1720) && !rts.some((x) => x.user_id === M1), rts);
  const g2 = await inspect.game(mg.id);
  check('merge: the games stay with the kept account', g2 && [g2.white_id, g2.black_id].includes(M2), g2 && [g2.white_id, g2.black_id]);
  if (PG) {
    const ids = (await pg.query('select provider, user_id from auth.identities where user_id in ($1, $2) order by provider', [M1, M2])).rows;
    check('merge: Apple now signs in to the kept account, its email and Google stay', ids.length === 3 && ids.every((x) => x.user_id === M2) && ids.map((x) => x.provider).join() === 'apple,email,google', ids);
    const us = (await pg.query('select id, email, raw_app_meta_data from auth.users where id in ($1, $2)', [M1, M2])).rows;
    check('merge: the other sign-in account is deleted, the kept email is the real one', us.length === 1 && us[0].id === M2 && us[0].email === 'milo@example.com' && us[0].raw_app_meta_data.providers.length === 3, us);
  }
  r = await call(M2, { action: 'merge', __other: M2 });
  check('merge: the same account twice changes nothing', r.status === 200 && r.body.keep === M2, r.body);
}

// leaderboard
r = await ok(A, { action: 'top', pool: 'bullet' });
check('leaderboard (the house player among them)', r.rows.length === 3 && r.rows[0].rating >= r.rows[1].rating && r.rows.some((x) => x.name === 'abc256'), r.rows);
check('leaderboard rows carry the player id, and the caller their rank', r.rows.every((x) => x.uid) && (r.rows.some((x) => x.uid === A) ? r.rank === r.rows.findIndex((x) => x.uid === A) + 1 : r.rank === null), [r.rank, r.rows.map((x) => x.uid)]);
r = await ok(C, { action: 'top', pool: 'bullet' });
check('a player rated in the pool gets their place', r.rank >= 1 && r.rank <= r.rows.length + 10 && r.rows.some((x) => x.uid === C) === (r.rank <= r.rows.length), [r.rank, r.rows.length]);
check('the pool\'s size comes with the board, and no own row while the caller is in the top', r.total === 3 && r.me === null, [r.total, r.me]);

// who is around (the search dialog's line)
await ok(A, { action: 'hello' }); // A has the app open
r = await ok(A, { action: 'lobby' });
check('lobby: online players, games on, seekers', r.online >= 1 && r.games >= 0 && r.seeking === 0, r);

// the day's activity: hello counts as 'open' (with the platform), the app adds what was played; anything else is refused
await ok(A, { action: 'hello', platform: 'ios' });
await ok(A, { action: 'act', what: 'bot', platform: 'ios' });
await ok(A, { action: 'act', what: 'bot', platform: 'ios' });
r = await call(A, { action: 'act', what: 'drop table' });
check('act: unknown kind refused', r.body.error === 'bad_kind', r.body);
{ const act = await inspect.activity(A);
  check('act: one row a day, open and bot once each, the platform', act.length === 1 && act[0].platform === 'ios' && act[0].kinds.join() === 'open,bot', act); }

// ---- fair play (prototype): the time each move took, the device's away counts, reports, the owner's decision
if (FAIR) { // (GC_FAIR=off: the release config, fair play off and its migration not applied)
  T = Math.max(T, Date.now()); // the database's own clock judges "the last 30 days" of a closed account's games
  r = await ok(X1, { action: 'hello' });
  await ok(X2, { action: 'hello' });
  check('fair: hello says reports are on', r.fair === true, r.fair);
  r = await ok(X1, { action: 'challenge', tc: '3+2', color: 'w', rated: true });
  r = await ok(X2, { action: 'join', code: r.game.code });
  const fg = r.game;
  check('fair: a rated game, X1 white', fg.white_id === X1 && fg.black_id === X2 && fg.rated && fg.pool === 'blitz', [fg.white_id, fg.rated, fg.pool]);
  T += 2000; await ok(X1, { action: 'move', game: fg.id, uci: 'e2e4', ply: 0 });
  T += 3000; await ok(X2, { action: 'move', game: fg.id, uci: 'e7e5', ply: 1 });
  T += 4000; await ok(X1, { action: 'move', game: fg.id, uci: 'g1f3', ply: 2, bl: 2, aw: 3500 });
  T += 1500; r = await ok(X2, { action: 'move', game: fg.id, uci: 'b8c6', ply: 3 });
  check('fair: the time each move took, measured by the server', JSON.stringify(r.game.mt) === '[2000,3000,4000,1500]', r.game.mt);
  const bl = await inspect.blurs(fg.id);
  check('fair: the device left the game twice during move 3, kept apart from the game', bl.length === 1 && bl[0].user_id === X1 && bl[0].ply === 2 && bl[0].n === 2 && bl[0].away_ms === 3500, bl);
  check('fair: away counts are not in the game everyone can read', !('bl' in r.game) && !('aw' in r.game) && !('fair_blurs' in r.game));
  r = await call(A, { action: 'report', game: fg.id, why: 'engine' });
  check('fair: only a player of the game reports it', r.body.error === 'not_player', r.body);
  r = await ok(X2, { action: 'report', game: fg.id, why: 'engine', note: '  far   too good ' });
  check('fair: a report taken', r.ok === true && !r.again, r);
  r = await ok(X2, { action: 'report', game: fg.id, why: 'abuse' });
  check('fair: once a game', r.again === true, r);
  check('fair: a few a day', (await repo.addReport({ reporter: X2, accused: X1, game_id: g1.id, why: 'engine', note: '', limit: 1 })).limited === true);
  const hgid = await inspect.houseGame();
  if (hgid) { r = await call(D, { action: 'report', game: hgid, why: 'engine' }); check('fair: not a house player (the developer\'s own)', ['house', 'not_player'].includes(r.body.error), r.body); }
  // X2 resigns: the points X2 lost come back when X1's account is closed
  r = await ok(X2, { action: 'resign', game: fg.id });
  const lost = r.game.black_diff;
  check('fair: rated, X2 lost points', r.game.status === 'over' && lost < 0, [r.game.status, lost]);
  const ratingOf = async (u) => (await inspect.ratings()).find((x) => x.user_id === u && x.pool === 'blitz').rating;
  const before = await ratingOf(X2);
  r = await call(X2, { action: 'fair_list' });
  check('fair: the list is the owner\'s', r.body.error === 'not_admin', r.body);
  r = await call(X2, { action: 'fair_set', user: X1, state: 'closed' });
  check('fair: so is the decision', r.body.error === 'not_admin', r.body);
  await inspect.makeAdmin(A);
  r = await ok(A, { action: 'fair_list' });
  let row = r.players.find((x) => x.uid === X1);
  check('fair: the reported player listed, with the report', row && row.open === 1 && row.reporters === 1 && row.why.engine === 1 && row.games.includes(fg.id) && row.fair === 'ok', r.players);
  r = await call(A, { action: 'fair_set', user: X1, state: 'banned' });
  check('fair: unknown decision refused', r.body.error === 'bad_state', r.body);
  r = await ok(A, { action: 'fair_set', user: X1, state: 'watch' });
  row = (await ok(A, { action: 'fair_list' })).players.find((x) => x.uid === X1);
  check('fair: on watch, the reports stay open', r.state === 'watch' && row && row.open === 1 && row.fair === 'watch', row);
  r = await ok(A, { action: 'fair_set', user: X1, state: 'closed' });
  check('fair: closed, one game refunded', r.state === 'closed' && r.refunds === 1, r);
  const after = await ratingOf(X2);
  check('fair: the points X2 lost came back', Math.abs(after - before + lost) < 0.001, [before, after, lost]);
  r = await ok(A, { action: 'fair_set', user: X1, state: 'closed' });
  check('fair: never refunded twice', r.refunds === 0, r);
  r = await ok(X1, { action: 'top', pool: 'blitz' });
  check('fair: a closed account is out of the leaderboard', !r.rows.some((x) => x.uid === X1) && r.rank === null && r.me === null, [r.rank, r.me]);
  for (const action of ['seek', 'house', 'challenge']) {
    r = await call(X1, { action, tc: '3+2', rated: true });
    check('fair: a closed account can\'t play people: ' + action, r.body.error === 'closed', r.body);
  }
  r = await ok(C, { action: 'challenge', tc: '3+2' });
  r = await call(X1, { action: 'join', code: r.game.code });
  check('fair: ... nor join an invite', r.body.error === 'closed', r.body);
  r = await ok(A, { action: 'fair_list' });
  check('fair: handled reports leave the list', !r.players.some((x) => x.uid === X1), r.players.map((x) => x.name));
  r = await ok(A, { action: 'fair_set', user: X1, state: 'ok' });
  r = await ok(X1, { action: 'top', pool: 'blitz' });
  check('fair: cleared, back on the board', r.rows.some((x) => x.uid === X1) || r.rank > 0, [r.rank]);
}

// ---- emails (prototype): language, time zone, the yes / no; a guest has no address to say yes with
{
  r = await ok(X2, { action: 'hello' });
  check('mail: hello says emails are on', r.mail === true, r.mail);
  r = await ok(X2, { action: 'prefs', lang: 'ru', tz: 'Europe/Moscow' });
  check('mail: language and zone kept, no answer yet', r.prefs.lang === 'ru' && r.prefs.tz === 'Europe/Moscow' && r.prefs.email_opt === null, r.prefs);
  r = await ok(X2, { action: 'prefs', email_opt: true, tz: 'not a zone; drop table' });
  check('mail: the yes kept, a junk zone ignored', r.prefs.email_opt === true && r.prefs.tz === 'Europe/Moscow', r.prefs);
  r = await logic.handle(Promise.resolve({ sub: X2, guest: true }), { action: 'prefs', email_opt: true });
  check('mail: not from a guest', r.body.error === 'guest', r.body);
}

// ---- the game layer on the account (prototype): the device's progress kept with the account, its XP on the profile
{
  const prof = async (u) => (await inspect.profiles()).find((p) => p.id === u);
  await ok(X1, { action: 'hello' });
  r = await ok(X2, { action: 'hello' });
  check('progress: hello says the account keeps it', r.prog === true && (r.profile.xp || 0) === 0, [r.prog, r.profile.xp]);
  r = await ok(X2, { action: 'progress' });
  check('progress: nothing kept yet', r.data === null && r.xp === 0, r);
  const save = { v: 1, prog: { xp: 1234, career: { 1: 7, 2: 3 }, cards: { knight: 2 }, q: null, firstWin: '2026-11-12', equip: {}, seen: { lv: 9, stars: 5 } }, days: ['2026-11-12'], puzzles: { i1: 1 }, dailyDone: {}, stats: {} };
  r = await ok(X2, { action: 'progress', data: save });
  check('progress: kept as sent, the XP read from it', JSON.stringify(r.data) === JSON.stringify(save) || (r.data.prog.xp === 1234 && r.data.prog.career['2'] === 3 && r.data.puzzles.i1 === 1), r.data);
  check('progress: the XP is on the profile, where an opponent reads it', r.xp === 1234 && (await prof(X2)).xp === 1234, [r.xp, (await prof(X2)).xp]);
  r = await ok(X2, { action: 'progress' });
  check('progress: read back (another device)', r.data && r.data.prog.xp === 1234 && r.data.days[0] === '2026-11-12' && !!r.at, r);
  check('progress: one player\'s, not another\'s', (await ok(X1, { action: 'progress' })).data === null && ((await prof(X1)).xp || 0) === 0);
  r = await call(X2, { action: 'progress', data: [1, 2] });
  check('progress: a list is not a save', r.body.error === 'bad_data', r.body);
  r = await call(X2, { action: 'progress', data: { v: 1, junk: 'x'.repeat(70000) } });
  check('progress: too big is refused, the old one stays', r.body.error === 'too_big' && (await ok(X2, { action: 'progress' })).data.prog.xp === 1234, r.body);
  r = await ok(X2, { action: 'progress', data: { v: 1, prog: { xp: 1e12 } } });
  check('progress: the XP has a ceiling', r.xp === 5000000 && (await prof(X2)).xp === 5000000, r.xp);
  r = await ok(X2, { action: 'progress', data: { v: 1, prog: { xp: -5 } } });
  check('progress: and a floor', r.xp === 0, r.xp);
  r = await ok(X2, { action: 'progress', data: save });
  // someone on the leaderboard sends theirs: their row carries the XP, the others' rows none
  r = await ok(X1, { action: 'top', pool: 'blitz' });
  const U = r.rows.length ? r.rows[0].uid : null;
  if (U) await ok(U, { action: 'progress', data: { v: 1, prog: { xp: 777 } } });
  r = await ok(X1, { action: 'top', pool: 'blitz' });
  const mine = r.rows.find((x) => x.uid === U), other = r.rows.find((x) => x.uid !== U && x.uid !== X2);
  check('progress: the leaderboard rows carry the XP (the badge next to the name)', U && mine && mine.xp === 777 && (!other || !other.xp), [U, mine && mine.xp, other && other.xp]);
  const off = createLogic({ repo, GC, now, broadcast: async () => {} });
  r = await off.handle(Promise.resolve(X2), { action: 'progress' });
  check('progress: off until the migration is in (the app then keeps it on the device only)', r.body.error === 'unsupported' && (await off.handle(Promise.resolve(X2), { action: 'hello' })).body.prog === undefined, r.body);
}

// ---- Joker Pro, the paid tier (the pro migration): hello says who is shown it, the leaderboard who has it
{
  // a database without the migration (PG_SKIP has it): nobody is shown anything, and nothing breaks
  const noPro = PG && (process.env.PG_SKIP || '').includes('_pro.sql');
  const setMode = async (m) => { if (PG) await pg.query("update public.billing_config set value = to_jsonb($1::text) where key = 'mode'", [m]); else repo.proMode = async () => m; };
  await inspect.makeAdmin(A); // A is one of the owner's accounts, B is not
  let r = await ok(A, { action: 'hello' });
  if (noPro) {
    check('pro: before the migration nobody is shown Pro', r.pro === undefined && r.proc === undefined, [r.pro, r.proc]);
    r = await ok(A, { action: 'top', pool: 'blitz' });
    check('pro: the leaderboard works without the columns', Array.isArray(r.rows) && r.rows.every((x) => x.pro === false && x.founder === false), r.rows.slice(0, 2));
  } else {
    check('pro: off at first, the profiles carry the columns', r.pro === undefined && r.proc === true, [r.pro, r.proc]);
    await setMode('test');
    check('pro: in test mode the owner sees it', (await ok(A, { action: 'hello' })).pro === 'test');
    check('pro: and a player does not', (await ok(B, { action: 'hello' })).pro === undefined);
    await setMode('on');
    check('pro: on is for everyone', (await ok(B, { action: 'hello' })).pro === 'on' && (await ok(A, { action: 'hello' })).pro === 'on');
    await setMode('off');
    check('pro: off again', (await ok(B, { action: 'hello' })).pro === undefined);
    // the apps: whether this player's app may sell Pro through its store
    const setStores = async (v) => { if (PG) await pg.query("update public.billing_config set value = $1::jsonb where key = 'stores'", [JSON.stringify(v)]); else repo.proStores = async () => v; };
    check('iap: no store sells at first, whatever the app', (await ok(B, { action: 'hello', platform: 'ios' })).iap === undefined && (await ok(B, { action: 'hello', platform: 'android' })).iap === undefined && (await ok(B, { action: 'hello' })).iap === undefined);
    await setStores({ ios: 'test', android: 'off' });
    check('iap: a store being tried is for the owner\'s accounts, in that app only', (await ok(A, { action: 'hello', platform: 'ios' })).iap === true && (await ok(B, { action: 'hello', platform: 'ios' })).iap === undefined &&
      (await ok(A, { action: 'hello', platform: 'android' })).iap === undefined && (await ok(A, { action: 'hello', platform: 'web' })).iap === undefined);
    await setStores({ ios: 'on', android: 'on' });
    check('iap: on is for every player in the apps, never for the website', (await ok(B, { action: 'hello', platform: 'ios' })).iap === true && (await ok(B, { action: 'hello', platform: 'android' })).iap === true &&
      (await ok(B, { action: 'hello', platform: 'web' })).iap === undefined && (await ok(B, { action: 'hello' })).iap === undefined && (await ok(B, { action: 'hello', platform: 'steam' })).iap === undefined);
    await setStores({ ios: 'off', android: 'off' });
    // the gold name others see: the leaderboard rows say who has Pro
    const day = 864e5, iso = (ms) => new Date(ms).toISOString();
    const setPro = async (uid, until, founder) => {
      if (PG) await pg.query('update public.profiles set pro_until = $2, pro_founder = $3 where id = $1', [uid, until, !!founder]);
      else { const p = (await inspect.profiles()).find((x) => x.id === uid); p.pro_until = until; p.pro_founder = !!founder; }
    };
    const top = async () => { const t = await ok(A, { action: 'top', pool: 'blitz' }); return (t.rows || []).concat(t.me ? [t.me] : []); };
    const rows0 = await top();
    check('pro: nobody has it at first', rows0.length > 0 && rows0.every((x) => x.pro === false && x.founder === false), rows0.slice(0, 3));
    const who = rows0[0].uid, other = rows0.length > 1 ? rows0[1].uid : null;
    await setPro(who, iso(Date.now() + day), false);
    if (other) await setPro(other, iso(Date.now() - day), false);
    let rows = await top();
    check('pro: a paid period shows, one that ran out does not', rows.find((x) => x.uid === who).pro === true && rows.find((x) => x.uid === who).founder === false && (!other || rows.find((x) => x.uid === other).pro === false), rows.slice(0, 3));
    await setPro(who, null, true);
    rows = await top();
    check('pro: a founder shows as both', rows.find((x) => x.uid === who).pro === true && rows.find((x) => x.uid === who).founder === true);
    await setPro(who, null, false); if (other) await setPro(other, null, false);
  }
}

// glicko sanity
const gw = glicko2(1500, 350, 0.06, 1500, 350, 1);
check('glicko new player win ~ +160..+200', gw.rating > 1650 && gw.rating < 1700 && gw.rd < 350, gw);
const gl = glicko2(1500, 60, 0.06, 1500, 60, 0);
check('glicko established loss small', gl.rating > 1470 && gl.rating < 1490, gl);
check('pools', poolOf(60000, 0) === 'bullet' && poolOf(120000, 1000) === 'bullet' && poolOf(180000, 2000) === 'blitz' && poolOf(300000, 3000) === 'blitz' && poolOf(600000, 0) === 'rapid');

console.log(`server logic (${PG ? 'postgres' : 'memory'}): ${pass} passed, ${fail} failed`);
await cleanup();
process.exit(fail ? 1 : 0);
