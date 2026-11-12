// Who is due which lifecycle email (mail_due in supabase/migrations/20261112103240_email_lifecycle.sql), on Postgres.
// Run: node test/server/mail.pg.test.mjs
import { createDb } from './pg-harness.mjs';
const U1 = 'aaaaaaaa-1111-4000-8000-000000000001', U2 = 'bbbbbbbb-1111-4000-8000-000000000002', U3 = 'cccccccc-1111-4000-8000-000000000003';
const pg = await createDb([U1, U2, U3]);
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const q = (s, a) => pg.query(s, a);
await q("update auth.users set email = 'u' || substr(id::text, 1, 1) || '@example.com'");
await q("insert into public.profiles (id, username, is_guest) values ($1, 'Ann', true), ($2, 'Bob', false), ($3, 'Cid', false)", [U1, U2, U3]);
// Sunday 15 Nov 2026, 14:00 UTC = 18:00 in Dubai
const NOW = '2026-11-15T14:00:00Z';
const due = async (kind, now = NOW) => (await q('select public.mail_due($1, 100, $2::timestamptz) as j', [kind, now])).rows[0].j;

// prefs: language, zone (an unknown zone is ignored), the yes
let r = (await q("select public.gc_prefs($1, 'ru', 'Asia/Dubai', true) as j", [U2])).rows[0].j;
check('prefs saved', r.lang === 'ru' && r.tz === 'Asia/Dubai' && r.email_opt === true, r);
r = (await q("select public.gc_prefs($1, 'xx', 'Mars/Olympus', null) as j", [U2])).rows[0].j;
check('prefs: unknown language and zone ignored, the yes kept', r.lang === 'ru' && r.tz === 'Asia/Dubai' && r.email_opt === true, r);
await q("select public.gc_prefs($1, 'en', 'Asia/Dubai', true)", [U3]);

// welcome: the guest saves the account
await q('update public.profiles set is_guest = false where id = $1', [U1]);
const saved = (await q('select saved_at from public.profiles where id = $1', [U1])).rows[0].saved_at;
check('saving the account stamps it', !!saved);
await q("select public.gc_prefs($1, 'en', 'Asia/Dubai', null)", [U1]);
r = await due('welcome', new Date(Date.now() + 3600e3).toISOString().replace(/T\d\d/, 'T10')); // any morning hour around now in Dubai
check('welcome: the one who just saved, not the others', r.length === 1 && r[0].user_id === U1 && r[0].email === 'ua@example.com', r);
await q("insert into public.mail_outbox (user_id, kind, to_email, subject, status) values ($1, 'welcome', 'ua@example.com', 'x', 'dry')", [U1]);
r = await due('welcome', new Date(Date.now() + 3600e3).toISOString().replace(/T\d\d/, 'T10'));
check('welcome: once', r.length === 0, r);

// weekly: U2 played this week, U3 didn't; Sunday 18:00 their time
const g = (w, b, res, at, extra = {}) => q(`insert into public.games (status, white_id, black_id, white_name, black_name, white_rating, black_rating, tc_base, tc_inc, pool, rated,
  start_fen, fen, moves, sans, clock_w, clock_b, result, reason, updated_at, white_diff, black_diff, white_after, black_after)
  values ('over', $1, $2, 'w', 'b', $6, $7, 180000, 2000, 'blitz', true, 'x', 'x', '{}', '{}', 0, 0, $3, 'resign', $4::timestamptz, $5::int, -($5::int), $8, $9)`,
  [w, b, res, at, extra.d || 8, extra.wr || 1500, extra.br || 1500, extra.wa || 1508, extra.ba || 1492]);
await g(U2, U1, '1-0', '2026-11-12T10:00:00Z', { d: 9, wr: 1500, br: 1640, wa: 1509, ba: 1631 });
await g(U1, U2, '1-0', '2026-11-13T10:00:00Z', { d: 7, wr: 1631, br: 1509, wa: 1638, ba: 1502 });
await g(U2, U3, '1/2-1/2', '2026-11-14T10:00:00Z', { d: 0, wr: 1502, br: 1500, wa: 1502, ba: 1500 });
await q("insert into public.ratings (user_id, pool, rating, rd, vol, games) values ($1, 'blitz', 1502, 80, 0.06, 3)", [U2]);
r = await due('weekly');
const w2 = r.find((x) => x.user_id === U2);
check('weekly: Sunday 18:00 in Dubai, the one who said yes and played', w2 && w2.lang === 'ru' && w2.week.games === 3 && w2.week.wins === 1 && w2.week.draws === 1 && w2.week.losses === 1, r);
check('weekly: the rating before the week and the best win', w2 && w2.week.from === 1500 && w2.week.best && w2.week.best.opp === 'b' && w2.week.best.rating === 1640 && w2.rating === 1502 && w2.pool === 'blitz', w2 && w2.week);
check('weekly: not to the one who said no / never asked', !r.some((x) => x.user_id === U1), r.map((x) => x.name));
r = await due('weekly', '2026-11-15T15:00:00Z');
check('weekly: not at another hour', !r.some((x) => x.user_id === U2), r);
r = await due('weekly', '2026-11-14T14:00:00Z');
check('weekly: not on a Saturday', r.length === 0, r);

// winback7: last seen exactly 7 days before, at 18:00 their time
await q("insert into public.activity (user_id, day, platform, kinds) values ($1, '2026-11-08', 'web', '{open}'), ($2, '2026-11-14', 'web', '{open}')", [U3, U2]);
r = await due('winback7');
check('winback7: a week away, said yes', r.length === 1 && r[0].user_id === U3 && r[0].days.length === 1, r);
r = await due('winback7', '2026-11-16T14:00:00Z');
check('winback7: only on the seventh day', r.length === 0, r);
r = await due('winback21', '2026-11-29T14:00:00Z');
check('winback21: three weeks away', r.length === 1 && r[0].user_id === U3, r);
await q("update public.profiles set email_opt = false where id = $1", [U3]);
r = await due('winback7');
check('winback7: not after a no', r.length === 0, r);
console.log(`mail_due (postgres): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
