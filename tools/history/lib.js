// Real games for the "Rewrite history" campaign: reading PGN files and turning their moves into the engine's own
// (every move checked by the rules: a game with a move the board doesn't allow is refused, not guessed).
global.GC = global.GC || require('../../src/core.js');
const fs = require('fs');

// one PGN file -> [{ headers: {White, Black, Date, ...}, text }]
function readPgn(file) {
  const raw = fs.readFileSync(file, 'latin1').replace(/\r/g, '');
  const games = [];
  let headers = null, text = [];
  const flush = () => { if (headers && text.join(' ').trim()) games.push({ headers, text: text.join(' ') }); headers = null; text = []; };
  for (const line of raw.split('\n')) {
    const h = /^\[(\w+)\s+"(.*)"\]\s*$/.exec(line);
    if (h) { if (text.length) flush(); headers = headers || {}; headers[h[1]] = h[2]; continue; }
    if (line.trim()) { if (!headers) headers = {}; text.push(line.trim()); }
  }
  flush();
  return games;
}

// the SAN tokens of a game's movetext (comments, variations, move numbers, marks and the result dropped)
function sanTokens(text) {
  let s = text.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  for (let k = 0; k < 6 && /\([^()]*\)/.test(s); k++) s = s.replace(/\([^()]*\)/g, ' ');
  return s.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).map((t) => t.replace(/[!?]+$/g, ''));
}
const norm = (s) => s.replace(/[+#]/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O').replace(/=/g, '');

// SAN list -> { uci: [...], fens: [...] } from the ordinary starting position (no Joker Moves in real games);
// throws on a move the rules don't allow
function resolve(tokens, startFen) {
  const p = new GC.Position(startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 -');
  const uci = [];
  tokens.forEach((t, i) => {
    const legal = p.legalMoves(false), want = norm(t);
    const m = legal.find((x) => norm(p.san(x, legal)) === want);
    if (!m) throw new Error('move ' + (i + 1) + ' (' + t + ') is not legal in ' + p.fen());
    uci.push(GC.moveToUci(m)); p.makeMove(m);
  });
  return { uci, end: p };
}
const surname = (n) => String(n || '').split(',')[0].trim().toLowerCase();
const year = (h) => +(String(h.Date || '').slice(0, 4)) || 0;
module.exports = { readPgn, sanTokens, resolve, surname, year, norm };
