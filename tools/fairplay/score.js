// Fair play score (prototype, read-only): from the per-game numbers of scan.js to one line per player, the way the
// nightly check would fill fair_scores (supabase/pending/20261111000000_fair_play.sql).
//
// The idea is the one statistical fair play work rests on (Regan's screening; chess.com's and lichess's checks are
// built on the same ground): people of a given strength pick the engine's first choice at a fairly steady rate. Over
// enough moves a player whose rate sits far above that is either much stronger than their rating, or getting help.
//   expected T1  what people of that rating play, from our own games (scan of Nov 2026: 36.5% on average, depth 8)
//   z            (T1 - expected) / sd, the sd of a mean over that many moves plus the spread between people
//   verdict      'review' (a person looks at the games), 'watch' (checked again after more games), 'ok'
// The Joker adds a signal ordinary chess doesn't have: public engines can't see Joker Moves, so help from one shows as
// winning Joker Moves passed over for the best ordinary move (joker_blind), again and again.
// A number is never a verdict on its own: the owner decides after looking at the games (fair_set).
//
// Run: node tools/fairplay/score.js <scan.json> [out.json]
const fs = require('fs');
const [, , IN, OUT] = process.argv;
const scan = JSON.parse(fs.readFileSync(IN, 'utf8'));

const BASE = 0.365, BASE_AT = 1550, PER_400 = 0.05; // expected T1 at 1550, and how it grows with rating (per 400 points)
const SPREAD = 0.05;                                 // the spread of T1 between people of one rating
const MIN_MOVES = 60;                                // fewer moves than this say nothing either way
const expected = (r) => Math.max(0.25, Math.min(0.6, BASE + (PER_400 * ((r || 1500) - BASE_AT)) / 400));

function verdictOf(s) {
  if (s.moves < MIN_MOVES) return 'ok';
  const joker = s.joker_chances >= 3 && s.joker_found === 0 && s.joker_blind >= 3;
  if ((s.z >= 4 && s.moves >= 100) || (joker && s.z >= 2)) return 'review';
  if (s.z >= 2.5 || joker) return 'watch';
  return 'ok';
}

const players = new Map();
for (const g of scan.games) {
  for (const side of ['w', 'b']) {
    const p = g[side];
    if (!p || p.house) continue; // a house player's moves come from our own engine: nothing to check
    const e = players.get(p.id) || { user: p.id, name: p.name, rating: 0, games: 0, moves: 0, t1: 0, loss: 0, big: 0, jc: 0, jf: 0, jb: 0, perGame: [] };
    e.games++; e.moves += p.n; e.t1 += p.t1; e.loss += p.loss; e.big += p.big;
    e.jc += p.jokerChances; e.jf += p.jokerFound; e.jb += p.jokerBlind;
    e.rating = p.rating || e.rating;
    if (p.n) e.perGame.push(p.t1 / p.n);
    players.set(p.id, e);
  }
}

const rows = [...players.values()].map((e) => {
  const t1 = e.moves ? e.t1 / e.moves : 0, p0 = expected(e.rating);
  const sd = Math.sqrt((p0 * (1 - p0)) / Math.max(1, e.moves) + SPREAD * SPREAD);
  const s = { user_id: e.user, name: e.name, rating: e.rating, games: e.games, moves: e.moves, t1: +t1.toFixed(3), expected: +p0.toFixed(3),
    acpl: e.moves ? +(e.loss / e.moves).toFixed(1) : 0, big: e.big, joker_chances: e.jc, joker_found: e.jf, joker_blind: e.jb,
    z: +((t1 - p0) / sd).toFixed(2), best_game_t1: e.perGame.length ? +Math.max(...e.perGame).toFixed(2) : 0 };
  s.verdict = verdictOf(s);
  return s;
}).sort((a, b) => b.z - a.z);

// what people do: the per-game spread, the baseline the expected T1 comes from
const per = scan.games.flatMap((g) => ['w', 'b'].map((c) => g[c]).filter((p) => p && !p.house && p.n >= 10).map((p) => p.t1 / p.n));
const mean = per.reduce((a, b) => a + b, 0) / (per.length || 1);
const sdGame = Math.sqrt(per.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, per.length - 1));

const out = { at: new Date().toISOString(), depth: scan.depth, games: scan.games.length, baseline: { games: per.length, mean: +mean.toFixed(3), sd: +sdGame.toFixed(3) },
  thresholds: { min_moves: MIN_MOVES, watch_z: 2.5, review_z: 4, joker_blind: 3 }, players: rows };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`baseline: ${per.length} games by people, T1 ${(mean * 100).toFixed(1)}% (sd ${(sdGame * 100).toFixed(1)}% per game)`);
for (const r of rows) {
  console.log([r.verdict.padEnd(6), String(r.games).padStart(3) + ' g', String(r.moves).padStart(4) + ' mv', 'T1 ' + (r.t1 * 100).toFixed(0) + '% (exp ' + (r.expected * 100).toFixed(0) + '%)',
    'acpl ' + r.acpl, 'z ' + r.z, 'joker ' + r.joker_found + '/' + r.joker_chances + ' blind ' + r.joker_blind].join('  '));
}
