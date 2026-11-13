# Opt-ins made easy, through the local test server: the emails box is ticked on every sign-in (and an earlier "no" is
# never overridden by it), one ask after a finished game once the player has left the board (the reminders in the
# app, the weekly email for a saved account that never answered, saving the progress for a guest), the reminders
# never ask Android for exact alarms, and a phone that already allows notifications gets them without an ask.
# Run: python3 test/optin_e2e.py   (after node build.js; SHOTS=1 also saves screenshots)
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8796
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

def last_code(email):
    msgs = admin('outbox', to=email)
    return msgs[-1]['code'] if msgs else None

def opt_of(uid):
    p = [x for x in admin('profiles') if x['id'] == uid]
    return p[0].get('email_opt') if p else 'missing'

def start_server():
    env = dict(os.environ, MOCK_LATENCY='40')
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1).read(); return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('server did not start')

# the app's bridge with the phone's own side of the notifications behind it, as each platform's plugin really treats a
# planned time (localStorage 'test.platform': android unless told otherwise):
#   Android: the bridge sends the call as JSON text; the plugin reads the time as text, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
#   iPhone:  the bridge hands the call over as it is; the plugin takes the time only as a real date (NSDate) that is
#            still ahead. A time it cannot read is no time at all: the notification is shown at once
# __phone: pending (id → { at, title }), shown (what came up at once), cleared (times the shown ones were taken away).
# The permission answers "prompt" until allowed (test.perm).
FAKE_CAP = r"""
window.__capCalls = []; window.__capListeners = {};
window.__phone = { pending: {}, shown: [], cleared: 0 };
(function () {
  // (asked each time: the test's own settings are put in after this script)
  function plat() { return localStorage.getItem('test.platform') || 'android'; }
  function planned(n) {
    var at = n.schedule && n.schedule.at;
    if (plat() === 'ios') return at instanceof Date && !isNaN(at.getTime()) && at.getTime() > Date.now() ? at.getTime() : null;
    return typeof at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at) && Date.parse(at) > Date.now() ? Date.parse(at) : null;
  }
  window.Capacitor = {
    isNativePlatform: function () { return true; },
    getPlatform: function () { return plat(); },
    isPluginAvailable: function (p) { return ['App', 'SplashScreen', 'StatusBar', 'Share', 'Browser', 'Haptics', 'LocalNotifications'].indexOf(p) >= 0; },
    nativePromise: function (plugin, method, opts) {
      var seen = plat() === 'ios' ? (opts || {}) : JSON.parse(JSON.stringify(opts || {}));
      window.__capCalls.push([plugin, method, JSON.parse(JSON.stringify(opts || {}))]);
      if (plugin === 'LocalNotifications' && method === 'checkPermissions') return Promise.resolve({ display: localStorage.getItem('test.perm') || 'prompt' });
      if (plugin === 'LocalNotifications' && method === 'requestPermissions') { localStorage.setItem('test.perm', 'granted'); return Promise.resolve({ display: 'granted' }); }
      if (plugin === 'LocalNotifications' && method === 'cancel') { (seen.notifications || []).forEach(function (n) { delete window.__phone.pending[n.id]; }); return Promise.resolve({}); }
      if (plugin === 'LocalNotifications' && method === 'schedule') {
        (seen.notifications || []).forEach(function (n) {
          var when = planned(n);
          if (when === null) window.__phone.shown.push({ id: n.id, title: n.title }); else window.__phone.pending[n.id] = { at: when, title: n.title };
        });
        return Promise.resolve({ notifications: (seen.notifications || []).map(function (n) { return { id: n.id }; }) });
      }
      if (plugin === 'LocalNotifications' && method === 'removeAllDeliveredNotifications') { window.__phone.cleared++; window.__phone.shown = []; return Promise.resolve({}); }
      return Promise.resolve({});
    },
    addListener: function (plugin, ev, cb) { var k = plugin + '.' + ev; (window.__capListeners[k] = window.__capListeners[k] || []).push(cb); return { remove: function () {} }; }
  };
})();
"""

async def main():
    srv = start_server()
    errs = {}
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            phone = dict(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)

            async def open_page(ctx, name, native=False, store=None):
                pg = await ctx.new_page()
                errs.setdefault(name, [])
                pg.on('pageerror', lambda e: errs[name].append(str(e)))
                pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
                if native: await pg.add_init_script(FAKE_CAP)
                if store:
                    await pg.add_init_script('(function () { if (localStorage.getItem("seeded")) return; var s = %s; for (var k in s) localStorage.setItem(k, s[k]); localStorage.setItem("seeded", "1"); })()' % json.dumps(store))
                await pg.goto(BASE); await pg.evaluate(HELPERS); await pg.evaluate('window.__gcNoAsk = false')
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

            # a finished two-player game on this device (two moves, then a resignation), and back to the Play tab
            async def one_game(pg):
                await pg.evaluate('''() => {
                    __gc.closeDialog();
                    __gc.startGame({ mode: 'local', color: 'w', tc: 'none' });
                    for (const u of ['e2e4', 'e7e5']) { const m = __gc.game.pos.moveFromUci(u); __gc.tryMove(m & 127, (m >> 7) & 127, false); }
                }''')
                await wait_for(pg, '__gc.game.records.length === 2', 3000)
                await pg.evaluate('__gc.game.end("1-0", "resign", performance.now()); __gc.gameOver()')
                await pg.wait_for_timeout(400)
                await pg.evaluate('__gc.closeDialog(); __gc.go("play")')

            async def code_in(pg, email, name=None):
                if not await wait_for(pg, '!!document.getElementById("acct-code")', 5000): return False
                await pg.fill('#acct-code', last_code(email))
                if name:
                    if not await wait_for(pg, '!!document.getElementById("acct-name")', 5000): return False
                    await pg.fill('#acct-name', name); await pg.click('#btn-name')
                    return await wait_for(pg, '__gc.me && __gc.me.profile && __gc.me.profile.username === %s' % json.dumps(name), 5000)
                done = await wait_for(pg, '!!window.__gc && !!__gc.me && __gc.me.email === %s' % json.dumps(email.lower()), 9000)
                await pg.evaluate(HELPERS); await pg.evaluate('window.__gcNoAsk = false')
                return done

            # ================= 1. a guest on the website
            ctx = await br.new_context(**phone)
            A = await open_page(ctx, 'A')
            await A.evaluate('__gc.showAccount()')
            await wait_for(A, '!!document.getElementById("acct-opt-box")', 4000)
            st = await A.evaluate('''(() => { const b = document.getElementById("acct-opt-box"), card = b.closest(".dlg, .sheet, [role=dialog]") || document.body;
                const opt = document.getElementById("acct-opt"), form = document.querySelector(".acct-form");
                return { checked: b.checked, pend: localStorage.getItem("goldenchess.emailOptPending"), afterForm: !!(form && (form.compareDocumentPosition(opt) & Node.DOCUMENT_POSITION_FOLLOWING)), inForm: !!(form && form.contains(opt)) }; })()''')
            ok('sign-in: the emails box is ticked from the start', st['checked'] and st['pend'] == 'true', st)
            ok('sign-in: the box sits under every way in, not inside the email form', st['afterForm'] and not st['inForm'], st)
            if SHOTS: await A.wait_for_timeout(700); await A.screenshot(path=SHOT_DIR + '/optin-signin.png')
            await A.click('#acct-opt-box')
            ok('sign-in: one tap unticks it (kept at once, for Google\'s own button too)', await A.evaluate('localStorage.getItem("goldenchess.emailOptPending")') == 'false')
            await A.click('#acct-opt-box')
            await A.evaluate('__gc.closeDialog()')

            await one_game(A)
            await A.wait_for_timeout(2500)
            ok('first finished game on the website: no ask yet', not await A.evaluate('__gc.dialogOpen'), await A.evaluate('__gc.dialogKind'))
            await one_game(A)
            got = await wait_for(A, '__gc.dialogKind === "save-ask"', 5000)
            title = await A.evaluate('(document.querySelector(".dlg-title") || {}).textContent || ""')
            ok('second finished game, back on Play: "Save your progress?" with the emails box ticked', got and 'Save your progress' in title and await A.evaluate('document.getElementById("acct-opt-box").checked'), [title, await A.evaluate('__gc.dialogKind')])
            if SHOTS: await A.wait_for_timeout(700); await A.screenshot(path=SHOT_DIR + '/optin-save-ask.png')
            await A.fill('#acct-email', 'gus@example.com'); await A.click('#btn-send-code')
            ok('the guest saves the account from the ask', await code_in(A, 'gus@example.com', 'Gus'))
            uidA = await A.evaluate('__gc.me.uid')
            ok('and the emails are on for them', await wait_for(A, 'true', 300) and await wait_for(A, '__gc.me.profile.email_opt === true', 5000) and opt_of(uidA) is True, opt_of(uidA))
            await one_game(A); await A.wait_for_timeout(2500)
            ok('a saved account that said yes: nothing more to ask', not await A.evaluate('__gc.dialogOpen'), await A.evaluate('__gc.dialogKind'))
            await ctx.close()

            # ================= 2. a saved account that never answered: the weekly email in one tap after a game
            ctx = await br.new_context(**phone)
            B = await open_page(ctx, 'B')
            await B.evaluate('__gc.go("signin")')
            await wait_for(B, '!!document.getElementById("acct-email")', 4000); await B.wait_for_timeout(1100)
            await B.fill('#acct-email', 'nia@example.com'); await B.click('#btn-send-code')
            await wait_for(B, '!!document.getElementById("acct-code")', 5000)
            await B.evaluate('localStorage.removeItem("goldenchess.emailOptPending")')  # as an account saved before the box was ticked
            ok('an account with no answer', await code_in(B, 'nia@example.com', 'Nia') and await wait_for(B, '__gc.me.profile.email_opt === null', 3000))
            uidB = await B.evaluate('__gc.me.uid')
            await B.evaluate('__gc.closeDialog()')
            await one_game(B)
            got = await wait_for(B, '__gc.dialogKind === "email-ask"', 5000)
            ok('after a game, back on Play: "Your week by email?" with one bright button', got and await B.evaluate('!!document.getElementById("btn-email-ask-yes") && !!document.getElementById("btn-email-ask-later")'), await B.evaluate('__gc.dialogKind'))
            if SHOTS: await B.wait_for_timeout(700); await B.screenshot(path=SHOT_DIR + '/optin-email-ask.png')
            await B.click('#btn-email-ask-yes')
            ok('one tap: emails on', await wait_for(B, '!__gc.dialogOpen && __gc.me.profile.email_opt === true', 5000) and opt_of(uidB) is True, opt_of(uidB))
            # an earlier "no" stays a no: off in Settings, sign out, sign in again with the box ticked
            await B.evaluate('__gc.closeDialog(); __gc.showSettings()')
            await wait_for(B, '!!document.getElementById("set-email")', 4000)
            await B.click('#set-email')
            ok('turned off in Settings', await wait_for(B, 'true', 300) and await wait_for(B, '__gc.me.profile.email_opt === false', 4000) and opt_of(uidB) is False, opt_of(uidB))
            await B.evaluate('__gc.closeDialog(); __gc.showAccount()')
            await wait_for(B, '!!document.getElementById("btn-signout")', 3000)
            await B.click('#btn-signout')
            await wait_for(B, '!!window.__gc && __gc.me && __gc.me.guest === true', 9000); await B.evaluate(HELPERS); await B.evaluate('window.__gcNoAsk = false')
            admin('shift', ms=61000)
            await B.evaluate('__gc.go("signin")')
            await wait_for(B, '!!document.getElementById("acct-email")', 4000); await B.wait_for_timeout(1100)
            ticked = await B.evaluate('document.getElementById("acct-opt-box").checked')
            await B.fill('#acct-email', 'nia@example.com'); await B.click('#btn-send-code')
            back = await code_in(B, 'nia@example.com')
            await B.wait_for_timeout(1500)
            ok('signing in again with the box ticked keeps the earlier no', ticked and back and opt_of(uidB) is False, [ticked, back, opt_of(uidB)])
            await ctx.close()

            # ================= 3. the Android app, notifications not allowed yet: the reminders ask after the first game
            ctx = await br.new_context(**phone)
            C = await open_page(ctx, 'C', native=True)
            await C.wait_for_timeout(1800)
            ok('app: nothing is asked or turned on at launch', await C.evaluate('__gc.settings.reminders == null && !__gc.dialogOpen'))
            await one_game(C)
            got = await wait_for(C, '__gc.dialogKind === "remind"', 5000)
            ok('app: after the first finished game, back on Play: the reminders ask', got and await C.evaluate('!!document.getElementById("btn-remind-on")'), await C.evaluate('__gc.dialogKind'))
            if SHOTS: await C.wait_for_timeout(700); await C.screenshot(path=SHOT_DIR + '/optin-remind-ask.png')
            await C.click('#btn-remind-on')
            ok('app: one tap asks the phone, reminders on', await wait_for(C, '__gc.settings.reminders === true', 4000) and await C.evaluate('__capCalls.some(c => c[0] === "LocalNotifications" && c[1] === "requestPermissions")'))
            ok('app: reminders planned', await wait_for(C, '__capCalls.some(c => c[0] === "LocalNotifications" && c[1] === "schedule" && c[2].notifications.length > 0)', 4000))
            sched = await C.evaluate('__capCalls.filter(c => c[0] === "LocalNotifications" && c[1] === "schedule").pop()[2].notifications')
            ok('app: no exact alarms (Android never opens its "Alarms & reminders" screen)', sched and all(n.get('isExactNotification') is False for n in sched), sched[:1])
            ph = await C.evaluate('JSON.parse(JSON.stringify(__phone))')
            ok('app: Android reads every time: nothing comes up at once, the plan waits in the phone', ph['shown'] == [] and len(ph['pending']) >= 5, ph)
            await one_game(C); await C.wait_for_timeout(2500)
            ok('app: one ask is enough for a while (nothing after the next game)', not await C.evaluate('__gc.dialogOpen'), await C.evaluate('__gc.dialogKind'))
            await ctx.close()

            # ================= 4. the Android app on a phone that already allows notifications (Android 12 and older)
            ctx = await br.new_context(**phone)
            D = await open_page(ctx, 'D', native=True, store={'test.perm': 'granted'})
            ok('app, notifications allowed: reminders on at launch without an ask', await wait_for(D, '__gc.settings.reminders === true', 5000) and not await D.evaluate('__gc.dialogOpen')
               and not await D.evaluate('__capCalls.some(c => c[0] === "LocalNotifications" && c[1] === "requestPermissions")'))
            await one_game(D); await D.wait_for_timeout(2500)
            ok('app, notifications allowed: no reminders ask after a game either', await D.evaluate('__gc.dialogKind') != 'remind')
            await ctx.close()

            # ================= 5. the iPhone app: its plugin takes a planned time only as a real date. A time it cannot
            # read makes it show the notification at once: all of them, every time the app goes to the background
            ctx = await br.new_context(**phone)
            E = await open_page(ctx, 'E', native=True, store={'test.platform': 'ios'})
            ok('iPhone: the page knows it is in the iPhone app', await E.evaluate('window.Capacitor.getPlatform()') == 'ios')
            await one_game(E)
            got = await wait_for(E, '__gc.dialogKind === "remind"', 5000)
            if got: await E.click('#btn-remind-on')
            ok('iPhone: reminders on after the ask', got and await wait_for(E, '__gc.settings.reminders === true', 4000))
            await wait_for(E, 'Object.keys(__phone.pending).length > 0 || __phone.shown.length > 0', 4000)
            ph = await E.evaluate('JSON.parse(JSON.stringify(__phone))')
            ok('iPhone: nothing comes up at once: every reminder waits for its own time', ph['shown'] == [], ph['shown'])
            times = sorted(v['at'] for v in ph['pending'].values()); now_ms = await E.evaluate('Date.now()')
            days = [time.strftime('%Y-%m-%d', time.localtime(t / 1000)) for t in times]
            ok('iPhone: the plan is in the phone: several reminders, all ahead, the first not before tomorrow', len(times) >= 5 and all(t > now_ms for t in times) and times[0] - now_ms > 3 * 3600e3, [len(times), days[:3]])
            ok('iPhone: one a day at most', len(set(days)) == len(days), days)
            # the app goes to the background and comes back, twice: the plan is made again each time
            for _ in range(2):
                await E.evaluate('(function () { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); })()')
                await E.wait_for_timeout(400)
                await E.evaluate('(function () { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); })()')
                await E.wait_for_timeout(300)
            ph2 = await E.evaluate('JSON.parse(JSON.stringify(__phone))')
            n_sched = await E.evaluate('__capCalls.filter(c => c[0] === "LocalNotifications" && c[1] === "schedule").length')
            ok('iPhone: planned again when the app is left, and still nothing comes up at once', n_sched >= 3 and ph2['shown'] == [] and len(ph2['pending']) == len(ph['pending']), [n_sched, ph2['shown'], len(ph2['pending'])])
            ok('iPhone: back in the app, reminders already shown are taken off the phone\'s list', ph2['cleared'] >= 2, ph2['cleared'])
            await ctx.close()
            await br.close()
    finally:
        srv.terminate()
    bad = {k: v for k, v in errs.items() if v}
    ok('no page errors', not bad, bad)
    failed = [n for n, c in results if not c]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
