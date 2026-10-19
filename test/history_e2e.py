# Game history and the review report, through the local test server.
# Two players sign in and play two rated games (one each way); the Profile lists them, "All games" shows the score
# between the two and each game; a row opens the game with its review (accuracy, move classes, missed golden moves),
# and the list then shows the accuracy. A game against the bot is kept on the device, opens from the list too, and
# looking at it doesn't replace an unfinished game on the device. Russian. Phone and computer.
# Run: python3 test/history_e2e.py        (SHOTS=1 also saves screenshots)
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8793
BASE = f'http://127.0.0.1:{PORT}/'
HELPERS = open(ROOT + '/test/helpers.js').read()
SHOTS = os.environ.get('SHOTS')
SHOT_DIR = os.environ.get('SHOT_DIR', ROOT + '/test/shots')
results = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond and extra != '') else '', flush=True)

def admin(op, **kw):
    req = urllib.request.Request(BASE + 'admin', data=json.dumps(dict(op=op, **kw)).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def start_server():
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1).read(); return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('server did not start')

async def main():
    srv = start_server()
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            errs = {}
            async def open_page(ctx, name):
                pg = await ctx.new_page(); errs.setdefault(name, [])
                pg.on('pageerror', lambda e: errs[name].append(str(e)))
                pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
                await pg.goto(BASE); await pg.evaluate(HELPERS)
                return pg
            async def wait_for(pg, js, timeout=6000):
                t0 = time.time()
                while time.time() - t0 < timeout / 1000:
                    try:
                        if await pg.evaluate(js): return True
                    except Exception:
                        pass
                    await pg.wait_for_timeout(50)
                return False
            async def shot(pg, name):
                if SHOTS:
                    os.makedirs(SHOT_DIR, exist_ok=True); await pg.wait_for_timeout(250)
                    await pg.screenshot(path=f'{SHOT_DIR}/hist-{name}.png')
            async def sign_in(pg, email, name):
                await pg.evaluate('__gc.go("signin")')
                await wait_for(pg, '!!document.getElementById("acct-email")')
                await pg.fill('#acct-email', email); await pg.click('#btn-send-code')
                await wait_for(pg, '!!document.getElementById("acct-code")', 5000)
                msgs = [m for m in admin('outbox', to=email)]
                await pg.fill('#acct-code', msgs[-1]['code'])
                await wait_for(pg, '!!document.getElementById("acct-name")', 5000)
                await pg.fill('#acct-name', name); await pg.click('#btn-name')
                return await wait_for(pg, '__gc.me && __gc.me.profile && __gc.me.profile.username === %s' % json.dumps(name), 5000)
            async def click_sq(pg, sq):
                pt = await pg.evaluate(f'__t.sqCenter({sq})'); await pg.mouse.click(*pt)
            def sq(n): return 'abcdefgh'.index(n[0]) + (int(n[1]) - 1) * 16
            async def play(pg, other, a, z):
                n = await pg.evaluate('__gc.game.records.length')
                await click_sq(pg, sq(a)); await pg.wait_for_timeout(60); await click_sq(pg, sq(z))
                await wait_for(other, f'__gc.game.records.length === {n + 1} && !__gc.online.pending', 5000)
                await wait_for(pg, f'__gc.game.records.length === {n + 1} && !__gc.online.pending', 5000)
            async def pair(A, B):
                for pg in (A, B):
                    await pg.evaluate('__gc.closeDialog(); __gc.go("play")')
                    await wait_for(pg, '!!document.getElementById("btn-start")')
                    await pg.click('#btn-start'); await pg.wait_for_timeout(150)
                a = await wait_for(A, '__gc.online && __gc.game.status === "playing"', 8000)
                b = await wait_for(B, '__gc.online && __gc.game.status === "playing"', 8000)
                return a and b
            async def resign(pg):
                await pg.evaluate('__gc.closeDialog()')
                await pg.click('#btn-menu'); await pg.click('.menu-list button.danger'); await pg.click('.sheetdlg .secondary.danger')

            A = await open_page(await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True), 'A')
            B = await open_page(await br.new_context(viewport={'width': 1280, 'height': 860}), 'B')
            ok('A signs in', await sign_in(A, 'anna@example.com', 'Anna'))
            ok('B signs in', await sign_in(B, 'boris@example.com', 'Boris'))

            # two rated games; the loser resigns after a few moves (golden move in the second)
            for k in range(2):
                ok(f'game {k + 1}: paired', await pair(A, B))
                W, Bl = (A, B) if await A.evaluate('__gc.online.color') == 0 else (B, A)
                await play(W, Bl, 'e2', 'e4'); await play(Bl, W, 'e7', 'e5'); await play(W, Bl, 'g1', 'f3'); await play(Bl, W, 'b8', 'c6')
                if k == 1:
                    # White's golden move: the bishop from f1 to c4 (an empty square, no check)
                    await W.evaluate('__gc.setGoldenArmed(true)'); await click_sq(W, sq('f1')); await W.wait_for_timeout(60); await click_sq(W, sq('c4'))
                    await wait_for(Bl, '__gc.game.records.length === 5', 5000)
                    ok('game 2: the golden move went through', await W.evaluate('__gc.game.records[4].golden'))
                await resign(B if k == 0 else A)  # Boris loses the first, Anna the second
                ok(f'game {k + 1}: over', await wait_for(A, '__gc.game.status === "over"', 6000) and await wait_for(B, '__gc.game.status === "over"', 6000))
            await A.evaluate('__gc.closeDialog()'); await B.evaluate('__gc.closeDialog()')

            # ---- Profile: the last games; All games: the score with Boris and both games
            await A.evaluate('__gc.go("profile")')
            ok('profile lists the games', await wait_for(A, 'document.querySelectorAll("#profile-games .gh-row").length === 2', 6000),
               await A.evaluate('document.querySelectorAll("#profile-games .gh-row").length'))
            rows = await A.evaluate('[...document.querySelectorAll("#profile-games .gh-row")].map(r => r.textContent)')
            ok('rows name the opponent and the rating change', all('Boris' in r for r in rows) and any('+' in r or '−' in r for r in rows), rows)
            await shot(A, '1-profile')
            await A.click('#btn-all-games')
            ok('all games: the games page', await wait_for(A, '__gc.curView === "games" && document.querySelectorAll("#gh-list .gh-row").length === 2'))
            chips = await A.evaluate('[...document.querySelectorAll("#gh-chips .gh-chip")].map(c => c.textContent)')
            ok('score against Boris: 1:1', any('Boris' in c and '1:1' in c for c in chips), chips)
            await A.click('#gh-chips .gh-chip:nth-child(2)')
            sc = await A.evaluate('(document.getElementById("gh-score") || {}).textContent || ""')
            ok('head to head: You 1 : 1 Boris', '1 : 1' in sc and 'Boris' in sc, sc)
            golds = await A.evaluate('document.querySelectorAll("#gh-list .gh-gold").length')
            await shot(A, '2-games')
            # A's golden move in game 2 (if A was White there) shows on that row
            a_white_g2 = await A.evaluate('(() => { const g = __gc.game; return g.records[4] && g.records[4].golden && g.cfg.human === 0; })()')
            ok('a golden move is marked on the row', golds == (1 if a_white_g2 else 0), golds)

            # ---- a row opens the game and its review; afterwards the row shows the accuracy
            await A.click('#gh-list .gh-row:last-child')
            ok('the game opens on the board', await wait_for(A, '__gc.curView === "game" && __gc.game.status === "over"', 6000))
            ok('with its report', await wait_for(A, '__gc.dialogKind === "report"', 3000))
            ok('the review finishes', await wait_for(A, '!!__gc.reviewState && !__gc.reviewState.running', 60000))
            rep = await A.evaluate('(() => { const c = document.querySelector(".sheetdlg.report"); return c ? { acc: [...c.querySelectorAll(".acc-box")].map(x => x.textContent), cls: c.querySelectorAll(".rp-cls").length, start: !!c.querySelector("#btn-start-review"), gold: !!c.querySelector("#rp-missed") } : null; })()')
            ok('report: accuracy for both, move classes, missed golden block, start button', rep and len(rep['acc']) == 2 and all(x != '—' for x in rep['acc']) and rep['cls'] >= 9 and rep['start'] and rep['gold'], rep)
            await shot(A, '3-report')
            await A.click('#btn-start-review')
            ok('start review: move 1 with the coach', await wait_for(A, '!__gc.dialogOpen && __gc.view === 1 && !!document.getElementById("coach")', 3000))
            await shot(A, '4-coach')
            await A.click('#btn-back')
            ok('back from the game returns to the games list', await wait_for(A, '__gc.curView === "games"', 3000))
            acc = await A.evaluate('[...document.querySelectorAll("#gh-list .gh-acc")].map(x => x.textContent)')
            ok('the reviewed game shows its accuracy in the list', len(acc) == 1, acc)
            # the same game again: the review is kept, it opens at once
            await A.click('#gh-list .gh-row:last-child')
            ok('a reviewed game opens with its review at once', await wait_for(A, '__gc.dialogKind === "report" && !!__gc.reviewState && !__gc.reviewState.running', 2500))
            await A.evaluate('__gc.closeDialog()')

            # ---- bot games are kept on the device, and looking at one leaves an unfinished game alone
            await A.evaluate("__gc.closeDialog(); __gc.startGame({ mode: 'bot', level: 3, color: 'w', tc: 'none' })")
            await wait_for(A, '__gc.game.pos.side === 0 && !__gc.botBusy', 5000)
            await click_sq(A, sq('e2')); await A.wait_for_timeout(60); await click_sq(A, sq('e4'))
            await wait_for(A, '__gc.game.records.length === 2', 6000)
            await click_sq(A, sq('g1')); await A.wait_for_timeout(60); await click_sq(A, sq('f3'))
            await wait_for(A, '__gc.game.records.length === 4', 6000)
            await A.click('#btn-menu'); await A.click('.menu-list button.danger'); await A.click('.sheetdlg .secondary.danger')
            ok('bot game over', await wait_for(A, '__gc.game.status === "over"', 3000))
            await A.evaluate('__gc.closeDialog()')
            n_local = await A.evaluate('JSON.parse(localStorage.getItem("goldenchess.history") || "[]").length')
            ok('the finished bot game is kept on the device', n_local == 1, n_local)
            # an unfinished bot game, then the past one from the list, then back: the unfinished one is still there
            await A.evaluate("__gc.startGame({ mode: 'bot', level: 4, color: 'w', tc: 'none' })")
            await wait_for(A, '__gc.game.pos.side === 0 && !__gc.botBusy', 5000)
            await click_sq(A, sq('d2')); await A.wait_for_timeout(60); await click_sq(A, sq('d4'))
            await wait_for(A, '__gc.game.records.length === 2', 6000)
            await A.evaluate('__gc.go("profile")')
            await wait_for(A, '!!document.getElementById("btn-all-games")', 4000)
            await A.click('#btn-all-games')
            ok('all games again: the filter is off, the bot game on top', await wait_for(A, 'document.querySelectorAll("#gh-list .gh-row").length === 3 && document.querySelector("#gh-list .gh-row").dataset.key.startsWith("l:")', 4000),
               await A.evaluate('[...document.querySelectorAll("#gh-list .gh-row")].map(r => r.dataset.key + " " + r.textContent)'))
            await A.click('#gh-list .gh-row:first-child')
            ok('the past bot game opens (over, 4 moves)', await wait_for(A, '__gc.curView === "game" && __gc.game.status === "over" && __gc.game.records.length === 4', 4000))
            await A.evaluate('__gc.closeDialog()')
            await A.click('#btn-back')
            await wait_for(A, '__gc.curView === "games"', 3000)
            st = await A.evaluate('({ n: __gc.game.records.length, status: __gc.game.status, level: __gc.game.cfg.level })')
            ok('back: the unfinished game is the current game again', st == {'n': 2, 'status': 'playing', 'level': 4}, st)
            saved = await A.evaluate('JSON.parse(localStorage.getItem("goldenchess.game")).moves.length')
            ok('the saved game was never replaced by the past one', saved == 2, saved)

            # ---- the computer: Boris's games, the report of the game with the golden move, the review
            await B.evaluate('__gc.go("profile")')
            await wait_for(B, 'document.querySelectorAll("#profile-games .gh-row").length === 2', 6000)
            await B.click('#btn-all-games')
            ok('computer: the games page', await wait_for(B, '__gc.curView === "games" && document.querySelectorAll("#gh-list .gh-row").length === 2'))
            await shot(B, '6-games-desktop')
            await B.click('#gh-list .gh-row:first-child')
            ok('computer: the report', await wait_for(B, '__gc.dialogKind === "report" && !!__gc.reviewState && !__gc.reviewState.running', 60000))
            gold_row = await B.evaluate('(() => { const r = document.querySelector(".sheetdlg.report .rp-gold-move, .sheetdlg.report [data-golden]"); return r ? r.textContent : ""; })()')
            await shot(B, '7-report-desktop')
            await B.click('#btn-start-review')
            ok('computer: the review with the coach', await wait_for(B, '!__gc.dialogOpen && !!document.getElementById("coach")', 3000))
            await shot(B, '8-review-desktop')

            # ---- a long history: 60 older games with Boris; the score counts all of them, the list pages through them
            src = [g for g in admin('games') if g['status'] == 'over' and g['moves'] and len(g['moves']) >= 4][0]
            anna = await A.evaluate('__gc.me.uid')
            a_white = src['white_id'] == anna
            res60 = []
            for i in range(60):
                r = 'A' if i < 31 else 'D' if i < 35 else 'B'
                res60.append('1/2-1/2' if r == 'D' else ('1-0' if (r == 'A') == a_white else '0-1'))
            admin('addgames', **{'from': src['id'], 'results': res60})
            await A.evaluate('__gc.historyStale(); __gc.go("play")')  # as if a while had passed
            await A.evaluate('__gc.go("profile")')
            await wait_for(A, '!!document.getElementById("btn-all-games")', 4000)
            await A.click('#btn-all-games')
            ok('long history: the first page of games', await wait_for(A, 'document.querySelectorAll("#gh-list .gh-row").length === 51 && !!document.getElementById("btn-more-games")', 6000),
               await A.evaluate('document.querySelectorAll("#gh-list .gh-row").length'))
            chips = await A.evaluate('[...document.querySelectorAll("#gh-chips .gh-chip")].map(c => c.textContent)')
            ok('long history: the score with Boris counts every game (32:26)', any('Boris' in c and '32:26' in c for c in chips), chips)
            await A.click('#gh-chips .gh-chip:nth-child(2)')
            sc = await A.evaluate('(document.getElementById("gh-score") || {}).textContent || ""')
            ok('long history: score card 32 : 26, 4 draws, 62 games', '32 : 26' in sc and '4' in sc and '62' in sc, sc)
            await shot(A, '9-long-score')
            ok('long history: Boris\'s games, first page', await wait_for(A, 'document.querySelectorAll("#gh-list .gh-row").length === 50 && !!document.getElementById("btn-more-games")', 6000),
               await A.evaluate('document.querySelectorAll("#gh-list .gh-row").length'))
            await A.evaluate('document.getElementById("btn-more-games").scrollIntoView()')
            await shot(A, '9-long-more')
            await A.click('#btn-more-games')
            ok('long history: all 62 games with Boris after "Show more"', await wait_for(A, 'document.querySelectorAll("#gh-list .gh-row").length === 62 && !document.getElementById("btn-more-games")', 6000),
               await A.evaluate('document.querySelectorAll("#gh-list .gh-row").length'))
            await A.click('#gh-list .gh-row:last-child')
            ok('long history: the oldest game opens with its report', await wait_for(A, '__gc.curView === "game" && __gc.dialogKind === "report"', 6000))
            await A.evaluate('__gc.closeDialog()')
            await A.click('#btn-back')
            ok('long history: back to Boris\'s games', await wait_for(A, '__gc.curView === "games" && document.querySelectorAll("#gh-list .gh-row").length >= 50', 4000))

            # ---- Russian
            await A.evaluate('__gc.settings.lang = "ru"; localStorage.setItem("goldenchess.settings", JSON.stringify(__gc.settings))')
            await A.reload(); await A.evaluate(HELPERS)
            await A.evaluate('__gc.go("games")')
            ok('Russian: Партии', await wait_for(A, '/Партии/.test(document.querySelector("#view-games h1").textContent)', 5000))
            await shot(A, '5-ru')

            for nm in errs:
                ok(f'no console errors ({nm})', not errs[nm], errs[nm][:3])
            await br.close()
    finally:
        srv.terminate()
    failed = [n for n, c in results if not c]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
