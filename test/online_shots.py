# Screenshots of the online UI against the local test server (fonts served from vendor/).
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from og_image import font_css, serve_font  # noqa: E402  (og_image only runs main() under __main__)

ROOT = '/home/claude/golden-chess'
PORT = 8793
BASE = f'http://127.0.0.1:{PORT}/'
OUT = ROOT + '/test/shots/'
HELPERS = open(ROOT + '/test/helpers.js').read()

def admin(op, **kw):
    req = urllib.request.Request(BASE + 'admin', data=json.dumps(dict(op=op, **kw)).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

async def main(lang):
    srv = subprocess.Popen(['node', ROOT + '/test/server/mock-server.mjs', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try: urllib.request.urlopen(BASE, timeout=1).read(); break
        except Exception: time.sleep(0.1)
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def page(w, h, touch=False):
                ctx = await br.new_context(viewport={'width': w, 'height': h}, has_touch=touch, device_scale_factor=2 if w < 500 else 1)
                pg = await ctx.new_page()
                await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body=font_css(), content_type='text/css'))
                await pg.route('**/fonts.gstatic.com/local/**', serve_font)
                await pg.goto(BASE)
                await pg.evaluate(f"__gc.settings.lang='{lang}'; localStorage.setItem('goldenchess.settings', JSON.stringify(__gc.settings));")
                await pg.reload(); await pg.evaluate(HELPERS)
                return pg
            A = await page(390, 844, True); B = await page(1280, 820)
            async def until(pg, js, n=100):
                for _ in range(n):
                    if await pg.evaluate(js): return True
                    await pg.wait_for_timeout(50)
                return False
            async def sign_in(pg, email, name, shot=None):
                await until(pg, '__gc.curView === "signin" && !!document.getElementById("acct-email")')
                if shot: await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + f'on_{lang}_signin_{shot}.png')
                await pg.fill('#acct-email', email); await pg.click('#btn-send-code')
                await until(pg, '!!document.getElementById("acct-code")')
                if shot: await pg.wait_for_timeout(200); await pg.screenshot(path=OUT + f'on_{lang}_code_{shot}.png')
                await pg.fill('#acct-code', admin('outbox', to=email)[-1]['code'])
                await until(pg, '!!document.getElementById("acct-name")')
                if shot: await pg.wait_for_timeout(200); await pg.screenshot(path=OUT + f'on_{lang}_name_{shot}.png')
                await pg.fill('#acct-name', name); await pg.click('#btn-name')
            await A.wait_for_timeout(300); await A.screenshot(path=OUT + f'on_{lang}_play_phone.png')
            await A.click('#play-tc'); await A.wait_for_timeout(200)
            await A.screenshot(path=OUT + f'on_{lang}_tc_phone.png')
            await A.click('#tc-3-2'); await A.click('#btn-start')
            await sign_in(A, 'anna@example.com', 'Anna', 'phone')
            await A.wait_for_timeout(1300)
            await A.screenshot(path=OUT + f'on_{lang}_searching_phone.png')
            await B.click('#btn-start'); await sign_in(B, 'boris@example.com', 'Boris', 'desktop')
            for pg in (A, B):
                for _ in range(100):
                    if await pg.evaluate('!!__gc.online'): break
                    await pg.wait_for_timeout(50)
            W, Bl = (A, B) if await A.evaluate('__gc.online.color') == 0 else (B, A)
            moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']
            for i, u in enumerate(moves):
                pg = W if i % 2 == 0 else Bl
                await pg.evaluate(f"(() => {{ const m = __gc.game.pos.moveFromUci('{u}'); __gc.tryMove(m & 127, (m >> 7) & 127, false); }})()")
                for _ in range(60):
                    if await A.evaluate(f'__gc.game.records.length === {i + 1}') and await B.evaluate(f'__gc.game.records.length === {i + 1}'): break
                    await A.wait_for_timeout(50)
            await W.evaluate('__gc.onlineAction("draw", {op: "offer"})')
            await A.wait_for_timeout(2600)
            await A.screenshot(path=OUT + f'on_{lang}_game_phone.png')
            await B.screenshot(path=OUT + f'on_{lang}_game_desktop.png')
            await Bl.evaluate('__gc.onlineAction("draw", {op: "decline"})')
            await A.wait_for_timeout(300)
            await A.evaluate('__gc.onlineAction("resign")')
            await A.wait_for_timeout(1200)
            await A.screenshot(path=OUT + f'on_{lang}_over_phone.png')
            await B.screenshot(path=OUT + f'on_{lang}_over_desktop.png')
            await B.evaluate('__gc.closeDialog()'); await B.click('#rail [data-nav=play]'); await B.wait_for_timeout(300)
            await B.screenshot(path=OUT + f'on_{lang}_play_desktop.png')
            await B.click('#btn-friend'); await B.wait_for_timeout(400)
            await B.screenshot(path=OUT + f'on_{lang}_friend_desktop.png')
            await B.click('#btn-invite-link'); await B.wait_for_timeout(900)
            await B.screenshot(path=OUT + f'on_{lang}_invite_desktop.png')
            await B.evaluate('__gc.closeDialog()')
            for v in ('ratings', 'profile'):
                await B.click(f'#rail [data-nav={v}]'); await B.wait_for_timeout(600)
                await B.screenshot(path=OUT + f'on_{lang}_{v}_desktop.png')
                await A.evaluate(f'__gc.go("{v}")'); await A.wait_for_timeout(600)
                await A.screenshot(path=OUT + f'on_{lang}_{v}_phone.png')
            await br.close()
    finally:
        srv.terminate()

for lang in sys.argv[1:] or ['en']:
    asyncio.run(main(lang))
print('done')
