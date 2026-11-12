// The lifecycle emails (supabase/functions/mail/templates.js). Run: node test/mail.test.mjs
import { render, boardHtml, KINDS } from '../supabase/functions/mail/templates.js';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const d = { name: 'Vitaly', email: 'v@example.com', unsub: 'https://x.supabase.co/functions/v1/mail?u=1&t=abc', site: 'https://joker-chess.com/', rating: 1543, pool: 'blitz',
  daily: { n: 12, fen: 'r7/p1p4p/5k2/2N5/5P2/6P1/PPP2R1P/R1K1r3 w - - 1 28 Gg', lvl: 2, url: 'https://joker-chess.com/#learn' },
  week: { games: 9, wins: 5, draws: 1, losses: 3, from: 1509, to: 1543, streak: 4, puzzles: 6, best: { opp: 'QuietRook7', rating: 1712 } } };
for (const lang of ['en', 'ru']) for (const k of KINDS) {
  const m = render(k, lang, d);
  check(`${k}/${lang}: subject and preheader`, m.subject && m.preheader && m.subject.length <= 70, [m.subject, m.subject.length]);
  check(`${k}/${lang}: nothing left unfilled`, !/\{\w+\}|undefined|NaN|null/.test(m.subject + m.preheader + m.html + m.text), (m.subject + m.html + m.text).match(/\{\w+\}|undefined|NaN|null/));
  check(`${k}/${lang}: a way to stop them, in the HTML and the text`, m.html.includes(d.unsub.replace(/&/g, '&amp;')) && m.text.includes(d.unsub));
  check(`${k}/${lang}: links carry the campaign`, m.html.includes('utm_campaign=' + k));
  check(`${k}/${lang}: the address it went to`, m.html.includes('v@example.com'));
}
check('weekly: the rating change in the subject', /\+34/.test(render('weekly', 'en', d).subject) && /\+34/.test(render('weekly', 'ru', d).subject));
check('weekly: no rating, no change', !/rating/.test(render('weekly', 'en', Object.assign({}, d, { week: { games: 2, wins: 1, draws: 0, losses: 1, streak: 1 } })).subject));
check('winback7: the board', /<table/.test(boardHtml(d.daily.fen)) && (boardHtml(d.daily.fen).match(/<td/g) || []).length === 64);
check('winback7: the side to move at the bottom (black)', boardHtml('8/8/8/8/8/8/8/K6k b - - 0 1').lastIndexOf('♚') < boardHtml('8/8/8/8/8/8/8/K6k b - - 0 1').indexOf('♔'));
// ---- the career in the emails: the next opponent by name, for a player whose progress is on the account
{
  const { roadOf } = await import('../supabase/functions/mail/road.js');
  const road = roadOf({ v: 1, prog: { xp: 900, career: { 1: 7, 2: 3 } } }, 'ru'), roadEn = roadOf({ prog: { career: { 1: 7, 2: 3 } } }, 'en');
  check('the road: the first opponent not beaten yet, with the stars so far', road && road.name === 'Соня' && road.elo > 600 && road.stars === 5 && road.total === 48 && roadEn.name === 'Sonya', road);
  check('the road: nothing without the progress, a newcomer starts at the first opponent', roadOf(null, 'en') === null && roadOf({}, 'en') === null && roadOf({ prog: { career: {} } }, 'en').name === 'Jake');
  const all = {}; for (let i = 1; i <= 16; i++) all[i] = 7;
  check('the road: done, nobody is next', roadOf({ prog: { career: all } }, 'en') === null);
  for (const lang of ['en', 'ru']) for (const k of ['weekly', 'winback7', 'winback21']) {
    const m = render(k, lang, Object.assign({}, d, { road: lang === 'ru' ? road : roadEn }));
    const nm = lang === 'ru' ? 'Соня' : 'Sonya';
    check(`${k}/${lang}: the next opponent by name, with a link to the bots`, m.html.includes(nm) && m.text.includes(nm) && m.html.includes('#bots') && !/\{\w+\}|undefined|NaN|null/.test(m.html + m.text), m.text);
  }
  check('welcome and the emails without the progress say nothing about the road', !/Road to Joker/.test(render('welcome', 'en', Object.assign({}, d, { road: roadEn })).html) && !/Road to Joker/.test(render('weekly', 'en', d).html));
}
check('names are escaped', !render('welcome', 'en', Object.assign({}, d, { name: '<b>x</b>' })).html.includes('<b>x</b>'));
console.log(`mail: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
