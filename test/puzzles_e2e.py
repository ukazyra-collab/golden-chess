# The Learn tab's puzzles in a browser (phone and desktop): one line says which puzzle, how hard and how many are
# solved; a wrong Joker Move is taken back; the hint rings the piece; "Show answer" solves it and "Next" goes on to the
# next unsolved one; the place survives a reload; a Black-to-move puzzle is shown from Black's side; nothing overflows.
# Run: python3 test/puzzles_e2e.py
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
URL = 'file://' + ROOT + '/dist/preview.html#learn'
results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok))); print(('ok   ' if ok else 'FAIL ') + name, extra if not ok else '', flush=True)

async def wait_for(pg, js, timeout=5000):
    t = 0
    while t < timeout:
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(50); t += 50
    return False


async def tap(pg, name, orient):
    box = await pg.locator('#try-board .board').bounding_box()
    f = 'abcdefgh'.index(name[0]); rk = int(name[1]) - 1
    sx, sy = (f, 7 - rk) if orient == 0 else (7 - f, rk)
    s = box['width'] / 8
    await pg.mouse.click(box['x'] + (sx + .5) * s, box['y'] + (sy + .5) * s)

async def run(br, viewport, mobile, tag):
    ctx = await br.new_context(viewport=viewport, has_touch=mobile, is_mobile=mobile)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    await pg.goto(URL); await pg.wait_for_timeout(700)
    await pg.evaluate('document.getElementById("try").scrollIntoView({ block: "start" })'); await pg.wait_for_timeout(400)
    total = await pg.evaluate('GCLearn.PUZZLES.length')
    gen = await pg.evaluate('typeof JOKER_PUZZLES !== "undefined" ? JOKER_PUZZLES.length : 0')
    check(tag + ': the engine-made puzzles follow the three first ones', total == 3 + gen and gen >= 1, [total, gen])
    head = await pg.evaluate('[document.querySelector(".try-title").textContent, document.querySelector(".try-count").textContent]')
    check(tag + ': one line says which puzzle, how hard, how many solved', 'Puzzle 1' in head[0] and 'Easy' in head[0] and ('0 of %d' % total) in head[1], head)
    # puzzle 1: a wrong Joker Move is taken back
    await tap(pg, 'b7', 0); await pg.wait_for_timeout(150); await tap(pg, 'e1', 0)
    ok = await wait_for(pg, '/Not this one/.test(document.querySelector(".try-status").textContent)')
    check(tag + ': a wrong Joker Move is refused', ok, await pg.evaluate('document.querySelector(".try-status").textContent'))
    await pg.wait_for_timeout(1500)
    await pg.click('#try-answer')
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 9000)
    check(tag + ': "Show answer" solves it and offers the next one', ok)
    head = await pg.evaluate('document.querySelector(".try-count").textContent')
    check(tag + ': counted as solved', ('1 of %d' % total) in head, head)
    await pg.click('#try-next'); await pg.wait_for_timeout(300)
    check(tag + ': next: puzzle 2', 'Puzzle 2' in await pg.evaluate('document.querySelector(".try-title").textContent'))
    # an engine-made one: the generic prompt, the hint rings the piece
    await pg.evaluate('''() => { localStorage.setItem("goldenchess.puzzleAt", GCLearn.PUZZLES[3].id); }''')
    await pg.reload(); await pg.wait_for_timeout(700)
    await pg.evaluate('document.getElementById("try").scrollIntoView({ block: "start" })'); await pg.wait_for_timeout(300)
    t = await pg.evaluate('[document.querySelector(".try-title").textContent, document.querySelector(".try-prompt").textContent]')
    check(tag + ': the place survives a reload (puzzle 4)', 'Puzzle 4' in t[0], t)
    check(tag + ': an engine-made puzzle only says whose move it is', t[1] in ('White to move. Find the Joker Move.', 'Black to move. Find the Joker Move.'), t)
    side = 1 if t[1].startswith('Black') else 0
    await pg.click('#try-hint'); await pg.wait_for_timeout(200)
    ring = await pg.evaluate('document.querySelectorAll("#try-board .hl-hint").length')
    check(tag + ': the hint rings the piece that makes the Joker Move', ring == 1, ring)
    p4 = await pg.evaluate('GCLearn.PUZZLES[3]')
    ans = list(p4['accept'].keys())[0]
    await tap(pg, ans[:2], side); await pg.wait_for_timeout(150); await tap(pg, ans[2:4], side)
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 12000)
    check(tag + ': the right Joker Move solves it (from %s\'s side)' % ('Black' if side else 'White'), ok, await pg.evaluate('document.querySelector(".try-status").textContent'))
    sw = await pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    check(tag + ': nothing wider than the screen', sw[0] <= sw[1], sw)
    await pg.screenshot(path=os.path.join(ROOT, 'test/shots/puzzles-%s.png' % tag))
    check(tag + ': no console errors', not [e for e in errs if 'Failed to load resource' not in e], errs[:5])
    await ctx.close()

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        await run(br, {'width': 390, 'height': 844}, True, 'phone')
        await run(br, {'width': 1366, 'height': 900}, False, 'desktop')
        await br.close()
    bad = [n for n, ok in results if not ok]
    print('\n%d passed, %d failed' % (len(results) - len(bad), len(bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
