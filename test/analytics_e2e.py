# Usage statistics (Google Analytics 4) on the live build, served as https://joker-chess.com/ from dist/web:
#  - outside Europe the tag loads at once, page views per tab, events for a bot game; no consent card
#  - in Europe (by the time zone) nothing loads until "Allow"; "No thanks" keeps it off; the answer is remembered
#  - Settings → Usage statistics off: no more events
#  - on localhost (tests, the mock server) nothing is sent at all
# Run: python3 test/analytics_e2e.py
import os, sys, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = open(os.path.join(ROOT, 'dist/web/index.html'), 'rb').read()
ok = fail = 0
def check(name, cond, extra=''):
    global ok, fail
    if cond: ok += 1
    else:
        fail += 1; print('FAIL', name, extra)

def page_for(browser, tz):
    ctx = browser.new_context(timezone_id=tz, viewport={'width': 390, 'height': 844}, locale='en-US')
    hits = []
    def route(r):
        u = r.request.url
        if u.startswith('https://joker-chess.com/') and ('.' not in u.split('/')[-1].split('?')[0]):
            return r.fulfill(status=200, content_type='text/html', body=HTML)
        if 'googletagmanager.com/gtag/js' in u:
            hits.append(u); return r.fulfill(status=200, content_type='application/javascript', body='window.__gtagLoaded=1;')
        return r.abort()
    ctx.route('**/*', route)
    p = ctx.new_page()
    return ctx, p, hits

def events(p):
    return p.evaluate("(window.dataLayer||[]).map(function(a){return Array.prototype.slice.call(a)}).filter(function(a){return a[0]==='event'}).map(function(a){return [a[1], a[2]]})")

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # outside Europe
    ctx, p, hits = page_for(b, 'Asia/Dubai')
    p.goto('https://joker-chess.com/?utm_source=youtube&utm_campaign=launch')
    p.wait_for_timeout(3500)
    check('dubai: tag loaded', len(hits) == 1 and 'G-7H6JEWRSN5' in hits[0], hits)
    check('dubai: no consent card', p.locator('#consent').count() == 0)
    ev = events(p)
    pv = [e for e in ev if e[0] == 'page_view']
    check('dubai: first page view keeps utm tags', pv and 'utm_source=youtube' in pv[0][1]['page_location'], pv)
    cfg = p.evaluate("(window.dataLayer||[]).map(function(a){return Array.prototype.slice.call(a)}).filter(function(a){return a[0]==='config'})")
    check('dubai: signals and ad personalisation off', cfg and cfg[0][2].get('allow_google_signals') is False and cfg[0][2].get('allow_ad_personalization_signals') is False, cfg)
    p.evaluate("location.hash='#learn'"); p.wait_for_timeout(600)
    pv2 = [e for e in events(p) if e[0] == 'page_view']
    check('dubai: tab change is a page view without utm', len(pv2) >= 2 and pv2[-1][1]['page_location'].endswith('/learn'), pv2)
    p.evaluate("window.__gc.startGame({mode:'bot', level:2, color:'w', tc:null})"); p.wait_for_timeout(500)
    gs = [e for e in events(p) if e[0] == 'game_start']
    check('dubai: bot game start event', gs and gs[-1][1]['mode'] == 'bot' and gs[-1][1]['level'] == 2, gs)
    # Settings: the switch is there, off stops events
    p.evaluate("window.__gc.settings.stats=false")
    n0 = len(events(p))
    p.evaluate("window.__gc.startGame({mode:'bot', level:3, color:'w', tc:null})"); p.wait_for_timeout(400)
    check('dubai: no events once turned off', len(events(p)) == n0, events(p)[n0:])
    ctx.close()

    # Europe: asks first
    ctx, p, hits = page_for(b, 'Europe/Berlin')
    p.goto('https://joker-chess.com/')
    p.wait_for_timeout(3500)
    check('berlin: nothing loaded before consent', len(hits) == 0, hits)
    check('berlin: consent card shown', p.locator('#consent').is_visible())
    check('berlin: one bright button', p.locator('#consent .sbtn.hot').count() == 1 and p.locator('#consent .sbtn.hot').inner_text() == 'Allow')
    p.click('#consent-yes'); p.wait_for_timeout(500)
    check('berlin: allow loads the tag', len(hits) == 1, hits)
    check('berlin: card gone', p.locator('#consent').count() == 0)
    check('berlin: queued page view sent after allow', any(e[0] == 'page_view' for e in events(p)))
    p.reload(); p.wait_for_timeout(3200)
    check('berlin: remembered, no card after reload', p.locator('#consent').count() == 0)
    check('berlin: tag loads on the next visit', len(hits) == 2, hits)
    ctx.close()

    ctx, p, hits = page_for(b, 'Europe/Paris')
    p.goto('https://joker-chess.com/')
    p.wait_for_timeout(3200)
    p.click('#consent-no'); p.wait_for_timeout(300)
    p.reload(); p.wait_for_timeout(3200)
    check('paris: no thanks keeps it off and is remembered', len(hits) == 0 and p.locator('#consent').count() == 0, hits)
    ctx.close()

    # localhost: never
    ctx = b.new_context(timezone_id='Asia/Dubai')
    hits = []
    ctx.route('**/*', lambda r: (hits.append(r.request.url), r.abort()) if 'googletagmanager' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=HTML) if r.request.url.startswith('http://localhost') else r.abort()))
    p = ctx.new_page(); p.goto('http://localhost:9/'); p.wait_for_timeout(3000)
    check('localhost: nothing sent', len(hits) == 0 and p.locator('#consent').count() == 0, hits)
    ctx.close()
    b.close()

print(f'analytics: {ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
