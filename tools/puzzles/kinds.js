// What kind of moment a puzzle is, for the words above the board: "save" (without the Joker Move the side to move is
// lost: its best normal move leaves it 2.5 pawns down or worse, or mated), "mate" (the Joker Move starts a mate in
// three or fewer); the rest are plain wins. Written into the lists as k; puzzles that have a kind already are left.
// Run: node tools/puzzles/kinds.js src/puzzles.js src/daily.js
global.GC = require('../../src/core.js');
const E = require('../../src/engine.js');
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f, 'utf8'), a = src.indexOf('['), b = src.lastIndexOf(']') + 1;
  const list = JSON.parse(src.slice(a, b)), n = { save: 0, mate: 0, win: 0 };
  for (const p of list) {
    if (!p.k) {
      E.clear();
      const r = E.think({ fen: p.fen, moves: [], analysis: true, timeMs: 1200, maxDepth: 16, noGoldenRoot: true });
      p.k = r.score <= -250 ? 'save' : p.mate && p.mate <= 3 ? 'mate' : 'win';
    }
    n[p.k]++;
  }
  const body = list.map((p) => '  ' + JSON.stringify({ id: p.id, lvl: p.lvl, fen: p.fen, accept: p.accept, mate: p.mate || undefined, k: p.k, diff: p.diff, g: p.g })).join(',\n');
  fs.writeFileSync(f, src.slice(0, a) + '[\n' + body + '\n]' + src.slice(b));
  console.log(f, list.length, JSON.stringify(n));
}
