# Store screenshots and graphics (Google Play, App Store), made from the app itself (the offline page) with the real
# fonts. Scenes: the golden move armed, the game report with the missed golden moves, the coach on a blunder, the best
# line with a golden move, the bots, the Learn tab. Sizes: Android phone 1080x2160, iPhone 6.9" 1320x2868, iPad 13"
# 2064x2752; plus the Play feature graphic (1024x500) and the 512 px icon.
# Run: python3 test/store_shots.py [out_dir] [lang]
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright
from PIL import Image

ROOT = '/home/claude/golden-chess'
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT + '/store'
LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None  # e.g. android,feature
GAME = json.load(open(ROOT + '/test/fixtures/coach.json'))
FONTS = ROOT + '/vendor/fontsource-%s-5.3.0/package/files/%s'

def font_css():
    faces = []
    for fam, pkg, weights, style in (('Manrope', 'manrope', (500, 600, 700, 800), 'normal'), ('Bodoni Moda', 'bodoni-moda', (600, 700), 'italic')):
        for w in weights:
            for sub in ('latin', 'cyrillic'):
                fn = FONTS % (pkg, f'{pkg}-{sub}-{w}-{style}.woff2')
                if not os.path.exists(fn): continue
                b64 = base64.b64encode(open(fn, 'rb').read()).decode()
                rng = 'U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' if sub == 'cyrillic' else 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+2605,U+2726'
                faces.append(f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{w};src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{rng};}}")
    return '\n'.join(faces)

SIZES = {  # name: (css width, css height, scale) -> pixels
    'android': (400, 800, 2.7),        # 1080 x 2160 (Play: at most 2:1)
    'iphone69': (440, 956, 3),         # 1320 x 2868
    'ipad13': (1032, 1376, 2),         # 2064 x 2752
}

async def main():
    os.makedirs(OUT, exist_ok=True)
    css = font_css()
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for name, (w, h, s) in SIZES.items():
            if ONLY and name not in ONLY: continue
            ctx = await br.new_context(viewport={'width': w, 'height': h}, device_scale_factor=s, has_touch=name != 'ipad13', is_mobile=name != 'ipad13')
            pg = await ctx.new_page()
            await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body=css, content_type='text/css'))
            await pg.add_init_script("localStorage.setItem('goldenchess.settings', JSON.stringify({ lang: %s, sound: false }));" % json.dumps(LANG))
            await pg.goto('file://' + ROOT + '/dist/preview.html#play')
            await pg.evaluate('document.fonts.ready')
            await pg.wait_for_timeout(400)
            async def shot(n):
                await pg.wait_for_timeout(700)
                await pg.screenshot(path=f'{OUT}/{name}-{n}.png')
            async def until(js, t=90000):
                for _ in range(int(t / 100)):
                    if await pg.evaluate(js): return True
                    await pg.wait_for_timeout(100)
                return False

            # 1. the golden move armed: every empty square a teleport target
            await pg.evaluate("__gc.closeDialog(); __gc.startGame({ mode: 'local', level: 3, color: 'w', tc: 'none' })")
            await pg.evaluate("""() => { for (const u of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','b1c3','f8c5']) { const m = __gc.game.pos.moveFromUci(u); __gc.tryMove(m & 127, (m >> 7) & 127, false); } }""")
            await pg.wait_for_timeout(500)
            await pg.evaluate("__gc.setGoldenArmed(true)")
            pt = await pg.evaluate("(() => { const r = document.getElementById('board').getBoundingClientRect(), q = r.width / 8; return [r.left + 3.5 * q, r.top + 7.5 * q]; })()")  # d1, the queen
            await pg.mouse.click(*pt)
            await shot('1-golden')
            await pg.evaluate("__gc.setGoldenArmed(false)")

            # the real game for the review (8.Qe2 allows the golden Nb8★f4)
            await pg.evaluate("__gc.closeDialog(); __gc.startGame({ mode: 'local', level: 3, color: 'w', tc: 'none' })")
            await pg.evaluate("""(moves) => { for (const u of moves) { const m = __gc.game.pos.moveFromUci(u); if (u.includes('*')) __gc.setGoldenArmed(true); __gc.tryMove(m & 127, (m >> 7) & 127, false); } }""", GAME['moves'])
            await pg.evaluate("__gc.game.end('1/2-1/2', 'agreement')")
            await pg.evaluate('__gc.gotoPly(__gc.game.records.length)')
            await pg.evaluate('__gc.showReport()')
            await until('!!__gc.reviewState && !__gc.reviewState.running')
            # 2. the report: the missed golden moves on top
            await shot('2-report')
            await pg.evaluate('__gc.closeDialog(); __gc.gotoPly(15)')
            # 3. the coach on a blunder, the golden answer drawn on the board
            await shot('3-coach')
            host = '#review-side' if name == 'ipad13' and await pg.evaluate("document.getElementById('app').classList.contains('wide')") else '#review'
            await pg.click(f'{host} [data-act="best"]')
            await until('__gc.exploreState && __gc.exploreState.line && __gc.exploreState.view === __gc.exploreState.records.length', 20000)
            # 4. the best line: the golden Ra1★g1 saves White
            await shot('4-best')
            await pg.evaluate('__gc.closeDialog(); __gc.exitExplore(true)')

            # 5. the bots, 6. Learn
            await pg.evaluate('__gc.go("bots")')
            await shot('5-bots')
            await pg.evaluate('__gc.go("learn")')
            await pg.wait_for_timeout(1500)
            await shot('6-learn')
            await ctx.close()

        # the Play feature graphic (1024 x 500) and the icon at 512
        icon64 = base64.b64encode(open(ROOT + '/app/resources/icon.png', 'rb').read()).decode()
        tag = 'Chess with one golden move' if LANG == 'en' else 'Шахматы с одним золотым ходом'
        html = f"""<html><head><style>{css}
          html,body{{margin:0;width:1024px;height:500px;overflow:hidden;background:#2a2f2d}}
          .g{{position:absolute;inset:0;background:radial-gradient(ellipse at 28% 50%,rgba(231,180,74,.22),rgba(42,47,45,0) 60%),#2a2f2d}}
          .sq{{position:absolute;right:-40px;top:-40px;width:520px;height:580px;opacity:.16;
               background:conic-gradient(#f4efe4 25%,transparent 0 50%,#f4efe4 0 75%,transparent 0) 0 0/116px 116px;transform:rotate(-8deg)}}
          img{{position:absolute;left:84px;top:110px;width:280px;height:280px;border-radius:62px;box-shadow:0 24px 60px rgba(0,0,0,.45)}}
          .t{{position:absolute;left:412px;top:150px;color:#f4efe4}}
          h1{{margin:0;font:700 italic 88px/1 'Bodoni Moda',serif;letter-spacing:.5px}} h1 b{{color:#f0b941;font-weight:700}}
          p{{margin:26px 0 0;font:700 32px/1.25 Manrope,sans-serif;color:#d8d3c8;max-width:580px}}
        </style></head><body><div class="g"></div><div class="sq"></div><img src="data:image/png;base64,{icon64}">
        <div class="t"><h1><b>Golden</b> Chess</h1><p>{tag}</p></div></body></html>"""
        pg = await (await br.new_context(viewport={'width': 1024, 'height': 500}, device_scale_factor=1)).new_page()
        await pg.set_content(html); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/feature-graphic.png')
        await br.close()
    Image.open(ROOT + '/app/resources/icon.png').resize((512, 512), Image.LANCZOS).save(f'{OUT}/icon-512.png')
    for f in sorted(os.listdir(OUT)):
        im = Image.open(os.path.join(OUT, f)); print(f, im.size)

asyncio.run(main())
