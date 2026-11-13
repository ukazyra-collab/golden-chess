# Joker Pro bought in the apps (the App Store, Google Play), through the local test server (its /pay stands in for
# the pay function and for what the stores would say) and a stand-in for the shell's purchase plugin
# (NativePurchases). Who is shown a way to buy (the server's switch for each store; the app must have the plugin and
# the store must name the products), the sheet with the store's own prices, buying as a guest and with an account,
# the ways a purchase can end (cancelled, waiting for approval, failed, the server out of reach), Restore purchases,
# what the app picks up quietly at a start, the subscription's page and the Profile's row, the website's side of a
# store purchase, deleting the account.
# Run: python3 test/pro_store_e2e.py   (after node build.js; SHOTS=1 also saves screenshots)
import asyncio, base64, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PORT = 8798
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

def start_server():
    proc = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], env=dict(os.environ, MOCK_LATENCY='20'), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1).read(); return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('server did not start')

# what the App Store would answer about the three products (an account that may still have the free week), in dirhams:
# the sheet must show the store's words, not the website's dollars
IOS_PRODUCTS = [
    {'identifier': 'jokerpro_month', 'title': 'Joker Pro Monthly', 'price': 14.99, 'priceString': 'AED 14.99', 'currencyCode': 'AED', 'introductoryPrice': None, 'introEligibility': 0},
    {'identifier': 'jokerpro_year', 'title': 'Joker Pro Yearly', 'price': 109.99, 'priceString': 'AED 109.99', 'currencyCode': 'AED', 'introEligibility': 2,
     'introductoryPrice': {'price': 0, 'priceString': 'Free', 'paymentMode': 0, 'numberOfPeriods': 1, 'subscriptionPeriod': {'numberOfUnits': 1, 'unit': 1}}},
    {'identifier': 'jokerpro_founder', 'title': 'Joker Pro Founder', 'price': 299.99, 'priceString': 'AED 299.99', 'currencyCode': 'AED', 'introductoryPrice': None, 'introEligibility': 0},
]
# Google Play: one entry for every offer of a base plan (the free trial first), the one-time product asked for apart
PLAY_PRODUCTS = [
    {'identifier': 'year', 'planIdentifier': 'jokerpro_sub', 'offerId': 'trial', 'offerToken': 'tok-trial', 'price': 29.99, 'priceString': '$29.99', 'currencyCode': 'USD'},
    {'identifier': 'year', 'planIdentifier': 'jokerpro_sub', 'offerId': None, 'offerToken': 'tok-year', 'price': 29.99, 'priceString': '$29.99', 'currencyCode': 'USD'},
    {'identifier': 'month', 'planIdentifier': 'jokerpro_sub', 'offerId': None, 'offerToken': 'tok-month', 'price': 3.99, 'priceString': '$3.99', 'currencyCode': 'USD'},
    {'identifier': 'jokerpro_founder', 'price': 79.99, 'priceString': '$79.99', 'currencyCode': 'USD', 'offerToken': 'tok-f'},
]

# the app's bridge with the purchase plugin. localStorage 'test.iap' says how the store behaves:
# { platform, plugin (false: an older app), products, buy: 'ok' | 'cancel' | 'pending' | 'error', purchases: [...] (what
#   the store account holds), noProducts (the store names nothing), seq }. A bought purchase is added to purchases.
FAKE_CAP = r"""
(function () {
  function cfg() { try { return JSON.parse(localStorage.getItem('test.iap') || '{}'); } catch (e) { return {}; } }
  function put(c) { localStorage.setItem('test.iap', JSON.stringify(c)); }
  function b64(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
  var c0 = cfg(), platform = c0.platform || 'ios';
  window.__iapCalls = []; window.__iapListeners = [];
  function store(method, o) {
    var c = cfg(), ios = platform === 'ios';
    window.__iapCalls.push([method, JSON.parse(JSON.stringify(o || {}))]);
    if (method === 'getProducts') {
      if (c.noProducts) return ios ? Promise.resolve({ products: [] }) : Promise.reject({ message: 'Product not found' });
      var ids = o.productIdentifiers || [], list = (c.products || []).filter(function (p) {
        if (ios) return ids.indexOf(p.identifier) >= 0;
        return o.productType === 'subs' ? ids.indexOf(p.planIdentifier) >= 0 : !p.planIdentifier && ids.indexOf(p.identifier) >= 0;
      });
      if (!ios && !list.length) return Promise.reject({ message: 'Product not found' });
      return new Promise(function (res) { setTimeout(function () { res({ products: list }); }, 30); });
    }
    if (method === 'purchaseProduct') {
      var how = c.buy || 'ok';
      if (how === 'cancel') return Promise.reject(ios ? { message: 'User cancelled' } : { message: 'Purchase is not purchased', code: 'USER_CANCELED' });
      if (how === 'pending') return Promise.reject({ message: ios ? 'Transaction pending' : 'Purchase is pending' });
      if (how === 'error') return Promise.reject({ message: 'The store is having a bad day' });
      c.seq = (c.seq || 0) + 1;
      var id = (c.device || 'd') + '-' + c.seq, trial = ios ? o.productIdentifier === 'jokerpro_year' && !c.noTrial : o.planIdentifier === 'year' && !c.noTrial, tx;
      if (ios) tx = { transactionId: id, productIdentifier: o.productIdentifier, productType: o.productType, appAccountToken: String(o.appAccountToken || '').toUpperCase(),
        jwsRepresentation: 'apple.' + b64({ id: id, product: o.productIdentifier, trial: trial }) };
      else tx = { transactionId: id, productIdentifier: o.productIdentifier, productType: o.productType, purchaseState: '1', appAccountToken: o.appAccountToken,
        purchaseToken: 'gp.' + b64({ id: id, product: o.productIdentifier, base: o.planIdentifier || null, trial: trial }) };
      c.purchases = (c.purchases || []).concat([tx]); put(c);
      return new Promise(function (res) { setTimeout(function () { res(tx); }, 60); });
    }
    if (method === 'getPurchases') return Promise.resolve({ purchases: c.purchases || [] });
    if (method === 'restorePurchases') return c.restoreFail ? Promise.reject({ message: 'Cannot connect to iTunes Store' }) : Promise.resolve({});
    if (method === 'manageSubscriptions') return Promise.resolve({});
    return Promise.resolve({});
  }
  window.Capacitor = {
    isNativePlatform: function () { return true; }, getPlatform: function () { return platform; },
    isPluginAvailable: function (p) { return ['App', 'SplashScreen', 'StatusBar', 'Share', 'Browser', 'Haptics'].indexOf(p) >= 0 || (p === 'NativePurchases' && cfg().plugin !== false); },
    nativePromise: function (plugin, method, opts) { return plugin === 'NativePurchases' ? store(method, opts) : Promise.resolve({}); },
    addListener: function (plugin, ev, cb) { if (plugin === 'NativePurchases') window.__iapListeners.push([ev, cb]); return { remove: function () {} }; }
  };
})();
"""

def b64(o): return base64.b64encode(json.dumps(o).encode()).decode()

async def main():
    srv = start_server()
    errs = {}
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            phone = dict(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)

            async def prep(pg, noask=True):
                await pg.evaluate(HELPERS); await pg.evaluate('window.__gcNoAsk = %s' % ('true' if noask else 'false'))

            # an app (iap: how its store behaves) or the website (iap None)
            async def open_page(ctx, name, iap=None, store=None):
                pg = await ctx.new_page()
                pg.set_default_timeout(7000)
                errs.setdefault(name, [])
                pg.on('pageerror', lambda e: errs[name].append(str(e)))
                pg.on('console', lambda m: errs[name].append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'navigator.vibrate' not in m.text else None)
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
                seed = dict(store or {})
                init = 'window.__gcFastBot = true; try { if (!localStorage.getItem("goldenchess.settings")) localStorage.setItem("goldenchess.settings", JSON.stringify({ lang: "en" })); } catch (e) {}'
                if iap is not None: init += '\ntry { if (!localStorage.getItem("test.iap")) localStorage.setItem("test.iap", %s); } catch (e) {}' % json.dumps(json.dumps(iap))
                await pg.add_init_script(init)
                if iap is not None: await pg.add_init_script(FAKE_CAP)
                if seed: await pg.add_init_script('(function () { if (localStorage.getItem("seeded")) return; var s = %s; for (var k in s) localStorage.setItem("goldenchess." + k, JSON.stringify(s[k])); localStorage.setItem("seeded", "1"); })()' % json.dumps(seed))
                await pg.goto(BASE); await pg.wait_for_timeout(500); await prep(pg)
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
            async def shown(pg, sel): return await pg.evaluate('(function () { var e = document.querySelector(%s); return !!e && !e.hidden && e.getClientRects().length > 0; })()' % json.dumps(sel))
            async def kind(pg): return await pg.evaluate('__gc.dialogKind')
            async def pro(pg): return await pg.evaluate('JSON.parse(JSON.stringify(__gc.pro))')
            async def toast(pg): return await pg.evaluate('document.getElementById("toast").className.indexOf("show") >= 0 ? document.getElementById("toast").textContent : ""')
            async def calls(pg, method=None): return await pg.evaluate('window.__iapCalls.filter(function (c) { return !%s || c[0] === %s; })' % (json.dumps(method), json.dumps(method)))
            async def iap_set(pg, **kw): await pg.evaluate('(function (k) { var c = JSON.parse(localStorage.getItem("test.iap") || "{}"); for (var x in k) c[x] = k[x]; localStorage.setItem("test.iap", JSON.stringify(c)); })(%s)' % json.dumps(kw))
            async def close_all(pg):
                for _ in range(4):
                    if await pg.evaluate('!!__gc.dialogOpen'):
                        await pg.evaluate('__gc.closeDialog()'); await pg.wait_for_timeout(260)
            async def online(pg):   # the page signs in (a guest account on the server)
                await pg.evaluate('__gc.go("ratings")'); return await wait_for(pg, '!!__gc.me', 6000)
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

            IOS = dict(platform='ios', products=IOS_PRODUCTS, device='i1')

            # ================================================================ 1. who is shown a way to buy
            admin('promode', mode='on')   # (the website sells; the apps follow their own switch)
            a_ctx = await br.new_context(**phone)
            A = await open_page(a_ctx, 'A', iap=IOS)
            await A.wait_for_timeout(500)
            st = await pro(A)
            ok('the stores switched off: the app has the plugin and sells nothing', st['store']['here'] and not st['store']['allowed'] and not st['sells'] and not st['avail'], st['store'])
            await A.evaluate('__gc.proSheet()'); await A.wait_for_timeout(300)
            ok('... the Pro sheet never opens, and the store was not asked for prices', (await kind(A)) is None and len(await calls(A, 'getProducts')) == 0)
            await A.evaluate('__gc.go("profile")'); await A.wait_for_timeout(300)
            ok('... no Pro entry and no Subscription row in the Profile', not await has(A, '#pro-entry') and not await has(A, '#sub-row'))

            admin('prostores', ios='on', android='off')
            await A.evaluate('localStorage.removeItem("goldenchess.proPub")'); await A.reload(); await A.wait_for_timeout(400); await prep(A)
            got = await wait_for(A, '__gc.pro.sells', 5000)
            st = await pro(A)
            ok('the App Store switched on: without a session the app asks the database, then the store, and Pro is for sale', got and st['store']['on'] and (await A.evaluate('!__gc.me')) and len(await calls(A, 'getProducts')) == 1, st['store'])
            gp = (await calls(A, 'getProducts'))[0][1]
            ok('... the store is asked for the three products at once', sorted(gp['productIdentifiers']) == ['jokerpro_founder', 'jokerpro_month', 'jokerpro_year'], gp)
            ok('... the catalogue: the store\'s prices, the free week for the year', st['store']['plans']['year']['price'] == 'AED 109.99' and st['store']['plans']['year']['trialDays'] == 7 and st['store']['plans']['month']['trialDays'] == 0 and st['store']['plans']['founder']['amount'] == 299.99, st['store']['plans'])
            await A.evaluate('__gc.go("profile")'); await A.wait_for_timeout(300)
            ok('... the Profile has the Pro entry', await has(A, '#pro-entry') and 'Learn more' in (await text(A, '#pro-entry')))

            # an Android app while only the App Store sells; an older app (no plugin); the website
            n_ctx = await br.new_context(**phone)
            N = await open_page(n_ctx, 'N', iap=dict(platform='android', products=PLAY_PRODUCTS, device='g0'))
            await N.wait_for_timeout(700)
            ok('the Android app while only the App Store sells: nothing', not (await pro(N))['sells'] and len(await calls(N, 'getProducts')) == 0)
            await n_ctx.close()
            o_ctx = await br.new_context(**phone)
            O = await open_page(o_ctx, 'O', iap=dict(platform='ios', plugin=False, products=IOS_PRODUCTS))
            await O.wait_for_timeout(700)
            st = await pro(O)
            ok('an older app (no purchase plugin): nothing is sold, as before', not st['store']['here'] and not st['sells'])
            await o_ctx.close()
            e_ctx = await br.new_context(**phone)
            E = await open_page(e_ctx, 'E', iap=dict(platform='ios', products=IOS_PRODUCTS, noProducts=True))
            await E.wait_for_timeout(900)
            st = await pro(E)
            ok('the store names no products (not approved yet): no way to buy is shown', st['store']['allowed'] and not st['store']['on'] and not st['sells'] and len(await calls(E, 'getProducts')) >= 1, st['store'])
            await e_ctx.close()

            # ================================================================ 2. the sheet in the app
            await A.click('#pro-entry'); await A.wait_for_timeout(400)
            ok('the Pro sheet opens', (await kind(A)) == 'pro')
            ok('the plans carry the store\'s prices', (await text(A, '#plan-year .pl-price')) == 'AED 109.99' and (await text(A, '#plan-month .pl-price')) == 'AED 14.99' and 'AED 299.99' in (await text(A, '#plan-founder')),
               [await text(A, '#plan-year'), await text(A, '#plan-month'), await text(A, '#plan-founder')])
            ok('... the year as a month of it, in the store\'s own writing, and what it saves', (await text(A, '#plan-year .pl-sub')) == 'only AED 9.17 a month' and (await text(A, '#plan-year .pl-tag')) == 'save 39%', [await text(A, '#plan-year .pl-sub'), await text(A, '#plan-year .pl-tag')])
            ok('the button offers the free week; the small print says what follows', (await text(A, '#btn-pro-buy')) == 'Try 7 days free' and (await text(A, '#pro-fine')) == 'Free for 7 days, then AED 109.99 a year. Renews until you cancel.', [await text(A, '#btn-pro-buy'), await text(A, '#pro-fine')])
            by = await text(A, '#pro-payby')
            ok('who takes the money, the terms, the privacy policy, Restore purchases', by.startswith('Payment goes through the App Store.') and await has(A, '#pro-payby a[href$="terms.html"]') and await has(A, '#pro-payby a[href$="privacy.html"]') and await has(A, '#btn-pro-restore'), by)
            ok('no word of Stripe, no test note, no dollars from the website', 'Stripe' not in (await text(A, '#pro-body')) + by and not await has(A, '#pro-test') and '$' not in (await text(A, '.pro-card')), await text(A, '.pro-card'))
            await A.click('#plan-month'); await A.wait_for_timeout(120)
            ok('the monthly plan: its price on the button and in the small print', (await text(A, '#btn-pro-buy')) == 'Get Pro for AED 14.99 a month' and (await text(A, '#pro-fine')) == 'AED 14.99 a month. Renews until you cancel.', [await text(A, '#btn-pro-buy'), await text(A, '#pro-fine')])
            await A.click('#plan-founder'); await A.wait_for_timeout(120)
            ok('Founder: one payment', (await text(A, '#btn-pro-buy')) == 'Become a Founder for AED 299.99' and 'One payment' in (await text(A, '#pro-fine')))
            if SHOTS: await A.click('#plan-year'); await A.wait_for_timeout(300); await A.screenshot(path=SHOT_DIR + '/store-sheet-ios.png')

            # ================================================================ 3. the ways a purchase can end
            await A.click('#plan-year'); await A.wait_for_timeout(100)
            await iap_set(A, buy='cancel')
            await A.click('#btn-pro-buy'); await A.wait_for_timeout(700)
            cp = await calls(A, 'purchaseProduct')
            ok('a guest may buy: the store\'s payment sheet is asked for at once, no "save your account first"', len(cp) == 1 and (await kind(A)) == 'pro' and await A.evaluate('!!__gc.me && __gc.me.guest'), [cp, await kind(A)])
            uidA = await A.evaluate('__gc.me.uid')
            ok('... the yearly product, as a subscription, with the account named', cp[0][1]['productIdentifier'] == 'jokerpro_year' and cp[0][1]['productType'] == 'subs' and cp[0][1]['appAccountToken'] == uidA and 'planIdentifier' not in cp[0][1], cp[0][1])
            ok('closed by the player: no complaint, the button is ready again, nothing claimed', (await toast(A)) == '' and (await text(A, '#btn-pro-buy')) == 'Try 7 days free' and not await A.evaluate('document.getElementById("btn-pro-buy").disabled') and len(admin('storelog')['claims']) == 0, await toast(A))
            await iap_set(A, buy='pending')
            await A.click('#btn-pro-buy'); await A.wait_for_timeout(500)
            ok('waiting for approval (Ask to Buy): said plainly, the sheet stays', 'waiting for approval' in (await toast(A)) and (await kind(A)) == 'pro' and not (await pro(A))['on'], await toast(A))
            await iap_set(A, buy='error')
            await A.wait_for_timeout(2400); await A.click('#btn-pro-buy'); await A.wait_for_timeout(500)
            ok('the store failed: "did not go through", the sheet stays', 'did not go through' in (await toast(A)) and (await kind(A)) == 'pro', await toast(A))

            # the server cannot reach the store: the purchase is paid and not lost
            await iap_set(A, buy='ok')
            admin('storedown', on=True)
            await A.wait_for_timeout(2400); await A.click('#btn-pro-buy')
            busy = await wait_for(A, 'document.getElementById("btn-pro-buy").disabled', 2000)
            ok('while the store works the button waits', busy and (await text(A, '#btn-pro-buy')) == 'Opening the purchase…', await text(A, '#btn-pro-buy'))
            waited = await wait_for(A, 'document.getElementById("toast").textContent.indexOf("on its way") >= 0', 9000)
            ok('paid, but the server did not hear of it: "on its way", Pro not on yet, the purchase remembered', waited and not (await pro(A))['on'] and await A.evaluate('!!JSON.parse(localStorage.getItem("goldenchess.iapPend") || "null")'), await toast(A))
            admin('storedown', on=False)
            await A.reload(); await A.wait_for_timeout(500); await prep(A)
            on = await wait_for(A, '__gc.pro.on', 7000)
            ok('the next start of the app shows it to the server again: Pro is on', on and not await A.evaluate('!!JSON.parse(localStorage.getItem("goldenchess.iapPend") || "null")'))
            log = admin('storelog')
            ok('... on the guest\'s account, as a trial of the yearly plan from the App Store', len(log['rows']) == 1 and log['rows'][0]['uid'] == uidA and log['rows'][0]['store'] == 'apple' and log['rows'][0]['plan'] == 'year' and log['rows'][0]['trial'], log['rows'])

            # ================================================================ 4. bought: the welcome, the status, the Profile
            b_ctx = await br.new_context(**phone)
            B = await open_page(b_ctx, 'B', iap=dict(platform='ios', products=IOS_PRODUCTS, device='i2'))
            await wait_for(B, '__gc.pro.sells', 5000)
            await B.evaluate('__gc.proSheet("check")'); await B.wait_for_timeout(400)
            ok('the sheet opened from a locked thing says why', 'free Joker analysis is used' in (await text(B, '#pro-why')))
            await B.click('#btn-pro-buy')
            welcomed = await wait_for(B, '__gc.dialogKind === "pro-welcome"', 8000)
            uidB = await B.evaluate('__gc.me.uid')
            ok('bought: the welcome, Pro on', welcomed and (await pro(B))['on'], await kind(B))
            ok('a guest is shown how to keep it: save the account (a quiet second action)', await has(B, '#pro-save-note') and (await text(B, '#btn-pro-save')) == 'Save the account' and (await text(B, '#btn-pro-ok')) == 'Play')
            if SHOTS: await B.wait_for_timeout(500); await B.screenshot(path=SHOT_DIR + '/store-welcome-guest.png')
            await B.click('#btn-pro-save')
            ok('... which opens the account sheet', await wait_for(B, '!!document.getElementById("acct-email")', 4000))
            saved = await sign_in(B, 'bea@example.com', 'Bea')
            await B.wait_for_timeout(400); await prep(B); await close_all(B)
            ok('the account is saved and Pro stays on it', saved and (await pro(B))['on'] and (await B.evaluate('__gc.me.uid')) == uidB)
            await B.evaluate('__gc.go("profile")'); await B.wait_for_timeout(500)
            ok('the Profile: the gold name, the plan with the store\'s price', await has(B, '#prof-name.pro .pro-mark') and 'Free trial until' in (await text(B, '#pro-entry')) and 'Then AED 109.99 a year' in (await text(B, '#pro-entry')), await text(B, '#pro-entry'))
            ok('the settings end with the subscription and the way to manage it in the App Store', await has(B, '#settings-card #sub-row') and 'Free trial until' in (await text(B, '#sub-line')) and (await text(B, '#btn-sub-store')) == 'Manage in the App Store', await text(B, '#sub-row'))
            await B.click('#btn-sub-store'); await B.wait_for_timeout(200)
            ok('... which opens the store\'s own subscription page', len(await calls(B, 'manageSubscriptions')) == 1)
            if SHOTS: await B.evaluate('document.getElementById("sub-row").scrollIntoView({ block: "center" })'); await B.wait_for_timeout(300); await B.screenshot(path=SHOT_DIR + '/store-profile-row.png')
            await B.click('#pro-entry'); await B.wait_for_timeout(500)
            ok('the status page: the same way to the store, no way to Stripe', (await kind(B)) == 'pro-manage' and (await text(B, '#btn-pro-store')) == 'Manage in the App Store' and not await has(B, '#btn-pro-portal'), await text(B, '#pro-manage-slot'))
            if SHOTS: await B.wait_for_timeout(300); await B.screenshot(path=SHOT_DIR + '/store-status-ios.png')
            await close_all(B)
            # deleting the account does not stop the store's subscription: the dialog says so
            await B.evaluate('document.getElementById("btn-delete-acct").click()'); await B.wait_for_timeout(400)
            ok('deleting the account: the store\'s subscription has to be cancelled in the store', (await kind(B)) == 'delete' and 'billed by the App Store' in (await text(B, '#delete-store')), await text(B, '#delete-store'))
            await close_all(B)

            # ================================================================ 5. the same account on the website
            w_ctx = await br.new_context(**phone)
            W = await open_page(w_ctx, 'W')
            admin('shift', ms=61000)  # (past the one-code-a-minute limit for this address)
            await account(W, 'bea@example.com', None)
            await W.evaluate('__gc.go("profile")'); await W.wait_for_timeout(600)
            ok('bought in the app, Pro on the website too', (await pro(W))['on'] and (await W.evaluate('__gc.me.uid')) == uidB and await has(W, '#prof-name.pro .pro-mark'))
            await W.click('#pro-entry'); await W.wait_for_timeout(700)
            ok('the website says where it lives, and offers no Stripe page for it', (await kind(W)) == 'pro-manage' and 'Bought in the App Store' in (await text(W, '#pro-where')) and not await has(W, '#btn-pro-portal') and (await pro(W))['via'] == 'apple', await text(W, '#pro-manage-slot'))
            ok('... the plan line names no price the website does not know', (await text(W, '#pro-plan-line')).startswith('Free trial until') and 'Then the yearly plan starts' in (await text(W, '#pro-plan-line')), await text(W, '#pro-plan-line'))
            await close_all(W)
            ok('the Profile\'s row on the website says the same', 'Bought in the App Store' in (await text(W, '#sub-where')) and not await has(W, '#btn-sub-portal'), await text(W, '#sub-row'))
            await w_ctx.close()

            # ================================================================ 6. Restore purchases, and what a start picks up
            # the same phone (the same store account), another guest: the purchase is not taken quietly
            c_ctx = await br.new_context(**phone)
            held = await B.evaluate('JSON.parse(localStorage.getItem("test.iap")).purchases')
            C = await open_page(c_ctx, 'C', iap=dict(platform='ios', products=IOS_PRODUCTS, device='i2', purchases=held))
            await wait_for(C, '__gc.pro.sells', 5000); await online(C); await C.wait_for_timeout(800)
            uidC = await C.evaluate('__gc.me.uid')
            claims = [c for c in admin('storelog')['claims'] if c['uid'] == uidC]
            ok('another account on the same store account: a start of the app takes nothing', uidC != uidB and not (await pro(C))['on'] and len(claims) == 0, claims)
            await C.evaluate('__gc.go("profile")'); await C.wait_for_timeout(400)
            ok('without Pro the settings offer Restore purchases', (await text(C, '#sub-line')) == 'No subscription' and (await text(C, '#btn-sub-restore')) == 'Restore purchases', await text(C, '#sub-row'))
            await C.click('#pro-entry'); await C.wait_for_timeout(400)
            await C.click('#btn-pro-restore')
            back = await wait_for(C, '__gc.pro.on', 7000)
            ok('Restore purchases on the sheet: Pro comes to this account, the sheet closes', back and 'back on this account' in (await toast(C)) and (await kind(C)) != 'pro' and len(await calls(C, 'restorePurchases')) == 1, [await toast(C), await kind(C)])
            rows = admin('storelog')['rows']
            ok('... the purchase moved: the account that held it has it no more', len([r for r in rows if r['uid'] == uidC]) == 1 and not any(r['uid'] == uidB for r in rows), rows)
            await B.reload(); await B.wait_for_timeout(600); await prep(B)
            await wait_for(B, '!!__gc.me', 5000); await B.wait_for_timeout(800)
            ok('... and it does not jump back by itself when that account starts the app', not (await pro(B))['on'] and not any(r['uid'] == uidB for r in admin('storelog')['rows']))
            # nothing to restore
            d_ctx = await br.new_context(**phone)
            D = await open_page(d_ctx, 'D', iap=dict(platform='ios', products=IOS_PRODUCTS, device='i3'))
            await wait_for(D, '__gc.pro.sells', 5000)
            await D.evaluate('__gc.proSheet()'); await D.wait_for_timeout(400)
            await D.click('#btn-pro-restore'); await D.wait_for_timeout(700)
            ok('Restore with nothing bought: said so, the sheet stays', 'No Joker Pro purchase was found' in (await toast(D)) and (await kind(D)) == 'pro' and not (await pro(D))['on'], await toast(D))
            await iap_set(D, restoreFail=True); await D.wait_for_timeout(2400)
            await D.click('#btn-pro-restore'); await D.wait_for_timeout(600)
            ok('Restore when the store is out of reach: "could not be checked"', 'could not be checked' in (await toast(D)), await toast(D))
            await d_ctx.close()

            # a renewal the server has not heard of: the store's list has a later end for this account's purchase
            rowC = [r for r in admin('storelog')['rows'] if r['uid'] == uidC][0]
            admin('storeend', id=rowC['id'])
            await C.reload(); await C.wait_for_timeout(500); await prep(C)
            await wait_for(C, '!!__gc.me', 5000); await C.wait_for_timeout(600)
            ok('the subscription ran out on the server: Pro is off, the purchase was made for another account, so nothing is taken', not (await pro(C))['on'])
            renewed = [dict(transactionId='i2-1', productIdentifier='jokerpro_year', productType='subs', appAccountToken=uidC.upper(), expirationDate='2099-01-01T00:00:00Z',
                            jwsRepresentation='apple.' + b64(dict(id='i2-1', product='jokerpro_year', days=365)))]
            await iap_set(C, purchases=renewed)
            await C.reload(); await C.wait_for_timeout(500); await prep(C)
            ok('renewed for this account: a start shows it to the server, Pro is on again', await wait_for(C, '__gc.pro.on', 7000))
            # the store has news while the app runs (a purchase approved, a renewal)
            admin('storeend', id=rowC['id'])
            await C.reload(); await C.wait_for_timeout(500); await prep(C); await wait_for(C, '__gc.pro.on', 7000)
            n0 = len([c for c in admin('storelog')['claims'] if c['uid'] == uidC])
            admin('storeend', id=rowC['id'])
            await C.evaluate('(function () { __gc.me.profile.pro_until = new Date(Date.now() - 1000).toISOString(); window.__iapListeners.forEach(function (l) { if (l[0] === "transactionUpdated") l[1]({}); }); })()')
            n1 = n0
            for _ in range(60):   # (the page waits a moment for the store to finish talking before it looks)
                n1 = len([c for c in admin('storelog')['claims'] if c['uid'] == uidC])
                if n1 > n0: break
                await C.wait_for_timeout(100)
            again = await wait_for(C, '__gc.pro.on && __gc.me.profile.pro_until > new Date(Date.now() + 86400000).toISOString()', 5000)
            ok('the store reports a change while the app runs: the purchase is shown to the server again, quietly', again and n1 == n0 + 1 and admin('storelog')['claims'][-1]['quiet'], [n0, n1])
            await c_ctx.close(); await b_ctx.close()

            # ================================================================ 7. an account with a subscription from the website, in the app
            s_ctx = await br.new_context(**phone)
            Sp = await open_page(s_ctx, 'S', iap=dict(platform='ios', products=IOS_PRODUCTS, device='i4'))
            await account(Sp, 'sam@example.com', 'Sam')
            uidS = await Sp.evaluate('__gc.me.uid')
            admin('pro', uid=uidS, days=200, plan='year', sub=True)
            await Sp.reload(); await Sp.wait_for_timeout(500); await prep(Sp); await wait_for(Sp, '__gc.pro.on', 6000)
            await Sp.evaluate('__gc.go("profile")'); await Sp.wait_for_timeout(500)
            await Sp.click('#pro-entry'); await Sp.wait_for_timeout(700)
            ok('Pro from the website, in the app: on, with a line that says where it is managed, no link out', (await kind(Sp)) == 'pro-manage' and 'Bought on joker-chess.com' in (await text(Sp, '#pro-where')) and not await has(Sp, '#btn-pro-portal') and not await has(Sp, '#btn-pro-store') and not await has(Sp, '#pro-manage-slot a'), await text(Sp, '#pro-manage-slot'))
            await close_all(Sp)
            await Sp.evaluate('__gc.proSheet()'); await Sp.wait_for_timeout(400)
            ok('... and the sheet is never offered to a Pro player', (await kind(Sp)) == 'pro-manage')
            await s_ctx.close()

            # ================================================================ 8. Google Play
            admin('prostores', ios='on', android='test')
            g_ctx = await br.new_context(**phone)
            G = await open_page(g_ctx, 'G', iap=dict(platform='android', products=PLAY_PRODUCTS, device='g1'))
            await account(G, 'gil@example.com', 'Gil')
            uidG = await G.evaluate('__gc.me.uid')
            await G.wait_for_timeout(500)
            ok('Google Play in test: an ordinary account is shown nothing', not (await pro(G))['sells'] and not (await pro(G))['store']['allowed'])
            admin('addadmin', uid=uidG)
            await G.reload(); await G.wait_for_timeout(500); await prep(G)
            ok('... the owner\'s account is', await wait_for(G, '__gc.pro.sells', 6000), (await pro(G))['store'])
            gps = await calls(G, 'getProducts')
            ok('Google is asked twice, one kind after the other: the subscription, then the one-time product', [(c[1]['productType'], c[1]['productIdentifiers']) for c in gps[:2]] == [('subs', ['jokerpro_sub']), ('inapp', ['jokerpro_founder'])], gps)
            await G.evaluate('__gc.proSheet()'); await G.wait_for_timeout(400)
            ok('the sheet: Google\'s prices, the trial (its offer comes first), Google named', (await text(G, '#plan-year .pl-price')) == '$29.99' and (await text(G, '#plan-year .pl-sub')) == 'only $2.50 a month' and (await text(G, '#btn-pro-buy')) == 'Try 7 days free'
               and (await text(G, '#pro-payby')).startswith('Payment goes through Google Play.'), [await text(G, '#plan-year'), await text(G, '#btn-pro-buy'), await text(G, '#pro-payby')])
            if SHOTS: await G.screenshot(path=SHOT_DIR + '/store-sheet-android.png')
            await G.click('#plan-month'); await G.wait_for_timeout(100)
            await G.click('#btn-pro-buy')
            ok('the monthly plan bought', await wait_for(G, '__gc.dialogKind === "pro-welcome"', 8000) and (await pro(G))['on'])
            cp = (await calls(G, 'purchaseProduct'))[0][1]
            ok('... the subscription with its base plan, the account named', cp['productIdentifier'] == 'jokerpro_sub' and cp['planIdentifier'] == 'month' and cp['productType'] == 'subs' and cp['appAccountToken'] == uidG, cp)
            ok('an account that is saved gets no "save your account" line', not await has(G, '#pro-save-note') and not await has(G, '#btn-pro-save'))
            rowG = [r for r in admin('storelog')['rows'] if r['uid'] == uidG]
            ok('... on the server: Google Play, the monthly plan, no trial', len(rowG) == 1 and rowG[0]['store'] == 'google' and rowG[0]['plan'] == 'month' and not rowG[0]['trial'], rowG)
            await close_all(G)
            await G.evaluate('__gc.go("profile")'); await G.wait_for_timeout(500)
            ok('the Profile: the monthly plan, managed in Google Play', 'Monthly plan' in (await text(G, '#sub-line')) and (await text(G, '#btn-sub-store')) == 'Manage in Google Play', await text(G, '#sub-row'))
            # the subscription ends; Founder is bought (a one-time product)
            admin('storeend', id=rowG[0]['id'])
            await iap_set(G, purchases=[])
            await G.reload(); await G.wait_for_timeout(500); await prep(G); await wait_for(G, '__gc.pro.sells', 6000)
            ok('the subscription ended: Pro is off, the sheet is for sale again', not (await pro(G))['on'])
            await G.evaluate('__gc.proSheet()'); await G.wait_for_timeout(400)
            await G.click('#plan-founder'); await G.wait_for_timeout(100)
            ok('Founder on Google Play', (await text(G, '#btn-pro-buy')) == 'Become a Founder for $79.99')
            await G.click('#btn-pro-buy')
            ok('Founder bought', await wait_for(G, '__gc.dialogKind === "pro-welcome"', 8000) and (await pro(G))['founder'])
            cp = (await calls(G, 'purchaseProduct'))[0][1]
            ok('... as a one-time product, without a base plan', cp['productIdentifier'] == 'jokerpro_founder' and cp['productType'] == 'inapp' and 'planIdentifier' not in cp, cp)
            await close_all(G)
            await G.evaluate('__gc.go("profile")'); await G.wait_for_timeout(500)
            ok('a Founder: for life, nothing to manage', 'Founder. Pro for life.' in (await text(G, '#sub-line')) and not await has(G, '#btn-sub-store') and not await has(G, '#btn-sub-portal'), await text(G, '#sub-row'))
            await g_ctx.close()

            # the trial already used on Google (its offer is not in the list): the button names the price
            t_ctx = await br.new_context(**phone)
            admin('prostores', ios='on', android='on')
            T = await open_page(t_ctx, 'T', iap=dict(platform='android', products=PLAY_PRODUCTS[1:], device='g2'))
            await wait_for(T, '__gc.pro.sells', 6000)
            await T.evaluate('__gc.proSheet()'); await T.wait_for_timeout(400)
            ok('no trial left for this store account: the button names the price', (await text(T, '#btn-pro-buy')) == 'Get Pro for $29.99 a year' and (await text(T, '#pro-fine')) == '$29.99 a year. Renews until you cancel.', [await text(T, '#btn-pro-buy'), await text(T, '#pro-fine')])
            await t_ctx.close()

            # ================================================================ 8b. the app brings Pro up by itself the way the site does
            # (the line on the Play tab, the sheet after a finished game), and the plans behind both carry the store's prices
            day = lambda k: time.strftime('%Y-%m-%d', time.localtime(time.time() + k * 86400))
            async def one_game(pg):
                await pg.evaluate("""() => { __gc.closeDialog(); __gc.startGame({ mode: 'local', color: 'w', tc: 'none' });
                    for (const u of ['e2e4', 'e7e5']) { const m = __gc.game.pos.moveFromUci(u); __gc.tryMove(m & 127, (m >> 7) & 127, false); } }""")
                await wait_for(pg, '__gc.game.records.length === 2', 3000)
                await pg.evaluate('__gc.game.end("1-0", "resign", performance.now()); __gc.gameOver()')
                await pg.wait_for_timeout(350)
                await pg.evaluate('__gc.closeDialog(); __gc.go("play")')
            USD = [dict(p, price=v, priceString='$%.2f' % v, currencyCode='USD') for p, v in zip(IOS_PRODUCTS, (3.99, 29.99, 79.99))]
            seed = dict(gamesDone=9, saveAsk=dict(n=3, at=0), remindAsk=dict(n=3, at=int(time.time() * 1000)), days=[day(-9), day(-8)])
            # the first day the app sees Pro on sale: nothing is brought up
            f_ctx = await br.new_context(**phone)
            F = await open_page(f_ctx, 'F', iap=dict(platform='ios', products=USD, device='i7'), store=seed)
            await prep(F, noask=False); await wait_for(F, '__gc.pro.sells', 5000)
            await F.evaluate('__gc.go("learn"); __gc.go("play")'); await F.wait_for_timeout(400)
            await one_game(F); await F.wait_for_timeout(2500)
            ok('the app, the first day Pro is on sale there: no line, no sheet after a game', not await has(F, '#pro-banner') and (await kind(F)) != 'pro-offer', [await kind(F), (await pro(F))['offer']])
            await f_ctx.close()
            # a returning player: the quiet line on the Play tab, and the plans behind it at the store's prices
            l_ctx = await br.new_context(**phone)
            Ln = await open_page(l_ctx, 'L', iap=dict(platform='ios', products=USD, device='i8'), store=dict(seed, proOffer=dict(first=day(-9))))
            await prep(Ln, noask=False); await wait_for(Ln, '__gc.pro.sells', 5000)
            await Ln.evaluate('__gc.go("learn"); __gc.go("play")'); await Ln.wait_for_timeout(500)
            ok('the app, a returning player: one quiet line about Pro on the Play tab, nothing over the screen', await has(Ln, '#pro-banner') and 'Joker Pro' in (await text(Ln, '#pro-banner .pb-t b') or '') and not await Ln.evaluate('__gc.dialogOpen'), await text(Ln, '#pro-banner'))
            if SHOTS: await Ln.wait_for_timeout(500); await Ln.screenshot(path=SHOT_DIR + '/store-banner-ios.png')
            await Ln.click('#pro-banner-go'); await Ln.wait_for_timeout(500)
            ok('... a tap on it opens the plans with the App Store\'s prices', (await kind(Ln)) == 'pro' and (await text(Ln, '#plan-year .pl-price')) == '$29.99' and (await text(Ln, '#btn-pro-buy')) == 'Try 7 days free' and (await text(Ln, '#pro-payby') or '').startswith('Payment goes through the App Store.'), [await kind(Ln), await text(Ln, '#plan-year .pl-price'), await text(Ln, '#btn-pro-buy')])
            await l_ctx.close()
            # the sheet after a finished game (the Play tab's line already hidden for today)
            o_ctx = await br.new_context(**phone)
            Of = await open_page(o_ctx, 'Of', iap=dict(platform='ios', products=USD, device='i9'), store=dict(seed, proOffer=dict(first=day(-30), last=day(-8), n=3, banner=dict(id='plain', day=day(0), off=True))))
            await prep(Of, noask=False); await wait_for(Of, '__gc.pro.sells', 5000)
            await one_game(Of)
            got = await wait_for(Of, '__gc.dialogKind === "pro-offer"', 6000)
            ok('the app, after a finished game and back on the Play tab: the offer', got and (await text(Of, '#btn-offer-go')) == 'See what Pro gives' and await has(Of, '#btn-offer-later'), [await kind(Of), await text(Of, '.veil .sheetdlg')])
            if SHOTS: await Of.wait_for_timeout(600); await Of.screenshot(path=SHOT_DIR + '/store-offer-ios.png')
            if got: await Of.click('#btn-offer-go'); await Of.wait_for_timeout(600)
            ok('... its button opens the plans with the App Store\'s prices, and buying from there works', (await kind(Of)) == 'pro' and (await text(Of, '#plan-month .pl-price')) == '$3.99' and 'Stripe' not in (await text(Of, '.pro-card') or ''), [await kind(Of), await text(Of, '#plan-month .pl-price')])
            await Of.click('#btn-pro-buy')
            ok('... bought from the offer: Pro is on', await wait_for(Of, '__gc.pro.on', 8000) and len(await calls(Of, 'purchaseProduct')) == 1, await pro(Of))
            await one_game(Of); await Of.wait_for_timeout(2500)
            ok('... and a Pro player is never offered it again', (await kind(Of)) not in ('pro-offer', 'pro') and not await has(Of, '#pro-banner'), await kind(Of))
            await o_ctx.close()

            # ================================================================ 9. the website while a store subscription runs
            # (an account whose Pro ran out on the server's clock, but whose store subscription is still on file: only
            # the server can say so)
            x_ctx = await br.new_context(**phone)
            X = await open_page(x_ctx, 'X')
            admin('shift', ms=61000)
            await account(X, 'gil@example.com', None)
            await X.wait_for_timeout(400)
            ok('a Founder from Google Play on the website: Pro, with the line that says where it was bought', (await pro(X))['on'] and (await pro(X))['founder'])
            await x_ctx.close()

            await a_ctx.close()
            await br.close()
    finally:
        srv.terminate()
    bad = {k: v for k, v in errs.items() if v}
    ok('no page errors', not bad, bad)
    failed = [n for n, c in results if not c]
    print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
    for n in failed: print('  FAILED:', n)
    sys.exit(1 if failed else 0)

asyncio.run(main())
