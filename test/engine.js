global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const { Position } = GC;
let fails = 0;
function t(name, fen, opts, expectFn) {
  const r = E.think(Object.assign({ fen, analysis: true }, opts));
  const ok = expectFn(r);
  if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name.padEnd(46), 'best', r.uci, 'score', r.score, 'mate', r.mate, 'd', r.depth, 'nodes', r.nodes, (r.nodes / Math.max(1, r.timeMs)).toFixed(0) + 'k/s', 'pv', r.pv.slice(0, 6).join(' '));
  return r;
}
t('mate in 1 (back rank, no golden)', '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1 -', { timeMs: 500 }, r => r.uci === 'e1e8' && r.mate === 1);
t('scholar mate in 1', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4 -', { timeMs: 500 }, r => r.uci === 'h5f7');
t('back rank: golden block is the only move', '4R1k1/5ppp/8/8/8/8/8/Kn6 b - - 0 1 Gg', { timeMs: 300 }, r => r.uci === 'b1f8*');
t('ladder mate in 2', '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1', { timeMs: 1500 }, r => r.mate === 2);
t('startpos sanity (no crash, sensible)', GC.START_FEN, { timeMs: 2000 }, r => !!r.uci && !r.uci.endsWith('*'));
t('KQ vs K winning eval', '8/8/8/4k3/8/8/8/3QK3 w - - 0 1 -', { timeMs: 1500 }, r => r.score > 800);
// play KQK out with 300ms per move: must mate within 40 moves
{
  const p = new GC.Position('8/8/8/4k3/8/8/8/3QK3 w - - 0 1 -'); const moves = []; let mated = false;
  for (let i = 0; i < 80; i++) {
    const r = E.think({ fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1 -', moves, timeMs: 250, level: 8 });
    if (!r.uci) { mated = p.inCheck(); break; }
    moves.push(r.uci); p.makeMove(p.moveFromUci(r.uci));
    if (!p.hasLegalMove()) { mated = p.inCheck(); break; }
  }
  const ok = mated && moves.length <= 80; if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + 'KQK conversion: mate after ' + Math.ceil(moves.length / 2) + ' white moves');
}
console.log(fails ? fails + ' FAILED' : 'ENGINE TESTS PASSED');
