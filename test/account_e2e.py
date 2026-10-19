# Accounts through the local test server's stand-in for Supabase Auth (codes land in an outbox).
# Online play needs an account: Start Game sends a guest to the sign-in page and the search starts right after;
# a new account keeps the guest's id and picks a name (a taken name is refused); signing in from the Profile and
# Ratings tabs returns there; another device signs in to the same player; sign out; wrong code; resend limit;
# signing out is refused during a live game; an expired sign-in link; Russian.
# Run: python3 test/account_e2e.py        (SHOTS=1 also saves screenshots)
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8792
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

def last_code(email, typ=None):
    msgs = [m for m in admin('outbox', to=email) if typ is None or m['type'] == typ]
    return msgs[-1] if msgs else None

def start_server():
    env = dict(os.environ, MOCK_LATENCY='60')
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
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
            async def open_page(ctx, name, url=BASE):
                pg = await ctx.new_page()
                errs.setdefault(name, [])
                pg.on('pageerror', lambda e: errs[name].append(str(e)))
                # the auth stand-in answers refusals with real HTTP statuses (like Supabase Auth), which the browser logs
                pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
                await pg.goto(url); await pg.evaluate(HELPERS)
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
            async def shot(pg, name):
                if SHOTS:
                    os.makedirs(SHOT_DIR, exist_ok=True)
                    await pg.wait_for_timeout(250)
                    await pg.screenshot(path=f'{SHOT_DIR}/acct-{name}.png')
            async def text(pg, sel):
                return await pg.evaluate('(s => { const e = document.querySelector(s); return e ? e.textContent : null; })(%s)' % json.dumps(sel))
            async def toast_text(pg):
                return await pg.evaluate('document.getElementById("toast").textContent')
            async def click_sq(pg, name):
                sq = 'abcdefgh'.index(name[0]) + (int(name[1]) - 1) * 16
                pt = await pg.evaluate(f'__t.sqCenter({sq})'); await pg.mouse.click(*pt)
            async def click_move(pg, a, z):
                await click_sq(pg, a); await pg.wait_for_timeout(60); await click_sq(pg, z)
            async def nav(pg, v):  # the tab bar on a phone, the rail on a computer
                await pg.click(f'#tabbar [data-nav={v}]' if await pg.evaluate('innerWidth < 768') else f'#rail [data-nav={v}]')
                return await wait_for(pg, f'__gc.curView === "{v}"', 3000)
            async def send_code(pg, email):
                await pg.fill('#acct-email', email); await pg.click('#btn-send-code')
                return await wait_for(pg, '!!document.getElementById("acct-code")', 5000)
            async def sign_in_name(pg, email, name):  # the sign-in page, the code, the name
                await pg.evaluate('__gc.closeDialog(); __gc.go("signin")')
                await wait_for(pg, '!!document.getElementById("acct-email")', 3000)
                await pg.wait_for_timeout(1100)  # the mock refuses a second code to the same address within a second
                if not await send_code(pg, email): return False
                await pg.fill('#acct-code', last_code(email)['code'])
                if not await wait_for(pg, '!!document.getElementById("acct-name")', 5000): return False
                await pg.fill('#acct-name', name); await pg.click('#btn-name')
                return await wait_for(pg, '__gc.me && __gc.me.profile && __gc.me.profile.username === %s' % json.dumps(name), 5000)
            async def pair(A, B):
                for pg in (A, B):
                    await pg.evaluate('__gc.closeDialog(); __gc.go("play")')
                    await wait_for(pg, '!!document.getElementById("btn-start")')
                    await pg.click('#btn-start')
                    await pg.wait_for_timeout(150)
                a = await wait_for(A, '__gc.online && __gc.game.cfg.mode === "online" && __gc.game.status === "playing"', 8000)
                b = await wait_for(B, '__gc.online && __gc.game.cfg.mode === "online" && __gc.game.status === "playing"', 8000)
                return a and b
            async def abort(pg):
                await pg.click('#btn-menu'); await pg.click('.menu-list button.danger'); await pg.click('.sheetdlg .secondary.danger')

            ctxA = await br.new_context(viewport={'width': 1280, 'height': 860})
            ctxB = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            A = await open_page(ctxA, 'A'); B = await open_page(ctxB, 'B')

            # ---- 1. a guest presses Start Game: the sign-in page, a new account with a name, then the search starts
            await wait_for(A, '!!document.getElementById("btn-start")')
            await A.click('#btn-start')
            ok('Start Game sends a guest to the sign-in page', await wait_for(A, '__gc.curView === "signin" && !!document.getElementById("acct-email")', 4000))
            ok('the search waits for the sign-in', '"seek"' in (await A.evaluate('localStorage.getItem("goldenchess.pending")') or ''))
            ok('no tab bar on the sign-in page (rail on a computer)', await A.evaluate('getComputedStyle(document.getElementById("rail")).display !== "none"'))
            await shot(A, '1-signin')
            await A.fill('#acct-email', 'not-an-email'); await A.click('#btn-send-code')
            ok('a bad address is caught before sending', await wait_for(A, '/valid/i.test((document.getElementById("acct-err") || {}).textContent || "")', 2000))
            ok('code step', await send_code(A, 'Alice@Example.com'))
            sub = await text(A, '#signin-card .dlg-sub')
            ok('code step names the address', 'Alice@Example.com' in (sub or ''), sub)
            rs = await A.evaluate('(b => [b.disabled, b.textContent])(document.getElementById("btn-resend"))')
            ok('send again waits a minute', rs[0] and any(ch.isdigit() for ch in rs[1]), rs)
            ok('no note about switching accounts when the email is new', not await A.evaluate('!!document.getElementById("acct-existing")'))
            msg = last_code('alice@example.com')
            ok('code sent as an email change of this guest', msg and msg['type'] == 'email_change', msg)
            uidA = await A.evaluate('__gc.me.uid')
            await A.fill('#acct-code', '000000')
            ok('wrong code: clear error, field emptied', await wait_for(A, '/wrong|expired/i.test((document.getElementById("acct-err") || {}).textContent || "") && document.getElementById("acct-code").value === ""', 4000))
            await A.fill('#acct-code', msg['code'])
            ok('a new account picks a name', await wait_for(A, '!!document.getElementById("acct-name")', 4000))
            ok('the name form says which account it is for', 'alice@example.com' in ((await text(A, '#name-acct')) or ''), await text(A, '#name-acct'))
            ok('toast: signed in as', 'alice@example.com' in (await toast_text(A)), await toast_text(A))
            await shot(A, '2-name')
            await A.fill('#acct-name', 'Alice'); await A.click('#btn-name')
            ok('the search starts right after', await wait_for(A, '__gc.dialogKind === "lobby"', 5000))
            ok('same id as the guest, now with an email', await A.evaluate('__gc.me.uid') == uidA and await A.evaluate('__gc.me.guest === false && __gc.me.email === "alice@example.com"'))
            ok('name saved', await A.evaluate('__gc.me.profile.username') == 'Alice')
            prof = [x for x in admin('profiles') if x['id'] == uidA][0]
            ok('server profile marked registered', prof['is_guest'] is False, prof)
            ok('nothing left waiting', await A.evaluate('localStorage.getItem("goldenchess.pending")') in (None, 'null'))
            await A.evaluate('__gc.closeDialog()')
            ok('Play shows the account', await wait_for(A, '/Alice/.test((document.getElementById("acct-chip") || {}).textContent || "")', 3000))

            # ---- 2. another guest signs in from the Profile tab and comes back to it; a taken name is refused
            ok('profile tab', await nav(B, 'profile'))
            ok('profile: a sign-in button for a guest', await wait_for(B, '!!document.getElementById("btn-profile-signin")', 3000))
            await B.click('#btn-profile-signin')
            ok('sign-in page, no tab bar on a phone', await wait_for(B, '__gc.curView === "signin"') and await B.evaluate('getComputedStyle(document.getElementById("tabbar")).display === "none"'))
            ok('code step (B)', await send_code(B, 'bob@example.com'))
            await B.fill('#acct-code', last_code('bob@example.com')['code'])
            await wait_for(B, '!!document.getElementById("acct-name")', 4000)
            await B.fill('#acct-name', 'Alice'); await B.click('#btn-name')
            ok('a taken name is refused, with what to do if it is yours', await wait_for(B, '/taken by another player/i.test((document.getElementById("acct-err") || {}).textContent || "") && /another account/i.test(document.getElementById("acct-err").textContent)', 4000), await text(B, '#acct-err'))
            await B.fill('#acct-name', 'Bob'); await B.click('#btn-name')
            ok('back on the Profile tab with the account', await wait_for(B, '__gc.curView === "profile" && /Bob/.test(document.getElementById("prof-name").textContent) && /bob@example.com/.test(document.getElementById("prof-sub").textContent)', 5000))
            await shot(B, '3-profile')

            # ---- 3. both play a rated game
            ok('paired', await pair(A, B))
            W, Bl = (A, B) if await A.evaluate('__gc.online.color') == 0 else (B, A)
            await click_move(W, 'e2', 'e4'); await wait_for(Bl, '__gc.game.records.length === 1 && !__gc.online.pending', 5000)
            await click_move(Bl, 'e7', 'e5'); await wait_for(W, '__gc.game.records.length === 2 && !__gc.online.pending', 5000)
            await wait_for(Bl, '__gc.game.records.length === 2 && !__gc.online.pending', 5000)
            await Bl.click('#btn-menu'); await Bl.click('.menu-list button.danger'); await Bl.click('.sheetdlg .secondary.danger')
            ok('rated game over, ratings changed', await wait_for(A, '!!document.querySelector(".rating-change")', 6000) and await wait_for(B, '!!document.querySelector(".rating-change")', 6000))
            ok('no guest nudge for an account', not await A.evaluate('!!document.getElementById("btn-save-progress")'))
            await wait_for(A, 'Object.values(__gc.me.ratings).some(r => r.games === 1)', 4000)
            ratA = await A.evaluate('JSON.stringify(__gc.me.ratings)')
            ok('A has a rating', '"games":1' in ratA, ratA)

            # ---- 4. another device signs in with the same email from the Ratings tab and becomes the same player
            ctxC = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            C = await open_page(ctxC, 'C')
            ok('ratings tab', await nav(C, 'ratings'))
            ok('ratings: asks a guest to sign in', await wait_for(C, '!!document.getElementById("btn-ratings-signin")', 3000))
            await C.click('#btn-ratings-signin')
            admin('shift', ms=61000)  # past the one-code-a-minute limit for this address
            ok('existing email: code step', await send_code(C, 'alice@example.com'))
            ok('no switching note for a fresh guest', not await C.evaluate('!!document.getElementById("acct-existing")'))
            msg = last_code('alice@example.com')
            ok('code sent as a sign-in', msg and msg['type'] == 'email', msg)
            await C.fill('#acct-code', msg['code'])
            ok('page reloads into the account', await wait_for(C, '!!window.__gc && !!__gc.me && __gc.me.uid === %s' % json.dumps(uidA), 8000))
            await C.evaluate(HELPERS)
            ok('same name and rating on the second device', await C.evaluate('__gc.me.profile.username') == 'Alice' and await C.evaluate('JSON.stringify(__gc.me.ratings)') == ratA)
            ok('toast: signed in as', await wait_for(C, '/alice@example.com/.test(document.getElementById("toast").textContent)', 3000), await toast_text(C))
            ok('back on the Ratings tab with the rating', await wait_for(C, '__gc.curView === "ratings" && !!document.querySelector("#my-rating .big")', 5000))
            ok('the leaderboard lists the player', await wait_for(C, '/Alice/.test(document.getElementById("lb-list").textContent)', 4000))
            await shot(C, '4-ratings')

            # ---- 5. sign out from the Profile tab: a new guest
            ok('profile tab (C)', await nav(C, 'profile'))
            await wait_for(C, '!!document.getElementById("btn-signout")', 3000)
            await C.click('#btn-signout')
            ok('signed out: a new guest after reload', await wait_for(C, '!!window.__gc && !!__gc.me && __gc.me.uid !== %s && __gc.me.guest === true' % json.dumps(uidA), 8000))
            ok('toast: signed out', await wait_for(C, '/signed out/i.test(document.getElementById("toast").textContent)', 3000), await toast_text(C))
            ok('lands on Play', await C.evaluate('__gc.curView') == 'play')
            ok('the account itself is untouched', [x for x in admin('profiles') if x['id'] == uidA][0]['is_guest'] is False)

            # ---- 6. sending again too soon is refused
            await C.evaluate('__gc.go("signin")')
            ok('code step (C)', await send_code(C, 'carol@example.com'))
            await C.click('#btn-other-email')
            ok('back to the email form, address kept', await wait_for(C, 'document.getElementById("acct-email") && document.getElementById("acct-email").value === "carol@example.com"', 3000))
            await C.click('#btn-send-code')
            ok('asking again within a minute: told to wait', await wait_for(C, '/wait|too many/i.test((document.getElementById("acct-err") || {}).textContent || "")', 4000), await text(C, '#acct-err'))
            ok('phone: no sideways scroll on the sign-in page', await C.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
            await C.click('#signin-back')
            ok('back leaves the sign-in page', await wait_for(C, '__gc.curView === "play"', 3000))

            # ---- 7. not during a live online game: signing out
            ok('new game paired', await pair(A, B))
            ok('profile tab during the game (A)', await nav(A, 'profile'))
            await wait_for(A, '!!document.getElementById("btn-signout")', 3000)
            await A.click('#btn-signout')
            ok('signing out mid-game is refused', await wait_for(A, '/finish/i.test((document.getElementById("signout-err") || {}).textContent || "")', 3000))
            ok('still signed in and playing', await A.evaluate('__gc.me.uid') == uidA and await A.evaluate('__gc.game.status === "playing"'))
            await B.click('#btn-back')
            ok('phone: back from the game shows it on Play', await wait_for(B, '__gc.curView === "play" && !!document.getElementById("btn-resume")', 3000))
            await B.click('#btn-resume')
            ok('and returns to it', await wait_for(B, '__gc.curView === "game" && __gc.game.status === "playing"', 3000))
            await abort(B)
            ok('game aborted', await wait_for(A, '__gc.game.reason === "abort"', 5000))

            # ---- 7b. deleting an account: refused during a live game, then gone for good (B, Bob)
            ok('new game paired (delete)', await pair(A, B))
            await B.evaluate('__gc.go("profile")')  # on a phone the game hides the tab bar: back, then Profile
            ok('profile during the game (B)', await wait_for(B, '__gc.curView === "profile"', 3000))
            await wait_for(B, '!!document.getElementById("btn-delete-acct")', 3000)
            await B.click('#btn-delete-acct')
            ok('deleting mid-game is refused', await wait_for(B, '/finish/i.test(document.getElementById("toast").textContent)', 3000), await toast_text(B))
            await abort(A)
            await wait_for(B, '__gc.game.reason === "abort"', 5000)
            uidB = await B.evaluate('__gc.me.uid')
            await B.evaluate('__gc.closeDialog(); __gc.go("profile")'); await wait_for(B, '!!document.getElementById("btn-delete-acct")', 3000)
            await B.click('#btn-delete-acct')
            ok('asked once more, with the account named', await wait_for(B, '__gc.dialogKind === "delete" && /bob@example.com/.test(document.querySelector(".sheetdlg").textContent)', 3000))
            await shot(B, '5-delete')
            await B.click('#btn-delete-confirm')
            ok('deleted: a new guest after reload', await wait_for(B, '!!window.__gc && !!__gc.me && __gc.me.uid !== %s && __gc.me.guest === true' % json.dumps(uidB), 8000))
            ok('toast: account deleted', await wait_for(B, '/account deleted/i.test(document.getElementById("toast").textContent)', 3000), await toast_text(B))
            ok('the profile is gone on the server', not [x for x in admin('profiles') if x['id'] == uidB])
            ok('the finished games stay for the opponent', any(g['status'] == 'over' and (g['white_name'] == 'Bob' or g['black_name'] == 'Bob') for g in admin('games')))
            ok('the name Bob is free again', await sign_in_name(B, 'bob@example.com', 'Bob'))

            # ---- 8. an expired sign-in link brings the player back with a clear message
            D = await open_page(await br.new_context(viewport={'width': 800, 'height': 900}), 'D', BASE + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
            ok('expired link: told so', await wait_for(D, '/expired/i.test(document.getElementById("toast").textContent)', 4000), await toast_text(D))
            ok('address tidied', await D.evaluate('location.hash === "#play" && !/error/.test(location.href)'), await D.evaluate('location.href'))

            # ---- 9. Russian
            await D.evaluate('__gc.settings.lang = "ru"; localStorage.setItem("goldenchess.settings", JSON.stringify(__gc.settings))')
            await D.reload(); await D.evaluate(HELPERS)
            await D.evaluate('__gc.go("signin")')
            ok('Russian sign-in page', await wait_for(D, '/Войдите/.test(document.querySelector("#signin-card .dlg-title").textContent) && /почт/i.test(document.querySelector("#signin-card .dlg-sub").textContent)', 4000))

            # ---- 10. the stores' review account (it can't get our emails): a password instead of a code (in Russian here)
            await D.fill('#acct-email', 'Review@golden-chess.com')
            await D.click('#btn-send-code')
            ok('review account: a password field, no email sent', await wait_for(D, '!!document.getElementById("acct-password")', 3000) and not admin('outbox', to='review@golden-chess.com'))
            await D.fill('#acct-password', 'nope')
            await D.click('#btn-password')
            ok('wrong password: said so', await wait_for(D, '/Неверный пароль/.test((document.getElementById("acct-err") || {}).textContent || "")', 4000), await text(D, '#acct-err'))
            await D.fill('#acct-password', 'review-test-pass')
            await D.click('#btn-password')
            ok('right password: signed in as the review account', await wait_for(D, '!!window.__gc && !!__gc.me && __gc.me.guest === false && __gc.me.email === "review@golden-chess.com"', 8000), await D.evaluate('window.__gc && __gc.me'))

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
