// The scanner's finds (tools/history/scan.js) into puzzles from real games (src/realgames.js, JOKER_REAL): each one
// checked again with more time, its answers' continuations played out, tagged with what kind of moment it is (a way
// out of a lost game, a mate, a turn of the game) and with the game it comes from: who played, where and when, the
// move that was really made and how the game went on. Easy to hard.
// Run: node tools/history/build.js
global.GC = require('../../src/core.js');
const E = require('../../src/engine.js');
const fs = require('fs'), path = require('path');
const games = {}; require('./games.json').forEach((g) => { games[g.id] = g; });
const DIR = path.join(__dirname, 'finds'), OUT = path.join(__dirname, '../../src/realgames.js');
const MATE_BOUND = E.MATE_BOUND, isMate = (s) => Math.abs(s) > MATE_BOUND;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 -';
function think(fen, moves, o) { E.clear(); return E.think(Object.assign({ fen, moves, analysis: true }, o)); }

// the players as the collection writes them -> how we show them: [English, Russian]
const NAMES = { 'McDonnell': ['McDonnell', 'Макдоннелл'], 'De Labourdonnais': ['La Bourdonnais', 'Лабурдонне'], 'Anderssen': ['Anderssen', 'Андерсен'], 'Kieseritzky': ['Kieseritzky', 'Кизерицкий'],
  'Dufresne': ['Dufresne', 'Дюфрень'], 'Paulsen': ['Paulsen', 'Паульсен'], 'Morphy': ['Morphy', 'Морфи'], 'Duke Karl Count Isouard': ['the Duke and the Count', 'герцог и граф'],
  'Zukertort': ['Zukertort', 'Цукерторт'], 'Blackburne': ['Blackburne', 'Блэкберн'], 'Lasker': ['Lasker', 'Ласкер'], 'Bauer': ['Bauer', 'Бауэр'], 'Chigorin': ['Chigorin', 'Чигорин'],
  'Steinitz': ['Steinitz', 'Стейниц'], 'Von Bardeleben': ['von Bardeleben', 'фон Барделебен'], 'Pillsbury': ['Pillsbury', 'Пильсбери'], 'Tarrasch': ['Tarrasch', 'Тарраш'],
  'Rotlewi': ['Rotlewi', 'Ротлеви'], 'Rubinstein': ['Rubinstein', 'Рубинштейн'], 'Levitsky': ['Levitsky', 'Левицкий'], 'Marshall': ['Marshall', 'Маршалл'], 'Capablanca': ['Capablanca', 'Капабланка'],
  'Bogoljubow': ['Bogoljubov', 'Боголюбов'], 'Alekhine': ['Alekhine', 'Алехин'], 'Saemisch': ['Sämisch', 'Земиш'], 'Nimzowitsch': ['Nimzowitsch', 'Нимцович'], 'Reti': ['Réti', 'Рети'],
  'Euwe': ['Euwe', 'Эйве'], 'Botvinnik': ['Botvinnik', 'Ботвинник'], 'Byrne': ['Byrne', 'Бирн'], 'Fischer': ['Fischer', 'Фишер'], 'Polugaevsky': ['Polugaevsky', 'Полугаевский'],
  'Nezhmetdinov': ['Nezhmetdinov', 'Нежметдинов'], 'Tal': ['Tal', 'Таль'], 'Smyslov': ['Smyslov', 'Смыслов'], 'Spassky': ['Spassky', 'Спасский'], 'Bronstein': ['Bronstein', 'Бронштейн'],
  'Larsen': ['Larsen', 'Ларсен'], 'Petrosian': ['Petrosian', 'Петросян'], 'Kortschnoj': ['Korchnoi', 'Корчной'], 'Karpov': ['Karpov', 'Карпов'], 'Kasparov': ['Kasparov', 'Каспаров'],
  'Short': ['Short', 'Шорт'], 'Timman': ['Timman', 'Тимман'], 'Ivanchuk': ['Ivanchuk', 'Иванчук'], 'Jussupow': ['Yusupov', 'Юсупов'], 'Anand': ['Anand', 'Ананд'],
  'Comp Deep Blue': ['Deep Blue', 'Deep Blue'], 'Topalov': ['Topalov', 'Топалов'], 'Kramnik': ['Kramnik', 'Крамник'], 'DEEP FRITZ': ['Deep Fritz', 'Deep Fritz'], 'Aronian': ['Aronian', 'Аронян'],
  'Carlsen': ['Carlsen', 'Карлсен'], 'Wei Yi': ['Wei Yi', 'Вэй И'], 'Bruzon Batista': ['Bruzón', 'Брусон'], 'Karjakin': ['Karjakin', 'Карякин'], 'Nepomniachtchi': ['Nepomniachtchi', 'Непомнящий'] };
const SITES = { 'London': ['London', 'Лондон'], 'Berlin': ['Berlin', 'Берлин'], 'New York': ['New York', 'Нью-Йорк'], 'Paris': ['Paris', 'Париж'], 'Amsterdam': ['Amsterdam', 'Амстердам'],
  'Havana': ['Havana', 'Гавана'], 'Hastings': ['Hastings', 'Гастингс'], 'St Petersburg': ['St Petersburg', 'Санкт-Петербург'], 'Lodz': ['Łódź', 'Лодзь'], 'Breslau': ['Breslau', 'Бреслау'],
  'Copenhagen': ['Copenhagen', 'Копенгаген'], 'Baden-Baden': ['Baden-Baden', 'Баден-Баден'], 'Sochi': ['Sochi', 'Сочи'], 'Moscow': ['Moscow', 'Москва'], 'Leningrad': ['Leningrad', 'Ленинград'],
  'Belgrade': ['Belgrade', 'Белград'], 'Buenos Aires': ['Buenos Aires', 'Буэнос-Айрес'], 'Reykjavik': ['Reykjavik', 'Рейкьявик'], 'Sevilla': ['Seville', 'Севилья'], 'Tilburg': ['Tilburg', 'Тилбург'],
  'Brussels': ['Brussels', 'Брюссель'], 'Wijk aan Zee': ['Wijk aan Zee', 'Вейк-ан-Зее'], 'Elista': ['Elista', 'Элиста'], 'Danzhou': ['Danzhou', 'Даньчжоу'], 'Philadelphia': ['Philadelphia', 'Филадельфия'] };
const who = (raw) => { const k = String(raw).split(',')[0].trim(); if (!NAMES[k]) throw new Error('no name for ' + raw); return NAMES[k]; };
const where = (raw) => { const k = String(raw || '').replace(/\s+[A-Z]{3}$/, '').trim(); return SITES[k] || null; };

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
  if (line.length % 2 === 1) line.pop();
  return line;
}

const out = [], seen = new Set();
for (const f of fs.readdirSync(DIR).sort()) {
  const finds = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  // the losing side's chances first (they change how the game ended), two a game at most
  finds.sort((a, b) => (b.loser ? 1 : 0) - (a.loser ? 1 : 0) || Object.keys(a.accept).length - Object.keys(b.accept).length);
  let taken = 0;
  for (const v of finds) {
    if (taken >= 2) break;
    const g = games[v.id], key = v.fen.split(' ').slice(0, 4).join(' ');
    if (!g || seen.has(key) || Object.keys(v.accept).length > 3) continue;
    const best = think(v.fen, [], { timeMs: 4000, maxDepth: 20 });
    const normal = think(v.fen, [], { timeMs: 2500, maxDepth: 20, noGoldenRoot: true });
    if (!best.uci || !(best.uci in v.accept)) { console.log('dropped (best changed)', v.id, v.ply, best.uci); continue; }
    if (!(isMate(best.score) && best.score > 0) && (best.score < 280 || best.score - normal.score < 280)) { console.log('dropped (gain)', v.id, v.ply); continue; }
    seen.add(key); taken++;
    const accept = {};
    for (const u of Object.keys(v.accept)) accept[u] = continuation(v.fen, u, u === best.uci ? best.mate : 0);
    const c0 = accept[best.uci];
    const quiet = c0.length >= 2 && !(() => { const q = new GC.Position(v.fen); q.makeMove(q.moveFromUci(best.uci)); q.makeMove(q.moveFromUci(c0[0])); return q.moveFromUci(c0[1]) & GC.F_CAPTURE; })();
    const mate = best.mate > 0 ? best.mate : 0;
    const diff = (v.found || 3) * 2 + (mate ? Math.min(mate, 5) : 3) + (quiet ? 3 : 0) - (Object.keys(accept).length - 1) * 2;
    // the move that was really played here, in the game's own notation, and how long the game went on
    const moves = g.moves.split(' '), p = new GC.Position(START);
    for (let i = 0; i < v.ply; i++) p.makeMove(p.moveFromUci(moves[i]));
    const rm = moves[v.ply] ? p.moveFromUci(moves[v.ply]) : 0;
    const real = rm ? (Math.floor(v.ply / 2) + 1) + (v.side === 'w' ? '.' : '...') + p.san(rm) : null;
    const W = who(g.white), B = who(g.black), S = where(g.site);
    out.push({ fen: v.fen, accept, mate: mate || undefined, diff,
      k: v.plain <= -250 ? 'save' : mate && mate <= 3 ? 'mate' : undefined,
      g: { w: W[0], b: B[0], wr: W[1], br: B[1], y: +String(g.date).slice(0, 4), at: S ? S[0] : undefined, atr: S ? S[1] : undefined,
        real: real || undefined, left: Math.ceil((moves.length - v.ply) / 2), res: g.result, lost: v.loser || undefined, mated: (g.mate && v.loser) || undefined } });
    console.log('ok', out.length, v.id, 'ply', v.ply, best.uci, mate ? 'M' + mate : best.score, 'plain', v.plain, 'diff', diff, real);
  }
}
out.sort((a, b) => a.diff - b.diff);
out.forEach((p, i) => { p.id = 'r' + (i + 1); p.lvl = i < out.length * 0.35 ? 1 : i < out.length * 0.75 ? 2 : 3; });
const body = out.map((p) => '  ' + JSON.stringify({ id: p.id, lvl: p.lvl, fen: p.fen, accept: p.accept, mate: p.mate, k: p.k, diff: p.diff, g: p.g })).join(',\n');
fs.writeFileSync(OUT, '/* Joker Move puzzles from real games (tools/history: scan.js finds the moments, build.js checks and sorts them):\n' +
  ' * one side gets a Joker Move the players never had. g: who played (w, b; wr, br in Russian), the year, the place,\n' +
  ' * the move really played there (real), how many moves the game went on (left), its result, whether the side to\n' +
  ' * move lost it (lost, mated). k: save (the game was lost without the Joker Move), mate (a short mate follows). */\nvar JOKER_REAL = [\n' + body + '\n];\n');
console.log('wrote', out.length, 'puzzles from', Object.keys(games).length, 'games');
