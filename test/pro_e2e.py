# Joker Pro, the paid tier (a PROTOTYPE), in the page itself.
# Part 1, dist/proto.html (window.GC_PROTO): the Pro sheet and its plans, "buying" (a switch on this device, no payment),
# the gold name and the Pro mark, the XP bonus, the coach's tips and their daily limit, the hint in a bot game, the
# Road's locked seasons, the Joker under lock, the Pro quest, the looks only Pro has, the streak freeze, turning Pro
# off, and that the sheet fits a phone, a small phone and a desktop.
# Part 2, dist/preview.html (the release configuration: no GC_PROTO): none of it is there, not even with a forged
# Pro state on the device.
# Run: python3 test/pro_e2e.py   (after node build.js)
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright

ROOT = '/home/claude/golden-chess'
PROTO = 'file://' + ROOT + '/dist/proto.html'
PLAIN = 'file://' + ROOT + '/dist/preview.html'
results = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name, extra if (not cond and extra != '') else '', flush=True)

INIT = 'window.__gcFastBot = true; window.__gcNoAsk = true; try { if (!localStorage.getItem("goldenchess.settings")) localStorage.setItem("goldenchess.settings", JSON.stringify({ lang: "%s" })); %s } catch (e) {}'
SEEN = 'localStorage.setItem("goldenchess.protoSeen", "true");' # the tour has opened by itself once already
PRO_ON = '(function () { try { var s = JSON.parse(localStorage.getItem("goldenchess.pro")); return !!(s && s.on); } catch (e) { return false; } })()'
GOLD = 'rgb(240, 185, 65)'

async def main():
    errs = []
    async with async_playwright() as p:
        br = await p.chromium.launch()

        async def open_page(url, w=390, h=844, lang='en', store=None, first=False):
            ctx = await br.new_context(viewport={'width': w, 'height': h})
            pg = await ctx.new_page()
            pg.set_default_timeout(6000)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'net::' not in m.text else None)
            await pg.route('**/fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
            seed = INIT % (lang, '' if first else SEEN)
            if store:
                seed += '(function () { if (localStorage.getItem("goldenchess.seeded")) return; var s = %s; for (var k in s) localStorage.setItem("goldenchess." + k, JSON.stringify(s[k])); localStorage.setItem("goldenchess.seeded", "1"); })();' % json.dumps(store)
            await pg.add_init_script(seed)
            await pg.goto(url); await pg.wait_for_timeout(600)
            return pg

        async def close_all(pg):
            for _ in range(4):
                if await pg.evaluate('!!__gc.dialogOpen'):
                    await pg.evaluate('__gc.closeDialog()'); await pg.wait_for_timeout(260)

        async def tour(pg, i):
            await close_all(pg)
            await pg.click('#proto-pill'); await pg.wait_for_timeout(300)
            await pg.click('#proto-pro-%d' % i); await pg.wait_for_timeout(450)

        async def set_pro(pg, on):
            if await pg.evaluate(PRO_ON) != on: await tour(pg, 1)

        async def text(pg, sel):
            return await pg.evaluate('(function () { var e = document.querySelector(%s); return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; })()' % json.dumps(sel))

        async def has(pg, sel):
            return await pg.evaluate('!!document.querySelector(%s)' % json.dumps(sel))

        async def kind(pg):
            return await pg.evaluate('__gc.dialogKind')

        async def store(pg, key):
            return await pg.evaluate('(function () { try { return JSON.parse(localStorage.getItem("goldenchess.%s")); } catch (e) { return null; } })()' % key)

        # ================================================================ part 1: the prototype
        # the first visit: the list of the prototype's screens opens by itself, once
        pg = await open_page(PROTO, first=True); await pg.wait_for_timeout(600)
        ok('the first visit opens the tour', (await kind(pg)) == 'proto' and await pg.evaluate('document.querySelectorAll(".proto-row.pro").length') == 17)
        ok('the earlier prototypes are one tap away', await pg.evaluate('Array.from(document.querySelectorAll(".proto-row:not(.pro)")).every(function (b) { return b.hidden; })') and await has(pg, '#proto-more'))
        await pg.click('#proto-more'); await pg.wait_for_timeout(150)
        ok('and open in place', not await has(pg, '#proto-more') and await pg.evaluate('document.querySelectorAll(".proto-row:not(.pro)").length') > 20 and await pg.evaluate('Array.from(document.querySelectorAll(".proto-row")).every(function (b) { return !b.hidden; })'))
        await pg.reload(); await pg.wait_for_timeout(1300)
        k2 = await kind(pg)
        ok('the second visit starts on the game', k2 is None, k2)
        await pg.context.close()
        pg = await open_page(PROTO)
        ok('the prototype page says it is one', await pg.evaluate('window.GC_PROTO === true') and await has(pg, '#proto-pill'))
        await pg.click('#proto-pill'); await pg.wait_for_timeout(300)
        ok('the tour opens with Joker Pro', (await text(pg, '.veil .dlg-title')) == 'Prototype: Joker Pro' and await pg.evaluate('document.querySelectorAll(".proto-row.pro").length') == 17,
           [await text(pg, '.veil .dlg-title'), await pg.evaluate('document.querySelectorAll(".proto-row.pro").length')])
        ok('and says that nothing is charged', 'No payment is taken' in (await text(pg, '.veil .dlg-sub') or ''))
        await close_all(pg)

        # ---- the Profile's line, the sheet
        await tour(pg, 11)
        ok('free: the Profile has a quiet line about Pro', await has(pg, '#pro-entry') and not await has(pg, '#pro-entry.on') and (await text(pg, '#pro-entry .pe-t b')) == 'Joker Pro', await text(pg, '#pro-entry'))
        ok('free: no Pro mark anywhere', not await has(pg, '.pro-mark.founder') and await pg.evaluate('document.querySelectorAll("#view-profile .pro-mark, .pname .pro-mark").length') == 0)
        await pg.click('#pro-entry'); await pg.wait_for_timeout(400)
        ok('it opens the Pro sheet', (await kind(pg)) == 'pro' and (await text(pg, '#pro-title')) == 'Joker Pro')
        ok('the player sees their own name with the mark, on the Joker Pro card', await has(pg, '#pro-art .pro-nm') and (await text(pg, '#pro-art .pro-mark')) == 'PRO' and await has(pg, '#pro-art .pro-seal svg')
           and await pg.evaluate('getComputedStyle(document.querySelector("#pro-art .pro-nm")).color') == GOLD, await pg.evaluate('getComputedStyle(document.querySelector("#pro-art .pro-nm")).color'))
        ok('the prototype says that nothing is charged, and names no payment page', await has(pg, '#pro-proto') and not await has(pg, '#pro-payby') and not await has(pg, '#pro-test'))
        ok('the game stays free, in the first line', 'stays free' in (await text(pg, '#pro-why') or ''), await text(pg, '#pro-why'))
        ok('five perks', await pg.evaluate('document.querySelectorAll("#pro-perks .pro-perk").length') == 5)
        ok('the year is picked from the start', await pg.evaluate('document.getElementById("plan-year").getAttribute("aria-checked")') == 'true'
           and await pg.evaluate('document.getElementById("plan-month").getAttribute("aria-checked")') == 'false')
        ok('the year: its price, a month of it, the saving', '$29.99' in (await text(pg, '#plan-year')) and 'only $2.50 a month' in (await text(pg, '#plan-year')) and 'save 37%' in (await text(pg, '#plan-year')), await text(pg, '#plan-year'))
        ok('the month: its price', '$3.99' in (await text(pg, '#plan-month')), await text(pg, '#plan-month'))
        ok('the button offers the trial', (await text(pg, '#btn-pro-buy')) == 'Try 7 days free' and (await text(pg, '#pro-fine')) == 'Then $29.99 a year. Cancel any time.', [await text(pg, '#btn-pro-buy'), await text(pg, '#pro-fine')])
        await pg.click('#plan-month'); await pg.wait_for_timeout(100)
        ok('the month: its own button and line', (await text(pg, '#btn-pro-buy')) == 'Get Pro for $3.99 a month' and (await text(pg, '#pro-fine')) == 'Cancel any time.'
           and await pg.evaluate('document.getElementById("plan-year").getAttribute("aria-checked")') == 'false', [await text(pg, '#btn-pro-buy'), await text(pg, '#pro-fine')])
        await pg.click('#plan-founder'); await pg.wait_for_timeout(100)
        ok('the founder: one payment, for the first thousand', (await text(pg, '#btn-pro-buy')) == 'Become a Founder for $79.99' and 'One payment' in (await text(pg, '#pro-fine')) and 'first 1,000 players' in (await text(pg, '#plan-founder')),
           [await text(pg, '#btn-pro-buy'), await text(pg, '#plan-founder')])
        await pg.click('#plan-founder'); await pg.wait_for_timeout(100)
        ok('a second tap goes back to the year', (await text(pg, '#btn-pro-buy')) == 'Try 7 days free')
        ok('the sheet says no payment is taken', (await text(pg, '#pro-proto')) == 'Prototype: no payment is taken.')
        ok('one bright button', await pg.evaluate('document.querySelectorAll(".veil .start-btn").length') == 1)
        await pg.click('#btn-pro-later'); await pg.wait_for_timeout(300)
        ok('"Not now" closes it and changes nothing', (await kind(pg)) is None and not await pg.evaluate(PRO_ON))

        # ---- the sheet fits: the button whole and on the screen, nothing sideways
        for nm, w, h in [('a phone', 390, 844), ('a small phone', 375, 667), ('a narrow phone', 320, 568), ('a desktop', 1280, 800)]:
            for lg in ['en', 'ru']:
                q = await open_page(PROTO, w, h, lg)
                await tour(q, 0); await q.wait_for_timeout(500)
                m = await q.evaluate('(function () { var b = document.getElementById("btn-pro-buy").getBoundingClientRect(), l = document.getElementById("btn-pro-later").getBoundingClientRect(), c = document.querySelector(".veil .sheetdlg"), body = document.getElementById("pro-body");'
                                     'return { bh: Math.round(b.height), bottom: Math.round(l.bottom), top: Math.round(c.getBoundingClientRect().top), vh: innerHeight, vw: innerWidth, sw: document.documentElement.scrollWidth, bw: body.scrollWidth - body.clientWidth, scroll: body.scrollHeight - body.clientHeight,'
                                     ' cardScroll: c.scrollHeight - c.clientHeight, btnW: document.getElementById("btn-pro-buy").scrollWidth - document.getElementById("btn-pro-buy").clientWidth }; })()')
                ok('the sheet on %s (%s): the button whole, on the screen' % (nm, lg), m['bh'] >= 60 and m['bottom'] <= m['vh'] and m['top'] >= 0 and m['sw'] <= m['vw'] and m['bw'] <= 0 and m['cardScroll'] <= 1 and m['btnW'] <= 0, m)
                if nm == 'a phone': ok('a phone shows the whole sheet without scrolling (%s)' % lg, m['scroll'] <= 1, m)
                if nm == 'a small phone': ok('a small phone scrolls the perks, not the button (%s)' % lg, m['scroll'] > 20, m)
                if lg == 'ru' and nm == 'a phone':
                    ok('Russian: the button and the line', (await text(q, '#btn-pro-buy')) == 'Попробовать 7 дней бесплатно' and (await text(q, '#pro-fine')) == 'Потом $29.99 в год. Отменить можно в любой момент.', [await text(q, '#btn-pro-buy'), await text(q, '#pro-fine')])
                await q.context.close()

        # ---- "buying": a switch on this device
        await tour(pg, 0); await pg.click('#btn-pro-buy'); await pg.wait_for_timeout(700)
        st = await store(pg, 'pro')
        ok('Pro starts: the year, on trial', (await kind(pg)) == 'pro-welcome' and st and st['on'] and st['plan'] == 'year' and st['trial'] and not st['founder'], st)
        ok('the welcome shows the gold name', await has(pg, '.pro-welcome .pro-who.big .pro-mark') and (await text(pg, '#btn-pro-ok')) == 'Play')
        await pg.click('#btn-pro-ok'); await pg.wait_for_timeout(300)
        await tour(pg, 11)
        ok('the Profile says Pro is on, with the plan', await has(pg, '#pro-entry.on') and 'Free trial, until' in (await text(pg, '#pro-entry')) and 'Manage' in (await text(pg, '#pro-entry')), await text(pg, '#pro-entry'))
        await pg.click('#pro-entry'); await pg.wait_for_timeout(350)
        tiles = await pg.evaluate('Array.from(document.querySelectorAll("#pro-tiles .st-tile")).map(function (t) { return t.textContent.replace(/\\s+/g, " ").trim(); })')
        ok('it opens the status: the card, the plan, what Pro has given, the freezes', (await kind(pg)) == 'pro-manage' and await has(pg, '.pro-manage #pro-art .pro-seal') and 'Free trial' in (await text(pg, '#pro-plan-line'))
           and len(tiles) == 4 and tiles[0].endswith('XP from the Pro bonus') and tiles[1].endswith('Joker analyses') and tiles[2].endswith('pack puzzles solved') and tiles[3] == '2streak freezes left', tiles)
        ok('the prototype has its own way to turn Pro off, and no subscription page', await has(pg, '#btn-pro-off') and not await has(pg, '#btn-pro-portal'))
        await pg.click('#btn-pro-ins'); await pg.wait_for_timeout(350)
        ok('"My Jokers": the numbers of the Joker Moves played', (await kind(pg)) == 'pro-insights' and await pg.evaluate('document.querySelectorAll(".ins-tiles .st-tile").length') == 3 and await pg.evaluate('document.querySelectorAll(".ins-bar").length') == 4,
           await text(pg, '.veil .sheetdlg'))
        await close_all(pg)

        # ---- the name in a game
        await tour(pg, 2); await pg.wait_for_timeout(400)
        mine = await pg.evaluate('(function () { var m = document.querySelectorAll(".pname .pro-mark"); if (m.length !== 1) return { n: m.length }; var bar = m[0].closest(".pname"); return { n: 1, color: getComputedStyle(bar.querySelector(".nm")).color, name: bar.querySelector(".nm").textContent }; })()')
        ok('Pro: the mark next to the own name only, the name gold', mine.get('n') == 1 and mine.get('color') == GOLD, mine)
        ok('Pro: the hint is in the menu, without a counter', await pg.evaluate('(function () { document.getElementById("btn-menu").click(); var b = document.querySelector(".menu-list button.hint"); return b ? b.textContent.trim() : null; })()') == 'Hint')
        await close_all(pg)

        # ---- XP: half as much again
        await tour(pg, 3); await pg.wait_for_timeout(1300)
        xp = await pg.evaluate('(function () { var g = __gc.game.prog; return g ? { xp: g.xp, bonus: g.proBonus, would: g.proWould, lines: g.lines.map(function (l) { return l.k + ":" + l.n; }) } : null; })()')
        ok('Pro: the result has the bonus', xp and xp['bonus'] > 0 and xp['bonus'] == round((xp['xp'] - xp['bonus']) * 0.5) and not xp['would'] and ('pro:%d' % xp['bonus']) in xp['lines'], xp)
        ok('Pro: and says so', await has(pg, '#op-pro.on') and (await text(pg, '#op-pro span:last-child')) == 'Pro bonus +%d XP' % xp['bonus'] and await has(pg, '#op-pro .pro-mark'), await text(pg, '#op-pro'))
        ok('Pro: the next season was open already', not await has(pg, '.op-season'))
        pro_xp = xp
        await close_all(pg)

        # ---- the coach: every missed Joker Move named
        await tour(pg, 4); await pg.wait_for_selector('.rp-miss', timeout=20000)
        ok('Pro: the report names the missed Joker Move', '★' in (await text(pg, '.rp-miss .gold')), await text(pg, '.rp-miss'))
        await pg.click('.rp-miss'); await pg.wait_for_timeout(500)
        ok('Pro: the coach offers it at once', await pg.evaluate('!!Array.from(document.querySelectorAll(".cbtn[data-act=best]")).find(function (b) { return b.offsetWidth > 0; })') and not await has(pg, '.cbtn[data-act=jk]') and not await has(pg, '#btn-jk'))

        # ---- the Road, the Joker, the quests, the looks
        await tour(pg, 5)
        ok('Pro: every season of the Road is open', await pg.evaluate('document.querySelectorAll(".cm-banner").length') == 4 and not await has(pg, '.cm-banner.locked') and not await has(pg, '.sn-pro') and not await has(pg, '.cm-zone.locked'))
        await tour(pg, 6)
        ok('Pro: the Joker is not locked', await has(pg, '#bot-golden') and not await has(pg, '#bot-golden.locked') and not await has(pg, '#bot-locked'))
        await tour(pg, 7); await pg.wait_for_timeout(400)
        ok('Pro: four quests, one of them the Pro quest', await pg.evaluate('document.querySelectorAll(".veil .quest").length') == 4 and await pg.evaluate('document.querySelectorAll(".veil .quest.pro").length') == 1 and not await has(pg, '#quest-pro'),
           await pg.evaluate('document.querySelectorAll(".veil .quest").length'))
        await tour(pg, 8)
        ok('Pro: five looks of its own, ready to pick', await pg.evaluate('document.querySelectorAll("#pro-looks .pro-look").length') == 5 and not await has(pg, '#pro-looks .pro-look.locked'))
        ok('Pro: every earned look is open too', not await has(pg, '.reward-list:not(.pro-looks) .reward-row.locked'))
        ok('the Pro looks come before the others', await pg.evaluate('(function () { var a = document.getElementById("pro-looks"), b = document.querySelector(".reward-list:not(.pro-looks)"), h = document.querySelector(".pro-h"); return !!(h.compareDocumentPosition(a) & 4) && !!(a.compareDocumentPosition(b) & 4); })()'))
        await pg.click('#pro-looks .pro-look:nth-child(4) .rw-use'); await pg.wait_for_timeout(200)
        ok('a Pro board goes on the board', await pg.evaluate('document.getElementById("shell").dataset.board') == 'royal' and await has(pg, '#pro-looks .pro-look:nth-child(4) .rw-use.on'))
        await pg.click('#pro-looks .pro-look:nth-child(1) .rw-use'); await pg.click('#pro-looks .pro-look:nth-child(3) .rw-use'); await pg.wait_for_timeout(200)
        eq = await pg.evaluate('JSON.stringify(__gc.prog.equip)')
        ok('the Pro title and the gold trail too', '"title":"pro"' in eq and '"jdot":"gold"' in eq and await pg.evaluate('document.getElementById("shell").dataset.jdot') == 'gold', eq)
        await tour(pg, 5)
        ok('the looks stay from one tour screen to the next', await pg.evaluate('document.getElementById("shell").dataset.board') == 'royal' and '"title":"pro"' in await pg.evaluate('JSON.stringify(__gc.prog.equip)'))

        # ---- the streak freeze: back after five days
        await tour(pg, 10); await pg.wait_for_timeout(500)
        fz = await store(pg, 'proFz')
        ok('Pro: a freeze covers the five days away', (await kind(pg)) == 'streak' and fz and fz['n'] == 1 and len(fz['days']) == 5, fz)
        ok('Pro: the streak is still four', (await text(pg, '.streak-big b')) == '4' and await has(pg, '#streak-frozen') and 'Left this month: 1' in (await text(pg, '#streak-frozen')), [await text(pg, '.streak-big b'), await text(pg, '#streak-frozen')])
        await close_all(pg)

        # ---- Pro runs out: the next start puts its looks back in the box
        await pg.evaluate('(function () { var s = JSON.parse(localStorage.getItem("goldenchess.pro")); s.until = Date.now() - 1000; localStorage.setItem("goldenchess.pro", JSON.stringify(s)); })()')
        await pg.wait_for_timeout(400); await pg.reload(); await pg.wait_for_timeout(700)
        ok('Pro over: the board and the title go back', await pg.evaluate('document.getElementById("shell").dataset.board') == 'slate' and '"title":"pro"' not in await pg.evaluate('JSON.stringify(__gc.prog.equip)') and not await pg.evaluate(PRO_ON),
           [await pg.evaluate('document.getElementById("shell").dataset.board'), await pg.evaluate('JSON.stringify(__gc.prog.equip)')])

        # ================================================================ a free player
        ok('free again', not await pg.evaluate(PRO_ON))
        await tour(pg, 2); await pg.wait_for_timeout(400)
        ok('free: no mark in a game, the name as always', not await has(pg, '.pname .pro-mark'))
        # the hint: three a day, the same moment again is free
        await pg.click('#btn-menu'); await pg.wait_for_timeout(250)
        ok('free: the hint shows what is left', (await text(pg, '.menu-list button.hint')) == 'Hint · 3/3')
        await pg.click('.menu-list button.hint'); await pg.wait_for_timeout(1300)
        tips = await store(pg, 'proHints')
        ok('a hint is taken and shows a move', tips and tips['n'] == 1 and (await text(pg, '#toast') or '').startswith('Coach: '), [tips, await text(pg, '#toast')])
        await pg.click('#btn-menu'); await pg.wait_for_timeout(250)
        ok('two left', (await text(pg, '.menu-list button.hint')) == 'Hint · 2/3')
        await pg.click('.menu-list button.hint'); await pg.wait_for_timeout(500)
        ok('the same position again costs nothing', (await store(pg, 'proHints'))['n'] == 1)
        await close_all(pg)
        # two players on one device: no hints
        await pg.evaluate('__gc.startGame({ mode: "local", color: "w", tc: "none" })'); await pg.wait_for_timeout(300)
        await pg.click('#btn-menu'); await pg.wait_for_timeout(250)
        ok('no hint in a game of two players', not await has(pg, '.menu-list button.hint'))
        await close_all(pg)

        # XP: what Pro would have added, one tap to the sheet and back
        await tour(pg, 3); await pg.wait_for_timeout(1300)
        xp = await pg.evaluate('(function () { var g = __gc.game.prog; return g ? { xp: g.xp, bonus: g.proBonus, would: g.proWould } : null; })()')
        ok('free: no bonus, the same XP as before Pro existed', xp and not xp['bonus'] and xp['would'] == round(xp['xp'] * 0.5) and xp['xp'] == pro_xp['xp'] - pro_xp['bonus'], [xp, pro_xp])
        ok('free: a quiet line about it', await has(pg, 'button#op-pro') and not await has(pg, '#op-pro.on') and (await text(pg, '#op-pro span:last-child')) == 'With Pro: +%d XP more' % xp['would'] and await has(pg, '#op-pro .pro-mark'), await text(pg, '#op-pro'))
        await pg.click('#op-pro'); await pg.wait_for_timeout(400)
        ok('it opens the sheet with the number', (await kind(pg)) == 'pro' and ('+%d XP' % xp['would']) in (await text(pg, '#pro-why')), await text(pg, '#pro-why'))
        await pg.click('#btn-pro-later'); await pg.wait_for_timeout(400)
        ok('"Not now" goes back to the result', (await kind(pg)) == 'over')
        await close_all(pg)

        # the Joker analysis: the report asks for it and tells nothing; one is free
        vis = 'Array.from(document.querySelectorAll(%s)).find(function (b) { return b.offsetWidth > 0; })'
        await tour(pg, 4); await pg.wait_for_selector('#btn-jk', timeout=20000)
        rep_text = await text(pg, '.veil .sheetdlg.report')
        ok('free: the report asks whether there was a Joker Move, and does not tell', await has(pg, '#rp-missed.jk-ask') and not await has(pg, '.rp-miss') and not re.search('[a-h1-8]★[a-h]', rep_text) and 'missed' not in rep_text.lower() and 'Was there a strong Joker Move' in rep_text and '★' not in (await text(pg, '#rp-missed')), rep_text[:200])
        ok('one analysis is free, and the button says what it does', (await text(pg, '#btn-jk')) == 'Show' and (await text(pg, '#jk-note')) == 'One analysis is free' and await pg.evaluate('document.getElementById("btn-jk").dataset.jk') == '1')
        ok('the review behind it is blind', await pg.evaluate('__gc.pro.blind') is True and await pg.evaluate('__gc.reviewState.moves[0].cls') != 'goldmiss' and '*' not in (await pg.evaluate('__gc.reviewState.moves[0].best') or ''),
           await pg.evaluate('[__gc.reviewState.moves[0].cls, __gc.reviewState.moves[0].best]'))
        await close_all(pg); await pg.evaluate('__gc.gotoPly(1)'); await pg.wait_for_timeout(400)
        coach = await pg.evaluate('(function () { var c = ' + vis % '".coach"' + '; return c ? c.textContent : ""; })()')
        ok('the coach on that move names no Joker Move, and the move list marks none', not re.search('[a-h1-8]★[a-h]', coach) and 'Joker' not in coach and not await has(pg, '.strip .s-goldmiss, .strip .jchip'), coach)
        await pg.evaluate('__gc.showReport()'); await pg.wait_for_selector('#btn-jk', timeout=8000)
        await pg.click('#btn-jk'); await pg.wait_for_timeout(500)
        jk = await store(pg, 'proJk')
        ok('a tap opens it: the missed Joker Move, by name', jk and jk['n'] == 1 and len(jk['keys']) == 1 and '★' in (await text(pg, '.rp-miss .gold') or '') and not await has(pg, '#btn-jk') and await pg.evaluate('__gc.pro.blind') is False, [jk, await text(pg, '#rp-missed')])
        ok('and says where the rest are', await has(pg, '#jk-more .pro-mark') and 'in every game' in (await text(pg, '#jk-more')), await text(pg, '#jk-more'))
        await pg.click('.rp-miss'); await pg.wait_for_timeout(500)
        coach = await pg.evaluate('(function () { var c = ' + vis % '".coach"' + '; return c ? c.textContent : ""; })()')
        ok('now the coach speaks of it', re.search('[a-h1-8]★[a-h]', coach) and await pg.evaluate('__gc.reviewState.moves[0].cls') == 'goldmiss' and await pg.evaluate('!!' + vis % '".cbtn[data-act=best]"'), coach)
        await pg.evaluate('__gc.showReport()'); await pg.wait_for_timeout(400)
        ok('the game stays open (nothing is taken twice)', await has(pg, '.rp-miss') and (await store(pg, 'proJk'))['n'] == 1)
        # the next game: the free one is used
        await tour(pg, 4); await pg.wait_for_selector('#btn-jk', timeout=20000)
        ok('the next game: the same card, the button now leads to Pro', await has(pg, '#btn-jk.pro .pro-mark') and (await text(pg, '#jk-note')) == 'Your free analysis is used' and await pg.evaluate('document.getElementById("btn-jk").dataset.pro') == '1'
           and not await has(pg, '.rp-miss') and await pg.evaluate('__gc.pro.blind') is True, await text(pg, '#rp-missed'))
        await pg.click('#btn-jk'); await pg.wait_for_timeout(450)
        ok('it opens the Pro sheet with the reason', (await kind(pg)) == 'pro' and 'free Joker analysis is used' in (await text(pg, '#pro-why')) and (await store(pg, 'proJk'))['n'] == 1, await text(pg, '#pro-why'))
        await pg.click('#btn-pro-later'); await pg.wait_for_timeout(450)
        ok('"Not now" goes back to the report, still closed', (await kind(pg)) == 'report' and await has(pg, '#btn-jk.pro'))
        await close_all(pg)
        # the tips run out: the sheet says why
        await pg.evaluate('(function () { var t = JSON.parse(localStorage.getItem("goldenchess.proHints")); t.n = 3; t.shown = {}; localStorage.setItem("goldenchess.proHints", JSON.stringify(t)); })()')
        await pg.wait_for_timeout(400); await pg.reload(); await pg.wait_for_timeout(700)
        await tour(pg, 2); await pg.wait_for_timeout(400)
        await pg.click('#btn-menu'); await pg.wait_for_timeout(250)
        ok('no hints left: the menu says so', (await text(pg, '.menu-list button.hint')) == 'Hint · 0/3')
        await pg.click('.menu-list button.hint'); await pg.wait_for_timeout(450)
        ok('the next ask opens the sheet with the reason', (await kind(pg)) == 'pro' and 'Pro has no limit' in (await text(pg, '#pro-why')) and (await store(pg, 'proHints'))['n'] == 3, await text(pg, '#pro-why'))
        await pg.click('#btn-pro-later'); await pg.wait_for_timeout(300)
        ok('the game goes on without it', (await kind(pg)) is None and await pg.evaluate('__gc.game.status') == 'playing')

        # the Road: a locked season opens on stars, or with Pro
        await tour(pg, 5)
        ok('free: seasons 2 to 4 are locked, each with a way in', await pg.evaluate('document.querySelectorAll(".cm-banner.locked").length') == 3 and await pg.evaluate('document.querySelectorAll(".cm-banner.locked .sn-pro").length') == 3
           and await pg.evaluate('document.querySelectorAll(".cm-banner.locked .sn-need").length') == 3)
        ok('the banner holds both lines', await pg.evaluate('(function () { var b = document.getElementById("season-2"), p = b.querySelector(".sn-pro"), r = b.getBoundingClientRect(), q = p.getBoundingClientRect(); return q.bottom <= r.bottom + 1 && q.left >= r.left && q.right <= r.right + 1 && r.width <= innerWidth; })()'))
        await pg.evaluate('document.getElementById("season-pro-2").click()'); await pg.wait_for_timeout(400)
        ok('the way in is the sheet', (await kind(pg)) == 'pro' and 'all four seasons' in (await text(pg, '#pro-why')), await text(pg, '#pro-why'))
        await close_all(pg)

        # the Joker under lock
        await tour(pg, 6)
        ok('free: the Joker is locked, with the two ways to him', await has(pg, '#bot-golden.locked .bt-lock') and 'Earn 24 stars' in (await text(pg, '#bot-locked')) and 'You have 3' in (await text(pg, '#bot-locked')), await text(pg, '#bot-locked'))
        ok('only the Joker', await pg.evaluate('document.querySelectorAll(".bot-tile.locked").length') == 1)
        before = await pg.evaluate('__gc.game ? __gc.game.records.length + ":" + __gc.game.cfg.bot : ""')
        play = await pg.evaluate('(function () { var b = Array.from(document.querySelectorAll("#view-bots .start-btn, .bots-cta .start-btn, .start-btn")).filter(function (x) { return x.offsetWidth > 0; }); return b.length ? b[b.length - 1].textContent.trim() : null; })()')
        ok('the button says what it does', play == 'Unlock the Joker with Pro', play)
        await pg.evaluate('(function () { var b = Array.from(document.querySelectorAll(".start-btn")).filter(function (x) { return x.offsetWidth > 0; }); b[b.length - 1].click(); })()'); await pg.wait_for_timeout(450)
        ok('and opens the sheet, no game starts', (await kind(pg)) == 'pro' and 'the Joker' in (await text(pg, '#pro-why')) and await pg.evaluate('__gc.curView') == 'bots', [await kind(pg), await pg.evaluate('__gc.curView')])
        await close_all(pg)
        # the last season open on stars: the Joker is free to play
        await pg.evaluate('(function () { var c = {}; for (var i = 1; i <= 8; i++) c[i] = 7; __gc.prog.career = c; __gc.go("play"); __gc.go("bots"); })()'); await pg.wait_for_timeout(300)
        ok('24 stars open him without Pro', not await has(pg, '#bot-golden.locked') and not await has(pg, '#bot-locked'))

        # the quests
        await tour(pg, 7); await pg.wait_for_timeout(400)
        ok('free: three quests and the Pro quest shown locked', await pg.evaluate('document.querySelectorAll(".veil .quest:not(.locked)").length') == 3 and await has(pg, 'button#quest-pro.locked') and '+120' in (await text(pg, '#quest-pro')), await text(pg, '#quest-pro'))
        await pg.click('#quest-pro'); await pg.wait_for_timeout(400)
        ok('a tap opens the sheet', (await kind(pg)) == 'pro')
        await close_all(pg)

        # the looks
        await tour(pg, 8)
        ok('free: the five Pro looks are shown, locked', await pg.evaluate('document.querySelectorAll("#pro-looks .pro-look.locked").length') == 5 and 'Comes with Pro' in (await text(pg, '#pro-looks .pro-look')))
        ok('free: the earned looks are locked by level as before', await has(pg, '.reward-list:not(.pro-looks) .reward-row.locked') and await has(pg, '.reward-list:not(.pro-looks) .reward-row:not(.locked)'))
        await pg.click('#pro-looks .pro-look:nth-child(4) .rw-use'); await pg.wait_for_timeout(400)
        ok('a tap opens the sheet, the board stays', (await kind(pg)) == 'pro' and 'comes with Pro' in (await text(pg, '#pro-why')) and await pg.evaluate('document.getElementById("shell").dataset.board') == 'slate', await text(pg, '#pro-why'))
        await close_all(pg)

        # the streak without Pro: five days away end it, as before
        await pg.evaluate('(function () { var t = new Date(), d = function (k) { var x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + k, 12); return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); };'
                          'localStorage.setItem("goldenchess.days", JSON.stringify([d(-9), d(-8), d(-7), d(-6)])); localStorage.removeItem("goldenchess.proFz"); })()')
        await pg.wait_for_timeout(400); await pg.reload(); await pg.wait_for_timeout(700)
        ok('free: no freeze is used', (await store(pg, 'proFz')) is None)
        await pg.click('#proto-pill'); await pg.wait_for_timeout(300)
        await pg.evaluate('Array.from(document.querySelectorAll(".proto-row")).find(function (b) { return /The streak sheet/.test(b.textContent); }).click()'); await pg.wait_for_timeout(600)
        ok('free: the streak is gone', (await kind(pg)) == 'streak' and (await text(pg, '.streak-big b')) == '0' and not await has(pg, '#streak-frozen'), await text(pg, '.streak-big b'))
        await close_all(pg)
        # the same days with Pro, from the start of the page
        await pg.evaluate('localStorage.setItem("goldenchess.pro", JSON.stringify({ on: true, plan: "month", since: Date.now(), until: Date.now() + 864e5, trial: false, founder: false }))')
        await pg.wait_for_timeout(400); await pg.reload(); await pg.wait_for_timeout(800)
        fz = await store(pg, 'proFz')
        ok('Pro: the freeze is used when the page opens', fz and fz['n'] == 1 and len(fz['days']) == 5, fz)

        # a founder: the mark with its star, Pro for life
        await pg.evaluate('localStorage.setItem("goldenchess.pro", JSON.stringify({ on: true, plan: "founder", since: Date.now(), until: null, trial: false, founder: true }))')
        await pg.wait_for_timeout(400); await pg.reload(); await pg.wait_for_timeout(700)
        await tour(pg, 11)
        ok('a founder: for life, the mark of a founder', 'Founder, for life' in (await text(pg, '#pro-entry')) and 'until' not in (await text(pg, '#pro-entry')), await text(pg, '#pro-entry'))
        await tour(pg, 2); await pg.wait_for_timeout(300)
        ok('the founder mark in a game', await has(pg, '.pname .pro-mark.founder'))
        # turning Pro off from its sheet
        await tour(pg, 11); await pg.click('#pro-entry'); await pg.wait_for_timeout(350)
        await pg.click('#btn-pro-off'); await pg.wait_for_timeout(400)
        ok('Pro can be switched off again', not await pg.evaluate(PRO_ON) and not await has(pg, '#pro-entry.on'))
        await pg.context.close()

        # ---- a desktop: the hint next to the board
        pg = await open_page(PROTO, 1280, 800)
        await tour(pg, 2); await pg.wait_for_timeout(400)
        ok('a desktop: the hint is among the side buttons', (await text(pg, '#side-actions .sbtn.hint')) == 'Hint · 3/3')
        await pg.click('#side-actions .sbtn.hint'); await pg.wait_for_timeout(1300)
        ok('and takes a hint', (await store(pg, 'proHints'))['n'] == 1 and (await text(pg, '#side-actions .sbtn.hint')) == 'Hint · 2/3', await text(pg, '#side-actions .sbtn.hint'))
        await pg.context.close()

        # ================================================================ part 2: the release configuration
        forged = {'pro': {'on': True, 'plan': 'founder', 'since': 0, 'until': None, 'trial': False, 'founder': True}, 'proFz': {'month': '2026-11', 'n': 0, 'days': []},
                  'settings': {'lang': 'en', 'board': 'slate'}}
        for nm, st0 in [('a new player', None), ('a forged Pro state', forged)]:
            pg = await open_page(PLAIN, 390, 844, 'en', st0)
            ok('release, %s: not a prototype' % nm, await pg.evaluate('window.GC_PROTO === undefined') and not await has(pg, '#proto-pill'))
            await pg.evaluate('__gc.go("profile")'); await pg.wait_for_timeout(300)
            ok('release, %s: nothing about Pro on the Profile' % nm, not await has(pg, '#pro-entry') and not await has(pg, '.pro-mark') and not await has(pg, '.prof-name.pro'))
            await pg.click('#status-card'); await pg.wait_for_timeout(350)
            ok('release, %s: three quests, no Pro quest' % nm, await pg.evaluate('document.querySelectorAll(".veil .quest").length') == 3 and not await has(pg, '#quest-pro') and not await has(pg, '.quest.pro'))
            await pg.click('#btn-collection'); await pg.wait_for_timeout(350)
            ok('release, %s: no Pro looks, the others locked by level' % nm, not await has(pg, '#pro-looks') and not await has(pg, '.pro-look') and await has(pg, '.reward-row.locked'))
            await close_all(pg)
            await pg.evaluate('__gc.go("bots")'); await pg.wait_for_timeout(300)
            road = await pg.evaluate('({ locked: document.querySelectorAll(".cm-banner.locked").length, pro: document.querySelectorAll(".sn-pro").length })')
            ok('release, %s: the Road opens on stars only' % nm, road['locked'] == 3 and road['pro'] == 0, road)
            await pg.evaluate('(function () { var t = Array.from(document.querySelectorAll("#view-bots button")).find(function (b) { return /All bots/i.test(b.textContent); }); if (t) t.click(); })()'); await pg.wait_for_timeout(300)
            ok('release, %s: the Joker is open to everybody' % nm, await has(pg, '#bot-golden') and not await has(pg, '.bot-tile.locked') and not await has(pg, '#bot-locked'), await has(pg, '#bot-golden'))
            await pg.evaluate('__gc.startGame({ mode: "bot", level: 8, bot: "golden", color: "w", tc: "none" })'); await pg.wait_for_timeout(400)
            ok('release, %s: a game against the Joker starts' % nm, await pg.evaluate('__gc.game.cfg.mode === "bot" && __gc.game.status === "playing"'))
            await pg.click('#btn-menu'); await pg.wait_for_timeout(250)
            ok('release, %s: no hint in the menu' % nm, not await has(pg, '.menu-list button.hint') and await pg.evaluate('document.querySelectorAll(".menu-list button").length') >= 3)
            await close_all(pg)
            ok('release, %s: no mark next to the name' % nm, not await has(pg, '.pname .pro-mark'))
            # a finished game: the XP as it was, nothing about Pro
            await pg.evaluate('(function () { __gc.startGame({ mode: "bot", level: 2, bot: "mila", color: "w", tc: "none" }); __gc.cancelBot(); var g = __gc.game; ["g1f3", "e7e5", "f1b5*", "g8f6"].forEach(function (u) { var m = g.pos.moveFromUci(u); if (m) g.play(m, performance.now()); }); g.end("1-0", "resign", performance.now()); __gc.gameOver(); })()')
            await pg.wait_for_timeout(1300)
            gp = await pg.evaluate('(function () { var g = __gc.game.prog; return g ? { xp: g.xp, bonus: g.proBonus || 0, would: g.proWould || 0, pro: g.lines.some(function (l) { return l.k === "pro"; }) } : null; })()')
            ok('release, %s: the XP has no bonus and no "with Pro" line' % nm, gp and gp['xp'] > 0 and not gp['bonus'] and not gp['would'] and not gp['pro'] and not await has(pg, '#op-pro'), gp)
            ok('release, %s: the result card is there' % nm, (await kind(pg)) == 'over')
            await pg.context.close()

        # the pages that go out carry no prototype switch
        for f in ['dist/web/index.html', 'dist/golden-chess.html', 'dist/preview.html', 'dist/mock/index.html']:
            src = open(ROOT + '/' + f, encoding='utf-8').read()
            ok('%s has no prototype switch' % f, 'window.GC_PROTO = true' not in src and 'GC_PROTO=true' not in src)
        ok('the prototype page has it', 'window.GC_PROTO = true' in open(ROOT + '/dist/proto.html', encoding='utf-8').read())

        await br.close()

    ok('no page errors', not errs, errs[:5])
    bad = [n for n, c in results if not c]
    print('\npro_e2e: %d passed, %d failed' % (len(results) - len(bad), len(bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
