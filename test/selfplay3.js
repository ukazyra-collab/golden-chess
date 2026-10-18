global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const N = +process.argv[2] || 6, MS = +process.argv[3] || 80, NODES = +process.argv[4] || 0;
let scoreA = 0; let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
for (let g = 0; g < N; g++) {
  E.clear();
  const aWhite = g % 2 === 0, p = new GC.Position(), moves = [], hashes = {}, log = [];
  // 2 random opening plies (normal moves) for variety, same for each pair
  if (g % 2 === 0) seed = 100 + g;
  else seed = 100 + g - 1;
  for (let i = 0; i < 2; i++) { const lm = p.legalMoves(false); const m = lm[rnd(lm.length)]; p.makeMove(m); moves.push(GC.moveToUci(m)); }
  let result = null, goldenAt = [];
  for (let ply = 2; ply < 300 && !result; ply++) {
    const aToMove = (p.side === 0) === aWhite;
    const r = E.think({ moves, timeMs: NODES ? 1e6 : MS, nodes: NODES, level: 8, noGoldenRoot: !aToMove });
    const m = p.moveFromUci(r.uci);
    if (!m) { result = 'ILLEGAL ' + r.uci; break; }
    const san = p.san(m);
    log.push({ ply, who: aToMove ? 'A' : 'B', san, score: r.score, pv: r.pv.slice(0, 8).join(' '), d: r.depth });
    if (m & GC.F_GOLDEN) goldenAt.push(log.length - 1);
    p.makeMove(m); moves.push(r.uci);
    const k = p.hashKey(); hashes[k] = (hashes[k] || 0) + 1;
    if (!p.hasLegalMove()) result = p.inCheck() ? ((p.side === 0) === aWhite ? 'B' : 'A') : 'draw';
    else if (hashes[k] >= 3 || p.halfmove >= 100 || p.insufficientMaterial()) result = 'draw';
  }
  result = result || 'draw';
  scoreA += result === 'A' ? 1 : result === 'draw' ? 0.5 : 0;
  const traj = log.filter(e => e.who === 'A').filter((e, i) => i % 6 === 0).map(e => e.score).join(',');
  console.log(`game ${g + 1}: A=${aWhite ? 'white' : 'black'} result=${result} plies=${moves.length}  A-eval trajectory: ${traj}`);
  for (const gi of goldenAt) for (const e of log.slice(gi, gi + 5)) console.log(`   ${e.ply} ${e.who} ${e.san.padEnd(9)} s=${String(e.score).padStart(6)} d=${e.d} pv: ${e.pv}`);
}
console.log('A scored', scoreA, '/', N);
