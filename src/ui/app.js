/* Golden Chess — game controller and UI.
 * All game state changes go through one synchronous path (applyMove); clocks are derived from
 * performance.now() at the moment of each event, so there is nothing to race against.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var F_GOLDEN = GC.F_GOLDEN, F_CAPTURE = GC.F_CAPTURE, F_CASTLE = GC.F_CASTLE;
  var perf = function () { return performance.now(); };

  // ------------------------------------------------------------------ i18n
  var STR = {
    en: {
      newGame: 'New game', rules: 'Rules', settings: 'Settings', menu: 'Game menu', prev: 'Previous move', next: 'Next move',
      golden: 'Golden move', goldenOnce: 'once per game', goldenPick: 'pick a queen, rook, bishop or knight', goldenTap: 'tap a gold dot',
      goldenOn: 'Golden move on', goldenUsedT: 'Golden move used', goldenUsedOn: '{san} on move {n}', goldenQueued: 'queued as a premove',
      goldenWhiteOnce: 'White: once per game', goldenBlackOnce: 'Black: once per game',
      goldenOnly: 'Only a queen, rook, bishop or knight can make the golden move', goldenGone: 'Your golden move is already used',
      goldenArmedToast: 'Golden move on: pick a piece, then a gold dot', goldenPlayed: '{side} played the golden move {san}',
      you: 'You', bot: 'Golden Bot', white: 'White', black: 'Black', level: 'Level {n}',
      lv1: 'Beginner', lv2: 'Casual', lv3: 'Club player', lv4: 'Strong club', lv5: 'Expert', lv6: 'Master', lv7: 'Grandmaster', lv8: 'Maximum',
      opponent: 'Opponent', computer: 'Computer', twoPlayers: 'Two players, one device', playAs: 'Play as', random: 'Random',
      timeControl: 'Time control', noClock: 'No clock', strength: 'Bot strength', play: 'Play',
      record: 'Your score vs level {n}: {w} won, {d} drawn, {l} lost', recordNone: 'No games vs level {n} yet',
      resign: 'Resign', resignQ: 'Resign this game?', resignSub: 'The game ends and counts as a loss.', cancel: 'Cancel', abort: 'Abort game',
      takeback: 'Take back move', flip: 'Flip board', analyze: 'Analyze with engine', analyzeOff: 'Hide engine analysis', copyPgn: 'Copy PGN', rematch: 'Rematch',
      youWon: 'You won', youLost: 'You lost', draw: 'Draw', whiteWon: 'White won', blackWon: 'Black won',
      r_checkmate: 'by checkmate', r_resign: 'by resignation', r_timeout: 'on time', r_stalemate: 'Stalemate', r_repetition: 'Threefold repetition',
      r_fifty: '50-move rule', r_insufficient: 'Insufficient material', 'r_timeout-insufficient': 'Time ran out, but the opponent has too little material to mate', r_abort: 'Game aborted',
      premoveCancelled: 'Premove cancelled', pgnCopied: 'PGN copied', pgnManual: 'Copy the PGN below',
      movesEmpty: 'Moves appear here. Golden moves are marked with a star.', movesEmptyShort: 'Moves appear here', yourMove: 'Your move', botThinking: 'Golden Bot is thinking', whiteMove: 'White to move', blackMove: 'Black to move',
      best: 'Best', depth: 'depth {n}', mateIn: 'mate in {n}', mated: 'checkmate', noMoves: 'No legal moves', analysisStarting: 'Engine is thinking',
      sound: 'Sound', animation: 'Animation', animFast: 'Fast', animNormal: 'Normal', animOff: 'Off', boardTheme: 'Board', thSlate: 'Slate', thWalnut: 'Walnut', thMarble: 'Marble',
      coords: 'Coordinates', autoQueen: 'Always promote to queen', premoves: 'Premoves', language: 'Language', done: 'Done',
      rulesTitle: 'The golden move', rulesIntro: 'Regular chess, plus one golden move for each player, once per game.',
      rule1: 'Teleport your queen, rook, bishop or knight to any empty square.',
      rule2: 'No capture, and no check: after the golden move the opponent’s king must not be in check.',
      rule3: 'You can use it to block a check from a rook, bishop or queen. Your own king must be safe afterwards.',
      rule4: 'It is your whole move for that turn. Kings and pawns cannot make it.',
      rule5: 'Everything else is standard chess: castling, en passant, promotion. A rook that teleports loses its castling right.',
      howto: 'Tap <b>Golden move</b> (or press G), pick a piece, then tap a gold dot. It also works as a premove.',
      credit: 'Pieces: cburnett set by Colin M. L. Burnett (GPL / BSD). Engine, rules and sounds made for Golden Chess.',
      movesPlayed: 'Moves', goldenBy: 'Golden moves', none: 'none', vsBot: 'vs Golden Bot, level {n}', passPlay: 'Two players', unlimited: 'no clock',
      viewing: 'Viewing move {n}. Tap the board to return to the game.',
      variation: 'Variation', backToGame: 'Back to game', review: 'Game review', analyzeOn: 'Show engine', reviewing: 'Reviewing the game: {i} of {n}',
      accuracy: 'Accuracy', estElo: 'Est. Elo', played: 'played', bestWas: 'best was', c_best: 'Best move', c_excellent: 'Excellent', c_good: 'Good',
      c_inaccuracy: 'Inaccuracy', c_mistake: 'Mistake', c_blunder: 'Blunder', goldenTag: 'golden', tooShort: 'too short to rate',
      reviewHint: 'Tap the graph or step through the moves. You can also move pieces to try your own lines.',
      eloApprox: '\u2248{n} Elo',
      online: 'Online', findOpp: 'Find opponent', invite: 'Invite a friend', searching: 'Looking for an opponent', rated: 'Rated', casual: 'Casual',
      playingAs: 'Playing as', change: 'Change', save: 'Save', nameTaken: 'That name is taken', badName: 'Use 2\u201320 letters, digits, spaces, _ or -',
      inviteSub: 'Send this link to a friend. The game starts when they open it.', copyLink: 'Copy link', linkCopied: 'Link copied', share: 'Share',
      shareText: 'Play Golden Chess with me', waitingFriend: 'Waiting for your friend', connecting: 'Connecting', netError: 'Can\u2019t reach the server. Check your connection and try again.',
      oppMove: 'Opponent\u2019s move', offerDraw: 'Offer draw', drawOffered: 'Draw offered', drawDeclined: 'Draw declined', oppOffersDraw: '{name} offers a draw',
      acceptDraw: 'Accept draw', declineDraw: 'Decline draw', accept: 'Accept', decline: 'Decline', rematchSent: 'Rematch offered', acceptRematch: 'Accept rematch',
      oppWantsRematch: '{name} wants a rematch', newOpponent: 'New opponent', ratingWord: 'Rating', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid',
      ratedLine: 'Rated {pool}', casualLine: 'Casual {pool}', yourRating: 'Your {pool} rating: {r}', firstMove: '{side}: first move within {s} s',
      r_agreement: 'by agreement', gameTaken: 'This game has already started, you are watching it', noGame: 'Game not found',
      stillPlaying: 'Your online game is still running. Starting another game leaves it, and your clock keeps ticking.',
      reconnecting: 'Reconnecting\u2026', connected: 'Online', disconnected: 'Left the game', leaderboard: 'Top players', lbEmpty: 'No rated games yet. Be the first.',
      gamesN: '{n} games', casualNote: 'Casual game: ratings don\u2019t change.'
    },
    ru: {
      newGame: 'Новая партия', rules: 'Правила', settings: 'Настройки', menu: 'Меню партии', prev: 'Предыдущий ход', next: 'Следующий ход',
      golden: 'Золотой ход', goldenOnce: 'один раз за партию', goldenPick: 'выбери ферзя, ладью, слона или коня', goldenTap: 'коснись золотой точки',
      goldenOn: 'Золотой ход включён', goldenUsedT: 'Золотой ход сделан', goldenUsedOn: '{san} на {n}-м ходу', goldenQueued: 'поставлен премувом',
      goldenWhiteOnce: 'Белые: один раз за партию', goldenBlackOnce: 'Чёрные: один раз за партию',
      goldenOnly: 'Золотой ход делают только ферзь, ладья, слон или конь', goldenGone: 'Твой золотой ход уже сделан',
      goldenArmedToast: 'Золотой ход: выбери фигуру, затем золотую точку', goldenPlayed: '{side}: золотой ход {san}',
      you: 'Вы', bot: 'Golden Bot', white: 'Белые', black: 'Чёрные', level: 'Уровень {n}',
      lv1: 'Новичок', lv2: 'Любитель', lv3: 'Клубный игрок', lv4: 'Сильный клубный', lv5: 'Эксперт', lv6: 'Мастер', lv7: 'Гроссмейстер', lv8: 'Максимум',
      opponent: 'Соперник', computer: 'Компьютер', twoPlayers: 'Двое на одном устройстве', playAs: 'Играть за', random: 'Случайно',
      timeControl: 'Контроль времени', noClock: 'Без часов', strength: 'Сила бота', play: 'Играть',
      record: 'Счёт против уровня {n}: побед {w}, ничьих {d}, поражений {l}', recordNone: 'Против уровня {n} ещё не играли',
      resign: 'Сдаться', resignQ: 'Сдать партию?', resignSub: 'Партия закончится поражением.', cancel: 'Отмена', abort: 'Прервать партию',
      takeback: 'Вернуть ход', flip: 'Перевернуть доску', analyze: 'Анализ движком', analyzeOff: 'Скрыть анализ', copyPgn: 'Скопировать PGN', rematch: 'Реванш',
      youWon: 'Вы победили', youLost: 'Вы проиграли', draw: 'Ничья', whiteWon: 'Белые победили', blackWon: 'Чёрные победили',
      r_checkmate: 'матом', r_resign: 'сдачей', r_timeout: 'по времени', r_stalemate: 'Пат', r_repetition: 'Троекратное повторение',
      r_fifty: 'Правило 50 ходов', r_insufficient: 'Недостаточно материала', 'r_timeout-insufficient': 'Время вышло, но у соперника не хватает материала для мата', r_abort: 'Партия прервана',
      premoveCancelled: 'Премув отменён', pgnCopied: 'PGN скопирован', pgnManual: 'Скопируй PGN ниже',
      movesEmpty: 'Здесь будут ходы. Золотые ходы отмечены звездой.', movesEmptyShort: 'Здесь будут ходы', yourMove: 'Ваш ход', botThinking: 'Golden Bot думает', whiteMove: 'Ход белых', blackMove: 'Ход чёрных',
      best: 'Лучший', depth: 'глубина {n}', mateIn: 'мат в {n}', mated: 'мат', noMoves: 'Нет ходов', analysisStarting: 'Движок думает',
      sound: 'Звук', animation: 'Анимация', animFast: 'Быстро', animNormal: 'Обычно', animOff: 'Выкл', boardTheme: 'Доска', thSlate: 'Сланец', thWalnut: 'Орех', thMarble: 'Мрамор',
      coords: 'Координаты', autoQueen: 'Всегда превращать в ферзя', premoves: 'Премувы', language: 'Язык', done: 'Готово',
      rulesTitle: 'Золотой ход', rulesIntro: 'Обычные шахматы, плюс у каждого игрока один золотой ход за партию.',
      rule1: 'Телепортируй ферзя, ладью, слона или коня на любое пустое поле.',
      rule2: 'Без взятия и без шаха: после золотого хода король соперника не должен быть под шахом.',
      rule3: 'Им можно закрыться от шаха ладьи, слона или ферзя. Твой король после хода должен быть в безопасности.',
      rule4: 'Это полноценный ход вместо обычного. Король и пешки так ходить не могут.',
      rule5: 'Остальное — обычные шахматы: рокировка, взятие на проходе, превращение. Ладья после золотого хода теряет право на рокировку.',
      howto: 'Нажми <b>Золотой ход</b> (или G), выбери фигуру и коснись золотой точки. Работает и как премув.',
      credit: 'Фигуры: набор cburnett, Colin M. L. Burnett (GPL / BSD). Движок, правила и звуки сделаны для Golden Chess.',
      movesPlayed: 'Ходов', goldenBy: 'Золотые ходы', none: 'нет', vsBot: 'против Golden Bot, уровень {n}', passPlay: 'Двое игроков', unlimited: 'без часов',
      viewing: 'Просмотр хода {n}. Коснись доски, чтобы вернуться к партии.',
      variation: 'Вариант', backToGame: 'Вернуться к партии', review: 'Разбор партии', analyzeOn: 'Показать движок', reviewing: 'Разбор партии: {i} из {n}',
      accuracy: 'Точность', estElo: 'Оценка Elo', played: 'сыграно', bestWas: 'лучше было', c_best: 'Лучший ход', c_excellent: 'Отлично', c_good: 'Хорошо',
      c_inaccuracy: 'Неточность', c_mistake: 'Ошибка', c_blunder: 'Зевок', goldenTag: 'золотой', tooShort: 'мало ходов для оценки',
      reviewHint: 'Коснись графика или листай ходы. Можно двигать фигуры и пробовать свои варианты.',
      eloApprox: '\u2248{n} Elo',
      online: 'Онлайн', findOpp: 'Найти соперника', invite: 'Пригласить друга', searching: 'Ищем соперника', rated: 'На рейтинг', casual: 'Без рейтинга',
      playingAs: 'Ваше имя:', change: 'Изменить', save: 'Сохранить', nameTaken: 'Это имя занято', badName: 'Нужно 2–20 букв, цифр, пробелов, _ или -',
      inviteSub: 'Отправь ссылку другу. Партия начнётся, когда он её откроет.', copyLink: 'Скопировать', linkCopied: 'Ссылка скопирована', share: 'Поделиться',
      shareText: 'Сыграем в Golden Chess', waitingFriend: 'Ждём друга', connecting: 'Подключение', netError: 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.',
      oppMove: 'Ход соперника', offerDraw: 'Предложить ничью', drawOffered: 'Ничья предложена', drawDeclined: 'Ничью отклонили', oppOffersDraw: '{name} предлагает ничью',
      acceptDraw: 'Согласиться на ничью', declineDraw: 'Отклонить ничью', accept: 'Принять', decline: 'Отклонить', rematchSent: 'Реванш предложен', acceptRematch: 'Принять реванш',
      oppWantsRematch: '{name} хочет реванш', newOpponent: 'Новый соперник', ratingWord: 'Рейтинг', bullet: 'Пуля', blitz: 'Блиц', rapid: 'Рапид',
      ratedLine: '{pool} на рейтинг', casualLine: '{pool} без рейтинга', yourRating: 'Ваш рейтинг ({pool}): {r}', firstMove: '{side}: первый ход — {s} с',
      r_agreement: 'по соглашению', gameTaken: 'Партия уже началась, вы смотрите её как зритель', noGame: 'Партия не найдена',
      stillPlaying: 'Ваша онлайн-партия ещё идёт. Если начать другую, часы в ней продолжат идти.',
      reconnecting: 'Переподключение…', connected: 'В игре', disconnected: 'Вышел из игры', leaderboard: 'Лучшие игроки', lbEmpty: 'Рейтинговых партий ещё нет. Будь первым.',
      gamesN: 'партий: {n}', casualNote: 'Партия без рейтинга: рейтинг не меняется.'
    }
  };
  var settings = Object.assign({ sound: true, anim: 'normal', board: 'slate', coords: true, autoQueen: false, premoves: true, lang: null }, load('settings', {}));
  var lang = settings.lang || (/^ru\b/i.test(navigator.language || '') ? 'ru' : 'en');
  function T(key, vars) {
    var s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }

  // ------------------------------------------------------------------ storage
  function load(key, def) { try { var v = localStorage.getItem('goldenchess.' + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem('goldenchess.' + key, JSON.stringify(val)); } catch (e) { /* private mode */ } }
  var lastSetup = Object.assign({ mode: 'bot', level: 3, color: 'w', tc: '5+0' }, load('setup', {}));
  var stats = load('stats', {});

  var TCS = ['1+0', '3+0', '3+2', '5+0', '10+0', '15+10', 'none'];
  function parseTc(s) {
    if (!s || s === 'none') return null;
    var m = /^(\d+)\+(\d+)$/.exec(s);
    return m ? { base: +m[1] * 60000, inc: +m[2] * 1000, label: s } : null;
  }

  // ------------------------------------------------------------------ game model
  function Game(cfg, startFen) {
    this.cfg = cfg;
    this.startFen = startFen || GC.START_FEN;
    this.pos = new GC.Position(this.startFen);
    this.records = [];
    this.fens = [this.pos.fen()];
    this.rep = {}; this.rep[this.pos.hashKey()] = 1;
    this.clock = cfg.tc ? { t: [cfg.tc.base, cfg.tc.base], since: perf() } : null;
    this.status = 'playing'; this.result = null; this.reason = null;
    this.legal = this.pos.legalMoves(true);
  }
  Game.prototype.running = function () { return !!this.clock && this.status === 'playing' && this.records.length >= 2; };
  Game.prototype.timeLeft = function (color, now) {
    if (!this.clock) return Infinity;
    var t = this.clock.t[color];
    if (this.running() && this.pos.side === color) t -= (now - this.clock.since);
    return t;
  };
  Game.prototype.freeze = function (now) {
    if (this.running()) { var c = this.pos.side; this.clock.t[c] = Math.max(0, this.clock.t[c] - (now - this.clock.since)); this.clock.since = now; }
  };
  Game.prototype.end = function (result, reason, now) {
    if (this.status !== 'playing') return;
    this.freeze(now == null ? perf() : now);
    this.status = 'over'; this.result = result; this.reason = reason;
  };
  Game.prototype.flag = function (color, now) {
    this.freeze(now);
    this.clock.t[color] = 0;
    if (!this.pos.hasMatingMaterial(color ^ 1)) this.end('1/2-1/2', 'timeout-insufficient', now);
    else this.end(color === 0 ? '0-1' : '1-0', 'timeout', now);
  };
  Game.prototype.checkFlag = function (now) {
    if (!this.running() || this.online) return false; // online: the server decides when a flag falls
    var c = this.pos.side;
    if (this.timeLeft(c, now) <= 0) { this.flag(c, now); return true; }
    return false;
  };
  // Apply a legal move. Returns the record, or null if the mover's flag had already fallen.
  Game.prototype.play = function (m, now) {
    if (this.status !== 'playing') return null;
    var us = this.pos.side;
    if (this.running()) {
      var left = this.clock.t[us] - (now - this.clock.since);
      if (left <= 0 && !this.online) { this.flag(us, now); return null; }
      this.clock.t[us] = Math.max(0, left) + this.cfg.tc.inc;
    }
    var moving = this.pos.board[m & 127];
    var san = this.pos.san(m, this.legal);
    this.pos.makeMove(m);
    var rec = {
      m: m, uci: GC.moveToUci(m), san: san, golden: !!(m & F_GOLDEN), color: us, piece: moving,
      capture: !!(m & F_CAPTURE), castle: !!(m & F_CASTLE), promo: GC.mPromo(m), check: this.pos.inCheck(),
      clock: this.clock ? this.clock.t.slice() : null
    };
    this.records.push(rec);
    this.fens.push(this.pos.fen());
    var k = this.pos.hashKey(); this.rep[k] = (this.rep[k] || 0) + 1;
    if (this.clock) this.clock.since = now;
    this.legal = this.pos.legalMoves(true);
    if (!this.legal.length) {
      if (this.pos.inCheck()) this.end(us === 0 ? '1-0' : '0-1', 'checkmate', now);
      else this.end('1/2-1/2', 'stalemate', now);
    } else if (this.rep[k] >= 3) this.end('1/2-1/2', 'repetition', now);
    else if (this.pos.halfmove >= 100) this.end('1/2-1/2', 'fifty', now);
    else if (this.pos.insufficientMaterial()) this.end('1/2-1/2', 'insufficient', now);
    return rec;
  };
  Game.prototype.truncate = function (n, now) {
    var keep = this.records.slice(0, n);
    var g = new Game(this.cfg, this.startFen), t = now;
    for (var i = 0; i < keep.length; i++) { g.play(keep[i].m, t); }
    this.pos = g.pos; this.records = keep; this.fens = g.fens; this.rep = g.rep; this.legal = g.legal;
    this.status = 'playing'; this.result = null; this.reason = null;
    if (this.clock) {
      this.clock.t = n > 0 && keep[n - 1].clock ? keep[n - 1].clock.slice() : [this.cfg.tc.base, this.cfg.tc.base];
      this.clock.since = now;
    }
  };
  Game.prototype.serialize = function () {
    return {
      v: 1, cfg: { mode: this.cfg.mode, level: this.cfg.level, human: this.cfg.human, tc: this.cfg.tc ? this.cfg.tc.label : 'none' },
      startFen: this.startFen, moves: this.records.map(function (r) { return r.uci; }),
      clocks: this.records.map(function (r) { return r.clock; }), clock: this.clock ? this.clock.t.slice() : null,
      status: this.status, result: this.result, reason: this.reason, counted: !!this.counted
    };
  };
  Game.restore = function (d) {
    if (!d || d.v !== 1) return null;
    try {
      var cfg = { mode: d.cfg.mode, level: d.cfg.level, human: d.cfg.human, tc: parseTc(d.cfg.tc) };
      var g = new Game(cfg, d.startFen), now = perf();
      var savedClock = g.clock;
      g.clock = null; // replay without time accounting
      for (var i = 0; i < d.moves.length; i++) {
        var m = g.pos.moveFromUci(d.moves[i]);
        if (!m) break;
        g.play(m, now);
        g.records[i].clock = d.clocks && d.clocks[i] ? d.clocks[i] : null;
      }
      g.clock = savedClock;
      if (g.clock && d.clock) { g.clock.t = d.clock.slice(); g.clock.since = now; }
      if (d.status === 'over') { g.status = 'over'; g.result = d.result; g.reason = d.reason; }
      g.counted = !!d.counted;
      return g;
    } catch (e) { return null; }
  };

  // ------------------------------------------------------------------ engine client (Web Worker, sync fallback)
  function EngineClient() { this.w = null; this.pending = {}; this.busy = false; this.fallback = false; this.spawn(); }
  EngineClient.prototype.spawn = function () {
    var self = this;
    try {
      var url = URL.createObjectURL(new Blob([$('engine-src').textContent], { type: 'text/javascript' }));
      var w = new Worker(url);
      w.onmessage = function (e) {
        var d = e.data, p = self.pending[d.id];
        if (!p) return;
        if (d.type === 'info') { if (p.info) p.info(d.info); return; }
        if (d.type === 'reviewStep') { if (p.step) p.step(d); return; }
        delete self.pending[d.id]; self.busy = Object.keys(self.pending).length > 0;
        p.done(d.res);
      };
      w.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); self.toFallback(); };
      this.w = w;
    } catch (e) { this.fallback = true; }
  };
  EngineClient.prototype.toFallback = function () {
    if (this.fallback) return;
    this.fallback = true;
    try { if (this.w) this.w.terminate(); } catch (e) { /* ignore */ }
    this.w = null;
    var pend = this.pending; this.pending = {}; this.busy = false;
    for (var id in pend) this.runSync(pend[id].req, pend[id].done);
  };
  EngineClient.prototype.runSync = function (req, done) {
    setTimeout(function () {
      var r = Engine.think({ fen: req.fen, moves: req.moves, timeMs: Math.min(req.timeMs || 300, 300), level: req.level, analysis: req.analysis });
      done(r);
    }, 30);
  };
  EngineClient.prototype.think = function (req, done, info) {
    if (this.fallback || !this.w) { this.runSync(req, done); return; }
    this.pending[req.id] = { req: req, done: done, info: info };
    this.busy = true;
    this.w.postMessage(Object.assign({ type: 'think' }, req));
  };
  EngineClient.prototype.review = function (req, step, done) {
    var self = this;
    if (this.fallback || !this.w) {
      // no worker: analyse position by position on the main thread, yielding between positions
      var i = 0, n = req.moves.length;
      (function next() {
        if (self.reviewToken !== req.id) return;
        if (i > n) { done({ done: true }); return; }
        var r = Engine.think({ fen: req.fen, moves: req.moves.slice(0, i), timeMs: Math.min(req.timeMs, 120), analysis: true });
        step({ i: i, score: r.score, mate: r.mate, uci: r.uci, depth: r.depth });
        i++; setTimeout(next, 16);
      })();
      this.reviewToken = req.id;
      return;
    }
    this.pending[req.id] = { req: req, done: done, step: step };
    this.busy = true;
    this.w.postMessage(Object.assign({ type: 'review' }, req));
  };
  EngineClient.prototype.cancel = function () {
    this.reviewToken = 0;
    if (this.busy && this.w) { try { this.w.terminate(); } catch (e) { /* ignore */ } this.w = null; this.pending = {}; this.busy = false; this.spawn(); }
  };
  EngineClient.prototype.clear = function () { if (this.w) this.w.postMessage({ type: 'clear' }); };

  // ------------------------------------------------------------------ state
  var app = $('app'), boardEl = $('board');
  var game = null, view = 0, selected = -1, premoves = [], goldenArmed = false, orient = 0;
  var botReq = null, reqSeq = 0, lowWarned = false, pendingPromo = false, plyBoards = {}, pendingRecapture = null, analysisArrow = null;
  var analysis = { on: false, id: 0, info: null, ply: -1 };
  var bot = new EngineClient(), anaClient = null, revClient = null;
  var explore = null;   // free analysis line after the game: { base, fens[], records[], view }
  var review = null;    // engine review of the finished game
  var posCache = {};
  var currentDialog = null, toastTimer = 0;
  var clockEls = {}, lastClockText = {};

  var board = new BoardView(boardEl, {
    onAny: function () { Sound.unlock(); },
    onDown: onBoardDown, onTap: onBoardTap, onDrop: onBoardDrop, onRight: onBoardRight
  });

  function live() { return !explore && view === game.records.length; }
  function botGame() { return game.cfg.mode === 'bot'; }
  function onlineGame() { return game.cfg.mode === 'online'; }
  function oppGame() { return game.cfg.mode === 'bot' || game.cfg.mode === 'online'; } // one human side vs an opponent
  function spectating() { return onlineGame() && !!game.cfg.spectator; }
  // after the game the board is a free analysis board: either side may move, which starts a variation
  function canMoveNow() {
    if (pendingPromo) return false;
    if (game.status !== 'playing') return true;
    if (spectating()) return false;
    return live() && (!oppGame() || game.pos.side === game.cfg.human);
  }
  function canPremove() { return settings.premoves && game.status === 'playing' && live() && oppGame() && !spectating() && game.pos.side !== game.cfg.human && !pendingPromo; }
  function goldenColor() { if (game.status !== 'playing') return viewPos().side; return oppGame() ? game.cfg.human : game.pos.side; }
  function posFromFen(fen) { var p = posCache[fen]; if (!p) { p = new GC.Position(fen); posCache[fen] = p; } return p; }
  function viewFen() { return explore ? explore.fens[explore.view] : game.fens[view]; }
  function viewPos() { if (!explore && view === game.records.length) return game.pos; return posFromFen(viewFen()); }
  function movePos() { return game.status === 'playing' ? game.pos : viewPos(); }
  function moveLegal() { var p = movePos(); if (p === game.pos) return game.legal; return p._legal || (p._legal = p.legalMoves(true)); }
  function viewMovesUci() {
    var mv = game.records.slice(0, explore ? explore.base : view).map(function (r) { return r.uci; });
    if (explore) mv = mv.concat(explore.records.slice(0, explore.view).map(function (r) { return r.uci; }));
    return mv;
  }
  function goldenQueued() { for (var i = 0; i < premoves.length; i++) if (premoves[i].golden) return true; return false; }
  function goldenCapable(code) { var t = code & 7; return t >= 2 && t <= 5; }

  function boardAtPly(k) {
    if (k === game.records.length) return game.pos.board;
    if (!plyBoards[k]) plyBoards[k] = new GC.Position(game.fens[k]).board;
    return plyBoards[k];
  }
  function applyPseudo(b, pm) {
    var p = b[pm.from];
    if (!p) return;
    var t = p & 7;
    b[pm.from] = 0;
    if (!pm.golden && t === 6 && Math.abs((pm.to & 7) - (pm.from & 7)) === 2) {
      var rf = pm.to > pm.from ? pm.from + 3 : pm.from - 4, rt = pm.to > pm.from ? pm.from + 1 : pm.from - 1;
      if ((b[rf] & 7) === 4) { b[rt] = b[rf]; b[rf] = 0; }
    }
    if (t === 1 && ((pm.to >> 4) === 7 || (pm.to >> 4) === 0)) p = (p & 8) | (pm.promo || 5);
    b[pm.to] = p;
  }
  function displayBoard() {
    if (explore) return posFromFen(explore.fens[explore.view]).board;
    if (!live()) return boardAtPly(view);
    if (!premoves.length) return game.pos.board;
    var b = new Int8Array(game.pos.board);
    premoves.forEach(function (pm) { if (!pm.stay) applyPseudo(b, pm); });
    return b;
  }

  // geometric premove targets (ignores blockers, as on lichess/chess.com)
  function premoveDests(b, sq, golden) {
    var p = b[sq], color = p >> 3, t = p & 7, out = [];
    if (golden) {
      if (!goldenCapable(p)) return out;
      for (var s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (s !== sq && (!b[s] || (b[s] >> 3) !== color)) out.push(s); }
      return out;
    }
    function add(x) { if (!(x & 0x88) && x !== sq) out.push(x); }
    if (t === 1) {
      var fwd = color ? -16 : 16; add(sq + fwd); add(sq + fwd - 1); add(sq + fwd + 1);
      if ((sq >> 4) === (color ? 6 : 1)) add(sq + 2 * fwd);
    } else if (t === 2) GC.KNIGHT_D.forEach(function (d) { add(sq + d); });
    else if (t === 6) {
      GC.KING_D.forEach(function (d) { add(sq + d); });
      var home = color ? 116 : 4;
      if (sq === home) { if (game.pos.castling & (color ? 4 : 1)) add(home + 2); if (game.pos.castling & (color ? 8 : 2)) add(home - 2); }
    } else {
      var dirs = t === 3 ? GC.DIAG_D : t === 4 ? GC.ORTHO_D : GC.KING_D;
      dirs.forEach(function (d) { var x = sq + d; while (!(x & 0x88)) { out.push(x); x += d; } });
    }
    return out;
  }
  function defends(b, from, to) {
    var p = b[from], t = p & 7, color = p >> 3, d = to - from, i;
    if (t === 1) return d === (color ? -15 : 15) || d === (color ? -17 : 17);
    if (t === 2) return GC.KNIGHT_D.indexOf(d) >= 0;
    if (t === 6) return GC.KING_D.indexOf(d) >= 0;
    var dirs = t === 3 ? GC.DIAG_D : t === 4 ? GC.ORTHO_D : GC.KING_D;
    for (i = 0; i < dirs.length; i++) {
      var x = from + dirs[i];
      while (!(x & 0x88)) { if (x === to) return true; if (b[x]) break; x += dirs[i]; }
    }
    return false;
  }
  function legalTargets(sq, golden) {
    var out = [];
    var legal = moveLegal();
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if ((m & 127) === sq && !!(m & F_GOLDEN) === golden) { var to = (m >> 7) & 127; if (out.indexOf(to) < 0) out.push(to); }
    }
    return out;
  }
  function currentDests() {
    if (selected < 0) return [];
    if (canMoveNow()) return legalTargets(selected, goldenArmed);
    if (canPremove()) return premoveDests(displayBoard(), selected, goldenArmed && game.pos.goldenAvailable(game.cfg.human) && !goldenQueued());
    return [];
  }

  // ------------------------------------------------------------------ board input
  function onBoardDown(sq) {
    if (!game) return null;
    if (currentDialog) return null;
    if (game.status === 'playing' && !live()) { gotoPly(game.records.length); return null; }
    var mode = canMoveNow() ? 'move' : canPremove() ? 'pre' : null;
    if (!mode) return null;
    var mp = movePos(), b = mode === 'pre' ? displayBoard() : mp.board;
    var color = mode === 'pre' ? game.cfg.human : mp.side;
    var piece = b[sq], own = piece && (piece >> 3) === color;
    pendingRecapture = null;
    if (selected >= 0 && selected !== sq && !own) {
      if (currentDests().indexOf(sq) >= 0) { tryMove(selected, sq, false); return null; }
    }
    if (own) {
      if (goldenArmed && !goldenCapable(piece)) { toast(T('goldenOnly')); select(-1); return null; }
      // premove onto your own defended piece = recapture if it gets taken (decided on release: a tap queues it, a drag moves the tapped piece)
      if (mode === 'pre' && !goldenArmed && selected >= 0 && selected !== sq && defends(b, selected, sq)) pendingRecapture = { from: selected, to: sq };
      var was = selected === sq;
      select(sq);
      return { drag: true, wasSelected: was, gold: goldenArmed };
    }
    select(-1);
    if (premoves.length) cancelPremoves(false);
    return null;
  }
  function onBoardTap(sq, wasSelected) {
    var pr = pendingRecapture; pendingRecapture = null;
    if (pr && pr.to === sq && canPremove()) { selected = pr.from; if (tryMove(pr.from, pr.to, false)) return; }
    if (wasSelected && selected === sq) select(-1);
  }
  function onBoardDrop(from, to) {
    pendingRecapture = null;
    if (selected !== from) select(from);
    var ok = tryMove(from, to, true);
    if (!ok) select(-1);
    return ok;
  }
  function onBoardRight() {
    if (premoves.length) cancelPremoves(false);
    select(-1);
  }
  function select(sq) {
    selected = sq;
    renderMarks();
    if (sq >= 0) Sound.play('select');
  }

  function tryMove(from, to, viaDrag) {
    if (canMoveNow()) {
      var golden = goldenArmed, cands = [], legal = moveLegal(), mp = movePos();
      for (var i = 0; i < legal.length; i++) {
        var m = legal[i];
        if ((m & 127) === from && ((m >> 7) & 127) === to && !!(m & F_GOLDEN) === golden) cands.push(m);
      }
      if (!cands.length) return false;
      if (cands.length > 1) {
        if (settings.autoQueen) { humanMove(cands.filter(function (c) { return GC.mPromo(c) === 5; })[0], viaDrag); return true; }
        var color = mp.side, tmp = new Int8Array(mp.board), wasOver = game.status !== 'playing';
        tmp[to] = tmp[from]; tmp[from] = 0;
        pendingPromo = true; selected = -1;
        board.sync(tmp, [{ from: from, to: to, instant: viaDrag }]);
        renderMarks();
        board.askPromotion(to, color, function (t) {
          pendingPromo = false;
          var pick = t ? cands.filter(function (c) { return GC.mPromo(c) === t; })[0] : 0;
          var stillOk = wasOver ? game.status !== 'playing' : (game.status === 'playing' && live());
          if (!pick || !stillOk) { board.sync(displayBoard(), []); renderMarks(); return; }
          humanMove(pick, true);
        });
        return true;
      }
      humanMove(cands[0], viaDrag);
      return true;
    }
    if (canPremove()) {
      var b = displayBoard(), p = b[from];
      if (!p || (p >> 3) !== game.cfg.human) return false;
      var g = goldenArmed && game.pos.goldenAvailable(game.cfg.human) && !goldenQueued();
      if (premoveDests(b, from, g).indexOf(to) < 0 || premoves.length >= 12) return false;
      var promo = ((p & 7) === 1 && ((to >> 4) === 7 || (to >> 4) === 0)) ? 5 : 0;
      var stay = !g && !!b[to] && (b[to] >> 3) === game.cfg.human;
      premoves.push({ from: from, to: to, promo: promo, golden: g, stay: stay });
      if (g) setGoldenArmed(false);
      selected = -1;
      board.sync(displayBoard(), [{ from: from, to: to, golden: g, instant: viaDrag, code: p }]);
      renderMarks(); renderControls();
      Sound.play('premove');
      return true;
    }
    return false;
  }

  function humanMove(m, instant) {
    if (game.status !== 'playing') exploreMove(m, instant);
    else commit(m, instant, 'human');
  }
  function makeRecord(pos, m) {
    var legal = pos._legal || (pos._legal = pos.legalMoves(true));
    var rec = { m: m, uci: GC.moveToUci(m), san: pos.san(m, legal), golden: !!(m & F_GOLDEN), color: pos.side, piece: pos.board[m & 127],
      capture: !!(m & F_CAPTURE), castle: !!(m & F_CASTLE), promo: GC.mPromo(m) };
    return rec;
  }
  // a move on the analysis board after the game: starts or extends a variation (never touches the game record)
  function exploreMove(m, instant) {
    var from = viewPos(), rec = makeRecord(from, m), np = new GC.Position(from.fen());
    np.makeMove(m);
    rec.check = np.inCheck();
    if (!explore) explore = { base: view, fens: [game.fens[view]], records: [], view: 0 };
    explore.records = explore.records.slice(0, explore.view); explore.fens = explore.fens.slice(0, explore.view + 1);
    explore.records.push(rec); explore.fens.push(np.fen()); explore.view = explore.records.length;
    if (goldenArmed) setGoldenArmed(false);
    selected = -1;
    board.sync(displayBoard(), hintsFor(rec, instant));
    moveSound(rec);
    renderAll();
    if (analysis.on) requestAnalysis();
  }
  function exitExplore() {
    if (!explore) return;
    view = explore.base; explore = null; selected = -1;
    if (goldenArmed) setGoldenArmed(false);
    board.sync(displayBoard(), []);
    renderAll();
    if (analysis.on) requestAnalysis();
  }
  function navStep(dir) {
    if (!game) return;
    if (explore) {
      var k = explore.view + dir;
      if (k < 0) { exitExplore(); return; }
      if (k > explore.records.length) return;
      var prev = explore.view, rec;
      explore.view = k; selected = -1;
      if (k > prev) { rec = explore.records[prev]; board.sync(displayBoard(), hintsFor(rec, false)); moveSound(rec); }
      else { rec = explore.records[k]; board.sync(displayBoard(), reverseHints(rec)); Sound.play(rec.capture ? 'capture' : 'move', 0.8); }
      renderAll();
      if (analysis.on) requestAnalysis();
      return;
    }
    gotoPly(view + dir);
  }

  function hintsFor(rec, instant) {
    var from = rec.m & 127, to = (rec.m >> 7) & 127;
    var hints = [{ from: from, to: to, golden: rec.golden, instant: instant, code: rec.piece }];
    if (rec.castle) {
      var rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      hints.push({ from: rf, to: rt, instant: instant, code: (rec.piece & 8) | 4 });
    }
    return hints;
  }
  function reverseHints(rec) {
    var from = rec.m & 127, to = (rec.m >> 7) & 127, after = rec.promo ? ((rec.piece & 8) | rec.promo) : rec.piece;
    var hints = [{ from: to, to: from, golden: rec.golden, code: after }];
    if (rec.castle) {
      var rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      hints.push({ from: rt, to: rf, code: (rec.piece & 8) | 4 });
    }
    return hints;
  }

  function commit(m, instant, by) {
    var now = perf(), wasLive = live();
    if (game.checkFlag(now)) { gameOver(); return null; }
    var rec = game.play(m, now);
    if (!rec) { gameOver(); return null; }
    var theirs = by === 'bot' || by === 'opp';
    // the opponent's move keeps your golden mode and selection (you may have armed it while they thought)
    var keepSel = theirs && selected >= 0 && !premoves.length && wasLive;
    if (rec.golden ? rec.color === goldenColor() || !oppGame() : (goldenArmed && !theirs)) setGoldenArmed(false);
    view = game.records.length; plyBoards = {};
    if (!keepSel || !game.pos.board[selected] || (game.pos.board[selected] >> 3) !== game.cfg.human) selected = -1;
    board.sync(displayBoard(), hintsFor(rec, instant));
    moveSound(rec);
    if (rec.golden && (theirs || !oppGame())) toast(T('goldenPlayed', { side: sideLabel(rec.color), san: rec.san }), 'gold');
    if (analysis.on) setAnalysis(false);
    if (onlineGame() && !theirs) sendMove(rec);
    renderAll();
    persist();
    if (game.status !== 'playing') { gameOver(); return rec; }
    if (oppGame()) {
      if (game.pos.side === game.cfg.human) { if (theirs && premoves.length) runPremove(); }
      else if (botGame()) requestBot();
    }
    return rec;
  }
  function runPremove() {
    var pm = premoves.shift();
    var m = game.pos.findMove(pm.from, pm.to, pm.promo || 5, pm.golden);
    if (!m) { premoves.unshift(pm); cancelPremoves(true); return; }
    commit(m, true, 'premove');
  }
  function cancelPremoves(announce) {
    if (!premoves.length) return;
    premoves = [];
    board.sync(displayBoard(), []);
    renderMarks(); renderControls();
    if (announce) { Sound.play('cancel'); toast(T('premoveCancelled')); }
  }
  function moveSound(rec) {
    if (rec.golden) Sound.play('golden');
    else if (rec.check) Sound.play('check');
    else if (rec.promo) Sound.play('promote');
    else if (rec.castle) Sound.play('castle');
    else if (rec.capture) Sound.play('capture');
    else Sound.play('move');
  }

  // ------------------------------------------------------------------ bot
  function requestBot() {
    if (!botGame() || game.status !== 'playing' || game.pos.side === game.cfg.human) return;
    cancelBot();
    var id = ++reqSeq, t0 = perf(), color = game.pos.side, lvl = game.cfg.level;
    var lv = Engine.LEVELS[lvl - 1], budget = lv.time, minDelay;
    if (game.clock) {
      var left = game.timeLeft(color, t0), inc = game.cfg.tc.inc, base = game.cfg.tc.base;
      budget = Math.min(budget, Math.max(40, left / 32 + inc * 0.7));
      if (left < 4000) budget = Math.min(budget, Math.max(15, left / 60));
      minDelay = base <= 60000 ? 60 + Math.random() * 160 : base <= 300000 ? 140 + Math.random() * 380 : 260 + Math.random() * 600;
      if (left < 5000) minDelay = 30;
    } else minDelay = 280 + Math.random() * 520;
    if (game.records.length < 2) minDelay = Math.min(minDelay, 350);
    botReq = { id: id, timer: 0 };
    renderBars(); renderSide();
    bot.think({ id: id, fen: game.startFen, moves: game.records.map(function (r) { return r.uci; }), timeMs: budget, level: lvl }, function (res) {
      if (!botReq || botReq.id !== id) return;
      var wait = Math.max(0, minDelay - (perf() - t0));
      botReq.timer = setTimeout(function () {
        if (!botReq || botReq.id !== id) return;
        botReq = null;
        if (game.status !== 'playing' || game.pos.side === game.cfg.human) return;
        var m = res && res.uci ? game.pos.moveFromUci(res.uci) : 0;
        if (!m) m = game.legal[0];
        if (m) commit(m, false, 'bot');
      }, wait);
    });
  }
  function cancelBot() {
    if (botReq) { clearTimeout(botReq.timer); botReq = null; }
  }

  // ------------------------------------------------------------------ golden button
  function setGoldenArmed(v) {
    goldenArmed = !!v;
    boardEl.classList.toggle('armed', goldenArmed);
    board.markGolden(goldenArmed ? goldenColor() : -1);
    if (goldenArmed && selected >= 0) {
      var b = displayBoard();
      if (!b[selected] || !goldenCapable(b[selected])) selected = -1;
    }
    renderMarks(); renderControls();
  }
  function onGoldenButton() {
    Sound.unlock();
    if (!game) return;
    if (game.status === 'playing' && !live()) gotoPly(game.records.length);
    var c = goldenColor();
    if (goldenArmed) { setGoldenArmed(false); return; }
    if (!movePos().goldenAvailable(c) || (canPremove() && goldenQueued())) { toast(T('goldenGone')); return; }
    if (!canMoveNow() && !canPremove()) return;
    setGoldenArmed(true);
  }

  // ------------------------------------------------------------------ navigation
  function gotoPly(k) {
    if (!game) return;
    if (explore) { var base = explore.base; explore = null; view = base; board.sync(displayBoard(), []); }
    k = Math.max(0, Math.min(game.records.length, k));
    if (k === view) { renderAll(); if (analysis.on) requestAnalysis(); return; }
    var prev = view, hints = [], rec = null;
    view = k;
    if (k !== game.records.length) { selected = -1; board.closePromotion(); }
    if (k === prev + 1) { rec = game.records[prev]; hints = hintsFor(rec, false); }
    else if (k === prev - 1) { rec = game.records[k]; hints = reverseHints(rec); }
    board.sync(displayBoard(), hints);
    if (rec) { if (k > prev) moveSound(rec); else Sound.play(rec.capture ? 'capture' : 'move', 0.8); }
    renderAll();
    if (analysis.on) requestAnalysis();
  }

  // ------------------------------------------------------------------ analysis
  function setAnalysis(on) {
    analysis.on = !!on; analysis.info = null; analysis.id = ++reqSeq;
    $('evalbar').hidden = !analysis.on;
    if (!analysis.on) { if (anaClient) anaClient.cancel(); analysisArrow = null; refreshArrows(); renderAna(); layout(); return; }
    requestAnalysis();
  }
  function requestAnalysis() {
    if (!analysis.on) return;
    if (!anaClient) anaClient = new EngineClient();
    anaClient.cancel();
    var id = analysis.id = ++reqSeq, ply = view;
    analysis.ply = ply; analysis.info = null;
    analysisArrow = null;
    var rv = !explore && review && review.scores[view];
    if (rv) { analysis.info = { score: rv.score, mate: rv.mate, uci: rv.uci, depth: rv.depth, final: true, fromReview: true }; renderAna(); return; }
    refreshArrows(); renderAna();
    var p = viewPos();
    if (!p.hasLegalMove()) { analysis.info = { final: true, score: p.inCheck() ? -30000 : 0, mate: 0, none: true }; renderAna(); return; }
    var req = { id: id, fen: game.startFen, moves: viewMovesUci(), timeMs: 3000, level: 8, analysis: true };
    anaClient.think(req, function (res) { if (analysis.id === id) { res.final = true; analysis.info = res; renderAna(); } },
      function (inf) { if (analysis.id === id) { analysis.info = inf; renderAna(); } });
  }
  function renderAna() {
    var targets = [$('ana'), $('ana-side')], html = '';
    var bar = $('evalbar').firstElementChild;
    if (analysis.on) {
      var inf = analysis.info, p = viewPos();
      if (!inf) html = '<span>' + esc(T('analysisStarting')) + '…</span>';
      else if (inf.none) html = '<span>' + esc(p.inCheck() ? T('mated') : T('noMoves')) + '</span>';
      else {
        var white = p.side === 0 ? 1 : -1, cp = inf.score * white, mate = inf.mate * white;
        var pct = mate ? (mate > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-cp / 360)) - 1);
        bar.style.width = pct.toFixed(1) + '%';
        var evalTxt = mate ? T('mateIn', { n: Math.abs(mate) }) + (mate > 0 ? ' (' + T('white') + ')' : ' (' + T('black') + ')') : (cp >= 0 ? '+' : '−') + (Math.abs(cp) / 100).toFixed(2);
        var m = inf.uci ? p.moveFromUci(inf.uci) : 0, san = m ? p.san(m) : '';
        html = '<span>' + esc(T('best')) + ': <b class="' + (m & F_GOLDEN ? 'gold' : '') + '">' + esc(san) + '</b></span><span><b>' + esc(evalTxt) + '</b></span><span>' + esc(T('depth', { n: inf.depth })) + '</span>';
        analysisArrow = m ? { from: m & 127, to: (m >> 7) & 127, gold: !!(m & F_GOLDEN) } : null;
        refreshArrows();
      }
    } else {
      bar.style.width = '50%';
      if (game && game.online) html = onlineNotice();
    }
    targets.forEach(function (t) { if (t.innerHTML !== html) t.innerHTML = html; });
    renderReview();
    var ah = $('ana').offsetHeight;
    if (ah !== lastAnaH) { lastAnaH = ah; if (!app.classList.contains('wide')) layout(); }
  }
  var lastAnaH = 0;

  // ------------------------------------------------------------------ game review
  function winPct(cp) { cp = Math.max(-1500, Math.min(1500, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function cpOf(e) {
    if (e.mate) return e.mate > 0 ? 10000 - e.mate * 10 : -10000 - e.mate * 10;
    return Math.max(-10000, Math.min(10000, e.score));
  }
  // accuracy (lichess formula) -> rough Elo. Calibrated on bot-vs-bot games reviewed exactly like player games
  // (test/acc_calib.js): mean accuracy 69.3 at ~600 Elo, 80.8 at ~1050, 83.6 at 1350, 86.0 at 1600, 93.2 at 1900, 96.9 at 2250, 98.3 at 2500
  var ELO_CURVE = [[40, 150], [55, 350], [69, 600], [80.8, 1050], [83.6, 1350], [86, 1600], [93.2, 1900], [96.9, 2250], [98.3, 2500], [99.5, 2750]];
  function estimateElo(acc) {
    var c = ELO_CURVE;
    if (acc <= c[0][0]) return c[0][1];
    for (var i = 1; i < c.length; i++) if (acc <= c[i][0]) { var a = c[i - 1], b = c[i]; return Math.round((a[1] + (b[1] - a[1]) * (acc - a[0]) / (b[0] - a[0])) / 10) * 10; }
    return c[c.length - 1][1];
  }
  function startReview() {
    if (!game || !game.records.length) return;
    stopReview();
    if (!revClient) revClient = new EngineClient();
    var id = ++reqSeq, n = game.records.length;
    review = { id: id, n: n, done: 0, scores: [], moves: null, sum: null, running: true };
    if (!analysis.on) { analysis.on = true; $('evalbar').hidden = false; }
    revClient.review({ id: id, fen: game.startFen, moves: game.records.map(function (r) { return r.uci; }), timeMs: 260 },
      function (st) {
        if (!review || review.id !== id) return;
        review.scores[st.i] = { score: st.score, mate: st.mate || 0, uci: st.uci, depth: st.depth };
        review.done = Math.max(review.done, st.i + 1);
        computeReview();
        if (!explore && view === st.i) requestAnalysis(); else { renderReview(); renderMoves(); renderMarks(); }
      },
      function () { if (!review || review.id !== id) return; review.running = false; computeReview(); renderAll(); if (analysis.on) requestAnalysis(); layout(); });
    renderAll(); layout();
  }
  function stopReview() { if (review && review.running && revClient) revClient.cancel(); if (review) review.running = false; }
  function computeReview() {
    var sc = review.scores, recs = game.records, moves = [], acc = [[], []], loss = [[], []], cnt = [{}, {}];
    for (var i = 0; i < recs.length; i++) {
      if (!sc[i] || !sc[i + 1]) continue;
      var c = recs[i].color, before = winPct(cpOf(sc[i])), after = winPct(-cpOf(sc[i + 1])), drop = Math.max(0, before - after);
      var a = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
      var cls = recs[i].uci === sc[i].uci ? 'best' : drop >= 15 ? 'blunder' : drop >= 10 ? 'mistake' : drop >= 5 ? 'inaccuracy' : drop < 2 ? 'excellent' : 'good';
      moves[i] = { cls: cls, drop: drop, acc: a, best: sc[i].uci, golden: recs[i].golden };
      acc[c].push(a); loss[c].push(Math.min(1000, Math.max(0, cpOf(sc[i]) + cpOf(sc[i + 1]))));
      cnt[c][cls] = (cnt[c][cls] || 0) + 1;
    }
    review.moves = moves;
    review.sum = [0, 1].map(function (c) {
      var xs = acc[c];
      if (!xs.length) return null;
      var mean = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length;
      var harm = xs.length / xs.reduce(function (s, v) { return s + 1 / Math.max(5, v); }, 0);
      var accuracy = (mean + harm) / 2;
      return { accuracy: accuracy, acpl: Math.round(loss[c].reduce(function (s, v) { return s + v; }, 0) / xs.length), counts: cnt[c], n: xs.length,
        elo: xs.length >= 8 ? estimateElo(accuracy) : null };
    });
  }
  var CLS_ORDER = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
  function renderReview() {
    var hosts = [$('review'), $('review-side')];
    if (!review || !game) { hosts.forEach(function (h) { h.hidden = true; h.innerHTML = ''; }); return; }
    var n = game.records.length, html = '';
    // progress
    if (review.running) html += '<div class="rv-progress"><span>' + esc(T('reviewing', { i: Math.min(review.done, n + 1), n: n + 1 })) + '</span><i style="width:' + (100 * review.done / (n + 1)).toFixed(1) + '%"></i></div>';
    // graph of White's winning chances
    var pts = [], W = 1000, H = 100;
    for (var i = 0; i <= n; i++) {
      var e = review.scores[i];
      if (!e) continue;
      var side = posFromFen(game.fens[i]).side, wcp = side === 0 ? cpOf(e) : -cpOf(e);
      pts.push([i * W / Math.max(1, n), H - winPct(wcp)]);
    }
    var cur = explore ? explore.base : view, curX = (cur * W / Math.max(1, n)).toFixed(1);
    var path = pts.length ? 'M0,' + H + ' ' + pts.map(function (p) { return 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + H + ' Z' : '';
    var dots = '';
    if (review.moves) review.moves.forEach(function (m, k) {
      if (!m || (m.cls !== 'mistake' && m.cls !== 'blunder' && !m.golden)) return;
      var e2 = review.scores[k + 1]; if (!e2) return;
      var sd = posFromFen(game.fens[k + 1]).side, w2 = sd === 0 ? cpOf(e2) : -cpOf(e2);
      dots += '<i class="gd ' + (m.golden ? 'g-gold' : 'g-' + m.cls) + '" style="left:' + (100 * (k + 1) / Math.max(1, n)).toFixed(2) + '%;top:' + (100 - winPct(w2)).toFixed(1) + '%"></i>';
    });
    html += '<div class="rv-graph" data-n="' + n + '"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + path + '"/><line class="mid" x1="0" y1="50" x2="' + W + '" y2="50"/><line class="cur" x1="' + curX + '" y1="0" x2="' + curX + '" y2="' + H + '"/></svg>' + dots + '</div>';
    // players
    if (review.sum) {
      html += '<div class="rv-players">';
      [0, 1].forEach(function (c) {
        var sm = review.sum[c];
        html += '<div class="rv-p"><span class="rv-name"><i class="pc-ic ' + BoardView.cls((c << 3) | 6) + '"></i>' + esc(sideLabel(c)) + '</span>';
        if (sm) {
          html += '<span class="rv-acc"><b>' + sm.accuracy.toFixed(1) + '%</b></span><span class="rv-elo">' + (sm.elo ? esc(T('eloApprox', { n: sm.elo })) : esc(T('tooShort'))) + '</span><span class="rv-counts">';
          ['inaccuracy', 'mistake', 'blunder'].forEach(function (k) { html += '<span class="cnt s-' + k + '" title="' + esc(T('c_' + k)) + '">' + (sm.counts[k] || 0) + '<em>' + SYM[k] + '</em></span>'; });
          html += '</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    // verdict for the viewed move
    var mvI = explore ? -1 : view - 1, mv = review.moves && review.moves[mvI];
    if (mv) {
      var rec = game.records[mvI], pBefore = posFromFen(game.fens[mvI]), bm = mv.best ? pBefore.moveFromUci(mv.best) : 0;
      var bestSan = bm ? pBefore.san(bm, pBefore._legal || (pBefore._legal = pBefore.legalMoves(true))) : '';
      var no = Math.floor(mvI / 2) + 1 + (rec.color === 0 ? '. ' : '\u2026 ');
      html += '<div class="rv-verdict"><span class="v-move' + (rec.golden ? ' gold' : '') + '">' + esc(no + rec.san) + '</span><span class="v-cls s-' + mv.cls + '">' + esc(T('c_' + mv.cls)) + '</span>' +
        (mv.cls !== 'best' && bestSan ? '<span class="v-best">' + esc(T('bestWas')) + ' <b' + (bm & F_GOLDEN ? ' class="gold"' : '') + '>' + esc(bestSan) + '</b></span>' : '') + '</div>';
    } else if (!review.running && !explore) html += '<div class="rv-hint">' + esc(T('reviewHint')) + '</div>';
    hosts.forEach(function (h) { h.hidden = false; h.innerHTML = html; });
  }
  function onGraphClick(e) {
    var g = e.target.closest('.rv-graph'); if (!g) return;
    var r = g.getBoundingClientRect(), n = +g.dataset.n, k = Math.round((e.clientX - r.left) / r.width * n);
    gotoPly(Math.max(0, Math.min(n, k)));
  }

  // ------------------------------------------------------------------ game flow
  function startGame(setup, opts) {
    opts = opts || {};
    cancelLobby(); leaveOnline();
    cancelBot(); bot.cancel(); bot.clear();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); lowWarned = false; plyBoards = {};
    explore = null; posCache = {}; stopReview(); review = null;
    if (analysis.on) setAnalysis(false);
    var human = setup.color === 'r' ? (Math.random() < 0.5 ? 0 : 1) : setup.color === 'b' ? 1 : 0;
    if (opts.human != null) human = opts.human;
    game = new Game({ mode: setup.mode, level: setup.level, human: human, tc: parseTc(setup.tc) }, opts.fen);
    view = 0;
    setGoldenArmed(false);
    orient = setup.mode === 'bot' ? human : 0;
    board.setOrientation(orient);
    board.sync(game.pos.board, []);
    Sound.play('start');
    renderAll(); persist();
    if (setup.mode === 'bot' && game.pos.side !== human) requestBot();
  }
  function gameOver() {
    cancelBot();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion();
    setGoldenArmed(false);
    board.sync(displayBoard(), []);
    var outcome = humanOutcome();
    if (botGame() && !game.counted && game.reason !== 'abort') {
      game.counted = true;
      var key = 'L' + game.cfg.level, s = stats[key] || { w: 0, d: 0, l: 0 };
      s[outcome === 1 ? 'w' : outcome === 0 ? 'd' : 'l']++;
      stats[key] = s; save('stats', stats);
    }
    Sound.play(outcome === 1 ? 'win' : outcome === 0 ? 'draw' : (oppGame() && !spectating() ? 'lose' : 'win'));
    renderAll(); persist();
    var g = game;
    // the result card, unless the player already opened something else (e.g. looking for the next game)
    setTimeout(function () { if (game === g && game.status === 'over' && !currentDialog) showOver(); }, 450);
  }
  function humanOutcome() {
    if (game.result === '1/2-1/2' || game.reason === 'abort') return 0;
    var whiteWon = game.result === '1-0';
    if (!oppGame() || spectating()) return whiteWon ? 1 : -1;
    return (whiteWon ? 0 : 1) === game.cfg.human ? 1 : -1;
  }
  function resign() {
    if (game.status !== 'playing') return;
    if (onlineGame()) { onlineAction('resign'); return; }
    var c = botGame() ? game.cfg.human : game.pos.side;
    if (game.records.length < 2 && botGame()) { game.end('*', 'abort', perf()); }
    else game.end(c === 0 ? '0-1' : '1-0', 'resign', perf());
    gameOver();
  }
  function takeback() {
    if (!botGame() || game.status !== 'playing') return;
    var h = game.cfg.human, k;
    for (k = game.records.length - 1; k >= 0; k--) if (game.records[k].color === h) break;
    if (k < 0) return;
    cancelBot(); bot.cancel();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion();
    game.truncate(k, perf());
    view = game.records.length; plyBoards = {};
    setGoldenArmed(false);
    board.sync(displayBoard(), []);
    renderAll(); persist();
    if (game.pos.side !== h) requestBot();
  }
  function flip() {
    orient ^= 1; board.setOrientation(orient); renderBars();
  }

  // ------------------------------------------------------------------ rendering
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sideLabel(color) {
    if (onlineGame()) return game.cfg.names[color] || (color === 0 ? T('white') : T('black'));
    if (botGame()) return color === game.cfg.human ? T('you') : T('bot');
    return color === 0 ? T('white') : T('black');
  }
  function renderAll() { renderMarks(); renderBars(); renderMoves(); renderControls(); renderSide(); renderAna(); renderClocks(perf(), true); }

  function renderMarks() {
    if (!game) return;
    var marks = [], dots = [], b = displayBoard(), r = lastRecord();
    if (r) {
      var cl = r.golden ? 'hl-gold' : 'hl-last';
      marks.push({ sq: r.m & 127, cls: cl }, { sq: (r.m >> 7) & 127, cls: cl });
      var mv = !explore && review && review.moves && review.moves[view - 1];
      if (mv && BADGE[mv.cls]) marks.push({ sq: (r.m >> 7) & 127, cls: 'badge bd-' + mv.cls });
    }
    var vp = viewPos(), checkSq = vp.inCheck() ? vp.kings[vp.side] : -1;
    if (checkSq >= 0) marks.push({ sq: checkSq, cls: 'hl-check' });
    premoves.forEach(function (pm) { marks.push({ sq: pm.from, cls: 'hl-pre' }, { sq: pm.to, cls: 'hl-pre' }); });
    if (selected >= 0) {
      marks.push({ sq: selected, cls: 'hl-sel' });
      var dests = currentDests(), gold = goldenArmed;
      dests.forEach(function (d) { dots.push({ sq: d, cls: gold ? 'gdot' : (b[d] ? 'ring' : 'dot') }); });
    }
    board.setMarks(marks); board.setDots(dots);
    refreshArrows();
  }
  function lastRecord() {
    if (explore) return explore.view > 0 ? explore.records[explore.view - 1] : (explore.base > 0 ? game.records[explore.base - 1] : null);
    return view > 0 ? game.records[view - 1] : null;
  }
  var BADGE = { best: 1, inaccuracy: 1, mistake: 1, blunder: 1 };
  function refreshArrows() {
    var list = [];
    if (live()) premoves.forEach(function (pm) { if (pm.stay) list.push({ from: pm.from, to: pm.to, pre: true }); });
    if (analysis.on && analysisArrow) list.push(analysisArrow);
    board.setArrows(list);
  }

  function counts(b) {
    var c = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
    for (var s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (b[s]) c[b[s] >> 3][b[s] & 7]++; }
    return c;
  }
  var START_COUNT = [0, 8, 2, 2, 2, 1, 1], VALUE = [0, 1, 3, 3, 5, 9, 0];
  function renderBars() {
    if (!game) return;
    var bottom = orient === 0 ? 0 : 1;
    renderBar($('bar-bot'), bottom); renderBar($('bar-top'), bottom ^ 1);
  }
  function renderBar(el, color) {
    var b = displayBoard(), c = counts(b), opp = color ^ 1, posV = viewPos();
    var name, sub, extra = '';
    if (onlineGame()) {
      name = game.cfg.names[color] || (color === 0 ? T('white') : T('black'));
      sub = color === 0 ? T('white') : T('black');
      var rt = game.cfg.ratings[color], st = online && online.s, d = st ? (color === 0 ? st.white_diff : st.black_diff) : null;
      if (rt != null) extra += '<span class="rt">' + rt + (d != null ? ' <b class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</b>' : '') + '</span>';
      if (online && !spectating() && color !== game.cfg.human && online.oppHere != null) extra += '<i class="conn' + (online.oppHere ? '' : ' off') + '" title="' + esc(online.oppHere ? T('connected') : T('disconnected')) + '"></i>';
    } else if (botGame()) {
      if (color === game.cfg.human) { name = T('you'); sub = color === 0 ? T('white') : T('black'); }
      else { name = T('bot'); sub = T('level', { n: game.cfg.level }) + ', ' + T('lv' + game.cfg.level); extra = '<span class="rt" title="Elo">' + Engine.LEVELS[game.cfg.level - 1].elo + '</span>'; }
    } else { name = color === 0 ? T('white') : T('black'); sub = ''; }
    var caps = '', diff = 0;
    for (var t = 5; t >= 1; t--) {
      var missing = Math.max(0, START_COUNT[t] - c[opp][t]);
      for (var i = 0; i < missing; i++) caps += '<i class="' + BoardView.cls((opp << 3) | t) + (i === 0 && caps ? ' gap' : '') + '"></i>';
    }
    for (t = 1; t <= 5; t++) diff += (c[color][t] - c[opp][t]) * VALUE[t];
    var thinking = botReq && botGame() && color !== game.cfg.human && game.status === 'playing';
    var gAvail = posV.goldenAvailable(color);
    el.innerHTML =
      '<div class="avatar"><i class="pc-ic ' + BoardView.cls((color << 3) | 6) + '"></i></div>' +
      '<div class="pmeta"><div class="pname"><span class="nm">' + esc(name) + '</span>' + extra +
      '<svg class="gstar' + (gAvail ? '' : ' used') + '" viewBox="0 0 24 24" aria-label="' + esc(T('golden')) + '"><path class="fill" d="M12 2.5c1 6.1 3.4 8.5 9.5 9.5-6.1 1-8.5 3.4-9.5 9.5-1-6.1-3.4-8.5-9.5-9.5 6.1-1 8.5-3.4 9.5-9.5z"/></svg>' +
      (thinking ? '<span class="thinking"><i></i><i></i><i></i></span>' : '') + '</div>' +
      '<div class="psub"><span class="caps">' + caps + '</span>' + (diff > 0 ? '<span class="adv">+' + diff + '</span>' : '') +
      (!caps && diff <= 0 ? '<span>' + esc(sub) + '</span>' : '') + '</div></div>' +
      '<div class="clock" data-color="' + color + '"' + (game.clock ? '' : ' hidden') + '></div>';
    clockEls[color] = el.querySelector('.clock');
    lastClockText[color] = null;
  }
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    if (ms < 20000) { var tenths = Math.floor(ms / 100); return '0:' + (tenths < 100 ? '0' : '') + (tenths / 10).toFixed(1); }
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function renderClocks(now, force) {
    if (!game || !game.clock) return;
    for (var c = 0; c < 2; c++) {
      var el = clockEls[c];
      if (!el) continue;
      var left = game.timeLeft(c, now), txt = fmtClock(left);
      var on = game.status === 'playing' && game.pos.side === c;
      var cls = 'clock' + (on ? ' on' : '') + (left < 10000 && game.cfg.tc.base > 30000 ? ' low' : '') + (left <= 0 ? ' flag' : '');
      var key = txt + '|' + cls;
      if (force || lastClockText[c] !== key) { el.textContent = txt; el.className = cls; lastClockText[c] = key; }
    }
  }

  function renderMoves() {
    var strip = $('strip'), sheet = $('sheet'), recs = game.records;
    if (!recs.length) {
      strip.innerHTML = '<span class="empty">' + esc(T('movesEmptyShort')) + '</span>';
      sheet.innerHTML = '<div class="empty">' + esc(T('movesEmpty')) + '</div>';
      return;
    }
    var sh = '', st = '';
    var startBlack = new GC.Position(game.startFen).side === 1;
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], idx = i + 1, num = Math.floor((i + (startBlack ? 1 : 0)) / 2) + 1, isWhite = r.color === 0;
      var mv = '<button class="mv' + (r.golden ? ' gold' : '') + (view === idx ? ' cur' : '') + '" data-ply="' + idx + '">' + esc(r.san) + '</button>';
      if (isWhite || i === 0) st += '<span class="num">' + num + (isWhite ? '.' : '…') + '</span>';
      st += mv;
      if (isWhite) sh += '<div class="row"><span class="n">' + num + '.</span>' + mv;
      else { if (i === 0) sh += '<div class="row"><span class="n">' + num + '.</span><span></span>'; sh += mv + '</div>'; }
    }
    if (recs[recs.length - 1].color === 0) sh += '<span></span></div>';
    if (explore) {
      var vs = '<span class="var-tag">' + esc(T('variation')) + '</span>', vh = '<div class="var-line"><span class="var-tag">' + esc(T('variation')) + '</span>';
      var bp = posFromFen(explore.fens[0]), mvNo = bp.fullmove, black = bp.side === 1;
      explore.records.forEach(function (r, i) {
        var w = r.color === 0, label = (w ? mvNo + '. ' : (i === 0 ? mvNo + '\u2026 ' : '')) + r.san;
        var b2 = '<button class="mv var' + (r.golden ? ' gold' : '') + (explore.view === i + 1 ? ' cur' : '') + '" data-var="' + (i + 1) + '">' + esc(label) + '</button>';
        vs += b2; vh += b2;
        if (!w) mvNo++;
      });
      vs += '<button class="var-exit" data-exit="1">' + esc(T('backToGame')) + '</button>';
      vh += '<button class="var-exit" data-exit="1">' + esc(T('backToGame')) + '</button></div>';
      st += vs; sh += vh;
    }
    strip.innerHTML = st; sheet.innerHTML = sh;
    if (review && review.moves) {
      [strip, sheet].forEach(function (host) {
        host.querySelectorAll('[data-ply]').forEach(function (el) {
          var mv = review.moves[+el.dataset.ply - 1];
          if (mv && SYM[mv.cls]) { var i = document.createElement('i'); i.className = 'sym s-' + mv.cls; i.textContent = SYM[mv.cls]; el.appendChild(i); }
        });
      });
    }
    var cur = strip.querySelector('.var.cur') || strip.querySelector('.cur');
    if (cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.clientWidth + cur.offsetWidth + 24);
    else strip.scrollLeft = 0;
    var cur2 = sheet.querySelector('.cur');
    if (cur2) { var top = cur2.offsetTop, bh = sheet.clientHeight; if (top < sheet.scrollTop || top > sheet.scrollTop + bh - 40) sheet.scrollTop = top - bh / 2; }
  }

  var SYM = { inaccuracy: '?!', mistake: '?', blunder: '??' };
  function renderControls() {
    if (!game) return;
    var btn = $('btn-golden'), c = goldenColor(), avail = movePos().goldenAvailable(c), t1 = $('g-t1'), t2 = $('g-t2');
    btn.classList.toggle('armed', goldenArmed);
    var usedRec = null;
    for (var i = 0; i < game.records.length; i++) if (game.records[i].golden && game.records[i].color === c) usedRec = { r: game.records[i], n: Math.floor(i / 2) + 1 };
    var queued = goldenQueued();
    btn.classList.toggle('used', !avail && !goldenArmed);
    if (goldenArmed) { t1.textContent = T('goldenOn'); t2.textContent = selected >= 0 ? T('goldenTap') : T('goldenPick'); }
    else if (queued) { t1.textContent = T('golden'); t2.textContent = T('goldenQueued'); }
    else if (!avail && usedRec) { t1.textContent = T('goldenUsedT'); t2.textContent = T('goldenUsedOn', { san: usedRec.r.san, n: usedRec.n }); }
    else if (!avail) { t1.textContent = T('goldenUsedT'); t2.textContent = c === 0 ? T('white') : T('black'); }
    else { t1.textContent = T('golden'); t2.textContent = oppGame() && !spectating() && game.status === 'playing' ? T('goldenOnce') : (c === 0 ? T('goldenWhiteOnce') : T('goldenBlackOnce')); }
    btn.disabled = spectating() && game.status === 'playing';
    $('btn-prev').disabled = !explore && view === 0;
    $('btn-next').disabled = explore ? explore.view === explore.records.length : view === game.records.length;
  }

  function renderSide() {
    if (!game) return;
    $('side-title').textContent = onlineGame() ? T('online') : botGame() ? T('bot') : T('passPlay');
    var tc = game.cfg.tc ? game.cfg.tc.label : T('unlimited'), status;
    if (game.status === 'over') status = resultTitle() + (game.reason && reasonText() ? ', ' + reasonText().toLowerCase() : '') + (explore ? '. ' + T('variation') : '');
    else if (explore) status = T('variation');
    else if (!live()) status = T('viewing', { n: Math.ceil(view / 2) || 1 });
    else if (onlineGame() && !spectating()) status = game.pos.side === game.cfg.human ? T('yourMove') : T('oppMove');
    else if (botGame()) status = game.pos.side === game.cfg.human ? T('yourMove') : T('botThinking');
    else status = game.pos.side === 0 ? T('whiteMove') : T('blackMove');
    var pre = botGame() ? T('level', { n: game.cfg.level }) + ', ' : onlineGame() ? poolLine(game.cfg.pool, game.cfg.rated) + ', ' : '';
    $('side-sub').textContent = pre + tc + '. ' + status;
    var acts = $('side-actions'); acts.innerHTML = '';
    function add(label, fn, cls, disabled) { var b = document.createElement('button'); b.className = 'sbtn' + (cls ? ' ' + cls : ''); b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', fn); acts.appendChild(b); }
    if (game.status === 'playing') {
      if (botGame()) add(T('takeback'), takeback, '', !game.records.some(function (r) { return r.color === game.cfg.human; }));
      if (onlineGame() && !spectating()) {
        var dOff = online && online.s ? online.s.draw_offer : null, mine = game.cfg.human === 0 ? 'w' : 'b';
        // an incoming offer is answered in the notice above these buttons
        if (!dOff || dOff === mine) add(dOff === mine ? T('drawOffered') : T('offerDraw'), function () { onlineAction('draw', { op: 'offer' }); }, '', !!dOff || game.records.length < 2);
      }
      if (!spectating()) add(abortable() ? T('abort') : T('resign'), confirmResign, 'danger');
    } else {
      add(review ? (analysis.on ? T('analyzeOff') : T('analyzeOn')) : T('review'), function () { if (!review) startReview(); else setAnalysis(!analysis.on); renderSide(); });
      if (explore) add(T('backToGame'), exitExplore);
      if (onlineGame() && !spectating()) {
        var rm = rematchState();
        add(rm.label, rematch, rm.hot ? 'hot' : '', rm.disabled);
        add(T('newOpponent'), newOpponent);
      }
    }
    add(T('flip'), flip);
    add(T('copyPgn'), copyPgn);
  }
  function resultTitle() {
    if (game.reason === 'abort') return T('r_abort');
    var o = humanOutcome();
    if (game.result === '1/2-1/2') return T('draw');
    if (!oppGame() || spectating()) return game.result === '1-0' ? T('whiteWon') : T('blackWon');
    return o === 1 ? T('youWon') : T('youLost');
  }
  function reasonText() { return game.reason === 'abort' ? '' : T('r_' + game.reason); }

  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg; el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast' + (kind ? ' ' + kind : ''); }, 2300);
  }

  // ------------------------------------------------------------------ dialogs
  function openDialog(build) {
    closeDialog();
    clearTimeout(toastTimer); $('toast').className = 'toast';
    var veil = document.createElement('div'); veil.className = 'veil';
    var card = document.createElement('div'); card.className = 'sheetdlg'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    veil.appendChild(card);
    veil.addEventListener('pointerdown', function (e) { if (e.target === veil) closeDialog(); });
    $('overlay-root').appendChild(veil);
    currentDialog = veil;
    build(card);
    var f = card.querySelector('button.primary, button');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function closeDialog() { if (currentDialog) { var d = currentDialog; currentDialog = null; d.remove(); if (d.onClose) d.onClose(); } }
  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') el.className = attrs[k]; else if (k === 'onclick') el.addEventListener('click', attrs[k]); else el.setAttribute(k, attrs[k]); }
    if (html != null) el.innerHTML = html;
    return el;
  }
  function seg(options, value, onPick, extraCls) {
    var wrap = h('div', { class: 'seg' + (extraCls ? ' ' + extraCls : '') });
    options.forEach(function (o) {
      var b = h('button', { type: 'button', 'aria-pressed': String(o.v === value), id: 'opt-' + String(o.id || o.v).replace(/[^a-z0-9]/gi, '') });
      b.textContent = o.label;
      b.addEventListener('click', function () { wrap.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); onPick(o.v); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function showNewGame() {
    var s = Object.assign({ otc: '3+2', rated: true }, lastSetup);
    if (s.mode === 'online' && !NETCFG) s.mode = 'bot';
    if (ONLINE_TCS.indexOf(s.otc) < 0) s.otc = '3+2';
    openDialog(function (card) {
      currentDialog.dataset.kind = 'new';
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('newGame'))));
      if (game && game.online && game.status === 'playing' && !spectating()) card.appendChild(h('div', { class: 'dlg-note warn' }, esc(T('stillPlaying'))));
      var f1 = h('div', { class: 'field' }); f1.appendChild(h('div', { class: 'lbl' }, esc(T('opponent'))));
      var botFields = h('div', { class: 'field' });
      var modes = [{ v: 'bot', label: T('computer') }];
      if (NETCFG) modes.push({ v: 'online', label: T('online') });
      modes.push({ v: 'local', label: T('twoPlayers') });
      f1.appendChild(seg(modes, s.mode, function (v) { s.mode = v; sync(); }));
      card.appendChild(f1);
      botFields.appendChild(h('label', { for: 'lvl-range' }, esc(T('strength'))));
      var lvRow = h('div', { class: 'lvl' });
      var range = h('input', { type: 'range', min: '1', max: '8', step: '1', id: 'lvl-range', value: String(s.level) });
      var out = h('output', { for: 'lvl-range', id: 'lvl-out' });
      var rec = h('div', { class: 'record' });
      function upd() {
        out.innerHTML = esc(s.level + '. ' + T('lv' + s.level)) + '<small>' + esc(T('eloApprox', { n: Engine.LEVELS[s.level - 1].elo })) + '</small>';
        var st = stats['L' + s.level];
        rec.textContent = st ? T('record', { n: s.level, w: st.w, d: st.d, l: st.l }) : T('recordNone', { n: s.level });
      }
      range.addEventListener('input', function () { s.level = +range.value; upd(); });
      lvRow.appendChild(range); lvRow.appendChild(out); botFields.appendChild(lvRow); botFields.appendChild(rec); upd();
      card.appendChild(botFields);
      var colorField = h('div', { class: 'field' });
      colorField.appendChild(h('div', { class: 'lbl' }, esc(T('playAs'))));
      colorField.appendChild(seg([{ v: 'w', label: T('white') }, { v: 'r', label: T('random') }, { v: 'b', label: T('black') }], s.color, function (v) { s.color = v; }));
      card.appendChild(colorField);
      var f3 = h('div', { class: 'field' }); f3.appendChild(h('div', { class: 'lbl' }, esc(T('timeControl'))));
      f3.appendChild(seg(TCS.map(function (t) { return { v: t, label: t === 'none' ? T('noClock') : t, id: 'tc' + t }; }), s.tc, function (v) { s.tc = v; }, 'tc'));
      card.appendChild(f3);
      var onF = NETCFG ? onlineFields(s) : null;
      if (onF) card.appendChild(onF);
      var row = h('div', { class: 'row-btns' });
      var go = h('button', { class: 'primary', id: 'btn-play', type: 'button' }, esc(T('play')));
      go.addEventListener('click', function () { lastSetup = s; save('setup', s); closeDialog(); startGame(s); });
      row.appendChild(go);
      var seekB = h('button', { class: 'primary', id: 'btn-seek', type: 'button' }, esc(T('findOpp')));
      seekB.addEventListener('click', function () { lastSetup = s; save('setup', s); startSeek(s.otc, s.rated); });
      var invB = h('button', { class: 'secondary', id: 'btn-invite', type: 'button' }, esc(T('invite')));
      invB.addEventListener('click', function () { lastSetup = s; save('setup', s); startInvite(s.otc, s.rated); });
      if (onF) { row.appendChild(seekB); row.appendChild(invB); }
      card.appendChild(row);
      function sync() {
        var on = s.mode === 'online';
        botFields.hidden = s.mode !== 'bot'; colorField.hidden = s.mode !== 'bot'; f3.hidden = on; go.hidden = on;
        if (onF) { onF.hidden = !on; seekB.hidden = !on; invB.hidden = !on; if (on) onF.activate(); }
      }
      sync();
    });
  }

  function showOver() {
    var o = humanOutcome();
    openDialog(function (card) {
      currentDialog.dataset.kind = 'over';
      card.appendChild(h('div', { class: 'dlg-title' + (o === 1 && !spectating() ? ' win' : '') }, esc(resultTitle())));
      var reason = reasonText();
      if (reason) card.appendChild(h('div', { class: 'dlg-sub' }, esc(reason.charAt(0).toUpperCase() + reason.slice(1))));
      var golds = game.records.map(function (r, i) { return r.golden ? sideLabel(r.color) + ': ' + r.san + ' (' + (Math.floor(i / 2) + 1) + ')' : null; }).filter(Boolean);
      card.appendChild(h('div', { class: 'over-stats' }, '<span>' + esc(T('movesPlayed')) + ': <b>' + Math.ceil(game.records.length / 2) + '</b></span><span>' + esc(T('goldenBy')) + ': <b>' + esc(golds.length ? golds.join(', ') : T('none')) + '</b></span>'));
      var row = h('div', { class: 'row-btns' });
      if (onlineGame()) {
        var st = online && online.s;
        if (st && st.rated && st.white_diff != null) {
          var rl = h('div', { class: 'rating-change' });
          [0, 1].forEach(function (c) {
            if (!spectating() && c !== game.cfg.human) return;
            var before = c === 0 ? st.white_rating : st.black_rating, after = c === 0 ? st.white_after : st.black_after, d = c === 0 ? st.white_diff : st.black_diff;
            if (after == null) after = before + d;
            rl.appendChild(h('div', null, esc(spectating() ? sideLabel(c) : T('ratingWord')) + ': <b>' + before + ' → ' + after + '</b> <span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</span>'));
          });
          card.appendChild(rl);
        } else if (st && !st.rated && st.status === 'over') card.appendChild(h('div', { class: 'dlg-note' }, esc(T('casualNote'))));
        if (!spectating()) {
          var rm = rematchState();
          var rb = h('button', { class: 'primary', type: 'button' }, esc(rm.label)); rb.disabled = rm.disabled;
          rb.addEventListener('click', rematch);
          var no = h('button', { class: 'secondary', type: 'button' }, esc(T('newOpponent')));
          no.addEventListener('click', function () { closeDialog(); newOpponent(); });
          row.appendChild(rb); row.appendChild(no);
        }
        var rv = h('button', { class: 'secondary', type: 'button' }, esc(T('review')));
        rv.addEventListener('click', function () { closeDialog(); startReview(); renderSide(); });
        row.appendChild(rv);
        card.appendChild(row);
        return;
      }
      var again = h('button', { class: 'primary', type: 'button' }, esc(T('rematch')));
      again.addEventListener('click', function () {
        closeDialog();
        var s = { mode: game.cfg.mode, level: game.cfg.level, tc: game.cfg.tc ? game.cfg.tc.label : 'none', color: 'w' };
        startGame(s, { human: botGame() ? game.cfg.human ^ 1 : 0 });
      });
      var anaB = h('button', { class: 'secondary', type: 'button' }, esc(T('review')));
      anaB.addEventListener('click', function () { closeDialog(); startReview(); renderSide(); });
      var nb = h('button', { class: 'secondary', type: 'button' }, esc(T('newGame')));
      nb.addEventListener('click', function () { showNewGame(); });
      row.appendChild(again); row.appendChild(anaB); row.appendChild(nb);
      card.appendChild(row);
    });
  }

  function abortable() { return (botGame() || onlineGame()) && game.records.length < 2; }
  function confirmResign() {
    openDialog(function (card) {
      var abort = abortable();
      card.appendChild(h('div', { class: 'dlg-title' }, esc(abort ? T('abort') : T('resignQ'))));
      if (!abort) card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('resignSub'))));
      var row = h('div', { class: 'row-btns' });
      var y = h('button', { class: 'secondary danger', type: 'button' }, esc(abort ? T('abort') : T('resign')));
      y.addEventListener('click', function () { closeDialog(); resign(); });
      var n = h('button', { class: 'secondary', type: 'button' }, esc(T('cancel')));
      n.addEventListener('click', closeDialog);
      row.appendChild(n); row.appendChild(y); card.appendChild(row);
    });
  }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
    flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v14l-3-3M17 20V6l3 3"/></svg>',
    eng: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19h16"/><path d="M7 15v-4M12 15V6M17 15v-7"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/></svg>'
  };
  function showMenu() {
    openDialog(function (card) {
      var list = h('div', { class: 'menu-list' });
      function item(icon, label, fn, cls, disabled) {
        var b = h('button', { type: 'button', class: cls || '' }, icon + '<span>' + esc(label) + '</span>');
        b.disabled = !!disabled;
        b.addEventListener('click', function () { closeDialog(); fn(); });
        list.appendChild(b);
      }
      if (game.status === 'playing') {
        if (botGame()) item(ICON.back, T('takeback'), takeback, '', !game.records.some(function (r) { return r.color === game.cfg.human; }));
        if (onlineGame() && !spectating()) {
          var dOff = online && online.s ? online.s.draw_offer : null, mine = game.cfg.human === 0 ? 'w' : 'b';
          if (dOff && dOff !== mine) {
            item(ICON.draw, T('acceptDraw'), function () { onlineAction('draw', { op: 'accept' }); });
            item(ICON.x, T('declineDraw'), function () { onlineAction('draw', { op: 'decline' }); });
          } else item(ICON.draw, dOff === mine ? T('drawOffered') : T('offerDraw'), function () { onlineAction('draw', { op: 'offer' }); }, '', !!dOff || game.records.length < 2);
        }
        if (!spectating()) item(ICON.flag, abortable() ? T('abort') : T('resign'), confirmResign, 'danger');
      } else {
        item(ICON.eng, review ? (analysis.on ? T('analyzeOff') : T('analyzeOn')) : T('review'), function () { if (!review) startReview(); else setAnalysis(!analysis.on); renderSide(); });
        if (explore) item(ICON.back, T('backToGame'), exitExplore);
        if (onlineGame() && !spectating()) {
          var rm = rematchState();
          item(ICON.again, rm.label, rematch, '', rm.disabled);
          item(ICON.search, T('newOpponent'), function () { setTimeout(newOpponent, 0); });
        }
      }
      item(ICON.flip, T('flip'), flip);
      item(ICON.copy, T('copyPgn'), copyPgn);
      item(ICON.plus, T('newGame'), function () { setTimeout(showNewGame, 0); });
      card.appendChild(list);
    });
  }

  function showSettings() {
    openDialog(function (card) {
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('settings'))));
      function sw(label, key, onChange, id) {
        var row = h('div', { class: 'toggle-row' }), lab = h('span', { id: id + '-l' }); lab.textContent = label;
        var b = h('button', { class: 'sw', type: 'button', role: 'switch', id: id, 'aria-labelledby': id + '-l', 'aria-checked': String(!!settings[key]) });
        b.addEventListener('click', function () { settings[key] = !settings[key]; b.setAttribute('aria-checked', String(settings[key])); saveSettings(); if (onChange) onChange(); });
        row.appendChild(lab); row.appendChild(b); card.appendChild(row);
      }
      sw(T('sound'), 'sound', function () { Sound.setEnabled(settings.sound); if (settings.sound) { Sound.unlock(); Sound.play('move'); } }, 'set-sound');
      var fa = h('div', { class: 'field' }); fa.appendChild(h('div', { class: 'lbl' }, esc(T('animation'))));
      fa.appendChild(seg([{ v: 'fast', label: T('animFast'), id: 'anfast' }, { v: 'normal', label: T('animNormal'), id: 'annormal' }, { v: 'off', label: T('animOff'), id: 'anoff' }], settings.anim, function (v) { settings.anim = v; applySettings(); saveSettings(); }));
      card.appendChild(fa);
      var fb = h('div', { class: 'field' }); fb.appendChild(h('div', { class: 'lbl' }, esc(T('boardTheme'))));
      fb.appendChild(seg([{ v: 'slate', label: T('thSlate') }, { v: 'walnut', label: T('thWalnut') }, { v: 'marble', label: T('thMarble') }], settings.board, function (v) { settings.board = v; applySettings(); saveSettings(); }));
      card.appendChild(fb);
      sw(T('coords'), 'coords', applySettings, 'set-coords');
      sw(T('premoves'), 'premoves', function () { if (!settings.premoves) cancelPremoves(false); }, 'set-pre');
      sw(T('autoQueen'), 'autoQueen', null, 'set-aq');
      var fl = h('div', { class: 'field' }); fl.appendChild(h('div', { class: 'lbl' }, esc(T('language'))));
      fl.appendChild(seg([{ v: 'en', label: 'English' }, { v: 'ru', label: 'Русский' }], lang, function (v) { lang = settings.lang = v; saveSettings(); applyLang(); showSettings(); }));
      card.appendChild(fl);
      card.appendChild(h('div', { class: 'credit' }, esc(T('credit'))));
      var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
      d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
    });
  }

  function showRules() {
    openDialog(function (card) {
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('rulesTitle'))));
      card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('rulesIntro'))));
      var ol = h('ol', { class: 'rules' });
      ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'].forEach(function (k) { ol.appendChild(h('li', null, '<span>' + esc(T(k)) + '</span>')); });
      card.appendChild(ol);
      card.appendChild(h('div', { class: 'howto' }, T('howto')));
      var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
      d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
    });
  }

  // ------------------------------------------------------------------ PGN
  function pgnText() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var names = onlineGame() ? game.cfg.names.slice() :
      [botGame() ? (game.cfg.human === 0 ? 'You' : 'Golden Bot L' + game.cfg.level) : 'White', botGame() ? (game.cfg.human === 1 ? 'You' : 'Golden Bot L' + game.cfg.level) : 'Black'];
    var res = game.status === 'over' && game.result !== '*' ? game.result : '*';
    var event = onlineGame() ? (game.cfg.rated ? 'Rated ' : 'Casual ') + game.cfg.pool + ' game' : 'Golden Chess';
    var site = onlineGame() && online ? location.origin + location.pathname + '?game=' + online.id : 'Golden Chess';
    var tags = [['Event', event], ['Site', site], ['Date', d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())],
      ['White', names[0]], ['Black', names[1]], ['Result', res], ['Variant', 'Golden'], ['TimeControl', game.cfg.tc ? (game.cfg.tc.base / 1000) + '+' + (game.cfg.tc.inc / 1000) : '-']];
    if (onlineGame() && game.cfg.ratings[0] != null) tags.push(['WhiteElo', String(game.cfg.ratings[0])], ['BlackElo', String(game.cfg.ratings[1])]);
    if (botGame()) tags.push([game.cfg.human === 0 ? 'BlackElo' : 'WhiteElo', String(Engine.LEVELS[game.cfg.level - 1].elo)]);
    if (game.startFen !== GC.START_FEN) tags.push(['FEN', game.startFen]);
    var out = tags.map(function (t) { return '[' + t[0] + ' "' + t[1] + '"]'; }).join('\n') + '\n\n';
    var line = '', words = [];
    game.records.forEach(function (r, i) { if (r.color === 0) words.push((Math.floor(i / 2) + 1) + '.'); else if (i === 0) words.push('1...'); words.push(r.san); });
    words.push(res);
    words.forEach(function (w) { if ((line + ' ' + w).length > 79) { out += line + '\n'; line = w; } else line = line ? line + ' ' + w : w; });
    return out + line + '\n';
  }
  function copyPgn() {
    var text = pgnText();
    function manual() {
      openDialog(function (card) {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('pgnManual'))));
        var ta = h('textarea', { class: 'pgnbox', id: 'pgn-text', readonly: 'readonly', rows: '8' }); ta.value = text; card.appendChild(ta);
        var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
        d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
        setTimeout(function () { ta.focus(); ta.select(); }, 30);
      });
    }
    try {
      navigator.clipboard.writeText(text).then(function () { toast(T('pgnCopied')); }, manual);
    } catch (e) { manual(); }
  }

  // ------------------------------------------------------------------ settings, layout, persistence
  function saveSettings() { save('settings', settings); }
  function applySettings() {
    app.dataset.board = settings.board;
    board.speed = settings.anim === 'off' ? 0 : settings.anim === 'fast' ? 0.6 : 1;
    board.setCoords(settings.coords);
    Sound.setEnabled(settings.sound);
  }
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', T(el.dataset.i18nAria)); });
    if (game) renderAll();
  }
  function layout() {
    var cs = getComputedStyle(app), padL = parseFloat(cs.paddingLeft) || 16, padR = parseFloat(cs.paddingRight) || 16;
    var W = app.clientWidth - padL - padR, H = app.clientHeight - (parseFloat(cs.paddingBottom) || 0);
    var wide = app.clientWidth >= 860 && app.clientWidth > app.clientHeight * 1.05;
    app.classList.toggle('wide', wide);
    var rs = getComputedStyle(document.documentElement), px = function (n, d) { return parseFloat(rs.getPropertyValue(n)) || d; };
    var topH = px('--top-h', 52), barH = px('--bar-h', 48), ctlH = px('--ctl-h', 56), stripH = px('--strip-h', 34), gap = 6, size;
    if (wide) size = Math.min(W - 340 - 22, H - topH - 2 * barH - ctlH - 4 * gap - 12);
    else {
      var rv = $('review'), extra = rv && !rv.hidden ? rv.offsetHeight + gap : 0;
      var an = $('ana'); if (an && an.offsetHeight > 18) extra += an.offsetHeight - 18;
      size = Math.min(W, H - topH - 2 * barH - ctlH - stripH - 18 - 6 * gap - extra);
    }
    size = Math.max(200, Math.floor(size / 8) * 8);
    app.style.setProperty('--bs', size + 'px');
  }
  function persist() { if (game && !game.online) save('game', game.serialize()); }

  // ------------------------------------------------------------------ main loop (clock + flag)
  function tick() {
    if (game && game.status === 'playing') {
      var now = perf();
      if (game.checkFlag(now)) { gameOver(); return; }
      renderClocks(now);
      if (game.clock && game.cfg.tc.base > 30000 && !spectating()) {
        var mine = oppGame() ? game.cfg.human : game.pos.side, left = game.timeLeft(mine, now);
        if (left < 10000 && game.pos.side === mine && game.running() && !lowWarned) { lowWarned = true; Sound.play('lowtime'); }
      }
      if (game.online) onlineTick(now);
    }
  }
  function loop() { tick(); requestAnimationFrame(loop); }

  // ------------------------------------------------------------------ wiring
  $('btn-golden').addEventListener('click', onGoldenButton);
  $('btn-prev').addEventListener('click', function () { navStep(-1); });
  $('btn-next').addEventListener('click', function () { navStep(1); });
  $('btn-menu').addEventListener('click', showMenu);
  $('btn-new').addEventListener('click', showNewGame);
  $('btn-settings').addEventListener('click', showSettings);
  $('btn-rules').addEventListener('click', showRules);
  function onMoveClick(e) {
    var x = e.target.closest('[data-exit]'); if (x) { exitExplore(); return; }
    var v = e.target.closest('[data-var]');
    if (v && explore) { var k = +v.dataset.var; if (k !== explore.view) { explore.view = k; selected = -1; board.sync(displayBoard(), []); renderAll(); if (analysis.on) requestAnalysis(); } return; }
    var b = e.target.closest('[data-ply]'); if (b) gotoPly(+b.dataset.ply);
  }
  $('strip').addEventListener('click', onMoveClick);
  $('sheet').addEventListener('click', onMoveClick);
  $('review').addEventListener('click', onGraphClick);
  $('review-side').addEventListener('click', onGraphClick);
  function onNoticeClick(e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'draw-accept') onlineAction('draw', { op: 'accept' });
    else if (a === 'draw-decline') onlineAction('draw', { op: 'decline' });
    else if (a === 'rematch') rematch();
  }
  $('ana').addEventListener('click', onNoticeClick);
  $('ana-side').addEventListener('click', onNoticeClick);
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') {
      if (currentDialog) { closeDialog(); return; }
      if (goldenArmed) setGoldenArmed(false);
      else if (premoves.length) cancelPremoves(false);
      select(-1); return;
    }
    if (currentDialog || !game) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); navStep(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navStep(1); }
    else if (e.key === 'Home') gotoPly(0);
    else if (e.key === 'End') gotoPly(game.records.length);
    else if (e.key === 'f' || e.key === 'F') flip();
    else if (e.key === 'g' || e.key === 'G') onGoldenButton();
  });
  document.addEventListener('pointerdown', function () { Sound.unlock(); }, { capture: true, passive: true });
  window.addEventListener('resize', layout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  setInterval(function () { if (document.hidden) tick(); }, 250);

  // ------------------------------------------------------------------ online play
  // The server owns legality, clocks and results. Own moves are shown at once and confirmed by the
  // server; the opponent's moves arrive as full game states (broadcast, with polling as a fallback).
  var NETCFG = window.GC_ONLINE || null;
  var ONLINE_TCS = ['1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'];
  var FIRST_MOVE_MS = 30000, CLAIM_GRACE = 300, PEER_TTL = 4000;
  var net = null, netReady = null, me = null, userSub = null;
  var online = null;   // the open online game: { id, s, color, pending, sub, connected, lastEvent, oppHere, ... }
  var lobby = null;    // seeking or inviting: { kind, tc, rated, t0, timer, tick, gameId, sub }
  var clockOffset = 0, bestRtt = Infinity;
  var urlQ = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var profileSuffix = String(urlQ.get('p') || '').replace(/[^a-z0-9]/gi, '').slice(0, 8);

  function poolOfMs(base, inc) { var s = base / 1000 + 40 * inc / 1000; return s < 180 ? 'bullet' : s < 480 ? 'blitz' : 'rapid'; }
  function poolOfLabel(label) { var t = parseTc(label); return t ? poolOfMs(t.base, t.inc) : 'blitz'; }
  function poolLine(pool, rated) { var p = T(pool); return T(rated ? 'ratedLine' : 'casualLine', { pool: lang === 'en' ? p.toLowerCase() : p }); }
  function serverNow() { return Date.now() + clockOffset; }
  function noteTime(srv, t0, t1) {
    if (!(srv > 0)) return;
    var rtt = t1 - t0;
    bestRtt += 25; // old samples age out
    if (rtt <= bestRtt) { bestRtt = rtt; clockOffset = srv + rtt / 2 - t1; }
  }
  // A CORS "simple" request (text/plain body, no custom headers; the token travels in the body), so the
  // browser never waits for a preflight round trip before a move.
  function postJson(url, body) {
    var t0 = Date.now();
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        noteTime(j && (j.now || (j.game && j.game.now)), t0, Date.now());
        if (!r.ok || (j && j.error)) { var e = new Error((j && j.error) || 'http_' + r.status); e.data = j; e.status = r.status; throw e; }
        return j;
      });
    });
  }

  // transport: Supabase (production) ...
  function SupaNet(cfg) {
    var self = this;
    this.cfg = cfg; this.uid = null; this.token = null;
    this.sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { storageKey: 'goldenchess.auth' + profileSuffix, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    this.sb.auth.onAuthStateChange(function (ev, session) {
      if (!session) return;
      self.token = session.access_token; self.uid = session.user.id;
      try { self.sb.realtime.setAuth(session.access_token); } catch (e) { /* ignore */ }
    });
  }
  SupaNet.hasSession = function () { try { return !!localStorage.getItem('goldenchess.auth' + profileSuffix); } catch (e) { return false; } };
  SupaNet.prototype.ready = function () {
    var self = this, sb = this.sb;
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (s) return s;
      return sb.auth.signInAnonymously().then(function (r2) { if (r2.error) throw r2.error; return r2.data.session; });
    }).then(function (s) { self.uid = s.user.id; self.token = s.access_token; return sb.realtime.setAuth(s.access_token); });
  };
  SupaNet.prototype.call = function (action, body) {
    var self = this;
    return this.sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session ? r.data.session.access_token : self.token;
      // run next to the database (without this the call lands in the region nearest the player)
      return postJson(self.cfg.url + '/functions/v1/' + (self.cfg.fn || 'play') + '?forceFunctionRegion=' + encodeURIComponent(self.cfg.region || 'eu-central-1'),
        Object.assign({ action: action, token: tok }, body || {}));
    });
  };
  SupaNet.prototype.read = function (id) {
    return this.sb.from('games').select('*').eq('id', id).maybeSingle().then(function (r) { if (r.error) throw r.error; return r.data; });
  };
  SupaNet.prototype.sub = function (topic, h) {
    var sb = this.sb, ch = sb.channel(topic, { config: { private: true, presence: { key: this.uid || 'x' }, broadcast: { self: false } } });
    ['state', 'paired', 'move'].forEach(function (ev) { ch.on('broadcast', { event: ev }, function (m) { if (h.event) h.event(ev, m.payload); }); });
    if (h.presence) ch.on('presence', { event: 'sync' }, function () { h.presence(Object.keys(ch.presenceState())); });
    ch.subscribe(function (status) {
      if (status === 'SUBSCRIBED' && h.presence) { try { ch.track({ at: Date.now() }); } catch (e) { /* ignore */ } }
      if (h.status) h.status(status);
    });
    return {
      close: function () { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } },
      // fire-and-forget; only players of the game may send on its "m:" topic (database policy)
      send: function (ev, payload) { try { var p = ch.send({ type: 'broadcast', event: ev, payload: payload }); if (p && p.catch) p.catch(function () { /* ignore */ }); } catch (e) { /* ignore */ } }
    };
  };
  // ... or the local test server (same API, Server-Sent Events instead of Realtime)
  function MockNet(cfg) {
    var key = 'goldenchess.mockuid' + profileSuffix, uid = null;
    try { uid = localStorage.getItem(key); } catch (e) { /* ignore */ }
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(key, uid); } catch (e) { /* ignore */ } }
    this.base = cfg.mock; this.uid = uid;
  }
  MockNet.hasSession = function () { try { return !!localStorage.getItem('goldenchess.mockuid' + profileSuffix); } catch (e) { return false; } };
  MockNet.prototype.ready = function () { return Promise.resolve(); };
  MockNet.prototype.call = function (action, body) { return postJson(this.base + '/play', Object.assign({ action: action, token: this.uid }, body || {})); };
  MockNet.prototype.read = function (id) { return this.call('game', { game: id }).then(function (r) { return r.game; }); };
  MockNet.prototype.sub = function (topic, h) {
    var base = this.base, uid = this.uid;
    var es = new EventSource(base + '/events?topic=' + encodeURIComponent(topic) + '&uid=' + encodeURIComponent(uid));
    es.onopen = function () { if (h.status) h.status('SUBSCRIBED'); };
    es.onerror = function () { if (h.status) h.status('CHANNEL_ERROR'); };
    es.onmessage = function (e) { var d = JSON.parse(e.data); if (d.event === 'presence') { if (h.presence) h.presence(d.payload); } else if (h.event) h.event(d.event, d.payload); };
    return {
      close: function () { es.close(); },
      send: function (ev, payload) {
        fetch(base + '/peer', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ topic: topic, event: ev, payload: payload, token: uid }) }).catch(function () { /* ignore */ });
      }
    };
  };

  function hasNetSession() { return NETCFG ? (NETCFG.mock != null ? MockNet : SupaNet).hasSession() : false; }
  function ensureNet() {
    if (!NETCFG) return Promise.reject(new Error('offline'));
    if (netReady) return netReady;
    try { if (!net) net = NETCFG.mock != null ? new MockNet(NETCFG) : new SupaNet(NETCFG); } catch (e) { return Promise.reject(e); }
    netReady = net.ready().then(function () { return net.call('hello'); }).then(function (r) {
      me = { uid: net.uid, profile: r.profile, ratings: {} };
      (r.ratings || []).forEach(function (x) { me.ratings[x.pool] = x; });
      if (!userSub) userSub = net.sub('u:' + net.uid, { event: function (ev, p) { if (ev === 'paired' && p && p.game && lobby) onPaired(p.game); } });
      return r;
    });
    netReady.catch(function () { netReady = null; });
    return netReady;
  }
  function refreshMe() {
    if (!net || !me) return;
    net.call('hello').then(function (r) { me.profile = r.profile; me.ratings = {}; (r.ratings || []).forEach(function (x) { me.ratings[x.pool] = x; }); }, function () { /* ignore */ });
  }
  function setUrl(key, val) {
    try {
      var u = new URL(location.href);
      u.searchParams.delete('join'); u.searchParams.delete('game');
      if (key) u.searchParams.set(key, val);
      history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
    } catch (e) { /* ignore */ }
  }
  function inviteLink(id) { return location.origin + location.pathname + '?join=' + id; }

  // ---- lobby: seek a rated/casual opponent, or invite a friend by link
  function stopLobby() {
    if (!lobby) return;
    clearTimeout(lobby.timer); clearInterval(lobby.tick);
    if (lobby.sub) lobby.sub.close();
    lobby = null;
  }
  function cancelLobby() {
    var L = lobby; stopLobby();
    if (!L || !net) return;
    if (L.kind === 'seek') net.call('cancel').catch(function () { /* ignore */ });
    if (L.kind === 'invite' && L.gameId) net.call('resign', { game: L.gameId }).catch(function () { /* ignore */ });
  }
  function onPaired(id) { stopLobby(); if (currentDialog && currentDialog.dataset.kind === 'lobby') closeDialog(); openOnlineGame(id); }
  function startSeek(tc, rated) {
    stopLobby();
    var L = lobby = { kind: 'seek', tc: tc, rated: rated, t0: perf(), timer: 0, tick: 0 };
    showLobbyDialog();
    ensureNet().then(function () { seekTick(L); }, function () { if (lobby === L) { stopLobby(); closeDialog(); toast(T('netError')); } });
  }
  function seekTick(L) {
    if (lobby !== L) return;
    net.call('seek', { tc: L.tc, rated: L.rated }).then(function (r) {
      if (r.game) { if (lobby === L || (online && online.id === r.game.id) || !online) onPaired(r.game.id); return; }
      if (lobby === L) L.timer = setTimeout(function () { seekTick(L); }, 3000);
    }, function () { if (lobby === L) L.timer = setTimeout(function () { seekTick(L); }, 5000); });
  }
  function newOpponent() {
    var tc = game && game.cfg.tc ? game.cfg.tc.label : (lastSetup.otc || '3+2');
    if (ONLINE_TCS.indexOf(tc) < 0) tc = '3+2';
    startSeek(tc, game && game.online ? !!game.cfg.rated : lastSetup.rated !== false);
  }
  function startInvite(tc, rated) {
    stopLobby();
    var L = lobby = { kind: 'invite', tc: tc, rated: rated, t0: perf(), timer: 0, tick: 0, gameId: null };
    showLobbyDialog();
    ensureNet().then(function () { return net.call('challenge', { tc: tc, rated: rated, color: 'r' }); }).then(function (r) {
      if (lobby !== L) { net.call('resign', { game: r.game.id }).catch(function () { /* ignore */ }); return; }
      watchInvite(L, r.game.id);
    }, function () { if (lobby === L) { stopLobby(); closeDialog(); toast(T('netError')); } });
  }
  function watchInvite(L, id) {
    L.gameId = id;
    L.sub = net.sub('g:' + id, { event: function (ev, s) { if (ev === 'state' && s && s.status === 'playing' && lobby === L) onPaired(id); } });
    (function poll() {
      if (lobby !== L) return;
      net.read(id).then(function (g) {
        if (lobby !== L) return;
        if (g && g.status === 'playing') onPaired(id);
        else if (!g || g.status !== 'waiting') { stopLobby(); closeDialog(); }
        else L.timer = setTimeout(poll, 4000);
      }, function () { if (lobby === L) L.timer = setTimeout(poll, 6000); });
    })();
    if (L.render) L.render();
  }
  function copyText(text, okMsg, inputEl) {
    function fallback() { if (inputEl) { try { inputEl.focus(); inputEl.select(); } catch (e) { /* ignore */ } } }
    try { navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); } catch (e) { fallback(); }
  }
  function showLobbyDialog() {
    var L = lobby;
    openDialog(function (card) {
      currentDialog.dataset.kind = 'lobby';
      currentDialog.onClose = function () { if (lobby === L) cancelLobby(); };
      var meta = L.tc + ', ' + (L.rated ? T('rated') : T('casual')).toLowerCase();
      if (L.kind === 'seek') {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('searching'))));
        var sub = h('div', { class: 'dlg-sub', id: 'seek-sub' }); card.appendChild(sub);
        card.appendChild(h('div', { class: 'seekbar' }, '<i></i>'));
        var upd = function () { if (lobby !== L) return; var sec = Math.floor((perf() - L.t0) / 1000); sub.textContent = meta + ', ' + Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); };
        upd(); L.tick = setInterval(upd, 1000);
      } else {
        card.appendChild(h('div', { class: 'dlg-title' }, esc(T('invite'))));
        card.appendChild(h('div', { class: 'dlg-sub' }, esc(T('inviteSub'))));
        var box = h('div', { class: 'linkbox' });
        var inp = h('input', { type: 'text', readonly: 'readonly', id: 'invite-link', 'aria-label': T('invite') });
        var cp = h('button', { type: 'button', class: 'sbtn', id: 'btn-copy-link' }, esc(T('copyLink')));
        cp.addEventListener('click', function () { copyText(inp.value, T('linkCopied'), inp); });
        box.appendChild(inp); box.appendChild(cp);
        if (navigator.share) {
          var sh = h('button', { type: 'button', class: 'sbtn' }, esc(T('share')));
          sh.addEventListener('click', function () { try { navigator.share({ title: 'Golden Chess', text: T('shareText'), url: inp.value }).catch(function () { /* ignore */ }); } catch (e) { /* ignore */ } });
          box.appendChild(sh);
        }
        card.appendChild(box);
        card.appendChild(h('div', { class: 'record' }, esc(meta + '. ' + T('waitingFriend') + '…')));
        L.render = function () { inp.value = L.gameId ? inviteLink(L.gameId) : T('connecting') + '…'; cp.disabled = !L.gameId; };
        L.render();
      }
      var row = h('div', { class: 'row-btns' }), c = h('button', { class: 'secondary', type: 'button', id: 'btn-cancel-lobby' }, esc(T('cancel')));
      c.addEventListener('click', function () { closeDialog(); });
      row.appendChild(c); card.appendChild(row);
    });
  }
  function showLeaderboard(pool) {
    openDialog(function (card) {
      card.appendChild(h('div', { class: 'dlg-title' }, esc(T('leaderboard'))));
      var tabs = h('div'), list = h('div', { class: 'lb' });
      function load(p) {
        list.innerHTML = '<div class="muted">' + esc(T('connecting')) + '…</div>';
        ensureNet().then(function () { return net.call('top', { pool: p }); }).then(function (r) {
          if (!list.isConnected) return;
          if (!r.rows.length) { list.innerHTML = '<div class="muted">' + esc(T('lbEmpty')) + '</div>'; return; }
          list.innerHTML = r.rows.map(function (x, i) {
            var mine = me && me.profile && x.name === me.profile.username;
            return '<div class="lb-row' + (mine ? ' me' : '') + '"><span class="lb-n">' + (i + 1) + '</span><span class="lb-name">' + esc(x.name) + '</span><span class="lb-r">' + x.rating + (x.rd > 110 ? '?' : '') + '</span><span class="lb-g">' + esc(T('gamesN', { n: x.games })) + '</span></div>';
          }).join('');
        }, function () { if (list.isConnected) list.innerHTML = '<div class="muted">' + esc(T('netError')) + '</div>'; });
      }
      tabs.appendChild(seg(['bullet', 'blitz', 'rapid'].map(function (p) { return { v: p, label: T(p), id: 'lb' + p }; }), pool, load));
      card.appendChild(tabs); card.appendChild(list);
      var row = h('div', { class: 'row-btns' }), d = h('button', { class: 'primary', type: 'button' }, esc(T('done')));
      d.addEventListener('click', closeDialog); row.appendChild(d); card.appendChild(row);
      load(pool);
    });
  }
  // online part of the New game dialog
  function onlineFields(s) {
    var wrap = h('div', { class: 'online-fields' }), prof = h('div', { class: 'prof' }), failed = false;
    var tcF = h('div', { class: 'field' }), rateLine = h('div', { class: 'record' });
    tcF.appendChild(h('div', { class: 'lbl' }, esc(T('timeControl'))));
    tcF.appendChild(seg(ONLINE_TCS.map(function (t) { return { v: t, label: t, id: 'otc' + t }; }), s.otc, function (v) { s.otc = v; updRating(); }, 'tc'));
    tcF.appendChild(rateLine);
    var rF = h('div', { class: 'field' });
    rF.appendChild(seg([{ v: true, label: T('rated'), id: 'rated' }, { v: false, label: T('casual'), id: 'casual' }], s.rated, function (v) { s.rated = v; }));
    var lb = h('button', { type: 'button', class: 'linkbtn', id: 'btn-leaderboard' }, ICON.trophy + '<span>' + esc(T('leaderboard')) + '</span>');
    lb.addEventListener('click', function () { showLeaderboard(poolOfLabel(s.otc)); });
    wrap.appendChild(prof); wrap.appendChild(tcF); wrap.appendChild(rF); wrap.appendChild(lb);
    function updRating() {
      var pool = poolOfLabel(s.otc), r = me && me.ratings[pool];
      rateLine.textContent = me ? T('yourRating', { pool: T(pool), r: r ? Math.round(r.rating) + (r.rd > 110 ? '?' : '') : '1500?' }) : '';
    }
    function renderProf(editing, err, value) {
      prof.innerHTML = '';
      if (!me) { prof.appendChild(h('div', { class: 'muted' }, esc(failed ? T('netError') : T('connecting') + '…'))); return; }
      if (!editing) {
        var line = h('div', { class: 'prof-line' }, '<span>' + esc(T('playingAs')) + ' <b id="my-name">' + esc(me.profile.username) + '</b></span>');
        var ch = h('button', { type: 'button', class: 'linkbtn', id: 'btn-rename' }, esc(T('change')));
        ch.addEventListener('click', function () { renderProf(true); });
        line.appendChild(ch); prof.appendChild(line);
        return;
      }
      var form = h('form', { class: 'prof-edit' });
      var inp = h('input', { type: 'text', maxlength: '20', id: 'name-input', autocomplete: 'nickname', spellcheck: 'false', 'aria-label': T('playingAs') });
      inp.value = value != null ? value : me.profile.username;
      var sv = h('button', { type: 'submit', class: 'sbtn' }, esc(T('save')));
      form.appendChild(inp); form.appendChild(sv);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); sv.disabled = true;
        net.call('rename', { name: inp.value }).then(function (r) { me.profile = r.profile; renderProf(false); }, function (er) {
          var code = er && er.data && er.data.error;
          renderProf(true, code === 'name_taken' ? T('nameTaken') : code === 'bad_name' ? T('badName') : T('netError'), inp.value);
        });
      });
      prof.appendChild(form);
      if (err) prof.appendChild(h('div', { class: 'err' }, esc(err)));
      setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* ignore */ } }, 20);
    }
    wrap.activate = function () {
      renderProf(false); updRating();
      ensureNet().then(function () { failed = false; if (wrap.isConnected) { renderProf(false); updRating(); } },
        function () { failed = true; if (wrap.isConnected) renderProf(false); });
    };
    return wrap;
  }

  // ---- the online game itself
  function leaveOnline() {
    if (!online) return;
    if (online.sub) online.sub.close();
    if (online.peer) online.peer.close();
    clearTimeout(online.peerCheck);
    online = null;
    save('online', null);
    setUrl(null);
  }
  function openOnlineGame(id) {
    if (online && online.id === id) return;
    ensureNet().then(function () { return net.call('game', { game: id }); }).then(function (r) {
      var g = r.game;
      if (g.status === 'waiting') {
        if (me && g.host_id === me.uid) { stopLobby(); lobby = { kind: 'invite', tc: (g.tc_base / 60000) + '+' + (g.tc_inc / 1000), rated: g.rated, t0: perf(), timer: 0, tick: 0, gameId: null }; showLobbyDialog(); watchInvite(lobby, g.id); }
        else joinGame(id);
        return;
      }
      startOnline(g);
    }, function (e) { toast(e && e.data && e.data.error === 'no_game' ? T('noGame') : T('netError')); });
  }
  function joinGame(id) {
    ensureNet().then(function () { return net.call('join', { game: id }); }).then(function (r) {
      if (r.game.status === 'waiting') { openOnlineGame(id); return; }
      startOnline(r.game);
    }, function (e) {
      var d = e && e.data;
      if (d && d.error === 'taken' && d.game) { startOnline(d.game); toast(T('gameTaken')); return; }
      setUrl(null);
      toast(d && d.error === 'no_game' ? T('noGame') : T('netError'));
    });
  }
  function buildOnlineGame(s, color) {
    var tc = { base: s.tc_base, inc: s.tc_inc, label: (s.tc_base / 60000) + '+' + (s.tc_inc / 1000) };
    var cfg = { mode: 'online', human: color < 0 ? 0 : color, spectator: color < 0, tc: tc, rated: !!s.rated, pool: s.pool,
      names: [s.white_name || T('white'), s.black_name || T('black')], ratings: [s.white_rating, s.black_rating] };
    var g = new Game(cfg, s.start_fen);
    g.online = true;
    var clk = g.clock; g.clock = null; // replay without time accounting
    for (var i = 0; i < s.moves.length; i++) { var m = g.pos.moveFromUci(s.moves[i]); if (!m) break; g.play(m, perf()); }
    g.clock = clk;
    return g;
  }
  function startOnline(s) {
    if (!s || !s.id || !me) return;
    if (online && online.id === s.id) { onServerState(s, { force: true }); return; }
    stopLobby(); leaveOnline();
    cancelBot(); bot.cancel(); bot.clear();
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); lowWarned = false; plyBoards = {};
    explore = null; posCache = {}; stopReview(); review = null;
    if (analysis.on) setAnalysis(false);
    closeDialog();
    var color = s.white_id === me.uid ? 0 : s.black_id === me.uid ? 1 : -1;
    var o = online = { id: s.id, s: null, color: color, pending: null, sub: null, connected: false, lastEvent: perf(), oppHere: null,
      claimBusy: false, claimNext: 0, reading: false, firstSec: -1, peer: null, peerMoves: [] };
    game = buildOnlineGame(s, color);
    view = game.records.length;
    setGoldenArmed(false);
    orient = color === 1 ? 1 : 0;
    board.setOrientation(orient);
    board.sync(game.pos.board, [], { instantAll: true });
    var opp = color === 0 ? s.black_id : s.white_id;
    o.sub = net.sub('g:' + s.id, {
      event: function (ev, p) { if (ev === 'state' && online === o) { o.lastEvent = perf(); onServerState(p); } },
      status: function (st) { if (online !== o) return; var was = o.connected; o.connected = st === 'SUBSCRIBED'; if (o.connected && !was) resyncOnline(); },
      presence: function (keys) { if (online !== o || color < 0) return; o.oppHere = keys.indexOf(opp) >= 0; renderBars(); }
    });
    // moves straight from the other player (shown at once; the server's state on g: stays the authority)
    o.peer = net.sub('m:' + s.id, { event: function (ev, p) { if (ev === 'move' && online === o) onPeerMove(p); } });
    onServerState(s, { force: true, initial: true });
    if (game.status === 'playing') Sound.play('start');
    save('online', { id: s.id });
    setUrl('game', s.id);
    renderAll(); layout();
  }
  function rebuildOnline(s) {
    premoves = []; selected = -1; pendingPromo = false; board.closePromotion(); plyBoards = {}; posCache = {};
    explore = null;
    game = buildOnlineGame(s, online.color);
    view = game.records.length;
    if (goldenArmed) setGoldenArmed(false);
    board.sync(game.pos.board, []);
    online.pending = null;
  }
  // bring the local game in line with a server state
  // a local move the server hasn't confirmed yet: ours on its way, or the opponent's seen peer-to-peer
  function unconfirmed(ply, uci) {
    var o = online, i;
    if (o.pending && o.pending.ply === ply && o.pending.uci === uci) return true;
    for (i = 0; i < o.peerMoves.length; i++) { var x = o.peerMoves[i]; if (x.ply === ply && x.uci === uci && perf() - x.at < PEER_TTL) return true; }
    return false;
  }
  function reconcileMoves(s, opts) {
    var srv = s.moves || [], recs = game.records, n = recs.length, k = 0, i;
    while (k < srv.length && k < n && srv[k] === recs[k].uci) k++;
    online.peerMoves = online.peerMoves.filter(function (x) { return x.ply >= srv.length; });
    if (k < n) {
      // we have moves the server doesn't: fine while each is still unconfirmed (not refused, not too old)
      if (k === srv.length && !opts.authoritative && s.status === 'playing') {
        for (i = k; i < n && unconfirmed(i, recs[i].uci); i++) { /* check all */ }
        if (i === n) return;
      }
      rebuildOnline(s); return;
    }
    if (srv.length === n) return;
    if (srv.length === n + 1 && game.status === 'playing') {
      var m = game.pos.moveFromUci(srv[n]);
      if (m) { commit(m, false, 'opp'); return; }
    }
    rebuildOnline(s);
  }
  function syncClock(s) {
    if (!game.clock) return;
    game.clock.t = [s.clock_w, s.clock_b];
    var el = s.status === 'playing' && s.moves.length >= 2 && s.turn_started_at ? Math.max(0, serverNow() - Date.parse(s.turn_started_at)) : 0;
    game.clock.since = perf() - el;
  }
  function onServerState(s, opts) {
    opts = opts || {};
    if (!online || !s || s.id !== online.id || !game || !game.online) return;
    var prev = online.s;
    if (prev && (opts.force ? s.version < prev.version : s.version <= prev.version)) return;
    online.s = s;
    game.cfg.names = [s.white_name || T('white'), s.black_name || T('black')];
    game.cfg.ratings = [s.white_rating, s.black_rating];
    if (s.rematch_game && online.color >= 0 && (!prev || prev.rematch_game !== s.rematch_game) && !opts.initial) { var nx = s.rematch_game; online.s = s; setTimeout(function () { openOnlineGame(nx); }, 0); return; }
    reconcileMoves(s, opts);
    var mine = online.color === 0 ? 'w' : online.color === 1 ? 'b' : null;
    if (game.records.length > (s.moves || []).length) { renderAll(); return; } // our move is on its way; wait for the server
    syncClock(s);
    if (s.status === 'playing') {
      if (game.status !== 'playing') { rebuildOnline(s); syncClock(s); }
      if (mine && s.draw_offer && s.draw_offer !== mine && (!prev || prev.draw_offer !== s.draw_offer) && !opts.initial) { Sound.play('select'); toast(T('oppOffersDraw', { name: sideLabel(online.color ^ 1) })); }
      if (mine && prev && prev.draw_offer === mine && !s.draw_offer && s.moves.length === prev.moves.length) toast(T('drawDeclined'));
    } else {
      var wasPlaying = game.status === 'playing';
      game.status = 'over';
      game.result = s.status === 'aborted' ? '*' : s.result;
      game.reason = s.status === 'aborted' ? 'abort' : s.reason;
      online.pending = null;
      if (s.rated && s.white_diff != null && (!prev || prev.white_diff == null)) refreshMe();
      if (mine && s.rematch_offer && s.rematch_offer !== mine && (!prev || prev.rematch_offer !== s.rematch_offer) && !opts.initial) { Sound.play('select'); toast(T('oppWantsRematch', { name: sideLabel(online.color ^ 1) })); }
      if (wasPlaying && !opts.initial) { gameOver(); return; }
    }
    renderAll();
    if (currentDialog && currentDialog.dataset.kind === 'over') showOver();
  }
  function resyncOnline() {
    var o = online;
    if (!o || o.reading || !net) return;
    o.reading = true;
    net.read(o.id).then(function (g) { o.reading = false; o.lastEvent = perf(); if (online === o && g) onServerState(g, { force: true }); }, function () { o.reading = false; });
  }
  function sendMove(rec) {
    var p = { ply: game.records.length - 1, uci: rec.uci, tries: 0 };
    online.pending = p;
    if (online.peer && online.peer.send) online.peer.send('move', { ply: p.ply, uci: p.uci });
    pushMove(online, p);
  }
  // the opponent's move, straight from their browser: show it now, let the server confirm it
  function onPeerMove(p) {
    var o = online;
    if (!o || !game || !game.online || game.status !== 'playing' || !p || typeof p.uci !== 'string' || p.ply !== game.records.length) return;
    if (o.color >= 0 && game.pos.side === o.color) return; // only the opponent's move can arrive this way
    var m = game.pos.moveFromUci(p.uci);
    if (!m) return;
    o.peerMoves.push({ ply: p.ply, uci: p.uci, at: perf() });
    o.lastEvent = perf();
    commit(m, false, 'opp');
    // if the server never confirms it (the move was refused or the opponent's request was lost), resync
    clearTimeout(o.peerCheck);
    o.peerCheck = setTimeout(function () {
      if (online === o && o.s && o.s.moves.length <= p.ply && game.records.length > o.s.moves.length) resyncOnline();
    }, PEER_TTL + 300);
  }
  function pushMove(o, p) {
    if (online !== o || o.pending !== p) return;
    net.call('move', { game: o.id, uci: p.uci, ply: p.ply }).then(function (r) {
      if (online !== o) return;
      if (o.pending === p) o.pending = null;
      onServerState(r.game);
    }, function (e) {
      if (online !== o || o.pending !== p) return;
      var d = e && e.data;
      if (d && d.game) {
        if (d.error === 'conflict' && d.game.status === 'playing' && d.game.moves.length === p.ply && p.tries++ < 4) { pushMove(o, p); return; }
        o.pending = null;
        onServerState(d.game, { force: true, authoritative: true });
        return;
      }
      if (e && e.status === 401) { netReady = null; }
      // network trouble: retry (the server ignores a move it already has: wrong ply)
      if (p.tries++ < 8) setTimeout(function () { pushMove(o, p); }, Math.min(4000, 250 * p.tries));
      else { o.pending = null; resyncOnline(); }
    });
  }
  function onlineAction(action, extra) {
    var o = online;
    if (!o || !net) return Promise.resolve(null);
    return net.call(action, Object.assign({ game: o.id }, extra || {})).then(function (r) {
      if (online === o && r.game) onServerState(r.game);
      if (r.next && online === o) openOnlineGame(r.next);
      return r;
    }, function (e) {
      if (online === o && e && e.data && e.data.game) onServerState(e.data.game, { force: true });
      else toast(T('netError'));
      return null;
    });
  }
  function rematchState() {
    var s = online && online.s, mine = game && game.cfg.human === 0 ? 'w' : 'b';
    if (!s) return { label: T('rematch'), disabled: true };
    if (s.rematch_offer && s.rematch_offer !== mine) return { label: T('acceptRematch'), hot: true };
    if (s.rematch_offer === mine) return { label: T('rematchSent'), disabled: true };
    return { label: T('rematch') };
  }
  function rematch() { onlineAction('rematch').then(function () { renderSide(); }); }
  function firstMoveSince(s) { return s.moves.length === 0 ? Date.parse(s.created_at) : Date.parse(s.updated_at); }
  function claim() {
    var o = online;
    if (!o || o.claimBusy || perf() < o.claimNext) return;
    o.claimBusy = true;
    net.call('claim', { game: o.id }).then(function (r) { o.claimBusy = false; o.claimNext = perf() + 1500; if (online === o) onServerState(r.game); },
      function () { o.claimBusy = false; o.claimNext = perf() + 3000; });
  }
  function onlineTick(now) {
    var o = online;
    if (!o || !o.s || o.s.status !== 'playing' || o.pending) return;
    if (game.running()) { if (game.timeLeft(game.pos.side, now) < -CLAIM_GRACE) claim(); return; }
    if (game.records.length < 2) {
      var left = FIRST_MOVE_MS - (serverNow() - firstMoveSince(o.s)), sec = Math.max(0, Math.ceil(left / 1000));
      if (sec !== o.firstSec) { o.firstSec = sec; renderAna(); }
      if (left < -1200) claim();
    }
  }
  function onlineNotice() {
    var o = online;
    if (!o || !o.s || !game) return '';
    var s = o.s, mine = o.color === 0 ? 'w' : o.color === 1 ? 'b' : null, out = '';
    if (s.status === 'playing') {
      if (mine && s.draw_offer && s.draw_offer !== mine) {
        out += '<span class="notice"><b>' + esc(T('oppOffersDraw', { name: sideLabel(o.color ^ 1) })) + '</b>' +
          '<button class="sbtn" data-act="draw-accept">' + esc(T('accept')) + '</button><button class="sbtn" data-act="draw-decline">' + esc(T('decline')) + '</button></span>';
      } else if (mine && s.draw_offer === mine) out += '<span>' + esc(T('drawOffered')) + '</span>';
      if (game.records.length < 2 && o.firstSec >= 0) {
        var side = game.pos.side, who = mine && (side === 0 ? 'w' : 'b') === mine ? T('you') : sideLabel(side);
        out += '<span>' + esc(T('firstMove', { side: who, s: o.firstSec })) + '</span>';
      }
      if (!o.connected && perf() - o.lastEvent > 4000) out += '<span class="muted">' + esc(T('reconnecting')) + '</span>';
    } else if (mine && s.rematch_offer && s.rematch_offer !== mine && !s.rematch_game) {
      out += '<span class="notice"><b>' + esc(T('oppWantsRematch', { name: sideLabel(o.color ^ 1) })) + '</b><button class="sbtn" data-act="rematch">' + esc(T('acceptRematch')) + '</button></span>';
    }
    return out;
  }
  setInterval(function () {
    var o = online;
    if (!o || !o.s || !net) return;
    var idle = perf() - o.lastEvent, playing = o.s.status === 'playing';
    if (playing ? idle > (o.connected ? 12000 : 2500) : idle > 15000) resyncOnline();
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && online) resyncOnline(); });
  function bootOnline() {
    if (!NETCFG) return;
    var join = urlQ.get('join'), gid = urlQ.get('game'), saved = load('online', null);
    if (join) { joinGame(join); return; }
    if (gid) { openOnlineGame(gid); return; }
    if ((saved && saved.id) || hasNetSession()) {
      ensureNet().then(function (r) {
        if (r.live && r.live.status === 'playing') openOnlineGame(r.live.id);
        else if (saved && saved.id) save('online', null);
      }, function () { /* offline: stay with the local game */ });
    }
  }

  // ------------------------------------------------------------------ boot
  function boot(hotData) {
    applySettings(); applyLang(); layout();
    var saved = (hotData && hotData.game) || load('game', null), g = saved ? Game.restore(saved) : null;
    if (g) {
      game = g; view = game.records.length;
      orient = botGame() ? game.cfg.human : 0;
      board.setOrientation(orient);
      board.sync(game.pos.board, [], { instantAll: true });
      renderAll();
      if (game.status === 'playing' && botGame() && game.pos.side !== game.cfg.human) requestBot();
    } else {
      startGame(lastSetup.mode === 'online' ? Object.assign({}, lastSetup, { mode: 'bot' }) : lastSetup);
    }
    loop();
    bootOnline();
  }
  var hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(function () { return { game: game && !game.online ? game.serialize() : null }; }); } catch (e) { /* ignore */ } }
  if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot(hot && hot.data);

  // test hooks (used by the automated stress test; harmless for players)
  window.__gc = {
    get game() { return game; }, board: board, get premoves() { return premoves; }, get view() { return view; },
    displayBoard: displayBoard, startGame: startGame, gotoPly: gotoPly, tryMove: tryMove, setGoldenArmed: setGoldenArmed, flip: flip,
    takeback: takeback, onGoldenButton: onGoldenButton, setAnalysis: setAnalysis, get botBusy() { return !!botReq; }, settings: settings, applySettings: applySettings,
    premoveDests: premoveDests, viewFen: function () { return viewFen(); }, get reviewState() { return review; }, get exploreState() { return explore; }, startReview: startReview, exitExplore: exitExplore, navStep: navStep,
    get goldenArmed() { return goldenArmed; }, get selected() { return selected; }, get dialogOpen() { return !!currentDialog; }, closeDialog: closeDialog,
    get dialogKind() { return currentDialog ? currentDialog.dataset.kind || '' : null; },
    get online() { return online; }, get me() { return me; }, get lobby() { return lobby; }, startSeek: startSeek, startInvite: startInvite,
    onlineAction: onlineAction, showNewGame: showNewGame, serverNow: serverNow, cancelPremoves: cancelPremoves
  };
})();
