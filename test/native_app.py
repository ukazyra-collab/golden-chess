# The iPhone / Android app: the website inside the Capacitor shell. A stand-in for the shell's bridge
# (window.Capacitor) and for supabase-js check what the page does in the app: Google opens in the system browser
# and comes back through goldenchess://auth, the Android back button, the share sheet, the offline copy.
# Run: python3 test/native_app.py   (after node build.js)
import asyncio, hashlib, json, os, re, sys, urllib.parse
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
# Google Identity Services stand-in: initialize() keeps the options, the rendered button answers with an ID token
FAKE_GSI = r"""
window.google = { accounts: { id: {
  initialize: function (o) { window.__gsiInit = o; },
  renderButton: function (el, opts) {
    window.__gsiOpts = opts;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'gsi-fake'; b.textContent = 'Continue with Google';
    b.onclick = function () { window.__gsiInit.callback({ credential: 'fake.jwt.token', select_by: 'btn' }); };
    el.appendChild(b);
  }
} } };
"""

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
      linkIdentity: function (o) {
        calls.push(['linkIdentity', o]);
        if (o.token) {  // Google's button on the website: the ID token links Google to this guest
          if (localStorage.getItem('test.linkTaken')) return Promise.resolve({ data: { user: null, session: null }, error: { message: 'A user with this email address has already been registered', code: 'email_exists', status: 400 } });
          var g = Object.assign({}, getU(), { is_anonymous: false, email: 'gina@example.com', user_metadata: { full_name: 'Gina Google' } });
          setU(g); lis.forEach(function (cb) { cb('USER_UPDATED', sess()); });
          return ok({ user: g, session: sess() });
        }
        return ok({ provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?fake=link' });
      },
      signInWithIdToken: function (o) {
        calls.push(['signInWithIdToken', o]); localStorage.setItem('test.idToken', JSON.stringify(o));
        var g = { id: 'u3', email: 'gina@example.com', is_anonymous: false, user_metadata: { full_name: 'Gina Google' } };
        setU(g); return ok({ user: g, session: sess() });
      },
      signInWithOAuth: function (o) { calls.push(['signInWithOAuth', o]); return ok({ provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?fake=signin' }); },
      setSession: function (t) {
        calls.push(['setSession', t]);
        var nu = null; try { nu = JSON.parse(localStorage.getItem('test.nextUser') || 'null'); } catch (e) { /* none */ }
        var u = nu || { id: 'u1', email: 'me@example.com', is_anonymous: false, user_metadata: { full_name: 'Uladzislau Kazyra', name: 'Uladzislau Kazyra' } };
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
renames = []
GOOGLE_HTML = open(os.path.join(ROOT, 'google.html')).read()
sha256 = lambda x: hashlib.sha256(x.encode()).hexdigest()
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


async def setup(ctx, html, native=True, gsi=None):
    pg = await ctx.new_page(); errs = []
    if gsi == 'fake': await pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(status=200, body=FAKE_GSI, content_type='text/javascript'))
    elif gsi == 'fail': await pg.route('https://accounts.google.com/gsi/client', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    if native: await pg.add_init_script(FAKE_CAPACITOR)
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    await pg.route('**/fonts.gstatic.com/**', lambda r: r.fulfill(status=404, body=''))
    async def page_route(r):
        body = GOOGLE_HTML if r.request.url.split('#')[0].split('?')[0].endswith('/google.html') else html
        await r.fulfill(status=200, body=body, content_type='text/html')
    await pg.route(SITE + '**', page_route)
    names = {}  # per player (token): the name and whether they picked it, as the play function keeps them
    async def fn_route(r):
        body = json.loads(r.request.post_data or '{}'); a = body.get('action')
        p = names.setdefault(body.get('token') or '?', {'username': 'Player1', 'name_chosen': False})
        if a == 'hello': out = {'profile': dict(p), 'ratings': [], 'live': None, 'now': 0}
        elif a == 'rename':
            p.update(username=' '.join(str(body.get('name', '')).split()), name_chosen=True); renames.append(p['username'])
            out = {'profile': dict(p)}
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

        # Google in the app: the system browser opens Google's own sign-in page (no Supabase in between), which answers
        # to golden-chess.com/google.html (so Google names golden-chess.com); that page hands the ID token back here
        cid = re.search(r'"googleClientId":\s*"([^"]+)"', html).group(1)
        await pg.evaluate('location.hash = "signin"'); await pg.wait_for_timeout(500)
        ok = await wait_for(pg, '!!document.getElementById("btn-google")')
        check("app: our Google button (Google's own one doesn't work inside an app)", ok and not await pg.evaluate('!!document.getElementById("gsi-box")'))
        await pg.click('#btn-google')
        ok = await wait_for(pg, '__capCalls.some(function (c) { return c[0] === "Browser" && c[1] === "open"; })')
        bo = await pg.evaluate('__capCalls.filter(function (c) { return c[0] === "Browser" && c[1] === "open"; }).map(function (c) { return c[2].url; })')
        flow = await pg.evaluate('JSON.parse(localStorage.getItem("goldenchess.gFlow") || "null")')
        gu = urllib.parse.urlparse(bo[0] if bo else ''); gq = urllib.parse.parse_qs(gu.query)
        check("app: the system browser opens Google's sign-in page itself", ok and gu.netloc == 'accounts.google.com' and gq.get('client_id') == [cid] and gq.get('response_type') == ['id_token'], bo)
        check('app: Google answers to golden-chess.com/google.html', gq.get('redirect_uri') == ['https://golden-chess.com/google.html'], gq.get('redirect_uri'))
        check('app: hashed nonce sent, state marked for the app', flow and gq.get('nonce') == [sha256(flow['nonce'])] and gq.get('state') == [flow['state']] and flow['state'].startswith('a'), [flow, gq.get('state')])
        check('app: nothing sent to Supabase yet', not await pg.evaluate('__sbCalls.some(function (c) { return /linkIdentity|signInWith/.test(c[0]); })'))
        ok = await wait_for(pg, '!document.getElementById("btn-google").disabled')
        check('app: the button is usable again when the browser is closed without signing in', ok)
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/native-signin.png'))
        # an answer to a sign-in this app didn't start (another state) is refused, the real one still works after it
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#g_state=a0000&g_id_token=stolen.token" })')
        await pg.wait_for_timeout(300)
        check('app: an answer with a foreign state is refused', not await pg.evaluate('__sbCalls.some(function (c) { return c[0] === "linkIdentity"; })') and 'Couldn' in await pg.evaluate('document.getElementById("toast").textContent'))
        # the answer: the same player, now with Google
        await pg.evaluate('window.__marker = 1')
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#g_state=" + %s + "&g_id_token=fake.jwt.token" })' % json.dumps(flow['state']))
        ok = await wait_for(pg, '__sbCalls.some(function (c) { return c[0] === "linkIdentity"; })')
        li = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "linkIdentity"; }).map(function (c) { return c[1]; })')
        check('app: the ID token links Google to this guest, with the nonce kept here', ok and li[0]['token'] == 'fake.jwt.token' and li[0]['nonce'] == flow['nonce'], li)
        ok = await wait_for(pg, '__gc.curView === "play" && !!__gc.me && __gc.me.guest === false')
        check('app: back on Play, signed in, no reload', ok and await pg.evaluate('window.__marker === 1'))
        check('app: the in-app browser is closed', await pg.evaluate('__capCalls.some(function (c) { return c[0] === "Browser" && c[1] === "close"; })'))
        check('app: says who is signed in', 'gina@example.com' in await pg.evaluate('document.getElementById("toast").textContent'))
        check('app: the sign-in is used up', await pg.evaluate('localStorage.getItem("goldenchess.gFlow")') in (None, 'null'))
        chip = await pg.evaluate('(document.getElementById("acct-chip") || {}).textContent || ""')
        check('app: Play shows the player, not "Sign in"', 'Player1' in chip, chip)
        # a made-up name: right after signing in the player picks their own (the name on the Google account is offered)
        ok = await wait_for(pg, '__gc.dialogKind === "name"')
        val = await pg.evaluate('(document.getElementById("acct-name") || {}).value')
        check('name: asked right after signing in, the Google name offered', ok and val == 'Gina Google', val)
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/native-name.png'))
        await pg.fill('#acct-name', ''); await pg.click('#btn-name')
        er = await pg.evaluate('(document.getElementById("acct-err") || {}).textContent || ""')
        check('name: an empty name is refused', 'name' in er.lower() and not renames, er)
        await pg.fill('#acct-name', '  Gina   G '); await pg.click('#btn-name')
        ok = await wait_for(pg, '!__gc.dialogOpen')
        check('name: saved (spaces tidied), the dialog closes', ok and renames == ['Gina G'], renames)
        chip = await pg.evaluate('(document.getElementById("acct-chip") || {}).textContent || ""')
        check('name: Play shows the new name', 'Gina G' in chip, chip)
        # the same answer again (it can arrive twice) changes nothing
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#g_state=" + %s + "&g_id_token=fake.jwt.token" })' % json.dumps(flow['state']))
        await pg.wait_for_timeout(300)
        check('app: one answer is taken once', await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "linkIdentity"; }).length') == 1)
        # cancelled on Google's page: nothing happens, no error
        await pg.evaluate('location.hash = "signin"'); await pg.wait_for_timeout(300)
        await pg.evaluate('__gc.closeDialog(); localStorage.setItem("goldenchess.gFlow", JSON.stringify({ nonce: "n2", state: "a2222", at: Date.now() })); document.getElementById("toast").textContent = ""')
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#g_state=a2222&g_error=access_denied" })')
        await pg.wait_for_timeout(300)
        check('app: cancelled at Google: no error, nothing sent', await pg.evaluate('document.getElementById("toast").textContent') == '' and await pg.evaluate('localStorage.getItem("goldenchess.gFlow")') in (None, 'null'))
        await pg.evaluate('__gc.go("play")')
        # a sign-in email's link (Supabase sends the session back through goldenchess://auth): same player, no reload
        await pg.evaluate('localStorage.removeItem("test.nextUser")')
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#access_token=AT1&expires_in=3600&refresh_token=RT1&token_type=bearer" })')
        ok = await wait_for(pg, '__sbCalls.some(function (c) { return c[0] === "setSession"; })')
        sb = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "setSession"; })')
        check('app: tokens from an email link start the session', ok and sb[0][1] == {'access_token': 'AT1', 'refresh_token': 'RT1'}, sb)
        await pg.wait_for_timeout(300)
        check('app: no reload for the same account', await pg.evaluate('window.__marker === 1'))

        # comes back as another player: start over as that player (reload), then say who
        await pg.evaluate('localStorage.setItem("test.nextUser", JSON.stringify({ id: "u2", email: "other@example.com", is_anonymous: false }))')
        await pg.evaluate('__capFire("App.appUrlOpen", { url: "goldenchess://auth#access_token=AT2&expires_in=3600&refresh_token=RT2&token_type=bearer" })')
        ok = await wait_for(pg, 'window.__marker === undefined', 8000)
        check('app: another account reloads the page', ok)
        ok = await wait_for(pg, '/other@example.com/.test(document.getElementById("toast").textContent)', 6000)
        check('app: after the reload it says who is signed in', ok, await pg.evaluate('document.getElementById("toast").textContent'))
        n3 = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "setSession"; }).length')
        check('app: the launch link is not taken again after the reload', n3 == 0, n3)
        # that player has a made-up name too: asked after the reload; closed without a name, not asked again on opening
        ok = await wait_for(pg, '__gc.dialogKind === "name"')
        val = await pg.evaluate('(document.getElementById("acct-name") || {}).value')
        check('name: another account with a made-up name is asked too (no Google name: empty field)', ok and val == '', val)
        await pg.evaluate('__gc.closeDialog()')
        await pg.reload()
        await wait_for(pg, '!!window.__gc && !!__gc.me && __gc.me.uid === "u2"', 8000); await pg.wait_for_timeout(600)
        check('name: closed once, not asked again when the app opens', await pg.evaluate('__gc.dialogKind') is None, await pg.evaluate('__gc.dialogKind'))
        await pg.evaluate('__gc.go("profile")')
        ok = await wait_for(pg, '!!document.getElementById("btn-rename")')
        check('name: Profile has "Change name"', ok and 'Change name' in await pg.evaluate('document.getElementById("btn-rename").textContent'))
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/native-profile.png'))
        await pg.click('#btn-rename')
        ok = await wait_for(pg, '__gc.dialogKind === "name"')
        await pg.fill('#acct-name', 'Sasha'); await pg.click('#btn-name')
        ok = ok and await wait_for(pg, '!__gc.dialogOpen && /Sasha/.test(document.getElementById("prof-name").textContent)')
        check('name: changed from Profile', ok and renames[-1] == 'Sasha', renames)

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
        ok = await wait_for(pg, '!!document.getElementById("acct-email")')
        check('iphone: sign-in by an email code only, no Google (App Store guideline 4.8)', ok and not await pg.evaluate('!!document.getElementById("btn-google")'))
        await pg.evaluate('__gc.go("play")')
        ok = await wait_for(pg, '!!document.getElementById("play-meta")')
        meta = await pg.evaluate('document.getElementById("play-meta") ? document.getElementById("play-meta").textContent : ""')
        check('iphone: the Play tab says sign-in is by email, no Google', ok and 'email' in meta and 'Google' not in meta, meta)
        await pg.goto(SITE + '#signin'); await pg.wait_for_timeout(600)
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

        # ---- the website: Google's own button signs in right on the site (Google shows golden-chess.com, not Supabase)
        cid = re.search(r'"googleClientId":\s*"([^"]+)"', html).group(1)
        ctx = await br.new_context(**phone)
        pg, errs = await setup(ctx, html, native=False, gsi='fake')
        await pg.goto(SITE + '#signin')
        ok = await wait_for(pg, '!!document.getElementById("gsi-fake")')
        check("gsi: Google's button in place of ours", ok and not await pg.evaluate('!!document.getElementById("btn-google")'))
        init = await pg.evaluate('({ id: __gsiInit.client_id, nonce: __gsiInit.nonce, fedcm: __gsiInit.use_fedcm_for_button, text: __gsiOpts.text, theme: __gsiOpts.theme, w: __gsiOpts.width })')
        check('gsi: our client, a hashed nonce, "Continue with", fits the card', init['id'] == cid and re.fullmatch(r'[0-9a-f]{64}', init['nonce'] or '') and init['text'] == 'continue_with' and 200 <= init['w'] <= 400, init)
        await pg.screenshot(path=os.path.join(ROOT, 'test/shots/web-gsi.png'))
        await pg.click('#gsi-fake')
        ok = await wait_for(pg, '__sbCalls.some(function (c) { return c[0] === "linkIdentity" && c[1].token; })')
        li = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "linkIdentity"; }).map(function (c) { return c[1]; })')
        check('gsi: a guest links Google with the ID token (same player)', ok and li[0]['token'] == 'fake.jwt.token' and li[0]['provider'] == 'google', li)
        check('gsi: the nonce Supabase checks is the one Google got (hashed)', ok and hashlib.sha256(li[0]['nonce'].encode()).hexdigest() == init['nonce'], li)
        ok = await wait_for(pg, '__gc.dialogKind === "name"')
        val = await pg.evaluate('(document.getElementById("acct-name") || {}).value')
        check('gsi: then the name, the Google name offered', ok and val == 'Gina Google', val)
        check('gsi: says who is signed in', 'gina@example.com' in await pg.evaluate('document.getElementById("toast").textContent'))
        await pg.click('#btn-name')
        ok = await wait_for(pg, '!__gc.dialogOpen && /Gina Google/.test((document.getElementById("acct-chip") || {}).textContent || "")')
        check('gsi: name saved, back on Play signed in', ok and await pg.evaluate('__gc.curView') == 'play' and renames[-1] == 'Gina Google', renames)
        check('gsi: no console errors', not [x for x in errs if 'Failed to load resource' not in x], errs[:5])
        await ctx.close()

        # the Google email already has a player: sign in to that player with the same token (no second trip to Google)
        ctx = await br.new_context(**phone)
        pg, errs = await setup(ctx, html, native=False, gsi='fake')
        await pg.goto(SITE + '#signin')
        await wait_for(pg, '!!document.getElementById("gsi-fake")')
        await pg.evaluate('localStorage.setItem("test.linkTaken", "1"); window.__marker = 1')
        await pg.click('#gsi-fake')
        ok = await wait_for(pg, 'window.__marker === undefined', 8000)
        await wait_for(pg, '!!window.__gc && !!__gc.me', 8000)
        sid = await pg.evaluate('JSON.parse(localStorage.getItem("test.idToken") || "null")')
        check('gsi: email taken -> signs in to that player with the ID token, page starts over as them', ok and sid and sid['token'] == 'fake.jwt.token' and await pg.evaluate('__gc.me.uid') == 'u3', sid)
        ok = await wait_for(pg, '/gina@example.com/.test(document.getElementById("toast").textContent) && __gc.dialogKind === "name"', 6000)
        check('gsi: ... says so and asks that player for a name', ok, await pg.evaluate('document.getElementById("toast").textContent'))
        check('gsi: no console errors (switch)', not [x for x in errs if 'Failed to load resource' not in x], errs[:5])
        await ctx.close()

        # ---- the website when Google's script can't load: our button, through Supabase, back to the site's own address
        ctx = await br.new_context(**phone)
        pg, errs = await setup(ctx, html, native=False, gsi='fail')
        await pg.goto(SITE + '#signin'); await pg.wait_for_timeout(500)
        cls = await pg.evaluate('document.documentElement.className')
        check('web: not marked native', 'native' not in cls, cls)
        ok = await wait_for(pg, '!!document.getElementById("btn-google") && getComputedStyle(document.getElementById("btn-google")).visibility === "visible"')
        check("web: Google's script blocked -> our button stays", ok)
        google_pages = []
        async def google_page(r):
            google_pages.append(r.request.url)
            await r.fulfill(status=200, body='<!doctype html><title>Google</title><p>Choose an account', content_type='text/html')
        await pg.route('https://accounts.google.com/o/oauth2/v2/auth**', google_page)
        await pg.click('#btn-google')
        ok = await wait_for(pg, 'location.hostname === "accounts.google.com"', 4000)
        gq = urllib.parse.parse_qs(urllib.parse.urlparse(google_pages[0] if google_pages else '').query)
        await pg.goto(SITE + '#play'); await pg.wait_for_timeout(300)
        flow = await pg.evaluate('JSON.parse(localStorage.getItem("goldenchess.gFlow") || "null")')
        check("web: the page goes to Google's sign-in page, answering to google.html", ok and gq.get('client_id') == [cid] and gq.get('redirect_uri') == ['https://golden-chess.com/google.html'] and gq.get('response_type') == ['id_token'], gq)
        check('web: hashed nonce sent, state marked for the website', flow and gq.get('nonce') == [sha256(flow['nonce'])] and gq.get('state') == [flow['state']] and flow['state'].startswith('w'), [flow, gq.get('state')])
        check('web: no Supabase sign-in on the way out', not await pg.evaluate('__sbCalls.some(function (c) { return /linkIdentity|signInWith/.test(c[0]); })'))
        # Google answers to google.html, which brings the ID token back to the site (and out of the address)
        await pg.goto(SITE + 'google.html#state=' + urllib.parse.quote(flow['state']) + '&id_token=fake.jwt.token&authuser=0&prompt=consent')
        ok = await wait_for(pg, '!!window.__gc && __sbCalls.some(function (c) { return c[0] === "linkIdentity"; })', 6000)
        li = await pg.evaluate('__sbCalls.filter(function (c) { return c[0] === "linkIdentity"; }).map(function (c) { return c[1]; })') if ok else []
        check('web: back on the site, the ID token links Google to the guest (nonce kept here)', ok and li[0]['token'] == 'fake.jwt.token' and li[0]['nonce'] == flow['nonce'], li)
        url = await pg.evaluate('location.href')
        check('web: the token is gone from the address', 'token' not in url and 'g_state' not in url, url)
        ok = await wait_for(pg, '__gc.dialogKind === "name"')
        check('web: then the name, the Google name offered', ok and await pg.evaluate('document.getElementById("acct-name").value') == 'Gina Google')
        # google.html for the app: hands the answer to goldenchess://auth (and a button, if the browser asks first)
        await pg.goto(SITE + 'google.html#state=a1234&id_token=tok.en&authuser=0', wait_until='commit')
        await wait_for(pg, '!!document.getElementById("go") && !document.getElementById("go").hidden', 4000)
        gh = await pg.evaluate('({ href: document.getElementById("go").getAttribute("href"), shown: !document.getElementById("go").hidden, url: location.href })')
        check('google.html: the app gets the answer through goldenchess://auth, with a button', gh['href'] == 'goldenchess://auth#g_state=a1234&g_id_token=tok.en' and gh['shown'], gh)
        check('google.html: the token is gone from the address', 'tok.en' not in gh['url'], gh['url'])
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
