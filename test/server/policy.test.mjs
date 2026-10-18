// Realtime authorization policies from the migrations, checked on real Postgres (PGlite) the way Supabase
// Realtime checks them: as the "authenticated" role with the topic and the user's id set for the session.
// Run: node test/server/policy.test.mjs
import { createDb } from './pg-harness.mjs';

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const W = '11111111-0000-4000-8000-000000000001', Bk = '22222222-0000-4000-8000-000000000002', X = '33333333-0000-4000-8000-000000000003';
const pg = await createDb([W, Bk, X]);
for (const [id, n] of [[W, 'White'], [Bk, 'Black'], [X, 'Stranger']]) await pg.query('insert into public.profiles (id, username) values ($1, $2)', [id, n]);
const gid = (await pg.query(`insert into public.games (white_id, black_id, tc_base, tc_inc, pool, start_fen, fen, clock_w, clock_b)
  values ($1, $2, 180000, 0, 'blitz', 'x', 'x', 180000, 180000) returning id`, [W, Bk])).rows[0].id;
const policies = (await pg.query(`select policyname, cmd from pg_policies where schemaname = 'realtime' order by 1`)).rows.map((r) => r.policyname + ':' + r.cmd);
check('peer-move policy created', policies.includes('golden chess players send moves:INSERT'), policies);

async function tryInsert(uid, topic, extension = 'broadcast') {
  try {
    await pg.exec('reset role');
    await pg.query(`select set_config('realtime.topic', $1, false), set_config('request.jwt.claim.sub', $2, false)`, [topic, uid]);
    await pg.exec('set role authenticated');
    await pg.query(`insert into realtime.messages (topic, extension, event, payload, private) values ($1, $2, 'move', '{}', true)`, [topic, extension]);
    return 'ok';
  } catch (e) { return e.message.slice(0, 60); } finally { await pg.exec('reset role'); }
}
async function trySelect(uid, topic) {
  try {
    await pg.query(`select set_config('realtime.topic', $1, false), set_config('request.jwt.claim.sub', $2, false)`, [topic, uid]);
    await pg.exec('set role authenticated');
    await pg.query(`select 1 from realtime.messages limit 1`);
    return 'ok';
  } catch (e) { return e.message.slice(0, 60); } finally { await pg.exec('reset role'); }
}

check('white may send on m:<game>', (await tryInsert(W, 'm:' + gid)) === 'ok');
check('black may send on m:<game>', (await tryInsert(Bk, 'm:' + gid)) === 'ok');
check('a stranger may not send on m:<game>', (await tryInsert(X, 'm:' + gid)) !== 'ok');
check('players may not send on the server topic g:<game>', (await tryInsert(W, 'g:' + gid)) !== 'ok');
check('nobody may send on someone\'s u:<id> topic', (await tryInsert(X, 'u:' + W)) !== 'ok');
check('m: topic of a game that does not exist is refused', (await tryInsert(W, 'm:00000000-0000-4000-8000-000000000000')) !== 'ok');
check('presence allowed (any signed-in user)', (await tryInsert(X, 'g:' + gid, 'presence')) === 'ok');
check('anyone signed in may listen', (await trySelect(X, 'g:' + gid)) === 'ok');

await pg.close();
console.log(`realtime policies: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
