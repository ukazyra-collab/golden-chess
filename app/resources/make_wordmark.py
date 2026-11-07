# The Joker Chess wordmark: "Joker Chess" in Lilita One (SIL Open Font License), the letters of Joker in gold and
# tipping a little, the o made of the Joker piece itself (the same piece as the icon, brand.py) (its head is the letter, its plinth stands below the line),
# Chess in bone. The letters are outlines, so the mark looks the same everywhere without loading a font.
# Writes app/resources/wordmark.svg; build.js puts it in the page (the header, the side rail, the launch intro).
# Run: python3 app/resources/make_wordmark.py [path to lilita-one-latin-400-normal.woff2]
import os, re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import brand

FONT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2'
GOLD, BONE = brand.GOLD, '#f4efe4'
TRACK = 7          # extra space between the letters of Joker (per 100 units = 1 em)
SLOT = 1.3         # the o's width, in o advances: room for the hat
WORD_GAP = 40      # between Joker and Chess
# each letter of Joker tips and hops a little (degrees, units up/down)
BOUNCE = {'J': (-6, 0), 'k': (4, -3), 'e': (-4, 1), 'r': (5, -4)}

font = TTFont(FONT)
UPM = font['head'].unitsPerEm
K = 100 / UPM
gs = font.getGlyphSet()
cmap = font.getBestCmap()
XH = font['OS/2'].sxHeight * K


def adv(ch):
    return font['hmtx'][cmap[ord(ch)]][0] * K


def glyph(ch, x, y=0):
    pen = SVGPathPen(gs)
    gs[cmap[ord(ch)]].draw(TransformPen(pen, (K, 0, 0, -K, x, y)))
    return pen.getCommands()


def wordmark():
    x = 0.0
    parts = []
    # J
    r, dy = BOUNCE['J']
    parts.append(f'<path transform="rotate({r} {x + 25:.1f} -30) translate(0 {dy})" d="{glyph("J", x)}"/>')
    x += adv('J') + TRACK
    # the o: the piece, its head as tall as the x-height, standing on the line
    slot = adv('o') * SLOT
    cx = x + slot / 2
    k = (XH + 1) / 43
    tx, ty = cx - 50 * k, -81 * k
    base_y = (99 - 81) * k
    o = (f'<g class="wm-o" style="transform-origin: {cx:.1f}px {base_y:.1f}px">'
         f'<g transform="translate({tx:.2f} {ty:.2f}) scale({k:.4f})">{brand.piece("wm")}</g></g>')
    x += slot + TRACK
    for ch in 'ker':
        r, dy = BOUNCE[ch]
        parts.append(f'<path transform="rotate({r} {x + 25:.1f} -30) translate(0 {dy})" d="{glyph(ch, x)}"/>')
        x += adv(ch) + (TRACK if ch != 'r' else 0)
    x += WORD_GAP
    chess = ''
    for ch in 'Chess':
        chess += glyph(ch, x)
        x += adv(ch)
    top, bot = -112, 28
    return (f'<svg xmlns="http://www.w3.org/2000/svg" class="wm" viewBox="-6 {top} {x + 12:.1f} {bot - top}" role="img" aria-label="Joker Chess">'
            f'<g fill="{GOLD}">{"".join(parts)}</g>{o}<path fill="{BONE}" d="{chess}"/></svg>')


if __name__ == '__main__':
    out = os.path.join(HERE, 'wordmark.svg')
    svg = wordmark()
    open(out, 'w', encoding='utf-8').write(svg + '\n')
    print('wrote', out, len(svg), 'bytes')
