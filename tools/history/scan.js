// Where would one Joker Move have changed a real game? For every position of every collected game the engine gives
// the side to move a Joker Move (the other side has none) and asks whether it turns the game: mate or three pawns
// up, far above the best ordinary move, with one answer (or a few that all win). Two passes: a quick look at every
// position, then a careful check of the most promising ones in each game.
// Run: node tools/history/scan.js <part> <parts> [ids...]   (writes tools/history/finds/<id>.jsonl)
global.GC = require('../../src/core.js');
const E = require('../../src/engine.js');
const fs = require('fs'), path = require('path');
const games = require('./games.json');
const PART = +process.argv[2] || 0, PARTS = +process.argv[3] || 1, ONLY = process.argv.slice(4);
const OUT = path.join(__dirname, 'finds');
fs.mkdirSync(OUT, { recursive: true });
const MATE_BOUND = E.MATE_BOUND, isMate = (s) => Math.abs(s) > MATE_BOUND;
const WIN = 300, GAIN = 300, NORMAL_MAX = 400, PER_GAME = +process.env.PER_GAME || 4, CHECKS = +process.env.CHECKS || 9;
const SCREEN = +process.env.SCREEN_MS || 300;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 -';

function think(fen, o) { E.clear(); return E.think(Object.assign({ fen, analysis: true }, o)); }
// the same position with a Joker Move for one side only ('w' / 'b'), or for nobody
function withJoker(fen, side) { const f = fen.split(' '); f[6] = side === 'w' ? 'G' : side === 'b' ? 'g' : '-'; return f.join(' '); }

function verify(fen) {
  const hist = [];
  const best = think(fen, { timeMs: 3000, maxDepth: 18, onInfo: (i) => hist.push({ d: i.depth, uci: i.uci, s: i.score }) });
  if (!best.uci || !best.uci.endsWith('*')) return null;
  const normal = think(fen, { timeMs: 2000, maxDepth: 18, noGoldenRoot: true });
  const bs = best.score, ns = normal.score;
  if (!(isMate(bs) && bs > 0) && bs < WIN) return null;
  if (!(isMate(bs) && bs > 0) && bs - ns < GAIN) return null;
  if (ns > NORMAL_MAX) return null;
  const accept = {}; accept[best.uci] = best.pv.slice(1);
  const ex = [best.uci];
  for (let k = 0; k < 5; k++) {
    const alt = think(fen, { timeMs: 1500, maxDepth: 16, excludeRoot: ex });
    if (!alt.uci) break;
    const wins = alt.score >= Math.min(WIN, bs - 120) && alt.score - ns >= GAIN * 0.8;
    if (!wins) break;
    if (!alt.uci.endsWith('*')) return null;
    accept[alt.uci] = alt.pv.slice(1); ex.push(alt.uci);
  }
  if (Object.keys(accept).length > 4) return null;
  let found = 0;
  for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].uci === best.uci) found = hist[i].d; else break; }
  // what the game was worth here with no Joker Move at all: history's own verdict
  const plain = think(withJoker(fen, null), { timeMs: 1500, maxDepth: 16 });
  return { fen, best: best.uci, score: bs, normal: ns, plain: plain.score, plainMove: plain.uci, mate: best.mate || 0, depth: best.depth, found, pv: best.pv.slice(0, 10), accept };
}

games.forEach((g, gi) => {
  if (gi % PARTS !== PART) return;
  if (ONLY.length && ONLY.indexOf(g.id) < 0) return;
  const file = path.join(OUT, g.id + '.jsonl');
  if (fs.existsSync(file) && !process.env.REDO) return;
  const t0 = Date.now();
  const moves = g.moves.split(' '), p = new GC.Position(START), cands = [];
  const loser = g.result === '1-0' ? 'b' : g.result === '0-1' ? 'w' : null;
  for (let ply = 0; ply <= moves.length; ply++) {
    if (ply >= 12 && p.hasLegalMove()) {
      const side = p.side === 0 ? 'w' : 'b', fen = withJoker(p.fen(), side);
      const q = think(fen, { timeMs: SCREEN, maxDepth: 10 });
      if (q.uci && q.uci.endsWith('*')) {
        const qn = think(fen, { timeMs: Math.round(SCREEN * 0.7), maxDepth: 10, noGoldenRoot: true });
        if (q.score - qn.score >= GAIN * 0.7 && qn.score <= NORMAL_MAX + 150) {
          // the losing side's chances first, the closer to the end the better; then anyone's
          const drama = (side === loser ? 1000 : 0) + (qn.score < -150 ? 400 : qn.score < 80 ? 200 : 0) + Math.round(200 * ply / moves.length) + (isMate(q.score) ? 150 : 0);
          cands.push({ ply, side, fen, drama, q: q.score, qn: qn.score });
        }
      }
    }
    if (ply < moves.length) p.makeMove(p.moveFromUci(moves[ply]));
  }
  cands.sort((a, b) => b.drama - a.drama);
  const finds = [];
  let checked = 0, lastPly = -99;
  for (const c of cands) {
    if (finds.length >= PER_GAME || checked >= CHECKS) break;
    if (finds.some((f) => Math.abs(f.ply - c.ply) < 4 && f.side === c.side)) continue; // the same idea a move later
    checked++;
    const v = verify(c.fen);
    if (v) { v.id = g.id; v.ply = c.ply; v.side = c.side; v.loser = c.side === loser; v.total = moves.length; v.real = moves[c.ply] || null; finds.push(v); }
  }
  fs.writeFileSync(file, finds.map((f) => JSON.stringify(f)).join('\n') + (finds.length ? '\n' : ''));
  console.log(`${g.id}: ${cands.length} candidates, ${checked} checked, ${finds.length} finds, ${Math.round((Date.now() - t0) / 1000)} s` + finds.map((f) => ` [ply ${f.ply} ${f.side}${f.loser ? ' loser' : ''} ${f.best} plain ${f.plain} -> ${f.score}${f.mate ? ' mate ' + f.mate : ''} x${Object.keys(f.accept).length}]`).join(''));
});
