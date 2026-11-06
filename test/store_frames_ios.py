# App Store screenshots from the app's own shots (test/store_shots.py): the screen, scaled down, under a one-line caption — the same
# look as the Google Play set (store_frames.py). iPhone 6.7" 1290x2796 → app/store/appstore/iphone67/0N.png, iPad 12.9" 2048x2732 →
# app/store/appstore/ipad129/0N.png (the sizes App Store Connect takes for the 6.9"/13" slots; asc.py uploads them).
# Run: python3 test/store_frames_ios.py <shots_dir with iphone69-*.png and ipad13-*.png> en
import asyncio, base64, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR, LANG = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'en'
CAPS = {
    'en': {
        '1-golden': ('One Joker Move per game', 'Teleport a queen, rook, bishop or knight to any empty square. Once. When?'),
        '2-report': ('A review after every game', 'Accuracy, mistakes and the Joker Moves you missed'),
        '3-coach': ('The coach shows why', 'Every mistake explained, with the answer that punishes it'),
        '4-best': ('See the best line', 'Joker Moves included'),
        '5-bots': ('Eight bots, 600 to 2500', 'Or rated games online, no sign-up needed'),
        '6-learn': ('Learn it in a minute', 'The rule in pictures, then puzzles'),
    },
    'ru': {
        '1-golden': ('Один джокер за партию', 'Перенесите ферзя, ладью, слона или коня на любое пустое поле. Один раз. Когда?'),
        '2-report': ('Разбор после каждой партии', 'Точность, ошибки и упущенные джокеры'),
        '3-coach': ('Тренер объясняет почему', 'Каждая ошибка — с ответом, который её наказывает'),
        '4-best': ('Лучший вариант', 'С джокерами'),
        '5-bots': ('Восемь ботов: 600–2500', 'Или онлайн на рейтинг — без регистрации'),
        '6-learn': ('Правило за минуту', 'Картинки, потом задачи'),
    },
}
SIZES = {'iphone69': ('iphone67', 1290, 2796, 1.0), 'ipad13': ('ipad129', 2048, 2732, 1.25)}

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for src, (out, W, H, k) in SIZES.items():
            pg = await (await br.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)).new_page()
            for i, (n, (title, sub)) in enumerate(CAPS[LANG].items(), 1):
                shot = base64.b64encode(open(f'{DIR}/{src}-{n}.png', 'rb').read()).decode()
                html = f"""<html><head><style>
                  html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#2a2f2d}}
                  .bg{{position:absolute;inset:0;background:radial-gradient(ellipse 80% 40% at 50% 0%,rgba(108,148,136,.32),rgba(42,47,45,0) 70%),#2a2f2d}}
                  .wrap{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:{int(110*k)}px {int(70*k)}px {int(60*k)}px;box-sizing:border-box}}
                  .cap{{text-align:center;font-family:'Inter Display',Inter,sans-serif;flex:none}}
                  h1{{margin:0;font-weight:800;font-size:{int(74*k)}px;line-height:1.1;color:#f4efe4;letter-spacing:-.5px;text-wrap:balance}}
                  p{{margin:{int(22*k)}px auto 0;max-width:{int(1080*k)}px;font-weight:600;font-size:{int(40*k)}px;line-height:1.3;color:#c9c4b8;text-wrap:balance}}
                  .shot{{flex:1;min-height:0;margin-top:{int(56*k)}px;display:flex;justify-content:center}}
                  img{{height:100%;border-radius:{int(48*k)}px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 2px rgba(244,239,228,.08)}}
                </style></head><body><div class="bg"></div><div class="wrap"><div class="cap"><h1>{title}</h1><p>{sub}</p></div>
                <div class="shot"><img src="data:image/png;base64,{shot}"></div></div></body></html>"""
                await pg.set_content(html); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(150)
                await pg.screenshot(path=f'{ROOT}/app/store/appstore/{out}/{i:02d}.png')
                print(out, i, n)
        await br.close()
asyncio.run(main())
