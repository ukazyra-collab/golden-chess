// The game review on real games (test/fixtures/games.json): runs the engine over every position like the page does,
// then GCReview.analyze, and prints each side's report. Checks the shape and a few facts.
// Run: node test/review_report.js [depth]   (the page's settings by default: depth 10, at most 1.2 s a position)
global.GC = require('../src/core.js');
const Engine = require('../src/engine.js');
global.Engine = Engine;
const R = require('../src/review.js');
const games = require('./fixtures/games.json');
const depth = +process.argv[2] || Engine.REVIEW_DEPTH, opts = { depth, timeMs: Engine.REVIEW_CAP };
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

for (const g of games) {
  const pos = new GC.Position(GC.START_FEN), fens = [pos.fen()], records = [];
  for (const u of g.moves) {
    const m = pos.moveFromUci(u), legal = pos.legalMoves(true);
    const san = pos.san(m, legal), color = pos.side;
    pos.makeMove(m); fens.push(pos.fen());
    records.push({ uci: u, san, golden: u.includes('*'), color });
  }
  const t0 = Date.now(), scores = [];
  Engine.clear();
  for (let i = 0; i <= g.moves.length; i++) scores.push(Engine.reviewStep(GC.START_FEN, g.moves.slice(0, i), opts));
  const a = R.analyze({ fens, records, scores });
  console.log(`\n== ${g.id} ${g.white} – ${g.black} ${g.result} (${g.moves.length} plies, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  [0, 1].forEach((c) => {
    const s = a.sum[c];
    console.log(` ${c ? g.black : g.white}: accuracy ${s.accuracy.toFixed(1)}, ~${s.elo} Elo, ` + R.CLASSES.filter((k) => s.counts[k]).map((k) => k + ' ' + s.counts[k]).join(', ') +
      ` | phases ${['opening', 'middlegame', 'endgame'].map((k) => s.phases[k] ? k[0] + ':' + s.phases[k].acc.toFixed(0) + '/' + s.phases[k].mark : k[0] + ':-').join(' ')}` +
      (s.golden ? ` | golden ${s.golden.san} (${s.golden.cls})` : '') + (s.missed.length ? ` | missed golden: ${s.missed.map((x) => (Math.floor(x.ply / 2) + 1) + '.' + x.san + ' +' + x.gain.toFixed(0) + '%').join(', ')}` : ''));
  });
  a.moves.forEach((m, i) => {
    if (!m || ['best', 'excellent', 'good'].includes(m.cls)) return;
    console.log(`   ${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${records[i].san} ${m.cls} (-${m.drop.toFixed(0)}%) best ${m.bestSan}` + (m.reason ? ' — ' + JSON.stringify(m.reason) : ''));
  });
  check(g.id + ': a class for every move', a.moves.filter(Boolean).length === g.moves.length);
  check(g.id + ': both sides summed', a.sum[0] && a.sum[1] && a.sum[0].accuracy > 0 && a.sum[1].accuracy > 0);
  check(g.id + ': classes are known', a.moves.every((m) => R.CLASSES.includes(m.cls)));
}
// the coach on a real game (test/fixtures/coach.json): 8.Qe2 allows Black's golden Nb8★f4 (it hits the queen, Black
// comes out the exchange and a pawn up); the best move was 8.hxg4, because after Qxh1+ the golden Ra1★g1 saves White
{
  const g = require('./fixtures/coach.json');
  const pos = new GC.Position(GC.START_FEN), fens = [pos.fen()], records = [];
  for (const u of g.moves) { const m = pos.moveFromUci(u), san = pos.san(m, pos.legalMoves(true)), color = pos.side; pos.makeMove(m); fens.push(pos.fen()); records.push({ uci: u, san, golden: u.includes('*'), color }); }
  Engine.clear();
  const scores = [];
  for (let i = 0; i <= g.moves.length; i++) scores.push(Engine.reviewStep(GC.START_FEN, g.moves.slice(0, i), opts));
  const a = R.analyze({ fens, records, scores }), q = a.moves[14];
  console.log('\n== coach.json 8.Qe2:', q.cls, JSON.stringify(q.reason), '| follow', q.follow.sans.join(' '), '| best line', q.line.sans.join(' '));
  check('8.Qe2 is a mistake or a blunder', ['mistake', 'blunder'].includes(q.cls), q.cls);
  check('the answer: the golden Nb8★f4 hitting the queen', q.reason && q.reason.reply && q.reason.reply.kind === 'golden' && q.reason.reply.san === 'Nb8★f4' && q.reason.reply.targets[0] === 5, q.reason);
  check('the best line: hxg4 Qxh1+ Ra1★g1', q.line.sans.slice(0, 3).join(' ') === 'hxg4 Qxh1+ Ra1★g1', q.line.sans);
  check('Black comes out ahead in the follow-up', q.follow.swing <= -2 && q.follow.gain, q.follow);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
