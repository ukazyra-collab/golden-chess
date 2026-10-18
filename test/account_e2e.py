# Accounts through the local test server: a guest keeps their rating by adding an email (same account),
# another device signs in with that email and gets the same player, sign out, wrong code, resend limit,
# switching accounts with a note, the live-game guard, and an expired sign-in link.
# Run: python3 test/account_e2e.py        (SHOTS=1 also saves screenshots of the dialogs)
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
            async def pair(A, B, tc='opt-otc32'):
                for pg in (A, B):
                    await pg.evaluate('__gc.closeDialog()')
                    await pg.click('#btn-new'); await pg.click('#opt-online')
                    await wait_for(pg, '!!document.getElementById("my-name")')
                    await pg.click('#' + tc); await pg.click('#btn-seek')
                    await pg.wait_for_timeout(150)
                a = await wait_for(A, '__gc.online && __gc.game.cfg.mode === "online" && __gc.game.status === "playing"', 8000)
                b = await wait_for(B, '__gc.online && __gc.game.cfg.mode === "online" && __gc.game.status === "playing"', 8000)
                return a and b
            async def enter_email(pg, email):
                await pg.fill('#acct-email', email); await pg.click('#btn-send-code')

            ctxA = await br.new_context(viewport={'width': 1280, 'height': 860})
            ctxB = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            A = await open_page(ctxA, 'A'); B = await open_page(ctxB, 'B')

            # ---- 1. two guests play a rated game
            ok('paired', await pair(A, B))
            W, Bl = (A, B) if await A.evaluate('__gc.online.color') == 0 else (B, A)
            await click_move(W, 'e2', 'e4'); await wait_for(Bl, '__gc.game.records.length === 1 && !__gc.online.pending', 5000)
            await click_move(Bl, 'e7', 'e5'); await wait_for(W, '__gc.game.records.length === 2 && !__gc.online.pending', 5000)
            await wait_for(Bl, '__gc.game.records.length === 2 && !__gc.online.pending', 5000)
            await Bl.click('#btn-menu'); await Bl.click('.menu-list button.danger'); await Bl.click('.sheetdlg .secondary.danger')
            ok('rated game over, ratings changed', await wait_for(A, '!!document.querySelector(".rating-change")', 6000) and await wait_for(B, '!!document.querySelector(".rating-change")', 6000))
            ok('result offers a guest to keep the rating', await wait_for(A, '!!document.getElementById("btn-save-progress")', 3000) and await wait_for(B, '!!document.getElementById("btn-save-progress")', 3000))
            await shot(B, '1-result-nudge')
            uidA = await A.evaluate('__gc.me.uid'); nameA = await A.evaluate('__gc.me.profile.username')
            await wait_for(A, 'Object.values(__gc.me.ratings).some(r => r.games === 1)', 4000)
            ratA = await A.evaluate('JSON.stringify(__gc.me.ratings)')
            ok('A is a guest with a rating', await A.evaluate('__gc.me.guest === true && __gc.me.email === null') and '"games":1' in ratA, ratA)

            # ---- 2. A adds an email: same account, rating kept
            await A.click('#btn-save-progress')
            ok('account dialog opens on the email form', await wait_for(A, '__gc.dialogKind === "account" && !!document.getElementById("acct-email")', 4000))
            await enter_email(A, 'not-an-email')
            ok('a bad address is caught before sending', await wait_for(A, '/valid/i.test((document.getElementById("acct-err") || {}).textContent || "")', 2000))
            await enter_email(A, 'Alice@Example.com')
            ok('code step', await wait_for(A, '!!document.getElementById("acct-code")', 4000))
            sub = await text(A, '.sheetdlg .dlg-sub')
            ok('code step names the address', 'Alice@Example.com' in (sub or ''), sub)
            rs = await A.evaluate('(b => [b.disabled, b.textContent])(document.getElementById("btn-resend"))')
            ok('send again waits a minute', rs[0] and any(ch.isdigit() for ch in rs[1]), rs)
            ok('no note about switching accounts when the email is new', not await A.evaluate('!!document.getElementById("acct-existing")'))
            msg = last_code('alice@example.com')
            ok('code sent as an email change of this account', msg and msg['type'] == 'email_change', msg)
            await shot(A, '2-code')
            await A.fill('#acct-code', '000000')
            ok('wrong code: clear error, field emptied', await wait_for(A, '/wrong|expired/i.test((document.getElementById("acct-err") || {}).textContent || "") && document.getElementById("acct-code").value === ""', 4000))
            await A.fill('#acct-code', msg['code'])
            ok('right code: signed in, the dialog says so', await wait_for(A, '/alice@example.com/.test((document.getElementById("acct-who") || {}).textContent || "")', 4000))
            ok('toast: progress saved', 'saved' in (await toast_text(A)).lower(), await toast_text(A))
            ok('same account, no longer a guest', await A.evaluate('__gc.me.uid') == uidA and await A.evaluate('__gc.me.guest === false && __gc.me.email === "alice@example.com"'))
            ok('name and rating kept', await A.evaluate('__gc.me.profile.username') == nameA and await A.evaluate('JSON.stringify(__gc.me.ratings)') == ratA)
            prof = [x for x in admin('profiles') if x['id'] == uidA][0]
            ok('server profile marked registered', prof['is_guest'] is False, prof)
            await shot(A, '3-signed')
            await A.click('#btn-acct-done')
            ok('done returns to the result', await wait_for(A, '__gc.dialogKind === "over"', 3000))
            ok('no guest nudge any more', not await A.evaluate('!!document.getElementById("btn-save-progress")'))

            # ---- 3. another device signs in with the same email and becomes the same player
            ctxC = await br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            C = await open_page(ctxC, 'C')
            await C.click('#btn-settings')
            ok('settings: account row shows a guest', await wait_for(C, '/guest/i.test((document.getElementById("acct-line") || {}).textContent || "")', 3000))
            await shot(C, '4-settings-guest')
            await C.click('#btn-account')
            await wait_for(C, '!!document.getElementById("acct-email")', 4000)
            admin('shift', ms=61000)  # past the one-code-a-minute limit for this address
            await enter_email(C, 'alice@example.com')
            ok('existing email: code step', await wait_for(C, '!!document.getElementById("acct-code")', 4000))
            ok('no switching note for a fresh guest', not await C.evaluate('!!document.getElementById("acct-existing")'))
            msg = last_code('alice@example.com')
            ok('code sent as a sign-in', msg and msg['type'] == 'email', msg)
            uidC0 = await C.evaluate('__gc.me.uid')
            await C.fill('#acct-code', msg['code'])
            ok('page reloads into the account', await wait_for(C, '!!window.__gc && !!__gc.me && __gc.me.uid === %s' % json.dumps(uidA), 8000), uidC0)
            await C.evaluate(HELPERS)
            ok('same name and rating on the second device', await C.evaluate('__gc.me.profile.username') == nameA and await C.evaluate('JSON.stringify(__gc.me.ratings)') == ratA)
            ok('toast: signed in as', await wait_for(C, '/alice@example.com/.test(document.getElementById("toast").textContent)', 3000), await toast_text(C))
            await C.click('#btn-settings')
            ok('settings: account row shows the email', await wait_for(C, '/alice@example.com/.test((document.getElementById("acct-line") || {}).textContent || "")', 3000))
            await shot(C, '5-settings-signed')

            # ---- 4. sign out: a new guest
            await C.click('#btn-account')
            ok('account dialog shows the signed-in state', await wait_for(C, '!!document.getElementById("btn-signout")', 4000))
            await C.click('#btn-signout')
            ok('signed out: a new guest after reload', await wait_for(C, '!!window.__gc && !!__gc.me && __gc.me.uid !== %s && __gc.me.guest === true' % json.dumps(uidA), 8000))
            ok('toast: signed out', await wait_for(C, '/signed out/i.test(document.getElementById("toast").textContent)', 3000), await toast_text(C))
            ok('the account itself is untouched', [x for x in admin('profiles') if x['id'] == uidA][0]['is_guest'] is False)

            # ---- 5. a guest with games of their own is told before switching; sending again too soon is refused
            await B.evaluate('__gc.closeDialog()')
            await B.evaluate('__gc.showAccount()')
            await wait_for(B, '!!document.getElementById("acct-email")', 4000)
            admin('shift', ms=61000)
            await enter_email(B, 'alice@example.com')
            ok('switching note for a guest with a rating', await wait_for(B, '!!document.getElementById("acct-existing")', 4000))
            await shot(B, '6-switch-note')
            await B.click('#btn-other-email')
            ok('back to the email form, address kept', await wait_for(B, 'document.getElementById("acct-email") && document.getElementById("acct-email").value === "alice@example.com"', 3000))
            await B.click('#btn-send-code')
            ok('asking again within a minute: told to wait', await wait_for(B, '/wait|too many/i.test((document.getElementById("acct-err") || {}).textContent || "")', 4000), await text(B, '#acct-err'))
            ok('B is still its own guest', await B.evaluate('__gc.me.guest === true && __gc.me.uid !== %s' % json.dumps(uidA)))
            # layout on a phone: nothing sticks out sideways
            ok('phone: no sideways scroll with the dialog open', await B.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
            await B.evaluate('__gc.closeDialog()')

            # ---- 6. not during a live online game: switching accounts or signing out
            ok('new game paired', await pair(A, B))
            await B.evaluate('__gc.showAccount()')
            await wait_for(B, '!!document.getElementById("acct-email")', 4000)
            admin('shift', ms=61000)
            await enter_email(B, 'alice@example.com')
            ok('switching accounts mid-game is refused', await wait_for(B, '/finish/i.test((document.getElementById("acct-err") || {}).textContent || "")', 4000), await text(B, '#acct-err'))
            await A.evaluate('__gc.showAccount()')
            await wait_for(A, '!!document.getElementById("btn-signout")', 4000)
            await A.click('#btn-signout')
            ok('signing out mid-game is refused', await wait_for(A, '/finish/i.test((document.getElementById("acct-err") || {}).textContent || "")', 3000))
            ok('still signed in and playing', await A.evaluate('__gc.me.uid') == uidA and await A.evaluate('__gc.game.status === "playing"'))
            for pg in (A, B): await pg.evaluate('__gc.closeDialog()')
            await A.click('#btn-menu'); await A.click('.menu-list button.danger'); await A.click('.sheetdlg .secondary.danger')
            ok('game aborted', await wait_for(B, '__gc.game.reason === "abort"', 5000))

            # ---- 7. an expired sign-in link brings the player back with a clear message
            D = await open_page(await br.new_context(viewport={'width': 800, 'height': 900}), 'D', BASE + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
            ok('expired link: told so', await wait_for(D, '/expired/i.test(document.getElementById("toast").textContent)', 4000), await toast_text(D))
            ok('address tidied', await D.evaluate('location.hash === "" && !/#/.test(location.href)'), await D.evaluate('location.href'))

            # ---- 8. Russian
            await D.evaluate('__gc.settings.lang = "ru"; localStorage.setItem("goldenchess.settings", JSON.stringify(__gc.settings))')
            await D.reload(); await D.evaluate(HELPERS)
            await D.evaluate('__gc.showAccount()')
            ok('Russian dialog', await wait_for(D, '/Войти/.test(document.querySelector(".sheetdlg .dlg-title").textContent) && /почт/i.test(document.querySelector(".sheetdlg .dlg-sub").textContent)', 4000))

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
