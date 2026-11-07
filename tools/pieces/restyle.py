# The cburnett pieces (build/pieces-cburnett.json), kept shape for shape, redrawn in the Joker's manner: warm ivory and charcoal
# instead of paper white and ink black, depth from the side like the Joker (a lit rim on the left, the right edge in
# shade), the lines drawn again on top so they stay crisp. The knight gets a full neck (the head no longer sits apart).
# Run: python3 tools/pieces/restyle.py build/pieces.json ivory3   (the set the app plays with; build.js reads it)
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(HERE, '..', '..', 'build', 'pieces-cburnett.json')))

# a knight with a full neck: the jaw line is gone (it cut the head off the neck), the front of the neck runs from the
# base straight up to the chin
KNIGHT_FILL = ('<path d="M22 10c10.5 1 16.5 8 16 29H13c0-4.5 1.5-8.5 3.5-11L24 18z" stroke="none" fill="BODY"/>'
               '<path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3z" stroke="none" fill="BODY"/>')
KNIGHT_LINE = ('<path d="M22 10c10.5 1 16.5 8 16 29H13c0-4.5 1.5-8.5 3.5-11.5"/>'
               '<path d="M16 27c-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/>')
EYE = '<path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="DOT" stroke="DOT"/>'
MANE = '<path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" fill="LINE2" stroke="none"/>'

VARIANTS = {
    # side: body, lit rim, shade, outline, inner light lines (black pieces)
    'ivory': dict(w=('#f8f3e6', '#ffffff', '#ddd0b4', '#1f2422'), b=('#2a2e31', '#3f4549', '#1b1e20', '#0d100f', '#808a86'), shade=2.3, lit=.9),
    # charcoal lifted off the dark squares: a lighter body, a brighter and wider lit edge
    # charcoal evened out: outline close to the body (thin parts no longer read blacker), quieter inner lines (the king
    # no longer greys), a soft lit edge
    'ivory3': dict(w=('#f8f3e6', '#ffffff', '#ddd0b4', '#1f2422'), b=('#2c3134', '#4b5357', '#1d2123', '#16191b', '#e9ebe7'), shade=2.3, lit=.9),
    'ivory2': dict(w=('#f8f3e6', '#ffffff', '#ddd0b4', '#1f2422'), b=('#373d41', '#6b7579', '#23272a', '#0d100f', '#87918d'), shade=2.3, lit=1.0, wlit=.9),
    'gold': dict(w=('#f8f3e6', '#ffffff', '#ddd0b4', '#1f2422'), b=('#2a2e31', '#3f4549', '#1b1e20', '#0d100f', '#e2a93a'), shade=2.3, lit=.9),
    'warm': dict(w=('#fbf1da', '#fffaf0', '#e6cf9f', '#2a2620'), b=('#25302c', '#3a4743', '#18201d', '#0c1110', '#7a8b84'), shade=2.3, lit=.9),
}


def knight(side):
    body = '#fff' if side == 'w' else '#000'
    g = KNIGHT_FILL.replace('BODY', body) + '<g fill="none">' + KNIGHT_LINE + '</g>'
    g += EYE.replace('DOT', '#000' if side == 'w' else '#ececec')
    if side == 'b':
        g += MANE.replace('LINE2', '#ececec')
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="none" fill-rule="evenodd" '
            'stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + g + '</g></svg>')


# the hat of the Joker in the logo (app/resources/mark.svg via brand.py): its horns, the middle point, the band, three bells
sys.path.insert(0, os.path.join(HERE, '..', '..', 'app', 'resources'))
import brand  # noqa: E402
_HAT_D = ('M37.52 30.00', 'M35 34 C45', 'M62.48 30.00', 'M29 35 C40')
HAT = [m for m in re.findall(r'<[^>]+>', brand._SHAPES) if any(d in m for d in _HAT_D) or re.search(r'cy="(24|3\.5)" r="3\.2"', m)]
HAT_T = 'translate(5.5 1.2) scale(.34)'


def hat_svg(fill, out, gold=False):
    shapes = [re.sub(r'\s(fill|stroke|stroke-width)="[^"]*"', '', h) for h in HAT]
    if not gold:
        return f'<g transform="{HAT_T}" fill="{fill}" stroke-width="{1.0 / .34:.2f}">' + ''.join(shapes) + '</g>'
    body = ''.join(shapes)
    sh = ''.join(re.sub(r'<(\w+) ', r'<\1 transform="translate(4 0)" ', x) for x in shapes)
    return (f'<g transform="{HAT_T}"><g fill="{out}" stroke="{out}" stroke-width="{2.6 / .34:.2f}" stroke-linejoin="round">{body}</g>'
            f'<g fill="#c98a1e">{body}</g><g fill="#f0b941" clip-path="url(#hc)">{body}</g></g>'
            f'<defs><clipPath id="hc">' + ''.join(re.sub(r'<(\w+) ', r'<\1 transform="translate(-5 0)" ', x) for x in shapes) + '</clipPath></defs>')


def no_cross(side):
    svg = SRC[side + 'K']
    svg = re.sub(r'<path d="M22.5 11.63V6(?:M20 8h5)?"[^>]*/>', '', svg)
    return re.sub(r'<path d="M20 8h5"[^>]*/>', '', svg)


def jester_king(side):
    # the cross off, the logo's hat on, in the piece's own colours (drawn before the body: the head sits over the band)
    hat = hat_svg('#fff' if side == 'w' else '#000', None)
    return no_cross(side).replace('stroke-linejoin="round">', 'stroke-linejoin="round">' + hat, 1)


def gold_band_king(side):
    # the king as it is, its three crown lines in gold
    svg = SRC[side + 'K']
    col = '#b07612' if side == 'w' else '#f0b941'
    lines = 'M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0'
    return re.sub(r'<path d="' + re.escape(lines) + r'"[^>]*/>', f'<path d="{lines}" stroke="{col}" stroke-width="1.8" fill="none"/>', svg)


def inner(svg):
    return re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)


def restyle(key, v, uid, newknight=False, svg=None):
    side = key[0]
    svg = svg or (knight(side) if (key[1] == 'N' and newknight) else SRC[key])
    g = '<g fill="#000">' + inner(svg) + '</g>'  # the SVG default (black) made explicit, so it gets recoloured too
    if side == 'w':
        body, lit, shade, out = v['w']; line2 = out
    else:
        body, lit, shade, out, line2 = v['b']
    # the piece as drawn, recoloured
    def colour(s):
        s = s.replace('#ececec', 'LINE2')
        s = re.sub(r'(fill|stroke)="#fff"', lambda m: f'{m.group(1)}="{body}"', s)
        s = re.sub(r'(fill|stroke)="#000"', lambda m: f'{m.group(1)}="{body if m.group(1) == "fill" else out}"', s)
        return s.replace('LINE2', line2)
    base = colour(g)
    # the inside of the piece: the fills alone, no lines
    insides = re.sub(r'stroke="[^"]*"', 'stroke="none"', g)
    insides = re.sub(r'fill="#(?:fff|000)"', 'fill="#fff"', insides)
    insides = re.sub(r'fill="#ececec"', 'fill="#fff"', insides)
    # the lines alone, on top
    lines = re.sub(r'fill="#(?:fff|000)"', 'fill="none"', g)
    lines = colour(lines)
    s, l = v['shade'], (v.get('wlit', v['lit']) if side == 'w' else v['lit'])
    defs = (f'<mask id="sh{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="45" height="45"><g>{insides}</g><g transform="translate({-s} 0)">{insides.replace("#fff", "#000")}</g></mask>'
            f'<mask id="li{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="45" height="45"><g>{insides}</g><g transform="translate({l} 0)">{insides.replace("#fff", "#000")}</g></mask>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">'
            f'<defs>{defs}</defs>{base}'
            f'<rect width="45" height="45" fill="{shade}" mask="url(#sh{uid})"/>'
            f'<rect width="45" height="45" fill="{lit}" mask="url(#li{uid})"/>'
            f'{lines}</svg>')


if __name__ == '__main__':
    out = sys.argv[1]; name = sys.argv[2] if len(sys.argv) > 2 else 'ivory'
    v = VARIANTS[name]
    js = {k: restyle(k, v, f'{name[0]}{k}') for k in SRC}
    if out.endswith('build/pieces.json'):  # the app's set: the twelve pieces only
        json.dump(js, open(out, 'w'), indent=0); sys.exit()
    for side in 'wb':  # the king while its side still holds the Joker Move
        js[side + 'K+'] = restyle(side + 'K', v, f'{name[0]}{side}Kj', svg=jester_king(side))
        js[side + 'K*'] = restyle(side + 'K', v, f'{name[0]}{side}Kg', svg=no_cross(side)).replace('</svg>', hat_svg(None, v[side][3], gold=True).replace('"hc"', f'"hc{side}"').replace('#hc)', f'#hc{side})') + '</svg>')
        js[side + 'K~'] = restyle(side + 'K', v, f'{name[0]}{side}Kb', svg=gold_band_king(side))
    json.dump(js, open(out, 'w'))
