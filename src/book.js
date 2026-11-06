// Opening book for the bots and the house players: the first moves of a game come from a repertoire of common club
// openings (weighted by how often they are played), not from the engine, whose eval noise at the lower levels picks
// odd moves in the opening. Lines are written in SAN and matched against the game's moves; a side is "in book" while
// the moves so far follow a line. Weaker levels leave the book sooner and stray from it more often.
var GCBook = (function () {
  // [weight, line]
  var LINES = [
    [10, 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O'], [6, 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 a6'],
    [8, 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O O-O'], [4, 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4'],
    [10, 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3'], [4, 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4'],
    [5, 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5'], [3, 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Bc5 c3 b5 Bb3 d6'],
    [5, 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6'], [3, 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nb3 Bb6 Nc3 Nf6'],
    [5, 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4'], [2, 'e4 e5 Nf3 Nf6 Nc3 Nc6 Bb5 Nd4'],
    [3, 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O'], [3, 'e4 e5 Nc3 Nf6 Bc4 Nc6 d3 Bc5 f4 d6 Nf3'],
    [3, 'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3 Bd6'], [1, 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5'],
    [10, 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7'], [5, 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O'],
    [6, 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6'], [6, 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6'],
    [6, 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5'], [3, 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5 Nb5 d6 N1c3 a6 Na3 b5'],
    [5, 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6 Qd2 Nf6'], [4, 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Nf6 O-O Qc7 Qe2 d6 c4'],
    [5, 'e4 c5 Nf3 Nc6 Bb5 g6 Bxc6 dxc6 d3 Bg7 h3 Nf6 Nc3 O-O'], [4, 'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6 c3 Nf6 Re1 e6 d4'],
    [5, 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4 Nb6 Bb5'], [4, 'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 Bg4 Be2 e6 O-O Nc6'],
    [4, 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 f4 e6 Nf3 Nge7 O-O O-O'], [2, 'e4 c5 Nc3 Nc6 Bb5 Nd4 Bc4 e6 Nge2'],
    [2, 'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6 O-O'],
    [6, 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5'], [6, 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7'],
    [5, 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4'], [4, 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 Na3 cxd4 cxd4 Nf5'],
    [5, 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6'], [3, 'e4 e6 d4 d5 Nd2 c5 exd5 exd5 Ngf3 Nc6 Bb5 Bd6 O-O Nge7 dxc5 Bxc5'],
    [5, 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O Bg5 Bg4 Nbd2 Nbd7 c3 c6'],
    [6, 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3'], [3, 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Nxf6+ exf6'],
    [6, 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7 O-O Ne7 c4'], [3, 'e4 c6 d4 d5 e5 Bf5 Nc3 e6 g4 Bg6 Nge2 c5 h4 h6'],
    [5, 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7'], [3, 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5'],
    [3, 'e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6 d3 Nf6'],
    [6, 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6 Qe2 Bb4'], [4, 'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6 g3 Bg4 Bg2 Nc6'],
    [4, 'e4 d5 exd5 Nf6 d4 Nxd5 c4 Nb6 Nf3 g6 Be2 Bg7 O-O O-O'], [3, 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 c6 Nf3 Bg4 h3 Bh5 Bd2'],
    [4, 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7 c4 Nb6 Nc3 O-O Be3 d5'], [2, 'e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 exd6 exd6 Nc3 Be7 Bd3 Nc6 Nge2 Bg4'],
    [1, 'e4 Nf6 Nc3 d5 e5 d4 exf6 dxc3 fxg7 cxd2+ Bxd2 Bxg7'],
    [3, 'e4 g6 d4 Bg7 Nc3 d6 f4 Nf6 Nf3 O-O Bd3 Nc6'], [4, 'e4 g6 d4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O O-O'], [2, 'e4 g6 d4 Bg7 Nc3 c6 Nf3 d5 h3 Nf6 e5 Ne4'],
    [5, 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6 a4'], [3, 'e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O Bd3 Nc6'], [3, 'e4 d6 d4 Nf6 Nc3 e5 Nf3 Nbd7 Bc4 Be7 O-O O-O'],
    [1, 'e4 Nc6 d4 d5 Nc3 dxe4 d5 Ne5'], [1, 'e4 b6 d4 Bb7 Nc3 e6 Nf3 Bb4 Bd3 Nf6'],
    [8, 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4'], [5, 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O Nf3 Re8'],
    [5, 'd4 d5 c4 e6 Nf3 Nf6 Nc3 Be7 Bg5 h6 Bh4 O-O e3 b6'], [4, 'd4 d5 c4 e6 Nf3 Nf6 g3 Be7 Bg2 O-O O-O dxc4 Qc2 a6'],
    [6, 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O'], [5, 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5 Bd3 Bb7'],
    [3, 'd4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Nc3 e6 Nh4 Bg6'], [3, 'd4 d5 c4 c6 cxd5 cxd5 Bf4 Nc6 e3 Nf6 Nc3 a6'],
    [6, 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6'], [2, 'd4 d5 c4 dxc4 e4 e5 Nf3 exd4 Bxc4 Nc6 O-O'],
    [1, 'd4 d5 c4 Nc6 Nc3 dxc4 Nf3 Nf6 e4'], [2, 'd4 d5 c4 e5 dxe5 d4 Nf3 Nc6 Nbd2'],
    [5, 'd4 d5 Nf3 Nf6 c4 e6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6'], [4, 'd4 d5 Nf3 Nf6 c4 c6 Nc3 e6 e3 Nbd7 Qc2 Bd6'],
    [8, 'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3'], [3, 'd4 d5 Nf3 Nf6 Bf4 c5 e3 Nc6 c3 Qb6 Qb3 c4 Qxb6 axb6'],
    [6, 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3 b6'], [3, 'd4 d5 Bf4 c5 e3 Nc6 Nf3 Nf6 c3 Bg4'],
    [4, 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O'], [2, 'd4 d5 Nf3 c6 c4 Nf6 Nc3 dxc4 a4 Bf5'],
    [7, 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4'], [4, 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7'],
    [5, 'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O Nc3 Ne4 Qc2 Nxc3'], [5, 'd4 Nf6 c4 e6 Nf3 d5 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6'],
    [3, 'd4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 g3 Nc6 Bg2 Bxd2+ Nbxd2 d6 O-O'],
    [8, 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7'], [3, 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Nf3 e5 O-O Nc6 d5 Ne7 Ne1 Nd7'],
    [5, 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O Be2'], [3, 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5'],
    [4, 'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O Nbd7 Nc3 e5'],
    [5, 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O'], [2, 'd4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 g6 Nc3 Bxa6'],
    [2, 'd4 Nf6 c4 e5 dxe5 Ng4 Nf3 Bc5 e3 Nc6 Be2'],
    [4, 'd4 Nf6 Nf3 e6 c4 b6 g3 Bb7 Bg2 Be7 O-O O-O'], [3, 'd4 Nf6 Nf3 d5 c4 e6 Nc3 Be7'], [4, 'd4 Nf6 Nf3 g6 c4 Bg7 Nc3 O-O e4 d6 Be2 e5'],
    [5, 'd4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O Be2 d6 h3 Nbd7 O-O'], [5, 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 c5 c3'],
    [6, 'd4 Nf6 Bf4 d5 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3 O-O Bd3'], [3, 'd4 Nf6 Bf4 e6 Nf3 c5 e3 b6 Nbd2 Bb7'], [2, 'd4 Nf6 Bg5 Ne4 Bf4 d5 e3 c5 Bd3 Nf6'],
    [3, 'd4 d6 Nf3 Nf6 c4 g6 Nc3 Bg7 e4 O-O Be2 e5'], [3, 'd4 e6 c4 d5 Nc3 Nf6 Bg5 Be7 e3 O-O'], [2, 'd4 e6 e4 d5 Nc3 Nf6 Bg5 Be7'],
    [3, 'd4 g6 c4 Bg7 Nc3 d6 e4 Nf6 Nf3 O-O Be2 e5'], [3, 'd4 g6 e4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O O-O'],
    [3, 'd4 f5 c4 Nf6 g3 e6 Bg2 Be7 Nf3 O-O O-O d6 Nc3 Qe8'], [2, 'd4 f5 Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O c4 d6 Nc3 Qe8'], [1, 'd4 f5 Bg5 h6 Bh4 g5 e3 Nf6'],
    [3, 'd4 c5 d5 Nf6 c4 e6 Nc3 exd5 cxd5 d6 e4 g6'], [1, 'd4 c5 d5 e5 c4 d6 Nc3 Be7 e4'],
    [5, 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3 O-O'], [4, 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7 d3 O-O'],
    [3, 'c4 e5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 d6 O-O f5 d3 Nf6'], [3, 'c4 e5 g3 Nf6 Bg2 d5 cxd5 Nxd5 Nf3 Nc6 O-O Nb6'],
    [4, 'c4 c5 Nf3 Nf6 Nc3 d5 cxd5 Nxd5 g3 Nc6 Bg2 Nc7 O-O e5'], [3, 'c4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e6 g3 Qb6 Nb3'],
    [4, 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O d4 cxd4 Nxd4'],
    [4, 'c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 O-O e3 h6'], [3, 'c4 Nf6 Nc3 e5 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2'], [3, 'c4 Nf6 Nc3 g6 e4 d6 d4 Bg7 Nf3 O-O Be2 e5'],
    [3, 'c4 Nf6 g3 e6 Bg2 d5 Nf3 Be7 O-O O-O d4 dxc4'], [4, 'c4 e6 Nc3 d5 d4 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4'], [3, 'c4 e6 Nf3 d5 g3 Nf6 Bg2 Be7 O-O O-O d4 dxc4'],
    [2, 'c4 g6 Nc3 Bg7 g3 e5 Bg2 d6 d3 Nf6'], [3, 'c4 c6 Nf3 d5 d4 Nf6 Nc3 e6 e3 Nbd7 Qc2 Bd6'], [2, 'c4 c6 e4 d5 exd5 cxd5 d4 Nf6 Nc3 Nc6 Bg5'],
    [5, 'Nf3 d5 d4 Nf6 c4 e6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6'], [4, 'Nf3 d5 g3 Nf6 Bg2 c6 O-O Bf5 d3 e6 Nbd2 h6'], [3, 'Nf3 d5 g3 c5 Bg2 Nc6 d4 e6 O-O Nf6 c4'],
    [4, 'Nf3 d5 d4 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6'], [3, 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O d4 dxc4'], [1, 'Nf3 d5 c4 d4 b4 g5 e3'],
    [5, 'Nf3 Nf6 c4 e6 Nc3 d5 d4 Be7 Bg5 O-O e3 h6 Bh4 b6'], [4, 'Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O Be2 e5'], [3, 'Nf3 Nf6 c4 c5 Nc3 Nc6 d4 cxd4 Nxd4 e6'],
    [4, 'Nf3 Nf6 g3 d5 Bg2 e6 O-O Be7 d3 O-O Nbd2 c5 e4 Nc6'], [3, 'Nf3 Nf6 d4 e6 c4 b6 g3 Bb7 Bg2 Be7 O-O O-O'], [3, 'Nf3 Nf6 d4 g6 c4 Bg7 Nc3 O-O e4 d6 Be2 e5'],
    [2, 'Nf3 Nf6 d4 d5 c4 e6 Nc3 Bb4'], [4, 'Nf3 c5 c4 Nc6 Nc3 e5 g3 g6 Bg2 Bg7 O-O Nge7'], [3, 'Nf3 c5 c4 Nf6 Nc3 d5 cxd5 Nxd5 g3 Nc6 Bg2 Nc7'],
    [3, 'Nf3 c5 e4 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'], [3, 'Nf3 g6 e4 Bg7 d4 d6 Nc3 Nf6 Be2 O-O O-O'], [2, 'Nf3 e6 d4 d5 c4 Nf6 Nc3 Be7'],
    [2, 'Nf3 d6 d4 Nf6 c4 g6 Nc3 Bg7 e4 O-O Be2 e5'], [1, 'Nf3 Nc6 d4 d5 c4 e6 Nc3 Nf6'],
    [2, 'g3 d5 Bg2 Nf6 Nf3 e6 O-O Be7 d3 O-O'], [2, 'g3 e5 Bg2 d5 d3 Nf6 Nf3 Nc6 O-O Be7'], [2, 'b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6'], [1, 'f4 d5 Nf3 g6 e3 Bg7 Be2 Nf6 O-O O-O d3'],
  ];
  // the lines as UCI, built once (SAN matched against the rules module's own SAN, checks ignored)
  var built = null;
  function strip(s) { return s.replace(/[+#]/g, ''); }
  function build() {
    if (built) return built;
    var out = [];
    LINES.forEach(function (ln) {
      var pos = new GC.Position(GC.START_FEN), ucis = [], ok = true;
      ln[1].split(/\s+/).forEach(function (san) {
        if (!ok) return;
        var legal = pos.legalMoves(), hit = 0, i, want = strip(san), loose = null;
        // "Nge7" written where the rules need no disambiguation (the other knight is pinned): try the plain form too
        if (/^[NBRQK][a-h1-8][a-h][1-8]$/.test(want)) loose = want.charAt(0) + want.slice(2);
        for (i = 0; i < legal.length; i++) { var got = strip(pos.san(legal[i], legal)); if (got === want || (loose && got === loose)) { hit = legal[i]; break; } }
        if (!hit) { ok = false; return; }
        ucis.push(GC.moveToUci(hit)); pos.makeMove(hit);
      });
      if (ok && ucis.length) out.push({ w: ln[0], m: ucis });
    });
    built = out;
    return out;
  }
  // how deep (in plies) a level keeps to the book, and how often it strays from it per move
  var DEPTH = [6, 6, 8, 10, 10, 14, 16, 18], STRAY = [0.2, 0.12, 0.07, 0.04, 0.03, 0.015, 0.01, 0.01];
  // the book move for the position after `moves` (UCI), chosen by weight; null when the position is out of the book,
  // past the level's depth, or the player strays this time
  function pick(moves, level, rnd) {
    rnd = rnd || Math.random;
    var lvl = Math.max(1, Math.min(8, level || 5)), n = moves.length;
    if (n >= DEPTH[lvl - 1] || n > 0 && moves[n - 1].indexOf('*') >= 0) return null;
    var cands = {}, total = 0, i, j, ln, same;
    var lines = build();
    for (i = 0; i < lines.length; i++) {
      ln = lines[i];
      if (ln.m.length <= n) continue;
      same = true;
      for (j = 0; j < n; j++) if (ln.m[j] !== moves[j]) { same = false; break; }
      if (!same) continue;
      cands[ln.m[n]] = (cands[ln.m[n]] || 0) + ln.w; total += ln.w;
    }
    if (!total || rnd() < STRAY[lvl - 1]) return null;
    var x = rnd() * total, k;
    for (k in cands) { x -= cands[k]; if (x <= 0) return k; }
    return null;
  }
  function lines() { return build().length; }
  return { pick: pick, lines: lines, DEPTH: DEPTH, STRAY: STRAY };
})();
