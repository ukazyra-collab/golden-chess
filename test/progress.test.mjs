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

// ---- the career: four seasons of four opponents, a season opens on stars
const career = {};
check('sixteen stages in four seasons', P.CHAPTERS === 16 && P.SEASONS.length === 4 && P.stage(1).season === 0 && P.stage(5).season === 1 && P.stage(16).season === 3 && P.stage(17) === null);
check('the first season is open, all four opponents at once', [1, 2, 3, 4].every((c) => P.isOpen(career, c)) && !P.isOpen(career, 5) && !P.isOpen(career, 0));
check('three goals a stage', P.stage(1).goals.length === 3 && P.stage(2).who === 'pip' && P.stage(2).elo === 600 && P.stage(3).color === 'b');
check('every opponent is stronger than the one before', Array.from({ length: 15 }, (_, i) => P.stage(i + 2).elo > P.stage(i + 1).elo).every(Boolean));
check('the road ends at the engine at full strength, with its real rating', P.stage(16).who === 'golden' && P.stage(16).boss && P.stage(16).level === 8 && P.stage(16).elo === 2500 && !P.stage(15).boss);
// ---- the bots: one list for the career and the picker
{
  global.GC = require('../src/core.js');
  const lvElo = require('../src/engine.js').LEVELS.map((l) => l.elo);
  check('sixteen bots, one name each', P.BOTS.length === 16 && new Set(P.BOTS.map((b) => b.who)).size === 16 && P.BOTS.every((b, i) => P.stage(i + 1).who === b.who && P.stage(i + 1).elo === b.elo));
  const plain = P.BOTS.filter((b) => !b.lv);
  check('eight of them play an engine level as it is, with the level\'s own rating', plain.length === 8 && plain.every((b, i) => b.level === i + 1 && b.elo === lvElo[i] && P.levelBot(i + 1) === b), plain.map((b) => b.who + ' ' + b.elo));
  check('the others have a setting of their own and stand between their neighbours', P.BOTS.filter((b) => b.lv).every((b) => b.lv.depth > 0 && b.lv.time > 0 && b.level >= 1 && b.level <= 8 && b.elo % 25 === 0));
  check('a bot by its name', P.bot('morphy').elo === P.stage(15).elo && P.bot('nobody') === null);
  // the engine plays a bot's own setting when it is given one (and the level otherwise)
  const E = require('../src/engine.js');
  E.clear(); const shallow = E.think({ fen: GC.START_FEN, moves: ['e2e4', 'e7e5'], level: 8, lv: { depth: 1, time: 200, noise: 0, exact: true, temp: 1, margin: 0 } });
  E.clear(); const deep = E.think({ fen: GC.START_FEN, moves: ['e2e4', 'e7e5'], level: 8, timeMs: 150 });
  check('the engine takes a bot\'s own setting over the level', shallow.depth === 1 && deep.depth > 1 && !!shallow.uci, [shallow.depth, deep.depth]);
  const between = (b) => { const i = P.BOTS.indexOf(b), lo = P.BOTS[i - 1], hi = P.BOTS[i + 1]; return (!lo || lo.elo < b.elo) && (!hi || hi.elo > b.elo); };
  check('the masters think for longer than Leo and less than the Joker', ['staunton', 'anderssen', 'morphy'].every((w) => { const t = P.bot(w).lv.time; return t > E.LEVELS[6].time && t < E.LEVELS[7].time && P.bot(w).lv.noise === 0 && between(P.bot(w)); }) &&
    P.bot('staunton').lv.time < P.bot('anderssen').lv.time && P.bot('anderssen').lv.time < P.bot('morphy').lv.time);
}
let r = P.recordStage(career, 1, { outcome: -1, joker: true, moves: 20 });
check('a loss leaves no mark', r.newStars === 0 && !('1' in career) && r.opened === -1);
r = P.recordStage(career, 1, { outcome: 1, joker: false, moves: 52 });
check('a plain win: one star', r.newStars === 1 && P.careerStars(career) === 1 && !P.seasonOpen(career, 1), r);
r = P.recordStage(career, 1, { outcome: 1, joker: true, moves: 28 });
check('one good game can take the rest', r.newStars === 2 && P.starsOf(career[1]) === 3, [r, career]);
r = P.recordStage(career, 1, { outcome: -1, joker: true, moves: 20 });
check('a later loss keeps the best', r.newStars === 0 && P.starsOf(career[1]) === 3);
r = P.recordStage(career, 2, { outcome: 1, joker: true, moves: 31 });
check('a Joker win over the limit: two stars', P.starsOf(career[2]) === 2 && r.bits === 3 && r.opened === -1);
r = P.recordStage(career, 3, { outcome: 1, joker: false, moves: 60 });
check('six stars open the second season', r.opened === 1 && P.seasonOpen(career, 1) && P.isOpen(career, 8) && !P.isOpen(career, 9) && P.seasonStars(career, 0) === 6);
check('carry on with the one not beaten yet', P.nextStage(career).ch === 4);
{ // stars missing behind: the main button still goes ahead; everyone open beaten: back for the stars
  const c2 = { 1: 1, 2: 1, 3: 1, 4: 1 };
  check('all of an open season beaten, the next closed: back for the stars', P.nextStage(c2).ch === 1 && !P.seasonOpen(c2, 1));
  const all = {}; for (let ch = 1; ch <= P.CHAPTERS; ch++) all[ch] = 7;
  all[3] = 1;
  check('every opponent beaten: back to the stars still missing', P.nextStage(all).ch === 3);
  all[3] = 7;
  check('every star: nothing left', P.nextStage(all) === null && P.careerStars(all) === 48);
  check('the seasons ask for 0, 6, 14 and 24 stars', P.SEASONS.map((x) => x.need).join() === '0,6,14,24');
}
check('a draw earns nothing', P.stageBits(1, { outcome: 0, joker: true, moves: 10 }) === 0);
check('the move limit grows with the opponent', P.stage(1).goals[2][1] === 30 && P.stage(16).goals[2][1] === 50);
check('goal words', P.goalText('en', ['fast', 30]) === 'Win in 30 moves or fewer' && P.goalText('ru', ['joker']) === 'Победа с ходом-джокером');

// ---- the coach's puzzles: XP for a Joker Move the player found, more for the harder ones and for a clean solve
check('an easy puzzle, found cleanly', P.puzzleXp({ lvl: 1 }, { shown: false, hint: 0, wrong: 0 }) === 15);
check('a hint or a miss: no clean bonus', P.puzzleXp({ lvl: 1 }, { hint: 1, wrong: 0 }) === 10 && P.puzzleXp({ lvl: 2 }, { hint: 0, wrong: 2 }) === 15);
check('a hard one', P.puzzleXp({ lvl: 3 }, { hint: 0, wrong: 0 }) === 25 && P.puzzleXp({}, { hint: 0, wrong: 0 }) === 15);
check('an answer that was shown earns nothing', P.puzzleXp({ lvl: 3 }, { shown: true, hint: 0, wrong: 0 }) === 0);
check('a puzzle from a real game is a quest and has words', P.questStep('hist', { type: 'puzzle', real: true }) === 1 && P.questStep('hist', { type: 'puzzle' }) === 0 && P.questStep('puzzles3', { type: 'puzzle', real: true }) === 1 &&
  P.questText('ru', 'hist') === 'Реши задачу из настоящей партии');

// ---- the progress on the account: two devices, nothing earned is lost
{
  const A = { prog: { xp: 500, career: { 1: 7, 2: 1 }, cards: { knight: 3, fork: 1 }, q: { day: '2026-11-12', ids: ['daily', 'win2', 'joker2'], p: { win2: 1 }, done: {} }, firstWin: '2026-11-12', equip: { frame: 'knight' }, seen: { lv: 4, stars: 4 } },
    days: ['2026-11-11', '2026-11-12'], puzzles: { i1: 1, j22: 2 }, dailyDone: { '2026-11-12': 'd8' }, stats: { L1: { w: 2, d: 0, l: 1 }, Bjake: { w: 1, d: 0, l: 0 } } };
  const B = { prog: { xp: 320, career: { 2: 3, 5: 1, 99: 7 }, cards: { knight: 1, pin: 2 }, q: { day: '2026-11-12', ids: ['daily', 'win2', 'joker2'], p: { win2: 2, daily: 1 }, done: { win2: true, daily: true } }, firstWin: '2026-11-10', equip: { frame: 'bishop', title: 'trickster' }, seen: { lv: 3, stars: 6 } },
    days: ['2026-11-10', '2026-11-12', 'junk'], puzzles: { j22: 1, r1: 2 }, dailyDone: { '2026-11-10': 'd1' }, stats: { L1: { w: 1, d: 0, l: 0 }, L3: { w: 0, d: 1, l: 4 } } };
  const m = P.mergeSave(A, B);
  check('the larger XP stays; stars of both sides, stage by stage', m.prog.xp === 500 && m.prog.career[1] === 7 && m.prog.career[2] === 3 && m.prog.career[5] === 1 && !(99 in m.prog.career) && P.careerStars(m.prog.career) === 6, m.prog);
  check('every Joker card of either side', m.prog.cards.knight === 3 && m.prog.cards.fork === 1 && m.prog.cards.pin === 2);
  check('today\'s quests: the further of the two', m.prog.q.p.win2 === 2 && m.prog.q.done.win2 && m.prog.q.done.daily && !m.prog.q.done.joker2 && m.prog.firstWin === '2026-11-12', m.prog.q);
  check('what is worn: this device first', m.prog.equip.frame === 'knight' && m.prog.equip.title === 'trickster' && m.prog.seen.lv === 4 && m.prog.seen.stars === 6);
  check('every day played, once, in order', m.days.join() === '2026-11-10,2026-11-11,2026-11-12');
  check('every puzzle solved; found beats shown', m.puzzles.i1 === 1 && m.puzzles.j22 === 1 && m.puzzles.r1 === 2 && m.dailyDone['2026-11-10'] === 'd1' && m.dailyDone['2026-11-12'] === 'd8');
  check('the bots\' scores: the longer record of the two, never the sum', m.stats.L1.w === 2 && m.stats.L1.l === 1 && m.stats.L3.l === 4 && m.stats.Bjake.w === 1, m.stats);
  check('merging is the same either way round (but for what is worn), and again', P.saveKey(P.mergeSave(B, A).days) === P.saveKey(m.days) && P.mergeSave(B, A).prog.xp === 500 && P.mergeSave(B, A).prog.equip.frame === 'bishop' &&
    P.saveKey(P.mergeSave(m, A)) === P.saveKey(m) && P.saveKey(P.mergeSave(m, null)) === P.saveKey(m));
  const older = P.mergeSave({ prog: { q: { day: '2026-11-11', ids: ['daily'], p: { daily: 1 }, done: { daily: true } } } }, { prog: { q: { day: '2026-11-12', ids: ['win2'], p: {}, done: {} } } });
  check('quests of different days: the later day', older.prog.q.day === '2026-11-12');
  check('nothing on either side: an empty save', P.saveKey(P.mergeSave(null, undefined)) === P.saveKey({ v: 1, prog: { xp: 0, career: {}, cards: {}, q: null, firstWin: '', equip: {}, seen: { lv: 1, stars: 0 } }, days: [], puzzles: {}, dailyDone: {}, stats: {} }));
  check('the same save in the same words whatever the order', P.saveKey({ b: 1, a: { d: 2, c: [2, 1] } }) === '{"a":{"c":[2,1],"d":2},"b":1}');
}

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
