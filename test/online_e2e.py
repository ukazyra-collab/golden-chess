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
    env = dict(os.environ, MOCK_LATENCY='120', MOCK_HOUSE_WAIT='0')
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

            # ---- 1. both players sign in (the chip on the start screen; Play itself needs no account), press Play (3+2) and find each other
            for pg, email, name in ((A, 'alice@example.com', 'Alice'), (B, 'bob@example.com', 'Bob')):
                await wait_for(pg, '!!document.getElementById("btn-start")')
                ok('Play tab offers 3+2', '3+2' in (await pg.text_content('#play-tc')))
                ok(f'{name}: a guest\'s start screen has no sign-up note', not await pg.evaluate('!!document.getElementById("play-meta")'))
                await pg.click('#acct-chip')
                await sign_in(pg, email, name)
                ok(f'{name}: back on Play after signing in', await wait_for(pg, '__gc.curView === "play" && !__gc.dialogOpen', 5000))
                if pg is A:
                    # a picture on the profile: squared and shrunk here, up to storage, shown on the profile and the start screen chip
                    from PIL import Image
                    pic = os.path.join(ROOT, 'test/shots/_avatar.png'); Image.new('RGB', (300, 200), (200, 60, 60)).save(pic)
                    await pg.evaluate('__gc.go("profile")')
                    ok('photo: the profile picture is a button with a camera badge', await wait_for(pg, '!!document.querySelector("#btn-photo .cam") && !!document.getElementById("photo-file")', 5000))
                    await pg.set_input_files('#photo-file', pic)
                    ok('photo: saved and shown on the profile', await wait_for(pg, '!!document.querySelector("#btn-photo .ava.pic img") && __gc.me.profile.avatar_v > 0', 8000))
                    info = await pg.evaluate('fetch(document.querySelector("#btn-photo .ava.pic img").src).then(r => r.blob()).then(b => createImageBitmap(b).then(i => [b.type, i.width, i.height]))')
                    ok('photo: a 256×256 JPEG went up', info == ['image/jpeg', 256, 256], info)
                    await pg.evaluate('__gc.go("play")')
                    ok('photo: on the start screen chip', await wait_for(pg, '!!document.querySelector("#acct-chip .ava.pic img")', 3000))
                await pg.click('#btn-start')
                ok(f'{name}: the search starts', await wait_for(pg, '__gc.dialogKind === "lobby"', 5000))
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
            ok("photo: B sees A's picture on the bar", await wait_for(B, '!!document.querySelector("#bar-top .ava.pic img")', 6000))
            ok("photo: A sees B's initial (no picture)", await A.evaluate('!!document.querySelector("#bar-top .ava:not(.pic) i")'))
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
            ok('result dialog shows rating change', await wait_for(Bl, '!!document.querySelector(".fo-rating .up, .fo-rating .down")', 3000))
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
            await A.click('#btn-back'); await wait_for(A, '__gc.curView === "play"')  # a game has no rail: back to Play
            await A.click('#play-tc'); await A.click('#tc-5-0')
            ok('time control picked', '5+0' in (await A.text_content('#play-tc')))
            await A.click('#play-tc'); await A.click('#set-rated'); await A.evaluate('__gc.closeDialog()')
            ok('casual chosen', await A.evaluate('/casual/i.test(document.getElementById("play-meta").textContent)'), await A.text_content('#play-meta'))
            await A.click('#btn-friend'); await A.click('#btn-invite-link')
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

            # ---- 12. a third person opening the invite link watches at once, as a guest (no sign-in asked)
            C = await open_page(await br.new_context(viewport={'width': 800, 'height': 900}), 'C', link)
            ok('spectator sees the game', await wait_for(C, '__gc.online && __gc.online.color === -1', 8000))
            ok('spectator: a guest, nothing asked', await C.evaluate('__gc.me && __gc.me.guest === true && __gc.curView === "game"'))
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

            # ---- 14. a house player (an account run by the developer) when nobody else is searching: seated at the end of
            #          the search bar, played by this browser's engine; its clock counts its think time; the card says who it is
            hid = admin('addhouse', name='abc256', level=2, target=1340, style={'tempo': 0.5, 'abort': 0, 'leave': 0, 'flag': 0, 'resign': 'never', 'rematch': 1}, games=88)['id']
            ctxD = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
            D = await open_page(ctxD, 'D')
            await D.evaluate('window.__gcFastBot = 1; window.__gcSeekMs = 700')
            await wait_for(D, '!!document.getElementById("btn-start")'); await D.click('#btn-start')
            ok('house: a guest presses Play and the search starts at once, no sign-in', await wait_for(D, '__gc.dialogKind === "lobby" && __gc.me && __gc.me.guest === true', 6000))
            await D.click('#btn-cancel-lobby'); await D.wait_for_timeout(200)
            await D.click('#acct-chip'); await sign_in(D, 'dina@example.com', 'Dina')
            await wait_for(D, '__gc.curView === "play" && !__gc.dialogOpen', 5000); await D.click('#btn-start')
            ok('house: the search shows the running bar and the players around', await wait_for(D, '__gc.dialogKind === "lobby" && !!document.querySelector("#seek-bar.pong") && !!document.querySelector("#lobby-reel .reel-track")', 5000))
            t0 = time.time()
            ok('house: an opponent is found when the bar is full', await wait_for(D, '__gc.online && __gc.game.cfg.mode === "online"', 8000))
            ok('house: found after the search span (~0.7 s), not at once', 0.4 < time.time() - t0 < 4, time.time() - t0)
            st = await D.evaluate('({house: __gc.online.s.house, lvl: __gc.online.s.house_style && __gc.online.s.house_style.level, names: __gc.game.cfg.names, me: __gc.online.color})')
            ok('house: the game is against abc256, played at level 2', st['house'] and st['lvl'] == 2 and 'abc256' in st['names'], st)
            hc = 0 if st['house'] == 'w' else 1
            if hc == 0: ok('house: as white it moves first', await wait_for(D, '__gc.game.records.length === 1 && !__gc.online.housePending', 8000))
            else:
                await click_move(D, 'e2', 'e4'); ok('house: answers the first move', await wait_for(D, '__gc.game.records.length === 2 && !__gc.online.housePending', 8000))
            n0 = await nrec(D)
            # a few more moves: the house replies each time; the server confirms each (records == server moves)
            mv = [('e2', 'e4'), ('d2', 'd4'), ('g1', 'f3'), ('b1', 'c3'), ('c1', 'd2'), ('a2', 'a3'), ('h2', 'h3'), ('e1', 'd1')] if hc == 1 else [('e7', 'e5'), ('d7', 'd6'), ('g8', 'f6'), ('b8', 'c6'), ('c8', 'd7'), ('a7', 'a6'), ('h7', 'h6'), ('e8', 'd8')]
            played = 0
            for a, z in mv[1 if hc == 1 else 0:]:
                if await D.evaluate('__gc.game.status !== "playing"'): break
                before = await nrec(D)
                mine = await D.evaluate('__gc.game.pos.side === __gc.online.color')
                if not mine: break
                okm = await D.evaluate('__gc.tryMove(%d, %d, false)' % (sq(a), sq(z)))
                if not okm: continue
                played += 1
                if not await wait_for(D, '__gc.game.records.length === %d && !__gc.online.pending && !__gc.online.housePending && __gc.online.s.moves.length === %d' % (before + 2, before + 2), 10000): break
            ok('house: the game went on, the house answering every move (server-confirmed)', played >= 3 and await D.evaluate('__gc.online.s.moves.length === __gc.game.records.length'), (played, await D.evaluate('[__gc.game.records.length, __gc.online.s.moves.length, __gc.game.status]')))
            sv = await D.evaluate('({cw: __gc.online.s.clock_w, cb: __gc.online.s.clock_b, n: __gc.online.s.moves.length})')
            hclock = sv['cw'] if hc == 0 else sv['cb']
            ok('house: its clock moved by its (instant) think time plus the increment, never by the wall', 180000 - 2000 <= hclock <= 180000 + 2000 * sv['n'], sv)
            ok('house: the opponent is shown as connected', await D.evaluate('__gc.online.oppHere === true'))
            # the opponent's page: ratings, recent games, and at the bottom the note that the account is run by the developer
            bar = '#bar-top' if hc != await D.evaluate('__gc.board.orient') else '#bar-bot'
            await D.click(bar + ' .pname')
            ok('house: a tap on the opponent opens their page', await wait_for(D, '__gc.curView === "player" && !!document.getElementById("pl-ratings")', 4000))
            ok('house: the page names them, with their blitz rating', await D.evaluate('/abc256/.test(document.querySelector("#view-player .page-h").textContent) && /1340/.test(document.getElementById("pl-ratings").textContent)'), await D.evaluate('document.getElementById("view-player").textContent'))
            ok('house: ... and says at the bottom that the account is run by the developer', await D.evaluate('!!document.getElementById("house-note") && !!(document.getElementById("pl-games").compareDocumentPosition(document.getElementById("house-note")) & Node.DOCUMENT_POSITION_FOLLOWING)'))
            await D.screenshot(path=os.path.join(ROOT, 'test/shots/player-house.png'))
            await D.click('#player-back')
            ok('house: back to the game', await wait_for(D, '__gc.curView === "game" && !!__gc.online', 3000))
            # the human resigns; the house player wants a rematch (style.rematch 1 means it takes one; here it asks itself with p=.25, so we ask)
            await D.click('#btn-menu'); await D.click('.menu-list button.danger'); await D.click('.sheetdlg .secondary.danger')
            ok('house: the human resigned', await wait_for(D, '__gc.online.s.status === "over" && __gc.online.s.reason === "resign"', 6000))
            ok('house: rated, both ratings changed', await wait_for(D, '__gc.online.s.white_diff != null && __gc.online.s.black_diff != null', 6000), await D.evaluate('[__gc.online.s.white_diff, __gc.online.s.black_diff]'))
            hr = [r for r in admin('ratings') if r['user_id'] == hid and r['pool'] == 'blitz'][0]
            ok('house: its rating went up a little and stays close to its target', 1340 < hr['rating'] < 1380 and hr['games'] == 89, hr)
            gid = await D.evaluate('__gc.online.id')
            await D.evaluate('__gc.closeDialog()'); await D.evaluate('__gc.rematch()')
            ok('house: a rematch asked for is taken: a new game, colours swapped', await wait_for(D, '__gc.online && __gc.online.id !== "%s" && __gc.online.s.house === "%s"' % (gid, 'b' if hc == 0 else 'w'), 8000), await D.evaluate('__gc.online && [__gc.online.id, __gc.online.s.house]'))
            ok('house: no console errors (D)', not [e for e in errs['D'] if 'favicon' not in e], errs['D'][:3])

            # ---- 15. the owner's statistics card in Profile (admins only)
            await D.evaluate('__gc.go("profile")')
            ok('stats: no card for an ordinary player', await wait_for(D, '!!document.getElementById("profile-games")', 5000) and not await D.evaluate('!!document.getElementById("stats-card")'))
            admin('addadmin', uid=await D.evaluate('__gc.me.uid'))
            await D.evaluate('__gc.go("play")'); await D.wait_for_timeout(200)
            await D.evaluate('window.__gcStatsRefresh = 1')
            await D.reload(); await D.evaluate(HELPERS); await D.wait_for_timeout(600)
            await D.evaluate('__gc.go("profile")')
            ok('stats: the owner gets the Statistics card', await wait_for(D, '!!document.getElementById("stats-card") && document.querySelectorAll("#stats-card .st-tile").length === 6', 8000))
            tiles = await D.evaluate('[...document.querySelectorAll("#stats-card .st-tile b")].map(b => b.textContent)')
            ok('stats: accounts, games and active players counted (house players left out)', int(tiles[0]) >= 3 and int(tiles[3]) >= 2 and int(tiles[2]) >= 1, tiles)
            ok('stats: a month of bars', await D.evaluate('document.querySelectorAll("#stats-card .st-chart .bar").length') == 31)
            await D.screenshot(path=os.path.join(ROOT, 'test/shots/profile-stats.png'))

            # ---- 16. leaving: away during the opponent's turn is fine (the game waits); on one's own turn 20 s away loses,
            #          with a countdown on the other screen; coming back in time just goes on
            admin('forgetgames')  # A and B have just played: the search would keep them apart for a quarter of an hour
            for pg in (A, B): await pg.evaluate('window.__gcSeekMs = 60000; __gc.startSeek("3+2", true)')
            ok('left: A and B paired again', await wait_for(A, '__gc.online && __gc.game.status === "playing" && __gc.online.s.moves.length === 0', 20000) and await wait_for(B, '__gc.online && __gc.game.status === "playing"', 9000))  # their ratings have drifted apart: the window widens for a few seconds
            W, Bl = (A, B) if await A.evaluate('__gc.online.color') == 0 else (B, A)
            ok('left: both devices are heard from (seen rows)', await wait_for(W, '__gc.online.seenTimer > 0', 3000) and await wait_for(Bl, '__gc.online.seenTimer > 0', 3000))
            await click_move(W, 'e2', 'e4'); ok('left: move 1', await synced(1))
            await click_move(Bl, 'e7', 'e5'); ok('left: move 2', await synced(2))
            await Bl.evaluate('__gc.away(true)')  # black puts the app in the background during white's turn
            ok('left: white sees black away (the dot)', await wait_for(W, '__gc.online.oppHere === false && !!document.querySelector(".conn.off")', 5000))
            ok('left: black stops saying it is there', await Bl.evaluate('__gc.online.seenTimer') == 0)
            await W.wait_for_timeout(1500)
            ok("left: no countdown while it is white's turn", await W.evaluate('__gc.online.awaySec') == -1)
            await click_move(W, 'g1', 'f3'); ok('left: white moves', await wait_for(W, '__gc.game.records.length === 3 && !__gc.online.pending', 5000))
            ok("left: the countdown starts on black's turn", await wait_for(W, '__gc.online.awaySec >= 0 && __gc.online.awaySec <= 20', 3000))
            ok('left: "Opponent left · you win in N s" shown', await W.evaluate('/opponent left .* win in \\d+ s/i.test(document.getElementById("ana").textContent + document.getElementById("ana-side").textContent)'))
            await W.wait_for_timeout(2200)
            s1 = await W.evaluate('__gc.online.awaySec'); ok('left: it counts down', 13 <= s1 <= 18, s1)
            await W.screenshot(path=os.path.join(ROOT, 'test/shots/left-countdown.png'))
            await Bl.evaluate('__gc.away(false)')  # back in time
            ok('left: back: white sees black here, the countdown is gone', await wait_for(W, '__gc.online.oppHere === true && __gc.online.awaySec === -1', 5000))
            ok('left: black is heard from again', await wait_for(Bl, '__gc.online.seenTimer > 0', 3000))
            await click_move(Bl, 'b8', 'c6'); ok('left: black moves on, nothing lost', await synced(4) and await W.evaluate('__gc.game.status') == 'playing')
            await Bl.evaluate('__gc.away(true)')  # away again, and this time for good
            await wait_for(W, '__gc.online.oppHere === false', 5000)
            await click_move(W, 'f1', 'c4'); ok('left: white moves again', await wait_for(W, '__gc.game.records.length === 5 && !__gc.online.pending', 5000))
            await W.wait_for_timeout(1200)
            ok('left: a second into the turn: still playing', await W.evaluate('__gc.game.status') == 'playing')
            admin('shift', ms=21000)  # the server's clock moves on 21 s: black has been quiet for the whole turn
            ok("left: white wins by abandonment (white's own heartbeat claimed it)", await wait_for(W, '__gc.game.status === "over" && __gc.game.reason === "left" && __gc.game.result === "1-0"', 9000))
            ok('left: the result names it', await wait_for(W, '/abandon|уход/i.test(document.body.textContent)', 3000))
            await Bl.evaluate('__gc.away(false)')
            ok('left: black, back too late, learns of the loss', await wait_for(Bl, '__gc.game.status === "over" && __gc.game.reason === "left"', 6000))
            admin('shift', ms=-21000)

            # ---- 17. a player's page from the leaderboard: ratings by pool, the score against you, recent games that open for review
            nmA = await A.evaluate('__gc.me.profile.username')
            await B.evaluate('__gc.go("ratings")')
            ok('player: the leaderboard lists Alice', await wait_for(B, '!!document.querySelector(".lb-row[data-name=\'%s\']")' % nmA, 6000))
            ok('player: the leaderboard shows my own place', await wait_for(B, '/#\\d+/.test(document.getElementById("my-rating").textContent)', 4000), await B.evaluate('document.getElementById("my-rating").textContent'))
            ok("photo: Alice's picture in the leaderboard", await wait_for(B, '!!document.querySelector(".lb-row[data-name=\'%s\'] .ava.pic img")' % nmA, 4000))
            await B.click('.lb-row[data-name="%s"]' % nmA)
            ok("player: Alice's page opens", await wait_for(B, '__gc.curView === "player" && !!document.getElementById("pl-games") && document.querySelectorAll("#pl-games .gh-row").length >= 3', 6000))
            txt = await B.evaluate('document.getElementById("view-player").textContent')
            ok('player: her name, a blitz rating and the score against me', nmA in txt and 'Blitz' in txt and await B.evaluate('!!document.getElementById("pl-score")'), txt[:300])
            ok('player: no developer note for a real player', not await B.evaluate('!!document.getElementById("house-note")'))
            await B.screenshot(path=os.path.join(ROOT, 'test/shots/player.png'))
            await B.click('#pl-games .gh-row')
            ok('player: a game opens on the board for review', await wait_for(B, '__gc.curView === "game" && __gc.game.fromHistory && __gc.game.status === "over"', 8000))
            await B.evaluate('__gc.closeDialog()')
            await B.click('#btn-back')
            ok("player: back leads to Alice's page", await wait_for(B, '__gc.curView === "player"', 4000))
            await B.click('#player-back')
            ok('player: and back again to the ratings', await wait_for(B, '__gc.curView === "ratings"', 4000))

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
