// Generated from src/habits.js and the puzzle lists by build.js. Do not edit.
/* Joker Move puzzles made by the engine (tools/puzzles/gen.js finds them, pick.js checks and sorts them): easy to hard.
 * Every accepted answer wins (or mates) and beats the best normal move by three pawns or more. */
var JOKER_PUZZLES = [
  {"id":"j22","lvl":1,"fen":"4rrk1/pp3p2/2p5/3p2Q1/1P1P1Rn1/P1P1P1qp/3BK3/1N6 b - - 3 34 g","accept":{"f8g7*":["g5f5","g4e3"],"e8g7*":["g5h5","g3g2","e2e1","f8e8"],"e8g6*":["g5h5","h3h2","f4f1","g3g2"],"f8g6*":["g5f5","g6g7","f4f1","g3g2"]},"diff":1},
  {"id":"j34","lvl":1,"fen":"r7/p1p4p/5k2/2N5/5P2/6P1/PPP2R1P/R1K1r3 w - - 1 28 Gg","accept":{"a1d1*":["e1d1","c1d1"],"f2d1*":["e1d1","c1d1"],"c5d1*":["a8d8","f2d2","d8d2","c1d2"]},"diff":3},
  {"id":"j14","lvl":1,"fen":"r1b1kbnr/p4ppp/n1N5/1p2p3/P3P3/2P5/1P1P2PP/RNBQKBq1 b Qkq - 0 9 Gg","accept":{"h8f2*":["d1e2","f2e2"],"a8f2*":["d1e2","f2e2"]},"diff":5},
  {"id":"j16","lvl":1,"fen":"2Q5/3r2k1/3b1p2/2p5/P6P/6Pq/5B2/5RK1 w - - 8 62 G","accept":{"f1d8*":["d7d8","c8h3"],"f1b7*":["d7b7","c8h3"]},"diff":5},
  {"id":"j18","lvl":1,"fen":"8/1k1P4/p1n2pp1/P1P4p/3B3P/6P1/8/6K1 w - - 3 44 Gg","accept":{"d4d5*":["b7c7","d5c6"],"d4e4*":["b7c7","e4c6"],"d4f3*":["b7c7","f3c6"],"d4g2*":["b7c7","g2c6"]},"diff":5},
  {"id":"j6","lvl":1,"fen":"4kb1r/1bp1pp2/6p1/1p1Pp2p/2P1q2P/1P2P3/P2BQP2/R3KR2 b k - 1 23 g","accept":{"f8f3*":["e2f3","e4f3"]},"diff":7},
  {"id":"j10","lvl":1,"fen":"r1bq1rk1/1p1p1pp1/2pbpn2/p6p/3P4/P1B1PQPP/2P2P2/R3KBNR b K - 0 16 Gg","accept":{"c8e4*":["f3h2*","e4h1"],"c8d5*":["f3d1","d5h1"]},"diff":7},
  {"id":"j17","lvl":1,"fen":"7Q/r3bk2/4q3/2p2p1P/P7/3R2P1/5B2/5K2 w - - 8 68 G","accept":{"f2d5*":["e6d5","d3d5"]},"diff":7},
  {"id":"j20","lvl":1,"fen":"r3k1nr/2pq1p2/3p1bpp/pQ1Pp3/2P5/P4N1P/1P2BPP1/nNB2RK1 w kq - 1 23 Gg","accept":{"c1c6*":["a8d8","c6d7"],"e2c6*":["a8d8","b1c3","g8e7","c6d7"]},"diff":7},
  {"id":"j46","lvl":1,"fen":"2r3kr/4n2p/pp2Npp1/4p3/P3p3/1Q2B2P/4PKP1/q4B1R b - - 1 28 g","accept":{"h8b1*":["b3b1","a1b1"]},"diff":7},
  {"id":"j64","lvl":1,"fen":"2k4r/1p3Rp1/8/3rp2B/pnb3PP/3q4/PP1P1QK1/R1B5 b - - 5 29 Gg","accept":{"d5e2*":["c1a8*","c4f7"],"h8e2*":["b2b3","d3e4","g2g1","e2f2"]},"diff":7},
  {"id":"j67","lvl":1,"fen":"r1b1k2r/1p3pp1/p1p1p3/3pP2p/3P4/nPPBqN1P/P2N2P1/R1Q2RK1 w kq - 0 18 G","accept":{"d3f2*":["e3d3","c1a3"]},"diff":7},
  {"id":"j75","lvl":1,"fen":"r1b2rk1/3n3p/n1p1ppp1/2bp4/N1P3NP/1P1BPPq1/3P2P1/R1BQ1RK1 b - - 0 16 Gg","accept":{"a6f4*":["f1f2","f4d3"]},"diff":7},
  {"id":"j39","lvl":1,"fen":"8/2k5/1p2K3/p7/P5r1/1P4p1/3N2B1/8 b - - 13 64 Gg","accept":{"g4c2*":["d2f4*","c2b2","g2d5","b2d2"],"g4a2*":["d2f4*","a2b2","g2d5","b2c2"],"g4h2*":["d2f4*","h2h8","e6f5","c7d6"]},"diff":8},
  {"id":"j3","lvl":1,"fen":"2k2b1r/pp2ppp1/5n1p/qP1rB1n1/3P4/Pb2Q1PP/3N1P2/RN2KB1R b KQ - 2 18 Gg","accept":{"h8e4*":["b1b4*","e4e3"]},"diff":9},
  {"id":"j19","lvl":1,"fen":"r2qk1nr/1pp2p2/3p1bpp/p1nPp3/b1P5/P4N1P/1P1QBPP1/RNB2RK1 b kq - 3 17 Gg","accept":{"g8b3*":["d2e3","b3a1"]},"diff":9},
  {"id":"j23","lvl":1,"fen":"2k5/2p4p/pn4pb/3p4/6q1/N7/PB2Q2P/3K4 b - - 1 32 Gg","accept":{"h6f3*":["e2f3","g4f3"]},"diff":9},
  {"id":"j29","lvl":1,"fen":"r2qkb1r/1pp1pppp/p2p1n2/4n3/2P1P3/2NP2PN/PP3P1P/R1BQK2R b KQkq - 0 7 Gg","accept":{"f8f3*":["h1g2*","f3d1"]},"diff":9},
  {"id":"j30","lvl":1,"fen":"2rqkbr1/2p2ppp/pp1pp3/4n3/N1P1PB2/P2P2P1/1P3P1P/R2QK2R b KQ - 1 13 Gg","accept":{"f8f3*":["d1d2","f3h1"]},"diff":9},
  {"id":"j35","lvl":1,"fen":"1nr1kb1r/4p1p1/p1pqP2p/1p1p1p2/1P1P1PbP/PNP1QNP1/5B2/3RR1K1 w - - 2 34 Gg","accept":{"b3f7*":["c8e5*","f7d6"]},"diff":9},
  {"id":"j41","lvl":1,"fen":"r1bq1rk1/b4p1p/p3p1p1/1p6/3p1Pn1/PP6/1NPQP1PP/R1B1KB1R b K - 5 17 Gg","accept":{"c8c3*":["b2d1","c3d2"]},"diff":9},
  {"id":"j45","lvl":1,"fen":"rn1qk2r/pp3p1p/2p3p1/3p4/3P1PQ1/2N5/PPPB2PP/R3K2R w KQkq - 0 13 Gg","accept":{"h1c8*":["b8a6","c8d8"]},"diff":9},
  {"id":"j47","lvl":1,"fen":"r2qkb1r/1pp1pppp/p7/3pn3/7P/2N3P1/PPPP4/1RBQK2R b Kkq - 0 11 Gg","accept":{"f8f3*":["c3e2","f3h1"]},"diff":9},
  {"id":"j52","lvl":1,"fen":"r3kn1r/pp2ppb1/2p3pp/4B3/3Pp3/1QP3Pq/PPN2P2/R2R2K1 b kq - 1 18 Gg","accept":{"h8h2*":["b3f7","e8f7","c2e3","h2h1"],"a8h2*":["b3f7","e8f7"]},"mate":3,"diff":9},
  {"id":"j53","lvl":1,"fen":"1rb5/1p1pkpp1/4pn2/1R5p/p1P4P/q1PnPPPR/3PN1B1/1Q4K1 b - - 1 27 Gg","accept":{"b8a1*":["e2f4","a1b1"]},"diff":9},
  {"id":"j57","lvl":1,"fen":"2r2rk1/2q2pb1/1p1nb2p/1p5p/3p3R/5RQ1/P1N1PPP1/2K1NB2 b - - 3 33 Gg","accept":{"f8g1*":["f3d3*","g1f1"]},"diff":9},
  {"id":"j68","lvl":1,"fen":"rnb1r1k1/1p3pb1/2pp2p1/4p1qp/P3P3/P1BN2PP/2PP1PB1/R2QR1K1 w - - 3 17 Gg","accept":{"d3c7*":["g5d8","c7a8"]},"diff":9},
  {"id":"j5","lvl":2,"fen":"r1b2r1k/pp3pb1/nq3npp/1Np1p3/2P5/PN2B1PP/1P2PPB1/RQ3RK1 w - - 2 16 Gg","accept":{"a1d6*":["c8f5","b1c1","f5e4","d6b6"],"f1d6*":["f6c6*","a3a4","c8f5","b1f1"]},"diff":10},
  {"id":"j12","lvl":2,"fen":"3Br1k1/5ppp/2R5/3P4/P1R1P3/5PPq/1r5P/3Q2K1 w - - 1 40 Gg","accept":{"d8c2*":["h3d7","c6c7","d7d6","c4c6"],"d8e2*":["h7h6","c4c2","b2b7","d5d6"],"d8f2*":["h7h5","c4c2","b2e3*","f2e3"],"d8d2*":["h7h6","d5d6","e8d3*","c4c2"]},"diff":10},
  {"id":"j44","lvl":2,"fen":"4k1nr/p2b1pb1/2np4/q3P1p1/7p/1P3PP1/P2NN1BP/2RQKR2 b k - 0 20 g","accept":{"g8e3*":["b3b4","a5b6","d1b3","e3g2"]},"diff":10},
  {"id":"j73","lvl":2,"fen":"6k1/1p2r1p1/p3p3/2ppPp1Q/2q5/7P/2P2PP1/4R1K1 w - - 2 28 G","accept":{"e1h7*":["c4f1","g1f1","g7g6","h5g6","g8f8","h7h8"]},"mate":4,"diff":10},
  {"id":"j1","lvl":2,"fen":"rnbkr3/1p1p1p2/pqpbp1pp/8/P1QP2Pn/2P1P3/1P2BPNP/RNB2RK1 b - - 2 15 Gg","accept":{"b6h3*":["g2f4","d6f4","e3f4","h3g2"]},"mate":3,"diff":11},
  {"id":"j27","lvl":2,"fen":"1r2k2r/5p2/4p1p1/3p2Pp/1q1P4/4P3/1B3PBP/1KQ2R2 b - - 4 38 Gg","accept":{"h8c4*":["f1d2*","c4c1"]},"diff":11},
  {"id":"j42","lvl":2,"fen":"4r1k1/2p2p2/p1n3p1/Pp1Q4/1P1P1b2/2PB1PPq/7P/5R1K b - - 0 27 Gg","accept":{"e8d2*":["f1f2","d2f2","d5f7","g8f7","d3g6","f7g6"],"c6e3*":["f1g1","e3d5"]},"mate":5,"diff":11},
  {"id":"j43","lvl":2,"fen":"2rq1rk1/1pp1ppb1/p3b1pp/3BP3/P4Bn1/2N3P1/1PPQPP1P/2R2RK1 b - - 0 13 Gg","accept":{"d8h3*":["f1d1","h3h2","g1f1","h2f2"]},"mate":3,"diff":11},
  {"id":"j56","lvl":2,"fen":"r3k3/1b4pr/p1p2p1p/1p1pp1qP/3P2P1/3NN3/PQP1PP2/5K1R w q - 0 24 Gg","accept":{"d3e6*":["e5d4","e6g5"]},"diff":11},
  {"id":"j62","lvl":2,"fen":"4nr2/p3ppk1/bpB3p1/6Np/3r1P2/PP1q2P1/3B3P/1R1QK1R1 b - - 6 27 Gg","accept":{"e8e3*":["c6f3","e3d1"]},"diff":11},
  {"id":"j70","lvl":2,"fen":"3R1bkr/1p3n2/p1b2qp1/P7/2B1pP1p/4P2P/2P3P1/3Q2KR b - - 6 42 Gg","accept":{"h8a1*":["g1f2","a1d1"]},"diff":11},
  {"id":"j71","lvl":2,"fen":"r1b1k2r/pp1pbpp1/5q1p/2p5/5P1n/N1PP4/PPB4P/R3QKNR w kq - 2 16 Gg","accept":{"g1d5*":["e8g8","d5f6"]},"diff":11},
  {"id":"j2","lvl":2,"fen":"r4k2/3n1p2/p1p1p3/7R/3P4/2P2pP1/3b3p/1B1R1K2 b - - 1 44 g","accept":{"a8g2*":["b1e4","g2g1","f1f2","g1d1"]},"diff":12},
  {"id":"j8","lvl":2,"fen":"1r2kr2/3q1p2/1p2p2p/p1pPb3/P5P1/4KP1B/1P2QP2/2R2R2 w - - 1 31 Gg","accept":{"h3c6*":["e6d5","e2b5","d7c6","b5c6"],"h3b5*":["e6d5","c1d1","e5c6*","e3f4"]},"diff":12},
  {"id":"j15","lvl":2,"fen":"r3kr2/2n3bp/P1q3p1/P1Npp3/R2P1p2/2PB3P/4QP1P/5R1K w - - 0 25 Gg","accept":{"a4b6*":["f4f3","e2b2","a8b8*","b6b8"]},"diff":12},
  {"id":"j49","lvl":2,"fen":"1n1rk1r1/p3p3/1p2PbpB/1Pp5/6B1/P1qp1PP1/2P1QPR1/1R5K w - - 0 33 G","accept":{"e2h7*":["c3e1","b1e1","g8g7","h7h8","g7g8","h8g8"]},"mate":4,"diff":12},
  {"id":"j50","lvl":2,"fen":"r3k3/1p1b1prp/1Np1p1qn/p2p4/6Pb/2P4P/PP1P1R2/R1BQKB2 b Qq - 4 20 g","accept":{"a8h2*":["d1e2","g6f6","b6d7","e8d7"]},"diff":12},
  {"id":"j59","lvl":2,"fen":"1k1r1br1/2p1ppp1/p1n3q1/1p5p/1P1P3P/2P2N2/PB2QPP1/2R1K1R1 b - - 3 17 Gg","accept":{"g8e4*":["b2e3*","f7f5","g2g3","e7e5"]},"diff":12},
  {"id":"j60","lvl":2,"fen":"r3kr2/5pq1/4b2p/2Q1N3/p6P/P4P2/1P4P1/R3R1K1 w q - 1 29 Gg","accept":{"a1c7*":["g7f6","c5c6","f8d7*","c7d7"],"a1b7*":["g7f6","e5g6","f7g6","c5c6"]},"diff":12},
  {"id":"j65","lvl":2,"fen":"2b1r1k1/rp1pqp2/4p1pQ/2p4p/p1PPP2P/P5P1/1P3PB1/2R1R1K1 w - - 3 25 Gg","accept":{"c1h7*":["e7f6","e4e5","e8b1*","e1b1"],"e1h7*":["e7f6","e4e5","c8d6*","e5f6"]},"diff":12},
  {"id":"j11","lvl":2,"fen":"r1b1kb1r/pp3pp1/2n1pq1p/3p4/8/P1N1QN2/1PP1PPPP/2KR1B1R b kq - 1 11 Gg","accept":{"c8f4*":["c3d5","f4e3"]},"diff":13},
  {"id":"j24","lvl":2,"fen":"r1q1kb1r/p1n1pbp1/2p4p/1p1pN2n/3P1B2/2PQ2P1/PP1NPP2/R3KB1R w KQkq - 0 18 Gg","accept":{"f1g6*":["f8f5*","g6f7"]},"diff":13},
  {"id":"j33","lvl":2,"fen":"rn2k2r/1p4p1/2p4p/p3pp2/2Pp4/q5P1/1RP1PPBP/2Q1K2R b Kkq - 0 20 Gg","accept":{"h8a1*":["h1b1*","a1b1"]},"diff":13},
  {"id":"j51","lvl":2,"fen":"3q1r1k/1b3P1p/ppnpB3/6b1/3P2Q1/P1R5/1P4PP/5R1K w - - 7 26 Gg","accept":{"c3d7*":["d8e3*","d7b7"]},"diff":13},
  {"id":"j58","lvl":2,"fen":"r3kbr1/2p1pppp/p1n3q1/1p6/1P1P3P/B4N2/P1P1QPP1/R3K1R1 b Qq - 2 14 Gg","accept":{"g8e4*":["c2c3","e4e2"]},"diff":13},
  {"id":"j63","lvl":2,"fen":"r1b3k1/1pPp4/6p1/p6p/P2Bp1Pn/4P1qP/2P5/2R2Q1K w - - 2 29 G","accept":{"c1f6*":["g3g2","f1g2"]},"diff":13},
  {"id":"j7","lvl":2,"fen":"1rb1k1nr/qp1p1p2/4p3/p3P1p1/2PP2P1/P1N2N2/1P2QP2/R4RK1 b k - 2 18 Gg","accept":{"a7h3*":["f3h5*","g8h6","f2f3","e8g8"]},"diff":14},
  {"id":"j55","lvl":2,"fen":"r1bqkbnr/pp3pp1/n3p2p/3p4/2pP4/P1Q1PN1P/1PP2PP1/RNB1KB1R b KQkq - 0 7 Gg","accept":{"a6e4*":["c3d1*","g8f6","f1e2","f8d6"],"g8e4*":["c3d1*","f8d6","f1e2","e8g8"]},"diff":14},
  {"id":"j4","lvl":2,"fen":"3qk2r/p3ppbp/1r1p2pn/1n6/1PQ1P3/2PB1P2/PB1P2PP/R3K1NR w KQk - 2 16 Gg","accept":{"h1c8*":["h6e5*","c4b5"]},"diff":15},
  {"id":"j9","lvl":3,"fen":"7b/2p2k2/p4p2/4pq1p/P1P1p2P/3nP2P/3BQPBK/1r3R2 b - - 6 40 Gg","accept":{"h8f3*":["e2d3","e4d3"]},"diff":15},
  {"id":"j26","lvl":3,"fen":"r3kb2/1qn2prp/ppnp1Qp1/3Np1N1/2P1P3/P3B1P1/1PP2P1P/R3K1R1 w Qq - 7 18 Gg","accept":{"g1h8*":["c7d5","c4d5"],"a1h8*":["c7d5","c4d5"],"a1g8*":["g7g8","f6f7"],"g1g8*":["g7g8","f6f7"]},"diff":15},
  {"id":"j54","lvl":3,"fen":"2br2k1/2q2p2/2p1p2p/1p1pP3/rP6/2n1P1P1/2PNP3/2RQKB1R w - - 1 26 G","accept":{"d1f6*":["c3e4","d2e4"]},"diff":15},
  {"id":"j69","lvl":3,"fen":"4rrk1/pp3ppp/8/4n3/5q2/P1P4R/4PPP1/2RQKB2 b - - 4 24 g","accept":{"f8d3*":["h3d3","e5d3"]},"diff":15},
  {"id":"j21","lvl":3,"fen":"r3k2r/pp3p2/2p3p1/3p4/3P2np/P1PQP2q/1P1BN3/1N2KR2 b kq - 2 26 g","accept":{"h8h1*":["e2g1","h3g3","e1d1","g4f2"],"a8h1*":["f1h1","h3h1"]},"diff":16},
  {"id":"j32","lvl":3,"fen":"r1b2rk1/1p2bp2/q2p1p2/p2P3Q/4Pp2/P1N4P/BPP2PP1/5RKR w - - 0 29 Gg","accept":{"h1h7*":["a6f1","g1f1","c8h4*","h7h8","g8g7","h5h6"]},"mate":4,"diff":16},
  {"id":"j48","lvl":3,"fen":"r4rk1/pp1n1ppp/2p2n2/3pp3/Q1P5/P5P1/PB1PPPqP/R3K1NR w KQ - 5 10 G","accept":{"b2f3*":["d7b6","a4b4","g2h1","f3h1"]},"diff":16},
  {"id":"j61","lvl":3,"fen":"r1b1k2r/2p2p2/p6p/3ppP2/3q2P1/7B/P2QP2P/3RK2R b Kkq - 1 18 Gg","accept":{"c8c3*":["h3g2","c7c6","d2c3","d4c3"]},"diff":16},
  {"id":"j72","lvl":3,"fen":"3rkbnr/3qp2p/1R1pb1p1/p2p1p2/P2P4/2B1Q3/2P1PPPP/4KBNR w Kk - 0 16 Gg","accept":{"f1c6*":["d8c8","c6b5","e6c6*","b6c6"]},"diff":16},
  {"id":"j36","lvl":3,"fen":"1r2k2r/p5b1/2p3p1/2Q1P1P1/P3p2p/4BqNP/1PP2P2/2R1Kb2 w - - 0 27 Gg","accept":{"c1c7*":["f3e3","f2e3"]},"diff":17},
  {"id":"j25","lvl":3,"fen":"rnb1rk2/8/1qpb1pQ1/p2p4/3P2P1/P4N1P/1P2NP2/2R1R1K1 w - - 1 27 Gg","accept":{"e2f5*":["e8e4","f3e5","e4e5","e1e5"]},"diff":20},
  {"id":"j28","lvl":3,"fen":"r3kb2/2n1ppp1/1ppqb3/3p4/1P1P2n1/2P1PKN1/BQ1B1P1r/RN3R2 b - - 1 22 Gg","accept":{"d6h3*":["e3e4","h3g2","f3e2","g4f2"]},"diff":20},
  {"id":"j37","lvl":3,"fen":"r2qk2r/1pp2p1p/6p1/8/1p5P/1N1nPQB1/5PP1/bK3B1R b kq - 1 20 Gg","accept":{"h8c3*":["f1d5*","f7f5","h1d1","d8f6"]},"diff":20},
  {"id":"j13","lvl":3,"fen":"r4b1r/3kq1p1/p3p1B1/2pp4/P1nP2Q1/2P1P1P1/5PK1/R1B2R2 w - - 3 23 Gg","accept":{"f1f7*":["c5d4","e3d4"]},"diff":21},
  {"id":"j31","lvl":3,"fen":"2rqkb1r/1pp2ppp/p7/3pn3/4p1nN/2P1P1P1/PPQP1P1P/RNB2RK1 b k - 2 10 Gg","accept":{"d8h3*":["c2a4","b7b5","a4b5","a6b5","f1d1","h3h2"]},"mate":5,"diff":22},
  {"id":"j38","lvl":3,"fen":"3nk2r/5p2/3p2pp/3B4/3b1N1P/P3p1P1/4P3/4KR2 b - - 3 41 g","accept":{"h8b2*":["d5e4","b2a2","e1d1","a2a1"]},"diff":22},
  {"id":"j66","lvl":3,"fen":"4r1k1/rb1pqp2/1p2p1pQ/7p/p1PpP2P/P5P1/1P3PB1/3RR1K1 w - - 2 28 Gg","accept":{"d1h7*":["e7f6","e4e5","e8a1*","e5f6"]},"diff":22},
  {"id":"j74","lvl":3,"fen":"r2rb3/6k1/1p3pPp/p1p5/Pn5P/4P3/1P3QPN/5KR1 b - - 5 36 g","accept":{"a8d2*":["h4h5","d2d1","f2e1","d8d2"],"a8c2*":["f2c2","b4c2"]},"diff":26}
];

/* Joker Move puzzles made by the engine (tools/puzzles/gen.js finds them, pick.js checks and sorts them): easy to hard.
 * Every accepted answer wins (or mates) and beats the best normal move by three pawns or more. */
var JOKER_DAILY = [
  {"id":"d8","lvl":1,"fen":"8/p1P4k/8/1P1pB3/3Pp2b/8/4p1K1/8 w - - 0 62 G","accept":{"e5c3*":["e2e1n","c3e1"],"e5b4*":["e2e1q","b4e1"],"e5d2*":["e4e3","d2b4","e2e1q","b4e1"],"e5a5*":["e2e1q","a5e1"]},"diff":1},
  {"id":"d1","lvl":1,"fen":"rnbqkb1r/4pp2/2p3pp/pp1N4/3PP1n1/5N2/PPPB1PPP/R2QKB1R w KQkq - 0 9 Gg","accept":{"f1b6*":["c6d5","b6d8"],"d2b6*":["c6d5","b6d8"]},"diff":5},
  {"id":"d7","lvl":1,"fen":"b2qkbnr/r3pppp/pp3n2/3P4/5B2/2NB1N2/PPP2PPP/1R1Q1RK1 w k - 3 12 Gg","accept":{"b1b8*":["a7c8*","b8c8"],"f1b8*":["a7c8*","b8c8"]},"diff":5},
  {"id":"d18","lvl":1,"fen":"r2qk2r/1p2nppp/p7/3n4/4Q3/1Pb1N3/P3P1PP/2KR1B1R b kq - 0 19 Gg","accept":{"h8e5*":["e4h7","e5e3"],"h8e6*":["d1d5","e6e4"]},"diff":5},
  {"id":"d28","lvl":1,"fen":"r2qkb1r/p1pbpp2/5np1/4Q2p/3pNB2/5N2/PPP2PPP/R3K2R b KQkq - 3 12 Gg","accept":{"h8e6*":["e5c7","e6e4"],"a8e6*":["e5c7","e6e4"]},"diff":5},
  {"id":"d29","lvl":1,"fen":"rn2kr2/1p3pb1/4b1pp/pq1pp3/2p4N/P1P2PP1/R1PBR2P/2Q1KB2 b q - 1 19 Gg","accept":{"a8b1*":["e1d1","b1c1"],"f8b1*":["e1d1","b8d7","d2e3","b1c1"]},"diff":5},
  {"id":"d3","lvl":1,"fen":"r1b1kbnr/ppp2ppp/2nP4/8/2P1qB2/P4N2/1P2PPPP/RN1QKB1R w KQkq - 1 8 Gg","accept":{"h1e3*":["e4e3","f4e3"],"a1e3*":["e4e3","f4e3"]},"diff":7},
  {"id":"d10","lvl":1,"fen":"rnq1kb1r/1p2pp1p/p1p1bn2/2Np3P/1P2P3/2N2Pp1/P1PPB1P1/R1BQK2R b KQkq - 2 12 Gg","accept":{"b8f2*":["d1f1*","f2h1"]},"diff":7},
  {"id":"d31","lvl":1,"fen":"4k2r/2q1b1p1/1r1p4/2PP1ppp/7n/P3PP2/2QK1BP1/3R1B1R b k - 0 32 g","accept":{"h8b2*":["c5c6","b2c2"]},"diff":7},
  {"id":"d33","lvl":1,"fen":"1r6/5p1k/6p1/4P3/7p/P4P2/5P2/2K2B2 b - - 1 39 Gg","accept":{"b8g1*":["c1d2","g1f1"],"b8h1*":["c1d1","h1f1"]},"diff":7},
  {"id":"d38","lvl":1,"fen":"1n2kr2/4ppB1/p5p1/3P4/2n5/5B1b/2P2PNq/R3QK2 b - - 1 29 g","accept":{"f8d2*":["e1d2","c4d2"]},"diff":7},
  {"id":"d39","lvl":1,"fen":"5k2/3np3/p4p2/3P4/2n5/8/2P2PBq/1R1Q1K2 b - - 1 36 g","accept":{"d7c3*":["d1g4","c3b1"]},"diff":7},
  {"id":"d12","lvl":1,"fen":"4k2r/pp5p/4q1p1/4N3/Pn1P2p1/1b4P1/4P1RP/5QK1 b k - 4 31 Gg","accept":{"h8d1*":["g2e1*","d1d4"]},"diff":9},
  {"id":"d16","lvl":1,"fen":"1qr1kb1r/4ppp1/b1P4p/1pnP3P/p4nP1/P2P2N1/1BPQ1PRK/R2BN3 w k - 1 35 Gg","accept":{"d1e5*":["f4g2","e5b8"]},"diff":9},
  {"id":"d26","lvl":1,"fen":"2rn3Q/4kp2/4b3/7P/pp4P1/2p1R3/P1R1PP2/q2NKB2 b - - 3 45 g","accept":{"c8d2*":["c2d2","c3d2"]},"diff":9},
  {"id":"d35","lvl":1,"fen":"2qr4/ppk3bp/3p1pp1/n2Pp3/P1p1P1n1/2P2NPb/1PQN1P1P/1RBRK3 b - - 9 23 Gg","accept":{"c8g2*":["d2f1","g2f1"]},"diff":9},
  {"id":"d42","lvl":2,"fen":"3q1rk1/rp3ppp/p1np1n2/5Q2/2BP4/P3P3/1P3PpP/RN2K1R1 b Q - 1 16 Gg","accept":{"a7h1*":["f2f3","h1g1"]},"diff":9},
  {"id":"d14","lvl":2,"fen":"r1bqk1nr/1pppp1bp/p1n2pp1/4N3/3P1P2/N1P3P1/PP2P2P/R1BQKB1R w KQkq - 0 8 Gg","accept":{"a3f7*":["d8e4*","h1g1","c6e5","d4e5"]},"diff":10},
  {"id":"d23","lvl":2,"fen":"r4rk1/ppp2pb1/6pp/3pn3/1P6/P1NPP1Bq/5P1P/R2QR1K1 b - - 1 19 g","accept":{"a8d2*":["d1d2","e5f3","g1h1","f3d2"],"f8d2*":["d3d4","d2d1"]},"diff":10},
  {"id":"d2","lvl":2,"fen":"r1b2rk1/1p1n1p2/2p1p1pB/p2pP2n/7q/1PPB4/P1P1NPP1/2RQ1RK1 b - - 2 19 Gg","accept":{"a8h2*":["e2g3","h5g3"]},"diff":11},
  {"id":"d5","lvl":2,"fen":"3q4/3nkp2/1P3r1b/p5p1/2pQ4/P3P2p/1P2N2P/RNB3K1 b - - 1 32 Gg","accept":{"d8f3*":["d4f6","d7f6"]},"diff":11},
  {"id":"d19","lvl":2,"fen":"r1bnk1nr/p1pp3p/4pqpb/1p6/5P2/P2NPN2/1PPP1P1P/1RBQKB1R w Kkq - 1 11 Gg","accept":{"c1e5*":["f6f8","e5h8"],"f1e5*":["f6f5","e5h8"]},"diff":11},
  {"id":"d20","lvl":2,"fen":"r1bqk3/1p1p1pbr/p1p3p1/2nNp2p/2P1P3/PP4P1/3P1PBP/R1BQ1RK1 w q - 0 14 Gg","accept":{"c1b6*":["c6d5","b6d8"]},"diff":11},
  {"id":"d21","lvl":2,"fen":"r3k3/1p4b1/p1bP1ppr/7p/7P/P3NpPq/3P1P2/BRQ2RK1 b q - 5 31 Gg","accept":{"h6h2*":["c1c6","b7c6","d6d7","e8f7","d7d8n","f7g8"],"a8h2*":["c1c6","b7c6"]},"mate":5,"diff":11},
  {"id":"d34","lvl":2,"fen":"3q1b2/5kpr/2R5/3pp3/8/5P2/3Q3P/2BK4 b - - 1 47 g","accept":{"h7d4*":["d1e2","d4d2"]},"diff":11},
  {"id":"d43","lvl":2,"fen":"r1bq1rk1/1ppp1ppp/p1nbpn2/8/1PBP4/2P1P2P/P1Q2PP1/RNB1K1NR b KQ - 4 7 Gg","accept":{"c8e4*":["c4d3","e4g2"]},"diff":11},
  {"id":"d30","lvl":2,"fen":"4kr2/p4p2/2n1p3/3p3p/5P2/5QP1/P6P/2qN2KR b - - 0 39 Gg","accept":{"f8d2*":["h1e1*","c1c5","d1f2","d2a2"]},"diff":12},
  {"id":"d40","lvl":2,"fen":"1n2k1nr/r2pq3/pppbpp2/6pp/1P1PN3/PR2PN2/2P2PPP/2BQKR2 w k - 2 15 Gg","accept":{"f3g6*":["e7d5*","f2f3","d6c7","g6h8"]},"diff":12},
  {"id":"d17","lvl":2,"fen":"r1b1k2r/pp3p1p/4p3/3p2p1/1qPQn1n1/N5P1/P2NPP1P/R3KB1R b KQkq - 1 15 Gg","accept":{"c8c3*":["h1f4*","c3d2"]},"diff":13},
  {"id":"d36","lvl":2,"fen":"1rb3k1/4q1P1/3p4/pp3p2/3P3P/2PK4/PP1N1P2/R1B3R1 w - - 0 32 Gg","accept":{"a1h7*":["b8g4*","g1g4"]},"diff":13},
  {"id":"d41","lvl":2,"fen":"rn1q1rk1/3b2bp/p1p1ppp1/1p3n2/2P1N2P/1Q1P1N2/PPBB1PP1/R5KR b - - 1 18 Gg","accept":{"b8d4*":["f3d4","f5d4"]},"diff":15},
  {"id":"d32","lvl":2,"fen":"r1bq2k1/3prpp1/ppn2b1p/2p2P2/P2p2P1/N1PQ1N1P/1P3PK1/R1B4R b - - 2 16 Gg","accept":{"c8e4*":["d3g3*","c6e5","c3d4","e4f3"]},"diff":16},
  {"id":"d22","lvl":2,"fen":"1r6/2r2k2/pn3p2/2pb4/P3pP2/2B1P3/2B2KR1/4QN1q b - - 4 51 g","accept":{"c7g1*":["g2h2","b8g8","f2e2","h1f3"]},"diff":18},
  {"id":"d24","lvl":2,"fen":"r1bB4/1p1p1k2/p7/P1Pr2pp/4p3/2K5/4RP1P/5R2 b - - 3 40 Gg","accept":{"c8d3*":["d8b3*","f7e6","f1d1","e6e5"]},"diff":18},
  {"id":"d6","lvl":3,"fen":"1nbq1rk1/1pp3pp/8/3pQ3/r1p3pP/3PP3/PP2BP1R/R1B1K3 w Q - 0 20 G","accept":{"a1e7*":["d8e7","e5e7"],"h2e7*":["d8e7","e5e7"]},"diff":19},
  {"id":"d45","lvl":3,"fen":"r2qkbnr/1pp1ppp1/p7/3pn3/6Pp/NPP1P2N/P2P1P1P/R1BQK2R b KQkq - 0 8 Gg","accept":{"f8f3*":["d1c2","f3h1"]},"diff":19},
  {"id":"d11","lvl":3,"fen":"r1bqk2r/1p1p1p2/p2b1npp/2p1p3/P1PnP3/2NP1B1N/1P1B1PPP/2RQK2R b Kkq - 3 11 Gg","accept":{"c8b3*":["h3c2*","d8c7","e1g1","e8c8"]},"diff":20},
  {"id":"d13","lvl":3,"fen":"1r1qbrk1/2p1bppp/p3p3/2p5/3PQ3/2P1PN2/PP3PPP/1RB1R1K1 b - - 1 15 Gg","accept":{"e8g6*":["e4a1*","d8d5","c1d2","g6b1"]},"diff":20},
  {"id":"d15","lvl":3,"fen":"r1b5/1p2kp2/5Np1/2P1p1P1/p7/P1P1P3/1P3PP1/R3K3 w Q - 0 22 Gg","accept":{"a1g8*":["a8d8*","g8d8"]},"diff":21},
  {"id":"d37","lvl":3,"fen":"r1bqkb1r/1pp2ppp/p4n2/2npp3/P7/2P1P1N1/1P1PBPPP/RNBQK2R b KQkq - 5 7 Gg","accept":{"f8b3*":["c1c2*","b3c2"],"c8b3*":["c1c2*","b3c2"]},"diff":21},
  {"id":"d4","lvl":3,"fen":"rnb1k2r/1pqpnp1p/p1p3p1/6N1/1PPQ4/P7/4PPPP/RN2KB1R b KQkq - 0 10 Gg","accept":{"c8e5*":["d4a2*","d7d5","b1d2","e5a1"]},"diff":22},
  {"id":"d44","lvl":3,"fen":"rnb1kb1r/1p1q2pp/8/p1pp3N/8/4QP2/PPP3PP/R3KB1R b KQkq - 0 16 Gg","accept":{"a8e7*":["h1e5*","b8c6","e5e7","d7e7"]},"diff":22},
  {"id":"d27","lvl":3,"fen":"r1b1R3/pp3r1k/6R1/2P4P/n7/7P/4P3/4KB2 w - - 1 35 Gg","accept":{"f1e5*":["a8f8*","e8f8"]},"diff":23},
  {"id":"d9","lvl":3,"fen":"r3kb1r/ppp1qppp/3p4/6n1/P2p4/1P5P/3PQP1P/RNB1K2R b KQkq - 2 12 Gg","accept":{"a8e4*":["h1e3*","d4e3"],"h8e4*":["b1e3*","d4e3"],"h8e5*":["b1e3*","d4e3"]},"diff":25},
  {"id":"d25","lvl":3,"fen":"r1b5/1p1pk3/pB6/P1P1P2p/2K5/8/7p/7R b - - 1 51 Gg","accept":{"c8f4*":["b6d5*","a8b8","c4d4","h5h4"],"c8g3*":["b6f3*","h5h4","f3b7","a8a7"]},"diff":30}
];

/* Habits: the daily Joker puzzle, the streak of days played, and the plan of reminders for the days away.
 * Pure functions with no page in them, so the app and the tests share them. A day is the player's own calendar day,
 * 'YYYY-MM-DD' in local time (a new daily puzzle at local midnight, like chess.com's).
 *
 * Streak, the chess.com way: a day counts when the player finishes a game, solves a puzzle or reviews a game. A missed
 * day doesn't end the streak at once: it waits two days (paused) and goes on with the next day played; after three
 * missed days in a row it is gone. */
var Habits = (function () {
  var EPOCH = '2026-11-10'; // daily puzzle #1

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // noon of that day: adding days never trips over a clock change
  function noon(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0); }
  function addDays(s, n) { var d = noon(s); d.setDate(d.getDate() + n); return dayOf(d); }
  function diffDays(a, b) { return Math.round((noon(b) - noon(a)) / 86400000); } // b - a
  function weekday(s) { var w = noon(s).getDay(); return w === 0 ? 7 : w; } // Monday 1 .. Sunday 7
  function uniqSorted(days) { var m = {}; (days || []).forEach(function (d) { if (/^\d{4}-\d\d-\d\d$/.test(d)) m[d] = 1; }); return Object.keys(m).sort(); }

  // ---- the daily puzzle: Monday and Tuesday easy, the middle of the week medium, the weekend hard (a newspaper
  // crossword's week); inside its level the week number picks the puzzle, so a year of days gets different ones.
  // A longer list moves the days still to come onto other puzzles (today's too): new puzzles go out between days.
  var LEVEL_OF_DAY = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3 };
  function dailyFor(s, list) {
    if (!list || !list.length) return null;
    var n = diffDays(EPOCH, s), w = weekday(s), want = LEVEL_OF_DAY[w];
    var bucket = list.filter(function (p) { return (p.lvl || 1) === want; });
    if (!bucket.length) bucket = list;
    var sameLevel = [], k;
    for (k = 1; k <= 7; k++) if (LEVEL_OF_DAY[k] === want) sameLevel.push(k);
    var week = Math.floor((n + 7000) / 7), pos = sameLevel.indexOf(w);
    var idx = ((week * sameLevel.length + pos) % bucket.length + bucket.length) % bucket.length;
    return { day: s, n: n + 1, p: bucket[idx], lvl: want };
  }

  // ---- the streak
  function runs(days) {
    var out = [], cur = null;
    days.forEach(function (d) {
      if (cur && diffDays(cur.last, d) <= 3) { cur.count++; cur.last = d; } else { cur = { first: d, last: d, count: 1 }; out.push(cur); }
    });
    return out;
  }
  // count: the streak now; state: 'done' (played today), 'due' (played yesterday, today keeps it), 'paused' (one or two
  // days missed, today brings it back), 'none'; best: the longest ever; week: Monday to Sunday of this week
  function streak(days, today) {
    days = uniqSorted(days).filter(function (d) { return d <= today; });
    var rs = runs(days), best = 0;
    rs.forEach(function (r) { best = Math.max(best, r.count); });
    var last = rs.length ? rs[rs.length - 1] : null, gap = last ? diffDays(last.last, today) : 99;
    var state = !last ? 'none' : gap === 0 ? 'done' : gap === 1 ? 'due' : gap <= 3 ? 'paused' : 'none';
    var count = state === 'none' ? 0 : last.count;
    var on = {}; days.forEach(function (d) { on[d] = 1; });
    var mon = addDays(today, 1 - weekday(today)), week = [];
    for (var i = 0; i < 7; i++) { var d = addDays(mon, i); week.push({ d: d, on: !!on[d], today: d === today, future: d > today }); }
    return { count: count, best: best, state: state, missed: state === 'paused' ? gap - 1 : 0, last: last ? last.last : null, week: week, lost: !!last && state === 'none' && last.count >= 2 ? last.count : 0 };
  }
  // a player who has been here on an earlier day (the Play tab then shows the daily puzzle instead of the reel)
  function returning(days, today) { return uniqSorted(days).some(function (d) { return d < today; }); }

  // ---- the hour the player usually comes: the middle of the last visits' hours, kept between 9:00 and 21:00
  function habitHour(hours) {
    var hs = (hours || []).filter(function (x) { return x >= 0 && x <= 23; }).slice(-15).sort(function (a, b) { return a - b; });
    if (!hs.length) return 19;
    var m = hs[Math.floor(hs.length / 2)];
    return Math.max(9, Math.min(21, m));
  }

  // ---- reminders for the days away. Planned again every time the app opens or goes to the background, so a player
  // who comes every day only ever gets the evening one on a day not played yet. At most one a day, never 22:00-9:00,
  // nothing after the 30th day away.
  var TEXT = {
    en: {
      streakT: 'Keep your {n}-day streak', streakB: 'One game or today’s puzzle is enough.',
      dailyT: 'Daily Joker puzzle #{n}', dailyB: 'One move, any piece, any empty square. Can you find it?',
      gameT: 'A quick game?', gameB: 'A 3+2 starts in seconds. Your Joker Move is waiting.',
      reviewT: 'Your game review is free', reviewB: 'See where your last game turned, Joker Moves included.',
      weekT: 'A week of new puzzles', weekB: 'Seven daily Joker puzzles since you last came by.',
      jokerT: 'Still holding your Joker?', jokerB: 'One move can turn any game. Play a quick one.',
      newsT: 'New in Joker Chess', newsB: 'New puzzles and new players since your last visit.'
    },
    ru: {
      streakT: 'Не теряй серию: {n} дн.', streakB: 'Хватит одной партии или задачи дня.',
      dailyT: 'Задача дня #{n}', dailyB: 'Один ход, любая фигура, любое пустое поле. Найдёшь?',
      gameT: 'Сыграем?', gameB: 'Партия 3+2 начинается за секунды. Джокер ждёт.',
      reviewT: 'Разбор партии бесплатно', reviewB: 'Посмотри, где решилась твоя последняя партия, с ходами-джокерами.',
      weekT: 'Неделя новых задач', weekB: 'Семь задач дня с джокером с твоего визита.',
      jokerT: 'Джокер ещё у тебя?', jokerB: 'Один ход может перевернуть партию. Сыграй быструю.',
      newsT: 'Что нового в Joker Chess', newsB: 'Новые задачи и новые игроки с твоего визита.'
    }
  };
  function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  var QUIET_FROM = 22, QUIET_TO = 9;
  // o: { now: Date, lang, days, hours (visit hours), dailySolvedToday, hasGame (a finished game to review) }
  function plan(o) {
    var now = o.now, today = dayOf(now), L = TEXT[o.lang] || TEXT.en, hour = habitHour(o.hours), st = streak(o.days || [], today);
    var out = [];
    function at(day, h, m) { var d = noon(day); d.setHours(h, m || 0, 0, 0); return d; }
    function add(day, h, m, kind, vars, go) {
      var when = at(day, h, m);
      if (when <= now) return;
      if (when.getHours() >= QUIET_FROM || when.getHours() < QUIET_TO) return;
      if (out.some(function (x) { return dayOf(x.at) === day; })) return; // one a day
      var t = kind + 'T', b = kind + 'B';
      out.push({ id: 7000 + diffDays(today, day), at: when, kind: kind, title: fill(L[t], vars || {}), body: fill(L[b], vars || {}), go: go || 'play' });
    }
    // today: a streak of two days or more that today hasn't kept yet, in the evening
    if ((st.state === 'due' || st.state === 'paused') && st.count >= 2) add(today, 20, 30, 'streak', { n: st.count }, 'learn');
    var dn = function (k) { var d = dailyFor(addDays(today, k), [{ lvl: 1 }]); return d ? d.n : ''; };
    add(addDays(today, 1), hour, 0, 'daily', { n: dn(1) }, 'learn');
    add(addDays(today, 2), hour, 0, 'game', {}, 'play');
    add(addDays(today, 3), hour, 0, 'daily', { n: dn(3) }, 'learn');
    if (o.hasGame) add(addDays(today, 5), hour, 0, 'review', {}, 'games');
    add(addDays(today, 7), hour, 0, 'week', {}, 'learn');
    add(addDays(today, 14), hour, 0, 'joker', {}, 'play');
    add(addDays(today, 30), hour, 0, 'news', {}, 'learn');
    return out;
  }

  return { EPOCH: EPOCH, dayOf: dayOf, addDays: addDays, diffDays: diffDays, weekday: weekday, dailyFor: dailyFor, streak: streak,
    returning: returning, habitHour: habitHour, plan: plan, TEXT: TEXT };
})();

const LIST = typeof JOKER_DAILY !== 'undefined' ? JOKER_DAILY : JOKER_PUZZLES;
export { Habits, LIST };
