# The game layer on the account and the rank badge next to a name, through the local test server.
# A guest's level, stars and solved puzzles go to the account when the session opens; signing in on another device
# brings them back (merged with what that device has: nothing earned is lost); what is earned afterwards is sent a
# few seconds later. The XP on the profile is the rank badge an opponent sees in the game and on the player's page;
# the player's own badge is next to their name in a game against a bot too. With the server's progress switched off
# (GC_PROG=off, as in production today) everything stays on the device and nothing breaks.
# Run: python3 test/progress_e2e.py
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8797
BASE = f'http://127.0.0.1:{PORT}/'
HELPERS = open(ROOT + '/test/helpers.js').read()
results = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond and extra != '') else '', flush=True)

def admin(op, **kw):
    req = urllib.request.Request(BASE + 'admin', data=json.dumps(dict(op=op, **kw)).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def last_code(email):
    msgs = admin('outbox', to=email)
    return msgs[-1] if msgs else None

def start_server(prog='on'):
    env = dict(os.environ, MOCK_LATENCY='40', GC_PROG=prog)
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1).read(); return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('server did not start')

LEVEL9 = None  # XP for level 9 (a knight), read from the page

async def main():
    global LEVEL9
    errs = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        async def open_page(ctx, name, store=None):
            pg = await ctx.new_page()
            errs.setdefault(name, [])
            pg.on('pageerror', lambda e: errs[name].append(str(e)))
            pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
            if store:
                await pg.add_init_script('(function () { if (localStorage.getItem("goldenchess.seeded")) return; var s = %s; for (var k in s) localStorage.setItem("goldenchess." + k, JSON.stringify(s[k])); localStorage.setItem("goldenchess.seeded", "1"); })()' % json.dumps(store))
            await pg.goto(BASE); await pg.evaluate(HELPERS)
            return pg
        async def wait_for(pg, js, timeout=6000, step=50):
            t0 = time.time()
            while time.time() - t0 < timeout / 1000:
                try:
                    if await pg.evaluate(js): return True
                except Exception:
                    pass
                await pg.wait_for_timeout(step)
            return False
        async def sign_in(pg, email, name=None):
            await pg.evaluate('__gc.closeDialog(); __gc.go("signin")')
            await wait_for(pg, '!!document.getElementById("acct-email")', 3000)
            await pg.wait_for_timeout(1100)
            await pg.fill('#acct-email', email); await pg.click('#btn-send-code')
            if not await wait_for(pg, '!!document.getElementById("acct-code")', 5000): return False
            await pg.fill('#acct-code', last_code(email)['code'])
            if name:
                if not await wait_for(pg, '!!document.getElementById("acct-name")', 5000): return False
                await pg.fill('#acct-name', name); await pg.click('#btn-name')
                return await wait_for(pg, '__gc.me && __gc.me.profile && __gc.me.profile.username === %s' % json.dumps(name), 5000)
            # an existing account: the page reloads into it
            done = await wait_for(pg, '!!window.__gc && !!__gc.me && __gc.me.email === %s' % json.dumps(email.lower()), 9000)
            await pg.evaluate(HELPERS)
            return done
        async def pair(A, B):
            for pg in (A, B):
                await pg.evaluate('__gc.closeDialog(); __gc.go("play")')
                await wait_for(pg, '!!document.getElementById("btn-start")')
                await pg.click('#btn-start'); await pg.wait_for_timeout(150)
            a = await wait_for(A, '__gc.online && __gc.game.cfg.mode === "online" && __gc.game.status === "playing"', 9000)
            b = await wait_for(B, '__gc.online && __gc.game.cfg.mode === "online" && __gc.game.status === "playing"', 9000)
            return a and b

        # ================= the server keeps the progress
        srv = start_server('on')
        try:
            # ---- 1. a player who has played on this device only: level 9 (a knight), stars, a puzzle, two days
            ctxA = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            probe = await open_page(ctxA, 'probe')
            LEVEL9 = await probe.evaluate('Progress.xpAt(9) + 30'); knight = await probe.evaluate('Progress.rankOf(9).key')
            await probe.close(); await ctxA.close()
            seedA = {'prog': {'xp': LEVEL9, 'career': {'1': 7, '2': 3}, 'cards': {'knight': 2, 'fork': 1}, 'q': None, 'firstWin': '', 'equip': {}, 'seen': {'lv': 9, 'stars': 5}, 'up': None, 'reviewed': []},
                     'puzzles': {'i1': 1, 'i2': 2}, 'days': ['2026-11-10', '2026-11-11'], 'stats': {'L1': {'w': 3, 'd': 0, 'l': 1}}}
            ctxA = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            A = await open_page(ctxA, 'A', seedA)
            ok('the rank at level 9 is a knight', knight == 'knight', knight)
            await A.evaluate('window.__gcFastBot = true; __gc.startGame({ mode: "bot", level: 1, bot: "pip", color: "w", tc: "none" })')
            await wait_for(A, '__gc.curView === "game"')
            bar = await A.evaluate('(function () { var b = document.querySelector("#bar-bot .pname .rank-mini"), t = document.querySelector("#bar-top .pname .rank-mini"); return [b ? b.getAttribute("aria-label") : null, !!(b && b.querySelector(".rank-badge.mini.rk-knight")), !!t]; })()')
            ok('a game against a bot: the player\'s own badge next to the name, none on the bot', bar[0] and 'Level 9' in bar[0] and 'Knight' in bar[0] and bar[1] and not bar[2], bar)
            await A.screenshot(path=ROOT + '/test/shots/progress-bar-bot.png')
            ok('nothing sent anywhere yet: no session', await A.evaluate('!__gc.me') and all((x.get('xp') or 0) == 0 for x in admin('profiles')))
            # ---- 2. going online opens a session (a guest): the progress goes to the account, the XP to the profile
            await A.evaluate('__gc.go("play")'); await wait_for(A, '!!document.getElementById("btn-start")')
            await A.click('#btn-start')
            ok('a guest session', await wait_for(A, '__gc.me && __gc.me.guest === true && __gc.me.prog === true', 6000))
            await A.click('#btn-cancel-lobby')
            uidA = await A.evaluate('__gc.me.uid')
            ok('the XP is on the profile', await wait_for(A, 'true', 100) and await wait_for(A, '__gc.me.profile.xp === %d' % LEVEL9, 6000) and [x for x in admin('profiles') if x['id'] == uidA][0].get('xp') == LEVEL9, [x for x in admin('profiles') if x['id'] == uidA])
            ok('signing in keeps it (the same player, now with an email)', await sign_in(A, 'anna@example.com', 'Anna') and await A.evaluate('__gc.me.uid') == uidA and await A.evaluate('__gc.prog.xp') == LEVEL9)
            # ---- 3. another device, with a little progress of its own, signs in to the same account
            seedB = {'prog': {'xp': 40, 'career': {'2': 7, '3': 1}, 'cards': {'pin': 1}, 'q': None, 'firstWin': '', 'equip': {}, 'seen': {'lv': 1, 'stars': 0}, 'up': None, 'reviewed': []},
                     'puzzles': {'i3': 1}, 'days': ['2026-11-12'], 'stats': {}}
            ctxB = await br.new_context(viewport={'width': 1280, 'height': 860})
            B = await open_page(ctxB, 'B', seedB)
            admin('shift', ms=61000)  # past the one-code-a-minute limit for this address
            ok('the other device signs in', await sign_in(B, 'anna@example.com') and await B.evaluate('__gc.me.uid') == uidA)
            ok('the account\'s progress is here, merged with this device\'s', await wait_for(B, '__gc.prog.xp === %d && __gc.prog.career[1] === 7 && __gc.prog.career[2] === 7 && __gc.prog.career[3] === 1 && __gc.prog.cards.knight === 2 && __gc.prog.cards.pin === 1' % LEVEL9, 8000), await B.evaluate('JSON.stringify(__gc.prog)'))
            st = await B.evaluate('[JSON.parse(localStorage.getItem("goldenchess.puzzles")), JSON.parse(localStorage.getItem("goldenchess.days")), JSON.parse(localStorage.getItem("goldenchess.stats"))]')
            ok('the puzzles, the days, the bots\' scores too', st[0] == {'i1': 1, 'i2': 2, 'i3': 1} and st[1] == ['2026-11-10', '2026-11-11', '2026-11-12'] and st[2].get('L1', {}).get('w') == 3, st)
            ok('no celebration of levels earned elsewhere', await B.evaluate('!__gc.prog.up && !__gc.dialogOpen'))
            await B.evaluate('__gc.go("profile")'); await wait_for(B, '!!document.getElementById("status-card")')
            sc = await B.evaluate('document.getElementById("status-card").innerText')
            ok('the Profile shows the status', 'Knight' in sc and 'Level 9' in sc, sc)
            await B.evaluate('__gc.go("learn")'); await wait_for(B, '!!document.querySelector(".try-count")')
            if await B.evaluate('!!document.getElementById("try-series")'): await B.click('#try-series')  # a returning player lands on the daily puzzle first
            await B.wait_for_timeout(200)
            ok('the Learn tab counts the puzzles of both devices', '3 of' in await B.evaluate('document.querySelector(".try-count").textContent'), await B.evaluate('document.querySelector(".try-count").textContent'))
            # the merged progress went back to the account, and reaches the first device the next time it opens
            ok('the account has the merged progress', await wait_for(B, 'true', 300) and await wait_for(A, 'true', 300))
            await A.reload(); await A.evaluate(HELPERS)
            ok('the first device has the other one\'s stars after a reload', await wait_for(A, '__gc.me && __gc.prog.career[3] === 1 && __gc.prog.career[2] === 7 && __gc.prog.cards.pin === 1', 9000), await A.evaluate('JSON.stringify(__gc.prog.career)'))
            # ---- 4. what is earned afterwards is sent by itself, a few seconds later
            pz = await B.evaluate('(function () { var t = document.querySelector(".try-title").firstChild.textContent; return GCLearn.PUZZLES[parseInt(t.replace(/\\D+/g, ""), 10) - 1]; })()')
            ok('the Learn tab went on to the first puzzle nobody has solved', pz['id'] not in ('i1', 'i2', 'i3'), pz['id'])
            await B.evaluate('document.getElementById("try").scrollIntoView({ block: "start" })'); await B.wait_for_timeout(200)
            a2 = list(pz['accept'].keys())[0]; side = 1 if ' b ' in pz['fen'] else 0
            box = await B.locator('#try-board .board').bounding_box(); s8 = box['width'] / 8
            for sqn in (a2[:2], a2[2:4]):
                f = 'abcdefgh'.index(sqn[0]); rk = int(sqn[1]) - 1
                sx, sy = (f, 7 - rk) if side == 0 else (7 - f, rk)
                await B.mouse.click(box['x'] + (sx + .5) * s8, box['y'] + (sy + .5) * s8); await B.wait_for_timeout(150)
            ok('a puzzle found on the second device', await wait_for(B, '!!document.getElementById("try-next")', 12000), await B.evaluate('[document.querySelector(".try-title").textContent, document.querySelector(".try-status").textContent]'))
            xpB = await B.evaluate('__gc.prog.xp')
            ok('its XP is on the profile a few seconds later', xpB > LEVEL9 and await wait_for(B, '__gc.me.profile.xp === %d' % xpB, 9000) and [x for x in admin('profiles') if x['id'] == uidA][0].get('xp') == xpB, [xpB, [x for x in admin('profiles') if x['id'] == uidA][0].get('xp')])
            # ---- 5. an opponent sees the badge: in the game, on the result card, on the player's page
            ctxC = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            C = await open_page(ctxC, 'C')
            ok('paired with a newcomer', await pair(B, C))
            topC = await wait_for(C, '(function () { var t = document.querySelector("#bar-top .pname .rank-mini"); return !!t && /Knight/.test(t.getAttribute("aria-label")); })()', 6000)
            ok('the newcomer sees the opponent\'s rank next to the name', topC, await C.evaluate('document.querySelector("#bar-top .pname").innerHTML'))
            mine = await C.evaluate('(function () { var b = document.querySelector("#bar-bot .pname .rank-mini"); return b ? b.getAttribute("aria-label") : null; })()')
            ok('and their own: a pawn at level 1', mine and 'Level 1' in mine and 'Pawn' in mine, mine)
            ok('the player with the rank sees none on a newcomer who has earned nothing yet', await B.evaluate('!document.querySelector("#bar-top .pname .rank-mini") && !!document.querySelector("#bar-bot .pname .rank-mini .rk-knight")'))
            await C.screenshot(path=ROOT + '/test/shots/progress-bar-online.png')
            await C.click('#btn-menu'); await C.click('.menu-list button.danger'); await C.click('.sheetdlg .secondary.danger')
            ok('the game is over', await wait_for(C, '__gc.game.status === "over" && __gc.dialogKind === "over"', 6000))
            fo = await C.evaluate('[...document.querySelectorAll(".faceoff .fo-name")].map(function (e) { var m = e.querySelector(".rank-mini"); return e.textContent + "|" + (m ? m.getAttribute("aria-label") : ""); })')
            ok('the result card: both names with their ranks', len(fo) == 2 and any('Anna' in x and 'Knight' in x for x in fo) and any('Pawn' in x for x in fo), fo)
            await C.screenshot(path=ROOT + '/test/shots/progress-over-online.png')
            await C.evaluate('__gc.closeDialog()')
            await C.click('#bar-top'); 
            ok('the opponent\'s page shows the status', await wait_for(C, '__gc.curView === "player" && /Knight/.test((document.getElementById("pl-rank") || {}).textContent || "")', 6000), await C.evaluate('(document.getElementById("pl-rank") || {}).textContent'))
            await C.screenshot(path=ROOT + '/test/shots/progress-player.png')
            for n in ('A', 'B', 'C'): ok('no errors on ' + n, not errs.get(n), errs.get(n, [])[:4])
            await ctxA.close(); await ctxB.close(); await ctxC.close()
        finally:
            srv.terminate(); srv.wait()

        # ================= the server does not keep it (production today): the device does, and nothing breaks
        srv = start_server('off')
        try:
            ctxD = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            D = await open_page(ctxD, 'D', {'prog': {'xp': LEVEL9, 'career': {'1': 7}, 'cards': {}, 'q': None, 'firstWin': '', 'equip': {}, 'seen': {'lv': 9, 'stars': 3}, 'up': None, 'reviewed': []}})
            await D.click('#btn-start')
            ok('off: a session without the progress on the account', await wait_for(D, '__gc.me && __gc.me.prog === false', 6000))
            await D.click('#btn-cancel-lobby'); await D.wait_for_timeout(600)
            ok('off: nothing went to the server, the device keeps its own', all((x.get('xp') or 0) == 0 for x in admin('profiles')) and await D.evaluate('__gc.prog.xp') == LEVEL9)
            ctxE = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            E = await open_page(ctxE, 'E')
            ok('off: two players still meet', await pair(D, E))
            ok('off: the player\'s own badge is there, the opponent\'s is simply absent', await D.evaluate('!!document.querySelector("#bar-bot .pname .rank-mini .rk-knight") && !document.querySelector("#bar-top .pname .rank-mini")'))
            for n in ('D', 'E'): ok('no errors on ' + n, not errs.get(n), errs.get(n, [])[:4])
        finally:
            srv.terminate(); srv.wait()
        await br.close()
    bad = [n for n, c in results if not c]
    print('\n%d passed, %d failed' % (len(results) - len(bad), len(bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
