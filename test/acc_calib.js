// Accuracy -> Elo calibration: bots of known strength play each other (golden chess, golden moves on),
// then every position is reviewed exactly like the in-app review (260 ms per position).
global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const winPct = cp => { cp = Math.max(-1500, Math.min(1500, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); };
const cpOf = e => e.mate ? (e.mate > 0 ? 10000 - e.mate * 10 : -10000 - e.mate * 10) : Math.max(-10000, Math.min(10000, e.score));
const levels = JSON.parse(process.argv[2] || '[1,2,3,4,5,6,7,8]'), per = +(process.argv[3] || 3);
const out = [];
for (const lv of levels) for (let g = 0; g < per; g++) {
  E.clear();
  const p = new GC.Position(), moves = [], seen = {};
  for (let ply = 0; ply < 160; ply++) {
    const r = E.think({ moves, level: lv, timeMs: Math.min(E.LEVELS[lv - 1].time, 500) });
    if (!r.uci) break;
    const m = p.moveFromUci(r.uci); p.makeMove(m); moves.push(r.uci);
    const k = p.hashKey(); seen[k] = (seen[k] || 0) + 1;
    if (!p.hasLegalMove() || seen[k] >= 3 || p.halfmove >= 100 || p.insufficientMaterial()) break;
  }
  E.clear();
  const sc = [];
  for (let i = 0; i <= moves.length; i++) { const r = E.think({ moves: moves.slice(0, i), timeMs: 260, analysis: true }); sc.push({ score: r.score, mate: r.mate || 0 }); }
  const acc = [[], []];
  for (let i = 0; i < moves.length; i++) {
    const before = winPct(cpOf(sc[i])), after = winPct(-cpOf(sc[i + 1])), drop = Math.max(0, before - after);
    acc[i % 2].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669)));
  }
  for (const c of [0, 1]) {
    const xs = acc[c]; if (xs.length < 8) continue;
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length, harm = xs.length / xs.reduce((s, v) => s + 1 / Math.max(5, v), 0);
    out.push({ lv, elo: E.LEVELS[lv - 1].elo, acc: +((mean + harm) / 2).toFixed(1), n: xs.length });
  }
  console.log(JSON.stringify(out.slice(-2)));
}
const byLv = {};
for (const o of out) (byLv[o.lv] = byLv[o.lv] || []).push(o.acc);
console.log('SUMMARY', JSON.stringify(Object.entries(byLv).map(([lv, a]) => [+lv, E.LEVELS[lv - 1].elo, +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1), a.length])));
