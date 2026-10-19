# The coach in the game review, on a real game (the 8.Qe2 game from test/fixtures/coach.json):
# why a move is bad (the opponent's answer, a golden move in it), the punishing answer as a red arrow, and the buttons:
# Show follow-up (plays the line, Hide brings the game back), Best (the best move and its line, here with the golden
# R★g1), Retry (find the move yourself: the best one is recognised at once, another one is checked by the engine, Try
# again resets). Phone and computer, English and Russian.
# Run: python3 test/coach_e2e.py        (SHOTS=1 also saves screenshots)
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
HELPERS = open(ROOT + '/test/helpers.js').read()
GAME = json.load(open(ROOT + '/test/fixtures/coach.json'))
SHOTS = os.environ.get('SHOTS')
SHOT_DIR = os.environ.get('SHOT_DIR', ROOT + '/test/shots')
results = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond and extra != '') else '', flush=True)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for vp, tag in (({'width': 390, 'height': 844}, 'phone'), ({'width': 1280, 'height': 860}, 'desktop')):
            ctx = await br.new_context(viewport=vp, has_touch=tag == 'phone', is_mobile=tag == 'phone')
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
            await pg.goto('file://' + ROOT + '/dist/preview.html#play'); await pg.evaluate(HELPERS)

            async def wait_for(js, timeout=6000):
                for _ in range(int(timeout / 50)):
                    try:
                        if await pg.evaluate(js): return True
                    except Exception:
                        pass
                    await pg.wait_for_timeout(50)
                return False
            async def settle():
                for _ in range(200):
                    r = await pg.evaluate('__t.check()')
                    if r != 'busy': return r
                    await pg.wait_for_timeout(25)
                return ['never settled']
            async def shot(name):
                if SHOTS:
                    os.makedirs(SHOT_DIR, exist_ok=True); await pg.wait_for_timeout(300)
                    await pg.screenshot(path=f'{SHOT_DIR}/coach-{tag}-{name}.png')
            coach = '(document.querySelector("#review #coach") || {}).textContent || ""' if tag == 'phone' else '(document.querySelector("#review-side #coach") || {}).textContent || ""'
            host = '#review' if tag == 'phone' else '#review-side'
            async def act(a):
                await pg.click(f'{host} [data-act="{a}"]')

            # the game, move by move on one device, then White resigns
            await pg.evaluate("__gc.closeDialog(); __gc.startGame({ mode: 'local', level: 3, color: 'w', tc: 'none' })")
            await pg.evaluate("""(moves) => { for (const u of moves) { const m = __gc.game.pos.moveFromUci(u); if (u.includes('*')) __gc.setGoldenArmed(true); __gc.tryMove(m & 127, (m >> 7) & 127, false); } }""", GAME['moves'])
            ok(f'{tag}: the game is on the board', await pg.evaluate('__gc.game.records.length') == len(GAME['moves']))
            await pg.click('#btn-menu'); await pg.click('.menu-list button.danger'); await pg.click('.sheetdlg .secondary.danger')
            await wait_for('__gc.game.status === "over"'); await pg.evaluate('__gc.closeDialog()')
            await pg.evaluate('__gc.showReport()')
            ok(f'{tag}: the review finishes', await wait_for('!!__gc.reviewState && !__gc.reviewState.running', 90000))
            await pg.click('#btn-start-review')

            # 8.Qe2 (ply 14): a bad move; the coach names Black's golden answer N★f4 and its target
            await pg.evaluate('__gc.gotoPly(15)')
            await wait_for(f'{coach}.length > 0')
            t = await pg.evaluate(coach)
            mv = await pg.evaluate('(() => { const m = __gc.reviewState.moves[14]; return { cls: m.cls, best: m.bestSan, reply: m.reason && m.reason.reply }; })()')
            ok(f'{tag}: 8.Qe2 is a mistake or a blunder', mv['cls'] in ('mistake', 'blunder'), mv)
            ok(f'{tag}: why: Black answers with the golden move Nb8★f4, attacking the queen', 'golden move Nb8★f4' in t and 'queen' in t, t)
            btns = await pg.evaluate(f'[...document.querySelectorAll("{host} [data-act]")].map(b => b.dataset.act)')
            ok(f'{tag}: Show follow-up, Best and Retry under the coach', btns[:3] == ['follow', 'best', 'retry'], btns)
            arrows = await pg.evaluate('__gc.board.arrowList.map(a => ({ from: GC.sqName(a.from), to: GC.sqName(a.to), threat: !!a.threat, gold: !!a.gold }))')
            ok(f'{tag}: the answer N★f4 drawn on the board (gold, the punishing move)', any(a['from'] == 'b8' and a['to'] == 'f4' and a['threat'] for a in arrows), arrows)
            await shot('1-mistake')

            # Show follow-up: the line plays on the board; Hide brings back the game at 8.Qe2
            await act('follow')
            ok(f'{tag}: follow-up plays the line', await wait_for('__gc.exploreState && __gc.exploreState.line && __gc.exploreState.view === __gc.exploreState.records.length && __gc.exploreState.records.length >= 3', 15000))
            ln = await pg.evaluate('__gc.exploreState.records.map(r => r.san)')
            t = await pg.evaluate(coach)
            ok(f'{tag}: the line starts with Nb8★f4', ln[0] == 'Nb8★f4', ln)
            ok(f'{tag}: the card: Follow-up, the moves, Hide', 'Follow-up' in t and 'Nb8★f4' in t and await pg.evaluate(f'!!document.querySelector("{host} [data-act=hide]")'), t)
            ok(f'{tag}: the board shows the end of the line', (await settle()) == [] and await pg.evaluate('__gc.viewFen() === __gc.exploreState.fens[__gc.exploreState.fens.length - 1]'))
            await shot('2-follow')
            await act('hide')
            ok(f'{tag}: Hide: back to 8.Qe2', await wait_for('!__gc.exploreState && __gc.view === 15'))

            # Best: 8.hxg4 and its line with the golden R★g1 after Qxh1+
            await act('best')
            ok(f'{tag}: Best plays from the position before the move', await wait_for('__gc.exploreState && __gc.exploreState.line && __gc.exploreState.line.kind === "best" && __gc.exploreState.base === 14 && __gc.exploreState.view === __gc.exploreState.records.length', 15000))
            ln = await pg.evaluate('__gc.exploreState.records.map(r => r.san)')
            t = await pg.evaluate(coach)
            ok(f'{tag}: best line hxg4 Qxh1+ Ra1★g1', ln[:3] == ['hxg4', 'Qxh1+', 'Ra1★g1'], ln)
            ok(f'{tag}: the card says the golden Ra1★g1 is the key move', 'Best: hxg4' in t and 'golden Ra1★g1' in t, t)
            await shot('3-best')
            await pg.keyboard.press('Escape')
            ok(f'{tag}: Esc hides the line', await wait_for('!__gc.exploreState && __gc.view === 15'))

            # Retry: the best move is recognised at once
            await act('retry')
            ok(f'{tag}: Retry: the position before 8.Qe2, asking for a better move', await wait_for('__gc.exploreState && __gc.exploreState.retry && __gc.viewFen() === __gc.game.fens[14]'))
            t = await pg.evaluate(coach)
            ok(f'{tag}: "Find a better move for White"', 'Find a better move for White' in t, t)
            await shot('4-retry')
            await pg.evaluate('(() => { const m = new GC.Position(__gc.viewFen()).moveFromUci("h3g4"); __gc.tryMove(m & 127, (m >> 7) & 127, false); })()')
            ok(f'{tag}: hxg4 is the best move', await wait_for('__gc.exploreState && __gc.exploreState.retry.state === "right"'))
            t = await pg.evaluate(coach)
            ok(f'{tag}: the card says so', 'hxg4 is the best move' in t, t)
            await shot('5-right')
            # another try: a weak move is checked by the engine, then Try again resets the position
            await act('hide'); await act('retry')
            await wait_for('__gc.exploreState && __gc.exploreState.retry && __gc.exploreState.retry.state === "ask"')
            await pg.evaluate('(() => { const m = new GC.Position(__gc.viewFen()).moveFromUci("a2a3"); __gc.tryMove(m & 127, (m >> 7) & 127, false); })()')
            ok(f'{tag}: a3 is checked', await wait_for('__gc.exploreState && ["wrong", "good"].includes(__gc.exploreState.retry.state)', 8000), await pg.evaluate('__gc.exploreState && __gc.exploreState.retry'))
            t = await pg.evaluate(coach)
            ok(f'{tag}: a3 isn’t it, with why and Try again / Best / Hide', 'a3' in t and await pg.evaluate(f'[...document.querySelectorAll("{host} [data-act]")].map(b => b.dataset.act).join()') == 'again,best,hide', t)
            await shot('6-wrong')
            await act('again')
            ok(f'{tag}: Try again: the position before the move again', await wait_for('__gc.exploreState && __gc.exploreState.retry.state === "ask" && __gc.exploreState.records.length === 0 && __gc.viewFen() === __gc.game.fens[14]'))
            await act('hide')
            ok(f'{tag}: board consistent at the end', await wait_for('!__gc.exploreState') and (await settle()) == [])

            # Russian
            await pg.evaluate('__gc.settings.lang = "ru"; localStorage.setItem("goldenchess.settings", JSON.stringify(__gc.settings))')
            await pg.reload(); await pg.evaluate(HELPERS)
            await pg.evaluate('__gc.closeDialog(); __gc.go("game"); __gc.showReport()')
            await wait_for('!!__gc.reviewState && !__gc.reviewState.running', 90000)
            await pg.evaluate('__gc.closeDialog(); __gc.gotoPly(15)')
            await wait_for(f'{coach}.length > 0')
            t = await pg.evaluate(coach)
            ok(f'{tag}: Russian: «Чёрные отвечают золотым ходом Nb8★f4 с нападением на ферзя»', 'Чёрные отвечают золотым ходом Nb8★f4 с нападением на ферзя' in t, t)
            labels = await pg.evaluate(f'[...document.querySelectorAll("{host} [data-act]")].map(b => b.getAttribute("aria-label") + "|" + [...b.querySelectorAll("span")].find(x => getComputedStyle(x).display !== "none").textContent)')
            want = ['Показать продолжение|Показать', 'Лучший ход|Лучший', 'Повторить|Заново'] if tag == 'phone' else ['Показать продолжение|Показать продолжение', 'Лучший ход|Лучший ход', 'Повторить|Повторить']
            ok(f'{tag}: Russian buttons (short ones on the phone)', labels[:3] == want, labels)
            await shot('7-ru')
            await pg.evaluate('__gc.settings.lang = "en"; localStorage.setItem("goldenchess.settings", JSON.stringify(__gc.settings))')
            ok(f'{tag}: no console errors', not errs, errs[:3])
            await ctx.close()
        await br.close()
    failed = [n for n, c in results if not c]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
