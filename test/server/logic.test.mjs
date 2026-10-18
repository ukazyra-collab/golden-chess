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
let repo, inspect, cleanup = async () => {};
if (PG) {
  const { setupPg } = await import('./pg-harness.mjs');
  ({ repo, inspect, cleanup } = await setupPg([A, B, C, D]));
} else {
  const m = createMemoryRepo(now);
  repo = m.repo;
  inspect = { profiles: async () => [...m.db.profiles.values()], ratings: async () => [...m.db.ratings.values()], game: async (id) => m.db.games.get(id) };
}
const sent = [];
const logic = createLogic({ repo, GC, now, broadcast: async (topic, event, payload) => { sent.push({ topic, event, payload }); } });
const call = async (uid, body) => { const r = await logic.handle(Promise.resolve(uid), body); return r; };
const ok = async (uid, body) => { const r = await call(uid, body); if (r.status !== 200 || r.body.error) throw new Error(body.action + ' failed: ' + JSON.stringify(r.body)); return r.body; };

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

for (const u of [A, B, C]) await ok(u, { action: 'hello' });
const profs = await inspect.profiles();
check('profiles created', profs.length === 3);
check('names unique', new Set(profs.map((p) => p.username.toLowerCase())).size === 3);

// rename
let r = await call(A, { action: 'rename', name: 'x' });
check('short name rejected', r.body.error && r.body.error === 'bad_name');
r = await call(A, { action: 'rename', name: 'Алиса_1' });
check('unicode name ok', r.status === 200 && r.body.profile.username === 'Алиса_1');
r = await call(B, { action: 'rename', name: 'алиса_1' });
check('case-insensitive taken', r.body.error && r.body.error === 'name_taken');
await ok(B, { action: 'rename', name: 'Bob' });

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
r = await ok(C, { action: 'join', game: inv.id });
check('host join is no-op', r.game.status === 'waiting');
r = await ok(A, { action: 'join', game: inv.id });
check('joined, host plays white', r.game.status === 'playing' && r.game.white_id === C && r.game.black_id === A && r.game.pool === 'bullet');
r = await call(B, { action: 'join', game: inv.id });
check('third joiner gets taken + state', r.body.error && r.body.error === 'taken' && r.body.game.id === inv.id);
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

// leaderboard
r = await ok(A, { action: 'top', pool: 'bullet' });
check('leaderboard', r.rows.length === 2 && r.rows[0].rating >= r.rows[1].rating);

// glicko sanity
const gw = glicko2(1500, 350, 0.06, 1500, 350, 1);
check('glicko new player win ~ +160..+200', gw.rating > 1650 && gw.rating < 1700 && gw.rd < 350, gw);
const gl = glicko2(1500, 60, 0.06, 1500, 60, 0);
check('glicko established loss small', gl.rating > 1470 && gl.rating < 1490, gl);
check('pools', poolOf(60000, 0) === 'bullet' && poolOf(120000, 1000) === 'bullet' && poolOf(180000, 2000) === 'blitz' && poolOf(300000, 3000) === 'blitz' && poolOf(600000, 0) === 'rapid');

console.log(`server logic (${PG ? 'postgres' : 'memory'}): ${pass} passed, ${fail} failed`);
await cleanup();
process.exit(fail ? 1 : 0);
