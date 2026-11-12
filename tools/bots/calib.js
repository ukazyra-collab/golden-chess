// Where a bot stands between its neighbours: matches of real Joker Chess (both sides have their Joker Move) between
// two engine settings, each with an engine of its own (nothing shared, as in the app, where a bot thinks alone).
// A player is an engine level (1..8), the name of a bot from src/progress.js (its own setting, or its level), or a
// setting to try: {"name":"x","lv":{"depth":2,"time":400,"noise":300,"exact":true,"temp":110,"margin":360}}.
// A new bot's rating is read off between its neighbours: lower + (upper - lower) * dLow / (dLow + dUp), where dLow is
// how far it stands above the lower neighbour in these matches and dUp how far below the upper one.
// Run: node tools/bots/calib.js '[{"a":"sonya","b":1,"games":300},{"a":"sonya","b":2,"games":300}]'
global.GC = require('../../src/core.js');
const Progress = require('../../src/progress.js');
function engine() { const f = require.resolve('../../src/engine.js'); delete require.cache[f]; return require(f); }
const OPENINGS = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], ['e2e4', 'c7c5', 'g1f3', 'd7d6'], ['d2d4', 'd7d5', 'c2c4', 'e7e6'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6'], ['e2e4', 'e7e6', 'd2d4', 'd7d5'], ['e2e4', 'c7c6', 'd2d4', 'd7d5'],
  ['c2c4', 'e7e5', 'b1c3'], ['g1f3', 'd7d5', 'g2g3', 'g8f6'], [], ['e2e4'], ['d2d4'], ['e2e4', 'e7e5']
];
const VAL = [0, 1, 3, 3, 5, 9, 0];
function material(pos) { const s = [0, 0]; for (let q = 0; q < 120; q++) { if (q & 0x88) { q += 7; continue; } const p = pos.board[q]; if (p) s[p >> 3] += VAL[p & 7]; } return s; }
function player(spec) {
  const E = engine(), b = typeof spec === 'string' ? Progress.bot(spec) : null;
  if (typeof spec === 'string' && !b) throw new Error('no bot ' + spec);
  const lv = b ? b.lv : typeof spec === 'object' ? spec.lv : null, level = b ? b.level : spec;
  return { name: typeof spec === 'number' ? 'L' + spec : b ? spec : spec.name, jokers: 0,
    move(moves) { const r = E.think(lv ? { fen: GC.START_FEN, moves, lv } : { fen: GC.START_FEN, moves, level }); if (r.uci && r.uci.indexOf('*') > 0) this.jokers++; return r.uci; },
    newgame() { E.clear(); } };
}
// 1 = White won, 0 = Black won, 0.5 = a draw; a side eight points of material up for ten plies is given the game
function playGame(white, black, opening) {
  const pos = new GC.Position(GC.START_FEN), moves = [], seen = {};
  for (const u of opening) { pos.makeMove(pos.moveFromUci(u)); moves.push(u); }
  let adv = 0, advSide = -1;
  for (let ply = 0; ply < 300; ply++) {
    const side = pos.side, u = (side === 0 ? white : black).move(moves.slice()), m = u && pos.moveFromUci(u);
    if (!m) return side === 0 ? 0 : 1;
    pos.makeMove(m); moves.push(u);
    const k = pos.hashKey(); seen[k] = (seen[k] || 0) + 1;
    if (!pos.hasLegalMove()) return pos.inCheck() ? (pos.side === 0 ? 0 : 1) : 0.5;
    if (seen[k] >= 3 || pos.halfmove >= 100 || pos.insufficientMaterial()) return 0.5;
    const mt = material(pos), diff = mt[0] - mt[1];
    if (Math.abs(diff) >= 8) { const s = diff > 0 ? 0 : 1; if (s === advSide) adv++; else { advSide = s; adv = 1; } if (adv >= 10) return s === 0 ? 1 : 0; } else adv = 0;
  }
  return 0.5;
}
const elo = (p) => Math.round(-400 * Math.log10(1 / Math.min(0.99, Math.max(0.01, p)) - 1));
for (const item of JSON.parse(process.argv[2])) {
  const a = player(item.a), b = player(item.b), t0 = Date.now();
  let w = 0, d = 0, l = 0;
  for (let g = 0; g < item.games; g++) {
    const op = OPENINGS[Math.floor(g / 2) % OPENINGS.length], aWhite = g % 2 === 0;
    a.newgame(); b.newgame();
    const r = aWhite ? playGame(a, b, op) : 1 - playGame(b, a, op);
    if (r === 1) w++; else if (r === 0) l++; else d++;
  }
  const n = item.games, p = (w + d / 2) / n, se = Math.sqrt(Math.max(p * (1 - p), 0.01) / n);
  console.log(`${a.name} vs ${b.name}: +${w} =${d} -${l} of ${n}, ${(p * 100).toFixed(1)}%, ${elo(p) >= 0 ? '+' : ''}${elo(p)} Elo (from ${elo(p - se)} to ${elo(p + se)}), Joker Moves ${a.jokers}/${b.jokers}, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
