// The engine-made Joker Move puzzles (src/puzzles.js) and the moments from real games (src/realgames.js): ids unique,
// easy to hard, every accepted answer a legal Joker Move of the side to move with a legal continuation that ends on
// the solver's move, and (with the engine, NODES per check) every answer still far better than the best normal move.
// A moment from a real game also says who played, when, and what was played there.
// Run: node test/puzzles.js        (QUICK=1: rules only)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const ctx = { GC: global.GC };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/puzzles.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../src/realgames.js'), 'utf8') + '\nthis.P = JOKER_PUZZLES; this.R = JOKER_REAL;', ctx);
const MADE = ctx.P, REAL = ctx.R;
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } }

ok('ids unique across both lists', new Set(MADE.concat(REAL).map((p) => p.id)).size === MADE.length + REAL.length);
for (const [what, P] of [['made', MADE], ['real', REAL]]) {
  ok(what + ': there are puzzles', P.length >= 20, P.length);
  ok(what + ': levels never go down', P.every((p, i) => !i || p.lvl >= P[i - 1].lvl), P.map((p) => p.lvl).join(''));
  ok(what + ': all three levels', [1, 2, 3].every((l) => P.some((p) => p.lvl === l)));
  ok(what + ': a kind of moment where one is given', P.every((p) => !p.k || ['save', 'mate', 'win'].includes(p.k)) && P.every((p) => p.k !== 'mate' || (p.mate > 0 && p.mate <= 3)));
}
for (const p of REAL) {
  const g = p.g || {};
  ok(p.id + ': who played and when', g.w && g.b && g.wr && g.br && g.y >= 1800 && g.y <= 2030, g);
  ok(p.id + ': what was played there, or that the game ended', (typeof g.real === 'string' && /^\d+\.(\.\.)?[A-Za-z0-9+#=x-]+$/.test(g.real)) || (g.real === undefined && ['1-0', '0-1', '1/2-1/2'].includes(g.res)), g.real);
  const side = new GC.Position(p.fen).side;
  ok(p.id + ': "lost" means the side to move lost that game', !g.lost || g.res === (side === 0 ? '0-1' : '1-0'), [g.res, side]);
}
const P = MADE.concat(REAL);
for (const p of P) {
  const pos = new GC.Position(p.fen), side = pos.side;
  ok(p.id + ': the side to move holds its Joker Move', (pos.golden >> side) & 1);
  const golds = pos.legalMoves(true).filter((m) => m & GC.F_GOLDEN).map(GC.moveToUci);
  for (const [u, cont] of Object.entries(p.accept)) {
    ok(p.id + ': ' + u + ' is a legal Joker Move', golds.includes(u));
    const q = new GC.Position(p.fen); let bad = null;
    for (const c of [u].concat(cont)) { const m = q.moveFromUci(c); if (!m) { bad = c; break; } q.makeMove(m); }
    ok(p.id + ': ' + u + ' continuation legal', !bad, bad);
    ok(p.id + ': ' + u + ' continuation ends on the solver\'s move', cont.length % 2 === 0, cont);
  }
}
if (!process.env.QUICK) {
  let worst = Infinity;
  for (const p of P) {
    E.clear(); const best = E.think({ fen: p.fen, analysis: true, timeMs: 400, maxDepth: 12 });
    E.clear(); const normal = E.think({ fen: p.fen, analysis: true, timeMs: 300, maxDepth: 12, noGoldenRoot: true });
    const gain = best.score > E.MATE_BOUND ? 9999 : best.score - normal.score;
    worst = Math.min(worst, gain);
    ok(p.id + ': a Joker Move is the best move, far ahead of any normal move', best.uci && best.uci.endsWith('*') && gain >= 200, { best: best.uci, s: best.score, normal: normal.score });
  }
  console.log('smallest gain over the best normal move:', worst);
}
console.log(`joker puzzles: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
