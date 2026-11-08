# One look for every store screenshot (Google Play and App Store), the same as the link preview (test/og_image.py):
# charcoal with the Joker's gold light, the wordmark, a headline in Lilita One, a line in Fredoka, the app's own
# screen on a rounded device face. Used by store_frames.py (Play) and store_frames_ios.py (App Store).
import base64, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = '/tmp/node_modules/@fontsource/%s/files/%s'
CAPS = {
    'en': {
        '1-golden': ('One Joker Move per game', 'Teleport a queen, rook, bishop or knight to any empty square. Once. When?'),
        '2-report': ('A review after every game', 'Accuracy, mistakes and the Joker Moves you missed'),
        '3-coach': ('The coach shows why', 'Every mistake explained, with the answer that punishes it'),
        '4-best': ('See the best line', 'Joker Moves included'),
        '5-bots': ('Eight bots, 600 to 2500', 'Or play friends and rated games online'),
        '6-learn': ('Puzzles, easy to hard', '77 positions where one Joker Move wins'),
    },
    'ru': {
        '1-golden': ('Один джокер за партию', 'Перенесите ферзя, ладью, слона или коня на любое пустое поле. Один раз. Когда?'),
        '2-report': ('Разбор после каждой партии', 'Точность, ошибки и упущенные джокеры'),
        '3-coach': ('Тренер объясняет почему', 'Каждая ошибка — с ответом, который её наказывает'),
        '4-best': ('Лучший вариант', 'С джокерами'),
        '5-bots': ('Восемь ботов: 600–2500', 'Или с друзьями и онлайн на рейтинг'),
        '6-learn': ('Задачи от простых к сложным', '77 позиций, где всё решает один джокер'),
    },
}


def _font(fam, path, w=400, rng=None):
    if not os.path.exists(path): return ''
    r = f'unicode-range:{rng};' if rng else ''
    return f"@font-face{{font-family:'{fam}';font-weight:{w};src:url(data:font/woff2;base64,{base64.b64encode(open(path, 'rb').read()).decode()}) format('woff2');{r}}}"


def fonts():
    MAN = f'{ROOT}/vendor/fontsource-manrope-5.3.0/package/files/manrope-cyrillic-%d-normal.woff2'
    CYR = 'U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'
    LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
    css = _font('Lilita One', BRAND % ('lilita-one', 'lilita-one-latin-400-normal.woff2'), 400, LAT)
    css += _font('Lilita One', MAN % 800, 400, CYR)  # the brand fonts have no Cyrillic: Manrope stands in, as heavy as Lilita
    for w in (500, 600):
        css += _font('Fredoka', BRAND % ('fredoka', f'fredoka-latin-{w}-normal.woff2'), w, LAT)
        css += _font('Fredoka', MAN % 600, w, CYR)
    return css


WORDMARK = open(f'{ROOT}/app/resources/wordmark.svg').read()
JOKER = open(f'{ROOT}/app/resources/piece.svg').read()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import og_image  # noqa: E402  (the board corner with the knight's Joker Move)
HERO = {
    'en': ('Chess with a twist.', 'One Joker Move per game: teleport a piece to any empty square.', 'Play now'),
    'ru': ('Шахматы с изюминкой.', 'Один джокер за партию: перенесите фигуру на любое пустое поле.', 'Играть'),
}


def sparkles(k, seed):
    # a few gold sparks around the headline, placed by the frame's number so each frame differs a little
    pts = [(0.12, 0.17, 7), (0.88, 0.15, 5), (0.80, 0.24, 3.5), (0.17, 0.27, 4), (0.93, 0.31, 3)]
    pts = pts[seed % 2:] + pts[:seed % 2]
    return ''.join(f'<i class="spark" style="left:{x * 100:.1f}%;top:{y * 100:.1f}%;width:{r * 2 * k:.0f}px;height:{r * 2 * k:.0f}px"></i>' for x, y, r in pts)


def hero(W, H, k, css, lang='en'):
    # the first frame: the link preview's poster standing up (wordmark, the line, the board corner, the Joker)
    title, sub, cta = HERO[lang]
    if W < H * .6: k = max(k, W / 1080)  # a tall phone: the text grows with the width
    sq = int(min(W * 0.195, H * 0.105))
    cells, arc = og_image.board(sq)
    # the board in the middle of the room the text leaves (the text block's height, roughly: wordmark, title, line, button)
    text_bottom = H * .075 + W * .74 * .28 + 400 * k
    btop = int(text_bottom + max(0, (H - text_bottom - 4.6 * sq) / 2))
    return f"""<html><head><style>{css}
html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#262b29}}
.bg{{position:absolute;inset:0;background:radial-gradient(ellipse 75% 45% at 55% 66%,rgba(240,185,65,.2),rgba(240,185,65,0) 70%),
  radial-gradient(ellipse 80% 30% at 50% 0%,rgba(93,122,116,.3),rgba(38,43,41,0) 70%),#262b29}}
.top{{position:absolute;left:0;right:0;top:{int(H * .075)}px;display:flex;flex-direction:column;align-items:center;gap:{int(26 * k)}px;text-align:center;padding:0 {int(70 * k)}px}}
.wm{{width:{int(W * .74)}px}} .wm svg{{width:100%;height:auto;display:block}}
h1{{margin:{int(10 * k)}px 0 0;font:400 {int(96 * k)}px/1.04 'Lilita One','Manrope',sans-serif;color:#f4efe3;text-wrap:balance}}
p{{margin:0;max-width:{int(860 * k)}px;font:600 {int(40 * k)}px/1.3 'Fredoka','Manrope',sans-serif;color:#b9c4bf;text-wrap:balance}}
.btn{{margin-top:{int(14 * k)}px;font:400 {int(52 * k)}px/1 'Lilita One','Manrope',sans-serif;color:#2a1c03;background:#f0b941;padding:{int(26 * k)}px {int(64 * k)}px {int(30 * k)}px;border-radius:999px;
  box-shadow:0 {int(8 * k)}px 0 #c98a1e,0 {int(20 * k)}px {int(44 * k)}px rgba(0,0,0,.35)}}
.board{{position:absolute;left:50%;top:{btop}px;width:{4 * sq}px;height:{4 * sq}px;margin-left:{-2 * sq - int(sq * .12)}px;display:grid;grid-template-columns:repeat(4,{sq}px);
  border-radius:{int(sq * .2)}px;overflow:hidden;transform:rotate(-7deg);box-shadow:0 {int(36 * k)}px {int(90 * k)}px rgba(0,0,0,.55)}}
{og_image.BOARD_CSS}
.joker{{position:absolute;left:50%;top:{btop + int(2.55 * sq)}px;margin-left:{int(1.2 * sq)}px;width:{int(1.6 * sq)}px;filter:drop-shadow(0 {int(18 * k)}px {int(30 * k)}px rgba(0,0,0,.5))}}
.joker svg{{width:100%;height:auto;display:block}}
.spark{{position:absolute;border-radius:50%;background:#ffd98a;box-shadow:0 0 {int(14 * k)}px rgba(255,217,138,.8)}}
</style></head><body><div class="bg"></div>{sparkles(k, 0)}
<div class="top"><div class="wm">{WORDMARK}</div><h1>{title}</h1><p>{sub}</p><span class="btn">{cta}</span></div>
<div class="board">{cells}{arc}</div><div class="joker">{JOKER}</div></body></html>"""


def page(title, sub, shot_png, W, H, k, css, n=1):
    shot = base64.b64encode(open(shot_png, 'rb').read()).decode()
    return f"""<html><head><style>{css}
html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#262b29}}
.bg{{position:absolute;inset:0;background:
  radial-gradient(ellipse 70% 38% at 50% 78%,rgba(240,185,65,.17),rgba(240,185,65,0) 72%),
  radial-gradient(ellipse 80% 30% at 50% 0%,rgba(93,122,116,.28),rgba(38,43,41,0) 70%),#262b29}}
.wrap{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:{int(84*k)}px {int(64*k)}px {int(56*k)}px;box-sizing:border-box}}
.wm{{width:{int(250*k)}px;flex:none;margin-bottom:{int(34*k)}px}} .wm svg{{width:100%;height:auto;display:block}}
.cap{{text-align:center;flex:none}}
h1{{margin:0;font:400 {int(78*k)}px/1.06 'Lilita One','Manrope',sans-serif;color:#f4efe3;letter-spacing:.2px;text-wrap:balance}}
p{{margin:{int(20*k)}px auto 0;max-width:{int(900*k)}px;font:600 {int(36*k)}px/1.3 'Fredoka','Manrope',sans-serif;color:#b9c4bf;text-wrap:balance}}
.shot{{flex:1;min-height:0;margin-top:{int(48*k)}px;display:flex;justify-content:center}}
.dev{{height:100%;padding:{int(12*k)}px;box-sizing:border-box;border-radius:{int(58*k)}px;background:#171a19;
  box-shadow:0 0 0 {max(2, int(2*k))}px rgba(240,185,65,.32),0 {int(34*k)}px {int(90*k)}px rgba(0,0,0,.6)}}
img{{height:100%;display:block;border-radius:{int(46*k)}px}}
.spark{{position:absolute;border-radius:50%;background:#ffd98a;box-shadow:0 0 {int(14*k)}px rgba(255,217,138,.8)}}
.peek{{position:absolute;bottom:{int(-H*.012)}px;{'right' if n % 2 else 'left'}:{int(-W*.045)}px;width:{int(W*.16)}px;transform:rotate({-10 if n % 2 else 10}deg);
  filter:drop-shadow(0 {int(16*k)}px {int(30*k)}px rgba(0,0,0,.55));z-index:3}} .peek svg{{width:100%;height:auto;display:block}}
</style></head><body><div class="bg"></div><div class="wrap"><div class="wm">{WORDMARK}</div><div class="cap"><h1>{title}</h1><p>{sub}</p></div>
<div class="shot"><div class="dev"><img src="data:image/png;base64,{shot}"></div></div></div>{sparkles(k, n)}<div class="peek">{JOKER}</div></body></html>"""
