/* Habits: the daily Joker puzzle, the streak of days played, and the plan of reminders for the days away.
 * Pure functions with no page in them, so the app and the tests share them. A day is the player's own calendar day,
 * 'YYYY-MM-DD' in local time (a new daily puzzle at local midnight, like chess.com's).
 *
 * Streak, the chess.com way: a day counts when the player finishes a game, solves a puzzle or reviews a game. A missed
 * day doesn't end the streak at once: it waits two days (paused) and goes on with the next day played; after three
 * missed days in a row it is gone. */
var Habits = (function () {
  var EPOCH = '2026-11-10'; // daily puzzle #1

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // noon of that day: adding days never trips over a clock change
  function noon(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0); }
  function addDays(s, n) { var d = noon(s); d.setDate(d.getDate() + n); return dayOf(d); }
  function diffDays(a, b) { return Math.round((noon(b) - noon(a)) / 86400000); } // b - a
  function weekday(s) { var w = noon(s).getDay(); return w === 0 ? 7 : w; } // Monday 1 .. Sunday 7
  function uniqSorted(days) { var m = {}; (days || []).forEach(function (d) { if (/^\d{4}-\d\d-\d\d$/.test(d)) m[d] = 1; }); return Object.keys(m).sort(); }

  // ---- the daily puzzle: Monday and Tuesday easy, the middle of the week medium, the weekend hard (a newspaper
  // crossword's week); inside its level the week number picks the puzzle, so a year of days gets different ones.
  // A longer list moves the days still to come onto other puzzles (today's too): new puzzles go out between days.
  var LEVEL_OF_DAY = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3 };
  function dailyFor(s, list) {
    if (!list || !list.length) return null;
    var n = diffDays(EPOCH, s), w = weekday(s), want = LEVEL_OF_DAY[w];
    var bucket = list.filter(function (p) { return (p.lvl || 1) === want; });
    if (!bucket.length) bucket = list;
    var sameLevel = [], k;
    for (k = 1; k <= 7; k++) if (LEVEL_OF_DAY[k] === want) sameLevel.push(k);
    var week = Math.floor((n + 7000) / 7), pos = sameLevel.indexOf(w);
    var idx = ((week * sameLevel.length + pos) % bucket.length + bucket.length) % bucket.length;
    return { day: s, n: n + 1, p: bucket[idx], lvl: want };
  }

  // ---- the streak
  function runs(days) {
    var out = [], cur = null;
    days.forEach(function (d) {
      if (cur && diffDays(cur.last, d) <= 3) { cur.count++; cur.last = d; } else { cur = { first: d, last: d, count: 1 }; out.push(cur); }
    });
    return out;
  }
  // count: the streak now; state: 'done' (played today), 'due' (played yesterday, today keeps it), 'paused' (one or two
  // days missed, today brings it back), 'none'; best: the longest ever; week: Monday to Sunday of this week
  function streak(days, today) {
    days = uniqSorted(days).filter(function (d) { return d <= today; });
    var rs = runs(days), best = 0;
    rs.forEach(function (r) { best = Math.max(best, r.count); });
    var last = rs.length ? rs[rs.length - 1] : null, gap = last ? diffDays(last.last, today) : 99;
    var state = !last ? 'none' : gap === 0 ? 'done' : gap === 1 ? 'due' : gap <= 3 ? 'paused' : 'none';
    var count = state === 'none' ? 0 : last.count;
    var on = {}; days.forEach(function (d) { on[d] = 1; });
    var mon = addDays(today, 1 - weekday(today)), week = [];
    for (var i = 0; i < 7; i++) { var d = addDays(mon, i); week.push({ d: d, on: !!on[d], today: d === today, future: d > today }); }
    return { count: count, best: best, state: state, missed: state === 'paused' ? gap - 1 : 0, last: last ? last.last : null, week: week, lost: !!last && state === 'none' && last.count >= 2 ? last.count : 0 };
  }
  // a player who has been here on an earlier day (the Play tab then shows the daily puzzle instead of the reel)
  function returning(days, today) { return uniqSorted(days).some(function (d) { return d < today; }); }

  // ---- the hour the player usually comes: the middle of the last visits' hours, kept between 9:00 and 21:00
  function habitHour(hours) {
    var hs = (hours || []).filter(function (x) { return x >= 0 && x <= 23; }).slice(-15).sort(function (a, b) { return a - b; });
    if (!hs.length) return 19;
    var m = hs[Math.floor(hs.length / 2)];
    return Math.max(9, Math.min(21, m));
  }

  // ---- reminders for the days away. Planned again every time the app opens or goes to the background, so a player
  // who comes every day only ever gets the evening one on a day not played yet. At most one a day, never 22:00-9:00,
  // nothing after the 30th day away.
  var TEXT = {
    en: {
      streakT: 'Keep your {n}-day streak', streakB: 'One game or today’s puzzle is enough.',
      dailyT: 'Daily Joker puzzle #{n}', dailyB: 'One move, any piece, any empty square. Can you find it?',
      gameT: 'A quick game?', gameB: 'A 3+2 starts in seconds. Your Joker Move is waiting.',
      reviewT: 'Your game review is free', reviewB: 'See where your last game turned, Joker Moves included.',
      weekT: 'A week of new puzzles', weekB: 'Seven daily Joker puzzles since you last came by.',
      jokerT: 'Still holding your Joker?', jokerB: 'One move can turn any game. Play a quick one.',
      newsT: 'New in Joker Chess', newsB: 'New puzzles and new players since your last visit.',
      nextT: '{name} is waiting for you', nextB: 'Rated {elo}. One good game is worth three stars.',
      bonusT: 'Today’s bonus is ready', bonusB: 'Your first win of the day counts double, and three new quests are in.',
      lastT: 'Today’s bonus ends at midnight', lastB: 'A win now counts double. The quests change tomorrow.',
      seasonT: '{n} ★ to the next season', seasonB: '“{name}” opens with them. Any opponent you can already play gives stars.'
    },
    ru: {
      streakT: 'Не теряй серию: {n} дн.', streakB: 'Хватит одной партии или задачи дня.',
      dailyT: 'Задача дня #{n}', dailyB: 'Один ход, любая фигура, любое пустое поле. Найдёшь?',
      gameT: 'Сыграем?', gameB: 'Партия 3+2 начинается за секунды. Джокер ждёт.',
      reviewT: 'Разбор партии бесплатно', reviewB: 'Посмотри, где решилась твоя последняя партия, с ходами-джокерами.',
      weekT: 'Неделя новых задач', weekB: 'Семь задач дня с джокером с твоего визита.',
      jokerT: 'Джокер ещё у тебя?', jokerB: 'Один ход может перевернуть партию. Сыграй быструю.',
      newsT: 'Что нового в Joker Chess', newsB: 'Новые задачи и новые игроки с твоего визита.',
      nextT: '{name} ждёт тебя', nextB: 'Рейтинг {elo}. Одна хорошая партия даёт три звезды.',
      bonusT: 'Бонус дня готов', bonusB: 'Первая победа сегодня считается вдвойне, и есть три новых задания.',
      lastT: 'Бонус дня до полуночи', lastB: 'Победа сейчас считается вдвойне. Завтра задания сменятся.',
      seasonT: 'До нового сезона {n} ★', seasonB: 'С ними откроется «{name}». Звёзды даёт любой открытый соперник.'
    }
  };
  function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  var QUIET_FROM = 22, QUIET_TO = 9;
  // o: { now: Date, lang, days, hours (visit hours), hasGame (a finished game to review) } and, for a player of the
  // game layer: mode (what they did last: 'career' | 'online' | 'puzzles'), next ({ name, elo }: the career's next
  // opponent), bonus (they play for the level: the day's bonus means something to them), season ({ name, n }: the
  // next season and the few stars it still asks for). The first days follow what the player came for.
  function plan(o) {
    var now = o.now, today = dayOf(now), L = TEXT[o.lang] || TEXT.en, hour = habitHour(o.hours), st = streak(o.days || [], today);
    var out = [];
    function at(day, h, m) { var d = noon(day); d.setHours(h, m || 0, 0, 0); return d; }
    function add(day, h, m, kind, vars, go) {
      var when = at(day, h, m);
      if (when <= now) return;
      if (when.getHours() >= QUIET_FROM || when.getHours() < QUIET_TO) return;
      if (out.some(function (x) { return dayOf(x.at) === day; })) return; // one a day
      var t = kind + 'T', b = kind + 'B';
      out.push({ id: 7000 + diffDays(today, day), at: when, kind: kind, title: fill(L[t], vars || {}), body: fill(L[b], vars || {}), go: go || 'play' });
    }
    // today, in the evening, on a day not played yet: a streak of two days or more to keep; without one, the day's
    // bonus that ends at midnight (for those who play for the level)
    if ((st.state === 'due' || st.state === 'paused') && st.count >= 2) add(today, 20, 30, 'streak', { n: st.count }, 'learn');
    else if (o.bonus && st.state !== 'done') add(today, 20, 30, 'last', {}, 'play');
    var dn = function (k) { var d = dailyFor(addDays(today, k), [{ lvl: 1 }]); return d ? d.n : ''; };
    // tomorrow: what they came for last time: the career's next opponent, a quick game online, or the daily puzzle
    if (o.mode === 'career' && o.next) add(addDays(today, 1), hour, 0, 'next', o.next, 'bots');
    else if (o.mode === 'online') add(addDays(today, 1), hour, 0, 'game', {}, 'play');
    else add(addDays(today, 1), hour, 0, 'daily', { n: dn(1) }, 'learn');
    // in two days: the day's bonus for those who play for the level, a quick game for the rest
    if (o.bonus) add(addDays(today, 2), hour, 0, 'bonus', {}, 'play');
    else add(addDays(today, 2), hour, 0, 'game', {}, 'play');
    // in three: the other thing: the opponent who is next for those who came for something else, the daily puzzle
    if (o.mode !== 'career' && o.next) add(addDays(today, 3), hour, 0, 'next', o.next, 'bots');
    else add(addDays(today, 3), hour, 0, 'daily', { n: dn(3) }, 'learn');
    if (o.hasGame) add(addDays(today, 5), hour, 0, 'review', {}, 'games');
    if (o.season) add(addDays(today, 7), hour, 0, 'season', o.season, 'bots');
    else add(addDays(today, 7), hour, 0, 'week', {}, 'learn');
    add(addDays(today, 14), hour, 0, 'joker', {}, 'play');
    add(addDays(today, 30), hour, 0, 'news', {}, 'learn');
    return out;
  }

  return { EPOCH: EPOCH, dayOf: dayOf, addDays: addDays, diffDays: diffDays, weekday: weekday, dailyFor: dailyFor, streak: streak,
    returning: returning, habitHour: habitHour, plan: plan, TEXT: TEXT };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Habits;
