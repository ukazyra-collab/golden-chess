const GC = require('../src/core.js');
const { Position, F_GOLDEN, parseSquare: S, sqName, moveToUci } = GC;
let fails = 0;
function check(name, cond, extra) { if (!cond) { fails++; console.log('FAIL:', name, extra ?? ''); } else console.log('ok  ', name); }
const gold = (pos) => pos.legalMoves(true).filter(m => m & F_GOLDEN);
const uci = (ms) => ms.map(moveToUci).sort();

// 1. start position counts
{
  const p = new Position();
  const all = p.legalMoves(true), g = all.filter(m => m & F_GOLDEN);
  check('start: 20 normal + 220 golden', all.length === 240 && g.length === 220, all.length + '/' + g.length);
  const bad = g.filter(m => ['d6','f6'].includes(sqName(GC.mTo(m))) && p.board[GC.mFrom(m)] === 2);
  check('start: knight golden to d6/f6 forbidden (would give check)', bad.length === 0);
  check('start: no pawn/king golden moves', g.every(m => [2,3,4,5].includes(p.board[GC.mFrom(m)] & 7)));
  check('start: golden only to empty squares', g.every(m => p.board[GC.mTo(m)] === 0));
}
// 2. golden can block a check, but not with a square that gives check
{
  const p = new Position('4r2k/8/8/8/8/8/8/2B1K3 w - - 0 1 Gg');
  const g = uci(gold(p));
  check('block check: golden bishop e2,e3,e4,e6,e7 (not e5 — would check h8)', JSON.stringify(g) === JSON.stringify(['c1e2*','c1e3*','c1e4*','c1e6*','c1e7*']), g.join(' '));
  check('block check: total 10 legal moves', p.legalMoves(true).length === 10, p.legalMoves(true).map(m=>p.san(m)).join(' '));
}
// 3. discovered check forbidden
{
  const p = new Position('4k3/8/8/8/4N3/8/8/4R2K w - - 0 1 Gg');
  const g = gold(p).filter(m => GC.mFrom(m) === S('e4'));
  check('discovered check: knight may only stay on the e-file', JSON.stringify(uci(g)) === JSON.stringify(['e4e2*','e4e3*','e4e5*','e4e6*','e4e7*']), uci(g).join(' '));
  const r = gold(p).filter(m => GC.mFrom(m) === S('e1')).map(m => sqName(GC.mTo(m)));
  check('rook golden: never on 8th rank or open e-file', !r.some(s => s[1] === '8' || ['e5','e6','e7'].includes(s)) && r.includes('e2') && r.includes('a1'), r.length);
}
// 4. pinned piece: only along the pin line
{
  const p = new Position('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1 Gg');
  const g = gold(p).map(m => sqName(GC.mTo(m))).sort();
  check('pinned bishop golden only along the pin (e3..e6)', JSON.stringify(g) === JSON.stringify(['e3','e4','e5','e6']), g.join(' '));
}
// 5. mate detection includes golden block; without golden it is mate
{
  const withG = new Position('4R1k1/5ppp/8/8/8/8/8/Kn6 b - - 0 1 Gg');
  const noG = new Position('4R1k1/5ppp/8/8/8/8/8/Kn6 b - - 0 1 G');
  check('back rank: golden knight to f8 saves', withG.hasLegalMove() && uci(withG.legalMoves()).includes('b1f8*'));
  check('back rank: without golden it is mate', !noG.hasLegalMove() && noG.inCheck());
  const before = new Position('6k1/5ppp/8/8/8/8/8/Kn2R3 w - - 0 1 Gg');
  const m = before.moveFromUci('e1e8');
  check('SAN shows + (not #) when golden defence exists', before.san(m) === 'Re8+', before.san(m));
  const before2 = new Position('6k1/5ppp/8/8/8/8/8/Kn2R3 w - - 0 1 G');
  check('SAN shows # when no golden left', before2.san(before2.moveFromUci('e1e8')) === 'Re8#', before2.san(before2.moveFromUci('e1e8')));
}
// 6. golden flag, castling rights, halfmove
{
  const p = new Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 5 20 Gg');
  const m = p.moveFromUci('h1h5*');
  check('rook golden move found', !!m);
  p.makeMove(m);
  check('golden flag cleared for white only', p.golden === 2 && p.fen().endsWith(' g'), p.fen());
  check('castling right lost after rook golden', !(p.castling & 1) && (p.castling & 2), p.castling);
  check('halfmove counts golden as non-pawn non-capture', p.halfmove === 6);
  check('white cannot golden again later', (p.makeMove(p.moveFromUci('a8a7')), gold(p).length === 0));
}
// 7. golden queen into a square giving mate is impossible (no check rule)
{
  const p = new Position('6k1/5ppp/8/8/8/8/8/Q5K1 w - - 0 1 Gg');
  check('golden queen cannot land on a8..f8 (check)', !gold(p).some(m => ['b8','c8','d8','e8','f8','a8'].includes(sqName(GC.mTo(m))) && GC.mFrom(m) === S('a1')));
}
// 8. golden when stalemated in normal moves → must use golden, not stalemate
{
  const p = new Position('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1 Gg');
  check('bare king: no golden possible (king excluded) → stalemate', !p.hasLegalMove());
  const p2 = new Position('kn6/2Q5/1K6/8/8/8/8/8 b - - 0 1 g');
  const lm = p2.legalMoves();
  check('stalemate-ish with a knight: knight golden moves are available', lm.some(m => m & F_GOLDEN), lm.map(m=>p2.san(m)).slice(0,5).join(' '));
}
// 9. insufficient material vs golden
{
  check('KB v KB same colour, golden left → not dead', !new Position('8/8/4k3/2b5/8/4B3/4K3/8 w - - 0 1 Gg').insufficientMaterial());
  check('KB v KB same colour, no golden → dead', new Position('8/8/4k3/2b5/8/4B3/4K3/8 w - - 0 1 -').insufficientMaterial());
  check('KN v K → dead', new Position('8/8/4k3/8/8/4N3/4K3/8 w - - 0 1 Gg').insufficientMaterial());
}
// 10. fuzz: random games with golden, incremental state == recomputed state, unmake restores
{
  let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let plies = 0, goldenPlayed = 0, bad = 0;
  for (let game = 0; game < 300; game++) {
    const p = new Position();
    const snapshots = [];
    for (let ply = 0; ply < 160; ply++) {
      const moves = p.legalMoves(true);
      if (!moves.length) break;
      const g = moves.filter(m => m & F_GOLDEN), n = moves.filter(m => !(m & F_GOLDEN));
      const m = (g.length && rnd(25) === 0) || !n.length ? g[rnd(g.length)] : n[rnd(n.length)];
      p.san(m, moves);
      snapshots.push(p.fen() + '|' + p.hashKey());
      p.makeMove(m); plies++; if (m & F_GOLDEN) goldenPlayed++;
      const ref = new Position(p.fen());
      if (ref.hashKey() !== p.hashKey() || ref.mg[0] !== p.mg[0] || ref.mg[1] !== p.mg[1] || ref.eg[0] !== p.eg[0] || ref.eg[1] !== p.eg[1] || ref.phase !== p.phase) { bad++; if (bad < 4) console.log('mismatch at', p.fen(), moveToUci(m)); }
      if (p.moveFromUci(moveToUci(m)) !== 0 && false) {}
    }
    for (let i = snapshots.length - 1; i >= 0; i--) { p.unmakeMove(); if (p.fen() + '|' + p.hashKey() !== snapshots[i]) { bad++; break; } }
  }
  check(`fuzz: ${plies} plies, ${goldenPlayed} golden moves, incremental state consistent`, bad === 0, bad);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL GOLDEN TESTS PASSED');
