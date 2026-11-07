// Joker Move puzzles, made by the engine: self-play games between weaker levels (they leave the tactics a Joker Move
// can punish), and at every position where the side to move still holds its Joker Move the engine asks whether a Joker
// Move turns the game: best with the Joker Move far above the best normal move, the normal move not already winning,
// one solution (or a few that all win). Each find goes to the output as one JSON line.
// Run: node tools/puzzles/gen.js <seed> <games> <out.jsonl>
global.GC = require('../../src/core.js');
const E = require('../../src/engine.js');
const fs = require('fs');

const SEED = +process.argv[2] || 1, GAMES = +process.argv[3] || 20, OUT = process.argv[4] || '/tmp/puzzles.jsonl';
let seed = SEED * 7919 + 13;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const MATE_BOUND = E.MATE_BOUND;
const isMate = (s) => Math.abs(s) > MATE_BOUND;
const WIN = 300;       // after the Joker Move: at least this much (or mate)
const GAIN = 300;      // over the best normal move
const NORMAL_MAX = 400; // and without it the game is not already won

function think(fen, o) { E.clear(); return E.think(Object.assign({ fen, analysis: true }, o)); }

function verify(fen) {
  const hist = [];
  const best = think(fen, { timeMs: 3000, maxDepth: 18, onInfo: (i) => hist.push({ d: i.depth, uci: i.uci, s: i.score }) });
  if (!best.uci || !best.uci.endsWith('*')) return null;
  const normal = think(fen, { timeMs: 2000, maxDepth: 18, noGoldenRoot: true });
  const bs = best.score, ns = normal.score;
  if (!(isMate(bs) && bs > 0) && bs < WIN) return null;
  if (!(isMate(bs) && bs > 0) && bs - ns < GAIN) return null;
  if (ns > NORMAL_MAX) return null;
  // the other Joker Moves that win as well are accepted too; too many: no puzzle
  const accept = {}; accept[best.uci] = best.pv.slice(1);
  const ex = [best.uci];
  for (let k = 0; k < 5; k++) {
    const alt = think(fen, { timeMs: 1500, maxDepth: 16, excludeRoot: ex });
    if (!alt.uci) break;
    const wins = alt.score >= Math.min(WIN, bs - 120) && alt.score - ns >= GAIN * 0.8;
    if (!wins) break;
    if (!alt.uci.endsWith('*')) return null; // a normal move wins as well: not a Joker Move puzzle
    accept[alt.uci] = alt.pv.slice(1); ex.push(alt.uci);
  }
  if (Object.keys(accept).length > 4) return null;
  // from what depth on the engine saw it (deeper: harder to find)
  let found = 0;
  for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].uci === best.uci) found = hist[i].d; else break; }
  return { fen, best: best.uci, score: bs, normal: ns, mate: best.mate || 0, depth: best.depth, found, pv: best.pv.slice(0, 10), accept };
}

let tried = 0, found = 0;
for (let g = 0; g < GAMES; g++) {
  const p = new GC.Position(), moves = [];
  const lw = 2 + rnd(5), lb = 2 + rnd(5); // levels 2..6
  for (let i = 0; i < 2 + rnd(3); i++) { const lm = p.legalMoves(false); const m = lm[rnd(lm.length)]; p.makeMove(m); moves.push(GC.moveToUci(m)); }
  let lastAt = -99, perGame = 0;
  for (let ply = moves.length; ply < 140; ply++) {
    if (!p.hasLegalMove() || p.halfmove >= 100 || p.insufficientMaterial()) break;
    const side = p.side, holds = (p.golden >> side) & 1;
    if (holds && ply >= 12 && ply - lastAt >= 6 && perGame < 3) {
      const fen = p.fen();
      tried++;
      const q = think(fen, { timeMs: 140, maxDepth: 9 });
      if (q.uci && q.uci.endsWith('*')) {
        const qn = think(fen, { timeMs: 120, maxDepth: 9, noGoldenRoot: true });
        if (q.score - qn.score >= GAIN * 0.7 && qn.score <= NORMAL_MAX + 150) {
          const v = verify(fen);
          if (v) { v.game = SEED + ':' + g; v.ply = ply; fs.appendFileSync(OUT, JSON.stringify(v) + '\n'); found++; lastAt = ply; perGame++; }
        }
      }
    }
    E.clear();
    const r = E.think({ fen: GC.START_FEN, moves, timeMs: 40, level: side === 0 ? lw : lb });
    const m = r.uci && p.moveFromUci(r.uci);
    if (!m) break;
    p.makeMove(m); moves.push(r.uci);
  }
  if (g % 5 === 4) console.log(`seed ${SEED} game ${g + 1}/${GAMES}: tried ${tried}, found ${found}`);
}
console.log(`seed ${SEED} done: tried ${tried}, found ${found}`);
