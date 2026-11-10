// The emails Joker Chess sends on its own (PROTOTYPE: the mail function isn't deployed). Pure functions: the mail
// function (Deno) and the tests and the preview page (Node) share them.
//   welcome    the account was just saved: what it keeps, three things to try (a service email)
//   weekly     the player's week: games, rating, the best win, the streak (only with the player's yes: email_opt)
//   winback7   a week away: the daily puzzle of the day on a small board (email_opt)
//   winback21  three weeks away: the rating is kept, a game takes three minutes (email_opt)
// Every email has a one-click way to stop them (the link, and the List-Unsubscribe header the mail function adds).
// Email HTML: tables and inline styles only (Gmail, Outlook and Apple Mail all read that), light only, 600px wide.

const C = { page: '#ebede8', card: '#ffffff', line: '#dadfd8', ink: '#162120', body: '#3c4946', soft: '#5b6865', faint: '#97a19e',
  head: '#162120', gold: '#e7b44a', goldInk: '#2a1d05', goldSoft: '#f8f2e2', sqL: '#ebe5d4', sqD: '#93ada6' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));

const T = {
  en: {
    stop: 'Stop these emails', why: 'Sent to {email} because you saved your Joker Chess account.', whyOpt: 'Sent to {email} because you said yes to emails about your games.',
    tagline: 'chess with one Joker Move per game',
    welcomeS: 'Your Joker Chess account is saved', welcomeP: 'Your rating, games and streak are safe on every device now.',
    welcomeH: 'Welcome, {name}', welcomeB: 'Your rating, your games and your streak are saved to this email. Sign in with it on any phone or computer and carry on where you left off.',
    tryH: 'Three things to try', try1: 'Today’s Joker puzzle', try1b: 'One move: any piece, any empty square. A new one every day.',
    try2: 'A rated 3+2 game', try2b: 'An opponent in seconds, any time of day.', try3: 'A free game review', try3b: 'See where a game turned, Joker Moves included.',
    welcomeBtn: 'Open Joker Chess',
    weeklyS: 'Your week: {games} games, rating {delta}', weeklySNoRate: 'Your week in Joker Chess: {games} games', weeklyP: '{w} wins, {d} draws, {l} losses. Your streak: {streak} days.',
    weeklyH: 'Your week, {name}', gamesL: 'games', winsL: 'wins', drawsL: 'draws', lossesL: 'losses', ratingL: '{pool} rating', streakL: 'day streak',
    bestWin: 'Best win of the week: against {opp} ({rating}).', puzzlesL: 'Puzzles solved: {n}.', weeklyBtn: 'Review your games',
    weeklyDaily: 'This week’s puzzles are waiting', pools: { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid' },
    wb7S: 'Your Joker Move is waiting', wb7P: 'Seven new daily puzzles since your last game. Today’s is #{n}.',
    wb7H: 'Daily puzzle #{n}', wb7B: '{side} to move and win with a Joker Move: any piece to any empty square, once a game. Can you see it?',
    lvl: { 1: 'Easy', 2: 'Medium', 3: 'Hard' }, white: 'White', black: 'Black', wb7Btn: 'Solve it', wb7Alt: 'Or play a quick 3+2: an opponent is a few seconds away.',
    wb21S: 'Your rating is still {rating}', wb21P: 'Three weeks without a game. Your rating and your games are kept.',
    wb21H: 'We kept your place, {name}', wb21B: 'Your {pool} rating is still {rating}. New players have joined since you last played, and a 3+2 game takes six minutes at most.',
    wb21Btn: 'Play a game', wb21Alt: 'Not in the mood for a game? Today’s puzzle takes a minute.',
  },
  ru: {
    stop: 'Отписаться от этих писем', why: 'Отправлено на {email}, потому что ты сохранил аккаунт Joker Chess.', whyOpt: 'Отправлено на {email}, потому что ты согласился получать письма о своих партиях.',
    tagline: 'шахматы с одним ходом-джокером за партию',
    welcomeS: 'Аккаунт Joker Chess сохранён', welcomeP: 'Рейтинг, партии и серия теперь на любом устройстве.',
    welcomeH: 'Привет, {name}!', welcomeB: 'Рейтинг, партии и серия сохранены на эту почту. Войди с ней на любом телефоне или компьютере и продолжай с того же места.',
    tryH: 'Что попробовать', try1: 'Задача дня с джокером', try1b: 'Один ход: любая фигура на любое пустое поле. Новая каждый день.',
    try2: 'Рейтинговая партия 3+2', try2b: 'Соперник за секунды, в любое время суток.', try3: 'Бесплатный разбор партии', try3b: 'Посмотри, где решилась партия, с ходами-джокерами.',
    welcomeBtn: 'Открыть Joker Chess',
    weeklyS: 'Твоя неделя: {games} парт., рейтинг {delta}', weeklySNoRate: 'Твоя неделя в Joker Chess: {games} парт.', weeklyP: 'Побед: {w}, ничьих: {d}, поражений: {l}. Серия: {streak} дн.',
    weeklyH: 'Твоя неделя, {name}', gamesL: 'партий', winsL: 'побед', drawsL: 'ничьих', lossesL: 'поражений', ratingL: 'рейтинг, {pool}', streakL: 'дней подряд',
    bestWin: 'Лучшая победа недели: над {opp} ({rating}).', puzzlesL: 'Решено задач: {n}.', weeklyBtn: 'Разобрать партии',
    weeklyDaily: 'Задачи недели ждут', pools: { bullet: 'пуля', blitz: 'блиц', rapid: 'рапид' },
    wb7S: 'Твой ход-джокер ждёт', wb7P: 'Семь новых задач дня с твоей последней партии. Сегодня задача #{n}.',
    wb7H: 'Задача дня #{n}', wb7B: 'Ход {side}, выигрыш — ходом-джокером: любая фигура на любое пустое поле, раз за партию. Видишь его?',
    lvl: { 1: 'Лёгкая', 2: 'Средняя', 3: 'Трудная' }, white: 'белых', black: 'чёрных', wb7Btn: 'Решить', wb7Alt: 'Или сыграй быструю 3+2: соперник найдётся за пару секунд.',
    wb21S: 'Твой рейтинг на месте: {rating}', wb21P: 'Три недели без партий. Рейтинг и партии сохранены.',
    wb21H: 'Твоё место за тобой, {name}', wb21B: 'Рейтинг ({pool}) всё ещё {rating}. С твоей последней партии пришли новые игроки, а партия 3+2 длится не дольше шести минут.',
    wb21Btn: 'Сыграть партию', wb21Alt: 'Нет настроения играть? Задача дня займёт минуту.',
  },
};

// a position as a small board of table cells (no images: nothing for a mail app to block); the side to move at the bottom
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎', K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };
export function boardHtml(fen, cell = 34) {
  const [place, side] = String(fen || '').split(' ');
  const rows = (place || '8/8/8/8/8/8/8/8').split('/').map((r) => r.replace(/\d/g, (n) => '.'.repeat(+n)).padEnd(8, '.').slice(0, 8).split(''));
  const flip = side === 'b';
  let html = `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto;border:2px solid ${C.ink}">`;
  for (let i = 0; i < 8; i++) {
    const r = flip ? 7 - i : i;
    html += '<tr>';
    for (let j = 0; j < 8; j++) {
      const f = flip ? 7 - j : j, ch = rows[r][f], dark = (r + f) % 2 === 1;
      html += `<td width="${cell}" height="${cell}" align="center" valign="middle" style="width:${cell}px;height:${cell}px;padding:0;background:${dark ? C.sqD : C.sqL};font-size:${Math.round(cell * 0.78)}px;line-height:${cell}px;color:${C.ink};font-family:'Segoe UI Symbol','Apple Symbols','DejaVu Sans',sans-serif">${ch === '.' ? '&nbsp;' : GLYPH[ch] || '&nbsp;'}</td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}

function button(label, url) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0"><tr><td style="border-radius:14px;background:${C.gold}">` +
    `<a href="${esc(url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.goldInk};text-decoration:none;border-radius:14px">${esc(label)}</a></td></tr></table>`;
}
const p = (html, pad = '8px 28px 0 28px', size = 15, color = C.body) => `<tr><td style="padding:${pad};font-family:${FONT};font-size:${size}px;line-height:1.55;color:${color}">${html}</td></tr>`;
const h1 = (text) => `<tr><td style="padding:24px 28px 0 28px;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-.01em;color:${C.ink}">${esc(text)}</td></tr>`;

function frame(o) {
  // the preheader: the line a mail app shows next to the subject
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only">` +
    `<title>${esc(o.subject)}</title></head><body style="margin:0;padding:0;background:${C.page}">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.page};padding:28px 12px"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:16px;overflow:hidden">` +
    `<tr><td style="background:${C.head};padding:16px 28px;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:21px;color:#ece6d8">` +
    `<span style="color:${C.gold}">Joker</span> Chess</td></tr>` + o.body +
    `<tr><td style="padding:22px 28px 0 28px"><div style="border-top:1px solid #e3e7e1;line-height:0">&nbsp;</div></td></tr>` +
    `<tr><td style="padding:6px 28px 26px 28px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.faint}">${esc(o.why)}<br>` +
    `<a href="${esc(o.unsub)}" style="color:${C.soft};font-weight:600">${esc(o.stop)}</a> &middot; <a href="${esc(o.site)}" style="color:${C.faint}">Joker Chess</a>, ${esc(o.tagline)}</td></tr>` +
    `</table></td></tr></table></body></html>`;
}

const KINDS = ['welcome', 'weekly', 'winback7', 'winback21'];
export { KINDS };

// d: { name, email, unsub (the one-click link), site, rating, pool, daily: { n, fen, lvl, url }, week: { games, wins, draws, losses,
//   from, to, streak, puzzles, best: { opp, rating } } }
export function render(kind, lang, d) {
  const L = T[lang] || T.en, site = d.site || 'https://joker-chess.com/';
  // the app's views are its hash (#play, #learn, #profile); the campaign rides in the query for the analytics
  const link = (view) => site.replace(/[?#].*$/, '') + '?utm_source=email&utm_medium=lifecycle&utm_campaign=' + kind + '#' + view;
  const base = { lang: T[lang] ? lang : 'en', unsub: d.unsub, site, stop: L.stop, tagline: L.tagline, why: fill(kind === 'welcome' ? L.why : L.whyOpt, { email: d.email || '' }) };
  let subject, preheader, body, text;
  const name = d.name || 'there';
  if (kind === 'welcome') {
    subject = L.welcomeS; preheader = L.welcomeP;
    const item = (t, b) => `<tr><td style="padding:10px 0 0 0;font-family:${FONT}"><div style="font-size:15px;font-weight:700;color:${C.ink}">${esc(t)}</div><div style="font-size:14px;line-height:1.5;color:${C.soft}">${esc(b)}</div></td></tr>`;
    body = h1(fill(L.welcomeH, { name })) + p(esc(L.welcomeB)) +
      `<tr><td style="padding:18px 28px 0 28px;font-family:${FONT};font-size:13px;font-weight:700;color:${C.soft}">${esc(L.tryH)}</td></tr>` +
      `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${item(L.try1, L.try1b)}${item(L.try2, L.try2b)}${item(L.try3, L.try3b)}</table></td></tr>` +
      `<tr><td style="padding:22px 28px 0 28px">${button(L.welcomeBtn, link('play'))}</td></tr>`;
    text = [fill(L.welcomeH, { name }), L.welcomeB, '', L.tryH + ':', '- ' + L.try1 + ': ' + L.try1b, '- ' + L.try2 + ': ' + L.try2b, '- ' + L.try3 + ': ' + L.try3b, '', L.welcomeBtn + ': ' + link('play')];
  } else if (kind === 'weekly') {
    const w = d.week || {}, delta = w.from != null && w.to != null ? Math.round(w.to - w.from) : null;
    const ds = delta == null ? '' : (delta > 0 ? '+' : delta < 0 ? '−' : '±') + Math.abs(delta);
    subject = delta == null ? fill(L.weeklySNoRate, { games: w.games }) : fill(L.weeklyS, { games: w.games, delta: ds });
    preheader = fill(L.weeklyP, { w: w.wins || 0, d: w.draws || 0, l: w.losses || 0, streak: w.streak || 0 });
    const tile = (n, label, wd = 25) => `<td width="${wd}%" align="center" style="padding:12px 4px;background:${C.goldSoft};border-radius:12px;font-family:${FONT}"><div style="font-size:24px;font-weight:800;color:${C.ink}">${esc(n)}</div><div style="font-size:12px;color:${C.soft}">${esc(label)}</div></td>`;
    const gap = '<td width="8" style="width:8px">&nbsp;</td>';
    const pool = (L.pools || {})[d.pool] || d.pool || '';
    body = h1(fill(L.weeklyH, { name })) +
      `<tr><td style="padding:16px 28px 0 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${tile(w.games || 0, L.gamesL)}${gap}${tile(w.wins || 0, L.winsL)}${gap}${tile(w.draws || 0, L.drawsL)}${gap}${tile(w.losses || 0, L.lossesL)}</tr></table></td></tr>` +
      `<tr><td style="padding:8px 28px 0 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>` +
      `${tile(w.to != null ? Math.round(w.to) + (ds ? ' (' + ds + ')' : '') : '–', fill(L.ratingL, { pool }), 50)}${gap}${tile(w.streak || 0, L.streakL, 50)}</tr></table></td></tr>` +
      (w.best ? p(esc(fill(L.bestWin, { opp: w.best.opp, rating: w.best.rating })), '16px 28px 0 28px') : '') +
      (w.puzzles ? p(esc(fill(L.puzzlesL, { n: w.puzzles })), '6px 28px 0 28px') : '') +
      `<tr><td style="padding:22px 28px 0 28px">${button(L.weeklyBtn, link('profile'))}</td></tr>`;
    text = [fill(L.weeklyH, { name }), preheader, w.best ? fill(L.bestWin, { opp: w.best.opp, rating: w.best.rating }) : '', '', L.weeklyBtn + ': ' + link('profile')];
  } else if (kind === 'winback7') {
    const dl = d.daily || {}, side = String(dl.fen || '').split(' ')[1] === 'b' ? L.black : L.white;
    subject = L.wb7S; preheader = fill(L.wb7P, { n: dl.n });
    body = h1(fill(L.wb7H, { n: dl.n }) + (dl.lvl ? ' · ' + (L.lvl[dl.lvl] || '') : '')) + p(esc(fill(L.wb7B, { side }))) +
      `<tr><td align="center" style="padding:18px 28px 0 28px">${boardHtml(dl.fen)}</td></tr>` +
      `<tr><td align="center" style="padding:20px 28px 0 28px">${button(L.wb7Btn, link('learn'))}</td></tr>` + p(esc(L.wb7Alt), '14px 28px 0 28px', 14, C.soft);
    text = [fill(L.wb7H, { n: dl.n }), fill(L.wb7B, { side }), '', L.wb7Btn + ': ' + link('learn'), L.wb7Alt];
  } else if (kind === 'winback21') {
    const pool = (L.pools || {})[d.pool] || d.pool || '';
    subject = fill(L.wb21S, { rating: d.rating }); preheader = L.wb21P;
    body = h1(fill(L.wb21H, { name })) + p(esc(fill(L.wb21B, { pool, rating: d.rating }))) +
      `<tr><td style="padding:22px 28px 0 28px">${button(L.wb21Btn, link('play'))}</td></tr>` + p(esc(L.wb21Alt), '14px 28px 0 28px', 14, C.soft);
    text = [fill(L.wb21H, { name }), fill(L.wb21B, { pool, rating: d.rating }), '', L.wb21Btn + ': ' + link('play'), L.wb21Alt];
  } else throw new Error('unknown email ' + kind);
  text = text.concat(['', '--', base.why, L.stop + ': ' + d.unsub]).join('\n');
  return { subject, preheader, html: frame(Object.assign(base, { subject, preheader, body })), text };
}
