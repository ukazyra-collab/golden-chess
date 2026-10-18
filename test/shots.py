import asyncio, glob, os
from playwright.async_api import async_playwright
URL = 'file:///home/claude/golden-chess/dist/preview.html#game'
HELPERS = open('/home/claude/golden-chess/test/helpers.js').read()
FD = glob.glob('/home/claude/golden-chess/vendor/fontsource-*/package/files')
def font_css():
    css = ''
    for fam, slug, style, ws in [('Bodoni Moda', 'bodoni-moda', 'italic', [600, 700]), ('Manrope', 'manrope', 'normal', [500, 600, 700, 800])]:
        for w in ws:
            for sub, rng in [('latin', 'U+0000-00FF,U+2000-206F,U+2190-21FF,U+2605'), ('cyrillic', 'U+0400-04FF')]:
                fn = f'{slug}-{sub}-{w}-{style}.woff2'
                css += f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{w};src:url(https://fonts.gstatic.com/local/{fn}) format('woff2');unicode-range:{rng}}}\n"
    return css
async def serve_font(route):
    fn = route.request.url.split('/local/')[1]
    for d in FD:
        pth = os.path.join(d, fn)
        if os.path.exists(pth):
            return await route.fulfill(status=200, body=open(pth, 'rb').read(), content_type='font/woff2')
    await route.fulfill(status=404, body='')
async def setup(ctx):
    page = await ctx.new_page()
    await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body=font_css(), content_type='text/css'))
    await page.route('**/fonts.gstatic.com/local/**', serve_font)
    return page
MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4', 'c3d4', 'c5b4', 'b1c3', 'f6e4', 'e1g1', 'b4c3', 'b2c3', 'c6a5*']
async def scene(page, lang='en', armed=False):
    await page.evaluate(f"localStorage.clear(); __gc.settings.lang='{lang}'; localStorage.setItem('goldenchess.settings', JSON.stringify(__gc.settings));")
    await page.evaluate(HELPERS)
    await page.evaluate("__gc.closeDialog(); __gc.startGame({mode:'bot', level:5, color:'w', tc:'5+0'})")
    await page.evaluate("""(mv) => { const g = __gc.game; const t = performance.now(); g.clock = null; for (const u of mv) { const m = g.pos.moveFromUci(u); g.play(m, t); } g.clock = {t:[251400, 236100], since: performance.now()}; g.records.forEach(r => r.clock = g.clock.t.slice()); __gc.gotoPly(g.records.length - 1); __gc.gotoPly(g.records.length); }""", MOVES)
    await page.wait_for_timeout(900)
    if armed:
        await page.evaluate("__gc.onGoldenButton()")
        pt = await page.evaluate("__t.sqCenter(2)")  # c1 bishop
        await page.mouse.click(pt[0], pt[1])
        await page.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # phone
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
        page = await setup(ctx); await page.goto(URL); await page.wait_for_timeout(500)
        await scene(page, armed=True); await page.screenshot(path='test/shots/v_phone_golden.png')
        await page.evaluate("__gc.setGoldenArmed(false)"); await page.click('#btn-back'); await page.wait_for_timeout(300)
        await page.screenshot(path='test/shots/v_phone_new.png')  # the Play tab, with the game to continue
        await page.click('#btn-resume'); await page.wait_for_timeout(200)
        await page.click('#btn-rules'); await page.wait_for_timeout(200)
        await page.screenshot(path='test/shots/v_phone_rules.png')
        await page.evaluate("__gc.closeDialog(); __gc.game.end('1-0','checkmate'); 0"); await page.wait_for_timeout(100)
        await page.evaluate("document.querySelectorAll('.veil').forEach(v => v.remove())")
        # trigger game over dialog through the normal path
        await page.evaluate("__gc.startGame({mode:'bot', level:5, color:'w', tc:'5+0'}, {fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1 g'})"); await page.wait_for_timeout(300)
        await page.evaluate("__gc.tryMove(4, 116, false)"); await page.wait_for_timeout(900)
        await page.screenshot(path='test/shots/v_phone_over.png')
        await ctx.close()
        # small phone, Russian
        ctx = await b.new_context(viewport={'width': 320, 'height': 568}, device_scale_factor=2, has_touch=True)
        page = await setup(ctx); await page.goto(URL); await page.wait_for_timeout(400)
        await scene(page, lang='ru'); await page.reload(); await page.wait_for_timeout(700)
        await page.screenshot(path='test/shots/v_small_ru.png')
        sw = await page.evaluate('document.documentElement.scrollWidth'); print('small scrollWidth', sw)
        await ctx.close()
        # desktop
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        page = await setup(ctx); await page.goto(URL); await page.wait_for_timeout(400)
        await scene(page); await page.screenshot(path='test/shots/v_desktop.png')
        await ctx.close()
        await b.close()
asyncio.run(main())
