// Bot strength calibration: our levels vs Stockfish (UCI_LimitStrength) and vs each other, in standard chess
// (golden moves switched off for both sides so Stockfish plays the same game).
global.GC = require('../src/core.js');
const Engine = require('../src/engine.js');
const { spawn } = require('child_process');
const OPENINGS = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], ['e2e4', 'c7c5', 'g1f3', 'd7d6'], ['d2d4', 'd7d5', 'c2c4', 'e7e6'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6'], ['e2e4', 'e7e6', 'd2d4', 'd7d5'], ['e2e4', 'c7c6', 'd2d4', 'd7d5'],
  ['c2c4', 'e7e5', 'b1c3'], ['g1f3', 'd7d5', 'g2g3', 'g8f6']
];
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 -';
const VAL = [0, 1, 3, 3, 5, 9, 0];

function makeSF(elo, movetime) {
  const p = spawn('node', [__dirname + '/../vendor/sf/package/bin/stockfish-18-lite-single.js']);
  let buf = '', waiter = null;
  p.stdout.on('data', d => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (waiter && line.startsWith(waiter.prefix)) { const w = waiter; waiter = null; w.resolve(line); }
    }
  });
  const send = s => p.stdin.write(s + '\n');
  const wait = prefix => new Promise(resolve => { waiter = { prefix, resolve }; });
  return {
    async init() { send('uci'); await wait('uciok'); if (elo) { send('setoption name UCI_LimitStrength value true'); send('setoption name UCI_Elo value ' + elo); } send('ucinewgame'); send('isready'); await wait('readyok'); },
    async move(moves) { send('position startpos moves ' + moves.join(' ')); send('go movetime ' + movetime); const l = await wait('bestmove'); return l.split(' ')[1]; },
    async newgame() { send('ucinewgame'); send('isready'); await wait('readyok'); },
    quit() { send('quit'); }
  };
}
function material(pos) { const s = [0, 0]; for (let q = 0; q < 120; q++) { if (q & 0x88) { q += 7; continue; } const p = pos.board[q]; if (p) s[p >> 3] += VAL[p & 7]; } return s; }

async function playGame(white, black, opening) {
  const pos = new GC.Position(START), moves = [], seen = {};
  for (const u of opening) { pos.makeMove(pos.moveFromUci(u)); moves.push(u); }
  let adv = 0, advSide = -1;
  for (let ply = 0; ply < 260; ply++) {
    const side = pos.side, player = side === 0 ? white : black;
    const u = await player.move(moves.slice(), pos);
    const m = u && pos.moveFromUci(u);
    if (!m || (m & GC.F_GOLDEN)) return side === 0 ? 0 : 1; // illegal → loss
    pos.makeMove(m); moves.push(u);
    const k = pos.hashKey(); seen[k] = (seen[k] || 0) + 1;
    if (!pos.hasLegalMove()) return pos.inCheck() ? (pos.side === 0 ? 0 : 1) : 0.5;
    if (seen[k] >= 3 || pos.halfmove >= 100 || pos.insufficientMaterial()) return 0.5;
    const mt = material(pos), diff = mt[0] - mt[1];
    if (Math.abs(diff) >= 8) { const s = diff > 0 ? 0 : 1; if (s === advSide) adv++; else { advSide = s; adv = 1; } if (adv >= 10) return s === 0 ? 1 : 0; } else adv = 0;
  }
  return 0.5;
}
function ours(level) {
  return { name: 'L' + level, async move(moves) { const r = Engine.think({ fen: START, moves, level }); return r.uci; }, async newgame() { Engine.clear(); } };
}
async function match(a, b, games) {
  let score = 0, w = 0, d = 0, l = 0;
  for (let g = 0; g < games; g++) {
    const op = OPENINGS[Math.floor(g / 2) % OPENINGS.length], aWhite = g % 2 === 0;
    await a.newgame(); await b.newgame();
    const r = aWhite ? await playGame(a, b, op) : 1 - await playGame(b, a, op);
    score += r; if (r === 1) w++; else if (r === 0) l++; else d++;
  }
  return { score, games, w, d, l };
}
function eloDiff(s, n) { const p = Math.min(0.97, Math.max(0.03, s / n)); return Math.round(-400 * Math.log10(1 / p - 1)); }

(async () => {
  const plan = JSON.parse(process.argv[2]);
  for (const item of plan) {
    const t0 = Date.now();
    let a = ours(item.a), b;
    if (item.sf) { b = makeSF(item.sf, item.mt || 300); b.name = 'SF' + item.sf; await b.init(); b.move = (orig => async (moves) => orig(moves))(b.move); }
    else b = ours(item.b);
    const r = await match(a, b, item.games);
    if (item.sf) b.quit();
    const line = `${a.name} vs ${b.name}: +${r.w} =${r.d} -${r.l} (${r.score}/${r.games}) diff ${eloDiff(r.score, r.games)} ${((Date.now() - t0) / 60000).toFixed(1)}min`;
    console.log(line);
  }
})();
