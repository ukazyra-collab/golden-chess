// The streak, the daily puzzle and the reminder plan (src/habits.js). Run: node test/habits.test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const H = require('../src/habits.js');
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

// ---- the streak
let s = H.streak([], '2026-11-11');
check('no days: no streak', s.count === 0 && s.state === 'none' && s.best === 0, s);
s = H.streak(['2026-11-11'], '2026-11-11');
check('played today: 1, done', s.count === 1 && s.state === 'done', s);
s = H.streak(['2026-11-09', '2026-11-10'], '2026-11-11');
check('yesterday and the day before: 2, due today', s.count === 2 && s.state === 'due', s);
s = H.streak(['2026-11-08', '2026-11-09'], '2026-11-11');
check('one day missed: paused, still 2', s.count === 2 && s.state === 'paused' && s.missed === 1, s);
s = H.streak(['2026-11-07', '2026-11-08'], '2026-11-11');
check('two days missed: paused (the last chance)', s.count === 2 && s.state === 'paused' && s.missed === 2, s);
s = H.streak(['2026-11-06', '2026-11-07'], '2026-11-11');
check('three days missed: gone, but remembered as lost', s.count === 0 && s.state === 'none' && s.lost === 2 && s.best === 2, s);
s = H.streak(['2026-11-05', '2026-11-06', '2026-11-08', '2026-11-11'], '2026-11-11');
check('gaps of one or two days keep it going', s.count === 4 && s.state === 'done', s);
s = H.streak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10', '2026-11-11'], '2026-11-11');
check('best streak is the longest run', s.count === 2 && s.best === 5, s);
check('a week strip Monday..Sunday', s.week.length === 7 && s.week[0].d === '2026-11-09' && s.week[6].d === '2026-11-15' && s.week[2].today && s.week[1].on && !s.week[0].on && s.week[3].future, s.week);
s = H.streak(['2026-11-11', '2026-11-11', 'junk', '2026-11-10'], '2026-11-11');
check('duplicates and junk ignored', s.count === 2, s);
check('days in the future are not counted', H.streak(['2026-11-12'], '2026-11-11').count === 0);
check('returning: an earlier day', H.returning(['2026-11-10'], '2026-11-11') && !H.returning(['2026-11-11'], '2026-11-11') && !H.returning([], '2026-11-11'));

// ---- dates over a clock change (Europe goes back on 25 Oct 2026)
check('add days across a clock change', H.addDays('2026-10-24', 2) === '2026-10-26' && H.diffDays('2026-10-24', '2026-10-26') === 2);
check('weekday', H.weekday('2026-11-11') === 3 && H.weekday('2026-11-15') === 7 && H.weekday('2026-11-16') === 1);

// ---- the daily puzzle
const list = [];
for (let i = 0; i < 30; i++) list.push({ id: 'p' + i, lvl: 1 + (i % 3) });
const d1 = H.dailyFor('2026-11-10', list);
check('puzzle #1 on the first day', d1.n === 1 && d1.p && d1.lvl === 1, d1);
check('Monday easy, Sunday hard', H.dailyFor('2026-11-16', list).p.lvl === 1 && H.dailyFor('2026-11-15', list).p.lvl === 3);
check('the same day: the same puzzle for everyone', H.dailyFor('2026-12-01', list).p.id === H.dailyFor('2026-12-01', list.slice()).p.id);
const seen = {};
for (let k = 0; k < 70; k++) { const d = H.dailyFor(H.addDays('2026-11-11', k), list); seen[d.p.id] = (seen[d.p.id] || 0) + 1; }
check('ten weeks use every puzzle, none more than three times', Object.keys(seen).length === 30 && Math.max(...Object.values(seen)) <= 3, seen);
check('before the first day still a puzzle', !!H.dailyFor('2026-11-01', list).p);
check('no list: nothing', H.dailyFor('2026-11-11', []) === null);

// ---- habit hour
check('habit hour: the middle of the visits', H.habitHour([8, 20, 21, 19, 20]) === 20 && H.habitHour([]) === 19 && H.habitHour([2, 3, 4]) === 9 && H.habitHour([23, 23]) === 21);

// ---- the reminder plan
const at = (d, h, m) => { const x = new Date(d + 'T12:00:00'); x.setHours(h, m || 0, 0, 0); return x; };
let p = H.plan({ now: at('2026-11-11', 10), lang: 'en', days: ['2026-11-09', '2026-11-10'], hours: [19, 19, 20], hasGame: true });
const dayOf = (x) => H.dayOf(x.at);
check('a streak to keep: tonight at 20:30', p[0].kind === 'streak' && dayOf(p[0]) === '2026-11-11' && p[0].at.getHours() === 20 && p[0].title.includes('2-day'), p[0]);
check('then the daily puzzle tomorrow at the usual hour', p[1].kind === 'daily' && dayOf(p[1]) === '2026-11-12' && p[1].at.getHours() === 19 && /#3$/.test(p[1].title), p[1]);
check('at most one a day', new Set(p.map(dayOf)).size === p.length, p.map(dayOf));
check('never at night', p.every((x) => x.at.getHours() >= 9 && x.at.getHours() < 22));
check('nothing after the 30th day', p.every((x) => H.diffDays('2026-11-11', dayOf(x)) <= 30) && p[p.length - 1].kind === 'news', p.map((x) => x.kind));
check('the review only when there is a game', p.some((x) => x.kind === 'review') && !H.plan({ now: at('2026-11-11', 10), lang: 'en', days: [], hours: [] }).some((x) => x.kind === 'review'));
check('ids distinct and small', new Set(p.map((x) => x.id)).size === p.length && p.every((x) => x.id >= 7000 && x.id <= 7030));
p = H.plan({ now: at('2026-11-11', 21, 0), lang: 'en', days: ['2026-11-09', '2026-11-10'], hours: [] });
check('too late for tonight: starts tomorrow', p[0].kind === 'daily' && dayOf(p[0]) === '2026-11-12', p[0]);
p = H.plan({ now: at('2026-11-11', 10), lang: 'en', days: ['2026-11-11'], hours: [] });
check('played today: nothing tonight', p[0].kind === 'daily', p[0]);
p = H.plan({ now: at('2026-11-11', 10), lang: 'ru', days: ['2026-11-10', '2026-11-11'], hours: [] });
check('Russian texts', /Задача дня/.test(p[0].title), p[0]);
check('every text filled', p.every((x) => x.title && x.body && !/\{\w+\}/.test(x.title + x.body)));

console.log(`habits: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
