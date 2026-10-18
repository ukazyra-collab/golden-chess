# Renders the link-preview image (dist/web/og.png, 1200x630) from the real app with a golden move on the board.
import asyncio, glob, os
from playwright.async_api import async_playwright
URL = 'file:///home/claude/golden-chess/dist/preview.html'
FD = glob.glob('/home/claude/golden-chess/vendor/fontsource-*/package/files')
def font_css():
    css = ''
    for fam, slug, style, ws in [('Bodoni Moda', 'bodoni-moda', 'italic', [600, 700]), ('Manrope', 'manrope', 'normal', [500, 600, 700, 800])]:
        for w in ws:
            fn = f'{slug}-latin-{w}-{style}.woff2'
            css += f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{w};src:url(https://fonts.gstatic.com/local/{fn}) format('woff2')}}\n"
    return css
async def serve_font(route):
    fn = route.request.url.split('/local/')[1]
    for d in FD:
        pth = os.path.join(d, fn)
        if os.path.exists(pth):
            return await route.fulfill(status=200, body=open(pth, 'rb').read(), content_type='font/woff2')
    await route.fulfill(status=404, body='')
MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4', 'c3d4', 'c5b4', 'b1c3', 'f6e4', 'e1g1', 'b4c3', 'b2c3', 'c6a5*']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        page = await ctx.new_page()
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body=font_css(), content_type='text/css'))
        await page.route('**/fonts.gstatic.com/local/**', serve_font)
        await page.goto(URL)
        await page.evaluate("localStorage.clear(); __gc.settings.lang='en'; __gc.settings.anim='off'; __gc.applySettings();")
        await page.evaluate("__gc.closeDialog(); __gc.startGame({mode:'local', tc:'5+0', color:'w'})")
        for u in MOVES:
            await page.evaluate(f"""(() => {{ const p = __gc.game.pos, m = p.moveFromUci('{u}'); if ('{u}'.endsWith('*')) __gc.setGoldenArmed(true);
                __gc.tryMove(m & 127, (m >> 7) & 127, true); }})()""")
            await page.wait_for_timeout(30)
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(1500)
        await page.evaluate("__gc.closeDialog(); document.getElementById('toast').className = 'toast'")
        await page.wait_for_timeout(500)
        out = '/home/claude/golden-chess/dist/web/og.png'
        await page.screenshot(path=out)
        print('wrote', out)
        await b.close()
if __name__ == '__main__':
    asyncio.run(main())
