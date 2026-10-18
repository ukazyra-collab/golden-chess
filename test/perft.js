const GC = require('../src/core.js');
const cases = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281, 4865609]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
  ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]],
];
let ok = true; const t0 = Date.now(); let nodes = 0;
for (const [fen, exp] of cases) {
  const pos = new GC.Position(fen);
  const h0 = pos.hashKey(), f0 = pos.fen();
  for (let d = 1; d <= exp.length; d++) {
    const n = pos.perft(d, false); nodes += n;
    if (n !== exp[d-1]) { ok = false; console.log('FAIL', fen, 'd', d, 'got', n, 'exp', exp[d-1]); }
  }
  if (pos.hashKey() !== h0 || pos.fen() !== f0) { ok = false; console.log('STATE NOT RESTORED', fen); }
  // incremental hash/eval consistency
  const p2 = new GC.Position(pos.fen());
  if (p2.hashKey() !== pos.hashKey() || p2.mg[0] !== pos.mg[0] || p2.eg[1] !== pos.eg[1]) { ok = false; console.log('incremental mismatch'); }
}
const dt = (Date.now() - t0) / 1000;
console.log(ok ? 'PERFT OK' : 'PERFT FAILED', nodes, 'leaf nodes in', dt.toFixed(1), 's', Math.round(nodes/dt/1000)+'k/s');
