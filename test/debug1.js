global.GC = require('../src/core.js');
const E = require('../src/engine.js');
E.clear();
const aWhite = false, p = new GC.Position(), moves = [];
for (let ply = 0; ply < 6; ply++) {
  const aToMove = (p.side === 0) === aWhite;
  const r = E.think({ moves, timeMs: 80, level: 8, noGolden: !aToMove });
  const m = p.moveFromUci(r.uci);
  console.log(ply, aToMove ? 'A' : 'B', p.san(m), 'score', r.score, 'd', r.depth, 'pv', r.pv.join(' '));
  p.makeMove(m); moves.push(r.uci);
}
console.log(p.fen());
