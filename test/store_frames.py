# Google Play phone screenshots (9:16, 1080x1920) from the app's own screenshots (test/store_shots.py): the screen,
# scaled down, under a one-line caption of what it shows. Play asks for 16:9 or 9:16; the app's screens are 1:2.
# Run: python3 test/store_frames.py <shots_dir> <lang>   (writes play-<n>.png next to the android-<n>.png shots)
import asyncio, base64, os, sys
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
DIR, LANG = sys.argv[1], sys.argv[2]
FONTS = ROOT + '/vendor/fontsource-%s-5.3.0/package/files/%s'
CAPS = {
    'en': {
        '1-golden': ('One golden move per game', 'Teleport a queen, rook, bishop or knight to any empty square'),
        '2-report': ('A review after every game', 'Accuracy, mistakes and the golden moves you missed'),
        '3-coach': ('The coach shows why', 'Every mistake explained, with the answer that punishes it'),
        '4-best': ('See the best line', 'Golden moves included'),
        '5-bots': ('Eight bots: 600 to 2500', 'Or rated games online'),
        '6-learn': ('Learn it in a minute', 'The rule in pictures, then puzzles'),
    },
    'ru': {
        '1-golden': ('Один золотой ход за партию', 'Ферзь, ладья, слон или конь — на любое пустое поле'),
        '2-report': ('Разбор после каждой партии', 'Точность, ошибки и упущенные золотые ходы'),
        '3-coach': ('Тренер объясняет почему', 'Каждая ошибка — с ответом, который её наказывает'),
        '4-best': ('Лучший вариант', 'С золотыми ходами'),
        '5-bots': ('Восемь ботов: 600–2500', 'Или онлайн-партии на рейтинг'),
        '6-learn': ('Правило за минуту', 'Картинки, потом задачи'),
    },
}

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
    css = font_css()
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await (await br.new_context(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)).new_page()
        for n, (title, sub) in CAPS[LANG].items():
            shot = base64.b64encode(open(f'{DIR}/android-{n}.png', 'rb').read()).decode()
            html = f"""<html><head><style>{css}
              html,body{{margin:0;width:1080px;height:1920px;overflow:hidden;background:#2a2f2d}}
              .bg{{position:absolute;inset:0;background:radial-gradient(ellipse 80% 40% at 50% 0%,rgba(231,180,74,.20),rgba(42,47,45,0) 70%),#2a2f2d}}
              .wrap{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:84px 60px 44px;box-sizing:border-box}}
              .cap{{text-align:center;font-family:Manrope,sans-serif;flex:none}}
              h1{{margin:0;font-weight:800;font-size:60px;line-height:1.1;color:#f4efe4;letter-spacing:-.5px;text-wrap:balance}}
              p{{margin:18px auto 0;max-width:900px;font-weight:600;font-size:34px;line-height:1.3;color:#c9c4b8;text-wrap:balance}}
              .shot{{flex:1;min-height:0;margin-top:44px;display:flex;justify-content:center}}
              img{{height:100%;border-radius:40px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 2px rgba(244,239,228,.08)}}
            </style></head><body><div class="bg"></div><div class="wrap"><div class="cap"><h1>{title}</h1><p>{sub}</p></div>
            <div class="shot"><img src="data:image/png;base64,{shot}"></div></div></body></html>"""
            await pg.set_content(html)
            await pg.evaluate('document.fonts.ready')
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{DIR}/play-{n}.png')
            print(f'play-{n}.png')
        await br.close()

asyncio.run(main())
