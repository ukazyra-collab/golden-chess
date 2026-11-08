# Google Play phone screenshots (9:16, 1080x1920) from the app's own screenshots (test/store_shots.py): the screen,
# scaled down, under a one-line caption of what it shows. Play asks for 16:9 or 9:16; the app's screens are 1:2.
# Run: python3 test/store_frames.py <shots_dir> <lang>   (writes play-<n>.png next to the android-<n>.png shots)
import asyncio, base64, os, sys
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
DIR, LANG = sys.argv[1], sys.argv[2]
FONTS = ROOT + '/vendor/fontsource-%s-5.3.0/package/files/%s'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store_poster
CAPS = store_poster.CAPS

def font_css():
    faces = []
    for w in (600, 800):
        for sub in ('latin', 'cyrillic'):
            fn = FONTS % ('manrope', f'manrope-{sub}-{w}-normal.woff2')
            if os.path.exists(fn):
                b64 = base64.b64encode(open(fn, 'rb').read()).decode()
                faces.append(f"@font-face{{font-family:'Manrope';font-weight:{w};src:url(data:font/woff2;base64,{b64}) format('woff2');}}")
    return '\n'.join(faces)

async def main():
    css = store_poster.fonts()
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await (await br.new_context(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)).new_page()
        # the poster first: what the game feels like, before the screens show how it works
        await pg.set_content(store_poster.hero(1080, 1920, 1.0, css, LANG)); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{DIR}/play-0-hero.png'); print('play-0-hero.png')
        for i, (n, (title, sub)) in enumerate(CAPS[LANG].items(), 1):
            shot = base64.b64encode(open(f'{DIR}/android-{n}.png', 'rb').read()).decode()
            html = store_poster.page(title, sub, f'{DIR}/android-{n}.png', 1080, 1920, 1.0, css, i)
            await pg.set_content(html)
            await pg.evaluate('document.fonts.ready')
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{DIR}/play-{n}.png')
            print(f'play-{n}.png')
        await br.close()

asyncio.run(main())
