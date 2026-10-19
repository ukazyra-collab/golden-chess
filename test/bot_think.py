# The bot plays like a person: no clock in bot games, a visible pause before each reply that depends on the position,
# quick forced moves, a longer pause before its golden move. Also: the Bots tab, picking a character, the colour choice.
# Run: python3 test/bot_think.py
import asyncio, statistics, sys, time
from playwright.async_api import async_playwright
URL = 'file:///home/claude/golden-chess/dist/preview.html#bots'
results = []
def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if extra != '' else '', flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await page.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await page.goto(URL); await page.wait_for_timeout(500)
        ok('Bots tab opens from the address', await page.evaluate('__gc.curView') == 'bots')
        ok('eight characters', await page.evaluate('document.querySelectorAll(".bot-tile").length') == 8)
        await page.click('#bot-5'); await page.wait_for_timeout(100)
        ok('picking a character shows it on top', 'Viktor' in await page.text_content('#bot-hero'))
        ok('the Play button names the character', 'Viktor' in await page.text_content('#btn-play'))
        await page.click('#opt-b')
        ok('colour choice', await page.evaluate('document.getElementById("opt-b").getAttribute("aria-pressed")') == 'true')
        await page.click('#bot-3'); await page.click('#opt-w'); await page.click('#btn-play'); await page.wait_for_timeout(300)
        ok('the game starts with Oskar, level 3', await page.evaluate('__gc.curView === "game" && __gc.game.cfg.mode === "bot" && __gc.game.cfg.level === 3'))
        ok('no clock in a bot game', await page.evaluate('__gc.game.clock === null && __gc.game.cfg.tc === null'))
        ok('the bot has a face and a name in the bar', await page.evaluate('!!document.querySelector("#bar-top .avatar.bot svg") && /Oskar/.test(document.getElementById("bar-top").textContent)'))
        # replies take a visible, varying time
        delays = []
        moves = [('e2', 'e4'), ('g1', 'f3'), ('f1', 'c4'), ('d2', 'd3'), ('b1', 'c3')]
        for a, z in moves:
            n = await page.evaluate('__gc.game.records.length')
            sq = lambda s: 'abcdefgh'.index(s[0]) + (int(s[1]) - 1) * 16
            legal = await page.evaluate(f'__gc.game.legal.some(m => (m & 127) === {sq(a)} && ((m >> 7) & 127) === {sq(z)})')
            if not legal: continue
            await page.evaluate(f'__gc.tryMove({sq(a)}, {sq(z)}, false)')
            t0 = time.time(); busy = False
            while time.time() - t0 < 12:
                if not busy: busy = await page.evaluate('!!document.querySelector("#bar-top .avatar.bot.busy")')
                if await page.evaluate(f'__gc.game.records.length >= {n + 2}'): break
                await page.wait_for_timeout(30)
            delays.append(round(time.time() - t0, 2))
            ok(f'thinking shown while the bot thinks (move {len(delays)})', busy)
            await page.wait_for_timeout(250)
        print('     reply times (s):', delays)
        ok('never instant', min(delays) >= 0.38, delays)
        ok('not the same time twice', len(set(delays)) > 1, delays)
        # the model itself, position by position
        r = await page.evaluate('''(() => {
          const out = {};
          const sample = (fen, uci, k) => { const xs = []; for (let i = 0; i < k; i++) xs.push(__gc.botThinkMs(uci)); return xs; };
          // middlegame, level 8
          __gc.startGame({mode:'bot', level:8, color:'b', tc:'none'}, {fen:'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9 Gg'});
          __gc.cancelPremoves && 0;
          out.mid = sample(null, null, 200);
          const g = __gc.game, gold = g.legal.find(m => m & GC.F_GOLDEN), normal = g.legal.find(m => !(m & GC.F_GOLDEN));
          out.gold = sample(null, GC.moveToUci(gold), 200);
          out.norm = sample(null, GC.moveToUci(normal), 200);
          // forced: only one legal reply (king in check with one square), no golden move left
          __gc.startGame({mode:'bot', level:5, color:'b', tc:'none'}, {fen:'R6k/8/5K2/8/8/8/8/8 b - - 0 1 -'});
          out.forcedLegal = __gc.game.legal.length;
          out.forced = sample(null, GC.moveToUci(__gc.game.legal[0]), 100);
          return out;
        })()''')
        med = lambda xs: statistics.median(xs)
        print('     middlegame median %.0f ms, golden median %.0f ms, forced median %.0f ms' % (med(r['norm']), med(r['gold']), med(r['forced'])))
        ok('middlegame thinking between 0.45 and 9 s', min(r['norm']) >= 450 and max(r['norm']) <= 9000, (min(r['norm']), max(r['norm'])))
        ok('a longer pause before the golden move', med(r['gold']) > med(r['norm']) + 600, (med(r['gold']), med(r['norm'])))
        ok('a forced move comes quickly', r['forcedLegal'] == 1 and max(r['forced']) < 900, (r['forcedLegal'], max(r['forced'])))
        ok('no console errors', not errs, errs[:3])
        await b.close()
    failed = [n for n, c in results if not c]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)
asyncio.run(main())
