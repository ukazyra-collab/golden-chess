/* Joker Move puzzles made by the engine (tools/puzzles/gen.js finds them, pick.js checks and sorts them): easy to hard.
 * Every accepted answer wins (or mates) and beats the best normal move by three pawns or more. */
var JOKER_PUZZLES = [
  {"id":"j1","lvl":1,"fen":"rnbkr3/1p1p1p2/pqpbp1pp/8/P1QP2Pn/2P1P3/1P2BPNP/RNB2RK1 b - - 2 15 Gg","accept":{"b6h3*":["g2f4","d6f4","e3f4","h3g2"]},"mate":3,"diff":11},
  {"id":"j2","lvl":2,"fen":"r4k2/3n1p2/p1p1p3/7R/3P4/2P2pP1/3b3p/1B1R1K2 b - - 1 44 g","accept":{"a8g2*":["b1e4","g2g1","f1f2","g1d1"]},"diff":12}
];
