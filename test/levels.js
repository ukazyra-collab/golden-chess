global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4 Gg';
for (let lv = 1; lv <= 8; lv++) {
  const picks = {}; let ms = 0;
  const runs = lv <= 4 ? 6 : 1;
  for (let i = 0; i < runs; i++) { const t = Date.now(); const r = E.think({ fen, level: lv }); ms += Date.now() - t; picks[r.uci] = (picks[r.uci] || 0) + 1; }
  console.log('level', lv, 'avg ms', Math.round(ms / runs), 'picks', JSON.stringify(picks));
}
