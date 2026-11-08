# The link-preview image (og.png, 1200x630): what a messenger shows when someone shares a joker-chess.com link.
# A poster in the brand: the wordmark, one line of what it is, a gold "Play now", and a corner of the board where a
# knight has just made its Joker Move (a gold arc from where it was), with the Joker himself standing by.
# Run: python3 test/og_image.py   -> dist/web/og.png (build.js copies the root og.png; this writes both)
import asyncio, base64, json, os, shutil, subprocess
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = '/tmp/node_modules/@fontsource'


def font(pkg, file):
    path = f'{FONTS}/{pkg}/files/{file}'
    if not os.path.exists(path):
        subprocess.run(['npm', 'i', '--prefix', '/tmp', f'@fontsource/{pkg}'], check=True, capture_output=True)
    return 'data:font/woff2;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def data_svg(svg):
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()


BOARD_CSS = '''.sq { position: relative; } .sq img { position: absolute; inset: 4%; width: 92%; }
.sq .to { position: absolute; inset: 0; background: rgba(240, 185, 65, .55); }
.sq .from { position: absolute; inset: 0; background: rgba(240, 185, 65, .28); }
.arc { position: absolute; inset: 0; width: 100%; height: 100%; }'''


def board(sq):
    """A 4x4 corner of the board: a knight has just made its Joker Move (gold arc from the square it left)."""
    pieces = json.load(open(f'{ROOT}/build/pieces.json'))
    L, D = '#e2dccb', '#5d7a74'
    # a 4x4 corner of the board: (file, rank) -> piece; the knight jumped from b1 to d3 with its Joker Move
    place = {(0, 0): 'bR', (2, 0): 'bK', (0, 1): 'bP', (3, 2): 'bP', (0, 3): 'wQ', (3, 1): 'wN', (2, 3): 'wP'}
    cells = []
    for r in range(4):
        for f in range(4):
            col = L if (r + f) % 2 == 0 else D
            mark = ''
            if (f, r) == (3, 1): mark = '<i class="to"></i>'
            if (f, r) == (0, 2): mark = '<i class="from"></i>'
            img = f'<img src="{data_svg(pieces[place[(f, r)]])}">' if (f, r) in place else ''
            cells.append(f'<div class="sq" style="background:{col}">{mark}{img}</div>')
    # the Joker Move's arc, from the empty square it left to where the knight stands
    x0, y0, x1, y1, u = 0.5 * sq, 2.5 * sq, 3.5 * sq, 1.5 * sq, sq / 104
    arc = (f'<svg class="arc" viewBox="0 0 {4 * sq} {4 * sq}"><path d="M{x0} {y0} Q {(x0 + x1) / 2 - 0.2 * sq} {y1 - 0.9 * sq} {x1 - 26 * u} {y1 - 34 * u}" '
           f'fill="none" stroke="#f0b941" stroke-width="{6 * u}" stroke-linecap="round" stroke-dasharray="{2 * u} {14 * u}"/>'
           + ''.join(f'<circle cx="{x1 + dx * u}" cy="{y1 + dy * u}" r="{r * u}" fill="#ffd98a"/>' for dx, dy, r in [(34, -62, 5), (-46, -70, 3.5), (50, -8, 3), (10, -84, 2.6)])
           + '</svg>')
    return ''.join(cells), arc


def page():
    pieces = json.load(open(f'{ROOT}/build/pieces.json'))
    wordmark = open(f'{ROOT}/app/resources/wordmark.svg').read()
    joker = open(f'{ROOT}/app/resources/piece.svg').read()
    sq = 104
    cells, arc = board(sq)
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Lilita; src: url({font('lilita-one', 'lilita-one-latin-400-normal.woff2')}); }}
@font-face {{ font-family: Fredoka; font-weight: 600; src: url({font('fredoka', 'fredoka-latin-600-normal.woff2')}); }}
@font-face {{ font-family: Fredoka; font-weight: 500; src: url({font('fredoka', 'fredoka-latin-500-normal.woff2')}); }}
html, body {{ margin: 0; }}
.og {{ width: 1200px; height: 630px; position: relative; overflow: hidden; color: #f4efe3;
  background: radial-gradient(520px 420px at 900px 330px, rgba(240, 185, 65, .16), rgba(240, 185, 65, 0) 70%), #262b29; }}
.left {{ position: absolute; left: 78px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }}
.wm {{ width: 520px; }} .wm svg {{ width: 100%; height: auto; display: block; }}
.tag {{ font: 600 48px/1.08 Fredoka; letter-spacing: -.01em; }}
.sub {{ font: 500 25px/1.35 Fredoka; color: #b9c4bf; max-width: 470px; }}
.cta {{ display: flex; align-items: center; gap: 22px; margin-top: 12px; }}
.btn {{ font: 400 34px/1 Lilita; color: #2a1c03; background: #f0b941; padding: 20px 40px 22px; border-radius: 999px;
  box-shadow: 0 6px 0 #c98a1e, 0 16px 36px rgba(0, 0, 0, .35); }}
.url {{ font: 500 22px Fredoka; color: #8fa29a; }}
.board {{ position: absolute; left: 700px; top: 92px; width: {4 * sq}px; height: {4 * sq}px; display: grid; grid-template-columns: repeat(4, {sq}px);
  border-radius: 22px; overflow: hidden; transform: rotate(-7deg); box-shadow: 0 30px 70px rgba(0, 0, 0, .5); }}
.sq {{ position: relative; }} .sq img {{ position: absolute; inset: 4px; width: calc(100% - 8px); }}
.sq .to {{ position: absolute; inset: 0; background: rgba(240, 185, 65, .55); }}
.sq .from {{ position: absolute; inset: 0; background: rgba(240, 185, 65, .28); }}
.arc {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.joker {{ position: absolute; left: 1012px; top: 392px; width: 168px; filter: drop-shadow(0 18px 30px rgba(0, 0, 0, .5)); }}
.joker svg {{ width: 100%; height: auto; display: block; }}
</style></head><body><div class="og">
<div class="left">
  <div class="wm">{wordmark}</div>
  <div class="tag">Chess with a twist.</div>
  <div class="sub">One Joker Move per game: teleport a piece to any empty square.</div>
  <div class="cta"><span class="btn">Play now</span></div>
</div>
<div class="board">{''.join(cells)}{arc}</div>
<div class="joker">{joker}</div>
</div></body></html>'''


async def main():
    html = '/tmp/og.html'
    open(html, 'w').write(page())
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)).new_page()
        await pg.goto('file://' + html)
        await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(400)
        out = f'{ROOT}/og.png'
        await pg.screenshot(path=out)
        await b.close()
    os.makedirs(f'{ROOT}/dist/web', exist_ok=True)
    shutil.copy(out, f'{ROOT}/dist/web/og.png')
    print('wrote', out)

if __name__ == '__main__':
    asyncio.run(main())
