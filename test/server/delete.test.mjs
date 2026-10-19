// delete_my_account(): a player deletes their own account, on real Postgres (PGlite) with the migrations.
// Run: node test/server/delete.test.mjs
import { createDb } from './pg-harness.mjs';

const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002', C = 'cccccccc-0000-4000-8000-000000000003';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL ' + name, extra === undefined ? '' : JSON.stringify(extra)); } }

const pg = await createDb([A, B, C]);
for (const [id, n] of [[A, 'Anna'], [B, 'Boris'], [C, 'Clara']]) {
  await pg.query('insert into public.profiles (id, username) values ($1, $2)', [id, n]);
  await pg.query("insert into public.ratings (user_id, pool, games) values ($1, 'blitz', 3)", [id]);
}
async function game(status, w, b, host) {
  return (await pg.query(`insert into public.games (status, white_id, black_id, white_name, black_name, host_id, tc_base, tc_inc, pool, start_fen, fen, clock_w, clock_b, result, reason)
    values ($1, $2, $3, 'W', 'B', $4, 180000, 2000, 'blitz', 'x', 'x', 0, 0, $5, $6) returning id`, [status, w, b, host || null, status === 'over' ? '1-0' : null, status === 'over' ? 'resign' : null])).rows[0].id;
}
const g1 = await game('over', A, B), invite = await game('waiting', A, null, A), live = await game('playing', B, C);
async function as(uid, sql) {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`);
  try { await pg.query(sql); return null; } catch (e) { return e.message; } finally { await pg.exec('reset role'); }
}
ok('without a sign-in: refused', /not_signed_in/.test(await as('', 'select public.delete_my_account()') || ''));
ok('the public key can’t call it', /permission denied/.test(await (async () => { await pg.exec('set role anon'); try { await pg.query('select public.delete_my_account()'); return ''; } catch (e) { return e.message; } finally { await pg.exec('reset role'); } })()));
ok('during a live game: refused', /live_game/.test(await as(B, 'select public.delete_my_account()') || ''));
ok('Anna deletes her account', (await as(A, 'select public.delete_my_account()')) === null);
const q = async (s, p) => (await pg.query(s, p)).rows;
ok('her sign-in is gone', (await q('select 1 from auth.users where id = $1', [A])).length === 0);
ok('her profile and ratings are gone', (await q('select 1 from public.profiles where id = $1', [A])).length === 0 && (await q('select 1 from public.ratings where user_id = $1', [A])).length === 0);
const fg = (await q('select white_id, white_name, status from public.games where id = $1', [g1]))[0];
ok('the finished game stays, with her name', fg && fg.white_id === null && fg.white_name === 'W' && fg.status === 'over', fg);
ok('her open invite is called off', (await q('select status from public.games where id = $1', [invite]))[0].status === 'aborted');
ok('the others are untouched', (await q('select count(*)::int as n from public.profiles')).rows === undefined ? (await q('select count(*)::int as n from public.profiles'))[0].n === 2 : false);
await pg.close();
console.log(`delete account (postgres): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
