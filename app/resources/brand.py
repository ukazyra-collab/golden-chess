# The Joker Chess mark and icon, drawn once for everything (app icons, launch scene, the logo in the page, favicon,
# the o of the wordmark): the gold jester piece (mark.svg, its hat's side horns drawn in, a round hole in the head, so
# it is also the o of "Joker") on a 2x2 corner of the board in two greens (dark on a1, as on any board). Its depth comes
# from the side: a darker edge on the right, a lit rim on the left, a soft shadow under the plinth.
# Run: python3 app/resources/brand.py   (writes app/resources/icon.svg, the rounded tile build.js puts in the page, and
# app/resources/piece.svg, the piece alone)
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
GREEN_LIGHT, GREEN_DARK = '#4f776b', '#385a51'
GOLD, GOLD_SHADE, GOLD_LIT = '#f0b941', '#c98a1e', '#ffd98a'
SHADE_W, LIT_W = 6.5, 2.6   # the right edge in shade, the left rim lit (mark units, 100 = the mark's width)

HORNS_IN = 0.78        # the side horns drawn in towards the middle (the bells clear the letters around the o)
HOLE = (50, 59.5, 11.5)  # the hole in the head: the counter of the o

_MARK = open(os.path.join(HERE, 'mark.svg'), encoding='utf-8').read()
_SHAPES = re.search(r'<svg[^>]*>(.*)</svg>', _MARK, re.S).group(1).strip()


def _squeeze_x(d, f):
    i = [0]
    def rep(m):
        v = float(m.group(0)); r = (50 + (v - 50) * f) if i[0] % 2 == 0 else v; i[0] += 1
        return f'{r:.2f}'
    return re.sub(r'-?\d+\.?\d*', rep, d)


for _d in ('M34 30 C26 24 14 20 6 24 C14 26 20 30 26 36 Z', 'M66 30 C74 24 86 20 94 24 C86 26 80 30 74 36 Z'):
    _SHAPES = _SHAPES.replace(_d, _squeeze_x(_d, HORNS_IN))
_SHAPES = (_SHAPES.replace('cx="6" cy="24"', f'cx="{50 - 44 * HORNS_IN:.2f}" cy="24"')
           .replace('cx="94" cy="24"', f'cx="{50 + 44 * HORNS_IN:.2f}" cy="24"'))


def shapes(color, dx=0):
    s = re.sub(r'\s(fill|stroke)="[^"]*"', lambda m: ' ' + m.group(1) + '="' + color + '"', _SHAPES)
    if dx:  # moved sideways (each shape, so it can sit in a clipPath)
        s = re.sub(r'<(path|rect|circle|ellipse) ', lambda m: f'<{m.group(1)} transform="translate({dx} 0)" ', s)
    return s


def piece(uid, flat=None):
    # the jester in its own 100 x 100 units, shaded, with the hole in its head (flat: one colour, e.g. white for
    # themed icons)
    hole = (f'<mask id="jh{uid}"><rect x="-10" y="-10" width="120" height="120" fill="#fff"/>'
            f'<circle cx="{HOLE[0]}" cy="{HOLE[1]}" r="{HOLE[2]}" fill="#000"/></mask>')
    if flat:
        return f'<defs>{hole}</defs><g mask="url(#jh{uid})">{shapes(flat)}</g>'
    return (f'<defs>{hole}<clipPath id="js{uid}">{shapes("#000")}</clipPath><clipPath id="jl{uid}">{shapes("#000", LIT_W)}</clipPath></defs>'
            f'<g mask="url(#jh{uid})"><g clip-path="url(#js{uid})"><rect x="-10" y="-10" width="120" height="120" fill="{GOLD_LIT}"/>'
            f'<g transform="translate({LIT_W} 0)">{shapes(GOLD_SHADE)}</g>'
            f'<g clip-path="url(#jl{uid})"><g transform="translate({-SHADE_W} 0)">{shapes(GOLD)}</g></g></g></g>')


def board(x=0, y=0, size=100):
    h = size / 2
    return (f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{GREEN_LIGHT}"/>'
            f'<rect x="{x + h}" y="{y}" width="{h}" height="{h}" fill="{GREEN_DARK}"/>'
            f'<rect x="{x}" y="{y + h}" width="{h}" height="{h}" fill="{GREEN_DARK}"/>')


def figure(uid, scale=0.78, dy=1):
    # the piece and its shadow, centred in a 100 x 100 tile
    t = f'translate({50 - 50 * scale:.2f} {50 - 50 * scale + dy:.2f}) scale({scale})'
    return (f'<ellipse cx="50" cy="88.5" rx="25" ry="4.2" fill="#000" opacity=".35"/>'
            f'<g transform="{t}">{piece(uid)}</g>')


def tile(uid, rounded=True, scale=0.78):
    # the icon in 100 x 100 units; rounded: the corners cut like an app icon (the page's logo, the favicon)
    body = board() + figure(uid, scale)
    if rounded:
        return f'<defs><clipPath id="jt{uid}"><rect width="100" height="100" rx="22.5"/></clipPath></defs><g clip-path="url(#jt{uid})">{body}</g>'
    return body


if __name__ == '__main__':
    out = os.path.join(HERE, 'icon.svg')
    open(out, 'w', encoding='utf-8').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{tile("i")}</svg>\n')
    print('wrote', out)
    # the piece alone (the app's little Joker: the search, empty screens, the puzzle bar, a win)
    out = os.path.join(HERE, 'piece.svg')
    open(out, 'w', encoding='utf-8').write(f'<svg xmlns="http://www.w3.org/2000/svg" class="jpc" viewBox="0 0 100 100" aria-hidden="true">{piece("p")}</svg>\n')
    print('wrote', out)
