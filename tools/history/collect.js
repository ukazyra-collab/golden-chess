// Looks every target game up in the PGN collection, checks its moves by the rules and writes tools/history/games.json
// (the record in the engine's own move notation). A target that isn't found, or matches several games, is listed.
// Run: HIST_SRC=<the collection's player folder> node tools/history/collect.js
const fs = require('fs'), path = require('path');
const L = require('./lib.js');
const SRC = process.env.HIST_SRC || '/home/claude/ext/wch/Imense_Database_For _ChessEnigine/Extracted_All_Top_Players';
const targets = require('./targets.js');
const cache = {};
const load = (f) => cache[f] || (cache[f] = L.readPgn(path.join(SRC, f + '.pgn')));
const has = (name, key) => String(name || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').indexOf(key) >= 0;
const out = [], problems = [];
for (const t of targets) {
  let games;
  try { games = load(t.file); } catch (e) { problems.push(t.id + ': no file ' + t.file); continue; }
  let m = games.filter((g) => has(g.headers.White, t.w) && has(g.headers.Black, t.b) && L.year(g.headers) === t.y);
  const all = m.length;
  const res = [];
  for (const g of m) { try { const r = L.resolve(L.sanTokens(g.text)); res.push({ g, r }); } catch (e) { /* a broken record: skipped */ } }
  let pick = res;
  if (t.pick) {
    if (t.pick.round) pick = pick.filter((x) => String(x.g.headers.Round).split('.')[0] === t.pick.round);
    if (t.pick.result) pick = pick.filter((x) => x.g.headers.Result === t.pick.result);
    if (t.pick.plies) pick = pick.filter((x) => x.r.uci.length >= t.pick.plies[0] && x.r.uci.length <= t.pick.plies[1]);
  }
  if (pick.length !== 1) {
    problems.push(t.id + ': ' + pick.length + ' of ' + all + ' match -> ' + res.map((x) => (x.g.headers.Event || '') + ' r' + x.g.headers.Round + ' ' + x.g.headers.Result + ' ' + x.r.uci.length + 'pl').slice(0, 14).join(' | '));
    if (!pick.length) continue;
  }
  const x = pick[0], h = x.g.headers;
  out.push({ id: t.id, era: t.era, white: h.White.trim(), black: h.Black.trim(), date: h.Date, event: h.Event, site: h.Site, round: h.Round, result: h.Result, eco: h.ECO,
    mate: !x.r.end.hasLegalMove() && x.r.end.inCheck(), plies: x.r.uci.length, moves: x.r.uci.join(' ') });
}
fs.writeFileSync(path.join(__dirname, 'games.json'), JSON.stringify(out, null, 1));
console.log('games:', out.length, 'of', targets.length);
for (const g of out) console.log(' ', g.id.padEnd(34), String(g.plies).padStart(3) + 'pl', g.result.padEnd(7), g.mate ? 'mate' : '    ', g.white, '-', g.black, '|', g.event, g.site, g.date);
if (problems.length) console.log('\nTO LOOK AT:\n' + problems.join('\n'));
