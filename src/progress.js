/* Progress: the player's level and rank, three quests a day, the career against the bots (stars for goals) and the
 * collection of Joker Moves. Pure functions with no page in them: the app keeps the state on the device, the tests
 * share them. None of it touches the rating or online matchmaking: it is a game of its own, mostly against the bots.
 *
 * Level: experience (XP) for everything played, never lost. Each level needs 40 XP more than the one before (100 for
 * the first), so a player who comes every day climbs fast at first and reaches the diamond rank (50) in about half a
 * year. Ranks: a chess piece for each band of levels, then the Joker, then the diamond Joker. */
var Progress = (function () {
  function need(level) { return 100 + 40 * (level - 1); }
  function levelOf(xp) {
    var l = 1, left = Math.max(0, Math.floor(xp || 0));
    while (left >= need(l) && l < 99) { left -= need(l); l++; }
    return { level: l, into: left, need: need(l) };
  }
  function xpAt(level) { var s = 0; for (var l = 1; l < level; l++) s += need(l); return s; } // XP at the start of a level

  var RANKS = [['pawn', 1], ['knight', 5], ['bishop', 10], ['rook', 15], ['queen', 20], ['king', 30], ['joker', 40], ['diamond', 50]];
  function rankOf(level) {
    var i = RANKS.length - 1;
    while (i > 0 && level < RANKS[i][1]) i--;
    var from = RANKS[i][1], to = i + 1 < RANKS.length ? RANKS[i + 1][1] - 1 : null;
    var tier = to ? Math.min(3, Math.floor((level - from) * 3 / (to - from + 1)) + 1) : 0;
    return { key: RANKS[i][0], index: i, from: from, to: to, tier: tier };
  }

  // ---- XP for a finished game. o: { mode: 'bot' | 'online' | 'local', level (the bot's, 1-8), outcome (1 win, 0 draw,
  // -1 loss, for the player), joker (the player's Joker Move was played), firstWin (the first win of the player's day) }
  var XP = { bot: 10, botWin: 20, perLevel: 4, online: 20, onlineWin: 20, draw: 10, local: 10, joker: 10, puzzle: 10, daily: 40, review: 15, star: 30 };
  function gameXp(o) {
    var lines = [];
    var add = function (k, n) { if (n) lines.push({ k: k, n: n }); };
    if (o.mode === 'online') { add('game', XP.online); add(o.outcome === 1 ? 'win' : o.outcome === 0 ? 'draw' : '', o.outcome === 1 ? XP.onlineWin : o.outcome === 0 ? XP.draw : 0); }
    else if (o.mode === 'bot') { add('game', XP.bot); add(o.outcome === 1 ? 'win' : o.outcome === 0 ? 'draw' : '', o.outcome === 1 ? XP.botWin + XP.perLevel * ((o.level || 1) - 1) : o.outcome === 0 ? XP.draw : 0); }
    else add('game', XP.local);
    if (o.joker) add('joker', XP.joker);
    var sum = lines.reduce(function (s, x) { return s + x.n; }, 0);
    if (o.firstWin && o.outcome === 1 && o.mode !== 'local') { add('firstWin', sum); sum *= 2; } // the first win of the day counts twice
    return { xp: sum, lines: lines };
  }

  // ---- what levels (and career stars) give: boards, the colour of the Joker Move's dots, frames, titles
  var REWARDS = [
    { lv: 2, kind: 'board', id: 'ocean' }, { lv: 3, kind: 'title', id: 'teleporter' }, { lv: 4, kind: 'jdot', id: 'ice' },
    { lv: 5, kind: 'frame', id: 'knight' }, { lv: 6, kind: 'board', id: 'rose' }, { lv: 7, kind: 'title', id: 'trickster' },
    { lv: 8, kind: 'jdot', id: 'fire' }, { lv: 10, kind: 'frame', id: 'bishop' }, { lv: 12, kind: 'board', id: 'midnight' },
    { lv: 14, kind: 'title', id: 'tactician' }, { lv: 15, kind: 'frame', id: 'rook' }, { lv: 17, kind: 'jdot', id: 'violet' },
    { lv: 20, kind: 'frame', id: 'queen' }, { lv: 22, kind: 'board', id: 'emerald' }, { lv: 25, kind: 'title', id: 'jokermaster' },
    { lv: 30, kind: 'frame', id: 'king' }, { lv: 35, kind: 'jdot', id: 'rainbow' }, { lv: 40, kind: 'frame', id: 'joker' },
    { lv: 45, kind: 'board', id: 'gold' }, { lv: 50, kind: 'frame', id: 'diamond' }, { lv: 50, kind: 'board', id: 'diamond' },
    { lv: 50, kind: 'title', id: 'diamond' },
    { stars: 9, kind: 'title', id: 'climber' }, { stars: 36, kind: 'board', id: 'arena' }, { stars: 72, kind: 'frame', id: 'champion' }
  ];
  function owned(level, stars) { return REWARDS.filter(function (r) { return r.lv ? r.lv <= level : r.stars <= stars; }); }
  function newRewards(fromLevel, toLevel, fromStars, toStars) {
    return REWARDS.filter(function (r) { return r.lv ? r.lv > fromLevel && r.lv <= toLevel : r.stars > fromStars && r.stars <= toStars; });
  }
  function nextReward(level) { for (var i = 0; i < REWARDS.length; i++) if (REWARDS[i].lv > level) return REWARDS[i]; return null; }

  // ---- three quests a day, the same for everyone on that day: something to solve, something to play, something
  // with the Joker. ev: { type: 'game', mode, outcome, joker, queenKept, stars (new career stars) } | { type: 'puzzle' }
  // | { type: 'daily' } | { type: 'review' }
  var QUESTS = { daily: [1, 60], puzzles3: [3, 60], win2: [2, 60], games3: [3, 60], online: [1, 60], star: [1, 60],
    joker2: [2, 60], jokerwin: [1, 80], clean: [1, 80], review: [1, 60] }; // [how many, XP]
  var SLOTS = [['daily', 'puzzles3'], ['win2', 'games3', 'online', 'star'], ['joker2', 'jokerwin', 'clean', 'review']];
  function hash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; // spread the bits
    return x >>> 0;
  }
  function questsFor(day) { return SLOTS.map(function (slot, i) { return slot[hash(day + ':' + i) % slot.length]; }); }
  function questStep(id, ev) {
    var game = ev.type === 'game', real = game && ev.mode !== 'local', won = real && ev.outcome === 1;
    switch (id) {
      case 'daily': return ev.type === 'daily' ? 1 : 0;
      case 'puzzles3': return ev.type === 'puzzle' || ev.type === 'daily' ? 1 : 0;
      case 'win2': return won ? 1 : 0;
      case 'games3': return real ? 1 : 0;
      case 'online': return game && ev.mode === 'online' ? 1 : 0;
      case 'star': return game ? ev.stars || 0 : 0;
      case 'joker2': return real && ev.joker ? 1 : 0;
      case 'jokerwin': return won && ev.joker ? 1 : 0;
      case 'clean': return won && ev.queenKept ? 1 : 0;
      case 'review': return ev.type === 'review' ? 1 : 0;
    }
    return 0;
  }
  // today's quests in the state (a new day starts afresh); applies the event; returns the quests it finished
  function applyQuests(st, day, ev) {
    if (!st.q || st.q.day !== day) st.q = { day: day, ids: questsFor(day), p: {}, done: {} };
    var finished = [];
    st.q.ids.forEach(function (id) {
      if (st.q.done[id]) return;
      var k = questStep(id, ev);
      if (!k) return;
      st.q.p[id] = Math.min(QUESTS[id][0], (st.q.p[id] || 0) + k);
      if (st.q.p[id] >= QUESTS[id][0]) { st.q.done[id] = true; finished.push(id); }
    });
    return finished;
  }

  // ---- the career: a chapter for each bot (the weakest first), three stages each, the third one the boss (played
  // as Black). Three goals a stage, a star each; the first is always the win. The boss gives one star for a win with
  // the Joker and one for a win without it, so three stars take two different wins. A stage opens when the one before
  // it has a star; a chapter when the boss before it is beaten.
  var CHAPTERS = 8;
  var GOALS = { 1: [['win'], ['joker'], ['fast', 40]], 2: [['win'], ['clean'], ['fast', 30]], 3: [['win'], ['joker'], ['nojoker']] };
  function stage(ch, st) { return { ch: ch, st: st, boss: st === 3, color: st === 3 ? 'b' : 'w', level: ch, goals: GOALS[st] }; }
  // r: { outcome, joker, queenKept, moves (the player's own moves) }
  function goalMet(g, r) {
    if (r.outcome !== 1) return false;
    if (g[0] === 'joker') return !!r.joker;
    if (g[0] === 'nojoker') return !r.joker;
    if (g[0] === 'clean') return !!r.queenKept;
    if (g[0] === 'fast') return r.moves <= g[1];
    return true;
  }
  function stageBits(st, r) { var bits = 0; GOALS[st].forEach(function (g, i) { if (goalMet(g, r)) bits |= 1 << i; }); return bits; }
  function starsOf(bits) { return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1); }
  function isOpen(career, ch, st) {
    if (ch < 1 || ch > CHAPTERS || st < 1 || st > 3) return false;
    if (ch === 1 && st === 1) return true;
    if (st > 1) return !!career[ch + '-' + (st - 1)];
    return !!career[(ch - 1) + '-3'];
  }
  function careerStars(career) { var s = 0; for (var k in career) s += starsOf(career[k]); return s; }
  // where to carry on: ahead first, the open stage not won yet (stages open one at a time, so there is one); once the
  // whole road is won, the first stage still missing stars (none left: null). Missing stars never pull the main
  // button back down the road: replaying a stage for them is the player's choice, from its tile.
  function nextStage(career) {
    var ch, st;
    for (ch = 1; ch <= CHAPTERS; ch++) for (st = 1; st <= 3; st++) if (isOpen(career, ch, st) && !career[ch + '-' + st]) return stage(ch, st);
    for (ch = 1; ch <= CHAPTERS; ch++) for (st = 1; st <= 3; st++) if (starsOf(career[ch + '-' + st] || 0) < 3) return stage(ch, st);
    return null;
  }
  // a finished career game: the goals met now, the best kept; returns { bits, newStars, best }
  function recordStage(career, ch, st, r) {
    var key = ch + '-' + st, before = career[key] || 0, now = stageBits(st, r), best = before | now;
    career[key] = best;
    return { bits: now, newStars: starsOf(best) - starsOf(before), best: best };
  }

  // ---- the collection: kinds of Joker Moves, found by playing them (any game; puzzles don't count). A Joker Move
  // never captures and never gives check, so the cards are about where it lands and what it sets up.
  var CARDS = [['knight', 1], ['bishop', 1], ['rook', 1], ['queen', 1], ['early', 2], ['deep', 2], ['endgame', 2],
    ['pin', 3], ['escape', 3], ['shield', 3], ['fork', 4], ['mate', 5]];
  var CARD_XP = [0, 40, 60, 90, 140, 250];
  function rarityOf(id) { for (var i = 0; i < CARDS.length; i++) if (CARDS[i][0] === id) return CARDS[i][1]; return 1; }
  var KN = [33, 31, 18, 14, -33, -31, -18, -14], DG = [15, 17, -15, -17], OR = [1, -1, 16, -16];
  function hits(b, sq, type) { // the squares a piece of that type on sq attacks (0x88 board)
    var out = [], i, t, d;
    if (type === 2) { for (i = 0; i < 8; i++) { t = sq + KN[i]; if (!(t & 0x88)) out.push(t); } return out; }
    var dirs = type === 3 ? DG : type === 4 ? OR : DG.concat(OR);
    for (i = 0; i < dirs.length; i++) { d = dirs[i]; t = sq + d; while (!(t & 0x88)) { out.push(t); if (b[t]) break; t += d; } }
    return out;
  }
  // a line piece on sq that holds one of their pieces against their king (the king right behind it on the line)
  function pinsFrom(b, sq, type, them) {
    var dirs = type === 3 ? DG : type === 4 ? OR : DG.concat(OR), king = (them << 3) | 6;
    for (var i = 0; i < dirs.length; i++) {
      var d = dirs[i], t = sq + d, first = 0;
      while (!(t & 0x88)) {
        var q = b[t];
        if (q) {
          if (!first) { if ((q >> 3) !== them || q === king) break; first = q; }
          else { if (q === king) return true; break; }
        }
        t += d;
      }
    }
    return false;
  }
  // what kinds a Joker Move is. pos: the position before it (the mover to move; left as it was), m: the move,
  // ply: its index in the game (0 = White's first move), mateIn: plies from it to the mover's checkmate win, when the
  // game ended that way. Needs GC (src/core.js).
  function classify(GC, pos, m, ply, mateIn) {
    var us = pos.side, them = us ^ 1, from = GC.mFrom(m), to = GC.mTo(m), type = pos.board[from] & 7, out = [];
    var name = { 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen' }[type];
    if (name) out.push(name);
    if (ply < 12) out.push('early');
    if ((to >> 4) === (us === 0 ? 7 : 0)) out.push('deep');
    var pieces = 0;
    for (var sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } var t = pos.board[sq] & 7; if (t >= 2 && t <= 5) pieces++; }
    if (pieces <= 4) out.push('endgame');
    var wasChecked = pos.inCheck(us), wasHit = pos.attacked(from, them);
    pos.makeMove(m);
    if (wasChecked) out.push('shield');
    if (wasHit && (type === 4 || type === 5) && !pos.attacked(to, them)) out.push('escape');
    var n = 0, b = pos.board;
    hits(b, to, type).forEach(function (s) { var q = b[s]; if (q && (q >> 3) === them && (q & 7) >= 2) n++; });
    if (n >= 2) out.push('fork');
    if (type !== 2 && pinsFrom(b, to, type, them)) out.push('pin');
    pos.unmakeMove();
    if (mateIn != null && mateIn <= 6) out.push('mate');
    return out;
  }

  // ---- words (EN / RU)
  var TEXT = {
    en: {
      rank_pawn: 'Pawn', rank_knight: 'Knight', rank_bishop: 'Bishop', rank_rook: 'Rook', rank_queen: 'Queen', rank_king: 'King', rank_joker: 'Joker', rank_diamond: 'Diamond Joker',
      level: 'Level {n}', xp: '{n} XP', xpOf: '{a} / {b} XP', xpGain: '+{n} XP',
      x_game: 'Game', x_win: 'Win', x_draw: 'Draw', x_joker: 'Joker Move played', x_firstWin: 'First win of the day ×2', x_star: 'Career stars', x_quest: 'Quest done', x_card: 'New Joker card', x_puzzle: 'Puzzle', x_daily: 'Daily puzzle', x_review: 'Game review',
      q_daily: 'Solve the daily puzzle', q_puzzles3: 'Solve {n} puzzles', q_win2: 'Win {n} games', q_games3: 'Play {n} games', q_online: 'Play a game online', q_star: 'Earn a career star',
      q_joker2: 'Play your Joker Move in {n} games', q_jokerwin: 'Win a game with your Joker Move', q_clean: 'Win without losing your queen', q_review: 'Open a game review',
      g_win: 'Win', g_joker: 'Win with your Joker Move', g_nojoker: 'Win without your Joker Move', g_clean: 'Win without losing your queen', g_fast: 'Win in {n} moves or fewer',
      c_knight: 'Ghost Knight', c_bishop: 'Phantom Bishop', c_rook: 'Flying Rook', c_queen: 'Teleport Queen', c_early: 'Early Joker', c_deep: 'Behind the Lines', c_endgame: 'Endgame Joker',
      c_pin: 'Teleport Pin', c_escape: 'The Great Escape', c_shield: 'Joker Shield', c_fork: 'Teleport Fork', c_mate: 'Joker to Mate',
      cd_knight: 'A Joker Move by a knight', cd_bishop: 'A Joker Move by a bishop', cd_rook: 'A Joker Move by a rook', cd_queen: 'A Joker Move by the queen',
      cd_early: 'In the first six moves', cd_deep: 'Onto the opponent’s back rank', cd_endgame: 'With four pieces or fewer left', cd_pin: 'It pins a piece to its king',
      cd_escape: 'An attacked rook or queen jumps to safety', cd_shield: 'It blocks a check', cd_fork: 'It attacks two pieces at once', cd_mate: 'Mate within three moves after it',
      rar1: 'Common', rar2: 'Uncommon', rar3: 'Rare', rar4: 'Epic', rar5: 'Legendary',
      r_board: 'Board', r_jdot: 'Joker dots', r_frame: 'Frame', r_title: 'Title',
      b_ocean: 'Ocean', b_rose: 'Rose', b_midnight: 'Midnight', b_emerald: 'Emerald', b_gold: 'Gold', b_diamond: 'Diamond', b_arena: 'Arena',
      j_ice: 'Ice', j_fire: 'Fire', j_violet: 'Violet', j_rainbow: 'Rainbow',
      f_knight: 'Bronze', f_bishop: 'Silver', f_rook: 'Gold', f_queen: 'Jade', f_king: 'Sapphire', f_joker: 'Amethyst', f_diamond: 'Diamond', f_champion: 'Ruby',
      t_teleporter: 'Teleporter', t_trickster: 'Trickster', t_tactician: 'Tactician', t_jokermaster: 'Joker Master', t_diamond: 'Diamond Joker', t_climber: 'Climber'
    },
    ru: {
      rank_pawn: 'Пешка', rank_knight: 'Конь', rank_bishop: 'Слон', rank_rook: 'Ладья', rank_queen: 'Ферзь', rank_king: 'Король', rank_joker: 'Джокер', rank_diamond: 'Бриллиантовый Джокер',
      level: 'Уровень {n}', xp: '{n} XP', xpOf: '{a} / {b} XP', xpGain: '+{n} XP',
      x_game: 'Партия', x_win: 'Победа', x_draw: 'Ничья', x_joker: 'Сыгран ход-джокер', x_firstWin: 'Первая победа дня ×2', x_star: 'Звёзды карьеры', x_quest: 'Задание выполнено', x_card: 'Новая карта джокера', x_puzzle: 'Задача', x_daily: 'Задача дня', x_review: 'Разбор партии',
      q_daily: 'Реши задачу дня', q_puzzles3: 'Реши задач: {n}', q_win2: 'Выиграй партий: {n}', q_games3: 'Сыграй партий: {n}', q_online: 'Сыграй партию онлайн', q_star: 'Получи звезду карьеры',
      q_joker2: 'Сыграй ход-джокер в партиях: {n}', q_jokerwin: 'Выиграй партию ходом-джокером', q_clean: 'Выиграй, не потеряв ферзя', q_review: 'Открой разбор партии',
      g_win: 'Победа', g_joker: 'Победа с ходом-джокером', g_nojoker: 'Победа без хода-джокера', g_clean: 'Победа без потери ферзя', g_fast: 'Победа не дольше {n} ходов',
      c_knight: 'Конь-призрак', c_bishop: 'Слон-фантом', c_rook: 'Летучая ладья', c_queen: 'Ферзь-телепорт', c_early: 'Ранний джокер', c_deep: 'В тылу врага', c_endgame: 'Джокер в эндшпиле',
      c_pin: 'Связка-телепорт', c_escape: 'Большой побег', c_shield: 'Щит джокера', c_fork: 'Телепорт-вилка', c_mate: 'Джокер к мату',
      cd_knight: 'Ход-джокер конём', cd_bishop: 'Ход-джокер слоном', cd_rook: 'Ход-джокер ладьёй', cd_queen: 'Ход-джокер ферзём',
      cd_early: 'В первые шесть ходов', cd_deep: 'На последнюю горизонталь соперника', cd_endgame: 'Когда фигур осталось четыре или меньше', cd_pin: 'Связывает фигуру с королём',
      cd_escape: 'Атакованная ладья или ферзь уходит из-под удара', cd_shield: 'Закрывает от шаха', cd_fork: 'Нападает сразу на две фигуры', cd_mate: 'Мат в течение трёх ходов после него',
      rar1: 'Обычная', rar2: 'Необычная', rar3: 'Редкая', rar4: 'Эпическая', rar5: 'Легендарная',
      r_board: 'Доска', r_jdot: 'Точки джокера', r_frame: 'Рамка', r_title: 'Титул',
      b_ocean: 'Океан', b_rose: 'Роза', b_midnight: 'Полночь', b_emerald: 'Изумруд', b_gold: 'Золото', b_diamond: 'Бриллиант', b_arena: 'Арена',
      j_ice: 'Лёд', j_fire: 'Огонь', j_violet: 'Фиалка', j_rainbow: 'Радуга',
      f_knight: 'Бронза', f_bishop: 'Серебро', f_rook: 'Золото', f_queen: 'Нефрит', f_king: 'Сапфир', f_joker: 'Аметист', f_diamond: 'Бриллиант', f_champion: 'Рубин',
      t_teleporter: 'Телепортист', t_trickster: 'Ловкач', t_tactician: 'Тактик', t_jokermaster: 'Мастер джокера', t_diamond: 'Бриллиантовый Джокер', t_climber: 'Восходящий'
    }
  };
  function t(lang, key, vars) {
    var s = (TEXT[lang] || TEXT.en)[key];
    if (s == null) s = TEXT.en[key] != null ? TEXT.en[key] : key;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }
  function questText(lang, id) { return t(lang, 'q_' + id, { n: QUESTS[id][0] }); }
  function goalText(lang, g) { return t(lang, 'g_' + g[0], { n: g[1] }); }
  function rewardName(lang, r) { return t(lang, ({ board: 'b_', jdot: 'j_', frame: 'f_', title: 't_' })[r.kind] + r.id); }
  function rankName(lang, level) { var r = rankOf(level); return t(lang, 'rank_' + r.key) + (r.tier ? ' ' + ['I', 'II', 'III'][r.tier - 1] : ''); }

  return { need: need, levelOf: levelOf, xpAt: xpAt, rankOf: rankOf, RANKS: RANKS, XP: XP, gameXp: gameXp, REWARDS: REWARDS, owned: owned,
    newRewards: newRewards, nextReward: nextReward, QUESTS: QUESTS, questsFor: questsFor, questStep: questStep, applyQuests: applyQuests,
    CHAPTERS: CHAPTERS, GOALS: GOALS, stage: stage, goalMet: goalMet, stageBits: stageBits, starsOf: starsOf, isOpen: isOpen,
    careerStars: careerStars, nextStage: nextStage, recordStage: recordStage, CARDS: CARDS, CARD_XP: CARD_XP, rarityOf: rarityOf,
    classify: classify, TEXT: TEXT, t: t, questText: questText, goalText: goalText, rewardName: rewardName, rankName: rankName };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
