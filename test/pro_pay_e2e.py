# Joker Pro for real, through the local test server (its /pay stands in for the pay function and for Stripe's two
# pages): who is shown Pro (the server's switch: off, the owner's accounts only, everyone; never inside the apps),
# the Joker analysis (one free, then the Pro sheet), buying (a saved account first, the payment page, the way back),
# what Pro turns on, the subscription's page, a Founder, a plan that has run out, other players' gold names, and the
# offers nobody asked for (how often, where).
# Run: python3 test/pro_pay_e2e.py   (after node build.js; SHOTS=1 also saves screenshots)
import asyncio, json, os, re, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8797
BASE = f'http://127.0.0.1:{PORT}/'
HELPERS = open(ROOT + '/test/helpers.js').read()
SHOTS = os.environ.get('SHOTS')
SHOT_DIR = os.environ.get('SHOT_DIR', ROOT + '/test/shots')
GOLD = 'rgb(240, 185, 65)'
results = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond and extra != '') else '', flush=True)

def admin(op, **kw):
    req = urllib.request.Request(BASE + 'admin', data=json.dumps(dict(op=op, **kw)).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def last_code(email):
    msgs = admin('outbox', to=email)
    return msgs[-1]['code'] if msgs else None

def start_server():
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], env=dict(os.environ, MOCK_LATENCY='20'), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1).read(); return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('server did not start')

# the app's bridge (an iPhone): enough for the page to know it runs inside the app
FAKE_CAP = r"""
window.Capacitor = {
  isNativePlatform: function () { return true; }, getPlatform: function () { return 'ios'; },
  isPluginAvailable: function (p) { return ['App', 'SplashScreen', 'StatusBar', 'Share', 'Browser', 'Haptics'].indexOf(p) >= 0; },
  nativePromise: function () { return Promise.resolve({}); }, addListener: function () { return { remove: function () {} }; }
};
"""
MISSED = "r7/p1p4p/5k2/2N5/5P2/6P1/PPP2R1P/R1K1r3 w - - 1 28 Gg"  # a rook check that only a Joker Move blocks well

async def main():
    srv = start_server()
    errs = {}
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            phone = dict(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)

            async def prep(pg, noask=True):
                await pg.evaluate(HELPERS); await pg.evaluate('window.__gcNoAsk = %s' % ('true' if noask else 'false'))

            async def open_page(ctx, name, native=False, store=None, noask=True):
                pg = await ctx.new_page()
                pg.set_default_timeout(7000)
                errs.setdefault(name, [])
                pg.on('pageerror', lambda e: errs[name].append(str(e)))
                pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'navigator.vibrate' not in m.text else None)
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
                await pg.add_init_script('window.__gcFastBot = true; try { if (!localStorage.getItem("goldenchess.settings")) localStorage.setItem("goldenchess.settings", JSON.stringify({ lang: "en" })); } catch (e) {}')
                if native: await pg.add_init_script(FAKE_CAP)
                if store:
                    await pg.add_init_script('(function () { if (localStorage.getItem("seeded")) return; var s = %s; for (var k in s) localStorage.setItem("goldenchess." + k, JSON.stringify(s[k])); localStorage.setItem("seeded", "1"); })()' % json.dumps(store))
                await pg.goto(BASE); await pg.wait_for_timeout(500); await prep(pg, noask)
                return pg

            async def wait_for(pg, js, timeout=7000, step=60):
                t0 = time.time()
                while time.time() - t0 < timeout / 1000:
                    try:
                        if await pg.evaluate(js): return True
                    except Exception:
                        pass
                    await pg.wait_for_timeout(step)
                return False

            async def text(pg, sel):
                return await pg.evaluate('(function () { var e = document.querySelector(%s); return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; })()' % json.dumps(sel))
            async def has(pg, sel): return await pg.evaluate('!!document.querySelector(%s)' % json.dumps(sel))
            async def kind(pg): return await pg.evaluate('__gc.dialogKind')
            async def pro(pg): return await pg.evaluate('JSON.parse(JSON.stringify(__gc.pro))')
            async def close_all(pg):
                for _ in range(4):
                    if await pg.evaluate('!!__gc.dialogOpen'):
                        await pg.evaluate('__gc.closeDialog()'); await pg.wait_for_timeout(260)

            # a finished game in which White misses a Joker Move, its report open and the engine done
            async def missed_game(pg):
                await pg.evaluate('''(fen) => { __gc.closeDialog();
                    __gc.startGame({ mode: 'local', color: 'w', tc: 'none' }, { fen: fen });
                    const g = __gc.game, now = performance.now();
                    for (const u of ['c1d2', 'e1a1']) g.play(g.pos.moveFromUci(u), now);
                    g.end('0-1', 'resign', now); __gc.gameOver(); __gc.closeDialog(); }''', MISSED)
                await pg.wait_for_timeout(250)
                await pg.evaluate('__gc.showReport()')
                return await wait_for(pg, '__gc.reviewState && !__gc.reviewState.running && !!__gc.reviewState.sum', 25000)

            # a finished two-player game (two moves, a resignation), then back on the Play tab
            async def one_game(pg):
                await pg.evaluate('''() => { __gc.closeDialog(); __gc.startGame({ mode: 'local', color: 'w', tc: 'none' });
                    for (const u of ['e2e4', 'e7e5']) { const m = __gc.game.pos.moveFromUci(u); __gc.tryMove(m & 127, (m >> 7) & 127, false); } }''')
                await wait_for(pg, '__gc.game.records.length === 2', 3000)
                await pg.evaluate('__gc.game.end("1-0", "resign", performance.now()); __gc.gameOver()')
                await pg.wait_for_timeout(350)
                await pg.evaluate('__gc.closeDialog(); __gc.go("play")')

            async def sign_in(pg, email, name=None):
                await pg.fill('#acct-email', email); await pg.click('#btn-send-code')
                if not await wait_for(pg, '!!document.getElementById("acct-code")', 6000): return False
                await pg.fill('#acct-code', last_code(email))
                if name and await wait_for(pg, '!!document.getElementById("acct-name")', 6000):
                    await pg.fill('#acct-name', name); await pg.click('#btn-name')
                return await wait_for(pg, '!!window.__gc && !!__gc.me && __gc.me.email === %s && !__gc.me.guest' % json.dumps(email.lower()), 9000)

            async def account(pg, email, name):
                await pg.evaluate('__gc.showAccount()')
                await wait_for(pg, '!!document.getElementById("acct-email")', 5000)
                done = await sign_in(pg, email, name)
                await pg.wait_for_timeout(300); await prep(pg)
                await close_all(pg)
                return done

            # ================================================================ 1. the switch is off: nothing of Pro
            ctx = await br.new_context(**phone)
            A = await open_page(ctx, 'A')
            await A.wait_for_timeout(500)
            st = await pro(A)
            ok('off: Pro is neither sold nor on', st['sells'] is False and st['on'] is False and st['avail'] is False, st)
            ok('off: the page asked whether it is sold, and keeps the answer', (await A.evaluate('JSON.parse(localStorage.getItem("goldenchess.proPub") || "null")') or {}).get('on') is False)
            await A.evaluate('__gc.go("profile")'); await A.wait_for_timeout(300)
            ok('off: the Profile has no line about Pro', not await has(A, '#pro-entry') and not await has(A, '.pro-mark'))
            ok('off: a review is whole', await missed_game(A) and not await has(A, '#btn-jk') and await has(A, '.rp-miss') and '★' in (await text(A, '.rp-miss .gold') or '') and (await pro(A))['blind'] is False, await text(A, '#rp-missed'))
            await close_all(A)
            await A.evaluate('__gc.startGame({ mode: "bot", level: 2, bot: "mila", color: "w", tc: "none" })'); await A.wait_for_timeout(400)
            await A.click('#btn-menu'); await A.wait_for_timeout(250)
            ok('off: no hint in a bot game', not await has(A, '.menu-list button.hint'))
            await close_all(A)
            await A.evaluate('__gc.go("learn")'); await A.wait_for_timeout(400)
            ok('off: no pack line on the Learn tab', await A.evaluate('!document.getElementById("pack-line") || document.getElementById("pack-line").hidden'))
            await ctx.close()

            # ================================================================ 2. tried out by the owner's accounts only
            admin('promode', mode='test')
            ctx = await br.new_context(**phone)
            B = await open_page(ctx, 'B')
            ok('a player signs in', await account(B, 'bob@example.com', 'Bob'))
            ok('test: a player still sees nothing', (await pro(B))['sells'] is False and await B.evaluate('__gc.me.pro') is None)
            uidB = await B.evaluate('__gc.me.uid')
            admin('addadmin', uid=uidB)
            await B.reload(); await B.wait_for_timeout(700); await prep(B)
            await wait_for(B, '!!__gc.me', 6000)
            ok('test: the owner\'s account is shown Pro', await B.evaluate('__gc.me.pro') == 'test' and (await pro(B))['sells'] is True, await pro(B))
            await B.evaluate('__gc.proSheet()'); await B.wait_for_timeout(500)
            ok('test: the sheet says nothing is charged, and gives the test card', (await kind(B)) == 'pro' and '4242 4242 4242 4242' in (await text(B, '#pro-test') or '') and not await has(B, '#pro-proto'), await text(B, '#pro-test'))
            ok('the sheet names where the payment happens, with the terms', 'Stripe' in (await text(B, '#pro-payby') or '') and (await B.evaluate('document.querySelector("#pro-payby a").getAttribute("href")') or '').endswith('terms.html'))
            await ctx.close()

            # ================================================================ 3. on sale: a visitor
            admin('promode', mode='on')
            ctx = await br.new_context(**phone)
            C = await open_page(ctx, 'C')
            await wait_for(C, '__gc.pro.sells === true', 5000)
            st = await pro(C)
            ok('on: a visitor without a session is shown Pro', st['sells'] is True and st['on'] is False and await C.evaluate('__gc.me') is None, st)
            ok('the first day Pro is seen on sale is kept (no offers that day)', bool((st['offer'] or {}).get('first')) and await C.evaluate('__gc.proOfferDue(true)') is None, st['offer'])
            # the Joker analysis
            ok('the review of a game', await missed_game(C))
            rep_text = await text(C, '.veil .sheetdlg.report')
            ok('the report asks whether there was a Joker Move, and does not tell', await has(C, '#rp-missed.jk-ask') and not await has(C, '.rp-miss') and not re.search('[a-h1-8]★[a-h]', rep_text) and 'missed' not in rep_text.lower() and (await pro(C))['blind'] is True, rep_text[:160])
            ok('one is free', (await text(C, '#jk-note')) == 'One analysis is free' and (await text(C, '#btn-jk')) == 'Show')
            if SHOTS: await C.wait_for_timeout(500); await C.screenshot(path=SHOT_DIR + '/pro-report-ask.png')
            await C.click('#btn-jk'); await C.wait_for_timeout(500)
            ok('a tap shows it', '★' in (await text(C, '.rp-miss .gold') or '') and (await pro(C))['jk']['n'] == 1 and (await pro(C))['blind'] is False and await has(C, '#jk-more'))
            if SHOTS: await C.wait_for_timeout(300); await C.screenshot(path=SHOT_DIR + '/pro-report-open.png')
            await C.reload(); await C.wait_for_timeout(600); await prep(C)
            ok('the next game: the card again, the free one used', await missed_game(C) and await has(C, '#btn-jk.pro') and (await text(C, '#jk-note')) == 'Your free analysis is used' and not await has(C, '.rp-miss'), await text(C, '#rp-missed'))
            await C.click('#btn-jk'); await C.wait_for_timeout(500)
            ok('the Pro sheet, with the reason', (await kind(C)) == 'pro' and 'free Joker analysis is used' in (await text(C, '#pro-why')), await text(C, '#pro-why'))
            ok('the sheet: the card, five perks, the year picked, the trial on the button', await has(C, '#pro-art .pro-seal svg') and await C.evaluate('document.querySelectorAll("#pro-perks .pro-perk").length') == 5
               and await C.evaluate('document.getElementById("plan-year").getAttribute("aria-checked")') == 'true' and (await text(C, '#btn-pro-buy')) == 'Try 7 days free' and 'Then $29.99 a year' in (await text(C, '#pro-fine')), await text(C, '#btn-pro-buy'))
            ok('no prototype note, no test note', not await has(C, '#pro-proto') and not await has(C, '#pro-test'))
            if SHOTS: await C.wait_for_timeout(500); await C.screenshot(path=SHOT_DIR + '/pro-sheet.png')
            # buying: a saved account first
            await C.click('#plan-month'); await C.wait_for_timeout(150)
            ok('the month on the button', (await text(C, '#btn-pro-buy')) == 'Get Pro for $3.99 a month')
            await C.click('#btn-pro-buy'); await C.wait_for_timeout(600)
            ok('a visitor saves an account first', (await kind(C)) == 'save-ask' and (await text(C, '.veil .dlg-title')) == 'Save your account first' and 'every device' in (await text(C, '.veil .dlg-sub')), await text(C, '.veil .dlg-title'))
            ok('they sign in', await sign_in(C, 'cat@example.com', 'Cat'))
            await wait_for(C, '__gc.dialogKind === "pro"', 8000); await prep(C)
            ok('and are back on the sheet, the month still picked', (await kind(C)) == 'pro' and await C.evaluate('document.getElementById("plan-month").getAttribute("aria-checked")') == 'true' and (await text(C, '#pro-art .pro-nm')) == 'Cat', await kind(C))
            uidC = await C.evaluate('__gc.me.uid')
            # the payment page, left without paying
            await C.click('#btn-pro-buy')
            await C.wait_for_url('**/pay/checkout**', timeout=8000)
            ok('the payment page is the month\'s', '$3.99 / month' in (await text(C, '#price')), await text(C, '#price'))
            await C.click('#back'); await C.wait_for_url(BASE + '**', timeout=8000); await C.wait_for_timeout(600); await prep(C)
            ok('back without paying: no Pro, a clean address', (await pro(C))['on'] is False and 'pro=' not in await C.evaluate('location.href') and not await C.evaluate('__gc.dialogOpen'), await C.evaluate('location.href'))
            # the year, with its trial
            await C.evaluate('__gc.proSheet()'); await C.wait_for_timeout(500)
            await C.click('#btn-pro-buy')
            await C.wait_for_url('**/pay/checkout**', timeout=8000)
            ok('the year starts with seven days free', '7 days free, then $29.99 / year' in (await text(C, '#price')), await text(C, '#price'))
            await C.click('#pay'); await C.wait_for_url(BASE + '**', timeout=8000); await C.wait_for_timeout(500); await prep(C)
            ok('paid: back in the game, Pro on, welcomed', await wait_for(C, '__gc.dialogKind === "pro-welcome"', 9000) and (await pro(C))['on'] is True and 'pro=' not in await C.evaluate('location.href') and 'sid=' not in await C.evaluate('location.href'), await pro(C))
            ok('the welcome: the seal and the gold name', await has(C, '.pro-welcome .pro-seal.big svg') and await has(C, '.pro-welcome .pro-who.big .pro-mark') and await C.evaluate('getComputedStyle(document.querySelector(".pro-welcome .pro-nm")).color') == GOLD)
            if SHOTS: await C.wait_for_timeout(600); await C.screenshot(path=SHOT_DIR + '/pro-welcome.png')
            await C.click('#btn-pro-ok'); await C.wait_for_timeout(300)

            # ================================================================ 4. what Pro turns on
            await C.evaluate('__gc.go("play")'); await C.wait_for_timeout(300)
            ok('the name on the Play tab is gold', await C.evaluate('getComputedStyle(document.querySelector("#acct-chip.pro > span:last-child")).color') == GOLD)
            await C.evaluate('__gc.go("profile")'); await C.wait_for_timeout(400)
            ok('the Profile: the gold name, the mark, the plan', await has(C, '#prof-name.pro .pro-mark') and await has(C, '#pro-entry.on') and 'Free trial until' in (await text(C, '#pro-entry')) and 'Manage' in (await text(C, '#pro-entry')), await text(C, '#pro-entry'))
            await C.click('#pro-entry'); await C.wait_for_timeout(500)
            tiles = await C.evaluate('Array.from(document.querySelectorAll("#pro-tiles .st-tile")).map(function (t) { return t.textContent.replace(/\\s+/g, " ").trim(); })')
            ok('the status: the card, the plan, four numbers, the way to the subscription', (await kind(C)) == 'pro-manage' and await has(C, '.pro-manage #pro-art') and 'Free trial until' in (await text(C, '#pro-plan-line')) and 'Then $29.99 a year' in (await text(C, '#pro-plan-line'))
               and len(tiles) == 4 and (await text(C, '#btn-pro-portal')) == 'Manage the subscription' and not await has(C, '#btn-pro-off'), [await text(C, '#pro-plan-line'), tiles])
            if SHOTS: await C.wait_for_timeout(500); await C.screenshot(path=SHOT_DIR + '/pro-status.png')
            await close_all(C)
            ok('a review is whole, no card', await missed_game(C) and not await has(C, '#btn-jk') and not await has(C, '#jk-more') and await has(C, '.rp-miss') and (await pro(C))['blind'] is False)
            await close_all(C)
            await C.evaluate('__gc.startGame({ mode: "bot", level: 2, bot: "mila", color: "w", tc: "none" })'); await C.wait_for_timeout(400)
            await C.click('#btn-menu'); await C.wait_for_timeout(250)
            ok('hints without a counter', (await text(C, '.menu-list button.hint')) == 'Hint')
            ok('the mark next to the own name in a game', await C.evaluate('document.querySelectorAll(".pname .pro-mark").length') == 1)
            await close_all(C)
            # the pack and the marathon
            await C.evaluate('localStorage.setItem("goldenchess.puzzles", JSON.stringify({ i1: 1, i2: 1, i3: 1 })); localStorage.setItem("goldenchess.dailyAuto", new Date().toISOString().slice(0, 10))')
            await C.reload(); await C.wait_for_timeout(700); await prep(C)
            await wait_for(C, '!!__gc.me', 6000)
            await C.evaluate('__gc.go("learn")'); await C.wait_for_timeout(500)
            total = await C.evaluate('GCLearn.PUZZLES.length + GCLearn.PACK.length')
            ok('the series goes on into the pack', await C.evaluate('GCLearn.PACK.length') > 0 and ('of %d' % total) in (await text(C, '.try-count') or ''), await text(C, '.try-count'))
            ok('the way into the marathon', await C.evaluate('!document.getElementById("pack-line").hidden') and await has(C, '#pack-line.on') and 'Marathon' in (await text(C, '#pack-line')), await text(C, '#pack-line'))
            await C.click('#pack-line'); await C.wait_for_timeout(500)
            ok('the marathon starts on an easy puzzle, none in a row yet', 'Marathon' in (await text(C, '.try-title')) and 'Easy' in (await text(C, '.try-title')) and '0 in a row' in (await text(C, '.try-count')) and await has(C, '#run-exit'), await text(C, '.try-count'))
            if SHOTS: await C.wait_for_timeout(500); await C.screenshot(path=SHOT_DIR + '/pro-marathon.png')
            first = await text(C, '.try-prompt')
            # the answer shown: it counts as none; then the next one comes by itself
            await C.click('#try-answer')
            ok('an answer shown is not one in a row', await wait_for(C, '!!document.getElementById("try-next")', 9000) and '0 in a row' in (await text(C, '.try-count')))
            fen1 = await C.evaluate('document.querySelector("#try-board") ? document.querySelector("#try-board").innerHTML.length : 0')
            ok('the next puzzle comes by itself', await wait_for(C, '!document.getElementById("try-next")', 6000))
            await C.click('#run-exit'); await C.wait_for_timeout(400)
            ok('leaving goes back to the series', 'Puzzle' in (await text(C, '.try-title')) and not await has(C, '#run-exit'), await text(C, '.try-title'))

            # ================================================================ 5. the subscription's page
            await C.evaluate('__gc.proStatus()'); await C.wait_for_timeout(400)
            await C.click('#btn-pro-portal')
            await C.wait_for_url('**/pay/portal**', timeout=8000)
            ok('the subscription\'s own page opens', 'subscription page' in (await C.title()).lower() and admin('paylog')['portal'] == [uidC])
            await C.click('#cancel'); await C.wait_for_url(BASE + '**', timeout=8000); await C.wait_for_timeout(600); await prep(C)
            await wait_for(C, '!!__gc.me', 6000)
            await C.evaluate('__gc.proStatus()'); await C.wait_for_timeout(700)
            ok('cancelled: Pro stays to the end of what was paid, and says so', (await pro(C))['on'] is True and await wait_for(C, '/No more payments/.test((document.getElementById("pro-plan-line") || {}).textContent || "")', 5000), await text(C, '#pro-plan-line'))
            await close_all(C)
            # deleting the account under a running subscription
            admin('pro', uid=uidC, days=30, plan='year', sub=True, trialUsed=True)
            await C.reload(); await C.wait_for_timeout(700); await prep(C); await wait_for(C, '!!__gc.me', 6000)
            await C.evaluate('__gc.go("profile")'); await C.wait_for_timeout(400)
            await C.evaluate('document.getElementById("btn-delete-acct").click()'); await C.wait_for_timeout(350)
            await C.click('#btn-delete-confirm')
            ok('an account with a running subscription is not deleted: cancel first', await wait_for(C, '/Cancel your Joker Pro subscription first/.test((document.getElementById("delete-err") || {}).textContent || "")', 5000)
               and len([x for x in admin('profiles') if x['id'] == uidC]) == 1, await text(C, '#delete-err'))
            await close_all(C)

            # ================================================================ 6. Pro runs out; the trial is used
            admin('pro', uid=uidC, days=-1, plan='year', sub=False, trialUsed=True, status='canceled')
            await C.reload(); await C.wait_for_timeout(700); await prep(C); await wait_for(C, '!!__gc.me', 6000)
            st = await pro(C)
            ok('Pro over: off again, still sold', st['on'] is False and st['sells'] is True, st)
            await C.evaluate('__gc.go("profile")'); await C.wait_for_timeout(300)
            ok('the name is plain again, the Profile offers Pro', not await has(C, '#prof-name .pro-mark') and await has(C, '#pro-entry') and not await has(C, '#pro-entry.on'))
            await C.click('#pro-entry'); await C.wait_for_timeout(300)
            ok('no second trial: the year is paid from the start', await wait_for(C, '(document.getElementById("btn-pro-buy") || {}).textContent === "Get Pro for $29.99 a year"', 5000) and (await text(C, '#pro-fine')) == 'Cancel any time.', await text(C, '#btn-pro-buy'))
            # a Founder
            admin('founders', n=998)
            await close_all(C); await C.evaluate('__gc.proSheet()'); await C.wait_for_timeout(300)
            ok('the Founder places left are real', await wait_for(C, '/2 places left/.test((document.querySelector("#plan-founder .pf-sub") || {}).textContent || "")', 5000), await text(C, '#plan-founder'))
            await C.click('#plan-founder'); await C.wait_for_timeout(150)
            ok('a Founder: one payment on the button', (await text(C, '#btn-pro-buy')) == 'Become a Founder for $79.99' and 'One payment' in (await text(C, '#pro-fine')))
            await C.click('#btn-pro-buy'); await C.wait_for_url('**/pay/checkout**', timeout=8000)
            ok('the payment page is one payment', '$79.99 once' in (await text(C, '#price')))
            await C.click('#pay'); await C.wait_for_url(BASE + '**', timeout=8000); await C.wait_for_timeout(500); await prep(C)
            ok('a Founder: Pro for life, the Founder\'s mark', await wait_for(C, '__gc.dialogKind === "pro-welcome"', 9000) and (await pro(C))['founder'] is True and await has(C, '.pro-welcome .pro-mark.founder'), await pro(C))
            await C.click('#btn-pro-ok'); await C.wait_for_timeout(250)
            await C.evaluate('__gc.proStatus()'); await C.wait_for_timeout(600)
            ok('the status of a Founder: for life, receipts', 'Pro for life' in (await text(C, '#pro-plan-line')) and (await text(C, '#btn-pro-portal')) == 'Receipts' and await has(C, '#pro-art.founder'), await text(C, '#pro-plan-line'))
            await close_all(C)
            if SHOTS: await C.evaluate('__gc.proStatus()'); await C.wait_for_timeout(800); await C.screenshot(path=SHOT_DIR + '/pro-status-founder.png'); await close_all(C)

            # ================================================================ 7. other players: the gold name
            admin('rate', uid=uidC, pool='blitz', rating=1700, games=12, wins=8)
            admin('rate', uid=uidB, pool='blitz', rating=1600, games=9, wins=4)
            ctx2 = await br.new_context(**phone)
            D = await open_page(ctx2, 'D')
            ok('another player signs in', await account(D, 'dan@example.com', 'Dan'))
            await D.evaluate('__gc.go("ratings")'); await D.wait_for_timeout(900)
            rows = await D.evaluate('Array.from(document.querySelectorAll(".lb-name")).map(function (n) { var nm = n.querySelector(".lb-nm"); return { name: nm ? nm.textContent : "", mark: !!n.querySelector(".pro-mark"), founder: !!n.querySelector(".pro-mark.founder"), color: nm ? getComputedStyle(nm).color : "" }; })')
            cat = [r for r in rows if r['name'] == 'Cat']; bob = [r for r in rows if r['name'] == 'Bob']
            ok('the leaderboard: a Founder\'s name is gold with the mark, a free player\'s is not', len(cat) == 1 and cat[0]['mark'] and cat[0]['founder'] and cat[0]['color'] == GOLD and len(bob) == 1 and not bob[0]['mark'] and bob[0]['color'] != GOLD, rows)
            await D.evaluate('__gc.go("profile")'); await D.wait_for_timeout(300)
            ok('their own name stays plain', not await has(D, '#prof-name .pro-mark'))
            await ctx2.close()

            # ================================================================ 8. inside the app: nothing is sold
            ctxN = await br.new_context(**phone)
            N = await open_page(ctxN, 'N', native=True)
            ok('a player signs in inside the app', await account(N, 'nat@example.com', 'Nat'))
            st = await pro(N)
            ok('the app sells nothing', st['sells'] is False and st['avail'] is False and await N.evaluate('__gc.me.pro') == 'on', st)
            await N.evaluate('__gc.go("profile")'); await N.wait_for_timeout(300)
            ok('the app: no line about Pro, no mark', not await has(N, '#pro-entry') and not await has(N, '.pro-mark'))
            ok('the app: a review is whole, nothing asks for Pro', await missed_game(N) and not await has(N, '#btn-jk') and not await has(N, '#jk-more') and await has(N, '.rp-miss'))
            await close_all(N)
            await N.evaluate('__gc.proSheet("check")'); await N.wait_for_timeout(300)
            ok('the app: the Pro sheet never opens', not await N.evaluate('__gc.dialogOpen'))
            await N.evaluate('__gc.go("play")'); await N.wait_for_timeout(300)
            ok('the app: no line about Pro on the Play tab', not await has(N, '#pro-banner'))
            # an account that has Pro from the website
            uidN = await N.evaluate('__gc.me.uid')
            admin('pro', uid=uidN, days=200, plan='year', sub=True)
            await N.reload(); await N.wait_for_timeout(700); await prep(N); await wait_for(N, '!!__gc.me', 6000)
            st = await pro(N)
            ok('the app honours Pro bought on the website', st['on'] is True and st['sells'] is False and st['avail'] is True, st)
            await N.evaluate('__gc.go("profile")'); await N.wait_for_timeout(300)
            ok('the app: the gold name and the status, without a way to any payment page', await has(N, '#prof-name.pro .pro-mark') and await has(N, '#pro-entry.on'))
            await N.click('#pro-entry'); await N.wait_for_timeout(400)
            ok('the app: the status has no button that leaves for Stripe', (await kind(N)) == 'pro-manage' and not await has(N, '#btn-pro-portal') and await has(N, '#btn-pro-ins'))
            await ctxN.close()

            # ================================================================ 9. the offers nobody asked for
            day = lambda k: time.strftime('%Y-%m-%d', time.localtime(time.time() + k * 86400))
            # a guest who has played before, Pro first seen three days ago, the other asks used up
            seed = dict(proOffer=dict(first=day(-3)), gamesDone=5, saveAsk=dict(n=3, at=0), days=[day(-3), day(-2)], proTally=dict(would=140))
            ctxO = await br.new_context(**phone)
            O = await open_page(ctxO, 'O', store=seed, noask=False)
            await wait_for(O, '__gc.pro.sells === true', 5000)
            await O.evaluate('__gc.go("learn"); __gc.go("play")'); await O.wait_for_timeout(500)
            ok('a returning player: one quiet line about Pro on the Play tab', await has(O, '#pro-banner') and 'Joker Pro' in (await text(O, '#pro-banner .pb-t b')) and not await O.evaluate('__gc.dialogOpen'), await text(O, '#pro-banner'))
            fits = await O.evaluate('(function () { var v = document.getElementById("view-play"); return v.scrollHeight - v.clientHeight; })()')
            ok('the Play tab still fits the phone', fits <= 2, fits)
            if SHOTS: await O.wait_for_timeout(500); await O.screenshot(path=SHOT_DIR + '/pro-banner.png')
            of = (await pro(O))['offer']
            ok('it is on record as an offer', of.get('last') == day(0) and of.get('n') == 1 and of['banner']['id'] == 'plain', of)
            await O.evaluate('__gc.go("learn"); __gc.go("play")'); await O.wait_for_timeout(300)
            ok('the same line stays for the day, counted once', await has(O, '#pro-banner') and (await pro(O))['offer']['n'] == 1)
            await one_game(O); await O.wait_for_timeout(2600)
            ok('no sheet on top of it the same day', not await O.evaluate('__gc.dialogOpen'), await kind(O))
            await O.click('#pro-banner-x'); await O.wait_for_timeout(250)
            of = (await pro(O))['offer']
            ok('hidden with one tap, and counted as closed', not await has(O, '#pro-banner') and of.get('skips') == 1 and of['banner'].get('off') is True, of)
            await O.evaluate('__gc.go("learn"); __gc.go("play")'); await O.wait_for_timeout(300)
            ok('it stays hidden', not await has(O, '#pro-banner'))
            await O.evaluate('__gc.proSheet()'); await O.wait_for_timeout(400)
            ok('the sheet says what Pro would have given this player', re.search(r'you would have 14\d XP more by now', await text(O, '#pro-why') or ''), await text(O, '#pro-why'))
            await ctxO.close()
            # a streak that ran out and that a freeze would bring back: the sheet after a finished game
            seed = dict(proOffer=dict(first=day(-9), last=day(-4), n=1), gamesDone=7, saveAsk=dict(n=3, at=0), days=[day(-9), day(-8), day(-7), day(-6)])
            ctxS = await br.new_context(**phone)
            Sg = await open_page(ctxS, 'S', store=seed, noask=False)
            await wait_for(Sg, '__gc.pro.sells === true', 5000)
            await Sg.evaluate('__gc.go("learn"); __gc.go("play")'); await Sg.wait_for_timeout(400)
            ok('a streak that ran out: on the Play tab it is the line', '4-day streak ran out' in (await text(Sg, '#pro-banner .pb-t b') or '') and (await pro(Sg))['offer']['seen'].get('streak') == day(0), await text(Sg, '#pro-banner'))
            await Sg.evaluate('document.getElementById("streak-chip") ? 0 : __gc.go("play")')
            await Sg.click('#pro-banner-go'); await Sg.wait_for_timeout(450)
            ok('a tap on the line opens the Pro sheet with that reason', (await kind(Sg)) == 'pro' and 'streak back right now' in (await text(Sg, '#pro-why')) and not (await pro(Sg))['offer'].get('skips'), await text(Sg, '#pro-why'))
            await ctxS.close()
            ctxS = await br.new_context(**phone)
            Sg = await open_page(ctxS, 'S2', store=dict(seed, proOffer=dict(first=day(-9), last=day(-4), n=1, banner=dict(id='plain', day=day(0), off=True))), noask=False)
            await wait_for(Sg, '__gc.pro.sells === true', 5000)
            await one_game(Sg)
            got = await wait_for(Sg, '__gc.dialogKind === "pro-offer"', 6000)
            ok('after a finished game, back on the Play tab: the offer, about the streak', got and '4-day streak ran out' in (await text(Sg, '#pro-offer-t') or '') and (await text(Sg, '#btn-offer-go')) == 'Bring it back with Pro' and await has(Sg, '.pro-offer .pro-seal.big'), await text(Sg, '.veil .sheetdlg'))
            if SHOTS: await Sg.wait_for_timeout(600); await Sg.screenshot(path=SHOT_DIR + '/pro-offer.png')
            await Sg.click('#btn-offer-go'); await Sg.wait_for_timeout(500)
            of = (await pro(Sg))['offer']
            ok('its button opens the Pro sheet with the same reason', (await kind(Sg)) == 'pro' and 'streak back right now' in (await text(Sg, '#pro-why')) and of['seen'].get('streak') == day(0) and not of.get('skips'), [await text(Sg, '#pro-why'), of])
            await close_all(Sg)
            await one_game(Sg); await Sg.wait_for_timeout(2600)
            ok('no second offer after the next game', not await Sg.evaluate('__gc.dialogOpen'), await kind(Sg))
            await ctxS.close()
            # closed three times in a row: a rest
            ctxR = await br.new_context(**phone)
            R = await open_page(ctxR, 'R', store=dict(proOffer=dict(first=day(-30), last=day(-8), n=3, skips=2, banner=dict(id='plain', day=day(0), off=True)), gamesDone=9, saveAsk=dict(n=3, at=0)), noask=False)
            await wait_for(R, '__gc.pro.sells === true', 5000)
            await one_game(R)
            ok('the plain offer after a week', await wait_for(R, '__gc.dialogKind === "pro-offer"', 6000) and (await text(R, '#btn-offer-go')) == 'See what Pro gives')
            await R.click('#btn-offer-later'); await R.wait_for_timeout(300)
            of = (await pro(R))['offer']
            ok('closed for the third time in a row: the offers rest for two weeks', of.get('rest') == day(14) and of.get('skips') == 0, of)
            await ctxR.close()
            # a newcomer: nothing
            ctxF = await br.new_context(**phone)
            F = await open_page(ctxF, 'F', noask=False)
            await wait_for(F, '__gc.pro.sells === true', 5000)
            await one_game(F); await one_game(F); await one_game(F); await F.wait_for_timeout(2600)
            ok('a newcomer\'s first day: no line, no offer', not await has(F, '#pro-banner') and (await kind(F)) != 'pro-offer' and (await pro(F))['offer'].get('n') is None, [await kind(F), (await pro(F))['offer']])
            await ctxF.close()
            await ctx.close()
            await br.close()
    finally:
        srv.terminate()
    bad = {k: v for k, v in errs.items() if v}
    ok('no page errors', not bad, bad)
    n = sum(1 for _, c in results if c)
    print(f'pro_pay_e2e: {n} passed, {len(results) - n} failed')
    sys.exit(0 if n == len(results) else 1)

asyncio.run(main())
