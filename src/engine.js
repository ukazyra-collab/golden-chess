/* Golden Chess — search engine. Runs in a Web Worker (or synchronously as a fallback).
 * PVS alpha-beta + iterative deepening, TT, quiescence, null move, LMR, killers/history.
 * Golden moves: searched at the root (pruned by score after depth 1), as evasions when in
 * check (block a slider), and as top-K heuristic candidates at interior nodes with depth >= 2.
 */
var Engine = (function (GC) {
  'use strict';
  var WHITE = 0, BLACK = 1, PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var F_CAPTURE = GC.F_CAPTURE, F_GOLDEN = GC.F_GOLDEN, F_EP = GC.F_EP;
  var PST_MG = GC.PST_MG, PST_EG = GC.PST_EG;
  var KNIGHT_D = GC.KNIGHT_D, KING_D = GC.KING_D, DIAG_D = GC.DIAG_D, ORTHO_D = GC.ORTHO_D;

  var INF = 32000, MATE = 30000, MATE_BOUND = 29000, MAX_PLY = 100;
  var VAL = [0, 100, 320, 330, 500, 950, 0];
  var GOLD_MG = 45, GOLD_EG = 80, TEMPO = 10, GOLD_ROOT_MARGIN = 30;
  var PASSED_MG = [0, 5, 10, 15, 30, 50, 80, 0], PASSED_EG = [0, 10, 18, 32, 55, 95, 150, 0];

  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };

  // ---- transposition table ----
  var TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var ttKey = null, ttMove = null, ttScore = null, ttDepth = null, ttFlag = null;
  function ensureTT() {
    if (ttKey) return;
    ttKey = new Int32Array(TT_SIZE); ttMove = new Int32Array(TT_SIZE); ttScore = new Int16Array(TT_SIZE);
    ttDepth = new Int8Array(TT_SIZE); ttFlag = new Int8Array(TT_SIZE);
  }
  var EXACT = 1, LOWER = 2, UPPER = 3;

  var pos = null;
  var moveBufs = [], scoreBufs = [];
  function ensureBufs() { if (!moveBufs.length) for (var i = 0; i < MAX_PLY + 4; i++) { moveBufs.push(new Int32Array(1536)); scoreBufs.push(new Int32Array(1536)); } }
  var killers = new Int32Array((MAX_PLY + 4) * 2);
  var history = new Int32Array(2 * 128 * 128);
  var repLo = new Int32Array(4096), repHi = new Int32Array(4096), repN = 0;
  var nodes = 0, stopped = false, deadline = 0, nodeLimit = 0;
  var noiseAmp = 0;
  var candTmpM = new Int32Array(1024), candTmpS = new Int32Array(1024);
  var emptiesTmp = new Int16Array(64);

  function clearTT() { if (ttKey) { ttKey.fill(0); ttMove.fill(0); ttDepth.fill(0); ttFlag.fill(0); } history.fill(0); }

  function pushRep() { repLo[repN] = pos.hashLo; repHi[repN] = pos.hashHi; repN++; }
  function isRepetition() {
    var lo = pos.hashLo, hi = pos.hashHi, lim = repN - 1 - pos.halfmove;
    if (lim < 0) lim = 0;
    for (var i = repN - 3; i >= lim; i -= 2) if (repLo[i] === lo && repHi[i] === hi) return true;
    return false;
  }

  // ---- evaluation (side to move perspective) ----
  var wCnt = new Int8Array(8), bCnt = new Int8Array(8), wMinR = new Int8Array(8), bMaxR = new Int8Array(8);
  function evaluate() {
    var b = pos.board, ph = pos.phase > 24 ? 24 : pos.phase;
    var mg = pos.mg[0] - pos.mg[1], eg = pos.eg[0] - pos.eg[1];
    var g = pos.golden, gd = (g & 1) - ((g >> 1) & 1);
    mg += gd * GOLD_MG; eg += gd * GOLD_EG;
    var wb = 0, bb = 0, f, r, sq, p, wMin = wMinR, bMax = bMaxR, wPc = 0, bPc = 0, wPw = 0, bPw = 0;
    // pass 1: pawn files (lowest white pawn / highest black pawn per file), bishops
    for (f = 0; f < 8; f++) { wCnt[f] = 0; bCnt[f] = 0; wMin[f] = 8; bMax[f] = -1; }
    for (sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = b[sq];
      if (!p) continue;
      if (p === 1) { f = sq & 7; r = sq >> 4; wCnt[f]++; wPw++; if (r < wMin[f]) wMin[f] = r; }
      else if (p === 9) { f = sq & 7; r = sq >> 4; bCnt[f]++; bPw++; if (r > bMax[f]) bMax[f] = r; }
      else if (p !== 6 && p !== 14) {
        if (p < 8) wPc++; else bPc++;
        if (p === 3) wb++; else if (p === 11) bb++;
      }
    }
    // mop-up: drive a bare king to the edge and bring our king closer
    if (!bPc && !bPw && wPc) eg += mopUp(pos.kings[1], pos.kings[0]);
    else if (!wPc && !wPw && bPc) eg -= mopUp(pos.kings[0], pos.kings[1]);
    if (wb >= 2) { mg += 30; eg += 50; }
    if (bb >= 2) { mg -= 30; eg -= 50; }
    // pass 2: passed pawns, doubled pawns, rooks on (semi)open files
    for (sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = b[sq];
      if (p === 1) {
        f = sq & 7; r = sq >> 4;
        if ((f === 0 || bMax[f - 1] <= r) && bMax[f] <= r && (f === 7 || bMax[f + 1] <= r)) { mg += PASSED_MG[r]; eg += PASSED_EG[r]; }
      } else if (p === 9) {
        f = sq & 7; r = sq >> 4;
        if ((f === 0 || wMin[f - 1] >= r) && wMin[f] >= r && (f === 7 || wMin[f + 1] >= r)) { mg -= PASSED_MG[7 - r]; eg -= PASSED_EG[7 - r]; }
      } else if (p === 4) {
        f = sq & 7;
        if (!wCnt[f]) mg += bCnt[f] ? 12 : 25;
      } else if (p === 12) {
        f = sq & 7;
        if (!bCnt[f]) mg -= wCnt[f] ? 12 : 25;
      }
    }
    for (f = 0; f < 8; f++) {
      if (wCnt[f] > 1) { mg -= 10 * (wCnt[f] - 1); eg -= 20 * (wCnt[f] - 1); }
      if (bCnt[f] > 1) { mg += 10 * (bCnt[f] - 1); eg += 20 * (bCnt[f] - 1); }
    }
    var s = ((mg * ph + eg * (24 - ph)) / 24) | 0;
    if (pos.side === BLACK) s = -s;
    s += TEMPO;
    if (noiseAmp) {
      var h = Math.imul(pos.hashLo ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
      s += (((h % 2001) - 1000) * noiseAmp / 1000) | 0;
    }
    return s;
  }

  function mopUp(loser, winner) {
    var lf = loser & 7, lr = loser >> 4;
    var cd = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
    var kd = Math.abs(lf - (winner & 7)) + Math.abs(lr - (winner >> 4));
    return 24 * cd + 10 * (14 - kd);
  }

  function hasNonPawn(side) {
    var b = pos.board, o = side << 3;
    for (var sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = b[sq];
      if (p && (p >> 3) === side && (p & 7) !== PAWN && (p & 7) !== KING) return true;
    }
    return false;
  }

  // ---- move ordering ----
  function scoreMoves(buf, sc, n, ttm, ply) {
    var b = pos.board, k1 = killers[ply * 2], k2 = killers[ply * 2 + 1], side = pos.side;
    for (var i = 0; i < n; i++) {
      var m = buf[i];
      if (m === ttm) { sc[i] = 10000000; continue; }
      if (m & F_CAPTURE) {
        var victim = (m & F_EP) ? PAWN : (b[(m >> 7) & 127] & 7);
        sc[i] = 1000000 + VAL[victim] * 16 - (b[m & 127] & 7);
      } else if ((m >> 14) & 7) sc[i] = 900000 + ((m >> 14) & 7);
      else if (m === k1) sc[i] = 800000;
      else if (m === k2) sc[i] = 790000;
      else sc[i] = history[side * 16384 + (m & 127) * 128 + ((m >> 7) & 127)];
    }
  }
  function pickNext(buf, sc, i, n) {
    var bi = i, bs = sc[i];
    for (var j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
    if (bi !== i) {
      var t = buf[i]; buf[i] = buf[bi]; buf[bi] = t;
      t = sc[i]; sc[i] = sc[bi]; sc[bi] = t;
    }
  }

  // ---- golden move generation for search ----
  function pawnAttackedBy(sq, by) {
    var b = pos.board, t;
    if (by === WHITE) {
      t = sq - 15; if (!(t & 0x88) && b[t] === 1) return true;
      t = sq - 17; if (!(t & 0x88) && b[t] === 1) return true;
    } else {
      t = sq + 15; if (!(t & 0x88) && b[t] === 9) return true;
      t = sq + 17; if (!(t & 0x88) && b[t] === 9) return true;
    }
    return false;
  }
  // Threat maps for golden candidates, built once per node.
  // For each of our piece types (N,B,R,Q -> 0..3) and destination square: summed threat value,
  // number of threatened targets, and whether a piece of that type there would check the enemy king.
  var thrVal = new Int32Array(4 * 128), thrCnt = new Int8Array(4 * 128), thrChk = new Int8Array(4 * 128);
  function markThreat(ti, sq, v, undefended) {
    var own = VAL[ti + 2], k = ti * 128 + sq;
    if (v > own) { thrVal[k] += v - own; thrCnt[k]++; }
    else if (undefended) { thrVal[k] += v >> 1; thrCnt[k]++; }
  }
  function buildThreatMaps(us) {
    var b = pos.board, them = us ^ 1, e, i, d, s;
    thrVal.fill(0); thrCnt.fill(0); thrChk.fill(0);
    for (e = 0; e < 120; e++) {
      if (e & 0x88) { e += 7; continue; }
      var q = b[e];
      if (!q || (q >> 3) !== them || (q & 7) === PAWN) continue;
      var te = q & 7, isKing = te === KING, v = VAL[te], und = !isKing && !pos.attacked(e, them);
      for (i = 0; i < 8; i++) {
        s = e + KNIGHT_D[i];
        if (s & 0x88) continue;
        if (isKing) thrChk[s] = 1; else markThreat(0, s, v, und);
      }
      for (i = 0; i < 8; i++) {
        d = KING_D[i]; s = e + d;
        var diag = i >= 4, tiA = diag ? 1 : 2;
        while (!(s & 0x88)) {
          if (isKing) { thrChk[tiA * 128 + s] = 1; thrChk[3 * 128 + s] = 1; }
          else { markThreat(tiA, s, v, und); markThreat(3, s, v, und); }
          if (b[s]) break;
          s += d;
        }
      }
    }
  }

  // Append up to K golden candidates (best heuristic first) with ordering scores below quiets.
  function addGoldenCandidates(buf, sc, n, K) {
    var us = pos.side, them = us ^ 1, b = pos.board, ne = 0, sq, cn = 0, ph = pos.phase > 24 ? 24 : pos.phase;
    var ek = pos.kings[them], ekf = ek & 7, ekr = ek >> 4;
    buildThreatMaps(us);
    for (sq = 0; sq < 120; sq++) { if (sq & 0x88) { sq += 7; continue; } if (!b[sq]) emptiesTmp[ne++] = sq; }
    for (sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      var t = p & 7;
      if (t === PAWN || t === KING) continue;
      var ti = t - 2, base = ti * 128, own = VAL[t], iF = p * 128 + sq, mgF = PST_MG[iF], egF = PST_EG[iF];
      for (var i = 0; i < ne; i++) {
        var to = emptiesTmp[i], k = base + to;
        if (thrChk[k]) continue;
        var iT = p * 128 + to;
        var h = (((PST_MG[iT] - mgF) * ph + (PST_EG[iT] - egF) * (24 - ph)) / 24) | 0;
        var c = thrCnt[k];
        if (c >= 2) h += 140 + (thrVal[k] >> 2); else if (c === 1) h += thrVal[k] >> 3;
        if (pawnAttackedBy(to, them)) h -= (own * 3) >> 2;
        if (Math.abs((to & 7) - ekf) <= 2 && Math.abs((to >> 4) - ekr) <= 2) h += 25;
        if (cn < K) cn++;
        else if (h <= candTmpS[cn - 1]) continue;
        var j = cn - 1;
        while (j > 0 && candTmpS[j - 1] < h) { candTmpS[j] = candTmpS[j - 1]; candTmpM[j] = candTmpM[j - 1]; j--; }
        candTmpS[j] = h; candTmpM[j] = sq | (to << 7) | F_GOLDEN;
      }
    }
    for (i = 0; i < cn; i++) { buf[n] = candTmpM[i]; sc[n] = -2000000 + candTmpS[i]; n++; }
    return n;
  }

  // In check: golden moves that block a single sliding checker.
  function addGoldenEvasions(buf, sc, n) {
    var us = pos.side, them = us ^ 1, b = pos.board, k = pos.kings[us], checkers = 0, i, s, q, d;
    var ray = emptiesTmp, nr = 0, o = them << 3;
    for (i = 0; i < 8; i++) { s = k + KNIGHT_D[i]; if (!(s & 0x88) && b[s] === (o | KNIGHT)) checkers++; }
    if (us === WHITE) { if ((!((k + 15) & 0x88) && b[k + 15] === 9) || (!((k + 17) & 0x88) && b[k + 17] === 9)) checkers++; }
    else { if ((!((k - 15) & 0x88) && b[k - 15] === 1) || (!((k - 17) & 0x88) && b[k - 17] === 1)) checkers++; }
    if (checkers) return n;
    for (i = 0; i < 8; i++) {
      d = KING_D[i]; s = k + d;
      var diag = (i >= 4), start = nr;
      while (!(s & 0x88)) {
        q = b[s];
        if (q) {
          if ((q >> 3) === them && ((q & 7) === QUEEN || (diag ? (q & 7) === BISHOP : (q & 7) === ROOK))) {
            checkers++;
            if (checkers > 1) return n;
          } else nr = start;
          break;
        }
        ray[nr++] = s; s += d;
      }
      if (s & 0x88) nr = start; // ray ran off the board without meeting a checker
    }
    if (checkers !== 1 || !nr) return n;
    for (s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      var p = b[s];
      if (!p || (p >> 3) !== us || (p & 7) === PAWN || (p & 7) === KING) continue;
      for (i = 0; i < nr; i++) { buf[n] = s | (ray[i] << 7) | F_GOLDEN; sc[n] = 500000; n++; }
    }
    return n;
  }

  function validGolden(m) {
    var b = pos.board, from = m & 127, to = (m >> 7) & 127, p = b[from], t = p & 7;
    return from !== to && !(from & 0x88) && !(to & 0x88) && p && (p >> 3) === pos.side && t >= KNIGHT && t <= QUEEN && !b[to] && ((pos.golden >> pos.side) & 1);
  }

  // ---- TT helpers ----
  function ttStore(depth, score, flag, move, ply) {
    var idx = pos.hashLo & TT_MASK;
    if (score > MATE_BOUND) score += ply; else if (score < -MATE_BOUND) score -= ply;
    ttKey[idx] = pos.hashHi; ttMove[idx] = move; ttScore[idx] = score; ttDepth[idx] = depth; ttFlag[idx] = flag;
  }

  function checkStop() {
    if (stopped) return true;
    if ((nodeLimit && nodes >= nodeLimit) || now() >= deadline) stopped = true;
    return stopped;
  }

  // ---- quiescence ----
  function qsearch(alpha, beta, ply) {
    nodes++;
    if ((nodes & 2047) === 0 && checkStop()) return 0;
    var stand = evaluate();
    if (ply >= MAX_PLY) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    var buf = moveBufs[ply], sc = scoreBufs[ply], b = pos.board;
    var n = pos.genMoves(buf, 0, true);
    for (var i = 0; i < n; i++) {
      var m = buf[i], victim = (m & F_EP) ? PAWN : (b[(m >> 7) & 127] & 7);
      sc[i] = VAL[victim] * 16 - (b[m & 127] & 7) + (((m >> 14) & 7) ? 8000 : 0);
    }
    for (i = 0; i < n; i++) {
      pickNext(buf, sc, i, n);
      m = buf[i];
      if (!((m >> 14) & 7)) {
        victim = (m & F_EP) ? PAWN : (b[(m >> 7) & 127] & 7);
        if (stand + VAL[victim] + 200 < alpha) continue; // delta pruning
      }
      pos.makeMove(m);
      if (!pos.legalAfterMake(m)) { pos.unmakeMove(); continue; }
      var s = -qsearch(-beta, -alpha, ply + 1);
      pos.unmakeMove();
      if (stopped) return 0;
      if (s > alpha) { alpha = s; if (s >= beta) return s; }
    }
    return alpha;
  }

  // ---- main search ----
  function search(alpha, beta, depth, ply, isPV, allowNull) {
    var inCheck = pos.inCheck();
    if (inCheck && ply < MAX_PLY - 8) depth++;
    if (depth <= 0) return qsearch(alpha, beta, ply);
    nodes++;
    if ((nodes & 2047) === 0 && checkStop()) return 0;
    if (ply >= MAX_PLY) return evaluate();
    if (isRepetition() || pos.halfmove >= 100) return 0;
    var mdA = -MATE + ply, mdB = MATE - ply - 1;
    if (alpha < mdA) alpha = mdA;
    if (beta > mdB) beta = mdB;
    if (alpha >= beta) return alpha;

    var idx = pos.hashLo & TT_MASK, ttm = 0;
    if (ttKey[idx] === pos.hashHi) {
      ttm = ttMove[idx];
      if (!isPV && ttDepth[idx] >= depth) {
        var ts = ttScore[idx], tf = ttFlag[idx];
        if (ts > MATE_BOUND) ts -= ply; else if (ts < -MATE_BOUND) ts += ply;
        if (tf === EXACT || (tf === LOWER && ts >= beta) || (tf === UPPER && ts <= alpha)) return ts;
      }
    }
    var us = pos.side;
    var staticEval = inCheck ? -INF : evaluate();
    if (!isPV && !inCheck && depth <= 3 && beta < MATE_BOUND && beta > -MATE_BOUND && staticEval - 110 * depth >= beta) return staticEval;
    if (!isPV && allowNull && !inCheck && depth >= 3 && staticEval >= beta && hasNonPawn(us)) {
      var R = depth >= 7 ? 3 : 2;
      pos.makeNull(); pushRep();
      var ns = -search(-beta, -beta + 1, depth - 1 - R, ply + 1, false, false);
      repN--; pos.unmakeNull();
      if (stopped) return 0;
      if (ns >= beta) return ns >= MATE_BOUND ? beta : ns;
    }

    var buf = moveBufs[ply], sc = scoreBufs[ply];
    var n = pos.genMoves(buf, 0, false);
    scoreMoves(buf, sc, n, ttm, ply);
    var goldenMine = (pos.golden >> us) & 1;
    if (goldenMine) {
      if (inCheck) n = addGoldenEvasions(buf, sc, n);
      else if (depth >= 3) n = addGoldenCandidates(buf, sc, n, depth >= 8 ? 12 : depth >= 5 ? 8 : 4);
      if (ttm && (ttm & F_GOLDEN)) {
        var found = false;
        for (var q = 0; q < n; q++) if (buf[q] === ttm) { sc[q] = 10000000; found = true; break; }
        if (!found && !inCheck && validGolden(ttm)) { buf[n] = ttm; sc[n] = 10000000; n++; }
      }
    }

    var legal = 0, best = -INF, bestMove = 0, origAlpha = alpha, quietTried = 0;
    var futile = !isPV && !inCheck && depth <= 2 && staticEval + 150 * depth <= alpha;
    for (var i = 0; i < n; i++) {
      pickNext(buf, sc, i, n);
      var m = buf[i];
      var isCap = (m & F_CAPTURE) !== 0, isPromo = ((m >> 14) & 7) !== 0, isGold = (m & F_GOLDEN) !== 0;
      var quiet = !isCap && !isPromo;
      pos.makeMove(m);
      if (!pos.legalAfterMake(m)) { pos.unmakeMove(); continue; }
      legal++;
      var givesCheck = pos.inCheck();
      if (futile && quiet && legal > 1 && !givesCheck) { pos.unmakeMove(); continue; }
      if (quiet) quietTried++;
      // late move pruning at shallow depth
      if (!isPV && !inCheck && !givesCheck && quiet && depth <= 3 && quietTried > 4 + depth * depth * 3 && best > -MATE_BOUND) { pos.unmakeMove(); continue; }
      pushRep();
      var s;
      if (legal === 1) s = -search(-beta, -alpha, depth - 1, ply + 1, isPV, true);
      else {
        var r = 0;
        if (depth >= 3 && quiet && !inCheck && !givesCheck && sc[i] < 790000) {
          r = 1;
          if (legal > 6) r++;
          if (depth >= 8 && legal > 12) r++;
          if (isGold) r += 2;
          if (isPV && r > 1) r--;
          if (r > depth - 2) r = depth - 2;
          if (r < 0) r = 0;
        }
        s = -search(-alpha - 1, -alpha, depth - 1 - r, ply + 1, false, true);
        if (s > alpha && r > 0) s = -search(-alpha - 1, -alpha, depth - 1, ply + 1, false, true);
        if (s > alpha && s < beta && isPV) s = -search(-beta, -alpha, depth - 1, ply + 1, true, true);
      }
      repN--; pos.unmakeMove();
      if (stopped) return 0;
      if (s > best) {
        best = s; bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) {
            if (quiet && !isGold) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              var hi = us * 16384 + (m & 127) * 128 + ((m >> 7) & 127);
              history[hi] += depth * depth;
              if (history[hi] > 700000) for (var hh = 0; hh < history.length; hh++) history[hh] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) {
      if (inCheck) return -MATE + ply;
      // not in check: maybe only golden moves exist (we may not have generated them)
      if (goldenMine && pos.hasLegalMove()) return staticEval;
      return 0;
    }
    ttStore(depth, best, best >= beta ? LOWER : best > origAlpha ? EXACT : UPPER, bestMove, ply);
    return best;
  }

  // ---- root ----
  function extractPV(maxLen) {
    var pv = [], seen = {}, made = 0;
    for (var i = 0; i < maxLen; i++) {
      var idx = pos.hashLo & TT_MASK;
      if (ttKey[idx] !== pos.hashHi || !ttMove[idx]) break;
      var key = pos.hashKey();
      if (seen[key]) break;
      seen[key] = 1;
      var m = ttMove[idx];
      var legal = pos.legalMoves(true);
      if (legal.indexOf(m) < 0) break;
      pv.push(m); pos.makeMove(m); made++;
    }
    while (made--) pos.unmakeMove();
    return pv;
  }

  // opts: fen, moves (uci list played from fen), timeMs, maxDepth, nodes, level (1..8), onInfo(info)
  function think(opts) {
    ensureTT(); ensureBufs();
    pos = new GC.Position(opts.fen || GC.START_FEN);
    repN = 0; pushRep();
    var played = opts.moves || [];
    for (var k = 0; k < played.length; k++) {
      var mv = pos.moveFromUci(played[k]);
      if (!mv) break;
      pos.makeMove(mv); pushRep();
    }
    if (opts.noGolden) { pos.golden &= ~(1 << pos.side); pos._recompute(); repN = 0; pushRep(); }
    var t0 = now();
    var lv = LEVELS[Math.max(1, Math.min(8, opts.level || 8)) - 1];
    var timeMs = opts.timeMs != null ? opts.timeMs : lv.time;
    var maxDepth = Math.min(opts.maxDepth || lv.depth || 64, 64);
    deadline = t0 + Math.max(10, timeMs);
    nodeLimit = opts.nodes || 0;
    nodes = 0; stopped = false; noiseAmp = opts.analysis ? 0 : lv.noise;
    killers.fill(0);

    var rootAll = pos.legalMoves(true);
    if (opts.noGoldenRoot) { var ng = rootAll.filter(function (m) { return !(m & F_GOLDEN); }); if (ng.length) rootAll = ng; }
    if (!rootAll.length) return { move: 0, uci: null, score: pos.inCheck() ? -MATE : 0, depth: 0, nodes: 0, pv: [] };
    var root = rootAll.map(function (m) { return { m: m, s: -INF, raw: -INF, gold: !!(m & F_GOLDEN) }; });
    var exactScores = !opts.analysis && lv.exact;
    // In play, a golden move has to be clearly better than the best normal move (keeps the option for later).
    // Noisy (weaker) levels need a bigger margin: the best of ~200 noisy golden scores is biased upwards.
    var margin = opts.analysis ? 0 : (opts.goldMargin != null ? opts.goldMargin : GOLD_ROOT_MARGIN + 2 * (lv.noise || 0));
    var bestMove = root[0].m, bestScore = -INF, completedDepth = 0, pv = [];
    var tidx = pos.hashLo & TT_MASK;
    if (ttKey[tidx] === pos.hashHi) {
      for (var t = 0; t < root.length; t++) if (root[t].m === ttMove[tidx]) { var tmp = root[0]; root[0] = root[t]; root[t] = tmp; break; }
    }
    var realDeadline = deadline, realNodeLimit = nodeLimit;
    for (var depth = 1; depth <= maxDepth; depth++) {
      var alpha = -INF, iterBest = 0, iterCmp = -INF, iterRaw = -INF;
      if (depth === 1) { deadline = Infinity; nodeLimit = 0; }
      else if (depth === 2) { deadline = realDeadline; nodeLimit = realNodeLimit; }
      var list = root;
      if (depth >= 2) {
        var golds = root.filter(function (r) { return r.gold; }), normals = root.filter(function (r) { return !r.gold; });
        golds.sort(function (a, b) { return b.s - a.s; });
        var keep = exactScores ? 1 : depth >= 5 ? 8 : 12;
        list = normals.concat(golds.slice(0, keep));
        list.sort(function (a, b) { return b.s - a.s; });
        if (list[0].m !== bestMove) {
          for (var bi = 0; bi < list.length; bi++) if (list[bi].m === bestMove) { var x = list.splice(bi, 1)[0]; list.unshift(x); break; }
        }
      }
      for (var i = 0; i < list.length; i++) {
        var rm = list[i], m = rm.m, sraw, adj = rm.gold ? margin : 0;
        pos.makeMove(m); pushRep();
        if (exactScores || i === 0) sraw = -search(-INF, INF, depth - 1, 1, true, true);
        else {
          var a2 = alpha + adj, red = (rm.gold && depth >= 4) ? 1 : 0;
          sraw = -search(-a2 - 1, -a2, depth - 1 - red, 1, false, true);
          if (sraw > a2 && red && !stopped) sraw = -search(-a2 - 1, -a2, depth - 1, 1, false, true);
          if (sraw > a2 && !stopped) sraw = -search(-INF, -a2, depth - 1, 1, true, true);
        }
        repN--; pos.unmakeMove();
        if (stopped && depth > 1) break;
        var cmp = sraw - adj;
        rm.s = (exactScores || i === 0 || cmp > alpha) ? cmp : cmp - 1;
        rm.raw = sraw;
        if (cmp > iterCmp) { iterCmp = cmp; iterBest = m; iterRaw = sraw; }
        if (cmp > alpha && !exactScores) alpha = cmp;
      }
      if (stopped && depth > 1) {
        if (iterBest) { bestMove = iterBest; bestScore = iterRaw; }
        break;
      }
      bestMove = iterBest; bestScore = iterRaw; completedDepth = depth;
      ttStore(depth, bestScore, EXACT, bestMove, 0);
      pv = extractPV(Math.min(depth + 4, 24));
      if (!pv.length || pv[0] !== bestMove) pv = [bestMove];
      if (opts.onInfo) opts.onInfo(makeInfo(bestScore, depth, pv, t0));
      if (Math.abs(bestScore) > MATE_BOUND && depth >= 4) break;
      if (now() - t0 > timeMs * 0.55 && depth >= (opts.minDepth || 1)) break;
    }
    var chosen = bestMove, chosenScore = bestScore;
    if (exactScores && completedDepth) {
      var pick = choose(root, lv);
      chosen = pick.m; chosenScore = pick.s;
    }
    var res = makeInfo(chosenScore, completedDepth, chosen === bestMove && pv.length ? pv : [chosen], t0);
    res.move = chosen;
    return res;
  }

  function makeInfo(score, depth, pv, t0) {
    var mate = 0;
    if (score > MATE_BOUND) mate = Math.ceil((MATE - score) / 2);
    else if (score < -MATE_BOUND) mate = -Math.ceil((MATE + score) / 2);
    return {
      score: score, mate: mate, depth: depth, nodes: nodes, timeMs: Math.round(now() - t0),
      pv: pv.map(GC.moveToUci), uci: pv.length ? GC.moveToUci(pv[0]) : null, move: pv[0] || 0
    };
  }

  // Weak levels: sample among near-best moves; all golden moves together count as one option.
  function choose(root, lv) {
    var best = -INF, i;
    var bestGold = null, cands = [];
    for (i = 0; i < root.length; i++) {
      var r = root[i];
      if (r.gold) { if (!bestGold || r.s > bestGold.s) bestGold = r; } else cands.push(r);
    }
    if (bestGold) cands.push(bestGold);
    for (i = 0; i < cands.length; i++) if (cands[i].s > best) best = cands[i].s;
    if (Math.abs(best) > MATE_BOUND) { for (i = 0; i < cands.length; i++) if (cands[i].s === best) return cands[i]; }
    var w = [], tot = 0;
    for (i = 0; i < cands.length; i++) {
      var d = cands[i].s - best;
      var wt = d < -lv.margin ? 0 : Math.exp(d / lv.temp);
      if (cands[i].gold && d < 0) wt *= 0.25; // weak bots rarely burn the golden move on a whim
      w.push(wt); tot += wt;
    }
    var x = Math.random() * tot;
    for (i = 0; i < cands.length; i++) { x -= w[i]; if (x <= 0) return cands[i]; }
    return cands[0];
  }

  // Strength ladder (approx. Elo from matches vs Stockfish UCI_Elo + an internal ladder, see test/calibrate.js)
  var LEVELS = [
    { name: 1, elo: 600, depth: 2, time: 400, noise: 240, exact: true, temp: 90, margin: 300 },
    { name: 2, elo: 900, depth: 2, time: 500, noise: 110, exact: true, temp: 55, margin: 260 },
    { name: 3, elo: 1200, depth: 2, time: 600, noise: 55, exact: true, temp: 35, margin: 200 },
    { name: 4, elo: 1350, depth: 3, time: 700, noise: 110, exact: true, temp: 40, margin: 180 },
    { name: 5, elo: 1600, depth: 3, time: 700, noise: 40, exact: true, temp: 22, margin: 120 },
    { name: 6, elo: 1900, depth: 5, time: 400, noise: 18, exact: false },
    { name: 7, elo: 2250, depth: 64, time: 900, noise: 0, exact: false },
    { name: 8, elo: 2500, depth: 64, time: 3000, noise: 0, exact: false }
  ];

  return { think: think, clear: clearTT, LEVELS: LEVELS, MATE: MATE, MATE_BOUND: MATE_BOUND, evaluateFen: function (fen) { pos = new GC.Position(fen); noiseAmp = 0; return evaluate(); } };
})(GC);
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
