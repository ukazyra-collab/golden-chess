/* Joker Pro: the paid tier. Pure functions with no page in them: the plans and their prices, what the free game
 * allows, what Pro adds. The game itself stays free: every game, the rating, the bots, the career, the puzzles and the
 * review of the moves that were played. Pro sells the coach (the Joker analysis of every game, hints against the
 * bots), the puzzle pack and its marathon, speed (more XP, every season open, the Joker any time, streak freezes) and
 * status (a gold name, the Pro mark, looks of its own).
 *
 * Who has Pro is the server's word (supabase/functions/pay: Stripe's own payment page, on the website only; the apps
 * honour it and sell nothing). The amounts here are what that page charges: test/server/pay.test.mjs holds the two
 * tables against each other. The prototype page (GC_PROTO) keeps a switch of its own on the device instead.
 *
 * Prices are set against chess.com's cheapest plan, Gold: 6.99 a month, 49.99 a year (USD, Oct 2026). */
var Pro = (function () {
  var PLANS = {
    year: { id: 'year', usd: 29.99, months: 12, trialDays: 7 },
    month: { id: 'month', usd: 3.99, months: 1, trialDays: 0 },
    founder: { id: 'founder', usd: 79.99, months: 0, trialDays: 0, seats: 1000 } // for life, the first thousand players
  };
  var CHESSCOM_GOLD = { month: 6.99, year: 49.99 };
  var FREE_CHECKS = 1;    // Joker analyses a free player gets: not a day, in all. What was opened stays open
  var FREE_HINTS = 3;     // hints in games against the bots a free player gets a day
  var XP_BONUS = 0.5;     // Pro earns this much on top of every XP gain
  var FREEZES = 2;        // times a month a Pro player's lost streak comes back
  var PERKS = ['coach', 'puzzles', 'road', 'xp', 'status'];

  function round2(x) { return Math.round(x * 100) / 100; }
  function perMonth(id) { var p = PLANS[id]; return p && p.months ? round2(p.usd / p.months) : null; }
  // how much cheaper than chess.com Gold, in whole percent
  function cheaper(id) { var ref = CHESSCOM_GOLD[id], p = PLANS[id]; return ref && p ? Math.round((1 - p.usd / ref) * 100) : null; }
  // what the yearly plan saves against twelve monthly payments, in whole percent
  function yearSaving() { return Math.round((1 - PLANS.year.usd / (PLANS.month.usd * 12)) * 100); }
  function price(usd) { return '$' + usd.toFixed(2); }

  // ---- the account's Pro as the server has it. p: a profile row (pro_until, pro_founder, pro_plan); answers
  // { until (ms | null), founder, plan }, or null when the row says nothing of Pro (a server from before it)
  function ofProfile(p) {
    if (!p || !('pro_until' in p || 'pro_founder' in p)) return null;
    var t = p.pro_until ? Date.parse(p.pro_until) : NaN;
    return { until: isFinite(t) ? t : null, founder: !!p.pro_founder, plan: p.pro_plan || null };
  }
  var GRACE_MS = 10 * 60 * 1000; // a renewal on its way: the device waits this long before it takes Pro for ended
  function entitled(s, now) { return !!s && (!!s.founder || (s.until != null && s.until + GRACE_MS > now)); }

  // ---- the Joker analysis of a game (where the Joker Move was, how good the one played was). Pro has it in every
  // review; a free player has FREE_CHECKS of them, each kept for the game it was used on.
  // st: { n (free ones used), keys: [the games opened, oldest first] }
  var CHECK_KEEP = 300;
  function checkOpen(st, key) { return !!(st && key && st.keys && st.keys.indexOf(key) >= 0); }
  function checksLeft(st) { return Math.max(0, FREE_CHECKS - ((st && st.n) || 0)); }
  // takes a free analysis for this game (nothing if it is open already); the new state, or null when none is left
  function useCheck(st, key) {
    if (!key) return null;
    if (checkOpen(st, key)) return st;
    if (checksLeft(st) <= 0) return null;
    return { n: ((st && st.n) || 0) + 1, keys: ((st && st.keys) || []).concat([key]).slice(-CHECK_KEEP) };
  }

  // ---- hints in a game against a bot. st: { day, n (used today), shown: { '<game>': { '<ply>': 1 } } }: what was
  // shown today stays shown (a hint is paid once), a new day starts afresh
  function hintState(st, day) { return st && st.day === day ? st : { day: day, n: 0, shown: {} }; }
  function hintsLeft(st, day, pro) { return pro ? Infinity : Math.max(0, FREE_HINTS - hintState(st, day).n); }
  function hintShown(st, day, key, ply) { var s = hintState(st, day); return !!(s.shown[key] && s.shown[key][ply]); }
  // takes a hint for this moment of this game (free if it was shown already today); returns the new state, or null
  // when a free player has none left
  function useHint(st, day, pro, key, ply) {
    var s = hintState(st, day);
    if (hintShown(s, day, key, ply)) return s;
    if (!pro && s.n >= FREE_HINTS) return null;
    var shown = {}; for (var k in s.shown) shown[k] = s.shown[k];
    shown[key] = Object.assign({}, shown[key]); shown[key][ply] = 1;
    return { day: day, n: s.n + (pro ? 0 : 1), shown: shown };
  }

  function bonusXp(xp) { return Math.max(0, Math.round((xp || 0) * XP_BONUS)); }

  // ---- streak freezes. Free, a streak waits two days for the player (src/habits.js); a freeze saves one that has
  // run out after a longer break, FREEZES times a month. st: { month: 'YYYY-MM', n (used this month), days: [the days
  // the freezes covered] }
  var FREEZE_SPAN = 7; // the longest break one freeze covers, in days
  function freezesLeft(st, month) { return Math.max(0, FREEZES - (st && st.month === month ? st.n || 0 : 0)); }
  // missed: the days between the last one played and today. Returns the new state, or null when there is nothing to
  // cover, the break is too long, or no freeze is left this month
  function useFreeze(st, month, missed) {
    if (!missed || !missed.length || missed.length > FREEZE_SPAN || freezesLeft(st, month) <= 0) return null;
    return { month: month, n: (st && st.month === month ? st.n || 0 : 0) + 1, days: ((st && st.days) || []).concat(missed).slice(-90) };
  }

  // ---- looks only Pro has (the kinds are the game layer's: board, jdot, frame, title)
  var LOOKS = [{ kind: 'title', id: 'pro' }, { kind: 'frame', id: 'pro' }, { kind: 'jdot', id: 'gold' }, { kind: 'board', id: 'royal' }, { kind: 'board', id: 'onyx' }];

  // ---- the puzzle pack's marathon never runs dry: once every puzzle has been seen, the same positions come back
  // turned around. variant(p, k): k = 1 the colours swapped, 2 the board mirrored left to right, 3 both (0: p itself).
  // A position with castling rights can't be mirrored (null).
  var FILES = 'abcdefgh';
  function swapCase(ch) { var up = ch.toUpperCase(); return ch === up ? ch.toLowerCase() : up; }
  function turnSquare(s, k) { // 'e4' -> the same square after the turn
    var f = FILES.indexOf(s.charAt(0)), r = +s.charAt(1);
    if (k & 2) f = 7 - f;
    if (k & 1) r = 9 - r;
    return FILES.charAt(f) + r;
  }
  function turnMove(u, k) { return turnSquare(u.slice(0, 2), k) + turnSquare(u.slice(2, 4), k) + u.slice(4); }
  function turnFen(fen, k) {
    var f = fen.split(' '), rows = f[0].split('/');
    if ((k & 2) && f[2] && f[2] !== '-') return null;
    if (k & 2) rows = rows.map(function (r) { return r.split('').reverse().join(''); });
    if (k & 1) rows = rows.reverse().map(function (r) { return r.split('').map(function (ch) { return /[a-z]/i.test(ch) ? swapCase(ch) : ch; }).join(''); });
    var side = f[1], cast = f[2] || '-', ep = f[3] || '-', g = f[6];
    if (k & 1) {
      side = side === 'w' ? 'b' : 'w';
      if (cast !== '-') { var c = cast.split('').map(swapCase).join(''); cast = 'KQkq'.split('').filter(function (x) { return c.indexOf(x) >= 0; }).join('') || '-'; }
      if (g != null) { var gg = g.split('').map(function (ch) { return ch === 'G' ? 'g' : ch === 'g' ? 'G' : ''; }).join(''); g = (gg.indexOf('G') >= 0 ? 'G' : '') + (gg.indexOf('g') >= 0 ? 'g' : '') || '-'; }
    }
    if (ep !== '-') ep = turnSquare(ep, k);
    return [rows.join('/'), side, cast, ep, f[4] || '0', f[5] || '1'].concat(g != null ? [g] : []).join(' ');
  }
  function variant(p, k) {
    k = k & 3;
    if (!k) return p;
    var fen = turnFen(p.fen, k);
    if (!fen) return null;
    var accept = {};
    Object.keys(p.accept).forEach(function (u) { accept[turnMove(u, k)] = p.accept[u].map(function (x) { return turnMove(x, k); }); });
    var out = { id: p.id + '~' + k, of: p.id, lvl: p.lvl, fen: fen, accept: accept, k: p.k };
    if (p.mate) out.mate = p.mate;
    return out;
  }

  // ---- bringing Pro up by ourselves (nobody tapped anything locked). Never during a game or a puzzle (the page sees
  // to that); here, how often: nothing on the first day the device sees Pro on sale, nothing before OFFER_GAMES
  // finished games, at most one offer every OFFER_GAP days, and after OFFER_SKIPS in a row closed without a look at
  // the plans the offers rest for OFFER_REST days. A moment (a streak that has just run out, a new rank) is offered
  // when it happens, the same one not again for OFFER_AGAIN days; with no moment, the plain offer comes at most every
  // OFFER_PLAIN days, where the page allows it.
  // st: { first (the day Pro was first on sale here), last (the day of the last offer), n, skips, rest (the day the
  //       offers come back), seen: { '<moment>': day } }
  var OFFER_GAP = 3, OFFER_PLAIN = 7, OFFER_SKIPS = 3, OFFER_REST = 14, OFFER_GAMES = 3, OFFER_AGAIN = 30;
  var MOMENTS = ['streak', 'rank']; // the first one that has happened and hasn't been offered lately wins
  function dayNum(d) { var x = String(d || '').split('-'); return x.length === 3 ? Math.round(Date.UTC(+x[0], +x[1] - 1, +x[2]) / 864e5) : NaN; }
  function daysFrom(a, b) { var x = dayNum(a), y = dayNum(b); return isFinite(x) && isFinite(y) ? y - x : NaN; } // b - a
  function dayPlus(d, n) { var t = new Date((dayNum(d) + n) * 864e5); return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2); }
  function offerFirst(st, day) { return st && st.first ? st : Object.assign({}, st, { first: day }); }
  // which offer may be made now: a moment's id, 'plain', or null. c: { day, games (finished, in all), moments: [the
  // ones that have just happened], plain (this is a place for the plain offer) }
  function offerDue(st, c) {
    st = st || {};
    if (!st.first || !(daysFrom(st.first, c.day) >= 1)) return null;
    if ((c.games || 0) < OFFER_GAMES) return null;
    if (st.rest && daysFrom(c.day, st.rest) > 0) return null;
    if (st.last && daysFrom(st.last, c.day) < OFFER_GAP) return null;
    var seen = st.seen || {}, ms = c.moments || [];
    for (var i = 0; i < MOMENTS.length; i++) { var m = MOMENTS[i]; if (ms.indexOf(m) >= 0 && !(seen[m] && daysFrom(seen[m], c.day) < OFFER_AGAIN)) return m; }
    if (c.plain && (!st.last || daysFrom(st.last, c.day) >= OFFER_PLAIN)) return 'plain';
    return null;
  }
  function offerShown(st, id, day) {
    var o = Object.assign({}, st, { last: day, n: ((st && st.n) || 0) + 1, seen: Object.assign({}, st && st.seen) });
    if (id !== 'plain') o.seen[id] = day;
    return o;
  }
  // how it ended: 'look' (the player went on to the plans) or 'skip' (closed)
  function offerEnded(st, how, day) {
    var o = Object.assign({}, st);
    if (how === 'look') { o.skips = 0; return o; }
    o.skips = (o.skips || 0) + 1;
    if (o.skips >= OFFER_SKIPS) { o.skips = 0; o.rest = dayPlus(day, OFFER_REST); }
    return o;
  }

  // ---- what a subscription looks like on the prototype page. s: { on, plan, since (ms), until (ms | null for life), trial }
  function start(planId, now) {
    var p = PLANS[planId] || PLANS.year, day = 864e5;
    var until = p.months ? now + (p.trialDays ? p.trialDays * day : p.months * 30.4375 * day) : null;
    return { on: true, plan: p.id, since: now, until: until, trial: !!p.trialDays, founder: p.id === 'founder' };
  }
  function active(s, now) { return !!(s && s.on && (s.until == null || s.until > now)); }

  var TEXT = {
    en: {
      name: 'Joker Pro', mark: 'PRO', founder: 'Founder',
      pitch: 'The game stays free. Pro makes you better, faster.',
      p_coach: 'Joker analysis in every game', pd_coach: 'Where your Joker Move was. Hints against the bots.',
      p_puzzles: 'The Pro puzzle pack', pd_puzzles: 'New puzzles: {n}. And a marathon with no end.',
      p_road: 'The whole Road at once', pd_road: 'All four seasons, and the Joker any time.',
      p_xp: '50% more XP, streak freezes', pd_xp: 'From every game and puzzle. Streaks come back.',
      p_status: 'A gold name, boards of your own', pd_status: 'The Pro mark in games and ratings.',
      plan_year: 'Yearly', plan_month: 'Monthly', plan_founder: 'Founder, for life',
      perYear: '{p} a year', perMonth: '{p} a month', once: '{p} once', onlyMonth: 'only {p} a month',
      save: 'save {n}%', trial: '{n} days free', seats: 'for the first {n} players', seatsLeft: '{n} places left',
      cta_year: 'Try {n} days free', cta_year_paid: 'Get Pro for {p} a year', cta_month: 'Get Pro for {p} a month', cta_founder: 'Become a Founder for {p}',
      then_year: 'Then {p} a year. Cancel any time.', then_year_paid: 'Cancel any time.', then_month: 'Cancel any time.', then_founder: 'One payment. Pro for life and the Founder mark.',
      notNow: 'Not now', protoNote: 'Prototype: no payment is taken.',
      payBy: 'You pay on Stripe’s secure page.', terms: 'Terms',
      testNote: 'Test mode: nothing is charged. Card 4242 4242 4242 4242, any future date, any CVC.',
      saveFirstT: 'Save your account first', saveFirstSub: 'Pro lives on your account, so it works on every device.',
      goPay: 'Opening the payment page…', payCheck: 'Checking the payment…',
      payWait: 'The payment is still on its way. Pro turns on by itself as soon as it arrives.',
      payErr: 'The payment page did not open. Try again.', payOff: 'Joker Pro is not on sale right now.',
      soldOut: 'All Founder places are taken.', alreadyF: 'You are a Founder already.', alreadyPro: 'Joker Pro is already on for this account.',
      why_check: 'Your free Joker analysis is used. With Pro it is in every game.', why_hints: 'Today’s {n} hints are used. Pro has no limit.',
      why_puzzles: 'In the Pro pack, new puzzles: {n}. And a marathon with no end.', why_road: 'Pro opens all four seasons right now.',
      why_streak: 'Pro brings your {n}-day streak back right now.', why_rank: 'With Pro every game and puzzle gives 50% more XP.',
      mineXp: 'With Pro you would have {n} XP more by now.',
      offer_streak_t: 'Your {n}-day streak ran out', offer_streak_s: 'Pro brings it back right now: a freeze covers the days you missed.', offerStreakCta: 'Bring it back with Pro',
      offer_rank_t: 'New rank: {rank}', offer_rank_s: 'With Pro every game and puzzle gives 50% more XP.',
      offer_plain_t: 'Joker Pro', offer_plain_s: 'Joker analysis in every game, the puzzle pack, 50% more XP and a gold name.',
      offerCta: 'See what Pro gives', offerTrial: '{n} days free', bannerClose: 'Hide',
      line_streak: 'Pro brings it back right now', line_rank: 'With Pro, XP comes half as fast again', line_plain: 'Joker analysis, the puzzle pack, +50% XP',
      tile_bonus: 'XP from the Pro bonus', tile_checks: 'Joker analyses', tile_pack: 'pack puzzles solved', tile_freeze: 'streak freezes left',
      statusFree: 'Free', statusPro: 'Pro', statusFounder: 'Founder',
      why_joker: 'Pro players can challenge the Joker any time.', why_xp: 'With Pro this game would have given +{n} XP more.', why_look: 'This look comes with Pro.',
      welcomeT: 'You’re Pro', welcomeSub: 'Your name is gold from now on.', welcomeBtn: 'Play',
      cardSub: 'Joker analysis, the puzzle pack, +50% XP, a gold name', cardBtn: 'Learn more',
      onT: 'Joker Pro is on', on_year: 'Yearly plan', on_month: 'Monthly plan', on_founder: 'Founder, for life', on_trial: 'Free trial', until: 'until {d}', manage: 'Manage',
      manageT: 'Your Joker Pro', turnOff: 'Turn Pro off (prototype)', freezes: 'Streak freezes left this month: {n}', frozenNote: 'A Pro freeze kept your streak. Left this month: {n}.',
      st_trial: 'Free trial until {d}. Then {p} a year.', st_renew: 'Renews on {d}.', st_ends: 'On until {d}. No more payments.',
      st_due: 'The last payment did not go through. Update your card to keep Pro.', st_founder: 'Founder. Pro for life.',
      portal: 'Manage the subscription', receipts: 'Receipts', portalErr: 'The page did not open. Try again.',
      factCheck: 'The Joker analysis in every game', factHints: 'Hints without a limit',
      delSub: 'Cancel your Joker Pro subscription first (Profile, Joker Pro, Manage), then delete the account.',
      jkT: 'Joker analysis', jkAsk: 'Was there a strong Joker Move in this game, where, and what it changed.',
      jkShow: 'Show', jkFree: 'One analysis is free', jkPro: 'Open with Pro', jkUsed: 'Your free analysis is used',
      jkNoneYou: 'You had no strong Joker Move in this game: nothing was missed.', jkNone: 'Nobody had a strong Joker Move in this game.',
      jkNoBetter: 'There was no better moment for it.', jkPlayed: '{san} played', jkMissedBy: 'Missed',
      jkMoveT: '{san}, the Joker Move', jkMoveHidden: 'How good it was, and whether a better moment came, is in the Joker analysis.',
      jkUpsell: 'With Pro, the Joker analysis is in every game.', jkWasFree: 'This was your free analysis.',
      hintsLeft: '{n} of {m} hints left today', hintsNone: 'No hints left today', hintsPro: 'Pro: hints without a limit',
      hint: 'Hint', hintThinking: 'The coach is looking…', hintJoker: 'Coach: your Joker Move, {san}', hintMove: 'Coach: {san}', hintOnline: 'No hints in online games',
      withPro: 'With Pro: +{n} XP more', proBonus: 'Pro bonus +{n} XP',
      seasonPro: 'Open now with Pro', jokerLockedT: 'The Joker waits at the end of the Road', jokerLockedSub: 'Earn {n} stars to reach him, or play him now with Pro. You have {have}.',
      jokerPro: 'Unlock the Joker with Pro', toRoad: 'Go to the Road',
      proQuest: 'Pro quest', proQuestLocked: 'A fourth quest every day with Pro',
      looksH: 'Only with Pro', lookNeed: 'Comes with Pro',
      packLine: 'Pro pack. New puzzles: {n}, and the marathon', packOpen: 'Marathon', packSub: 'puzzles one after another',
      runT: 'Marathon', runCount: '{n} in a row', runBest: 'best {n}', runExit: 'Leave', runSkip: 'Next one',
      insT: 'My Jokers', insSub: 'What your Joker Moves look like so far', insPlayed: 'Joker Moves played', insFav: 'Favourite piece', insKinds: 'Kinds found',
      insBots: 'Against the bots', insBest: 'Best win', insNone: 'Play a few games and your numbers appear here.', insOpen: 'My Jokers', insLocked: 'Your Joker statistics come with Pro',
      insWdl: '{w} won, {d} drawn, {l} lost', insRate: '{n}% won'
    },
    ru: {
      name: 'Joker Pro', mark: 'PRO', founder: 'Основатель',
      pitch: 'Игра остаётся бесплатной. С Pro ты растёшь быстрее.',
      p_coach: 'Разбор джокера в каждой партии', pd_coach: 'Где был твой ход-джокер. Подсказки с ботами.',
      p_puzzles: 'Пак задач Pro', pd_puzzles: 'Новых задач: {n}. И марафон без конца.',
      p_road: 'Вся Дорога сразу', pd_road: 'Все четыре сезона и Джокер в любой момент.',
      p_xp: '+50% опыта и заморозка серии', pd_xp: 'За каждую партию и задачу. Серия не сгорит.',
      p_status: 'Золотое имя и свои доски', pd_status: 'Знак Pro в партиях и рейтинге.',
      plan_year: 'На год', plan_month: 'На месяц', plan_founder: 'Основатель, навсегда',
      perYear: '{p} в год', perMonth: '{p} в месяц', once: '{p} один раз', onlyMonth: 'всего {p} в месяц',
      save: 'выгода {n}%', trial: '{n} дней бесплатно', seats: 'для первых {n} игроков', seatsLeft: 'осталось мест: {n}',
      cta_year: 'Попробовать {n} дней бесплатно', cta_year_paid: 'Оформить Pro за {p} в год', cta_month: 'Оформить Pro за {p} в месяц', cta_founder: 'Стать основателем за {p}',
      then_year: 'Потом {p} в год. Отменить можно в любой момент.', then_year_paid: 'Отменить можно в любой момент.', then_month: 'Отменить можно в любой момент.', then_founder: 'Один платёж. Pro навсегда и знак основателя.',
      notNow: 'Не сейчас', protoNote: 'Прототип: оплата не списывается.',
      payBy: 'Оплата на защищённой странице Stripe.', terms: 'Условия',
      testNote: 'Тестовый режим: деньги не списываются. Карта 4242 4242 4242 4242, любая будущая дата, любой CVC.',
      saveFirstT: 'Сначала сохрани аккаунт', saveFirstSub: 'Pro привязан к аккаунту и работает на всех устройствах.',
      goPay: 'Открываю страницу оплаты…', payCheck: 'Проверяю оплату…',
      payWait: 'Платёж ещё в пути. Pro включится сам, как только он пройдёт.',
      payErr: 'Страница оплаты не открылась. Попробуй ещё раз.', payOff: 'Joker Pro сейчас не продаётся.',
      soldOut: 'Места основателей закончились.', alreadyF: 'Ты уже основатель.', alreadyPro: 'Joker Pro уже включён на этом аккаунте.',
      why_check: 'Бесплатный разбор джокера использован. В Pro он есть в каждой партии.', why_hints: 'Сегодняшние подсказки ({n}) закончились. В Pro лимита нет.',
      why_puzzles: 'В паке Pro новых задач: {n}. И марафон без конца.', why_road: 'Pro открывает все четыре сезона прямо сейчас.',
      why_streak: 'Pro вернёт твою серию ({n} дн.) прямо сейчас.', why_rank: 'С Pro каждая партия и задача дают на 50% больше опыта.',
      mineXp: 'С Pro у тебя было бы уже на {n} XP больше.',
      offer_streak_t: 'Серия {n} дн. сгорела', offer_streak_s: 'Pro вернёт её прямо сейчас: заморозка закроет пропущенные дни.', offerStreakCta: 'Вернуть серию с Pro',
      offer_rank_t: 'Новый ранг: {rank}', offer_rank_s: 'С Pro каждая партия и задача дают на 50% больше опыта.',
      offer_plain_t: 'Joker Pro', offer_plain_s: 'Разбор джокера в каждой партии, пак задач, +50% опыта и золотое имя.',
      offerCta: 'Что даёт Pro', offerTrial: '{n} дней бесплатно', bannerClose: 'Скрыть',
      line_streak: 'Pro вернёт её прямо сейчас', line_rank: 'С Pro опыт идёт в полтора раза быстрее', line_plain: 'Разбор джокера, пак задач, +50% опыта',
      tile_bonus: 'опыта дал бонус Pro', tile_checks: 'разборов джокера', tile_pack: 'задач пака решено', tile_freeze: 'заморозок серии осталось',
      statusFree: 'Free', statusPro: 'Pro', statusFounder: 'Основатель',
      why_joker: 'С Pro можно вызвать Джокера в любой момент.', why_xp: 'С Pro эта партия дала бы ещё +{n} XP.', why_look: 'Это оформление входит в Pro.',
      welcomeT: 'Ты в Pro', welcomeSub: 'С этого момента твоё имя золотое.', welcomeBtn: 'Играть',
      cardSub: 'Разбор джокера, пак задач, +50% опыта, золотое имя', cardBtn: 'Подробнее',
      onT: 'Joker Pro включён', on_year: 'План на год', on_month: 'План на месяц', on_founder: 'Основатель, навсегда', on_trial: 'Пробный период', until: 'до {d}', manage: 'Управлять',
      manageT: 'Твой Joker Pro', turnOff: 'Выключить Pro (прототип)', freezes: 'Заморозок серии в этом месяце: {n}', frozenNote: 'Заморозка Pro сохранила серию. Осталось в этом месяце: {n}.',
      st_trial: 'Пробный период до {d}. Потом {p} в год.', st_renew: 'Продлится {d}.', st_ends: 'Действует до {d}. Списаний больше не будет.',
      st_due: 'Последний платёж не прошёл. Обнови карту, чтобы Pro не отключился.', st_founder: 'Основатель. Pro навсегда.',
      portal: 'Управлять подпиской', receipts: 'Чеки', portalErr: 'Страница не открылась. Попробуй ещё раз.',
      factCheck: 'Разбор джокера в каждой партии', factHints: 'Подсказки без лимита',
      delSub: 'Сначала отмени подписку Joker Pro (Профиль, Joker Pro, Управлять), потом удали аккаунт.',
      jkT: 'Разбор джокера', jkAsk: 'Был ли в этой партии сильный ход-джокер, где и что он менял.',
      jkShow: 'Показать', jkFree: 'Один разбор бесплатно', jkPro: 'Открыть с Pro', jkUsed: 'Бесплатный разбор использован',
      jkNoneYou: 'Сильного хода-джокера у тебя в этой партии не было: ты ничего не упустил.', jkNone: 'Сильного хода-джокера в этой партии не было ни у кого.',
      jkNoBetter: 'Момента лучше для него не было.', jkPlayed: 'сыграно {san}', jkMissedBy: 'Упущено',
      jkMoveT: '{san}, ход-джокер', jkMoveHidden: 'Насколько он был хорош и был ли момент лучше, покажет разбор джокера.',
      jkUpsell: 'В Pro разбор джокера есть в каждой партии.', jkWasFree: 'Это был твой бесплатный разбор.',
      hintsLeft: 'Осталось подсказок сегодня: {n} из {m}', hintsNone: 'Подсказки на сегодня закончились', hintsPro: 'Pro: подсказки без лимита',
      hint: 'Подсказка', hintThinking: 'Тренер смотрит…', hintJoker: 'Тренер: твой ход-джокер, {san}', hintMove: 'Тренер: {san}', hintOnline: 'В онлайн-партиях подсказок нет',
      withPro: 'С Pro: ещё +{n} XP', proBonus: 'Бонус Pro +{n} XP',
      seasonPro: 'Открыть сейчас с Pro', jokerLockedT: 'Джокер ждёт в конце Дороги', jokerLockedSub: 'Набери {n} звёзд, чтобы дойти до него, или сыграй с ним сейчас с Pro. У тебя {have}.',
      jokerPro: 'Открыть Джокера с Pro', toRoad: 'К Дороге',
      proQuest: 'Задание Pro', proQuestLocked: 'Четвёртое задание каждый день с Pro',
      looksH: 'Только с Pro', lookNeed: 'Входит в Pro',
      packLine: 'Пак Pro. Новых задач: {n}, и марафон', packOpen: 'Марафон', packSub: 'задачи одна за другой',
      runT: 'Марафон', runCount: '{n} подряд', runBest: 'рекорд {n}', runExit: 'Выйти', runSkip: 'Следующая',
      insT: 'Мои джокеры', insSub: 'Как выглядят твои ходы-джокеры на сегодня', insPlayed: 'Сыграно ходов-джокеров', insFav: 'Любимая фигура', insKinds: 'Найдено видов',
      insBots: 'Против ботов', insBest: 'Лучшая победа', insNone: 'Сыграй несколько партий, и здесь появятся твои цифры.', insOpen: 'Мои джокеры', insLocked: 'Статистика джокеров входит в Pro',
      insWdl: 'побед {w}, ничьих {d}, поражений {l}', insRate: 'побед {n}%'
    }
  };
  function t(lang, key, vars) {
    var s = (TEXT[lang] || TEXT.en)[key];
    if (s == null) s = TEXT.en[key] != null ? TEXT.en[key] : key;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }

  return { PLANS: PLANS, CHESSCOM_GOLD: CHESSCOM_GOLD, FREE_CHECKS: FREE_CHECKS, FREE_HINTS: FREE_HINTS, XP_BONUS: XP_BONUS, FREEZES: FREEZES, PERKS: PERKS, LOOKS: LOOKS,
    perMonth: perMonth, cheaper: cheaper, yearSaving: yearSaving, price: price, ofProfile: ofProfile, GRACE_MS: GRACE_MS, entitled: entitled,
    checkOpen: checkOpen, checksLeft: checksLeft, useCheck: useCheck, hintState: hintState, hintsLeft: hintsLeft, hintShown: hintShown, useHint: useHint,
    bonusXp: bonusXp, FREEZE_SPAN: FREEZE_SPAN, freezesLeft: freezesLeft, useFreeze: useFreeze, variant: variant, turnFen: turnFen, turnMove: turnMove,
    offerFirst: offerFirst, offerDue: offerDue, offerShown: offerShown, offerEnded: offerEnded, OFFER: { gap: OFFER_GAP, plain: OFFER_PLAIN, skips: OFFER_SKIPS, rest: OFFER_REST, games: OFFER_GAMES, again: OFFER_AGAIN }, MOMENTS: MOMENTS,
    start: start, active: active, TEXT: TEXT, t: t };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Pro;
