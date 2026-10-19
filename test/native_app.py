# The iPhone / Android app: the website inside the Capacitor shell. A stand-in for the shell's bridge
# (window.Capacitor) and for supabase-js check what the page does in the app: Google opens in the system browser
# and comes back through goldenchess://auth, the Android back button, the share sheet, the offline copy.
# Run: python3 test/native_app.py   (after node build.js)
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://gc.test/'
FN = 'https://sb.test/functions/v1/play'

FAKE_CAPACITOR = r"""
window.__capCalls = []; window.__capListeners = {};
window.Capacitor = {
  isNativePlatform: function () { return true; },
  getPlatform: function () { return window.__capPlatform || localStorage.getItem('test.platform') || 'android'; },
  nativePromise: function (plugin, method, opts) {
    window.__capCalls.push([plugin, method, opts || {}]);
    if (plugin === 'App' && method === 'getLaunchUrl') { var u = localStorage.getItem('test.launchUrl'); return Promise.resolve(u ? { url: u } : {}); }
    return Promise.resolve({});
  },
  addListener: function (plugin, ev, cb) { var k = plugin + '.' + ev; (window.__capListeners[k] = window.__capListeners[k] || []).push(cb); return { remove: function () {} }; }
};
window.__capFire = function (k, d) { (window.__capListeners[k] || []).forEach(function (cb) { cb(d); }); return (window.__capListeners[k] || []).length; };
"""

# supabase-js stand-in: the session lives in localStorage so it survives a reload, like the real one
FAKE_SUPABASE = r"""
window.supabase = { createClient: function (url, key, opts) {
  var SK = opts.auth.storageKey;
  function getU() { try { return JSON.parse(localStorage.getItem('test.user') || 'null'); } catch (e) { return null; } }
  function setU(u) { localStorage.setItem('test.user', JSON.stringify(u)); localStorage.setItem(SK, '1'); }
  function sess() { var u = getU(); return u ? { access_token: 'tok-' + u.id, user: u } : null; }
  var calls = window.__sbCalls = window.__sbCalls || [];
  var lis = [];
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function qb(table) {
    var b = { select: function () { return b; }, eq: function () { return b; }, gt: function () { return b; }, order: function () { return b; }, limit: function () { return b; },
      maybeSingle: function () { return ok(table === 'games' ? { id: 'g1', status: 'waiting' } : null); },
      then: function (res, rej) { return ok([]).then(res, rej); } };
    return b;
  }
  return {
    auth: {
      onAuthStateChange: function (cb) { lis.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; },
      getSession: function () { return ok({ session: sess() }); },
      signInAnonymously: function () { setU({ id: 'u1', email: null, is_anonymous: true }); return ok({ session: sess() }); },
      linkIdentity: function (o) { calls.push(['linkIdentity', o]); return ok({ provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?fake=link' }); },
      signInWithOAuth: function (o) { calls.push(['signInWithOAuth', o]); return ok({ provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?fake=signin' }); },
      setSession: function (t) {
        calls.push(['setSession', t]);
        var nu = null; try { nu = JSON.parse(localStorage.getItem('test.nextUser') || 'null'); } catch (e) { /* none */ }
        var u = nu || { id: 'u1', email: 'me@example.com', is_anonymous: false };
        setU(u); lis.forEach(function (cb) { cb('SIGNED_IN', sess()); });
        return ok({ user: u, session: sess() });
      },
      updateUser: function () { return ok({}); }, signInWithOtp: function () { return ok({}); }, verifyOtp: function () { return ok({}); },
      signOut: function () { localStorage.removeItem('test.user'); localStorage.removeItem(SK); return ok({}); }
    },
    realtime: { setAuth: function () { return Promise.resolve(); } },
    channel: function () { var ch = { on: function () { return ch; }, subscribe: function (cb) { setTimeout(function () { if (cb) cb('SUBSCRIBED'); }, 0); return ch; },
      track: function () {}, send: function () { return Promise.resolve(); }, presenceState: function () { return {}; } }; return ch; },
    removeChannel: function () {},
    from: qb
  };
} };
"""


def site_html():
    html = open(os.path.join(ROOT, 'dist/web/index.html')).read()
    i = html.index('</script><script>window.GC_ONLINE=')
    s = html.rfind('<script>', 0, i)
    html = html[:s] + '<script>' + FAKE_SUPABASE + html[i:]
    m = re.search(r'window\.GC_ONLINE=(\{.*?\})</script>', html)
    cfg = json.loads(m.group(1)); cfg['url'] = 'https://sb.test'; cfg['googleAuth'] = True
    return html[:m.start(1)] + json.dumps(cfg) + html[m.end(1):]


results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name, extra if not ok else '')


async def wait_for(pg, js, timeout=6000):
    t = 0
    while t < timeout:
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(50); t += 50
    return False


async def setup(ctx, html, native=True):
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    if native: await pg.add_init_script(FAKE_CAPACITOR)
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    await pg.route('**/fonts.gstatic.com/**', lambda r: r.fulfill(status=404, body=''))
    async def page_route(r):
        await r.fulfill(status=200, body=html, content_type='text/html')
    await pg.route(SITE + '**', page_route)
    async def fn_route(r):
        body = json.loads(r.request.post_data or '{}'); a = body.get('action')
        if a == 'hello': out = {'profile': {'username': 'Player1'}, 'ratings': [], 'live': None, 'now': 0}
        elif a == 'challenge': out = {'game': {'id': 'g1', 'status': 'waiting'}}
        else: out = {}
        await r.fulfill(status=200, body=json.dumps(out), content_type='application/json', headers={'Access-Control-Allow-Origin': '*'})
    await pg.route(FN + '**', fn_route)
    return pg, errs


async def main():
    html = site_html()
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        phone = dict(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)

        # ---- Android app: boot, Google sign-in through the system browser, the way back, account switch
        ctx = await br.new_context(**phone)
        pg, errs = await setup(ctx, html)
        await pg.goto(SITE + '#play'); await pg.wait_for_timeout(500)
        cls = await pg.evaluate('document.documentElement.className')
        check('app: html marked native android', 'native' in cls and 'android' in cls, cls)
        vp = await pg.evaluate('document.querySelector("meta[name=viewport]").content')
        check('app: page zoom pinned', 'user-scalable=no' in vp and 'viewport-fit=cover' in vp, vp)
        calls = await pg.evaluate('__capCalls.map(function (c) { return c[0] + "." + c[1]; })')
        check('app: splash hidden and launch link read', 'SplashScreen.hide' in calls and 'App.getLaunchUrl' in calls, calls)
        n = await pg.evaluate('Object.keys(__capListeners)')
        check('app: listens for links and the back button', 'App.appUrlOpen' in n and 'App.backButton' in n, n)
        pad = await pg.evaluate('getComputedStyle(document.documentElement).paddingBottom')
        check('app: tab bar reaches the bottom edge', pad == '0px', pad)

        await pg.evaluate('location.hash = "signin"'); await pg.wait_for_timeout(500)
        ok = await wait_for(pg, '!!document.getElementById("btn-google")')
        check('app: Google button on the sign-in page', ok)
        await pg.click('#btn-google')
        ok = await wait_for(pg, '__capCalls.some(function (c) { return c[0] === "Browser" && c[1] === "open"; })')
        sb = await pg.evaluate('__sbCalls')
        link = [c for c in sb if c[0] == 'linkIdentity']
        check('app: a guest links Google (same account)', link and link[0][1]['provider'] == 'google', sb)
        check('app: Google comes back to goldenchess://auth', link and link[0][1]['options'].get('redirectTo') == 'goldenchess://auth', link)
        check('app: supabase-js does not navigate the web view', link and link[0][1]['options'].get('skipBrowserRedirect') is True, link)
        bo = await pg.evaluate('__capCalls.filter(function (c) { return c[0] === "Browser" && c[1] === "open"; }).map(function (c) { return c[2]; })')
        check('app: the system browser opens Google', ok and bo and 'fake=link' in bo[0]['url'], bo)
        ok = await wait_for(pg, '!document.getElementById("btn-google").disabled')
        check('app: the button is usable again when the browser is closed without signing in', ok)
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/native-signin.png'))

        # the browser comes back: the same player, now signed in with Google
        await pg.evaluate('localStorage.removeItem("test.nextUser")')
        await pg.evaluate('window.__marker = 1')
        n = await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#access_token=AT1&expires_in=3600&refresh_token=RT1&token_type=bearer" })')
        ok = await wait_for(pg, '__gc.curView === "play"')
        sb = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "setSession"; })')
        check('app: tokens from the link start the session', sb and sb[0][1] == {'access_token': 'AT1', 'refresh_token': 'RT1'}, sb)
        check('app: back on Play after signing in', ok)
        toast = await pg.evaluate('document.getElementById("toast").textContent')
        check('app: says who is signed in', 'me@example.com' in toast, toast)
        check('app: no reload for the same account', await pg.evaluate('window.__marker === 1'))
        closed = await pg.evaluate('__capCalls.some(function (c) { return c[0] === "Browser" && c[1] === "close"; })')
        check('app: the in-app browser is closed', closed)
        chip = await pg.evaluate('(document.getElementById("acct-chip") || {}).textContent || ""')
        check('app: Play shows the player, not "Sign in"', 'Player1' in chip, chip)
        # the same link again (the launch address is read once per run) changes nothing
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#access_token=AT1&expires_in=3600&refresh_token=RT1&token_type=bearer" })')
        await pg.wait_for_timeout(300)
        n2 = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "setSession"; }).length')
        check('app: one link is taken once', n2 == 1, n2)

        # this Google account already has another player: sign in to that one
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user" })')
        ok = await wait_for(pg, '__sbCalls.some(function (c) { return c[0] === "signInWithOAuth"; })')
        so = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "signInWithOAuth"; }).map(function (c) { return c[1]; })')
        check('app: identity elsewhere -> sign in to that account', ok and so[0]['options']['redirectTo'] == 'goldenchess://auth' and so[0]['options']['skipBrowserRedirect'], so)
        ok = await wait_for(pg, '__capCalls.some(function (c) { return c[0] === "Browser" && c[1] === "open" && /fake=signin/.test(c[2].url); })')
        check('app: ... through the system browser again', ok)
        toast = await pg.evaluate('document.getElementById("toast").textContent')
        check('app: explains the switch', 'Google' in toast, toast)
        # the sign-in to that account fails the same way: no loop, just say so
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#error=invalid_request&error_code=email_exists&error_description=A+user+with+this+email+address+has+already+been+registered" })')
        await pg.wait_for_timeout(600)
        n = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "signInWithOAuth"; }).length')
        toast = await pg.evaluate('document.getElementById("toast").textContent')
        check('app: no second automatic sign-in after a failed one (no loop)', n == 1 and "Couldn" in toast, [n, toast])
        # a new link attempt whose Google email already has a player (email_exists): sign in to that player
        await pg.evaluate('localStorage.setItem("goldenchess.googleTry", JSON.stringify("link"))')
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#error=invalid_request&error_code=email_exists&error_description=A+user+with+this+email+address+has+already+been+registered&x=2" })')
        ok = await wait_for(pg, '__sbCalls.filter(function (c) { return c[0] === "signInWithOAuth"; }).length === 2')
        check('app: Google email already has a player -> sign in to it', ok)

        # comes back as another player: start over as that player (reload), then say who
        await pg.evaluate('localStorage.setItem("test.nextUser", JSON.stringify({ id: "u2", email: "other@example.com", is_anonymous: false }))')
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#access_token=AT2&expires_in=3600&refresh_token=RT2&token_type=bearer" })')
        ok = await wait_for(pg, 'window.__marker === undefined', 8000)
        check('app: another account reloads the page', ok)
        ok = await wait_for(pg, '/other@example.com/.test(document.getElementById("toast").textContent)', 6000)
        check('app: after the reload it says who is signed in', ok, await pg.evaluate('document.getElementById("toast").textContent'))
        n3 = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "setSession"; }).length')
        check('app: the launch link is not taken again after the reload', n3 == 0, n3)

        # ---- the Android back button
        await pg.evaluate('location.hash = "play"'); await pg.wait_for_timeout(300)
        await pg.click('#btn-friend'); await pg.wait_for_timeout(200)
        check('back: a sheet is open', await pg.evaluate('__gc.dialogOpen'))
        await pg.evaluate('__capFire("App.backButton", { canGoBack: true })'); await pg.wait_for_timeout(200)
        check('back: closes the sheet first', not await pg.evaluate('__gc.dialogOpen'))
        check('back: ... and stays on Play', await pg.evaluate('__gc.curView') == 'play')
        await pg.evaluate('__gc.go("bots")'); await pg.wait_for_timeout(200)
        await pg.evaluate('__capFire("App.backButton", { canGoBack: true })')
        ok = await wait_for(pg, '__gc.curView === "play"')
        check('back: goes back a screen', ok, await pg.evaluate('__gc.curView'))
        await pg.evaluate('__gc.go("learn", true)'); await pg.wait_for_timeout(200)
        await pg.evaluate('__capFire("App.backButton", { canGoBack: false })'); await pg.wait_for_timeout(200)
        check('back: with no history, to Play', await pg.evaluate('__gc.curView') == 'play')
        await pg.evaluate('__capFire("App.backButton", { canGoBack: false })'); await pg.wait_for_timeout(200)
        mini = await pg.evaluate('__capCalls.some(function (c) { return c[0] === "App" && c[1] === "minimizeApp"; })')
        check('back: on Play, the app goes to the background', mini)

        # ---- the invite link goes to the system share sheet (an Android web view has no navigator.share)
        await pg.click('#btn-friend'); await pg.wait_for_timeout(200)
        await pg.click('#btn-invite-link')
        ok = await wait_for(pg, '!!document.getElementById("btn-share-link") && !document.getElementById("btn-share-link").disabled')
        check('share: share button on the invite', ok)
        await pg.click('#btn-share-link')
        sh = await pg.evaluate('__capCalls.filter(function (c) { return c[0] === "Share"; }).map(function (c) { return c[2]; })')
        check('share: system share sheet with the invite link', sh and sh[0].get('url', '').startswith(SITE) and 'join=g1' in sh[0]['url'], sh)
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/native-invite.png'))
        await pg.click('#btn-cancel-lobby'); await pg.wait_for_timeout(200)
        check('app: no console errors', not [e for e in errs if 'Failed to load resource' not in e], errs[:5])
        await ctx.close()

        # ---- iPhone: no back-button listener, Google the same way
        ctx = await br.new_context(**phone)
        pg, errs = await setup(ctx, html)
        await pg.add_init_script('localStorage.setItem("test.platform", "ios"); localStorage.setItem("test.loads", String((+localStorage.getItem("test.loads") || 0) + 1))')
        await pg.goto(SITE + '#signin'); await pg.wait_for_timeout(600)
        cls = await pg.evaluate('document.documentElement.className')
        check('iphone: html marked native ios', 'native' in cls and 'ios' in cls, cls)
        n = await pg.evaluate('Object.keys(__capListeners)')
        check('iphone: links yes, back button no', 'App.appUrlOpen' in n and 'App.backButton' not in n, n)
        # a sign-in that finished while the app was closed: the app starts with the link
        await pg.evaluate('localStorage.setItem("test.launchUrl", "goldenchess://auth#access_token=AT9&expires_in=3600&refresh_token=RT9&token_type=bearer")')
        await pg.evaluate('localStorage.setItem("test.nextUser", JSON.stringify({ id: "u9", email: "cold@example.com", is_anonymous: false }))')
        await pg.evaluate('localStorage.setItem("test.loads", "0")')
        await pg.reload(); await pg.wait_for_timeout(300)
        ok = await wait_for(pg, '/cold@example.com/.test(document.getElementById("toast").textContent)', 8000)
        check('iphone: a link the app was opened with signs in (once)', ok, await pg.evaluate('document.getElementById("toast").textContent'))
        await pg.wait_for_timeout(1500)
        loads = await pg.evaluate('localStorage.getItem("test.loads")')
        check('iphone: the launch link reloads once, not in a loop', loads == '2', loads)  # our reload + the account switch
        check('iphone: no console errors', not [e for e in errs if 'Failed to load resource' not in e], errs[:5])
        await ctx.close()

        # ---- the website (no app): Google leaves the page, back to the site's own address
        ctx = await br.new_context(**phone)
        pg, errs = await setup(ctx, html, native=False)
        await pg.goto(SITE + '#signin'); await pg.wait_for_timeout(500)
        cls = await pg.evaluate('document.documentElement.className')
        check('web: not marked native', 'native' not in cls, cls)
        await pg.click('#btn-google'); await pg.wait_for_timeout(400)
        sb = await pg.evaluate('__sbCalls')
        link = [c for c in sb if c[0] == 'linkIdentity']
        check('web: Google returns to the site', link and link[0][1]['options'].get('redirectTo') == SITE and 'skipBrowserRedirect' not in link[0][1]['options'], link)
        # Google answers that its email already has a player (Supabase puts the error in the query and the hash)
        e = 'error=invalid_request&error_code=email_exists&error_description=A+user+with+this+email+address+has+already+been+registered'
        await pg.goto(SITE + '?' + e + '#' + e); await pg.wait_for_timeout(300)
        ok = await wait_for(pg, '__sbCalls.some(function (c) { return c[0] === "signInWithOAuth"; })')
        so = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "signInWithOAuth"; }).map(function (c) { return c[1]; })')
        check('web: Google email already has a player -> sign in to it', ok and so[0]['options'].get('redirectTo') == SITE, so)
        toast = await pg.evaluate('document.getElementById("toast").textContent')
        check('web: ... and says so', 'Google' in toast, toast)
        url = await pg.evaluate('location.href')
        check('web: the error is gone from the address', 'error' not in url, url)
        # the same answer to that sign-in: no loop, just say so
        await pg.goto(SITE + '?' + e + '#' + e); await pg.wait_for_timeout(300)
        ok = await wait_for(pg, '/Couldn/.test(document.getElementById("toast").textContent)')
        n = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "signInWithOAuth"; }).length')
        check('web: a failed sign-in is not retried', ok and n == 0, [n, await pg.evaluate('document.getElementById("toast").textContent')])
        pad = await pg.evaluate('getComputedStyle(document.documentElement).paddingBottom')
        check('web: page padding unchanged', pad == '0px', pad)  # env() is 0 in a desktop browser
        check('web: no console errors', not [e for e in errs if 'Failed to load resource' not in e], errs[:5])
        await ctx.close()

        # ---- the app's offline copy (opened when the live site can't load)
        ctx = await br.new_context(**phone)
        offline = open(os.path.join(ROOT, 'app/www/index.html')).read()
        pg, errs = await setup(ctx, offline)
        for live in ('https://ukazyra-collab.github.io/**', 'https://golden-chess.com/**'):
            await pg.route(live, lambda r: r.fulfill(status=200, body='<!doctype html><title>live</title>', content_type='text/html'))
        await pg.goto(SITE + 'index.html#play'); await pg.wait_for_timeout(600)
        ok = await wait_for(pg, '!!document.getElementById("app-offline") && !!document.getElementById("btn-reconnect")')
        check('offline: says there is no internet, offers to try again', ok)
        tabs = await pg.evaluate('[...document.querySelectorAll("#tabbar .nav-item")].map(function (a) { return a.getAttribute("href") || a.dataset.v || a.textContent.trim(); })')
        check('offline: no Ratings tab', not any('rating' in str(t).lower() for t in tabs), tabs)
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/native-offline.png'))
        await pg.click('#btn-start'); ok = await wait_for(pg, '__gc.curView === "bots"')
        check('offline: bots still play', ok)
        await pg.evaluate('__gc.go("play")'); await pg.wait_for_timeout(200)
        async with pg.expect_navigation():
            await pg.click('#btn-reconnect')
        check('offline: "Try again" goes to the live site', pg.url.startswith('https://ukazyra-collab.github.io/golden-chess/') or pg.url.startswith('https://golden-chess.com/'), pg.url)
        await ctx.close()
        await br.close()
    bad = [n for n, ok in results if not ok]
    print('\n%d/%d passed' % (len(results) - len(bad), len(results)), 'FAILED: ' + ', '.join(bad) if bad else '')
    sys.exit(1 if bad else 0)

asyncio.run(main())
