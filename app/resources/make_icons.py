# Draws the app icons and launch screens for iOS, Android and the website from one design: a golden knight
# (the site's own piece set) with the golden-move star, on a 2x2 corner of a chessboard in the site's charcoal tones.
# Run from anywhere: python3 app/resources/make_icons.py   (needs Playwright with Chromium, and Pillow)
import asyncio, io, os
from PIL import Image
from playwright.async_api import async_playwright

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(APP)
RES = os.path.join(APP, 'android/app/src/main/res')
IOS = os.path.join(APP, 'ios/App/App/Assets.xcassets')

GROUND, DARK, LIGHT = '#2a2f2d', '#3a423f', '#4a5350'


def star(cx, cy, r):
    # the site's four-point star: each quarter is one cubic curve
    a, b = 0.1 * r, 0.4 * r
    return (f'M{cx:.2f},{cy - r:.2f} C{cx + a:.2f},{cy - b:.2f} {cx + b:.2f},{cy - a:.2f} {cx + r:.2f},{cy:.2f} '
            f'C{cx + b:.2f},{cy + a:.2f} {cx + a:.2f},{cy + b:.2f} {cx:.2f},{cy + r:.2f} '
            f'C{cx - a:.2f},{cy + b:.2f} {cx - b:.2f},{cy + a:.2f} {cx - r:.2f},{cy:.2f} '
            f'C{cx - b:.2f},{cy - a:.2f} {cx - a:.2f},{cy - b:.2f} {cx:.2f},{cy - r:.2f} Z')


def defs(r):
    return ('<defs>'
            '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#ffe6a3"/><stop offset=".55" stop-color="#f2bb45"/><stop offset="1" stop-color="#cf9128"/></linearGradient>'
            '<radialGradient id="glow" cx=".5" cy=".5" r=".5">'
            '<stop offset="0" stop-color="#f0b941" stop-opacity=".30"/><stop offset=".6" stop-color="#f0b941" stop-opacity=".08"/>'
            '<stop offset="1" stop-color="#f0b941" stop-opacity="0"/></radialGradient>'
            f'<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="{0.047 * r:.2f}" '
            f'stdDeviation="{0.06 * r:.2f}" flood-color="#000" flood-opacity=".35"/></filter>'
            '</defs>')


def board(size):
    h = size / 2
    return (f'<rect width="{size}" height="{size}" fill="{DARK}"/><rect width="{h}" height="{h}" fill="{LIGHT}"/>'
            f'<rect x="{h}" y="{h}" width="{h}" height="{h}" fill="{LIGHT}"/>')


KNIGHT = ('<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="{f}"/>'
          '<path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 '
          '6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="{f}"/>'
          '<path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="{s}" stroke="{s}"/>')
ART_DEFS = ('<defs><linearGradient id="kgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe6a3"/>'
            '<stop offset=".5" stop-color="#f0b941"/><stop offset="1" stop-color="#b98321"/></linearGradient>'
            '<filter id="ksh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0.9" stdDeviation="1.1" '
            'flood-color="#000" flood-opacity=".4"/></filter></defs>')


def art(mono=False):
    # the knight and the star in 1024 design units, centred for the round masks of Android icons too
    if mono:
        k = KNIGHT.format(f='#fff', s='#fff')
        return (f'<g transform="translate(63 80) scale(19)" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round">{k}</g>'
                f'<path d="{star(765, 258, 92)}" fill="#fff"/>')
    k = KNIGHT.format(f='url(#kgold)', s='#2a1d05')
    return (f'<circle cx="512" cy="540" r="430" fill="url(#glow)"/>'
            f'<g transform="translate(63 80) scale(19)" fill="none" fill-rule="evenodd" stroke="#2a1d05" stroke-width="1.5" '
            f'stroke-linecap="round" stroke-linejoin="round" filter="url(#ksh)">{k}</g>'
            f'<path d="{star(765, 258, 92)}" fill="#fff4d6" filter="url(#sh)"/>')


def icon_svg(px, shape='square'):
    # 1024 design units; shape: square (iOS, web: the system rounds it), rounded or round (old Android)
    clip = ''
    if shape == 'round':
        clip = '<clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath>'
    elif shape == 'rounded':
        clip = '<clipPath id="c"><rect width="1024" height="1024" rx="225"/></clipPath>'
    body = board(1024) + art()
    if clip:
        body = f'<g clip-path="url(#c)">{body}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="{px}" height="{px}">{defs(92)}{ART_DEFS}{clip and "<defs>" + clip + "</defs>"}{body}</svg>'


def foreground_svg(px):
    # Android adaptive icon, front layer: 108dp, of which the middle 72dp show (66dp on round masks)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="{px}" height="{px}">{defs(92)}{ART_DEFS}'
            f'<g transform="translate(18 18) scale({72 / 1024})">{art()}</g></svg>')


def monochrome_svg(px):
    # Android 13 themed icons: only the shape counts
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="{px}" height="{px}">'
            f'<g transform="translate(18 18) scale({72 / 1024})">{art(mono=True)}</g></svg>')


def splash_svg(w, h, size):
    # the knight and the star (no board) in the middle of the launch screen; size = width of the 1024 design
    k = size / 1024
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{defs(92)}{ART_DEFS}'
            f'<rect width="{w}" height="{h}" fill="{GROUND}"/><g transform="translate({w / 2 - size / 2:.2f} {h / 2 - size / 2:.2f}) scale({k:.5f})">{art()}</g></svg>')


async def render(page, svg, w, h, path, alpha=True):
    await page.set_viewport_size({'width': w, 'height': h})
    await page.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
    png = await page.screenshot(omit_background=alpha, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
    im = Image.open(io.BytesIO(png))
    im = im.convert('RGBA') if alpha else im.convert('RGB')   # the App Store refuses icons with an alpha channel
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    print('wrote', os.path.relpath(path, ROOT), im.size, im.mode)


async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        page = await br.new_page(device_scale_factor=1)
        # masters
        await render(page, icon_svg(1024), 1024, 1024, os.path.join(APP, 'resources/icon.png'), alpha=False)
        await render(page, splash_svg(2732, 2732, 620), 2732, 2732, os.path.join(APP, 'resources/splash.png'), alpha=False)
        # iOS
        await render(page, icon_svg(1024), 1024, 1024, os.path.join(IOS, 'AppIcon.appiconset/AppIcon-512@2x.png'), alpha=False)
        for n in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
            await render(page, splash_svg(2732, 2732, 620), 2732, 2732, os.path.join(IOS, 'Splash.imageset', n), alpha=False)
        # Android launcher icons
        for d, k in (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)):
            s, f = int(48 * k), int(108 * k)
            await render(page, icon_svg(s, 'rounded'), s, s, os.path.join(RES, f'mipmap-{d}/ic_launcher.png'))
            await render(page, icon_svg(s, 'round'), s, s, os.path.join(RES, f'mipmap-{d}/ic_launcher_round.png'))
            await render(page, foreground_svg(f), f, f, os.path.join(RES, f'mipmap-{d}/ic_launcher_foreground.png'))
            await render(page, monochrome_svg(f), f, f, os.path.join(RES, f'mipmap-{d}/ic_launcher_monochrome.png'))
        # Android fallback launch images (the Android 12 splash API draws the icon itself; these are only its backup)
        sizes = {'drawable': (480, 320)}
        for d, (w, h) in (('mdpi', (320, 480)), ('hdpi', (480, 800)), ('xhdpi', (720, 1280)), ('xxhdpi', (960, 1600)), ('xxxhdpi', (1280, 1920))):
            sizes[f'drawable-port-{d}'] = (w, h)
            sizes[f'drawable-land-{d}'] = (h, w)
        for folder, (w, h) in sizes.items():
            await render(page, splash_svg(w, h, round(0.42 * min(w, h))), w, h, os.path.join(RES, folder, 'splash.png'), alpha=False)
        # the website: the home-screen icon on iPhones
        await render(page, icon_svg(180), 180, 180, os.path.join(ROOT, 'apple-touch-icon.png'), alpha=False)
        await br.close()

asyncio.run(main())
