// head_to_head(): the score against each opponent over all finished games, on real Postgres with the migrations.
// Run: node test/server/h2h.test.mjs
import { createDb } from './pg-harness.mjs';

const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002', C = 'cccccccc-0000-4000-8000-000000000003';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL ' + name, extra === undefined ? '' : JSON.stringify(extra)); } }

const pg = await createDb([A, B, C]);
for (const [id, n] of [[A, 'Anna'], [B, 'Boris'], [C, 'Clara']]) await pg.query('insert into public.profiles (id, username) values ($1, $2)', [id, n]);
let t = Date.parse('2026-10-01T10:00:00Z');
async function game(w, b, wn, bn, result, status = 'over') {
  t += 60000;
  await pg.query(`insert into public.games (status, white_id, black_id, white_name, black_name, tc_base, tc_inc, pool, start_fen, fen, clock_w, clock_b, result, reason, updated_at)
    values ($1, $2, $3, $4, $5, 180000, 2000, 'blitz', 'x', 'x', 0, 0, $6, 'resign', $7)`, [status, w, b, wn, bn, result, new Date(t).toISOString()]);
}
// Anna vs Boris: 60 games (more than one page of the history), Anna 31 wins, 4 draws, 25 losses, colours alternating
for (let i = 0; i < 60; i++) {
  const aWhite = i % 2 === 0, r = i < 31 ? 'A' : i < 35 ? 'D' : 'B';
  const result = r === 'D' ? '1/2-1/2' : (r === 'A') === aWhite ? '1-0' : '0-1';
  await game(aWhite ? A : B, aWhite ? B : A, aWhite ? 'Anna' : (i < 50 ? 'Boris' : 'Boris II'), aWhite ? (i < 50 ? 'Boris' : 'Boris II') : 'Anna', result);
}
// Anna vs Clara: 2 games, one lost as black, one won as black; an aborted and a live game don't count
await game(C, A, 'Clara', 'Anna', '1-0'); await game(C, A, 'Clara', 'Anna', '0-1');
await game(A, C, 'Anna', 'Clara', '*', 'aborted'); await game(A, C, 'Anna', 'Clara', null, 'playing');

await pg.exec(`set role anon`); // what the page does: the public key, no account
const rows = (await pg.query('select * from public.head_to_head($1)', [A])).rows;
await pg.exec(`reset role`);
ok('two opponents', rows.length === 2, rows);
const b = rows[0], c = rows[1];
ok('most played first: Boris', b && b.opp_id === B, b);
ok('Boris: 31 wins, 4 draws, 25 losses, 60 games', b && b.wins === 31 && b.draws === 4 && b.losses === 25 && b.games === 60, b);
ok('the name from the latest game', b && b.opp_name === 'Boris II', b && b.opp_name);
ok('Clara: 1 win, 1 loss (aborted and live games left out)', c && c.opp_id === C && c.wins === 1 && c.losses === 1 && c.draws === 0 && c.games === 2, c);
const rb = (await pg.query('select * from public.head_to_head($1)', [B])).rows;
ok("Boris's side: 25 wins, 4 draws, 31 losses", rb.length === 1 && rb[0].wins === 25 && rb[0].draws === 4 && rb[0].losses === 31 && rb[0].opp_name === 'Anna', rb);
await pg.close();
console.log(`head to head (postgres): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
