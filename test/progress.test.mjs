// The level, the quests, the career and the Joker cards (src/progress.js). Run: node test/progress.test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const GC = require('../src/core.js');
const P = require('../src/progress.js');
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

// ---- levels and ranks
check('a new player is level 1', P.levelOf(0).level === 1 && P.levelOf(99).level === 1 && P.levelOf(100).level === 2, [P.levelOf(99), P.levelOf(100)]);
check('each level needs 40 XP more', P.need(1) === 100 && P.need(2) === 140 && P.levelOf(240).level === 3 && P.levelOf(240).into === 0);
check('XP at a level and back', [1, 2, 7, 23, 50].every((l) => P.levelOf(P.xpAt(l)).level === l && P.levelOf(P.xpAt(l) - 1).level === Math.max(1, l - 1)));
check('the diamond rank at 50', P.rankOf(50).key === 'diamond' && P.rankOf(49).key === 'joker' && P.rankOf(4).key === 'pawn' && P.rankOf(5).key === 'knight');
check('three tiers inside a rank', P.rankOf(5).tier === 1 && P.rankOf(9).tier === 3 && P.rankOf(20).tier === 1 && P.rankOf(29).tier === 3 && P.rankOf(50).tier === 0);
check('the diamond rank takes months of daily play', P.xpAt(50) > 300 * 120, P.xpAt(50));
check('rank names', P.rankName('en', 7) === 'Knight II' && P.rankName('ru', 50) === 'Бриллиантовый Джокер', [P.rankName('en', 7), P.rankName('ru', 50)]);

// ---- XP for games
let g = P.gameXp({ mode: 'bot', level: 3, outcome: 1, joker: true });
check('a win against a level-3 bot with the Joker', g.xp === 10 + 28 + 10 && g.lines.length === 3, g);
g = P.gameXp({ mode: 'bot', level: 3, outcome: 1, joker: true, firstWin: true });
check('the first win of the day counts twice', g.xp === 96 && g.lines.some((l) => l.k === 'firstWin'), g);
check('a loss still counts', P.gameXp({ mode: 'online', outcome: -1 }).xp === 20 && P.gameXp({ mode: 'local', outcome: 1, firstWin: true }).xp === 10);

// ---- rewards
check('something at level 2, a frame at 5', P.newRewards(1, 2, 0, 0).some((r) => r.kind === 'board') && P.newRewards(4, 5, 0, 0).some((r) => r.kind === 'frame'));
check('diamond at 50: frame, board, title', P.newRewards(49, 50, 0, 0).length === 3);
check('career stars give rewards too', P.newRewards(1, 1, 8, 9).length === 1 && P.owned(1, 72).some((r) => r.id === 'champion'));
check('every reward has a name in both languages', P.REWARDS.every((r) => !/^[bjft]_/.test(P.rewardName('en', r)) && !/^[bjft]_/.test(P.rewardName('ru', r))));
check('the next reward', P.nextReward(1).lv === 2 && P.nextReward(50) === null);

// ---- quests
const q1 = P.questsFor('2026-11-11');
check('three quests a day, one of each kind', q1.length === 3 && ['daily', 'puzzles3'].includes(q1[0]) && ['joker2', 'jokerwin', 'clean', 'review'].includes(q1[2]), q1);
check('the same day: the same quests', JSON.stringify(P.questsFor('2026-11-11')) === JSON.stringify(q1));
const days = new Set(); for (let k = 1; k <= 28; k++) days.add(P.questsFor('2026-11-' + String(k).padStart(2, '0')).join());
check('the quests change from day to day', days.size >= 10, days.size);
let st = {};
P.applyQuests(st, '2026-11-12', { type: 'puzzle' });
check('a new day starts afresh', st.q.day === '2026-11-12' && st.q.ids.length === 3);
st = { q: { day: 'd', ids: ['puzzles3', 'win2', 'jokerwin'], p: {}, done: {} } };
P.applyQuests(st, 'd', { type: 'puzzle' }); P.applyQuests(st, 'd', { type: 'daily' });
let fin = P.applyQuests(st, 'd', { type: 'game', mode: 'bot', outcome: 1, joker: true, queenKept: true });
check('a win with the Joker finishes the Joker quest, counts for wins', fin.join() === 'jokerwin' && st.q.p.win2 === 1 && st.q.p.puzzles3 === 2, [fin, st.q.p]);
fin = P.applyQuests(st, 'd', { type: 'puzzle' });
check('puzzles done', fin.join() === 'puzzles3');
fin = P.applyQuests(st, 'd', { type: 'game', mode: 'local', outcome: 1 });
check('two players on one device don\'t count for wins', !fin.length && st.q.p.win2 === 1);
check('every quest has words', Object.keys(P.QUESTS).every((id) => !/q_|\{/.test(P.questText('en', id) + P.questText('ru', id))));

// ---- the career
const career = {};
check('only the first stage is open', P.isOpen(career, 1, 1) && !P.isOpen(career, 1, 2) && !P.isOpen(career, 2, 1));
let r = P.recordStage(career, 1, 1, { outcome: 1, joker: false, queenKept: true, moves: 52 });
check('a plain win: one star, the next stage opens', r.newStars === 1 && P.isOpen(career, 1, 2) && !P.isOpen(career, 1, 3), r);
r = P.recordStage(career, 1, 1, { outcome: 1, joker: true, queenKept: false, moves: 35 });
check('a better win adds the stars it earned', r.newStars === 2 && P.starsOf(career['1-1']) === 3, [r, career]);
r = P.recordStage(career, 1, 1, { outcome: -1, joker: true, moves: 20 });
check('a loss keeps the best', r.newStars === 0 && P.starsOf(career['1-1']) === 3);
P.recordStage(career, 1, 2, { outcome: 1, joker: false, queenKept: true, moves: 29 });
check('stage 2: clean and fast', P.starsOf(career['1-2']) === 3);
r = P.recordStage(career, 1, 3, { outcome: 1, joker: true, moves: 60 });
check('the boss: a Joker win is two stars, the next chapter opens', P.starsOf(career['1-3']) === 2 && P.isOpen(career, 2, 1) && P.stage(1, 3).color === 'b');
r = P.recordStage(career, 1, 3, { outcome: 1, joker: false, moves: 60 });
check('... and a win without it the third', r.newStars === 1 && P.starsOf(career['1-3']) === 3);
check('stars counted', P.careerStars(career) === 9);
check('carry on at the next chapter', P.nextStage(career).ch === 2 && P.nextStage(career).st === 1);
{ // stars missing behind: the main button still goes ahead; the whole road won: back for the stars
  const c2 = { '1-1': 1, '1-2': 1, '1-3': 1, '2-1': 7 };
  check('missing stars don\'t pull the road back', P.nextStage(c2).ch === 2 && P.nextStage(c2).st === 2);
  const all = {}; for (let ch = 1; ch <= P.CHAPTERS; ch++) for (let st = 1; st <= 3; st++) all[ch + '-' + st] = 7;
  all['3-2'] = 1;
  check('the whole road won: back to the stars still missing', P.nextStage(all).ch === 3 && P.nextStage(all).st === 2);
  all['3-2'] = 7;
  check('every star: nothing left', P.nextStage(all) === null);
}
check('a draw earns nothing', P.stageBits(1, { outcome: 0, joker: true, moves: 10 }) === 0);
check('goal words', P.goalText('en', ['fast', 30]) === 'Win in 30 moves or fewer' && P.goalText('ru', ['nojoker']) === 'Победа без хода-джокера');

// ---- Joker cards
const kinds = (fen, uci, ply) => { const p = new GC.Position(fen), m = p.moveFromUci(uci), before = p.fen(); const k = P.classify(GC, p, m, ply); return { k, same: p.fen() === before, legal: !!m }; };
let c = kinds('1r1q3k/8/8/8/8/8/8/1N4K1 w - - 0 1 Gg', 'b1c6*', 0);
check('a knight teleports into a fork', c.legal && ['knight', 'early', 'fork'].every((x) => c.k.includes(x)) && c.same, c);
check('a Joker Move that would give check is not a move at all', !new GC.Position('r3k3/8/8/8/8/8/8/1N4K1 w - - 0 1 Gg').moveFromUci('b1c7*'));
c = kinds('4k3/8/8/8/8/8/1b6/R3K3 w - - 0 20 Gg', 'a1h5*', 38);
check('an attacked rook escapes', c.legal && ['rook', 'escape', 'endgame'].every((x) => c.k.includes(x)) && !c.k.includes('early'), c);
c = kinds('4k3/4n3/8/8/8/8/8/R5K1 w - - 0 20 Gg', 'a1e1*', 38);
check('a rook pins the knight to its king', c.legal && c.k.includes('pin'), c);
c = kinds('4k3/8/8/2q5/8/8/8/R5K1 w - - 0 20 Gg', 'a1f2*', 38);
check('the rook blocks a check: the shield', c.legal && c.k.includes('shield'), c);
c = (() => { const p = new GC.Position('k7/8/8/8/8/8/8/3Q2K1 w - - 0 30 Gg'), m = p.moveFromUci('d1h5*'); return { legal: !!m, k: P.classify(GC, p, m, 58, 3) }; })();
check('mate three plies after it', c.legal && ['queen', 'mate'].every((x) => c.k.includes(x)), c);
check('no mate card when the mate came much later', !P.classify(GC, new GC.Position('k7/8/8/8/8/8/8/3Q2K1 w - - 0 30 Gg'), new GC.Position('k7/8/8/8/8/8/8/3Q2K1 w - - 0 30 Gg').moveFromUci('d1h5*'), 58, 15).includes('mate'));
check('every card has a name and a line', P.CARDS.every(([id]) => !/^c/.test(P.t('ru', 'c_' + id)) && P.t('en', 'cd_' + id) !== 'cd_' + id));

console.log(`progress: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
