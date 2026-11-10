// Fair play scan (prototype, read-only): how close each player's moves are to the engine's, game by game and over
// all their games. For every position of a finished online game the engine gives the best move and its score
// (reviewStep, the same search as the game review, at a fixed depth so every move is judged alike). From that:
//   T1   the played move is the engine's best move (a Joker Move counts as any other move)
//   loss how much the played move gives away: the best score minus the score after the move (centipawns, capped)
//   joker-blind  a winning Joker Move was there (the best move, well ahead of every normal one) and a normal move was
//         played that is the best normal move: the signature of help from an ordinary chess engine, which can't see
//         Joker Moves (Stockfish and every other public engine)
// Moves that say little are left out: the first 8 plies (opening knowledge), positions already decided (|score| > 600)
// and forced moves (one legal move).
// Players are then compared with the rest: a high T1 with a low loss over many moves is how engine help shows.
// Run: node tools/fairplay/scan.js <games.json> <out.json> [depth] [ms]
global.GC = require('../../src/core.js');
const E = require('../../src/engine.js');
const fs = require('fs');

const [, , IN, OUT, DEPTH = '8', MS = '400'] = process.argv;
const games = JSON.parse(fs.readFileSync(IN, 'utf8'));
const CAP = 500, DECIDED = 600, MATEV = 1500;
const cp = (st) => (st.mate ? (st.mate > 0 ? MATEV : -MATEV) : Math.max(-MATEV, Math.min(MATEV, st.score)));

const out = { at: new Date().toISOString(), depth: +DEPTH, ms: +MS, games: [] };
let done = 0;
for (const g of games) {
  const fen = g.fen || GC.START_FEN, moves = g.mv ? g.mv.split(' ') : [];
  const steps = [];
  for (let k = 0; k <= moves.length; k++) {
    const p = new GC.Position(fen);
    for (let i = 0; i < k; i++) p.makeMove(p.moveFromUci(moves[i]));
    if (!p.hasLegalMove()) { steps.push(null); break; }
    E.clear();
    const st = E.reviewStep(fen, moves.slice(0, k), { depth: +DEPTH, timeMs: +MS });
    st.legal = p.legalMoves(true).length;
    st.holds = (p.golden >> p.side) & 1;
    steps.push(st);
  }
  const sides = [0, 1].map((c) => ({ n: 0, t1: 0, loss: 0, big: 0, jokerChances: 0, jokerFound: 0, jokerBlind: 0 }));
  for (let k = 0; k < moves.length; k++) {
    const st = steps[k], nx = steps[k + 1];
    if (!st) break;
    const side = (k + (fen.split(' ')[1] === 'b' ? 1 : 0)) & 1, s = sides[side];
    const best = cp(st), after = nx ? -cp(nx) : best; // the game ended with this move: as good as the best
    const played = moves[k];
    // a winning Joker Move on the board: the best move is one, far ahead of the best normal move
    if (st.alt && st.uci && st.uci.endsWith('*') && best - cp(st.alt) >= 200 && best >= 150) {
      s.jokerChances++;
      if (played.endsWith('*')) s.jokerFound++;
      else if (played === st.alt.uci) s.jokerBlind++;
    }
    if (k < 8 || Math.abs(best) > DECIDED || st.legal <= 1) continue;
    s.n++;
    if (played === st.uci) s.t1++;
    const loss = Math.max(0, Math.min(CAP, best - after));
    s.loss += loss;
    if (loss >= 300) s.big++;
  }
  out.games.push({ id: g.id, pool: g.pool, tc: g.tc, res: g.res, why: g.why, plies: moves.length,
    w: { id: g.w, name: g.wn, house: g.wh, rating: g.wr, ...sides[0] }, b: { id: g.b, name: g.bn, house: g.bh, rating: g.br, ...sides[1] } });
  done++;
  process.stdout.write(`${done}/${games.length} ${g.id} plies ${moves.length}\n`);
  fs.writeFileSync(OUT, JSON.stringify(out));
}
console.log('done');
