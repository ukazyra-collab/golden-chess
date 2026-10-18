global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const fens = [
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'r2q1rk1/pp2bppp/2n1pn2/3p4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 1 9',
  '2r2rk1/pp1q1ppp/3bpn2/3p4/3P4/2NBPN2/PPQ2PPP/2R2RK1 w - - 4 15',
];
for (const g of ['Gg', '-']) {
  let tot = 0, dsum = 0;
  for (const f of fens) { E.clear(); const r = E.think({ fen: f + ' ' + g, timeMs: 1500, analysis: true }); tot += r.nodes; dsum += r.depth; }
  console.log(`golden=${g.padEnd(2)} avg depth ${(dsum / fens.length).toFixed(1)}  nodes ${tot}`);
}
