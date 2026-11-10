/* Joker Move puzzles made by the engine (tools/puzzles/gen.js finds them, pick.js checks and sorts them): easy to hard.
 * Every accepted answer wins (or mates) and beats the best normal move by three pawns or more. */
var JOKER_DAILY = [
  {"id":"d8","lvl":1,"fen":"8/p1P4k/8/1P1pB3/3Pp2b/8/4p1K1/8 w - - 0 62 G","accept":{"e5c3*":["e2e1n","c3e1"],"e5b4*":["e2e1q","b4e1"],"e5d2*":["e4e3","d2b4","e2e1q","b4e1"],"e5a5*":["e2e1q","a5e1"]},"diff":1},
  {"id":"d1","lvl":1,"fen":"rnbqkb1r/4pp2/2p3pp/pp1N4/3PP1n1/5N2/PPPB1PPP/R2QKB1R w KQkq - 0 9 Gg","accept":{"f1b6*":["c6d5","b6d8"],"d2b6*":["c6d5","b6d8"]},"diff":5},
  {"id":"d7","lvl":1,"fen":"b2qkbnr/r3pppp/pp3n2/3P4/5B2/2NB1N2/PPP2PPP/1R1Q1RK1 w k - 3 12 Gg","accept":{"b1b8*":["a7c8*","b8c8"],"f1b8*":["a7c8*","b8c8"]},"diff":5},
  {"id":"d18","lvl":1,"fen":"r2qk2r/1p2nppp/p7/3n4/4Q3/1Pb1N3/P3P1PP/2KR1B1R b kq - 0 19 Gg","accept":{"h8e5*":["e4h7","e5e3"],"h8e6*":["d1d5","e6e4"]},"diff":5},
  {"id":"d3","lvl":1,"fen":"r1b1kbnr/ppp2ppp/2nP4/8/2P1qB2/P4N2/1P2PPPP/RN1QKB1R w KQkq - 1 8 Gg","accept":{"h1e3*":["e4e3","f4e3"],"a1e3*":["e4e3","f4e3"]},"diff":7},
  {"id":"d10","lvl":1,"fen":"rnq1kb1r/1p2pp1p/p1p1bn2/2Np3P/1P2P3/2N2Pp1/P1PPB1P1/R1BQK2R b KQkq - 2 12 Gg","accept":{"b8f2*":["d1f1*","f2h1"]},"diff":7},
  {"id":"d12","lvl":1,"fen":"4k2r/pp5p/4q1p1/4N3/Pn1P2p1/1b4P1/4P1RP/5QK1 b k - 4 31 Gg","accept":{"h8d1*":["g2e1*","d1d4"]},"diff":9},
  {"id":"d16","lvl":2,"fen":"1qr1kb1r/4ppp1/b1P4p/1pnP3P/p4nP1/P2P2N1/1BPQ1PRK/R2BN3 w k - 1 35 Gg","accept":{"d1e5*":["f4g2","e5b8"]},"diff":9},
  {"id":"d14","lvl":2,"fen":"r1bqk1nr/1pppp1bp/p1n2pp1/4N3/3P1P2/N1P3P1/PP2P2P/R1BQKB1R w KQkq - 0 8 Gg","accept":{"a3f7*":["d8e4*","h1g1","c6e5","d4e5"]},"diff":10},
  {"id":"d2","lvl":2,"fen":"r1b2rk1/1p1n1p2/2p1p1pB/p2pP2n/7q/1PPB4/P1P1NPP1/2RQ1RK1 b - - 2 19 Gg","accept":{"a8h2*":["e2g3","h5g3"]},"diff":11},
  {"id":"d5","lvl":2,"fen":"3q4/3nkp2/1P3r1b/p5p1/2pQ4/P3P2p/1P2N2P/RNB3K1 b - - 1 32 Gg","accept":{"d8f3*":["d4f6","d7f6"]},"diff":11},
  {"id":"d17","lvl":2,"fen":"r1b1k2r/pp3p1p/4p3/3p2p1/1qPQn1n1/N5P1/P2NPP1P/R3KB1R b KQkq - 1 15 Gg","accept":{"c8c3*":["h1f4*","c3d2"]},"diff":13},
  {"id":"d6","lvl":2,"fen":"1nbq1rk1/1pp3pp/8/3pQ3/r1p3pP/3PP3/PP2BP1R/R1B1K3 w Q - 0 20 G","accept":{"a1e7*":["d8e7","e5e7"],"h2e7*":["d8e7","e5e7"]},"diff":19},
  {"id":"d11","lvl":2,"fen":"r1bqk2r/1p1p1p2/p2b1npp/2p1p3/P1PnP3/2NP1B1N/1P1B1PPP/2RQK2R b Kkq - 3 11 Gg","accept":{"c8b3*":["h3c2*","d8c7","e1g1","e8c8"]},"diff":20},
  {"id":"d13","lvl":3,"fen":"1r1qbrk1/2p1bppp/p3p3/2p5/3PQ3/2P1PN2/PP3PPP/1RB1R1K1 b - - 1 15 Gg","accept":{"e8g6*":["e4a1*","d8d5","c1d2","g6b1"]},"diff":20},
  {"id":"d15","lvl":3,"fen":"r1b5/1p2kp2/5Np1/2P1p1P1/p7/P1P1P3/1P3PP1/R3K3 w Q - 0 22 Gg","accept":{"a1g8*":["a8d8*","g8d8"]},"diff":21},
  {"id":"d4","lvl":3,"fen":"rnb1k2r/1pqpnp1p/p1p3p1/6N1/1PPQ4/P7/4PPPP/RN2KB1R b KQkq - 0 10 Gg","accept":{"c8e5*":["d4a2*","d7d5","b1d2","e5a1"]},"diff":22},
  {"id":"d9","lvl":3,"fen":"r3kb1r/ppp1qppp/3p4/6n1/P2p4/1P5P/3PQP1P/RNB1K2R b KQkq - 2 12 Gg","accept":{"a8e4*":["h1e3*","d4e3"],"h8e4*":["b1e3*","d4e3"],"h8e5*":["b1e3*","d4e3"]},"diff":25}
];
