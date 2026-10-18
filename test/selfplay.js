global.GC = require('../src/core.js');
const E = require('../src/engine.js');
// A = golden-aware engine; B = same engine that never uses its golden move. Alternate colours.
const N = +process.argv[2] || 8, MS = +process.argv[3] || 80;
let scoreA = 0, goldenPlies = [], results = [];
for (let g = 0; g < N; g++) {
  E.clear();
  const aWhite = g % 2 === 0, p = new GC.Position(), moves = [], hashes = {};
  let result = null;
  for (let ply = 0; ply < 300 && !result; ply++) {
    const aToMove = (p.side === 0) === aWhite;
    const r = E.think({ moves, timeMs: MS, level: 8, noGolden: !aToMove });
    if (!r.uci) break;
    const m = p.moveFromUci(r.uci);
    if (!m) { result = 'ILLEGAL ' + r.uci; break; }
    if (m & GC.F_GOLDEN) goldenPlies.push({ ply, by: aToMove ? 'A' : 'B', san: p.san(m) });
    p.makeMove(m); moves.push(r.uci);
    const k = p.hashKey(); hashes[k] = (hashes[k] || 0) + 1;
    if (!p.hasLegalMove()) result = p.inCheck() ? ((p.side === 0) === aWhite ? 'B' : 'A') : 'draw';
    else if (hashes[k] >= 3 || p.halfmove >= 100 || p.insufficientMaterial()) result = 'draw';
  }
  if (!result) result = 'draw';
  results.push(result); scoreA += result === 'A' ? 1 : result === 'draw' ? 0.5 : 0;
  console.log(`game ${g + 1}: A=${aWhite ? 'white' : 'black'} result=${result} plies=${moves.length}`);
}
console.log('A (uses golden) scored', scoreA, '/', N);
console.log('golden moves:', goldenPlies.map(x => `${x.by}@${x.ply}:${x.san}`).join('  '));
