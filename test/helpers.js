window.__t = {
  sqCenter(sq) {
    const r = document.getElementById('board').getBoundingClientRect(), s = r.width / 8, o = __gc.board.orient;
    const f = sq & 7, rk = sq >> 4, sx = o ? 7 - f : f, sy = o ? rk : 7 - rk;
    return [r.left + (sx + 0.5) * s, r.top + (sy + 0.5) * s];
  },
  check() {
    const b = __gc.board;
    if (!b.idle()) return 'busy';
    const errs = b.visualCheck(), snap = b.snapshot(), disp = __gc.displayBoard();
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const want = disp[sq] || 0, have = snap[sq] || 0;
      if (want !== have) errs.push('square ' + GC.sqName(sq) + ' should show ' + want + ' but shows ' + have);
    }
    // move list, clocks, golden flags consistent with the game record
    const g = __gc.game;
    const p = new GC.Position(g.startFen);
    for (const r of g.records) { const m = p.moveFromUci(r.uci); if (!m) { errs.push('record not replayable ' + r.uci); break; } p.makeMove(m); }
    if (p.fen() !== g.pos.fen()) errs.push('replay mismatch ' + p.fen() + ' vs ' + g.pos.fen());
    if (g.clock) for (const c of [0, 1]) if (g.clock.t[c] < 0) errs.push('negative clock');
    return errs;
  },
  state() {
    const g = __gc.game;
    return { status: g.status, reason: g.reason, side: g.pos.side, human: g.cfg.human, mode: g.cfg.mode, n: g.records.length, view: __gc.view, pre: __gc.premoves.length,
             gold: g.pos.golden, armed: __gc.goldenArmed, dialog: __gc.dialogOpen, botBusy: __gc.botBusy };
  },
  randomLegal(golden) {
    const g = __gc.game, ms = g.legal.filter(m => !!(m & GC.F_GOLDEN) === !!golden);
    if (!ms.length) return null;
    const m = ms[Math.floor(Math.random() * ms.length)];
    return [m & 127, (m >> 7) & 127, GC.mPromo(m)];
  },
  randomPremove(golden) {
    const b = __gc.displayBoard(), h = __gc.game.cfg.human, own = [];
    for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (b[s] && (b[s] >> 3) === h && (!golden || ((b[s] & 7) >= 2 && (b[s] & 7) <= 5))) own.push(s); }
    for (let tries = 0; tries < 20 && own.length; tries++) {
      const allowOwn = !golden && Math.random() < 0.3;
      const from = own[Math.floor(Math.random() * own.length)], d = __gc.premoveDests(b, from, !!golden).filter(x => allowOwn || !b[x] || (b[x] >> 3) !== h);
      if (d.length) return [from, d[Math.floor(Math.random() * d.length)]];
    }
    return null;
  }
};
// frame monitor: every frame, the live (non-dying) pieces must match the board being displayed 1:1,
// and every moving piece must be heading to its own square.
window.__mon = { frames: 0, bad: [] };
(function mon() {
  try {
    const b = __gc.board, disp = __gc.displayBoard(); let live = 0, want = 0;
    for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (disp[s]) want++; }
    const seen = new Set();
    b.pieces.forEach(p => {
      if (p.dead) return; live++;
      if (seen.has(p.sq)) __mon.bad.push('two live pieces on ' + p.sq);
      seen.add(p.sq);
      if (!p.dragging && p.anim && (p.anim.tx !== (p.sq & 7) || p.anim.ty !== (p.sq >> 4))) __mon.bad.push('piece heading to wrong square');
      if (disp[p.sq] !== p.code && !p.pendingCode && !document.querySelector('.promo')) __mon.bad.push('code mismatch on ' + GC.sqName(p.sq) + ' ' + disp[p.sq] + '/' + p.code);
    });
    if (live !== want && !document.querySelector('.promo')) __mon.bad.push('live ' + live + ' vs board ' + want);
    __mon.frames++;
  } catch (e) { __mon.bad.push('monitor error ' + e.message); }
  requestAnimationFrame(mon);
})();
