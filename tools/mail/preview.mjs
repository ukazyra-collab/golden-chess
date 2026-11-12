// A page with every lifecycle email as the player would get it (EN / RU), from the real templates and made-up data.
// Run: node tools/mail/preview.mjs [out.html]   (default dist/mail-preview.html)
import fs from 'node:fs';
import { render, KINDS } from '../../supabase/functions/mail/templates.js';

const OUT = process.argv[2] || new URL('../../dist/mail-preview.html', import.meta.url).pathname;
const data = (lang) => ({
  name: lang === 'ru' ? 'Виталий' : 'Vitaly', email: lang === 'ru' ? 'vitaly@example.com' : 'alex@example.com',
  unsub: 'https://wduoqpoqbtpkrgbcsegg.supabase.co/functions/v1/mail?u=…&t=…', site: 'https://joker-chess.com/', rating: 1543, pool: 'blitz',
  daily: { n: 12, fen: 'r2qk2r/1p2nppp/p7/3n4/4Q3/1Pb1N3/P3P1PP/2KR1B1R b kq - 0 19 Gg', lvl: 2 },
  week: { games: 9, wins: 5, draws: 1, losses: 3, from: 1509, to: 1543, streak: 4, puzzles: 6, best: { opp: 'QuietRook7', rating: 1712 } },
});
const WHEN = { welcome: { en: 'Right after the account is saved', ru: 'Сразу после сохранения аккаунта' },
  weekly: { en: 'Sundays, 18:00 the player’s time, if they played that week', ru: 'По воскресеньям в 18:00 по времени игрока, если он играл на неделе' },
  winback7: { en: 'Seven days after the last visit, 18:00', ru: 'Через 7 дней после последнего визита, в 18:00' },
  winback21: { en: 'Twenty-one days after the last visit, 18:00', ru: 'Через 21 день после последнего визита, в 18:00' } };
const LABEL = { welcome: { en: 'Welcome', ru: 'Добро пожаловать' }, weekly: { en: 'Weekly summary', ru: 'Итоги недели' },
  winback7: { en: 'A week away', ru: 'Неделя без игры' }, winback21: { en: 'Three weeks away', ru: 'Три недели без игры' } };
const NEEDS = { welcome: { en: 'Sent to every saved account (a service email)', ru: 'Всем, кто сохранил аккаунт (служебное письмо)' },
  weekly: { en: 'Only with the player’s yes', ru: 'Только с согласия игрока' }, winback7: { en: 'Only with the player’s yes', ru: 'Только с согласия игрока' },
  winback21: { en: 'Only with the player’s yes', ru: 'Только с согласия игрока' } };

const emails = {};
for (const lang of ['en', 'ru']) for (const k of KINDS) {
  const m = render(k, lang, data(lang));
  const inner = m.html.slice(m.html.indexOf('<body'), m.html.lastIndexOf('</body>'));
  const body = inner.replace(/^<body[^>]*>/, '');
  emails[k + '-' + lang] = { subject: m.subject, pre: m.preheader, html: body.replace(/<div style="display:none[^"]*">[\s\S]*?<\/div>/, ''), when: WHEN[k][lang], needs: NEEDS[k][lang], label: LABEL[k][lang] };
}

const page = `<title>Joker Chess emails</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root { --bg: #e9ece6; --panel: #ffffff; --ink: #162120; --soft: #55625f; --faint: #8b9592; --line: #d6dbd3; --gold: #c99227; --gold-bg: #f6ecd2; --chip: #f1f3ef; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #232826; --panel: #2f3532; --ink: #f4efe4; --soft: #b2bab5; --faint: #8d9691; --line: #414845; --gold: #f0b941; --gold-bg: #3d3627; --chip: #3a403d; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #232826; --panel: #2f3532; --ink: #f4efe4; --soft: #b2bab5; --faint: #8d9691; --line: #414845; --gold: #f0b941; --gold-bg: #3d3627; --chip: #3a403d; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1040px; margin: 0 auto; padding-block: 28px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { font-size: 28px; margin: 0; text-wrap: balance; letter-spacing: -.01em; }
h1 b { color: var(--gold); }
.intro { color: var(--soft); max-width: 62ch; margin: 6px 0 18px; }
.bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 18px; }
.seg { display: inline-flex; background: var(--chip); border-radius: 12px; padding: 3px; }
.seg button { border: 0; background: none; color: var(--soft); font: inherit; font-weight: 600; padding: 7px 14px; border-radius: 9px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.seg button:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.grid { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 20px; align-items: start; }
.list { display: flex; flex-direction: column; gap: 8px; }
.item { text-align: left; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 14px; padding: 12px 14px; font: inherit; cursor: pointer; }
.item b { display: block; font-size: 15px; }
.item span { display: block; font-size: 13px; color: var(--soft); line-height: 1.35; margin-top: 2px; }
.item[aria-current="true"] { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold) inset; }
.item:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.inbox { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; min-width: 0; }
.inbox .from { font-size: 13px; color: var(--faint); }
.inbox .subj { font-weight: 700; font-size: 16px; overflow-wrap: anywhere; }
.inbox .pre { color: var(--soft); font-size: 14px; overflow-wrap: anywhere; }
.inbox .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.inbox .meta em { font-style: normal; font-size: 12px; background: var(--gold-bg); color: var(--ink); padding: 3px 8px; border-radius: 8px; }
.mail { border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: #ebede8; margin: 0 auto; transition: max-width .2s ease; min-width: 0; }
.mail.phone { max-width: 390px; }
.mail-scroll { overflow-x: auto; }
@media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } .list { flex-direction: row; overflow-x: auto; padding-bottom: 4px; } .item { flex: 0 0 200px; } }
@media (prefers-reduced-motion: reduce) { .mail { transition: none; } }
</style>
<div class="wrap">
  <h1><b>Joker</b> Chess emails</h1>
  <p class="intro" id="intro"></p>
  <div class="bar">
    <div class="seg" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="true">English</button><button type="button" data-lang="ru" aria-pressed="false">Русский</button></div>
    <div class="seg" role="group" aria-label="Width"><button type="button" data-w="phone" aria-pressed="true" id="w-phone"></button><button type="button" data-w="desk" aria-pressed="false" id="w-desk"></button></div>
  </div>
  <div class="grid">
    <nav class="list" id="list" aria-label="Emails"></nav>
    <section>
      <div class="inbox" id="inbox"></div>
      <div class="mail-scroll"><div class="mail phone" id="mail"></div></div>
    </section>
  </div>
</div>
<script>
var EMAILS = ${JSON.stringify(emails).replace(/</g, '\\u003c')};
var KINDS = ${JSON.stringify(KINDS)};
var UI = { en: { intro: 'Four emails Joker Chess would send on its own, from the real templates with made-up data. Nothing here has been sent: the mail function is a prototype.', phone: 'Phone', desk: 'Desktop', from: 'Joker Chess', when: 'When', who: 'Who' },
  ru: { intro: 'Четыре письма, которые Joker Chess будет отправлять сам: настоящие шаблоны, выдуманные данные. Ничего не отправлено: функция писем — прототип.', phone: 'Телефон', desk: 'Компьютер', from: 'Joker Chess', when: 'Когда', who: 'Кому' } };
var st = { lang: 'en', kind: 'welcome', w: 'phone' };
try { var s = JSON.parse(localStorage.getItem('mailPreview') || 'null'); if (s && UI[s.lang]) st = Object.assign(st, s); } catch (e) {}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function draw() {
  var u = UI[st.lang];
  document.documentElement.lang = st.lang;
  document.getElementById('intro').textContent = u.intro;
  document.getElementById('w-phone').textContent = u.phone; document.getElementById('w-desk').textContent = u.desk;
  document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === st.lang)); });
  document.querySelectorAll('[data-w]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.w === st.w)); });
  var list = document.getElementById('list'); list.innerHTML = '';
  KINDS.forEach(function (k) {
    var e = EMAILS[k + '-' + st.lang], b = document.createElement('button');
    b.type = 'button'; b.className = 'item'; b.setAttribute('aria-current', String(k === st.kind));
    b.innerHTML = '<b>' + esc(e.label) + '</b><span>' + esc(e.when) + '</span>';
    b.addEventListener('click', function () { st.kind = k; save(); draw(); });
    list.appendChild(b);
  });
  var e = EMAILS[st.kind + '-' + st.lang];
  document.getElementById('inbox').innerHTML = '<div class="from">' + esc(u.from) + '</div><div class="subj">' + esc(e.subject) + '</div><div class="pre">' + esc(e.pre) + '</div>' +
    '<div class="meta"><em>' + esc(u.when + ': ' + e.when) + '</em><em>' + esc(u.who + ': ' + e.needs) + '</em></div>';
  var m = document.getElementById('mail'); m.className = 'mail' + (st.w === 'phone' ? ' phone' : ''); m.innerHTML = e.html;
}
function save() { try { localStorage.setItem('mailPreview', JSON.stringify(st)); } catch (e) {} }
document.querySelectorAll('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { st.lang = b.dataset.lang; save(); draw(); }); });
document.querySelectorAll('[data-w]').forEach(function (b) { b.addEventListener('click', function () { st.w = b.dataset.w; save(); draw(); }); });
draw();
</script>
`;
fs.writeFileSync(OUT, page);
console.log('wrote', OUT, (page.length / 1024).toFixed(0) + ' KB');
