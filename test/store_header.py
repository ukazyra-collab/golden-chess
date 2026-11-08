# The App Store's product page header and search results image: one universal 16:9 PNG, 5244 x 2950, no alpha
# (App Store Connect → Product Page Information → Header, with "Use header asset in search results").
# The same poster as the link preview and the first store frame: charcoal with the Joker's gold light, the wordmark,
# "Chess with a twist.", the board corner where a knight has just made its Joker Move, the Joker standing by.
# Everything that matters sits in the middle (the header is cropped differently on iPhone, iPad and Mac).
# Run: python3 test/store_header.py  -> app/store/appstore/header/header-en.png
import asyncio, os, sys
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import og_image  # noqa: E402
import store_poster  # noqa: E402

ROOT = og_image.ROOT
W, H = 2622, 1475  # CSS pixels, rendered at 2x → 5244 x 2950


def page():
    sq = 196
    cells, arc = og_image.board(sq)
    sparks = ''.join(f'<i class="spark" style="left:{x}px;top:{y}px;width:{r * 2}px;height:{r * 2}px"></i>'
                     for x, y, r in [(560, 330, 12), (1090, 300, 8), (1520, 250, 10), (2120, 1130, 9), (700, 1150, 7), (2010, 330, 6)])
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
{store_poster.fonts()}
html, body {{ margin: 0; background: #262b29; }}
.c {{ width: {W}px; height: {H}px; position: relative; overflow: hidden; color: #f4efe3;
  background: radial-gradient(900px 760px at 1660px 740px, rgba(240, 185, 65, .20), rgba(240, 185, 65, 0) 70%),
              radial-gradient(1400px 900px at 700px 760px, rgba(93, 122, 116, .22), rgba(93, 122, 116, 0) 70%), #262b29; }}
.left {{ position: absolute; left: 470px; top: 0; bottom: 0; width: 900px; display: flex; flex-direction: column; justify-content: center; gap: 40px; }}
.wm {{ width: 860px; }} .wm svg {{ width: 100%; height: auto; display: block; }}
.tag {{ font: 400 104px/1.02 'Lilita One'; letter-spacing: .005em; }}
.sub {{ font: 500 46px/1.32 Fredoka; color: #b9c4bf; max-width: 820px; }}
.board {{ position: absolute; left: 1430px; top: {(H - 4 * sq) // 2 - 20}px; width: {4 * sq}px; height: {4 * sq}px; display: grid;
  grid-template-columns: repeat(4, {sq}px); border-radius: 40px; overflow: hidden; transform: rotate(-7deg);
  box-shadow: 0 60px 130px rgba(0, 0, 0, .55); }}
{og_image.BOARD_CSS}
.joker {{ position: absolute; left: 2020px; top: 830px; width: 300px; filter: drop-shadow(0 34px 54px rgba(0, 0, 0, .55)); }}
.joker svg {{ width: 100%; height: auto; display: block; }}
.spark {{ position: absolute; border-radius: 50%; background: #ffd98a; box-shadow: 0 0 24px 6px rgba(255, 217, 138, .45); }}
</style></head><body><div class="c">
{sparks}
<div class="left">
  <div class="wm">{store_poster.WORDMARK}</div>
  <div class="tag">Chess with a twist.</div>
  <div class="sub">One Joker Move per game: teleport a piece to any empty square.</div>
</div>
<div class="board">{cells}{arc}</div>
<div class="joker">{store_poster.JOKER}</div>
</div></body></html>'''


async def main():
    out_dir = f'{ROOT}/app/store/appstore/header'
    os.makedirs(out_dir, exist_ok=True)
    html = '/tmp/store_header.html'
    open(html, 'w').write(page())
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2)).new_page()
        await pg.goto('file://' + html)
        await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(400)
        raw = '/tmp/store_header.png'
        await pg.screenshot(path=raw)
        await b.close()
    from PIL import Image
    im = Image.open(raw).convert('RGB')  # no alpha channel: App Store Connect refuses transparency
    assert im.size == (5244, 2950), im.size
    out = f'{out_dir}/header-en.png'
    im.save(out, optimize=True)
    im.resize((1311, 738)).save('/tmp/store_header_small.png')
    print('wrote', out, os.path.getsize(out) // 1024, 'KB')

if __name__ == '__main__':
    asyncio.run(main())
