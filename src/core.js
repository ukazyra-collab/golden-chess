/* Golden Chess — rules core. Shared by the UI (main thread) and the engine (worker).
 * Board: 0x88 mailbox. Piece code = (color << 3) | type. White = 0, black = 1.
 * Golden move (once per game per side): queen/rook/bishop/knight teleports to any empty
 * square; no capture; the opponent's king must not be in check afterwards; own king must be
 * safe afterwards (so it may be used to block a check). Replaces a normal move.
 */
var GC = (function () {
  'use strict';

  var EMPTY = 0, PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var WHITE = 0, BLACK = 1;

  // move = from | to<<7 | promo<<14 | flags
  var F_CAPTURE = 1 << 17, F_EP = 1 << 18, F_CASTLE = 1 << 19, F_DOUBLE = 1 << 20, F_GOLDEN = 1 << 21;

  var KNIGHT_D = [33, 31, 18, 14, -33, -31, -18, -14];
  var KING_D = [1, -1, 16, -16, 15, 17, -15, -17];
  var DIAG_D = [15, 17, -15, -17];
  var ORTHO_D = [1, -1, 16, -16];

  var WK = 1, WQ = 2, BK = 4, BQ = 8;
  var CASTLE_MASK = new Int8Array(128);
  for (var ci = 0; ci < 128; ci++) CASTLE_MASK[ci] = 15;
  CASTLE_MASK[0] = 15 & ~WQ; CASTLE_MASK[7] = 15 & ~WK; CASTLE_MASK[4] = 15 & ~(WK | WQ);
  CASTLE_MASK[112] = 15 & ~BQ; CASTLE_MASK[119] = 15 & ~BK; CASTLE_MASK[116] = 15 & ~(BK | BQ);

  var FILES = 'abcdefgh', RANKS = '12345678';
  var LETTER = ['', '', 'N', 'B', 'R', 'Q', 'K'];
  var PIECE_CHARS = ['', 'P', 'N', 'B', 'R', 'Q', 'K', '', '', 'p', 'n', 'b', 'r', 'q', 'k'];
  var CHAR_TO_PIECE = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6, p: 9, n: 10, b: 11, r: 12, q: 13, k: 14 };
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 Gg';

  // ---- PeSTO tables (a8..h8 first, white's view) ----
  var MG_VAL = [0, 82, 337, 365, 477, 1025, 0];
  var EG_VAL = [0, 94, 281, 297, 512, 936, 0];
  var PHASE_INC = [0, 0, 1, 1, 2, 4, 0];
  var T = {
    mgP: [0, 0, 0, 0, 0, 0, 0, 0, 98, 134, 61, 95, 68, 126, 34, -11, -6, 7, 26, 31, 65, 56, 25, -20, -14, 13, 6, 21, 23, 12, 17, -23, -27, -2, -5, 12, 17, 6, 10, -25, -26, -4, -4, -10, 3, 3, 33, -12, -35, -1, -20, -23, -15, 24, 38, -22, 0, 0, 0, 0, 0, 0, 0, 0],
    egP: [0, 0, 0, 0, 0, 0, 0, 0, 178, 173, 158, 134, 147, 132, 165, 187, 94, 100, 85, 67, 56, 53, 82, 84, 32, 24, 13, 5, -2, 4, 17, 17, 13, 9, -3, -7, -7, -8, 3, -1, 4, 7, -6, 1, 0, -5, -1, -8, 13, 8, 8, 10, 13, 0, 2, -7, 0, 0, 0, 0, 0, 0, 0, 0],
    mgN: [-167, -89, -34, -49, 61, -97, -15, -107, -73, -41, 72, 36, 23, 62, 7, -17, -47, 60, 37, 65, 84, 129, 73, 44, -9, 17, 19, 53, 37, 69, 18, 22, -13, 4, 16, 13, 28, 19, 21, -8, -23, -9, 12, 10, 19, 17, 25, -16, -29, -53, -12, -3, -1, 18, -14, -19, -105, -21, -58, -33, -17, -28, -19, -23],
    egN: [-58, -38, -13, -28, -31, -27, -63, -99, -25, -8, -25, -2, -9, -25, -24, -52, -24, -20, 10, 9, -1, -9, -19, -41, -17, 3, 22, 22, 22, 11, 8, -18, -18, -6, 16, 25, 16, 17, 4, -18, -23, -3, -1, 15, 10, -3, -20, -22, -42, -20, -10, -5, -2, -20, -23, -44, -29, -51, -23, -15, -22, -18, -50, -64],
    mgB: [-29, 4, -82, -37, -25, -42, 7, -8, -26, 16, -18, -13, 30, 59, 18, -47, -16, 37, 43, 40, 35, 50, 37, -2, -4, 5, 19, 50, 37, 37, 7, -2, -6, 13, 13, 26, 34, 12, 10, 4, 0, 15, 15, 15, 14, 27, 18, 10, 4, 15, 16, 0, 7, 21, 33, 1, -33, -3, -14, -21, -13, -12, -39, -21],
    egB: [-14, -21, -11, -8, -7, -9, -17, -24, -8, -4, 7, -12, -3, -13, -4, -14, 2, -8, 0, -1, -2, 6, 0, 4, -3, 9, 12, 9, 14, 10, 3, 2, -6, 3, 13, 19, 7, 10, -3, -9, -12, -3, 8, 10, 13, 3, -7, -15, -14, -18, -7, -1, 4, -9, -15, -27, -23, -9, -23, -5, -9, -16, -5, -17],
    mgR: [32, 42, 32, 51, 63, 9, 31, 43, 27, 32, 58, 62, 80, 67, 26, 44, -5, 19, 26, 36, 17, 45, 61, 16, -24, -11, 7, 26, 24, 35, -8, -20, -36, -26, -12, -1, 9, -7, 6, -23, -45, -25, -16, -17, 3, 0, -5, -33, -44, -16, -20, -9, -1, 11, -6, -71, -19, -13, 1, 17, 16, 7, -37, -26],
    egR: [13, 10, 18, 15, 12, 12, 8, 5, 11, 13, 13, 11, -3, 3, 8, 3, 7, 7, 7, 5, 4, -3, -5, -3, 4, 3, 13, 1, 2, 1, -1, 2, 3, 5, 8, 4, -5, -6, -8, -11, -4, 0, -5, -1, -7, -12, -8, -16, -6, -6, 0, 2, -9, -9, -11, -3, -9, 2, 3, -1, -5, -13, 4, -20],
    mgQ: [-28, 0, 29, 12, 59, 44, 43, 45, -24, -39, -5, 1, -16, 57, 28, 54, -13, -17, 7, 8, 29, 56, 47, 57, -27, -27, -16, -16, -1, 17, -2, 1, -9, -26, -9, -10, -2, -4, 3, -3, -14, 2, -11, -2, -5, 2, 14, 5, -35, -8, 11, 2, 8, 15, -3, 1, -1, -18, -9, 10, -15, -25, -31, -50],
    egQ: [-9, 22, 22, 27, 27, 19, 10, 20, -17, 20, 32, 41, 58, 25, 30, 0, -20, 6, 9, 49, 47, 35, 19, 9, 3, 22, 24, 45, 57, 40, 57, 36, -18, 28, 19, 47, 31, 34, 39, 23, -16, -27, 15, 6, 9, 17, 10, 5, -22, -23, -30, -16, -16, -23, -36, -32, -33, -28, -22, -43, -5, -32, -20, -41],
    mgK: [-65, 23, 16, -15, -56, -34, 2, 13, 29, -1, -20, -7, -8, -4, -38, -29, -9, 24, 2, -16, -20, 6, 22, -22, -17, -20, -12, -27, -30, -25, -14, -36, -49, -1, -27, -39, -46, -44, -33, -51, -14, -14, -22, -46, -44, -30, -15, -27, 1, 7, -8, -64, -43, -16, 9, 8, -15, 36, 12, -54, 8, -28, 24, 14],
    egK: [-74, -35, -18, -18, -11, 15, 4, -17, -12, 17, 14, 17, 17, 38, 23, 11, 10, 17, 23, 15, 20, 45, 44, 13, -8, 22, 24, 27, 26, 33, 26, 3, -18, -4, 21, 24, 27, 23, 9, -11, -19, -3, 11, 21, 23, 16, 7, -9, -27, -11, 4, 13, 14, 4, -5, -17, -53, -34, -21, -11, -28, -14, -24, -43]
  };
  var PST_MG = new Int16Array(16 * 128), PST_EG = new Int16Array(16 * 128);
  (function () {
    var mg = [null, T.mgP, T.mgN, T.mgB, T.mgR, T.mgQ, T.mgK];
    var eg = [null, T.egP, T.egN, T.egB, T.egR, T.egQ, T.egK];
    for (var t = 1; t <= 6; t++) for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
      var sq = r * 16 + f, wi = (7 - r) * 8 + f, bi = r * 8 + f;
      PST_MG[(WHITE << 3 | t) * 128 + sq] = MG_VAL[t] + mg[t][wi];
      PST_EG[(WHITE << 3 | t) * 128 + sq] = EG_VAL[t] + eg[t][wi];
      PST_MG[(BLACK << 3 | t) * 128 + sq] = MG_VAL[t] + mg[t][bi];
      PST_EG[(BLACK << 3 | t) * 128 + sq] = EG_VAL[t] + eg[t][bi];
    }
  })();

  // ---- Zobrist (deterministic) ----
  var seed = 0x2545F491;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var ZPL = new Int32Array(16 * 128), ZPH = new Int32Array(16 * 128);
  for (var zi = 0; zi < 16 * 128; zi++) { ZPL[zi] = rnd(); ZPH[zi] = rnd(); }
  var ZSL = rnd(), ZSH = rnd();
  var ZCL = new Int32Array(16), ZCH = new Int32Array(16);
  for (zi = 0; zi < 16; zi++) { ZCL[zi] = rnd(); ZCH[zi] = rnd(); }
  ZCL[0] = 0; ZCH[0] = 0;
  var ZEL = new Int32Array(8), ZEH = new Int32Array(8);
  for (zi = 0; zi < 8; zi++) { ZEL[zi] = rnd(); ZEH[zi] = rnd(); }
  var ZGL = new Int32Array(4), ZGH = new Int32Array(4);
  for (zi = 0; zi < 4; zi++) { ZGL[zi] = rnd(); ZGH[zi] = rnd(); }

  function sqName(sq) { return FILES[sq & 7] + RANKS[sq >> 4]; }
  function parseSquare(s) {
    if (!s || s.length !== 2) return -1;
    var f = FILES.indexOf(s[0]), r = RANKS.indexOf(s[1]);
    return f < 0 || r < 0 ? -1 : r * 16 + f;
  }
  function mFrom(m) { return m & 127; }
  function mTo(m) { return (m >> 7) & 127; }
  function mPromo(m) { return (m >> 14) & 7; }
  function moveToUci(m) {
    var s = sqName(m & 127) + sqName((m >> 7) & 127);
    var p = (m >> 14) & 7;
    if (p) s += ' pnbrqk'[p];
    if (m & F_GOLDEN) s += '*';
    return s;
  }

  // ---------------------------------------------------------------------------
  function Position(fen) {
    this.board = new Int8Array(128);
    this.side = WHITE; this.castling = 0; this.ep = -1; this.halfmove = 0; this.fullmove = 1;
    this.golden = 3;
    this.kings = new Int16Array(2);
    this.hashLo = 0; this.hashHi = 0;
    this.mg = new Int32Array(2); this.eg = new Int32Array(2); this.phase = 0;
    this.ply = 0; this.cap = 0;
    this._alloc(512);
    this._buf = null;
    this.setFen(fen || START_FEN);
  }
  var P = Position.prototype;

  P._alloc = function (n) {
    var old = this.cap ? this : null;
    var a = {
      uMove: new Int32Array(n), uCap: new Int8Array(n), uCastle: new Int8Array(n), uEp: new Int16Array(n),
      uHalf: new Int16Array(n), uGold: new Int8Array(n), uHLo: new Int32Array(n), uHHi: new Int32Array(n)
    };
    for (var k in a) { if (old) a[k].set(this[k]); this[k] = a[k]; }
    this.cap = n;
  };

  P.setFen = function (fen) {
    var parts = String(fen).trim().split(/\s+/);
    var rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN');
    var b = this.board; b.fill(0);
    var kingsSeen = [0, 0];
    for (var i = 0; i < 8; i++) {
      var r = 7 - i, f = 0, row = rows[i];
      for (var j = 0; j < row.length; j++) {
        var ch = row[j];
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        var p = CHAR_TO_PIECE[ch];
        if (!p || f > 7) throw new Error('Bad FEN');
        var sq = r * 16 + f;
        b[sq] = p;
        if ((p & 7) === KING) { this.kings[p >> 3] = sq; kingsSeen[p >> 3]++; }
        f++;
      }
      if (f !== 8) throw new Error('Bad FEN');
    }
    if (kingsSeen[0] !== 1 || kingsSeen[1] !== 1) throw new Error('Bad FEN: kings');
    this.side = parts[1] === 'b' ? BLACK : WHITE;
    var c = 0, cs = parts[2] || '-';
    if (cs.indexOf('K') >= 0 && b[4] === 6 && b[7] === 4) c |= WK;
    if (cs.indexOf('Q') >= 0 && b[4] === 6 && b[0] === 4) c |= WQ;
    if (cs.indexOf('k') >= 0 && b[116] === 14 && b[119] === 12) c |= BK;
    if (cs.indexOf('q') >= 0 && b[116] === 14 && b[112] === 12) c |= BQ;
    this.castling = c;
    this.ep = parts[3] && parts[3] !== '-' ? parseSquare(parts[3]) : -1;
    if (this.ep !== -1 && !this._epCapturable(this.ep)) this.ep = -1;
    this.halfmove = parseInt(parts[4], 10) || 0;
    this.fullmove = parseInt(parts[5], 10) || 1;
    var g = parts[6];
    this.golden = g === undefined ? 3 : ((g.indexOf('G') >= 0 ? 1 : 0) | (g.indexOf('g') >= 0 ? 2 : 0));
    this.ply = 0;
    this._recompute();
    return this;
  };

  P._epCapturable = function (ep) {
    var b = this.board;
    if (this.side === WHITE) {
      return (!((ep - 15) & 0x88) && b[ep - 15] === 1) || (!((ep - 17) & 0x88) && b[ep - 17] === 1);
    }
    return (!((ep + 15) & 0x88) && b[ep + 15] === 9) || (!((ep + 17) & 0x88) && b[ep + 17] === 9);
  };

  P._recompute = function () {
    var lo = 0, hi = 0, b = this.board;
    this.mg[0] = this.mg[1] = this.eg[0] = this.eg[1] = 0; this.phase = 0;
    for (var sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = b[sq]; if (!p) continue;
      lo ^= ZPL[p * 128 + sq]; hi ^= ZPH[p * 128 + sq];
      this.mg[p >> 3] += PST_MG[p * 128 + sq]; this.eg[p >> 3] += PST_EG[p * 128 + sq];
      this.phase += PHASE_INC[p & 7];
    }
    if (this.side === BLACK) { lo ^= ZSL; hi ^= ZSH; }
    lo ^= ZCL[this.castling]; hi ^= ZCH[this.castling];
    if (this.ep !== -1) { lo ^= ZEL[this.ep & 7]; hi ^= ZEH[this.ep & 7]; }
    lo ^= ZGL[this.golden]; hi ^= ZGH[this.golden];
    this.hashLo = lo; this.hashHi = hi;
  };

  P.fen = function () {
    var rows = [], b = this.board;
    for (var r = 7; r >= 0; r--) {
      var row = '', e = 0;
      for (var f = 0; f < 8; f++) {
        var p = b[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { row += e; e = 0; }
        row += PIECE_CHARS[p];
      }
      if (e) row += e;
      rows.push(row);
    }
    var c = (this.castling & WK ? 'K' : '') + (this.castling & WQ ? 'Q' : '') + (this.castling & BK ? 'k' : '') + (this.castling & BQ ? 'q' : '');
    var g = (this.golden & 1 ? 'G' : '') + (this.golden & 2 ? 'g' : '');
    return rows.join('/') + ' ' + (this.side ? 'b' : 'w') + ' ' + (c || '-') + ' ' + (this.ep === -1 ? '-' : sqName(this.ep)) +
      ' ' + this.halfmove + ' ' + this.fullmove + ' ' + (g || '-');
  };

  P.clone = function () { return new Position(this.fen()); };
  P.hashKey = function () { return (this.hashHi >>> 0).toString(16) + ':' + (this.hashLo >>> 0).toString(16); };
  P.goldenAvailable = function (color) { return !!(this.golden & (1 << color)); };

  P.attacked = function (sq, by) {
    var b = this.board, t, p, i, d;
    if (by === WHITE) {
      t = sq - 15; if (!(t & 0x88) && b[t] === 1) return true;
      t = sq - 17; if (!(t & 0x88) && b[t] === 1) return true;
    } else {
      t = sq + 15; if (!(t & 0x88) && b[t] === 9) return true;
      t = sq + 17; if (!(t & 0x88) && b[t] === 9) return true;
    }
    var o = by << 3, kn = o | KNIGHT, kg = o | KING, bi = o | BISHOP, ro = o | ROOK, qu = o | QUEEN;
    for (i = 0; i < 8; i++) { t = sq + KNIGHT_D[i]; if (!(t & 0x88) && b[t] === kn) return true; }
    for (i = 0; i < 8; i++) { t = sq + KING_D[i]; if (!(t & 0x88) && b[t] === kg) return true; }
    for (i = 0; i < 4; i++) {
      d = DIAG_D[i]; t = sq + d;
      while (!(t & 0x88)) { p = b[t]; if (p) { if (p === bi || p === qu) return true; break; } t += d; }
    }
    for (i = 0; i < 4; i++) {
      d = ORTHO_D[i]; t = sq + d;
      while (!(t & 0x88)) { p = b[t]; if (p) { if (p === ro || p === qu) return true; break; } t += d; }
    }
    return false;
  };

  P.inCheck = function (color) {
    if (color === undefined) color = this.side;
    return this.attacked(this.kings[color], color ^ 1);
  };

  function pushPromos(buf, n, from, to, flags, onlyQueen) {
    buf[n++] = from | (to << 7) | (QUEEN << 14) | flags;
    if (!onlyQueen) {
      buf[n++] = from | (to << 7) | (KNIGHT << 14) | flags;
      buf[n++] = from | (to << 7) | (ROOK << 14) | flags;
      buf[n++] = from | (to << 7) | (BISHOP << 14) | flags;
    }
    return n;
  }

  // Pseudo-legal normal moves. capturesOnly: captures + queen promotions.
  P.genMoves = function (buf, n, capturesOnly) {
    var b = this.board, us = this.side, them = us ^ 1;
    var fwd = us === WHITE ? 16 : -16, startRank = us === WHITE ? 1 : 6, promoRank = us === WHITE ? 7 : 0;
    for (var sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      var t = p & 7, to, tp, i, d;
      if (t === PAWN) {
        to = sq + fwd;
        if (b[to] === 0) {
          if ((to >> 4) === promoRank) n = pushPromos(buf, n, sq, to, 0, capturesOnly);
          else if (!capturesOnly) {
            buf[n++] = sq | (to << 7);
            if ((sq >> 4) === startRank && b[to + fwd] === 0) buf[n++] = sq | ((to + fwd) << 7) | F_DOUBLE;
          }
        }
        for (i = -1; i <= 1; i += 2) {
          to = sq + fwd + i;
          if (to & 0x88) continue;
          tp = b[to];
          if (tp && (tp >> 3) === them) {
            if ((to >> 4) === promoRank) n = pushPromos(buf, n, sq, to, F_CAPTURE, capturesOnly);
            else buf[n++] = sq | (to << 7) | F_CAPTURE;
          } else if (to === this.ep && !tp) {
            buf[n++] = sq | (to << 7) | F_CAPTURE | F_EP;
          }
        }
      } else if (t === KNIGHT || t === KING) {
        var D = t === KNIGHT ? KNIGHT_D : KING_D;
        for (i = 0; i < 8; i++) {
          to = sq + D[i];
          if (to & 0x88) continue;
          tp = b[to];
          if (!tp) { if (!capturesOnly) buf[n++] = sq | (to << 7); }
          else if ((tp >> 3) === them) buf[n++] = sq | (to << 7) | F_CAPTURE;
        }
        if (t === KING && !capturesOnly) n = this._genCastles(buf, n, sq);
      } else {
        var dirs = t === BISHOP ? DIAG_D : t === ROOK ? ORTHO_D : KING_D;
        for (i = 0; i < dirs.length; i++) {
          d = dirs[i]; to = sq + d;
          while (!(to & 0x88)) {
            tp = b[to];
            if (!tp) { if (!capturesOnly) buf[n++] = sq | (to << 7); }
            else { if ((tp >> 3) === them) buf[n++] = sq | (to << 7) | F_CAPTURE; break; }
            to += d;
          }
        }
      }
    }
    return n;
  };

  P._genCastles = function (buf, n, ksq) {
    var c = this.castling, b = this.board;
    if (this.side === WHITE) {
      if (ksq !== 4) return n;
      if ((c & WK) && !b[5] && !b[6] && b[7] === 4 && !this.attacked(4, BLACK) && !this.attacked(5, BLACK) && !this.attacked(6, BLACK))
        buf[n++] = 4 | (6 << 7) | F_CASTLE;
      if ((c & WQ) && !b[3] && !b[2] && !b[1] && b[0] === 4 && !this.attacked(4, BLACK) && !this.attacked(3, BLACK) && !this.attacked(2, BLACK))
        buf[n++] = 4 | (2 << 7) | F_CASTLE;
    } else {
      if (ksq !== 116) return n;
      if ((c & BK) && !b[117] && !b[118] && b[119] === 12 && !this.attacked(116, WHITE) && !this.attacked(117, WHITE) && !this.attacked(118, WHITE))
        buf[n++] = 116 | (118 << 7) | F_CASTLE;
      if ((c & BQ) && !b[115] && !b[114] && !b[113] && b[112] === 12 && !this.attacked(116, WHITE) && !this.attacked(115, WHITE) && !this.attacked(114, WHITE))
        buf[n++] = 116 | (114 << 7) | F_CASTLE;
    }
    return n;
  };

  // Pseudo-legal golden moves (legality checked after make).
  P.genGolden = function (buf, n) {
    var us = this.side;
    if (!(this.golden & (1 << us))) return n;
    var b = this.board, empties = this._empties || (this._empties = new Int16Array(64)), ne = 0, sq;
    for (sq = 0; sq < 120; sq++) { if (sq & 0x88) { sq += 7; continue; } if (!b[sq]) empties[ne++] = sq; }
    for (sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      var t = p & 7;
      if (t === PAWN || t === KING) continue;
      for (var i = 0; i < ne; i++) buf[n++] = sq | (empties[i] << 7) | F_GOLDEN;
    }
    return n;
  };

  P.makeMove = function (m) {
    var b = this.board, us = this.side, them = us ^ 1;
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7;
    var p = b[from], ptype = p & 7, ply = this.ply;
    if (ply >= this.cap) this._alloc(this.cap * 2);
    this.uMove[ply] = m; this.uCastle[ply] = this.castling; this.uEp[ply] = this.ep;
    this.uHalf[ply] = this.halfmove; this.uGold[ply] = this.golden; this.uHLo[ply] = this.hashLo; this.uHHi[ply] = this.hashHi;
    var lo = this.hashLo, hi = this.hashHi, mg = this.mg, eg = this.eg, idx;
    var cap = 0;
    if (m & F_CAPTURE) {
      var capSq = (m & F_EP) ? (us === WHITE ? to - 16 : to + 16) : to;
      cap = b[capSq]; b[capSq] = 0; idx = cap * 128 + capSq;
      lo ^= ZPL[idx]; hi ^= ZPH[idx]; mg[them] -= PST_MG[idx]; eg[them] -= PST_EG[idx]; this.phase -= PHASE_INC[cap & 7];
    }
    this.uCap[ply] = cap;
    idx = p * 128 + from;
    b[from] = 0; lo ^= ZPL[idx]; hi ^= ZPH[idx]; mg[us] -= PST_MG[idx]; eg[us] -= PST_EG[idx];
    var np = promo ? ((us << 3) | promo) : p;
    idx = np * 128 + to;
    b[to] = np; lo ^= ZPL[idx]; hi ^= ZPH[idx]; mg[us] += PST_MG[idx]; eg[us] += PST_EG[idx];
    if (promo) this.phase += PHASE_INC[promo];
    if (ptype === KING) this.kings[us] = to;
    if (m & F_CASTLE) {
      var rf, rt;
      if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      var rook = b[rf]; b[rf] = 0; b[rt] = rook;
      idx = rook * 128 + rf; lo ^= ZPL[idx]; hi ^= ZPH[idx]; mg[us] -= PST_MG[idx]; eg[us] -= PST_EG[idx];
      idx = rook * 128 + rt; lo ^= ZPL[idx]; hi ^= ZPH[idx]; mg[us] += PST_MG[idx]; eg[us] += PST_EG[idx];
    }
    var oc = this.castling, nc = oc & CASTLE_MASK[from] & CASTLE_MASK[to];
    if (nc !== oc) { lo ^= ZCL[oc] ^ ZCL[nc]; hi ^= ZCH[oc] ^ ZCH[nc]; this.castling = nc; }
    if (this.ep !== -1) { lo ^= ZEL[this.ep & 7]; hi ^= ZEH[this.ep & 7]; this.ep = -1; }
    if (m & F_DOUBLE) {
      var ep = (from + to) >> 1, enemyPawn = (them << 3) | PAWN;
      if ((!((to - 1) & 0x88) && b[to - 1] === enemyPawn) || (!((to + 1) & 0x88) && b[to + 1] === enemyPawn)) {
        this.ep = ep; lo ^= ZEL[ep & 7]; hi ^= ZEH[ep & 7];
      }
    }
    if (m & F_GOLDEN) {
      var og = this.golden, ng = og & ~(1 << us);
      lo ^= ZGL[og] ^ ZGL[ng]; hi ^= ZGH[og] ^ ZGH[ng]; this.golden = ng;
    }
    if (ptype === PAWN || cap) this.halfmove = 0; else this.halfmove++;
    if (us === BLACK) this.fullmove++;
    this.side = them; lo ^= ZSL; hi ^= ZSH;
    this.hashLo = lo; this.hashHi = hi;
    this.ply = ply + 1;
  };

  P.unmakeMove = function () {
    var ply = --this.ply, m = this.uMove[ply];
    var them = this.side, us = them ^ 1, b = this.board, mg = this.mg, eg = this.eg, idx;
    this.side = us;
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7;
    var np = b[to], p = promo ? ((us << 3) | PAWN) : np;
    idx = np * 128 + to; mg[us] -= PST_MG[idx]; eg[us] -= PST_EG[idx];
    idx = p * 128 + from; mg[us] += PST_MG[idx]; eg[us] += PST_EG[idx];
    b[to] = 0; b[from] = p;
    if (promo) this.phase -= PHASE_INC[promo];
    if ((p & 7) === KING) this.kings[us] = from;
    if (m & F_CASTLE) {
      var rf, rt;
      if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      var rook = b[rt]; b[rt] = 0; b[rf] = rook;
      idx = rook * 128 + rt; mg[us] -= PST_MG[idx]; eg[us] -= PST_EG[idx];
      idx = rook * 128 + rf; mg[us] += PST_MG[idx]; eg[us] += PST_EG[idx];
    }
    var cap = this.uCap[ply];
    if (cap) {
      var capSq = (m & F_EP) ? (us === WHITE ? to - 16 : to + 16) : to;
      b[capSq] = cap; idx = cap * 128 + capSq;
      mg[them] += PST_MG[idx]; eg[them] += PST_EG[idx]; this.phase += PHASE_INC[cap & 7];
    }
    this.castling = this.uCastle[ply]; this.ep = this.uEp[ply]; this.halfmove = this.uHalf[ply];
    this.golden = this.uGold[ply]; this.hashLo = this.uHLo[ply]; this.hashHi = this.uHHi[ply];
    if (us === BLACK) this.fullmove--;
  };

  P.makeNull = function () {
    var ply = this.ply;
    if (ply >= this.cap) this._alloc(this.cap * 2);
    this.uMove[ply] = 0; this.uCap[ply] = 0; this.uCastle[ply] = this.castling; this.uEp[ply] = this.ep;
    this.uHalf[ply] = this.halfmove; this.uGold[ply] = this.golden; this.uHLo[ply] = this.hashLo; this.uHHi[ply] = this.hashHi;
    if (this.ep !== -1) { this.hashLo ^= ZEL[this.ep & 7]; this.hashHi ^= ZEH[this.ep & 7]; this.ep = -1; }
    this.side ^= 1; this.hashLo ^= ZSL; this.hashHi ^= ZSH;
    this.halfmove++;
    this.ply = ply + 1;
  };
  P.unmakeNull = function () {
    var ply = --this.ply;
    this.side ^= 1; this.ep = this.uEp[ply]; this.halfmove = this.uHalf[ply];
    this.hashLo = this.uHLo[ply]; this.hashHi = this.uHHi[ply];
  };

  // After makeMove(m): was it legal?
  P.legalAfterMake = function (m) {
    var mover = this.side ^ 1;
    if (this.attacked(this.kings[mover], this.side)) return false;
    if ((m & F_GOLDEN) && this.attacked(this.kings[this.side], mover)) return false;
    return true;
  };

  P._scratch = function () { return this._buf || (this._buf = new Int32Array(1536)); };

  P.legalMoves = function (includeGolden) {
    var buf = new Int32Array(1536), n = this.genMoves(buf, 0, false), out = [];
    if (includeGolden !== false) n = this.genGolden(buf, n);
    for (var i = 0; i < n; i++) {
      var m = buf[i];
      this.makeMove(m);
      if (this.legalAfterMake(m)) out.push(m);
      this.unmakeMove();
    }
    return out;
  };

  P.hasLegalMove = function () {
    var buf = new Int32Array(1536), n = this.genMoves(buf, 0, false), i, m;
    for (i = 0; i < n; i++) {
      m = buf[i]; this.makeMove(m);
      var ok = this.legalAfterMake(m); this.unmakeMove();
      if (ok) return true;
    }
    n = this.genGolden(buf, 0);
    for (i = 0; i < n; i++) {
      m = buf[i]; this.makeMove(m);
      ok = this.legalAfterMake(m); this.unmakeMove();
      if (ok) return true;
    }
    return false;
  };

  P.isLegal = function (m) {
    var list = this.legalMoves(true);
    return list.indexOf(m) >= 0;
  };

  P.findMove = function (from, to, promo, golden) {
    var list = this.legalMoves(true);
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if ((m & 127) !== from || ((m >> 7) & 127) !== to) continue;
      if (!!(m & F_GOLDEN) !== !!golden) continue;
      var pr = (m >> 14) & 7;
      if (pr && pr !== (promo || QUEEN)) continue;
      return m;
    }
    return 0;
  };

  P.moveFromUci = function (u) {
    if (!u || u.length < 4) return 0;
    var from = parseSquare(u.slice(0, 2)), to = parseSquare(u.slice(2, 4));
    var golden = u.indexOf('*') >= 0, pc = u.length >= 5 ? ' pnbrqk'.indexOf(u[4]) : 0;
    if (pc <= 0) pc = 0;
    return this.findMove(from, to, pc || QUEEN, golden);
  };

  P.san = function (m, legal) {
    var b = this.board, from = m & 127, to = (m >> 7) & 127, p = b[from], t = p & 7, s;
    if (m & F_GOLDEN) {
      s = LETTER[t] + sqName(from) + '★' + sqName(to);
    } else if (m & F_CASTLE) {
      s = to > from ? 'O-O' : 'O-O-O';
    } else if (t === PAWN) {
      s = (m & F_CAPTURE) ? FILES[from & 7] + 'x' + sqName(to) : sqName(to);
      var pr = (m >> 14) & 7;
      if (pr) s += '=' + LETTER[pr];
    } else {
      s = LETTER[t];
      legal = legal || this.legalMoves(false);
      var amb = false, sameFile = false, sameRank = false;
      for (var i = 0; i < legal.length; i++) {
        var o = legal[i];
        if (o & F_GOLDEN) continue;
        var of = o & 127;
        if (of === from || ((o >> 7) & 127) !== to || (b[of] & 7) !== t) continue;
        amb = true;
        if ((of & 7) === (from & 7)) sameFile = true;
        if ((of >> 4) === (from >> 4)) sameRank = true;
      }
      if (amb) s += !sameFile ? FILES[from & 7] : !sameRank ? RANKS[from >> 4] : sqName(from);
      if (m & F_CAPTURE) s += 'x';
      s += sqName(to);
    }
    this.makeMove(m);
    if (this.inCheck()) s += this.hasLegalMove() ? '+' : '#';
    this.unmakeMove();
    return s;
  };

  // Dead position (no sequence of legal moves can checkmate) — conservative.
  P.insufficientMaterial = function () {
    var b = this.board, minors = 0, knights = 0, bishopColors = 0;
    for (var sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var t = b[sq] & 7;
      if (!t || t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors++;
      if (t === KNIGHT) knights++;
      else bishopColors |= 1 << (((sq >> 4) + (sq & 7)) & 1);
    }
    if (minors <= 1) return true;
    // only bishops, all on one square colour, and no golden move left to switch colour
    return knights === 0 && bishopColors !== 3 && this.golden === 0;
  };

  // Can `color` deliver mate by any sequence (used for timeout vs insufficient material)?
  P.hasMatingMaterial = function (color) {
    var b = this.board, own = 0, ownMinor = 0, opp = 0;
    for (var sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = b[sq], t = p & 7;
      if (!t || t === KING) continue;
      if ((p >> 3) === color) {
        own++;
        if (t === PAWN || t === ROOK || t === QUEEN) return true;
        ownMinor++;
      } else opp++;
    }
    if (own === 0) return false;
    if (ownMinor === 1) return opp > 0; // K+minor can only (help)mate if the other side has blockers
    return true;
  };

  P.pieceList = function () {
    var out = [];
    for (var sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      if (this.board[sq]) out.push({ sq: sq, p: this.board[sq] });
    }
    return out;
  };

  // perft helpers (testing)
  P.perft = function (depth, withGolden) {
    var bufs = [];
    for (var i = 0; i <= depth; i++) bufs.push(new Int32Array(1536));
    var self = this;
    function rec(d) {
      if (d === 0) return 1;
      var buf = bufs[d], n = self.genMoves(buf, 0, false), total = 0;
      if (withGolden) n = self.genGolden(buf, n);
      for (var i = 0; i < n; i++) {
        var m = buf[i];
        self.makeMove(m);
        if (self.legalAfterMake(m)) total += d === 1 ? 1 : rec(d - 1);
        self.unmakeMove();
      }
      return total;
    }
    return rec(depth);
  };

  // ---- Board-level helpers (8x8 arrays, for UI) ----
  // sq64: 0..63 with a1=0, h8=63
  function to64(sq) { return (sq >> 4) * 8 + (sq & 7); }
  function from64(i) { return (i >> 3) * 16 + (i & 7); }

  return {
    EMPTY: EMPTY, PAWN: PAWN, KNIGHT: KNIGHT, BISHOP: BISHOP, ROOK: ROOK, QUEEN: QUEEN, KING: KING,
    WHITE: WHITE, BLACK: BLACK,
    F_CAPTURE: F_CAPTURE, F_EP: F_EP, F_CASTLE: F_CASTLE, F_DOUBLE: F_DOUBLE, F_GOLDEN: F_GOLDEN,
    KNIGHT_D: KNIGHT_D, KING_D: KING_D, DIAG_D: DIAG_D, ORTHO_D: ORTHO_D,
    PST_MG: PST_MG, PST_EG: PST_EG, MG_VAL: MG_VAL, EG_VAL: EG_VAL, PHASE_INC: PHASE_INC,
    START_FEN: START_FEN, LETTER: LETTER, PIECE_CHARS: PIECE_CHARS,
    Position: Position, sqName: sqName, parseSquare: parseSquare, moveToUci: moveToUci,
    mFrom: mFrom, mTo: mTo, mPromo: mPromo, to64: to64, from64: from64
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GC;
