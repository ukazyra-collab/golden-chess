import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(320, 568), (360, 740), (390, 844), (412, 915), (768, 1024), (1024, 768), (1440, 900)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h})
            page = await ctx.new_page()
            await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
            await page.goto('file:///home/claude/golden-chess/dist/preview.html#game'); await page.wait_for_timeout(300)
            r = await page.evaluate('''() => {
              const rect = id => document.getElementById(id).getBoundingClientRect();
              const brand = document.querySelector('.brand').getBoundingClientRect(), acts = document.querySelector('.top-actions').getBoundingClientRect();
              const t1 = document.getElementById('g-t1');
              const b = rect('board'), ctl = document.querySelector('.ctl').getBoundingClientRect();
              return { overlapTop: brand.right > acts.left + 1, t1Clipped: t1.scrollWidth > t1.clientWidth + 1, hScroll: document.documentElement.scrollWidth > innerWidth,
                       board: Math.round(b.width), ctlBottom: Math.round(ctl.bottom), vh: innerHeight, wide: document.getElementById('app').classList.contains('wide') };
            }''')
            print(w, h, r)
            await ctx.close()
        await b.close()
asyncio.run(main())
