# Concept piece sets for Joker Chess, drawn in the brand's way of the Joker piece: chubby shapes, depth from the side
# (a lit rim on the left, the right edge in shade), the Joker's stacked plinth under every piece.
# Each piece: 'body' shapes (one silhouette, any overlap), 'accent' shapes (the collar, gold in one set), 'detail'
# marks drawn on top (eye, slit, lines). Units: 100 x 100, the base at y 90.
# Run: python3 tools/pieces/make_sets.py OUTDIR   -> OUTDIR/<set>/<wK..bP>.svg and OUTDIR/<set>.json
import json, os, re, sys

LIT_W, SHADE_W = 2.6, 6.0


def plinth(w, top=80, collar=None):
    cw = collar if collar else w - 12
    return [f'<rect x="{50 - w / 2}" y="{top}" width="{w}" height="10" rx="5"/>'], \
           [f'<rect x="{50 - cw / 2}" y="{top - 7}" width="{cw}" height="8.5" rx="4"/>']


def P_pawn():
    b, a = plinth(46, collar=34)
    body = ['<path d="M37 75 C39 66 42 61 43 57 L57 57 C58 61 61 66 63 75 Z"/>',
            '<ellipse cx="50" cy="57" rx="13.5" ry="4.6"/>',
            '<circle cx="50" cy="42" r="13.5"/>']
    return b + body, a, []


def P_rook():
    b, a = plinth(58, collar=46)
    body = ['<path d="M34 75 L35.5 44 L64.5 44 L66 75 Z"/>',
            '<rect x="26.5" y="34" width="47" height="13" rx="4.5"/>',
            '<rect x="26.5" y="19" width="11" height="19" rx="3.5"/>',
            '<rect x="44.5" y="19" width="11" height="19" rx="3.5"/>',
            '<rect x="62.5" y="19" width="11" height="19" rx="3.5"/>']
    return b + body, a, []


def P_bishop():
    b, a = plinth(52, collar=40)
    body = ['<path d="M40 75 L42 64 L58 64 L60 75 Z"/>',
            '<ellipse cx="50" cy="64" rx="15" ry="5"/>',
            '<path d="M50 21 C66 33 69 50 62 62 L38 62 C31 50 34 33 50 21 Z"/>',
            '<circle cx="50" cy="17" r="5.6"/>']
    detail = ['<path d="M56.5 33 L46.5 46" stroke-width="4" stroke-linecap="round" fill="none"/>']
    return b + body, a, detail


def P_queen():
    b, a = plinth(60, collar=48)
    tips = [(24, 28), (37, 20), (50, 15.5), (63, 20), (76, 28)]
    crown = ('M31 54 L24 28 L36 44 L37 20 L45.5 42 L50 15.5 L54.5 42 L63 20 L64 44 L76 28 L69 54 Z')
    body = ['<path d="M34 75 C37 66 38 60 33 53 L67 53 C62 60 63 66 66 75 Z"/>',
            f'<path d="{crown}" stroke-width="5" stroke-linejoin="round" data-noinf/>',
            '<ellipse cx="50" cy="54" rx="20" ry="5.2"/>'] + \
           [f'<circle cx="{x}" cy="{y}" r="5.4" data-noinf/>' for x, y in tips]
    return b + body, a, []


def P_king():
    b, a = plinth(60, collar=48)
    body = ['<path d="M34 75 C36 65 36 58 31 49 L69 49 C64 58 64 65 66 75 Z"/>',
            '<path d="M31 50 C29 30 71 30 69 50 Z"/>',
            '<ellipse cx="50" cy="50" rx="20" ry="5"/>',
            '<rect x="45" y="9" width="10" height="26" rx="4"/>',
            '<rect x="38" y="15" width="24" height="9.5" rx="4"/>']
    return b + body, a, []


def P_knight(eye='plain'):
    b, a = plinth(58, collar=46)
    head = ('M33 75 C33 64 38 58 45 54 C39 56 31 60 25 58 C18 56 15 50 18 45 C23 38 30 31 35 26 '
            'L36 14 C39 15 42 18 44 21 C47 18 50 17 52 18 C63 20 72 30 74 44 C76 56 72 66 68 75 Z')
    body = [f'<path d="{head}" stroke-width="2" stroke-linejoin="round"/>']
    detail = ['<circle cx="23.5" cy="49.5" r="2.1"/>',  # nostril
              '<path d="M54 24 C62 30 66 40 66 52" stroke-width="3" stroke-linecap="round" fill="none"/>']  # mane line
    if eye == 'joker':  # the Joker's eye: white with a pupil looking forward and a spark
        detail += ['<ellipse cx="41" cy="35" rx="7" ry="7.6" data-c="eyew"/>',
                   '<circle cx="39.6" cy="36" r="4.4" data-c="pupil"/>',
                   '<circle cx="38.2" cy="34.2" r="1.5" data-c="eyew"/>',
                   '<path d="M33 26 C37 22.5 44 22.5 48 25.5" stroke-width="3" stroke-linecap="round" fill="none"/>']
    else:
        detail += ['<ellipse cx="40" cy="34" rx="2.6" ry="3.2"/>']
    return b + body, a, detail


PIECES = {'P': P_pawn, 'R': P_rook, 'B': P_bishop, 'Q': P_queen, 'K': P_king, 'N': P_knight}

# colours per side: lit rim, body, shade, outline, detail
WHITE = dict(lit='#ffffff', body='#f7f1e3', shade='#d8cbb0', out='#2a2e2c', det='#2a2e2c', eyew='#ffffff')
BLACK = dict(lit='#5f6669', body='#34393c', shade='#212527', out='#141716', det='#cfd6d2', eyew='#ffffff')
GOLD = dict(lit='#ffd98a', body='#f0b941', shade='#c98a1e')


INFLATE = [0]


def paint(shapes, color, dx=0, extra=''):
    out = []
    for s in shapes:
        s = re.sub(r'\s(fill|stroke)="[^"]*"', '', s)
        noinf = ' data-noinf' in s
        s = s.replace(' data-noinf', '')
        if INFLATE[0] and not extra and not noinf:
            s = re.sub(r'\sstroke-(width|linejoin)="[^"]*"', '', s)
            s = s.replace(' ', f' stroke-width="{INFLATE[0]}" stroke-linejoin="round" ', 1)
        tag = re.match(r'<(\w+)', s).group(1)
        has_stroke = 'stroke-width' in s
        attrs = f' fill="{color}"' + (f' stroke="{color}"' if has_stroke else '') + extra
        if dx:
            attrs += f' transform="translate({dx} 0)"'
        out.append(s.replace(f'<{tag}', f'<{tag}{attrs}', 1))
    return ''.join(out)


def volume(uid, shapes, c):
    # the brand trick: lit everywhere, the shade moved right (the lit rim stays on the left), the body cut to the
    # silhouette moved right and drawn moved left (the right edge stays in shade). Masks, not clip paths: a clip path
    # drops strokes, and the inflated shapes are partly stroke
    return (f'<defs><mask id="s{uid}">{paint(shapes, "#fff")}</mask>'
            f'<mask id="l{uid}">{paint(shapes, "#fff", LIT_W)}</mask></defs>'
            f'<g mask="url(#s{uid})"><rect x="-10" y="-10" width="120" height="120" fill="{c["lit"]}"/>'
            f'{paint(shapes, c["shade"], LIT_W)}'
            f'<g mask="url(#l{uid})">{paint(shapes, c["body"], -SHADE_W)}</g></g>')


def glossy(uid, shapes, c):
    # a toy's plastic: a soft gradient from the top left, a shine on the top
    return (f'<defs><radialGradient id="g{uid}" cx="34%" cy="26%" r="80%">'
            f'<stop offset="0" stop-color="{c["lit"]}"/><stop offset=".45" stop-color="{c["body"]}"/>'
            f'<stop offset="1" stop-color="{c["shade"]}"/></radialGradient>'
            f'<mask id="s{uid}">{paint(shapes, "#fff")}</mask>'
            f'<mask id="m{uid}"><g>{paint(shapes, "#fff")}</g><g transform="translate(2.2 3.2)">{paint(shapes, "#000")}</g></mask></defs>'
            f'<g mask="url(#s{uid})"><rect x="-10" y="-10" width="120" height="120" fill="url(#g{uid})"/>'
            f'<rect x="-10" y="-10" width="120" height="120" fill="#fff" opacity="{c.get("gloss", .55)}" mask="url(#m{uid})"/></g>')


def outline(shapes, c, w):
    out = ''
    for s in shapes:
        own = re.search(r'stroke-width="([\d.]+)"', s)
        ww = (w - INFLATE[0] if ' data-noinf' in s else w) + (float(own.group(1)) if own else 0)
        bare = re.sub(r'\sstroke-(width|linejoin|linecap)="[^"]*"', '', s).replace(' data-noinf', '')
        out += paint([bare], c['out'], extra=f' stroke="{c["out"]}" stroke-width="{ww}" stroke-linejoin="round"')
    return out


def details(det, c):
    out = []
    for s in det:
        col = c['eyew'] if 'data-c="eyew"' in s else ('#1a1d1c' if 'data-c="pupil"' in s else c['det'])
        s = s.replace(' data-c="eyew"', '').replace(' data-c="pupil"', '')
        if 'fill="none"' in s:
            out.append(s.replace('fill="none"', f'fill="none" stroke="{col}"'))
        else:
            tag = re.match(r'<(\w+)', s).group(1)
            out.append(s.replace(f'<{tag}', f'<{tag} fill="{col}"', 1))
    return ''.join(out)


def piece_svg(side, kind, style, uid):
    c = WHITE if side == 'w' else BLACK
    fn = PIECES[kind]
    body, accent, det = fn('joker') if (kind == 'N' and style.get('jokerEye')) else fn()
    allshapes = body + accent
    INFLATE[0] = style.get('inflate', 0)
    ow = style.get('outline', 7) + INFLATE[0]
    parts = [outline(allshapes, c, ow)] if ow else []
    fill = glossy if style.get('glossy') else volume
    if style.get('gold'):
        parts.append(fill(uid + 'b', body, c))
        parts.append(fill(uid + 'a', accent, GOLD))
    else:
        parts.append(fill(uid + 'b', allshapes, c))
    if style.get('shine'):
        parts.append(f'<ellipse cx="41" cy="{style["shine"].get(kind, 30)}" rx="5" ry="3" fill="#fff" opacity=".55" transform="rotate(-25 41 {style["shine"].get(kind, 30)})"/>')
    if det:
        parts.append(details(det, c))
    sx, sy = style.get('scale', (1.08, 1.08))
    g = f'<g transform="translate(50 93) scale({sx} {sy}) translate(-50 -91)">{"".join(parts)}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{g}</svg>'


SETS = {
    'classic': dict(outline=6.5),
    'collar': dict(outline=6.5, gold=True),
    'puffy': dict(outline=6, inflate=4.5, gold=True, jokerEye=True, scale=(1.1, 1.0)),
    'glossy': dict(outline=4.5, inflate=4, glossy=True, scale=(1.1, 1.04)),
    'wink': dict(outline=6.5, gold=True, jokerEye=True),
}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out'
    for name, st in SETS.items():
        d = os.path.join(out, name); os.makedirs(d, exist_ok=True); js = {}
        for side in 'wb':
            for k in 'KQRBNP':
                svg = piece_svg(side, k, st, f'{name[:2]}{side}{k}')
                js[side + k] = svg
                open(os.path.join(d, side + k + '.svg'), 'w').write(svg)
        json.dump(js, open(os.path.join(out, name + '.json'), 'w'))
    print('ok')
