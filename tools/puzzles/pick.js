// The engine's finds (tools/puzzles/gen.js) into the Learn tab's puzzles: each one checked again with more time,
// its answers' continuations played out (the opponent's best reply and ours, up to the point), sorted from easy to hard
// and written to src/puzzles.js. Puzzles already there keep their id and place; new ones are merged in by difficulty.
// Run: node tools/puzzles/pick.js <max> <finds.jsonl>...
global.GC = require('../../src/core.js');
const E = require('../../src/engine.js');
const fs = require('fs');
const path = require('path');

const MAX = +process.argv[2] || 200;
const files = process.argv.slice(3);
// PICK_OUT / PICK_VAR / PICK_ID: another list (the daily puzzles: src/daily.js, JOKER_DAILY, ids d1, d2...);
// PICK_AVOID: a list whose positions never come back in this one (the Learn puzzles, for the daily list)
const OUT = process.env.PICK_OUT ? path.resolve(process.env.PICK_OUT) : path.join(__dirname, '../../src/puzzles.js');
const VAR = process.env.PICK_VAR || 'JOKER_PUZZLES', ID = process.env.PICK_ID || 'j';
const MATE_BOUND = E.MATE_BOUND;
const isMate = (s) => Math.abs(s) > MATE_BOUND;

function think(fen, moves, o) { E.clear(); return E.think(Object.assign({ fen, moves, analysis: true }, o)); }

// the line after a Joker Move: the opponent's best reply and ours, until mate or a clear gain, ending on our move
function continuation(fen, joker, mate) {
  const line = [];
  const p = new GC.Position(fen); p.makeMove(p.moveFromUci(joker));
  const maxPlies = mate ? Math.min(2 * mate - 1, 7) : 4;
  for (let k = 0; k < maxPlies; k++) {
    if (!p.hasLegalMove()) break;
    const r = think(fen, [joker].concat(line), { timeMs: 900, maxDepth: 14 });
    if (!r.uci) break;
    const m = p.moveFromUci(r.uci); if (!m) break;
    const ours = k % 2 === 1, cap = !!(m & GC.F_CAPTURE);
    p.makeMove(m); line.push(r.uci);
    if (ours && !mate && (cap || k >= 3)) break;
  }
  if (line.length % 2 === 1) line.pop(); // end on our move
  return line;
}

const seen = new Set();
let old = [];
try {
  const src = fs.readFileSync(OUT, 'utf8');
  old = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
} catch (e) { old = []; }
old.forEach((p) => seen.add(p.fen.split(' ').slice(0, 4).join(' ')));
if (process.env.PICK_AVOID) {
  const a = fs.readFileSync(path.resolve(process.env.PICK_AVOID), 'utf8');
  JSON.parse(a.slice(a.indexOf('['), a.lastIndexOf(']') + 1)).forEach((p) => seen.add(p.fen.split(' ').slice(0, 4).join(' ')));
}

const finds = [];
for (const f of files) for (const line of fs.readFileSync(f, 'utf8').split('\n')) { if (line.trim()) finds.push(JSON.parse(line)); }
const perGame = {};
const fresh = [];
for (const v of finds) {
  const key = v.fen.split(' ').slice(0, 4).join(' ');
  if (seen.has(key)) continue;
  if ((perGame[v.game] = (perGame[v.game] || 0) + 1) > 2) continue;
  seen.add(key);
  // again, with more time: still the best by far, and the same answers
  const best = think(v.fen, [], { timeMs: 5000, maxDepth: 20 });
  const normal = think(v.fen, [], { timeMs: 3000, maxDepth: 20, noGoldenRoot: true });
  if (!best.uci || !(best.uci in v.accept)) { console.log('dropped (best changed)', v.fen, best.uci); continue; }
  if (!(isMate(best.score) && best.score > 0) && (best.score < 280 || best.score - normal.score < 280)) { console.log('dropped (gain)', v.fen); continue; }
  const accept = {};
  for (const u of Object.keys(v.accept)) {
    const c = continuation(v.fen, u, u === best.uci ? best.mate : 0);
    accept[u] = c;
  }
  const pos = new GC.Position(v.fen), side = pos.side, opp = (pos.golden >> (1 - side)) & 1;
  // how hard: how deep the engine had to look, a long mate, a quiet follow-up, the opponent's own Joker Move, one answer only
  const c0 = accept[best.uci];
  const quiet = c0.length >= 2 && !(() => { const q = new GC.Position(v.fen); q.makeMove(q.moveFromUci(best.uci)); q.makeMove(q.moveFromUci(c0[0])); return q.moveFromUci(c0[1]) & GC.F_CAPTURE; })();
  const diff = (v.found || 3) * 2 + (best.mate > 0 ? Math.min(best.mate, 5) : 3) + (quiet ? 3 : 0) + (opp ? 2 : 0) - (Object.keys(accept).length - 1) * 2;
  fresh.push({ fen: v.fen, accept, mate: best.mate > 0 ? best.mate : 0, diff });
  console.log('ok', fresh.length, v.fen, best.uci, best.mate ? 'M' + best.mate : best.score, 'diff', diff);
}

// old ones keep their place and id; new ones are numbered on and everything is sorted by difficulty
let nextId = old.reduce((n, p) => Math.max(n, +String(p.id).slice(1) || 0), 0) + 1;
const all = old.concat(fresh.map((p) => Object.assign({ id: ID + nextId++ }, p)));
all.sort((a, b) => a.diff - b.diff);
const list = all.slice(0, MAX);
list.forEach((p, i) => { p.lvl = i < list.length * 0.35 ? 1 : i < list.length * 0.75 ? 2 : 3; });
const body = list.map((p) => '  ' + JSON.stringify({ id: p.id, lvl: p.lvl, fen: p.fen, accept: p.accept, mate: p.mate || undefined, diff: p.diff })).join(',\n');
fs.writeFileSync(OUT, '/* Joker Move puzzles made by the engine (tools/puzzles/gen.js finds them, pick.js checks and sorts them): easy to hard.\n' +
  ' * Every accepted answer wins (or mates) and beats the best normal move by three pawns or more. */\nvar ' + VAR + ' = [\n' + body + '\n];\n');
console.log('wrote', list.length, 'puzzles (', fresh.length, 'new )');
