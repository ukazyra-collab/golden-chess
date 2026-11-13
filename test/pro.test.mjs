// Joker Pro, the paid tier: src/pro.js (the plans, the free allowances, the offers, the puzzles turned around), what it
// switches in src/progress.js and src/habits.js, and the review without the Joker analysis (src/review.js, blind).
// Run: node test/pro.test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Pro = require('../src/pro.js');
global.GC = require('../src/core.js');
const GC = global.GC, Engine = require('../src/engine.js'), Review = require('../src/review.js');
const fs = require('fs');
const P = require('../src/progress.js');
const H = require('../src/habits.js');
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

// ---- prices: 30–50% below the cheapest chess.com plan (Gold), the year cheaper than twelve months
const G = Pro.CHESSCOM_GOLD;
check('the plans', Pro.PLANS.month.usd === 3.99 && Pro.PLANS.year.usd === 29.99 && Pro.PLANS.founder.usd === 79.99 && Pro.PLANS.founder.seats === 1000, Pro.PLANS);
const offM = 1 - Pro.PLANS.month.usd / G.month, offY = 1 - Pro.PLANS.year.usd / G.year;
check('a month is 30–50% cheaper than chess.com Gold', offM >= 0.3 && offM <= 0.5, offM);
check('a year is 30–50% cheaper than chess.com Gold', offY >= 0.3 && offY <= 0.5, offY);
check('the same numbers from the module', Pro.cheaper('month') === Math.round(offM * 100) && Pro.cheaper('year') === Math.round(offY * 100), [Pro.cheaper('month'), Pro.cheaper('year')]);
check('a year a month', Pro.perMonth('year') === 2.5 && Pro.perMonth('month') === 3.99, [Pro.perMonth('year'), Pro.perMonth('month')]);
check('the year saves 37% on twelve months', Pro.yearSaving() === 37, Pro.yearSaving());
check('a price is written with two decimals', Pro.price(3.99) === '$3.99' && Pro.price(2.5) === '$2.50' && Pro.price(29.99) === '$29.99', [Pro.price(2.5)]);
check('the trial is on the year only', Pro.PLANS.year.trialDays === 7 && !Pro.PLANS.month.trialDays && !Pro.PLANS.founder.trialDays);

// ---- the subscription on the device
const now = Date.UTC(2026, 10, 12, 12), day = 864e5;
let s = Pro.start('year', now);
check('a year starts with its trial', s.on && s.plan === 'year' && s.trial && Math.round((s.until - now) / day) === 7 && !s.founder, s);
check('active inside the trial, over after it', Pro.active(s, now + 6 * day) && !Pro.active(s, now + 8 * day));
s = Pro.start('month', now);
check('a month runs a month', s.plan === 'month' && !s.trial && Math.round((s.until - now) / day) === 30, s);
s = Pro.start('founder', now);
check('a founder is Pro for life', s.founder && s.until === null && Pro.active(s, now + 3650 * day), s);
check('nobody is Pro without a state', !Pro.active(null, now) && !Pro.active({ on: false, until: null }, now) && !Pro.active(undefined, now));
check('an unknown plan is the year', Pro.start('nope', now).plan === 'year');

// ---- the account's Pro as the server has it (a profile row), and the grace of a renewal on its way
check('a profile from before Pro says nothing', Pro.ofProfile({ id: 'x', username: 'a' }) === null && Pro.ofProfile(null) === null);
const until = now + 5 * day;
let e = Pro.ofProfile({ pro_until: new Date(until).toISOString(), pro_founder: false, pro_plan: 'year' });
check('a subscription read off the profile', e && e.until === until && !e.founder && e.plan === 'year', e);
check('entitled until it ends, and ten minutes more', Pro.entitled(e, now) && Pro.entitled(e, until + 9 * 60000) && !Pro.entitled(e, until + 11 * 60000) && Pro.GRACE_MS === 600000);
e = Pro.ofProfile({ pro_until: null, pro_founder: true, pro_plan: 'founder' });
check('a founder has no end', e.founder && e.until === null && Pro.entitled(e, now + 9999 * day), e);
check('nobody without a word from the server', !Pro.entitled(null, now) && !Pro.entitled(Pro.ofProfile({ pro_until: null, pro_founder: false }), now) && !Pro.entitled({ until: null, founder: false }, now));
check('a date that is no date is no Pro', !Pro.entitled(Pro.ofProfile({ pro_until: 'soon', pro_founder: false }), now));

// ---- the Joker analysis: one free, in all; a game opened stays open
check('one analysis is free', Pro.FREE_CHECKS === 1 && Pro.checksLeft(null) === 1 && !Pro.checkOpen(null, 'g1'));
let c = Pro.useCheck(null, 'g1');
check('it is taken for a game', c && c.n === 1 && Pro.checkOpen(c, 'g1') && !Pro.checkOpen(c, 'g2') && Pro.checksLeft(c) === 0, c);
check('the same game again costs nothing', Pro.useCheck(c, 'g1') === c);
check('no second one', Pro.useCheck(c, 'g2') === null);
check('not a new one the next day either (it is not a daily thing)', Pro.checksLeft(c) === 0);
check('no game, no analysis', Pro.useCheck(null, '') === null && Pro.useCheck(null, null) === null && !Pro.checkOpen(c, ''));
check('the state is never changed in place', Pro.useCheck(null, 'a') !== null && Pro.checksLeft(null) === 1);

// ---- hints against the bots: three a day free, a moment shown once stays shown, Pro has no limit
const D = '2026-11-12';
check('three hints a day', Pro.FREE_HINTS === 3 && Pro.hintsLeft(null, D, false) === 3 && Pro.hintsLeft(null, D, true) === Infinity);
let t = Pro.useHint(null, D, false, 'g1', 4);
check('a hint is taken', t && t.n === 1 && Pro.hintsLeft(t, D, false) === 2 && Pro.hintShown(t, D, 'g1', 4) && !Pro.hintShown(t, D, 'g1', 6) && !Pro.hintShown(t, D, 'g2', 4), t);
const again = Pro.useHint(t, D, false, 'g1', 4);
check('the same moment again is free', again && again.n === 1, again);
t = Pro.useHint(t, D, false, 'g1', 6); t = Pro.useHint(t, D, false, 'g2', 0);
check('the third hint is the last', t && t.n === 3 && Pro.hintsLeft(t, D, false) === 0, t);
check('no fourth hint', Pro.useHint(t, D, false, 'g3', 2) === null);
check('what was shown can still be opened', !!Pro.useHint(t, D, false, 'g2', 0));
check('a new day starts afresh', Pro.hintsLeft(t, '2026-11-13', false) === 3 && !Pro.hintShown(t, '2026-11-13', 'g1', 4) && Pro.useHint(t, '2026-11-13', false, 'g9', 1).n === 1);
const pt = Pro.useHint(t, D, true, 'g3', 2);
check('Pro takes hints without counting', pt && pt.n === 3 && Pro.hintShown(pt, D, 'g3', 2), pt);
check('a state is never changed in place', t.n === 3 && !Pro.hintShown(t, D, 'g3', 2));

// ---- bringing Pro up by ourselves: how often
{
  const O = Pro.OFFER, due = (st, day, x) => Pro.offerDue(st, Object.assign({ day, games: 9 }, x));
  check('the limits', O.gap === 3 && O.plain === 7 && O.skips === 3 && O.rest === 14 && O.games === 3 && Pro.MOMENTS.join() === 'streak,rank', O);
  check('nothing before Pro was seen on sale', due(null, '2026-11-20', { plain: true, moments: ['streak'] }) === null);
  let st = Pro.offerFirst(null, '2026-11-10');
  check('the first day is kept once', Pro.offerFirst(st, '2026-11-15').first === '2026-11-10');
  check('nothing on the first day', due(st, '2026-11-10', { plain: true, moments: ['streak', 'rank'] }) === null);
  check('nothing before three finished games', Pro.offerDue(st, { day: '2026-11-12', games: 2, plain: true, moments: ['rank'] }) === null && Pro.offerDue(st, { day: '2026-11-12', games: 3, plain: true }) === 'plain');
  check('a moment comes before the plain offer, the streak first', due(st, '2026-11-11', { plain: true, moments: ['rank', 'streak'] }) === 'streak' && due(st, '2026-11-11', { moments: ['rank'] }) === 'rank');
  check('with no place for it, no plain offer', due(st, '2026-11-11', {}) === null && due(st, '2026-11-11', { moments: [] }) === null);
  st = Pro.offerShown(st, 'streak', '2026-11-11');
  check('an offer made is on record', st.last === '2026-11-11' && st.n === 1 && st.seen.streak === '2026-11-11' && st.first === '2026-11-10', st);
  check('none for three days after it', due(st, '2026-11-12', { plain: true, moments: ['rank'] }) === null && due(st, '2026-11-13', { moments: ['rank'] }) === null && due(st, '2026-11-14', { moments: ['rank'] }) === 'rank');
  check('the same moment is not offered again for a month', due(st, '2026-11-14', { moments: ['streak'] }) === null && due(st, '2026-12-10', { moments: ['streak'] }) === null && O.again === 30);
  check('after a month the same moment may be offered again', due(st, '2026-12-11', { moments: ['streak'] }) === 'streak' && due(st, '2027-01-05', { moments: ['streak'] }) === 'streak');
  check('the plain one waits a week', due(st, '2026-11-14', { plain: true, moments: ['streak'] }) === null && due(st, '2026-11-17', { plain: true }) === null && due(st, '2026-11-18', { plain: true }) === 'plain');
  st = Pro.offerShown(st, 'plain', '2026-11-18');
  check('the plain offer is not a moment (it may come again)', st.seen.plain === undefined && st.n === 2 && due(st, '2026-11-25', { plain: true }) === 'plain');
  let sk = Pro.offerEnded(Pro.offerEnded(st, 'skip', '2026-11-18'), 'skip', '2026-11-21');
  check('two closed in a row: no rest yet', sk.skips === 2 && !sk.rest && due(sk, '2026-11-25', { plain: true }) === 'plain', sk);
  check('a look at the plans starts the count again', Pro.offerEnded(sk, 'look', '2026-11-25').skips === 0);
  sk = Pro.offerEnded(sk, 'skip', '2026-11-25');
  check('the third closed in a row: two weeks of rest', sk.skips === 0 && sk.rest === '2026-12-09' && due(sk, '2026-12-08', { plain: true, moments: ['rank'] }) === null && due(sk, '2026-12-09', { moments: ['rank'] }) === 'rank', sk);
  check('a rest across the new year', Pro.offerEnded({ skips: 2 }, 'skip', '2026-12-25').rest === '2027-01-08');
  check('the states are never changed in place', st.skips === undefined && st.rest === undefined);
}

// ---- the marathon's puzzles turned around: the colours swapped (1), the board mirrored (2), both (3)
{
  const listOf = (f) => { try { const src = fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'); return JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1)); } catch (e) { return []; } };
  const all = listOf('puzzles.js').concat(listOf('daily.js'), listOf('pack.js'));
  const fenKey = (f) => new GC.Position(f).fen();
  let made = 0, bad = [], noMirror = 0, back = 0;
  for (const p of all) {
    for (const k of [1, 2, 3]) {
      const v = Pro.variant(p, k);
      if (!v) { if (!(k & 2) || p.fen.split(' ')[2] === '-') bad.push([p.id, k, 'no variant']); else noMirror++; continue; }
      made++;
      try {
        if (fenKey(Pro.turnFen(v.fen, k)) !== fenKey(p.fen)) bad.push([p.id, k, 'turning twice is not the puzzle again']); else back++;
        for (const u of Object.keys(v.accept)) {
          const pos = new GC.Position(v.fen), m = pos.moveFromUci(u);
          if (!m || !(m & GC.F_GOLDEN)) { bad.push([p.id, k, u, 'not a Joker Move there']); continue; }
          pos.makeMove(m);
          for (const x of v.accept[u]) { const mm = pos.moveFromUci(x); if (!mm) { bad.push([p.id, k, u, x, 'the line breaks']); break; } pos.makeMove(mm); }
        }
        if (Object.keys(v.accept).length !== Object.keys(p.accept).length || v.lvl !== p.lvl || v.of !== p.id || v.id !== p.id + '~' + k) bad.push([p.id, k, 'fields']);
        if (new GC.Position(v.fen).side !== (k & 1 ? 1 - new GC.Position(p.fen).side : new GC.Position(p.fen).side)) bad.push([p.id, k, 'the side to move']);
      } catch (e) { bad.push([p.id, k, String(e.message || e)]); }
    }
  }
  check('there are puzzles to turn', all.length >= 100, all.length);
  // ---- the pack itself: what is sold must hold
  const pack = listOf('pack.js'), free = listOf('puzzles.js').concat(listOf('daily.js')), key4 = (f) => f.split(' ').slice(0, 4).join(' ');
  check('the pack: at least 60 puzzles, ids x1.. and unique', pack.length >= 60 && new Set(pack.map((p) => p.id)).size === pack.length && pack.every((p) => /^x\d+$/.test(p.id)), pack.length);
  check('the pack: easy to hard, all three levels', pack.every((p, i) => !i || p.lvl >= pack[i - 1].lvl) && [1, 2, 3].every((l) => pack.some((p) => p.lvl === l)), pack.map((p) => p.lvl).join(''));
  check('the pack: no position twice, none from the free puzzles or the daily ones', (() => { const seen = new Set(free.map((p) => key4(p.fen))); return pack.every((p) => { const k = key4(p.fen); if (seen.has(k)) return false; seen.add(k); return true; }); })());
  check('the pack: every answer is a legal Joker Move of the side to move and its line ends on the solver\'s move', pack.every((p) => {
    const pos = new GC.Position(p.fen);
    if (!((pos.golden >> pos.side) & 1) || !Object.keys(p.accept).length) return false;
    return Object.entries(p.accept).every(([u, cont]) => {
      const q = new GC.Position(p.fen), m = q.moveFromUci(u);
      if (!m || !(m & GC.F_GOLDEN)) return false;
      q.makeMove(m);
      for (const c of cont) { const mm = q.moveFromUci(c); if (!mm) return false; q.makeMove(mm); }
      return cont.length % 2 === 0;
    });
  }));
  check('the pack: a kind of moment on each, a short mate where it says so', pack.every((p) => ['save', 'mate', 'win'].includes(p.k) && (p.k !== 'mate' || (p.mate > 0 && p.mate <= 3))));
  check('the pack is the checked one, not a draft', !/DRAFT/.test(fs.readFileSync(new URL('../src/pack.js', import.meta.url), 'utf8')));
  check('every puzzle turned around is the same puzzle: its Joker Moves are Joker Moves, its lines play', made > 2 * all.length && bad.length === 0, bad.slice(0, 6));
  check('turning back gives the puzzle again', back === made, [back, made]);
  check('a position with castling rights is not mirrored', all.filter((p) => p.fen.split(' ')[2] !== '-').length * 2 === noMirror, noMirror);
  check('variant 0 is the puzzle itself', Pro.variant(all[0], 0) === all[0] && Pro.variant(all[0], 4) === all[0]);
  check('a square and a move turned', Pro.turnMove('a1d8*', 1) === 'a8d1*' && Pro.turnMove('a1d8*', 2) === 'h1e8*' && Pro.turnMove('e7e8q', 3) === 'd2d1q');
  const f0 = 'r3k2r/8/8/3pP3/8/8/8/R3K2R w Kq d6 4 20 G';
  check('castling, en passant and the Joker flags follow the colours', Pro.turnFen(f0, 1) === 'r3k2r/8/8/8/3Pp3/8/8/R3K2R b Qk d3 4 20 g' && Pro.turnFen(f0, 2) === null, Pro.turnFen(f0, 1));
  check('both Jokers stay both; none stays none', Pro.turnFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1 Gg', 3).endsWith(' Gg') && Pro.turnFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1 -', 1).endsWith(' -'));
}

// ---- the review without the Joker analysis (blind): the moves judged as fully as ever, nothing of a Joker Move nobody played
{
  const play = (fen, ucis) => {
    const p = new GC.Position(fen), fens = [p.fen()], records = [];
    for (const u of ucis) { const m = p.moveFromUci(u); records.push({ uci: u, san: p.san(m, p.legalMoves(true)), golden: !!(m & GC.F_GOLDEN), color: p.side }); p.makeMove(m); fens.push(p.fen()); }
    const scores = fens.map((f, i) => { Engine.clear(); return Engine.reviewStep(fen, ucis.slice(0, i), { depth: 9, timeMs: 1500 }); });
    return { fens, records, scores };
  };
  const FEN = 'r7/p1p4p/5k2/2N5/5P2/6P1/PPP2R1P/R1K1r3 w - - 1 28 Gg'; // a rook check that only a Joker Move blocks well
  // White misses it
  const g1 = play(FEN, ['c1d2', 'e1a1']), full = Review.analyze(g1), blind = Review.analyze(g1, { blind: true });
  check('the engine\'s best there is a Joker Move, with the best normal move beside it', /\*$/.test(g1.scores[0].uci) && g1.scores[0].alt && !/\*/.test(g1.scores[0].alt.uci), g1.scores[0]);
  check('the full review: a missed Joker Move', full.moves[0].cls === 'goldmiss' && full.missed.length === 1 && full.missed[0].color === 0 && /\*$/.test(full.moves[0].best) && full.sum[0].missed.length === 1, [full.moves[0].cls, full.missed]);
  check('blind: the same move is held against the best normal move', blind.moves[0].best === g1.scores[0].alt.uci && blind.moves[0].cls !== 'goldmiss' && blind.moves[0].missedGolden === null, [blind.moves[0].cls, blind.moves[0].best]);
  check('blind: nothing is missed, nothing counted as missed', blind.missed.length === 0 && blind.sum[0].missed.length === 0 && !blind.sum[0].counts.goldmiss && !blind.sum[1].counts.goldmiss, blind.sum[0].counts);
  const stars = (a) => JSON.stringify(a.moves.map((m) => [m.best, m.bestSan, m.line.ucis, m.line.sans, m.follow.ucis, m.reason]));
  check('blind: no Joker Move anywhere in what the coach would show', !/\*|★/.test(stars(blind)) && /\*/.test(stars(full)), stars(blind).slice(0, 300));
  check('blind: the review is whole in itself (its accuracy is of the moves as it judges them)', blind.sum[0].accuracy > full.sum[0].accuracy + 20 && Math.abs(blind.sum[1].accuracy - full.sum[1].accuracy) < 0.01, [blind.sum[0].accuracy, full.sum[0].accuracy]);
  check('the other side\'s moves are judged the same either way', blind.moves[1].cls === full.moves[1].cls && blind.moves[1].best === full.moves[1].best);
  // White plays it
  const g2 = play(FEN, [g1.scores[0].uci, 'e1d1']), full2 = Review.analyze(g2), blind2 = Review.analyze(g2, { blind: true });
  check('the full review: the Joker Move played, with its verdict', full2.sum[0].golden && ['great', 'best', 'brilliant'].includes(full2.sum[0].golden.cls) && full2.moves[0].cls === full2.sum[0].golden.cls, full2.sum[0].golden);
  check('blind: it is on record, without a verdict', blind2.sum[0].golden && blind2.sum[0].golden.hide === true && blind2.sum[0].golden.cls === undefined && blind2.sum[0].golden.san === full2.sum[0].golden.san, blind2.sum[0].golden);
  check('blind: the move has no class, no best move beside it, no reason', blind2.moves[0].cls === 'joker' && blind2.moves[0].best === null && blind2.moves[0].bestSan === '' && blind2.moves[0].reason === null && Object.keys(blind2.sum[0].counts).length === 0, blind2.moves[0]);
  check('blind: a Joker Move that was played may stand in a line (the game went that way)', blind2.moves[0].line.ucis[0] === g2.records[0].uci);
  check('blind: its accuracy counts all the same', Math.abs(blind2.sum[0].accuracy - full2.sum[0].accuracy) < 0.01);
  // a line is cut before a Joker Move nobody played
  const st = Review.story(FEN, [g1.scores[0].uci, 'e1d1', 'c1d1'], 0, 8), cut = Review.story(FEN, [g1.scores[0].uci, 'e1d1', 'c1d1'], 0, 8, { blind: true });
  const kept = Review.story(FEN, [g1.scores[0].uci, 'e1d1', 'c1d1'], 0, 8, { blind: true, game: [g1.scores[0].uci, 'e1d1'] });
  const other = Review.story(FEN, ['c1d2', 'e1a1'], 0, 8, { blind: true });
  check('a line stops before a Joker Move that was not played', st.ucis.length === 3 && !st.cut && cut.ucis.length === 0 && cut.cut === true && cut.first === null, cut);
  check('unless the game itself went that way', kept.ucis.length === 3 && !kept.cut && kept.golden[0] === true);
  check('a line with no Joker Move is left alone', other.ucis.length === 2 && !other.cut);
}

// ---- XP: half as much again
check('the bonus', Pro.XP_BONUS === 0.5 && Pro.bonusXp(448) === 224 && Pro.bonusXp(45) === 23 && Pro.bonusXp(0) === 0 && Pro.bonusXp(undefined) === 0, [Pro.bonusXp(45)]);

// ---- streak freezes: twice a month, a break of up to a week
const M = '2026-11';
check('two freezes a month', Pro.FREEZES === 2 && Pro.freezesLeft(null, M) === 2);
let f = Pro.useFreeze(null, M, ['2026-11-08', '2026-11-09', '2026-11-10']);
check('a freeze covers the break', f && f.n === 1 && f.days.length === 3 && Pro.freezesLeft(f, M) === 1, f);
f = Pro.useFreeze(f, M, ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);
check('the second freeze, the days add up', f && f.n === 2 && f.days.length === 7 && Pro.freezesLeft(f, M) === 0, f);
check('no third freeze this month', Pro.useFreeze(f, M, ['2026-11-27', '2026-11-28', '2026-11-29']) === null);
const dec = Pro.useFreeze(f, '2026-12', ['2026-12-05', '2026-12-06', '2026-12-07']);
check('a new month has two again, the old days stay', dec && dec.n === 1 && dec.days.length === 10 && Pro.freezesLeft(f, '2026-12') === 2, dec);
check('nothing to cover, nothing used', Pro.useFreeze(null, M, []) === null && Pro.useFreeze(null, M, null) === null);
check('a break longer than a week is not covered', Pro.FREEZE_SPAN === 7 && Pro.useFreeze(null, M, ['1', '2', '3', '4', '5', '6', '7', '8']) === null && !!Pro.useFreeze(null, M, ['1', '2', '3', '4', '5', '6', '7']));

// the streak with frozen days (src/habits.js): they carry it across the break and don't count as days played
const days = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'], today = '2026-11-12';
const lost = H.streak(days, today);
check('five days away end a free streak', lost.state === 'none' && lost.count === 0 && lost.lost === 4 && lost.last === '2026-11-06', lost);
const iced = ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'];
const kept = H.streak(days, today, iced);
check('frozen days keep it', kept.state === 'due' && kept.count === 4 && kept.best === 4 && kept.lost === 0, kept);
check('the week shows them', kept.week.filter((x) => x.frozen).length === 3 && kept.week.every((x) => !(x.frozen && x.on)) && lost.week.every((x) => !x.frozen), kept.week);
const played = H.streak(days.concat([today]), today, iced);
check('playing today goes on from four', played.state === 'done' && played.count === 5, played);
check('a frozen day that was played counts as played', H.streak(days.concat(['2026-11-07']), today, iced).count === 5);
check('frozen days alone are no streak', H.streak([], today, iced).count === 0 && H.streak([], today, iced).state === 'none');
check('without frozen days nothing changes', JSON.stringify(H.streak(days, today, [])) === JSON.stringify(lost) && JSON.stringify(H.streak(days, today, null)) === JSON.stringify(lost));

// ---- the Road with Pro: every season open, the Joker any time; free, on stars as before
const none = {};
check('free: only the first season', P.seasonOpen(none, 0) && !P.seasonOpen(none, 1) && !P.seasonOpen(none, 3));
check('Pro: all four', [0, 1, 2, 3].every((i) => P.seasonOpen(none, i, true)));
check('free: the Joker is closed, Pro: open', !P.isOpen(none, P.CHAPTERS) && P.isOpen(none, P.CHAPTERS, true) && P.isOpen(none, 5, true) && !P.isOpen(none, 5));
check('the next opponent is the same either way', P.nextStage(none).ch === 1 && P.nextStage(none, true).ch === 1);
const firstSeason = { 1: 7, 2: 7, 3: 7, 4: 1 }; // ten stars: the second season is open, the third not yet
check('free stops at a closed season, Pro goes on', P.nextStage(firstSeason).ch === 5 && P.nextStage({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 }, true).ch === 9, [P.nextStage(firstSeason), P.nextStage({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 }, true)]);
const r1 = P.recordStage({ 1: 7, 2: 1 }, 3, { outcome: 1, joker: true, moves: 20 }), r2 = P.recordStage({ 1: 7, 2: 1 }, 3, { outcome: 1, joker: true, moves: 20 }, true);
check('the win that opens a season for a free player finds it open for Pro', r1.newStars === 3 && r2.newStars === 3 && r1.opened === 1 && r2.opened === -1, [r1, r2]);

// ---- the Pro quest: one more a day, the bigger kind
const q3 = P.questsFor(D), q4 = P.questsFor(D, true), pq = P.proQuestFor(D);
check('three quests free, four with Pro', q3.length === 3 && q4.length === 4 && q4.slice(0, 3).join() === q3.join() && q4[3] === pq, [q3, q4]);
check('the Pro quest is one of three, worth 120', ['p_win3', 'p_joker3', 'p_puzzles5'].includes(pq) && P.QUESTS[pq][1] === 120, pq);
check('every day has one', ['2026-11-13', '2026-12-01', '2027-01-15'].every((d) => /^p_/.test(P.proQuestFor(d))));
check('named in both languages', ['p_win3', 'p_joker3', 'p_puzzles5'].every((id) => P.questText('en', id) !== 'q_' + id && /\d/.test(P.questText('ru', id))));
const stF = {}, stP = {};
const win = { type: 'game', mode: 'bot', outcome: 1, joker: true }, puz = { type: 'puzzle' };
for (let i = 0; i < 5; i++) { P.applyQuests(stF, D, win, false); P.applyQuests(stP, D, win, true); P.applyQuests(stF, D, puz, false); P.applyQuests(stP, D, puz, true); }
check('a free player never gets it', stF.q.ids.length === 3 && !stF.q.done[pq] && stF.q.p[pq] === undefined, stF.q);
check('a Pro player finishes it', stP.q.ids.length === 4 && stP.q.done[pq] === true, stP.q);
const late = {}; P.applyQuests(late, D, puz, false); P.applyQuests(late, D, puz, true);
check('Pro from the middle of the day: the quest joins', late.q.ids.length === 4 && late.q.ids[3] === pq, late.q);

// ---- the looks only Pro has, named like every other reward
check('five Pro looks', Pro.LOOKS.length === 5 && Pro.LOOKS.filter((r) => r.kind === 'board').length === 2);
check('none of them can be earned', Pro.LOOKS.every((r) => !P.REWARDS.some((x) => x.kind === r.kind && x.id === r.id)));
check('each has a name in both languages', Pro.LOOKS.every((r) => !/^[bjft]_/.test(P.rewardName('en', r)) && !/^[bjft]_/.test(P.rewardName('ru', r))), Pro.LOOKS.map((r) => P.rewardName('ru', r)));

// ---- the words
const keys = Object.keys(Pro.TEXT.en);
check('both languages have every line', keys.length > 60 && keys.every((k) => typeof Pro.TEXT.ru[k] === 'string' && Pro.TEXT.ru[k]) && Object.keys(Pro.TEXT.ru).every((k) => k in Pro.TEXT.en),
  keys.filter((k) => !Pro.TEXT.ru[k]).concat(Object.keys(Pro.TEXT.ru).filter((k) => !(k in Pro.TEXT.en))));
check('the same placeholders in both', keys.every((k) => (Pro.TEXT.en[k].match(/\{\w+\}/g) || []).sort().join() === (Pro.TEXT.ru[k].match(/\{\w+\}/g) || []).sort().join()),
  keys.filter((k) => (Pro.TEXT.en[k].match(/\{\w+\}/g) || []).sort().join() !== (Pro.TEXT.ru[k].match(/\{\w+\}/g) || []).sort().join()));
check('a line with its numbers', Pro.t('ru', 'cta_year', { n: 7 }) === 'Попробовать 7 дней бесплатно' && Pro.t('en', 'then_year', { p: '$29.99' }) === 'Then $29.99 a year. Cancel any time.');
check('an unknown language reads English, an unknown line its key', Pro.t('de', 'notNow') === 'Not now' && Pro.t('en', 'nope') === 'nope');
check('every perk has its two lines', Pro.PERKS.length === 5 && Pro.PERKS.every((k) => Pro.TEXT.en['p_' + k] && Pro.TEXT.en['pd_' + k] && Pro.TEXT.ru['pd_' + k]));
check('no urgency in the words', keys.every((k) => !/only today|hurry|last chance|limited time|только сегодня|успей|последний шанс/i.test(Pro.TEXT.en[k] + ' ' + Pro.TEXT.ru[k])));
check('a perk line fits one row of a phone', Pro.PERKS.every((k) => Pro.TEXT.en['pd_' + k].length <= 52 && Pro.TEXT.ru['pd_' + k].length <= 46), Pro.PERKS.map((k) => [Pro.TEXT.en['pd_' + k].length, Pro.TEXT.ru['pd_' + k].length]));
check('a count is worded so that any number reads right (no "42 задач")', ['pd_puzzles', 'why_puzzles', 'packLine'].every((k) => /: \{n\}/.test(Pro.TEXT.ru[k]) && /: \{n\}/.test(Pro.TEXT.en[k])));
check('every reason for the Pro sheet has its line', ['check', 'hints', 'puzzles', 'road', 'joker', 'xp', 'look', 'streak', 'rank'].every((w) => Pro.TEXT.en['why_' + w] && Pro.TEXT.ru['why_' + w]));
check('every offer has its two lines', ['streak', 'rank', 'plain'].every((id) => Pro.TEXT.en['offer_' + id + '_t'] && Pro.TEXT.ru['offer_' + id + '_s']));
check('the perks: the coach, the pack, the Road, the XP, the status', Pro.PERKS.join() === 'coach,puzzles,road,xp,status');

// ---- Joker Pro in the apps: what the purchase plugin says about the products → the plans as the sheet shows them
{
  const free = { price: 0, priceString: 'Free', paymentMode: 0, numberOfPeriods: 1, subscriptionPeriod: { numberOfUnits: 1, unit: 1 } };
  const ios = [
    { identifier: 'jokerpro_month', price: 3.99, priceString: '$3.99', currencyCode: 'USD', introductoryPrice: null, introEligibility: 0 },
    { identifier: 'jokerpro_year', price: 29.99, priceString: '$29.99', currencyCode: 'USD', introductoryPrice: free, introEligibility: 2 },
    { identifier: 'jokerpro_founder', price: 79.99, priceString: '$79.99', currencyCode: 'USD', introEligibility: 0 },
    { identifier: 'somebody_elses', price: 1, priceString: '$1.00', currencyCode: 'USD' }];
  let c = Pro.storeCatalog('apple', ios);
  check('the App Store: three plans, the store\'s words and amounts', Object.keys(c).sort().join() === 'founder,month,year' && c.year.id === 'jokerpro_year' && c.year.price === '$29.99' && c.year.amount === 29.99 && c.year.cur === 'USD' && c.month.id === 'jokerpro_month' && c.founder.id === 'jokerpro_founder' && !c.year.base, c);
  check('... the free week on the year, for a player who may still have it', c.year.trialDays === 7 && c.month.trialDays === 0 && c.founder.trialDays === 0);
  check('... seven days written as days are seven days too', Pro.storeCatalog('apple', [Object.assign({}, ios[1], { introductoryPrice: Object.assign({}, free, { subscriptionPeriod: { numberOfUnits: 7, unit: 0 } }) })]).year.trialDays === 7);
  check('... no trial for a player who has had it (1), or when the store does not say (0)', Pro.storeCatalog('apple', [Object.assign({}, ios[1], { introEligibility: 1 })]).year.trialDays === 0 && Pro.storeCatalog('apple', [Object.assign({}, ios[1], { introEligibility: 0 })]).year.trialDays === 0);
  check('... an introductory price that is not free is not a free trial', Pro.storeCatalog('apple', [Object.assign({}, ios[1], { introductoryPrice: { price: 9.99, paymentMode: 1, numberOfPeriods: 1, subscriptionPeriod: { numberOfUnits: 1, unit: 3 } } })]).year.trialDays === 0);
  check('... a product without a price, or a plan the store did not name, is not offered', !Pro.storeCatalog('apple', [{ identifier: 'jokerpro_year', price: 0, priceString: '' }]).year && Object.keys(Pro.storeCatalog('apple', ios.slice(0, 1))).join() === 'month' &&
    Object.keys(Pro.storeCatalog('apple', null)).length === 0 && Object.keys(Pro.storeCatalog('apple', [null, 'x', 5])).length === 0);
  const play = [
    { identifier: 'year', planIdentifier: 'jokerpro_sub', offerId: 'trial', offerToken: 't1', price: 109.99, priceString: 'AED 109.99', currencyCode: 'AED' },
    { identifier: 'year', planIdentifier: 'jokerpro_sub', offerId: null, offerToken: 't0', price: 109.99, priceString: 'AED 109.99', currencyCode: 'AED' },
    { identifier: 'month', planIdentifier: 'jokerpro_sub', offerId: null, offerToken: 't2', price: 14.99, priceString: 'AED 14.99', currencyCode: 'AED' },
    { identifier: 'jokerpro_founder', price: 299.99, priceString: 'AED 299.99', currencyCode: 'AED' }];
  c = Pro.storeCatalog('google', play);
  check('Google Play: the subscription\'s base plans and the one-time product', c.year.id === 'jokerpro_sub' && c.year.base === 'year' && c.month.id === 'jokerpro_sub' && c.month.base === 'month' && c.founder.id === 'jokerpro_founder' && !c.founder.base && c.year.price === 'AED 109.99', c);
  check('... the trial when its offer comes first for the base plan (that one is bought)', c.year.trialDays === 7 && c.month.trialDays === 0);
  check('... no trial when Google does not list the offer, or lists the plain plan first', Pro.storeCatalog('google', play.slice(1)).year.trialDays === 0 && Pro.storeCatalog('google', [play[1], play[0]]).year.trialDays === 0);
  check('... another subscription\'s plans are not ours', !Pro.storeCatalog('google', [Object.assign({}, play[2], { planIdentifier: 'other_sub' })]).month);
  check('what the year saves at the store\'s prices', Pro.storeSaving(c) === 39 && Pro.storeSaving(Pro.storeCatalog('apple', ios)) === 37 && Pro.storeSaving({ year: c.year }) === null &&
    Pro.storeSaving({ year: c.year, month: Object.assign({}, c.month, { cur: 'USD' }) }) === null && Pro.storeSaving({ year: { amount: 60, cur: 'X' }, month: { amount: 5, cur: 'X' } }) === null);
  const share = (p, a) => Pro.storeShare(p, a, 12);
  check('a month of the year, in the store\'s own writing', share('$29.99', 29.99) === '$2.50' && share('US$29.99', 29.99) === 'US$2.50' && share('AED 109.99', 109.99) === 'AED 9.17' && share('29,99 €', 29.99) === '2,50 €' &&
    share('2 990,00 ₽', 2990) === '249,17 ₽' && share('1.234,56 kr', 1234.56) === '102,88 kr', [share('2 990,00 ₽', 2990), share('1.234,56 kr', 1234.56)]);
  check('... currencies without cents, with thousands, with three decimals', share('¥4,500', 4500) === '¥375' && share('₩39,000', 39000) === '₩3,250' && share('Rp 499.000', 499000) === 'Rp 41.583' && share('KWD 9.900', 9.9) === 'KWD 0.825',
    [share('¥4,500', 4500), share('Rp 499.000', 499000), share('KWD 9.900', 9.9)]);
  check('... words it cannot read give nothing (the sheet then names no monthly share)', share('٢٩٫٩٩', 29.99) === null && share('$29.99', 31) === null && share('', 5) === null && share('Free', 0) === null && Pro.storeShare('$29.99', 29.99, 0) === null);
  check('the stores\' words: every line in both languages', ['payBy_apple', 'payBy_google', 'thenS_year', 'thenS_year_paid', 'thenS_month', 'restore', 'restoreOk', 'restoreNone', 'restoreErr', 'storeErr', 'storeRetry', 'buyErr', 'buyPending', 'buyWait',
    'manage_apple', 'manage_google', 'in_apple', 'in_google', 'in_stripe', 'subRow', 'subCancel', 'welcomeSave', 'delStore_apple', 'delStore_google', 'st_trialS', 'st_dueS', 'perYearS', 'privacy'].every((k) => Pro.TEXT.en[k] && Pro.TEXT.ru[k] && Pro.TEXT.en[k] !== Pro.TEXT.ru[k]));
  check('a subscription\'s small print says the price, the period and that it renews', /\{p\} a year/.test(Pro.TEXT.en.thenS_year) && /\{n\} days/.test(Pro.TEXT.en.thenS_year) && /Renews/.test(Pro.TEXT.en.thenS_year) && /\{p\} a month/.test(Pro.TEXT.en.thenS_month) && /Renews/.test(Pro.TEXT.en.thenS_month) &&
    /\{p\} в год/.test(Pro.TEXT.ru.thenS_year) && /Продлевается/.test(Pro.TEXT.ru.thenS_month));
}

console.log(`pro: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
