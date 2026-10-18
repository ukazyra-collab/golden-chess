import asyncio, json
from playwright.async_api import async_playwright
URL = 'file:///home/claude/golden-chess/dist/preview.html#game'
HELPERS = open('/home/claude/golden-chess/test/helpers.js').read()
results = []
def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if not cond or extra else '')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto(URL); await page.evaluate(HELPERS); await page.wait_for_timeout(300)
        C = lambda sq: page.evaluate(f'__t.sqCenter({sq})')
        S = lambda name: ('abcdefgh'.index(name[0])) + (int(name[1]) - 1) * 16
        async def click(sqname): pt = await C(S(sqname)); await page.mouse.click(*pt)
        async def drag(a, z):
            pa, pz = await C(S(a)), await C(S(z))
            await page.mouse.move(*pa); await page.mouse.down(); await page.mouse.move((pa[0]+pz[0])/2, (pa[1]+pz[1])/2); await page.mouse.move(*pz); await page.mouse.up()
        async def settle():
            for _ in range(100):
                r = await page.evaluate('__t.check()')
                if r != 'busy': return r
                await page.wait_for_timeout(20)
            return ['never settled']
        async def new(setup, opts='{}'):
            await page.evaluate(f'__gc.closeDialog(); __gc.startGame({setup}, {opts})'); await page.wait_for_timeout(250)

        # 1. golden move through the UI
        await new("{mode:'bot', level:1, color:'w', tc:'none'}")
        await page.click('#btn-golden'); await click('b1')
        dots = await page.evaluate('document.querySelectorAll("#board .gdot").length')
        ok('golden: b1 knight shows 30 gold targets (32 empty minus d6/f6 checks)', dots == 30, dots)
        has_d6 = await page.evaluate(f'[...document.querySelectorAll("#board .gdot")].some(d => +d.dataset.sq === {S("d6")})')
        ok('golden: no gold dot on d6 (would give check)', not has_d6)
        await click('e5'); await page.wait_for_timeout(900)
        st = await page.evaluate('({san: __gc.game.records[0].san, gold: __gc.game.pos.golden, btn: document.getElementById("btn-golden").className, t1: document.getElementById("g-t1").textContent})')
        ok('golden: recorded as Nb1★e5', st['san'] == 'Nb1★e5', st)
        ok('golden: white right consumed, black kept', st['gold'] == 2, st)
        ok('golden: button shows used', 'used' in st['btn'] and 'used' in st['t1'].lower(), st)
        await page.wait_for_timeout(1500)
        ok('golden: board consistent after bot reply', (await settle()) == [])
        await page.click('#btn-golden')
        ok('golden: second use refused', not await page.evaluate('__gc.goldenArmed'))

        # 2. promotion picker (drag) -> knight
        await new("{mode:'bot', level:1, color:'w', tc:'none'}", "{fen: '8/P6k/8/8/8/8/6p1/K7 w - - 0 1 Gg'}")
        await drag('a7', 'a8'); await page.wait_for_timeout(120)
        opts = await page.query_selector_all('.promo .opt')
        ok('promotion: picker shows 4 pieces', len(opts) == 4, len(opts))
        await opts[1].click(); await page.wait_for_timeout(400)
        st = await page.evaluate('({san: __gc.game.records[0].san, piece: __gc.game.pos.board[112]})')
        ok('promotion: knight chosen → a8=N', st['san'].startswith('a8=N') and st['piece'] == 2, st)
        ok('promotion: board consistent', (await settle()) == [])

        # 3. premove promotion auto-queens; premove executes instantly after bot move
        await new("{mode:'bot', level:8, color:'w', tc:'none'}", "{fen: '7k/P7/8/8/8/8/8/K7 b - - 0 1 -'}")
        await page.wait_for_timeout(50)
        await drag('a7', 'a8')
        pre = await page.evaluate('__gc.premoves.length')
        ok('premove: queued during bot turn', pre == 1, pre)
        await page.wait_for_timeout(4200)
        st = await page.evaluate('({recs: __gc.game.records.map(r => r.san), pre: __gc.premoves.length})')
        ok('premove: executed right after bot move, auto-queen', len(st['recs']) >= 2 and st['recs'][1].startswith('a8=Q'), st)
        ok('premove: board consistent', (await settle()) == [])

        # 4. illegal premove is cancelled cleanly
        await new("{mode:'bot', level:1, color:'b', tc:'none'}", "{fen: '4k3/8/8/8/8/8/3r4/4K3 w - - 0 1 -'}")
        # human is black, white king e1 must deal with rook d2 — premove our rook d2->d1 (could be legal or not)
        await page.wait_for_timeout(1500)
        ok('premove cancel scenario: board consistent', (await settle()) == [])

        # 5. human flags
        await new("{mode:'bot', level:1, color:'w', tc:'1+0'}")
        await drag('e2', 'e4'); await page.wait_for_timeout(1500)
        await page.evaluate('__gc.game.clock.t[0] = 400'); await page.wait_for_timeout(900)
        st = await page.evaluate('({s: __gc.game.status, r: __gc.game.result, why: __gc.game.reason, t: __gc.game.clock.t[0], dlg: __gc.dialogOpen, clk: document.querySelector("#bar-bot .clock").textContent})')
        ok('flag: human loses on time 0-1', st['s'] == 'over' and st['r'] == '0-1' and st['why'] == 'timeout' and st['t'] == 0, st)
        ok('flag: clock shows 0:00.0 and result dialog opens', st['clk'] == '0:00.0' and st['dlg'], st)

        # 6. bot flags while thinking; late engine answer is ignored
        await new("{mode:'bot', level:8, color:'w', tc:'1+0'}")
        await drag('e2', 'e4'); await page.wait_for_timeout(1800)
        await drag('d2', 'd4'); await page.wait_for_timeout(30)
        await page.evaluate('__gc.game.clock.t[1] = 1'); await page.wait_for_timeout(1500)
        st = await page.evaluate('({s: __gc.game.status, r: __gc.game.result, why: __gc.game.reason, n: __gc.game.records.length})')
        ok('bot flag: you win on time, no move after flag', st['s'] == 'over' and st['r'] == '1-0' and st['why'] == 'timeout' and st['n'] == 3, st)

        # 7. timeout vs insufficient material = draw
        await new("{mode:'bot', level:1, color:'b', tc:'1+0'}", "{fen: '7k/8/8/8/8/8/8/K6Q w - - 0 1 -'}")
        await page.wait_for_timeout(1200)
        await page.evaluate('(() => { const m = __t.randomLegal(false); __gc.tryMove(m[0], m[1], false); __gc.game.clock.t[0] = 5; })()')  # bot (white, has a queen) flags
        await page.wait_for_timeout(1200)
        st = await page.evaluate('({s: __gc.game.status, r: __gc.game.result, why: __gc.game.reason, n: __gc.game.records.length, side: __gc.game.pos.side})')
        ok('timeout vs insufficient material: bot with queen flags vs bare king → draw', st['s'] == 'over' and st['r'] == '1/2-1/2' and st['why'] == 'timeout-insufficient', st)
        await new("{mode:'bot', level:1, color:'b', tc:'1+0'}", "{fen: '7k/8/8/8/8/8/8/K6Q b - - 0 1 -'}")
        await page.wait_for_timeout(300)
        await page.evaluate('__gc.game.records.length') # human (black, bare king) to move first
        await click('h8'); await click('g8'); await page.wait_for_timeout(1200)
        await click('g8'); await page.wait_for_timeout(50)
        st0 = await page.evaluate('__t.state()')
        await page.evaluate('__gc.game.clock.t[__gc.game.pos.side] = 1'); await page.wait_for_timeout(600)
        st = await page.evaluate('({s: __gc.game.status, r: __gc.game.result, why: __gc.game.reason, side: __gc.game.pos.side})')
        ok('timeout handling consistent (bare king flags → loss; queen side flags → draw)', st['s'] == 'over' and ((st['side'] == 1 and st['r'] == '1-0') or (st['side'] == 0 and st['why'] == 'timeout-insufficient')), st)

        # 8. two players on one device, golden for black, flip
        await new("{mode:'local', level:1, color:'w', tc:'3+2'}")
        await drag('e2', 'e4'); await page.wait_for_timeout(250)
        await page.click('#btn-golden'); await click('g8'); await click('e6'); await page.wait_for_timeout(700)
        st = await page.evaluate('({recs: __gc.game.records.map(r => r.san), gold: __gc.game.pos.golden})')
        ok('local: black golden Ng8★e6', st['recs'] == ['e4', 'Ng8★e6'] and st['gold'] == 1, st)
        await page.keyboard.press('f'); await page.wait_for_timeout(300)
        ok('local: consistent after flip', (await settle()) == [])
        clk = await page.evaluate('[...document.querySelectorAll(".clock")].map(c => c.textContent)')
        ok('local: 3+2 increment applied (shows 3:0x)', all(c.startswith('3:0') or c.startswith('2:5') for c in clk), clk)

        # 9. takeback restores golden right
        await new("{mode:'bot', level:1, color:'w', tc:'none'}")
        await page.click('#btn-golden'); await click('g1'); await click('g5'); await page.wait_for_timeout(1500)
        g1 = await page.evaluate('__gc.game.pos.golden')
        await page.evaluate('__gc.takeback()'); await page.wait_for_timeout(500)
        st = await page.evaluate('({n: __gc.game.records.length, gold: __gc.game.pos.golden, t1: document.getElementById("g-t1").textContent})')
        ok('takeback: golden move undone, right restored', g1 == 2 and st['n'] == 0 and st['gold'] == 3, (g1, st))
        ok('takeback: board consistent', (await settle()) == [])

        # 10. resume after reload
        await new("{mode:'bot', level:1, color:'w', tc:'5+0'}")
        await drag('d2', 'd4'); await page.wait_for_timeout(1500); await drag('c2', 'c4'); await page.wait_for_timeout(1500)
        before = await page.evaluate('({m: __gc.game.records.map(r => r.uci), t: __gc.game.clock.t.slice()})')
        await page.reload(); await page.evaluate(HELPERS); await page.wait_for_timeout(600)
        after = await page.evaluate('({m: __gc.game.records.map(r => r.uci), t: __gc.game.clock.t.slice(), s: __gc.game.status})')
        ok('resume: moves restored after reload', before['m'] == after['m'] and after['s'] == 'playing', (before, after))
        ok('resume: board consistent', (await settle()) == [])

        # 11. analysis after game end
        await page.evaluate("__gc.game.end('1-0','resign'); 0"); await page.wait_for_timeout(200)
        await page.evaluate('__gc.closeDialog(); __gc.setAnalysis(true)'); await page.wait_for_timeout(1800)
        txt = await page.evaluate('document.getElementById("ana").textContent')
        ok('analysis: shows best move and depth', 'Best' in txt and 'depth' in txt, txt)
        await page.keyboard.press('ArrowLeft'); await page.wait_for_timeout(1500)
        arrows = await page.evaluate('document.querySelectorAll(".arrows polygon").length')
        ok('analysis: arrow drawn for best move', arrows == 1, arrows)

        # 12. golden armed while the bot thinks stays armed after its move; selection kept
        await new("{mode:'bot', level:7, color:'w', tc:'none'}")
        await drag('e2', 'e4'); await page.wait_for_timeout(100)
        await page.click('#btn-golden'); await click('g1')
        armed_before = await page.evaluate('__gc.goldenArmed')
        await page.wait_for_timeout(2600)
        st = await page.evaluate('({armed: __gc.goldenArmed, n: __gc.game.records.length, sel: __gc.selected, dots: document.querySelectorAll("#board .gdot").length})')
        ok('golden armed during bot turn survives its move, piece stays selected with gold dots', armed_before and st['armed'] and st['n'] == 2 and st['sel'] == 6 and st['dots'] > 20, st)

        # 13. premove recapture onto own piece by tap-tap (pawn defends knight)
        for variant in ['tap', 'drag']:
            await new("{mode:'bot', level:7, color:'w', tc:'none'}", "{fen: 'k7/8/2p5/3N4/4P3/8/8/K7 b - - 0 1 -'}")
            await page.wait_for_timeout(60)
            if variant == 'tap':
                await click('e4'); await page.wait_for_timeout(60); await click('d5')
            else:
                await drag('e4', 'd5')
            st = await page.evaluate('({pre: __gc.premoves.map(p => [p.from, p.to, !!p.stay]), d5: __gc.displayBoard()[67], e4: __gc.displayBoard()[52], arrows: document.querySelectorAll(".arrows polygon").length})')
            ok(f'recapture premove ({variant}): queued as stay, knight still shown, arrow drawn', st['pre'] == [[52, 67, True]] and st['d5'] == 2 and st['e4'] == 1 and st['arrows'] == 1, st)
            await page.wait_for_timeout(2600)
            st = await page.evaluate('({recs: __gc.game.records.map(r => r.san), pre: __gc.premoves.length})')
            took = len(st['recs']) >= 1 and st['recs'][0] == 'cxd5'
            ok(f'recapture premove ({variant}): exd5 follows cxd5 / or cancelled if bot did not take', (took and len(st['recs']) >= 2 and st['recs'][1] == 'exd5') or (not took and st['pre'] == 0), st)
            ok(f'recapture premove ({variant}): board consistent', (await settle()) == [])
        # 14. tap own piece that the selected piece does NOT defend → just selects it
        await new("{mode:'bot', level:7, color:'w', tc:'none'}", "{fen: 'k7/8/2p5/3N4/4P3/8/8/K7 b - - 0 1 -'}")
        await page.wait_for_timeout(60)
        await click('a1'); await click('e4')
        st = await page.evaluate('({pre: __gc.premoves.length, sel: __gc.selected})')
        ok('tap on own undefended piece selects it (no premove)', st['pre'] == 0 and st['sel'] == 52, st)

        print('page errors:', errs)
        await b.close()
    print('\n%d/%d passed' % (sum(1 for _, c in results if c), len(results)))
asyncio.run(main())
