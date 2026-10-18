// The Learn tab's boards and puzzles, checked with the rules and the engine:
// every scripted move is legal, the "mate in normal chess" positions really are, every accepted puzzle answer
// is a golden move that wins or saves the game, and every other golden move scores clearly worse.
// Run: node test/learn.js            (NODES=<n> sets the search per golden move, default 40000)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
global.GC = require('../src/core.js');
const E = require('../src/engine.js');
const NODES = +process.env.NODES || 40000;

const ctx = { GC: global.GC, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/ui/learn.js'), 'utf8') + '\nthis.GCLearn = GCLearn;', ctx);
const { DEMOS, PUZZLES } = ctx.GCLearn;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) pass++; else fail++;
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (!cond && extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
}
const sq = (n) => 'abcdefgh'.indexOf(n[0]) + (+n[1] - 1) * 16;
const golden = (m) => !!(m & GC.F_GOLDEN);
function normalMoves(p) { return p.legalMoves(true).filter((m) => !golden(m)); }
function play(p, uci) { const m = p.moveFromUci(uci); if (!m) return null; p.makeMove(m); return m; }

// ---- autoplay boards
for (const [name, d] of Object.entries(DEMOS)) {
  const p = new GC.Position(d.fen);
  let legal = true, why = '';
  for (const s of d.steps) {
    if (s.sel) {
      const from = sq(s.sel), pc = p.board[from];
      const targets = p.legalMoves(true).filter((m) => golden(m) && (m & 127) === from);
      if (!pc || (pc >> 3) !== p.side || !targets.length) { legal = false; why = 'select ' + s.sel; break; }
      continue;
    }
    const m = p.moveFromUci(s.uci);
    if (!m || golden(m) !== s.uci.endsWith('*')) { legal = false; why = s.uci; break; }
    p.makeMove(m);
  }
  ok(`demo "${name}": every step is legal`, legal, why);
}
{
  // the check in the block demo would be mate without the golden move
  const p = new GC.Position(DEMOS.block.fen); play(p, DEMOS.block.steps[0].uci);
  ok('demo "block": the check is mate in normal chess', p.inCheck() && normalMoves(p).length === 0);
}

// ---- puzzles
function scoreAfter(fen, uci) {
  E.clear();
  const r = E.think({ fen, moves: [uci], nodes: NODES, timeMs: 1e7, level: 8, analysis: true });
  return -r.score; // for the side that played uci
}
const P1 = new GC.Position(PUZZLES[0].fen);
ok('puzzle 1: in check, and mate without the golden move', P1.inCheck() && normalMoves(P1).length === 0);
PUZZLES.forEach((pz, i) => {
  const p = new GC.Position(pz.fen), n = i + 1;
  const golds = p.legalMoves(true).filter(golden).map((m) => GC.moveToUci(m));
  const acc = Object.keys(pz.accept);
  ok(`puzzle ${n}: accepted answers are legal golden moves`, acc.every((u) => golds.includes(u)), acc.filter((u) => !golds.includes(u)));
  ok(`puzzle ${n}: the first accepted answer is what "Show answer" plays`, golds.includes(acc[0]));
  for (const u of acc) {
    const q = new GC.Position(pz.fen); play(q, u);
    const bad = pz.accept[u].find((c) => !play(q, c));
    ok(`puzzle ${n}: ${u} and its continuation are legal`, !bad, bad);
  }
  const t0 = Date.now();
  const scores = golds.map((u) => ({ u, s: scoreAfter(pz.fen, u) }));
  const good = scores.filter((x) => acc.includes(x.u)), rest = scores.filter((x) => !acc.includes(x.u));
  const worstGood = Math.min(...good.map((x) => x.s)), bestRest = rest.length ? Math.max(...rest.map((x) => x.s)) : -Infinity;
  const top = scores.slice().sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.u + ' ' + x.s).join(', ');
  console.log(`     puzzle ${n}: ${golds.length} golden moves in ${((Date.now() - t0) / 1000).toFixed(1)} s; best: ${top}`);
  ok(`puzzle ${n}: every accepted answer wins or saves the game`, worstGood > -60, good);
  ok(`puzzle ${n}: every other golden move is clearly worse`, worstGood - bestRest >= 150, { worstGood, bestRest });
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
