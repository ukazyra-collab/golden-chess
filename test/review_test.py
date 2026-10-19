import asyncio, json
from playwright.async_api import async_playwright
HELPERS = open('/home/claude/golden-chess/test/helpers.js').read()
res = []
def ok(name, cond, extra=''):
    res.append(bool(cond)); print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond or extra) else '')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}); page = await ctx.new_page()
        errs = []; page.on('pageerror', lambda e: errs.append(str(e))); page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto('file:///home/claude/golden-chess/dist/preview.html#game'); await page.evaluate(HELPERS); await page.wait_for_timeout(300)
        async def settle():
            for _ in range(120):
                r = await page.evaluate('__t.check()')
                if r != 'busy': return r
                await page.wait_for_timeout(20)
            return ['never settled']
        # play a short game: human random moves vs level-2 bot, then resign
        await page.evaluate("__gc.closeDialog(); __gc.startGame({mode:'bot', level:2, color:'w', tc:'none'})")
        for i in range(14):
            for _ in range(60):
                st = await page.evaluate('__t.state()')
                if st['status'] != 'playing' or (st['side'] == st['human'] and not st['botBusy']): break
                await page.wait_for_timeout(50)
            if st['status'] != 'playing': break
            await page.evaluate('(() => { const m = __t.randomLegal(false); if (m) __gc.tryMove(m[0], m[1], false); })()')
            await page.wait_for_timeout(30)
        await page.wait_for_timeout(1500)
        await page.evaluate("(() => { if (__gc.game.status === 'playing') { __gc.game.end('0-1', 'resign'); } })()")
        await page.evaluate("__gc.closeDialog()")
        n = await page.evaluate('__gc.game.records.length')
        await page.evaluate("document.querySelector('#review') && 0")
        await page.evaluate("(() => { const b = [...document.querySelectorAll('#side-actions button, .menu-list button')]; })()")
        # start review via the menu path
        await page.click('#btn-menu'); await page.wait_for_timeout(150)
        btns = await page.query_selector_all('.menu-list button')
        labels = [await x.inner_text() for x in btns]
        ok('menu offers Game review after the game', any('review' in l.lower() for l in labels), labels)
        for x in btns:
            if 'review' in (await x.inner_text()).lower(): await x.click(); break
        for _ in range(200):
            done = await page.evaluate('!!(window.__gcReview = __gc.reviewState) && __gc.reviewState && !__gc.reviewState.running')
            if done: break
            await page.wait_for_timeout(250)
        rv = await page.evaluate('(() => { const r = __gc.reviewState; return { n: r.n, scored: r.scores.filter(Boolean).length, sum: r.sum, cls: r.moves.filter(Boolean).map(m => m.cls) }; })()')
        ok(f'review analysed every position ({n} moves)', rv['scored'] == n + 1, rv['scored'])
        ok('review: accuracy + Elo for both sides', all(s and 0 <= s['accuracy'] <= 100 for s in rv['sum']), rv['sum'])
        ok('review: every move classified', len(rv['cls']) == n, rv['cls'])
        rp = await page.evaluate('(() => { const c = document.querySelector(".sheetdlg.report"); return c ? { kind: __gc.dialogKind, acc: [...c.querySelectorAll(".acc-box")].map(x => x.textContent), rows: c.querySelectorAll(".rp-cls").length, gold: !!c.querySelector("#rp-missed") } : null; })()')
        ok('the report: accuracy for both, the move classes, the missed golden moves', rp and rp['kind'] == 'report' and len(rp['acc']) == 2 and rp['rows'] >= 9 and rp['gold'], rp)
        await page.click('#btn-start-review'); await page.wait_for_timeout(350)
        ok('start review: the first move with the coach', await page.evaluate('!__gc.dialogOpen && __gc.view === 1 && !!document.querySelector("#review #coach")'))
        g = await page.evaluate('document.querySelector("#review .rv-graph path.area").getAttribute("d").length')
        ok('review graph drawn', g > 20, g)
        # the last move: the coach and the class badge on the board
        await page.keyboard.press('End'); await page.wait_for_timeout(100)
        for _ in range(n): await page.keyboard.press('ArrowRight')
        await page.wait_for_timeout(200)
        await page.keyboard.press('ArrowLeft'); await page.wait_for_timeout(350)
        v = await page.evaluate('({coach: (document.querySelector("#review #coach")||{}).innerText, badge: document.querySelectorAll("#board .badge").length, view: __gc.view})')
        ok('coach line and board badge for the viewed move', v['coach'] and (v['badge'] in (0, 1)) and v['view'] == n - 1, v)
        await page.click('#btn-menu'); await page.wait_for_timeout(150)
        labels = await page.evaluate('[...document.querySelectorAll(".menu-list button")].map(b => b.innerText)')
        ok('the report stays one tap away (menu)', any('Report' in l for l in labels), labels)
        await page.evaluate('__gc.closeDialog()')
        ok('board consistent after review nav', (await settle()) == [])
        # explore: make a move from this past position
        pick = "(() => { const p = new GC.Position(__gc.viewFen()); const ms = p.legalMoves(false); const m = ms[Math.floor(Math.random() * ms.length)]; return [m & 127, (m >> 7) & 127]; })()"
        mv = await page.evaluate(pick)
        await page.evaluate(f'__gc.tryMove({mv[0]}, {mv[1]}, false)'); await page.wait_for_timeout(400)
        mv = await page.evaluate(pick)
        await page.evaluate(f'__gc.tryMove({mv[0]}, {mv[1]}, false)'); await page.wait_for_timeout(400)
        await page.keyboard.press('ArrowLeft'); await page.wait_for_timeout(300)
        nv = await page.evaluate('({v: __gc.exploreState && __gc.exploreState.view, n: __gc.exploreState && __gc.exploreState.records.length})')
        ok('variation navigation steps inside the variation', nv['v'] == 1 and nv['n'] == 2, nv)
        ex = await page.evaluate('({var: !!document.querySelector(".mv.var"), exit: !!document.querySelector("[data-exit]"), n: __gc.game.records.length})')
        ok('exploring creates a variation without touching the game', ex['var'] and ex['exit'] and ex['n'] == n, ex)
        ok('board consistent in variation', (await settle()) == [])
        await page.click('[data-exit]'); await page.wait_for_timeout(400)
        back = await page.evaluate('({var: !!document.querySelector(".mv.var"), view: __gc.view})')
        ok('back to game leaves the variation', not back['var'] and back['view'] == n - 1, back)
        ok('board consistent after leaving variation', (await settle()) == [])
        await page.screenshot(path='test/shots/review_phone.png')
        print('errors', errs)
        await b.close()
    print(f'{sum(res)}/{len(res)} passed')
asyncio.run(main())
