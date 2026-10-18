global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const N = +process.argv[2] || 4, NODES = +process.argv[3] || 60000;
let scoreA = 0;
for (let g = 0; g < N; g++) {
  E.clear();
  const aWhite = g % 2 === 0, p = new GC.Position(), moves = [], hashes = {}, log = [];
  let result = null, goldenAt = -1;
  for (let ply = 0; ply < 300 && !result; ply++) {
    const aToMove = (p.side === 0) === aWhite;
    const r = E.think({ moves, timeMs: 100000, nodes: NODES, level: 8, noGolden: !aToMove });
    const m = p.moveFromUci(r.uci);
    if (!m) { result = 'ILLEGAL ' + r.uci; break; }
    const san = p.san(m);
    log.push({ ply, who: aToMove ? 'A' : 'B', san, score: r.score, pv: r.pv.slice(0, 8).join(' '), d: r.depth });
    if (m & GC.F_GOLDEN) goldenAt = ply;
    p.makeMove(m); moves.push(r.uci);
    const k = p.hashKey(); hashes[k] = (hashes[k] || 0) + 1;
    if (!p.hasLegalMove()) result = p.inCheck() ? ((p.side === 0) === aWhite ? 'B' : 'A') : 'draw';
    else if (hashes[k] >= 3 || p.halfmove >= 100 || p.insufficientMaterial()) result = 'draw';
  }
  result = result || 'draw';
  scoreA += result === 'A' ? 1 : result === 'draw' ? 0.5 : 0;
  console.log(`\ngame ${g + 1}: A=${aWhite ? 'white' : 'black'} result=${result} plies=${moves.length}`);
  if (goldenAt >= 0) for (const e of log.slice(Math.max(0, goldenAt - 2), goldenAt + 7)) console.log(`  ${e.ply} ${e.who} ${e.san.padEnd(9)} s=${String(e.score).padStart(5)} d=${e.d} pv: ${e.pv}`);
}
console.log('\nA scored', scoreA, '/', N);
