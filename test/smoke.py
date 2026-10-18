import asyncio, json, sys, time
from playwright.async_api import async_playwright
URL = 'file:///home/claude/golden-chess/dist/preview.html#game'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        page = await ctx.new_page()
        errs = []
        page.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto(URL)
        await page.wait_for_timeout(600)
        info = await page.evaluate('''() => ({ status: __gc.game.status, human: __gc.game.cfg.human, level: __gc.game.cfg.level, pieces: document.querySelectorAll('#board .pc').length,
           bs: getComputedStyle(document.getElementById('app')).getPropertyValue('--bs'), wide: document.getElementById('app').classList.contains('wide'),
           scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })''')
        print('state', info)
        await page.screenshot(path='test/shots/m1_start.png')
        # play e2e4 by tapping e2 then e4
        box = await page.locator('#board').bounding_box()
        def sq_center(name, orient=0):
            f = 'abcdefgh'.index(name[0]); r = int(name[1]) - 1
            sx, sy = (f, 7 - r) if orient == 0 else (7 - f, r)
            s = box['width'] / 8
            return box['x'] + (sx + .5) * s, box['y'] + (sy + .5) * s
        x, y = sq_center('e2'); await page.mouse.click(x, y)
        await page.wait_for_timeout(100)
        await page.screenshot(path='test/shots/m2_selected.png')
        x, y = sq_center('e4'); await page.mouse.click(x, y)
        await page.wait_for_timeout(2500)
        info = await page.evaluate('() => ({ moves: __gc.game.records.map(r => r.san), errs: __gc.board.visualCheck() })')
        print('after e4', info)
        await page.screenshot(path='test/shots/m3_after.png')
        print('console:', errs[:10])
        await b.close()
asyncio.run(main())
