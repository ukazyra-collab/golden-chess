# App Store screenshots from the app's own shots (test/store_shots.py): the screen, scaled down, under a one-line caption — the same
# look as the Google Play set (store_frames.py). iPhone 6.7" 1290x2796 → app/store/appstore/iphone67/0N.png, iPad 12.9" 2048x2732 →
# app/store/appstore/ipad129/0N.png (the sizes App Store Connect takes for the 6.9"/13" slots; asc.py uploads them).
# Run: python3 test/store_frames_ios.py <shots_dir with iphone69-*.png and ipad13-*.png> en
import asyncio, base64, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR, LANG = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'en'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store_poster
CAPS = store_poster.CAPS
SIZES = {'iphone69': ('iphone67', 1290, 2796, 1.0), 'ipad13': ('ipad129', 2048, 2732, 1.25)}

async def main():
    css = store_poster.fonts()
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for src, (out, W, H, k) in SIZES.items():
            pg = await (await br.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)).new_page()
            await pg.set_content(store_poster.hero(W, H, k, css, LANG)); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(150)
            await pg.screenshot(path=f'{ROOT}/app/store/appstore/{out}/01.png'); print(out, 1, 'hero')
            for i, (n, (title, sub)) in enumerate(CAPS[LANG].items(), 2):
                html = store_poster.page(title, sub, f'{DIR}/{src}-{n}.png', W, H, k, css, i)
                await pg.set_content(html); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(150)
                await pg.screenshot(path=f'{ROOT}/app/store/appstore/{out}/{i:02d}.png')
                print(out, i, n)
        await br.close()
asyncio.run(main())
