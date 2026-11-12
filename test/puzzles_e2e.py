# The Learn tab's coach and puzzles in a browser (phone and desktop): the coach leads a newcomer through the first
# puzzle (his words, the piece ringed); one line says which puzzle, how hard and how many are solved; a wrong Joker
# Move is taken back; a puzzle the player finds gives XP under the board, an answer that was shown gives none; the
# hint rings the piece, then names the idea; "Next" goes on to the next unsolved one; the place survives a reload; a
# moment from a real game says who played; a Black-to-move puzzle is shown from Black's side; the rules wait behind a
# button; nothing overflows.
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
    real = await pg.evaluate('typeof JOKER_REAL !== "undefined" ? JOKER_REAL.length : 0')
    check(tag + ': the engine-made puzzles and the moments from real games follow the three first ones', total == 3 + gen + real and gen >= 1 and real >= 1, [total, gen, real])
    head = await pg.evaluate('[document.querySelector(".try-title").textContent, document.querySelector(".try-count").textContent]')
    check(tag + ': one line says which puzzle, how hard, how many solved', 'Puzzle 1' in head[0] and 'Easy' in head[0] and ('0 of %d' % total) in head[1], head)
    # the coach leads the first puzzle: who he is and what the move is, the piece ringed, nothing else on the screen
    c = await pg.evaluate('''() => ({ face: !!document.querySelector("#tutor .tutor-face svg"), say: document.querySelector("#tutor-say .try-prompt").textContent,
      ring: document.querySelectorAll("#try-board .hl-hint").length, daily: !!document.getElementById("daily-line"), rules: document.getElementById("learn-more").hidden,
      xp: document.getElementById("tutor-xp").textContent })''')
    check(tag + ': the coach says what the Joker Move is and what to do', c['face'] and 'Oskar' in c['say'] and 'Joker Move' in c['say'] and 'rook' in c['say'], c)
    check(tag + ': the piece to move is ringed on the first puzzle', c['ring'] == 1, c)
    check(tag + ': a newcomer sees no daily line yet, and the rules are folded away', not c['daily'] and c['rules'], c)
    check(tag + ': the level is under the board', 'Level 1' in c['xp'], c)
    # puzzle 1: a wrong Joker Move is taken back, and the coach says so for a moment
    await tap(pg, 'b7', 0); await pg.wait_for_timeout(150); await tap(pg, 'e1', 0)
    ok = await wait_for(pg, '/Not this one/.test(document.querySelector(".try-status").textContent)')
    check(tag + ': a wrong Joker Move is refused', ok, await pg.evaluate('document.querySelector(".try-status").textContent'))
    ok = await wait_for(pg, '!document.querySelector(".try-status").textContent && !document.getElementById("tutor-say").classList.contains("answered")', 5000)
    check(tag + ': then the task is back in the bubble', ok)
    await pg.click('#try-answer')
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 9000)
    check(tag + ': "Show answer" solves it and offers the next one', ok)
    head = await pg.evaluate('document.querySelector(".try-count").textContent')
    check(tag + ': counted as solved', ('1 of %d' % total) in head, head)
    xp = await pg.evaluate('[document.querySelector("#tutor-xp .cx-gain").textContent, document.querySelector(".try-status").textContent, JSON.parse(localStorage.getItem("goldenchess.prog") || "{}").xp || 0]')
    check(tag + ': an answer that was shown gives no XP, and the coach says why', xp[0] == '' and 'No XP' in xp[1] and xp[2] == 0, xp)
    # the same puzzle again, found this time: its XP is still there to earn
    await pg.click('#try-again'); await pg.wait_for_timeout(300)
    await tap(pg, 'a7', 0); await pg.wait_for_timeout(150); await tap(pg, 'f1', 0)
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 9000)
    xp = await pg.evaluate('[document.querySelector("#tutor-xp .cx-gain").textContent, JSON.parse(localStorage.getItem("goldenchess.prog") || "{}").xp || 0, document.querySelector(".try-count").textContent]')
    check(tag + ': found by the player: XP under the board (a clean solve of an easy one: 15)', ok and xp[0] == '+15 XP' and xp[1] == 15 and ('1 of %d' % total) in xp[2], xp)
    await pg.click('#try-next'); await pg.wait_for_timeout(300)
    check(tag + ': next: puzzle 2', 'Puzzle 2' in await pg.evaluate('document.querySelector(".try-title").textContent'))
    check(tag + ': no ring on the second puzzle: the lesson by the hand was the first one', 0 == await pg.evaluate('document.querySelectorAll("#try-board .hl-hint").length'))
    # an engine-made one: the task by the kind of moment, the hint rings the piece, then names the idea
    await pg.evaluate('''() => { localStorage.setItem("goldenchess.puzzleAt", GCLearn.PUZZLES[3].id); }''')
    await pg.reload(); await pg.wait_for_timeout(700)
    await pg.evaluate('document.getElementById("try").scrollIntoView({ block: "start" })'); await pg.wait_for_timeout(300)
    t = await pg.evaluate('[document.querySelector(".try-title").textContent, document.querySelector(".try-prompt").textContent]')
    check(tag + ': the place survives a reload (puzzle 4)', 'Puzzle 4' in t[0], t)
    p4 = await pg.evaluate('GCLearn.PUZZLES[3]')
    side = 1 if ' b ' in p4['fen'] else 0
    who = 'Black' if side else 'White'
    want = {'save': (who + ' is in check and in trouble. Block it with a Joker Move.', who + ' to move, and in trouble. Find the Joker Move that saves the game.'),
            'mate': (who + ' to move. Mate in %s, and it starts with a Joker Move.' % p4.get('mate'),)}.get(p4.get('k'), (who + ' to move. Find the Joker Move.',))
    check(tag + ': an engine-made puzzle says whose move it is and what kind of moment', not p4.get('g') and t[1] in want, [t, p4.get('k')])
    await pg.click('#try-hint'); await pg.wait_for_timeout(200)
    ring = await pg.evaluate('[document.querySelectorAll("#try-board .hl-hint").length, document.querySelector(".try-status").textContent]')
    check(tag + ': the hint rings the piece that makes the Joker Move', ring[0] == 1 and 'ringed piece' in ring[1], ring)
    await pg.click('#try-hint'); await pg.wait_for_timeout(200)
    idea = await pg.evaluate('[document.querySelector(".try-status").textContent, document.getElementById("try-hint").disabled]')
    check(tag + ': asked again, the coach names the idea, and that is all the help', len(idea[0]) > 20 and 'ringed' not in idea[0] and idea[1], idea)
    ans = list(p4['accept'].keys())[0]
    await tap(pg, ans[:2], side); await pg.wait_for_timeout(150); await tap(pg, ans[2:4], side)
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 12000)
    check(tag + ': the right Joker Move solves it (from %s\'s side)' % who, ok, await pg.evaluate('document.querySelector(".try-status").textContent'))
    xp = await pg.evaluate('[document.querySelector("#tutor-xp .cx-gain").textContent, JSON.parse(localStorage.getItem("goldenchess.prog") || "{}").xp || 0]')
    check(tag + ': with the hints: the puzzle\'s XP without the clean bonus', xp[0] == '+10 XP' and xp[1] == 25, xp)
    # a moment from a real game: who played, where and when; what was played there; the coach on what changed
    ri = await pg.evaluate('GCLearn.PUZZLES.findIndex(function (p) { return !!p.g; })')
    await pg.evaluate('(i) => localStorage.setItem("goldenchess.puzzleAt", GCLearn.PUZZLES[i].id)', ri)
    await pg.reload(); await pg.wait_for_timeout(700)
    rp = await pg.evaluate('(i) => GCLearn.PUZZLES[i]', ri)
    r = await pg.evaluate('[document.getElementById("try-game").hidden, document.getElementById("try-game").textContent, document.querySelector(".try-prompt").textContent]')
    check(tag + ': a moment from a real game says who played and when', not r[0] and rp['g']['w'] in r[1] and rp['g']['b'] in r[1] and str(rp['g']['y']) in r[1], r)
    check(tag + ': and what was played there', ('In the game' in r[2] or 'The game ended here' in r[2]) and 'Joker Move' in r[2], r)
    rside = 1 if ' b ' in rp['fen'] else 0
    rans = list(rp['accept'].keys())[0]
    await tap(pg, rans[:2], rside); await pg.wait_for_timeout(150); await tap(pg, rans[2:4], rside)
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 12000)
    st = await pg.evaluate('document.querySelector(".try-status").textContent')
    check(tag + ': solved: the coach on what the Joker Move changed', ok and ('History rewritten' in st or 'Stronger than the move' in st), st)
    # a new level is said by the coach and shown on the bar, nothing pops up over the puzzle
    await pg.evaluate('''() => { var g = JSON.parse(localStorage.getItem("goldenchess.prog")); g.xp = 95; localStorage.setItem("goldenchess.prog", JSON.stringify(g));
      localStorage.setItem("goldenchess.puzzleAt", GCLearn.PUZZLES[2].id); }''')
    await pg.reload(); await pg.wait_for_timeout(700)
    p3 = await pg.evaluate('GCLearn.PUZZLES[2]'); a3 = list(p3['accept'].keys())[0]
    await tap(pg, a3[:2], 0); await pg.wait_for_timeout(150); await tap(pg, a3[2:4], 0)
    ok = await wait_for(pg, '!!document.getElementById("try-next")', 15000)
    check(tag + ': three puzzles solved: the daily line is there now', await pg.evaluate('!!document.getElementById("daily-line")'))
    up = await pg.evaluate('[document.querySelector(".try-status").textContent, document.querySelector("#tutor-xp .cx-lv").textContent, !!document.querySelector(".veil"), !!JSON.parse(localStorage.getItem("goldenchess.prog")).up]')
    check(tag + ': a new level: the coach says it, the row shows it, nothing pops up (the celebration waits on the header)', ok and 'New level: 2' in up[0] and 'Level 2' in up[1] and not up[2] and up[3], up)
    # the rules behind their button
    await pg.click('#btn-rules'); await pg.wait_for_timeout(600)
    rl = await pg.evaluate('[document.getElementById("learn-more").hidden, document.querySelectorAll("#learn-more .rule-card").length, document.getElementById("btn-rules").getAttribute("aria-expanded"), !!document.getElementById("learn-play")]')
    check(tag + ': the rules open from their button', not rl[0] and rl[1] == 3 and rl[2] == 'true' and rl[3], rl)
    await pg.evaluate('document.getElementById("view-learn").scrollTo(0, 0)'); await pg.wait_for_timeout(200)
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
