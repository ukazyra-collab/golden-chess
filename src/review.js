/* Golden Chess — game review. From the engine's verdict on every position of a game (best move, its score, the start
 * of the best line, and for a golden best move also the best normal move) to: a class for every move (chess.com's
 * scale: brilliant, great, best, excellent, good, inaccuracy, mistake, miss, blunder, plus missed golden move), accuracy
 * and a rough game rating per side, accuracy by phase, the golden moves each side missed, and the coach's reason for a
 * move. Pure functions: the UI turns the keys into words. Shared by the page and the tests (Node).
 */
var GCReview = (function (GC) {
  'use strict';
  var F_CAPTURE = GC.F_CAPTURE, F_GOLDEN = GC.F_GOLDEN;
  var VAL = [0, 1, 3, 3, 5, 9, 0];

  // winning chances (0..100) for the side to move from a score in centipawns (lichess's curve)
  function winPct(cp) { cp = Math.max(-1500, Math.min(1500, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function cpOf(e) {
    if (e.mate) return e.mate > 0 ? 10000 - e.mate * 10 : -10000 - e.mate * 10;
    return Math.max(-10000, Math.min(10000, e.score));
  }
  // accuracy of one move from the winning chances it gave away (lichess)
  function moveAccuracy(drop) { return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669)); }
  // a side's accuracy: average of the mean and the harmonic mean (lichess)
  function sideAccuracy(xs) {
    if (!xs.length) return null;
    var mean = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length;
    var harm = xs.length / xs.reduce(function (s, v) { return s + 1 / Math.max(5, v); }, 0);
    return (mean + harm) / 2;
  }
  // accuracy -> rough rating. Calibrated on bot-vs-bot games reviewed exactly like player games (test/acc_calib.js):
  // mean accuracy 69.3 at ~600 Elo, 80.8 at ~1050, 83.6 at 1350, 86.0 at 1600, 93.2 at 1900, 96.9 at 2250, 98.3 at 2500
  var ELO_CURVE = [[40, 150], [55, 350], [69, 600], [80.8, 1050], [83.6, 1350], [86, 1600], [93.2, 1900], [96.9, 2250], [98.3, 2500], [99.5, 2750]];
  function estimateElo(acc) {
    var c = ELO_CURVE;
    if (acc <= c[0][0]) return c[0][1];
    for (var i = 1; i < c.length; i++) if (acc <= c[i][0]) { var a = c[i - 1], b = c[i]; return Math.round((a[1] + (b[1] - a[1]) * (acc - a[0]) / (b[0] - a[0])) / 10) * 10; }
    return c[c.length - 1][1];
  }

  // winning chances a move may give away for each class (chess.com's expected points, in %)
  var EXCELLENT = 2, GOOD = 5, INACCURACY = 10, MISTAKE = 20;
  var CLASSES = ['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder', 'goldmiss'];

  function material(pos, color) {
    var b = pos.board, s = 0;
    for (var sq = 0; sq < 120; sq++) { if (sq & 0x88) { sq += 7; continue; } var p = b[sq]; if (p && (p >> 3) === color) s += VAL[p & 7]; }
    return s;
  }
  function pieceMaterial(pos) {
    var b = pos.board, s = 0;
    for (var sq = 0; sq < 120; sq++) { if (sq & 0x88) { sq += 7; continue; } var t = b[sq] & 7; if (t >= 2 && t <= 5) s += VAL[t]; }
    return s;
  }
  // opening: the first ten moves while most pieces are on; endgame: few pieces left (both sides together)
  function phaseOf(pos, ply) {
    var m = pieceMaterial(pos);
    if (m <= 26) return 'endgame';
    return ply < 20 && m >= 46 ? 'opening' : 'middlegame';
  }
  // the cheapest piece of `by` attacking `sq` (its value), 0 if none
  function minAttacker(pos, sq, by) {
    var b = pos.board, o = by << 3, t, i, d, p, best = 0;
    function note(v) { if (!best || v < best) best = v; }
    var pd = by === 0 ? [-15, -17] : [15, 17];
    for (i = 0; i < 2; i++) { t = sq + pd[i]; if (!(t & 0x88) && b[t] === (o | 1)) return 1; }
    for (i = 0; i < 8; i++) { t = sq + GC.KNIGHT_D[i]; if (!(t & 0x88) && b[t] === (o | 2)) note(3); }
    for (i = 0; i < 4; i++) {
      d = GC.DIAG_D[i]; t = sq + d;
      while (!(t & 0x88)) { p = b[t]; if (p) { if (p === (o | 3)) note(3); else if (p === (o | 5)) note(9); break; } t += d; }
    }
    for (i = 0; i < 4; i++) {
      d = GC.ORTHO_D[i]; t = sq + d;
      while (!(t & 0x88)) { p = b[t]; if (p) { if (p === (o | 4)) note(5); else if (p === (o | 5)) note(9); break; } t += d; }
    }
    for (i = 0; i < 8; i++) { t = sq + GC.KING_D[i]; if (!(t & 0x88) && b[t] === (o | 6)) note(100); }
    return best;
  }
  // a piece of `color` on `sq` that the opponent can take for less, or for free
  function hangs(pos, sq, color) {
    var p = pos.board[sq], t = p & 7;
    if (t < 2 || t > 5 || (p >> 3) !== color) return false;
    var a = minAttacker(pos, sq, color ^ 1);
    if (!a) return false;
    return a < VAL[t] || !minAttacker(pos, sq, color);
  }
  // material balance for `color` after up to `plies` moves of a line, compared with before it
  function lineSwing(fen, ucis, color, plies) {
    var pos = new GC.Position(fen), before = material(pos, color) - material(pos, color ^ 1);
    for (var i = 0, n = 0; i < ucis.length && n < plies; i++, n++) {
      var m = pos.moveFromUci(ucis[i]);
      if (!m) break;
      pos.makeMove(m);
    }
    return material(pos, color) - material(pos, color ^ 1) - before;
  }
  function sanOf(fen, uci) {
    if (!uci) return '';
    var pos = new GC.Position(fen), m = pos.moveFromUci(uci);
    return m ? pos.san(m, pos.legalMoves(true)) : '';
  }
  function pieceName(t) { return ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][t] || ''; }

  // input: { fens: [fen before ply 0 .. after the last ply], records: [{ uci, san, golden, color }],
  //          scores: [{ score, mate, uci, pv, alt }] for each fen (side to move's view; missing ones are skipped) }
  function analyze(input) {
    var fens = input.fens, recs = input.records, sc = input.scores, moves = [], i;
    var acc = [[], []], counts = [{}, {}], phases = [{}, {}], missed = [], golden = [null, null];
    for (i = 0; i < recs.length; i++) {
      var e = sc[i], e2 = sc[i + 1];
      if (!e || !e2 || !fens[i] || !fens[i + 1]) continue;
      var rec = recs[i], c = rec.color, played = rec.uci;
      var before = winPct(cpOf(e)), after = winPct(-cpOf(e2)), drop = Math.max(0, before - after);
      var pos = new GC.Position(fens[i]), m = pos.moveFromUci(played), posAfter = new GC.Position(fens[i + 1]);
      var prev = i > 0 ? moves[i - 1] : null, oppErred = prev && prev.drop >= INACCURACY;
      var isBest = played === e.uci;
      var to = m ? (m >> 7) & 127 : -1, moved = m ? pos.board[m & 127] & 7 : 0, took = m && (m & F_CAPTURE) ? VAL[pos.board[to] & 7] || 1 : 0;
      var cls;
      if (isBest || drop < EXCELLENT) {
        if (m && moved >= 2 && moved <= 5 && hangs(posAfter, to, c) && VAL[moved] - took >= 2 && after >= 45 && before < 92) cls = 'brilliant'; // a sound sacrifice
        // great: the golden move that was clearly the best, or a quiet move that punishes a blunder (taking what hangs is just best)
        else if (isBest && rec.golden && e.alt && before - winPct(cpOf(e.alt)) >= INACCURACY) cls = 'great';
        else if (isBest && prev && prev.drop >= MISTAKE && !took && after >= 65) cls = 'great';
        else cls = isBest ? 'best' : 'excellent';
      } else if (drop < GOOD) cls = 'good';
      else if (drop < INACCURACY) cls = 'inaccuracy';
      else if (drop >= MISTAKE && after < 50) cls = 'blunder'; // from fine (or winning) to losing
      else if (before >= 60 && (oppErred || drop >= MISTAKE)) cls = 'miss'; // a winning chance let go
      else cls = 'mistake';
      // the best move was golden, worth clearly more than any normal move, and it wasn't played
      var gm = null;
      if (e.alt && !rec.golden) {
        var normal = winPct(cpOf(e.alt)), gain = before - normal;
        if (gain >= INACCURACY && drop >= INACCURACY) {
          gm = { ply: i, color: c, uci: e.uci, san: sanOf(fens[i], e.uci), before: before, normal: normal, after: after, gain: gain };
          missed.push(gm);
          if (after >= normal - 3) cls = 'goldmiss'; // the rest of the move was fine: only the golden move was missing
        }
      }
      var a = moveAccuracy(drop), ph = phaseOf(pos, i);
      acc[c].push(a);
      counts[c][cls] = (counts[c][cls] || 0) + 1;
      (phases[c][ph] = phases[c][ph] || []).push(a);
      if (rec.golden) golden[c] = { ply: i, cls: cls, san: rec.san };
      moves[i] = { ply: i, color: c, cls: cls, drop: drop, acc: a, before: before, after: after, best: e.uci, bestSan: isBest ? rec.san : sanOf(fens[i], e.uci),
        golden: !!rec.golden, phase: ph, missedGolden: gm, reason: isBest && cls !== 'brilliant' ? null : reason(i, cls) };
    }
    // the coach's reason for a move, worst news first
    function reason(k, cls) {
      var e = sc[k], e2 = sc[k + 1], rec = recs[k], c = rec.color;
      if (cls === 'brilliant') return { key: 'sacrifice' };
      if (e.mate > 0 && !(e2.mate < 0)) return { key: 'missedMate', n: e.mate };
      if (e2.mate > 0) return { key: 'allowsMate', n: e2.mate };
      if (cls === 'excellent' || cls === 'good' || cls === 'goldmiss') return null;
      var pb = new GC.Position(fens[k]), pa = new GC.Position(fens[k + 1]), m = pb.moveFromUci(rec.uci), to = m ? (m >> 7) & 127 : -1;
      var took = m && (m & F_CAPTURE) ? VAL[pb.board[to] & 7] || 1 : 0;
      if (to >= 0 && hangs(pa, to, c) && VAL[pa.board[to] & 7] - took >= 2) return { key: 'hangs', piece: pieceName(pa.board[to] & 7) };
      var bestSwing = lineSwing(fens[k], e.pv && e.pv.length ? e.pv : [e.uci], c, 3);
      var playedSwing = lineSwing(fens[k], [rec.uci].concat(e2.pv || []), c, 3);
      if (playedSwing <= -2) return { key: 'loses', n: -playedSwing };
      if (bestSwing - playedSwing >= 2 && bestSwing >= 1) {
        var bp = new GC.Position(fens[k]), bm = bp.moveFromUci(e.uci);
        if (bm && (bm & F_CAPTURE)) return { key: 'missedTake', piece: pieceName(bp.board[(bm >> 7) & 127] & 7 || 1) };
        return { key: 'missedMaterial', n: bestSwing };
      }
      return null;
    }
    var sum = [0, 1].map(function (c) {
      var a = sideAccuracy(acc[c]);
      if (a == null) return null;
      var ph = {};
      ['opening', 'middlegame', 'endgame'].forEach(function (k) {
        var xs = phases[c][k];
        if (!xs || !xs.length) { ph[k] = null; return; }
        var v = xs.reduce(function (s, x) { return s + x; }, 0) / xs.length;
        ph[k] = { acc: v, n: xs.length, mark: v >= 85 ? 'great' : v >= 70 ? 'good' : v >= 55 ? 'inaccuracy' : 'mistake' };
      });
      return { accuracy: a, n: acc[c].length, counts: counts[c], elo: acc[c].length >= 8 ? estimateElo(a) : null, phases: ph, golden: golden[c],
        missed: missed.filter(function (x) { return x.color === c; }) };
    });
    return { moves: moves, sum: sum, missed: missed };
  }

  return { analyze: analyze, winPct: winPct, cpOf: cpOf, moveAccuracy: moveAccuracy, sideAccuracy: sideAccuracy, estimateElo: estimateElo,
    hangs: hangs, minAttacker: minAttacker, lineSwing: lineSwing, phaseOf: phaseOf, CLASSES: CLASSES };
})(GC);
if (typeof module !== 'undefined' && module.exports) module.exports = GCReview;
