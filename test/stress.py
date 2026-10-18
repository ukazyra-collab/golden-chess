import asyncio, random, sys, time, json
from playwright.async_api import async_playwright
URL = 'file:///home/claude/golden-chess/dist/preview.html#game'
HELPERS = open('/home/claude/golden-chess/test/helpers.js').read()
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 1
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 6
random.seed(SEED)

async def drag(page, a, b, steps=None):
    x1, y1 = a; x2, y2 = b
    await page.mouse.move(x1, y1); await page.mouse.down()
    n = steps or random.randint(2, 8)
    for i in range(1, n + 1):
        await page.mouse.move(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)
    await page.mouse.up()

async def touch_drag(cdp, a, b, steps=6):
    x1, y1 = a; x2, y2 = b
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x1, 'y': y1}]})
    for i in range(1, steps + 1):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x1 + (x2 - x1) * i / steps, 'y': y1 + (y2 - y1) * i / steps}]})
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

async def tap(page, cdp, pt, touch):
    if touch:
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': pt[0], 'y': pt[1]}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    else:
        await page.mouse.click(pt[0], pt[1])

async def main():
    stats = dict(checks=0, fails=0, moves=0, premoves_set=0, golden_moves=0, golden_premoves=0, nav=0, flips=0, takebacks=0, games=0, results={})
    failures = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True)
        page = await ctx.new_page()
        cdp = await ctx.new_cdp_session(page)
        errs = []
        page.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error',) else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto(URL)
        await page.evaluate(HELPERS)
        await page.wait_for_timeout(300)

        async def verify(label):
            for _ in range(80):
                r = await page.evaluate('__t.check()')
                if r != 'busy': break
                await page.wait_for_timeout(15)
            if r == 'busy':
                return
            stats['checks'] += 1
            if r:
                stats['fails'] += 1
                st = await page.evaluate('__t.state()')
                failures.append((label, r[:4], st))

        async def C(sq):
            return await page.evaluate(f'__t.sqCenter({sq})')

        for gi in range(GAMES):
            tc = random.choice(['1+0', '1+0', '3+2', 'none'])
            color = random.choice(['w', 'b'])
            level = random.choice([1, 1, 2, 3])
            await page.evaluate(f"__gc.closeDialog(); __gc.startGame({{mode:'bot', level:{level}, color:'{color}', tc:'{tc}'}})")
            stats['games'] += 1
            await page.wait_for_timeout(150)
            t_end = time.time() + 40
            while time.time() < t_end:
                st = await page.evaluate('__t.state()')
                if st['status'] != 'playing':
                    break
                touch = random.random() < 0.35
                r = random.random()
                if st['dialog']:
                    await page.evaluate('__gc.closeDialog()')
                my_turn = st['side'] == st['human'] and st['view'] == st['n']
                if r < 0.05:
                    k = random.randint(1, 6)
                    for _ in range(k):
                        await page.keyboard.press('ArrowLeft'); await page.wait_for_timeout(random.randint(0, 30))
                    for _ in range(random.randint(0, k)):
                        await page.keyboard.press('ArrowRight'); await page.wait_for_timeout(random.randint(0, 30))
                    stats['nav'] += 1
                    await verify('after nav')
                    await page.keyboard.press('End')
                elif r < 0.08:
                    await page.keyboard.press('f'); stats['flips'] += 1
                elif r < 0.095 and st['n'] > 2:
                    await page.evaluate('__gc.takeback()'); stats['takebacks'] += 1
                    await verify('after takeback')
                elif my_turn:
                    use_gold = (st['gold'] >> st['human']) & 1 and random.random() < 0.07
                    if use_gold:
                        await page.evaluate('__gc.onGoldenButton()')
                    mv = await page.evaluate(f'__t.randomLegal({str(bool(use_gold)).lower()})')
                    if mv is None:
                        if use_gold: await page.evaluate('__gc.setGoldenArmed(false)')
                        await page.wait_for_timeout(30); continue
                    a, bb = await C(mv[0]), await C(mv[1])
                    if random.random() < 0.65:
                        if touch: await touch_drag(cdp, a, bb)
                        else: await drag(page, a, bb)
                    else:
                        await tap(page, cdp, a, touch); await page.wait_for_timeout(random.randint(0, 60)); await tap(page, cdp, bb, touch)
                    # promotion picker may be open: pick something
                    await page.wait_for_timeout(20)
                    if await page.evaluate('!!document.querySelector(".promo")'):
                        opts = await page.query_selector_all('.promo .opt')
                        if opts:
                            await opts[random.randint(0, len(opts) - 1)].click()
                    stats['moves'] += 1
                    if use_gold: stats['golden_moves'] += 1
                else:
                    rr = random.random()
                    if st['view'] == st['n'] and st['side'] != st['human'] and rr < 0.55:
                        want_gold = (st['gold'] >> st['human']) & 1 and random.random() < 0.08
                        if want_gold: await page.evaluate('__gc.onGoldenButton()')
                        pm = await page.evaluate(f'__t.randomPremove({str(bool(want_gold)).lower()})')
                        if pm:
                            a, bb = await C(pm[0]), await C(pm[1])
                            if touch: await touch_drag(cdp, a, bb)
                            else: await drag(page, a, bb, steps=random.randint(2, 5))
                            stats['premoves_set'] += 1
                            if want_gold: stats['golden_premoves'] += 1
                        elif want_gold:
                            await page.evaluate('__gc.setGoldenArmed(false)')
                    elif rr < 0.62:
                        pt = await C(random.choice([34, 35, 66, 67]))
                        await page.mouse.click(pt[0], pt[1], button='right')
                    else:
                        await page.wait_for_timeout(random.randint(20, 120))
                await page.wait_for_timeout(random.randint(0, 90))
                if random.random() < 0.25:
                    await verify('periodic')
            st = await page.evaluate('__t.state()')
            if st['status'] == 'playing':
                await page.evaluate("__gc.game.end('1/2-1/2','repetition'); 0")
            stats['results'][st.get('reason') or 'cut'] = stats['results'].get(st.get('reason') or 'cut', 0) + 1
            await page.wait_for_timeout(500)
            await verify('game end')
        mon = await page.evaluate('({frames: __mon.frames, bad: __mon.bad.slice(0, 8), nbad: __mon.bad.length})')
        stats['frames_monitored'] = mon['frames']; stats['frame_violations'] = mon['nbad']
        if mon['nbad']: print('FRAME VIOLATIONS', mon['bad'])
        await b.close()
    print(json.dumps(stats))
    for f in failures[:10]: print('FAIL', f)
    print('console errors:', errs[:10])

asyncio.run(main())
