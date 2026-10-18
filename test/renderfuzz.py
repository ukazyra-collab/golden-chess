import asyncio, sys
from playwright.async_api import async_playwright
JS = r'''
async (N) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const host = document.createElement('div'); host.className = 'board'; host.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;z-index:99';
  document.body.appendChild(host);
  const bv = new BoardView(host, {});
  const fens = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 Gg', '1r2k2r/P1P3P1/8/8/8/8/p1p3p1/R3K2R w KQk - 0 1 Gg', 'r3k2r/pPp2ppp/8/3pP3/8/8/PpP2PPP/R3K2R w KQkq d6 0 1 Gg'];
  let errors = [], transitions = 0;
  for (const fen of fens) {
    const p = new GC.Position(fen), hist = [{ b: new Int8Array(p.board) }];
    for (let i = 0; i < 120; i++) {
      const ms = p.legalMoves(true); if (!ms.length) break;
      const pro = ms.filter(m => GC.mPromo(m)), cap = ms.filter(m => m & GC.F_CAPTURE), gold = ms.filter(m => m & GC.F_GOLDEN), norm = ms.filter(m => !(m & GC.F_GOLDEN));
      const r = Math.random();
      const pool = (pro.length && r < .5) ? pro : (cap.length && r < .7) ? cap : (gold.length && r < .78) ? gold : (norm.length ? norm : ms);
      const m = pool[Math.floor(Math.random() * pool.length)];
      const piece = p.board[m & 127];
      p.makeMove(m);
      hist.push({ b: new Int8Array(p.board), m, piece });
    }
    const hintsFwd = h => { const from = h.m & 127, to = (h.m >> 7) & 127, hs = [{ from, to, code: h.piece, golden: !!(h.m & GC.F_GOLDEN) }]; if (h.m & GC.F_CASTLE) { const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1; hs.push({ from: rf, to: rt, code: (h.piece & 8) | 4 }); } return hs; };
    const hintsBack = h => { const from = h.m & 127, to = (h.m >> 7) & 127, pr = GC.mPromo(h.m), after = pr ? ((h.piece & 8) | pr) : h.piece; const hs = [{ from: to, to: from, code: after, golden: !!(h.m & GC.F_GOLDEN) }]; if (h.m & GC.F_CASTLE) { const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1; hs.push({ from: rt, to: rf, code: (h.piece & 8) | 4 }); } return hs; };
    let k = 0; bv.sync(hist[0].b, [], { instantAll: true });
    for (let t = 0; t < N; t++) {
      const r = Math.random(); let nk, hints = [];
      if (r < 0.42 && k < hist.length - 1) { nk = k + 1; hints = hintsFwd(hist[nk]); }
      else if (r < 0.84 && k > 0) { nk = k - 1; hints = hintsBack(hist[k]); }
      else nk = Math.floor(Math.random() * hist.length);
      if (Math.random() < 0.15) hints.forEach(h => h.instant = true);
      bv.sync(hist[nk].b, hints); transitions++;
      if (Math.random() < 0.03) bv.setOrientation(bv.orient ^ 1);
      if (Math.random() < 0.05) bv.speed = [0, 0.6, 1][Math.floor(Math.random() * 3)];
      k = nk;
      const d = Math.random(); await sleep(d < 0.3 ? 0 : d < 0.6 ? Math.random() * 40 : d < 0.9 ? Math.random() * 200 : 400);
      if (Math.random() < 0.08) {
        for (let w = 0; w < 100 && !bv.idle(); w++) await sleep(16);
        const snap = bv.snapshot(), e = bv.visualCheck();
        for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if ((hist[k].b[s] || 0) !== (snap[s] || 0)) e.push('sq ' + GC.sqName(s) + ' want ' + hist[k].b[s] + ' have ' + (snap[s] || 0)); }
        if (e.length) errors.push({ fen, k, e: e.slice(0, 3) });
      }
    }
    bv.speed = 1;
  }
  host.remove();
  return { transitions, errors: errors.slice(0, 6), nerr: errors.length };
}
'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}); page = await ctx.new_page()
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto('file:///home/claude/golden-chess/dist/preview.html#game'); await page.wait_for_timeout(300)
        await page.evaluate("__gc.startGame({mode:'local', level:1, color:'w', tc:'none'})")
        r = await page.evaluate(JS, int(sys.argv[1]) if len(sys.argv) > 1 else 400)
        print(r)
        await b.close()
asyncio.run(main())
