# Two real browsers play each other through the local test server (same game logic as production).
# Covers: sign-in before online play, seek + pairing via the UI, moves by click, premoves, golden move, clocks in sync, draw offer/decline,
# reload mid-game, dropped realtime (polling fallback), flag, rating change, rematch, abort, invite link, spectator.
# Run: python3 test/online_e2e.py
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8791
BASE = f'http://127.0.0.1:{PORT}/'
HELPERS = open(ROOT + '/test/helpers.js').read()
results = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond and extra != '') else '', flush=True)

def admin(op, **kw):
    req = urllib.request.Request(BASE + 'admin', data=json.dumps(dict(op=op, **kw)).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def start_server():
    env = dict(os.environ, MOCK_LATENCY='120')
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1).read(); return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('server did not start')

def sq(name): return 'abcdefgh'.index(name[0]) + (int(name[1]) - 1) * 16

async def main():
    srv = start_server()
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            ctxA = await br.new_context(viewport={'width': 1280, 'height': 860})
            ctxB = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
            errs = {}
            async def open_page(ctx, name, url=BASE):
                pg = await ctx.new_page()
                errs.setdefault(name, [])
                pg.on('pageerror', lambda e: errs[name].append(str(e)))
                pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' else None)
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
                await pg.goto(url); await pg.evaluate(HELPERS)
                return pg
            A = await open_page(ctxA, 'A'); B = await open_page(ctxB, 'B')

            async def wait_for(pg, js, timeout=6000, step=50):
                t0 = time.time()
                while time.time() - t0 < timeout / 1000:
                    try:
                        if await pg.evaluate(js): return True
                    except Exception:
                        pass
                    await pg.wait_for_timeout(step)
                return False
            async def settle(pg):
                for _ in range(120):
                    r = await pg.evaluate('__t.check()')
                    if r != 'busy': return r
                    await pg.wait_for_timeout(25)
                return ['never settled']
            async def click_sq(pg, name):
                pt = await pg.evaluate(f'__t.sqCenter({sq(name)})'); await pg.mouse.click(*pt)
            async def click_move(pg, a, z):
                await click_sq(pg, a); await pg.wait_for_timeout(60); await click_sq(pg, z)
            async def fen(pg): return await pg.evaluate('__gc.game.pos.fen()')
            async def nrec(pg): return await pg.evaluate('__gc.game.records.length')
            async def synced(n, timeout=5000):
                a = await wait_for(A, f'__gc.game.records.length === {n} && !__gc.online.pending', timeout)
                b = await wait_for(B, f'__gc.game.records.length === {n} && !__gc.online.pending', timeout)
                return a and b and (await fen(A)) == (await fen(B))

            async def sign_in(pg, email, name):
                # the sign-in page: email, the code from the outbox, a name for the new account
                ok(f'{name}: sign-in page first', await wait_for(pg, '__gc.curView === "signin" && !!document.getElementById("acct-email")', 5000))
                await pg.fill('#acct-email', email); await pg.click('#btn-send-code')
                await wait_for(pg, '!!document.getElementById("acct-code")', 5000)
                await pg.fill('#acct-code', admin('outbox', to=email)[-1]['code'])
                await wait_for(pg, '!!document.getElementById("acct-name")', 5000)
                await pg.fill('#acct-name', name); await pg.click('#btn-name')

            # ---- 1. both players press Start Game (3+2), sign in, and find each other
            for pg, email, name in ((A, 'alice@example.com', 'Alice'), (B, 'bob@example.com', 'Bob')):
                await wait_for(pg, '!!document.getElementById("btn-start")')
                ok('Play tab offers 3+2', '3+2' in (await pg.text_content('#play-tc')))
                await pg.click('#btn-start')
                await sign_in(pg, email, name)
                ok(f'{name}: the search starts right after signing in', await wait_for(pg, '__gc.dialogKind === "lobby"', 5000))
                await pg.wait_for_timeout(150)
            ok('paired: both pages in the online game', await wait_for(A, '__gc.online && __gc.game.cfg.mode === "online"', 8000) and await wait_for(B, '__gc.online && __gc.game.cfg.mode === "online"', 8000))
            ca, cb = await A.evaluate('__gc.online.color'), await B.evaluate('__gc.online.color')
            ok('opposite colors', {ca, cb} == {0, 1}, (ca, cb))
            same = await A.evaluate('__gc.online.id') == await B.evaluate('__gc.online.id')
            ok('same game id', same)
            W, Bl = (A, B) if ca == 0 else (B, A)
            ok('black sees the board flipped', await Bl.evaluate('__gc.board.orient') == 1 and await W.evaluate('__gc.board.orient') == 0)
            nmB = await B.evaluate('__gc.me.profile.username')
            ok("A's bar shows B's name", nmB in (await A.inner_text('#bar-top')), nmB)
            ok('no dialog left open', not await A.evaluate('__gc.dialogOpen') and not await B.evaluate('__gc.dialogOpen'))
            ok('first-move countdown shown', 'first move' in (await W.inner_text('#ana-side' if W == A else '#ana')).lower() or 'first move' in (await W.inner_text('#ana')).lower())

            # ---- 2. moves by clicking; boards stay in sync
            await click_move(W, 'e2', 'e4'); ok('move 1 synced', await synced(1))
            await click_move(Bl, 'e7', 'e5'); ok('move 2 synced', await synced(2))
            ok('clock running after two moves', await W.evaluate('__gc.game.running()') and await Bl.evaluate('__gc.game.running()'))
            await click_move(W, 'g1', 'f3'); ok('move 3 synced', await synced(3))
            await W.wait_for_timeout(1500)
            ta = await W.evaluate('__gc.game.timeLeft(1, performance.now())'); tb = await Bl.evaluate('__gc.game.timeLeft(1, performance.now())')
            ok('black clock agrees on both screens (±400 ms)', abs(ta - tb) < 400, (ta, tb))
            ok('black clock is running down', 178000 - 400 < ta < 180000 - 1000, ta)
            wcl = await Bl.evaluate('__gc.game.timeLeft(0, performance.now())')
            ok('white clock got the increment back', 180000 < wcl <= 182000 + 200, wcl)

            # ---- 3. premove: black queues Nf6 while white thinks, it fires on white's move
            await click_move(Bl, 'b8', 'c6')
            ok('move 4 synced', await synced(4))
            await click_move(Bl, 'g8', 'f6')  # white to move: this becomes a premove
            pre = await Bl.evaluate('__gc.premoves.length')
            ok('click on the opponent turn queues a premove', pre == 1, pre)
            await click_move(W, 'f1', 'c4')
            ok('premove fired right after the opponent moved', await synced(6))
            last = await A.evaluate('__gc.game.records[5].san')
            ok('premove was Nf6', last == 'Nf6', last)

            # ---- 3b. peer moves: the opponent sees a move before the (slow) server confirms it,
            #          and a premove answering it goes through even if it reaches the server first
            admin('latency', ms=900)
            await Bl.evaluate('''(() => { window.__minRec = 1e9; clearInterval(window.__mt); const n0 = __gc.game.records.length;
                window.__mt = setInterval(() => { const n = __gc.game.records.length; if (n > n0) window.__minRec = Math.min(window.__minRec, n); }, 2); })()''')
            await click_move(Bl, 'f8', 'c5')  # white to move: premove Bc5
            t0 = time.time()
            await click_move(W, 'd2', 'd3')
            seen = await wait_for(Bl, '__gc.game.records.length >= 7', 3000, step=10)
            dt = time.time() - t0
            ok('opponent sees the move at once (peer), not after the 900 ms server round trip', seen and dt < 0.6, round(dt, 3))
            print('     peer delivery took', round(dt, 3), 's (incl. test polling)', flush=True)
            ok('premove answered instantly', await wait_for(Bl, '__gc.game.records.length === 8', 1000, step=10))
            ok('both moves confirmed by the server in order', await synced(8, 8000))
            ok('no rollback flicker while waiting for the server', await Bl.evaluate('window.__minRec') >= 7, await Bl.evaluate('window.__minRec'))
            await Bl.evaluate('clearInterval(window.__mt)')
            admin('latency', ms=0)
            last2 = await A.evaluate('__gc.game.records.slice(6).map(r => r.san).join(" ")')
            ok('server order d3 then Bc5', last2 == 'd3 Bc5', last2)

            # ---- 3c. peer messages lost: the server broadcast still delivers
            admin('droppeer', on=True)
            await click_move(W, 'c2', 'c3')
            ok('move delivered by the server without the peer path', await synced(9, 6000))
            admin('droppeer', on=False)

            # ---- 3d. a forged peer move the server never gets is rolled back
            wuid = await W.evaluate('__gc.me.uid'); gid0 = await W.evaluate('__gc.online.id')
            req = urllib.request.Request(BASE + 'peer', data=json.dumps(dict(topic='m:' + gid0, event='move', payload=dict(ply=9, uci='a7a6'), token=await Bl.evaluate('__gc.me.uid'))).encode(), method='POST')
            urllib.request.urlopen(req, timeout=5).read()
            ok('forged peer move shown first', await wait_for(W, '__gc.game.records.length === 10', 2000))
            ok('then rolled back when the server never confirms it', await wait_for(W, '__gc.game.records.length === 9', 9000))
            req = urllib.request.Request(BASE + 'peer', data=json.dumps(dict(topic='m:' + gid0, event='move', payload=dict(ply=9, uci='a7a6'), token='stranger')).encode(), method='POST')
            try: code = urllib.request.urlopen(req, timeout=5).status
            except urllib.error.HTTPError as e: code = e.code
            ok('a non-player cannot send on the peer topic', code == 403, code)
            r = await settle(W); ok('board consistent after rollback', r == [], r)
            await click_move(Bl, 'a7', 'a6'); ok('game continues normally', await synced(10))

            # ---- 4. golden move online
            gm = await W.evaluate('''(() => { const g = __gc.game, ms = g.legal.filter(m => m & GC.F_GOLDEN); const m = ms.find(m => (m & 127) === 2 /* c1 bishop */) || ms[0];
                __gc.setGoldenArmed(true); return [m & 127, (m >> 7) & 127]; })()''')
            await W.evaluate(f'__gc.tryMove({gm[0]}, {gm[1]}, false)')
            ok('golden move synced', await synced(11))
            gs = await Bl.evaluate('__gc.game.records[10].san')
            ok('opponent sees the golden move', '★' in gs, gs)
            ok('golden right consumed on both', await A.evaluate('__gc.game.pos.goldenAvailable(%d)' % 0) == False and await B.evaluate('__gc.game.pos.goldenAvailable(0)') == False)

            # ---- 5. draw offer, decline
            await W.evaluate('__gc.onlineAction("draw", {op: "offer"})')
            ok('opponent sees the draw offer', await wait_for(Bl, '[...document.querySelectorAll("[data-act=draw-decline]")].some(e => e.offsetParent)', 4000))
            await Bl.locator('[data-act=draw-decline]:visible').first.click()
            ok('offer cleared on both', await wait_for(W, '__gc.online.s.draw_offer === null', 4000) and await wait_for(Bl, '__gc.online.s.draw_offer === null', 4000))

            # ---- 6. reload mid-game resumes
            before = await fen(B)
            await B.reload(); await B.evaluate(HELPERS)
            ok('reload resumes the game', await wait_for(B, '__gc.online && __gc.game.records.length === 11', 8000))
            ok('same position after reload', await fen(B) == before)

            # ---- 7. realtime drops: polling still delivers the move
            admin('drop', on=True)
            await click_move(Bl, 'h7', 'h6')
            ok('move delivered without realtime (polling)', await wait_for(W, '__gc.game.records.length === 12', 16000))
            admin('drop', on=False)
            ok('consistent after polling', await synced(12))

            # ---- 8. flag: white's clock nearly out
            gid = await A.evaluate('__gc.online.id')
            admin('setclock', game=gid, clock_w=1200)
            ok('both see timeout', await wait_for(A, '__gc.game.status === "over" && __gc.game.reason === "timeout"', 6000) and await wait_for(B, '__gc.game.status === "over"', 6000))
            res = await A.evaluate('__gc.game.result')
            ok('black wins on time', res == '0-1', res)
            ok('result dialog shows rating change', await wait_for(Bl, '!!document.querySelector(".rating-change")', 3000))
            diffs = admin('game', game=gid)
            ok('ratings changed by Glicko-2', diffs['white_diff'] < 0 < diffs['black_diff'], (diffs['white_diff'], diffs['black_diff']))
            for nm, pg in (('A', A), ('B', B)):
                r = await settle(pg); ok(f'board consistent ({nm})', r == [], r)

            # ---- 9. rematch: offer + accept, colors swap
            await W.click('.sheetdlg .primary')
            ok('opponent sees Accept rematch', await wait_for(Bl, '[...document.querySelectorAll(".sheetdlg .primary")].some(b => /accept/i.test(b.textContent))', 4000))
            await Bl.click('.sheetdlg .primary')
            ok('both moved to the rematch', await wait_for(A, '__gc.online && __gc.online.id !== "%s" && __gc.game.status === "playing"' % gid, 6000) and await wait_for(B, '__gc.online && __gc.online.id !== "%s"' % gid, 6000))
            ok('colors swapped', await A.evaluate('__gc.online.color') == 1 - ca)

            # ---- 10. abort before two moves, through the menu: the result shows at once, the server confirms
            admin('latency', ms=700)
            await A.click('#btn-menu'); await A.click('.menu-list button.danger'); await A.click('.sheetdlg .secondary.danger')
            ok('abort shown at once (before the slow server answers)', await wait_for(A, '__gc.game.reason === "abort" && __gc.online.resigning', 300, step=10))
            ok('aborted on both, confirmed', await wait_for(A, '__gc.game.reason === "abort" && !__gc.online.resigning && __gc.online.s.status === "aborted"', 5000) and await wait_for(B, '__gc.game.reason === "abort"', 5000))
            admin('latency', ms=0)
            for pg in (A, B): await pg.evaluate('__gc.closeDialog()')

            # ---- 11. invite a friend by link (casual 5+0), from the Play tab
            await A.click('#rail [data-nav=play]'); await wait_for(A, '__gc.curView === "play"')
            await A.click('#play-tc'); await A.click('#tc-5-0')
            ok('time control picked', '5+0' in (await A.text_content('#play-tc')))
            await A.click('#btn-more'); await A.click('#opt-casual')
            await A.click('#btn-friend')
            ok('invite link ready', await wait_for(A, '/[?]join=/.test(document.getElementById("invite-link").value)', 5000))
            link = await A.evaluate('document.getElementById("invite-link").value')
            if os.environ.get('DBG'):
                async def onresp(r):
                    if '/play' in r.url:
                        try: body = await r.text()
                        except Exception: body = '?'
                        print('B resp', r.status, r.request.post_data, body[:300])
                B.on('response', lambda r: asyncio.ensure_future(onresp(r)))
            await B.goto(link); await B.evaluate(HELPERS)
            ok('friend joined from the link', await wait_for(B, '__gc.online && __gc.game.status === "playing"', 8000) and await wait_for(A, '__gc.online && __gc.online.id === "%s"' % link.split('join=')[1], 8000))
            ok('casual game', await A.evaluate('__gc.game.cfg.rated') == False and await A.evaluate('__gc.game.cfg.tc.label') == '5+0')
            ok('url switched to ?game=', 'game=' in B.url and 'join=' not in B.url, B.url)

            # ---- 12. a third person opening the invite link signs in, then watches
            C = await open_page(await br.new_context(viewport={'width': 800, 'height': 900}), 'C', link)
            await sign_in(C, 'carol@example.com', 'Carol')
            ok('spectator sees the game', await wait_for(C, '__gc.online && __gc.online.color === -1', 6000))
            wa = A if await A.evaluate('__gc.online.color') == 0 else B
            await click_move(wa, 'd2', 'd4')
            ok('spectator receives moves', await wait_for(C, '__gc.game.records.length === 1', 5000))
            ok('spectator cannot move', not await C.evaluate('__gc.tryMove(%d, %d, false)' % (sq('d7'), sq('d5'))))
            wb = B if wa is A else A
            await click_move(wb, 'd7', 'd5'); ok('moves continue', await wait_for(C, '__gc.game.records.length === 2', 5000))

            # ---- 13. resign through the menu: instant result, server-confirmed on all three screens
            await wb.click('#btn-menu'); await wb.click('.menu-list button.danger'); await wb.click('.sheetdlg .secondary.danger')
            ok('resignation shown at once', await wait_for(wb, '__gc.game.status === "over" && __gc.game.reason === "resign"', 300, step=10))
            winner = '1-0' if wa == A and await A.evaluate('__gc.online.color') == 0 or wa == B and await B.evaluate('__gc.online.color') == 0 else '0-1'
            ok('winner and spectator see the result', await wait_for(wa, '__gc.game.result === "%s" && __gc.game.reason === "resign"' % winner, 5000) and await wait_for(C, '__gc.game.result === "%s"' % winner, 5000))
            ok('server confirmed it', await wait_for(wb, '!__gc.online.resigning && __gc.online.s.status === "over" && __gc.online.s.reason === "resign"', 5000))
            ok('winner sees "won"', await wait_for(wa, '/won|побед/i.test((document.querySelector(".sheetdlg .dlg-title") || {}).textContent || "")', 3000))

            for nm in errs:
                bad = [e for e in errs[nm] if 'favicon' not in e]
                ok(f'no console errors ({nm})', not bad, bad[:3])
            await br.close()
    finally:
        srv.terminate()
    failed = [n for n, c in results if not c]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
