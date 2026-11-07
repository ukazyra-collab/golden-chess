# The launch scene: the gold Joker piece on a chessboard in perspective, a knight and a rook dimmed behind it.
# Writes app/resources/scene.svg (a 390x844 portrait design that also covers wider canvases: the board and the
# background run past the box). Used by the website's launch intro (build.js inlines it) and by the native
# splash images (make_icons.py). Run: python3 app/resources/make_scene.py
import base64, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MARK = open(os.path.join(HERE, 'mark.svg'), encoding='utf-8').read()
PIECES = json.load(open(os.path.join(ROOT, 'build/pieces.json')))

BG, LIGHT, DARK = '#232826', '#3a4542', '#2b3331'
W, H = 390, 844
# the scene sits high, like chess.com's: the wordmark above it (the intro's .intro-word, clear of iOS banners at the top),
# the board running down off the bottom; DY lifts board, pieces and Joker together
DY = -150


def piece(name, fill, line, hi):
    # one of the app's own pieces (cburnett), recoloured flat and dim
    svg = PIECES[name]
    inner = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    inner = inner.replace('#000', line).replace('#ececec', hi)
    inner = re.sub(r'fill="' + re.escape(line) + '"', 'fill="' + fill + '"', inner)
    return inner


def board():
    # 8 x 8 squares seen from a low camera: rows get taller towards the viewer, the far edge narrows
    far_y, near_y = 478, 1120
    far_w, near_w = 300, 1500
    rows = []
    for i in range(9):
        t = (i / 8) ** 1.55
        y = far_y + (near_y - far_y) * t
        w = far_w + (near_w - far_w) * (y - far_y) / (near_y - far_y)
        rows.append((y, w))
    out = []
    for r in range(8):
        y0, w0 = rows[r]; y1, w1 = rows[r + 1]
        for c in range(8):
            x00 = W / 2 - w0 / 2 + w0 * c / 8; x01 = x00 + w0 / 8
            x10 = W / 2 - w1 / 2 + w1 * c / 8; x11 = x10 + w1 / 8
            fill = LIGHT if (r + c) % 2 == 0 else DARK
            out.append(f'<polygon points="{x00:.1f},{y0:.1f} {x01:.1f},{y0:.1f} {x11:.1f},{y1:.1f} {x10:.1f},{y1:.1f}" fill="{fill}"/>')
    return ''.join(out)


def scene_inner():
    mark = re.search(r'<svg[^>]*>(.*)</svg>', MARK, re.S).group(1)
    mark = re.sub(r'\s+', ' ', mark).strip().replace('fill="#f4efe4"', 'fill="url(#jg)"').replace('stroke="#f4efe4"', 'stroke="url(#jg)"')
    knight = piece('bN', '#3b4340', '#1d2220', '#4a5350')
    rook = piece('bR', '#3b4340', '#1d2220', '#4a5350')
    return (
        '<defs>'
        '<linearGradient id="jg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#e3a52a"/></linearGradient>'
        f'<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BG}" stop-opacity="1"/><stop offset="1" stop-color="{BG}" stop-opacity="0"/></linearGradient>'
        f'<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BG}" stop-opacity="0"/><stop offset="1" stop-color="{BG}" stop-opacity=".85"/></linearGradient>'
        '<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f0b941" stop-opacity=".26"/><stop offset="1" stop-color="#f0b941" stop-opacity="0"/></radialGradient>'
        '<filter id="sh" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>'
        '</defs>'
        f'<rect x="-900" y="-600" width="2190" height="2100" fill="{BG}"/>'
        f'<g transform="translate(0 {DY})">'
        f'<!--board--><g class="sc-board">{board()}'
        '<rect x="-900" y="470" width="2190" height="190" fill="url(#haze)"/>'
        '<rect x="-900" y="860" width="2190" height="400" fill="url(#foot)"/></g><!--/board-->'
        # the dim pieces behind: a knight on the left, a rook on the right
        '<!--dim--><g class="sc-dim">'
        '<ellipse cx="88" cy="604" rx="62" ry="9" fill="rgba(0,0,0,.45)" filter="url(#sh)"/>'
        '<ellipse cx="312" cy="604" rx="56" ry="9" fill="rgba(0,0,0,.45)" filter="url(#sh)"/>'
        f'<g transform="translate(14 472) scale(3.3)">{knight}</g>'
        f'<g transform="translate(243 479) scale(3.1)">{rook}</g>'
        '</g><!--/dim-->'
        # the Joker in front
        '<g class="sc-joker">'
        '<ellipse cx="195" cy="662" rx="128" ry="17" fill="rgba(0,0,0,.55)" filter="url(#sh)"/>'
        '<rect x="-25" y="330" width="440" height="440" fill="url(#glow)"/>'
        f'<g transform="translate(80 432) scale(2.3)">{mark}</g>'
        '</g></g>'
    )


def main():
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">{scene_inner()}</svg>'
    out = os.path.join(HERE, 'scene.svg')
    open(out, 'w', encoding='utf-8').write(svg)
    print('wrote', os.path.relpath(out, ROOT), len(svg), 'bytes')


if __name__ == '__main__':
    main()
