import asyncio
from playwright.async_api import async_playwright
HELPERS = open('/home/claude/golden-chess/test/helpers.js').read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}); page = await ctx.new_page()
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto('file:///home/claude/golden-chess/dist/preview.html#game'); await page.evaluate(HELPERS); await page.wait_for_timeout(300)
        fails = 0
        for delay in [0, 10, 30, 60, 90, 120, 150, 200]:
            await page.evaluate("__gc.closeDialog(); __gc.settings.autoQueen = true; __gc.startGame({mode:'local', level:1, color:'w', tc:'none'}, {fen:'7k/P7/8/8/8/8/8/K7 w - - 0 1 -'})")
            await page.evaluate("(() => { const g = __gc.game; const m = g.pos.findMove(96, 112, 5, false); __gc.tryMove(96, 112, false); })()")
            await page.wait_for_timeout(400)
            # scrub back and forth across the promotion while animations are running
            for i in range(6):
                await page.evaluate('__gc.gotoPly(0)'); await page.wait_for_timeout(delay)
                await page.evaluate('__gc.gotoPly(1)'); await page.wait_for_timeout(delay)
            await page.evaluate('__gc.gotoPly(0)')
            for _ in range(60):
                r = await page.evaluate('__t.check()')
                if r != 'busy': break
                await page.wait_for_timeout(20)
            bad = await page.evaluate('__mon.bad.length')
            print('delay', delay, 'check', r, 'frame violations so far', bad)
            if r: fails += 1
        print('FAILS', fails)
        await b.close()
asyncio.run(main())
