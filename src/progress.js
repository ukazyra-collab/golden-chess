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
  // with the Joker. ev: { type: 'game', mode, outcome, joker, queenKept, stars (new career stars) } | { type: 'puzzle', real (it comes from a real game) }
  // | { type: 'daily' } | { type: 'review' }
  var QUESTS = { daily: [1, 60], puzzles3: [3, 60], hist: [1, 60], win2: [2, 60], games3: [3, 60], online: [1, 60], star: [1, 60],
    joker2: [2, 60], jokerwin: [1, 80], clean: [1, 80], review: [1, 60],
    p_win3: [3, 120], p_joker3: [3, 120], p_puzzles5: [5, 120] }; // [how many, XP]
  var SLOTS = [['daily', 'puzzles3', 'hist'], ['win2', 'games3', 'online', 'star'], ['joker2', 'jokerwin', 'clean', 'review']];
  // the Pro quest (prototype, src/pro.js): a fourth quest a day for a Pro player, the same for all of them that day
  var PRO_SLOT = ['p_win3', 'p_joker3', 'p_puzzles5'];
  function proQuestFor(day) { return PRO_SLOT[hash(day + ':pro') % PRO_SLOT.length]; }
  function hash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; // spread the bits
    return x >>> 0;
  }
  function questsFor(day, pro) { var ids = SLOTS.map(function (slot, i) { return slot[hash(day + ':' + i) % slot.length]; }); return pro ? ids.concat([proQuestFor(day)]) : ids; }
  function questStep(id, ev) {
    var game = ev.type === 'game', real = game && ev.mode !== 'local', won = real && ev.outcome === 1;
    switch (id) {
      case 'daily': return ev.type === 'daily' ? 1 : 0;
      case 'hist': return ev.type === 'puzzle' && ev.real ? 1 : 0;
      case 'puzzles3': return ev.type === 'puzzle' || ev.type === 'daily' ? 1 : 0;
      case 'win2': return won ? 1 : 0;
      case 'games3': return real ? 1 : 0;
      case 'online': return game && ev.mode === 'online' ? 1 : 0;
      case 'star': return game ? ev.stars || 0 : 0;
      case 'joker2': return real && ev.joker ? 1 : 0;
      case 'jokerwin': return won && ev.joker ? 1 : 0;
      case 'clean': return won && ev.queenKept ? 1 : 0;
      case 'review': return ev.type === 'review' ? 1 : 0;
      case 'p_win3': return won ? 1 : 0;
      case 'p_joker3': return real && ev.joker ? 1 : 0;
      case 'p_puzzles5': return ev.type === 'puzzle' || ev.type === 'daily' ? 1 : 0;
    }
    return 0;
  }
  // today's quests in the state (a new day starts afresh); applies the event; returns the quests it finished.
  // pro: the player has Pro (the day's Pro quest joins the list, also when Pro started in the middle of the day)
  function applyQuests(st, day, ev, pro) {
    if (!st.q || st.q.day !== day) st.q = { day: day, ids: questsFor(day, pro), p: {}, done: {} };
    else if (pro && st.q.ids.indexOf(proQuestFor(day)) < 0) st.q.ids = st.q.ids.concat([proQuestFor(day)]);
    var finished = [];
    st.q.ids.forEach(function (id) {
      if (st.q.done[id] || !QUESTS[id]) return;
      var k = questStep(id, ev);
      if (!k) return;
      st.q.p[id] = Math.min(QUESTS[id][0], (st.q.p[id] || 0) + k);
      if (st.q.p[id] >= QUESTS[id][0]) { st.q.done[id] = true; finished.push(id); }
    });
    return finished;
  }

  // ---- the bots: sixteen characters, the weakest first, the same in the career and in the picker, each with one
  // name and one rating wherever it is shown. Eight play an engine level as it is. Five stand between two levels with
  // an engine setting of their own (lv), their ratings placed by matches of Joker Chess against both neighbours
  // (tools/bots/calib.js, Nov 12 2026; a rating is read off between the neighbours' ratings in the proportion of
  // the two results, and rounded within the matches' error):
  //   Jake   1,500 games against Pip (four settings, a line through them): about 150 below him            -> 450
  //   Sonya  +223 over Pip, -207 under Mila (300 games each)       -> 756 -> 750
  //   Timur  +119 over Mila, -140 under Oskar (300 each)           -> 1038 -> 1050
  //   Ada    +177 over Zara, -191 under Viktor (300 each)          -> 1470 -> 1475
  //   Mark   +441 over Viktor, -363 under Nadia (150 each)         -> 1765 (1745..1785) -> 1750
  // The three masters are the engine of Leo (0.9 s a move, 2250) and of the Joker (3 s, 2500) thinking for a time
  // between theirs; their ratings are read off between those two by the logarithm of the time, not measured.
  // level: the engine level a bot is closest to from below (its opening book, its pace at the board, its goals)
  var BOTS = [
    { who: 'jake', level: 1, elo: 450, lv: { depth: 2, time: 400, noise: 298, exact: true, temp: 116, margin: 372 } },
    { who: 'pip', level: 1, elo: 600 },
    { who: 'sonya', level: 1, elo: 750, lv: { depth: 2, time: 450, noise: 166, exact: true, temp: 71, margin: 279 } },
    { who: 'mila', level: 2, elo: 900 },
    { who: 'timur', level: 2, elo: 1050, lv: { depth: 2, time: 550, noise: 80, exact: true, temp: 45, margin: 230 } },
    { who: 'oskar', level: 3, elo: 1200 },
    { who: 'zara', level: 4, elo: 1350 },
    { who: 'ada', level: 4, elo: 1475, lv: { depth: 3, time: 700, noise: 70, exact: true, temp: 30, margin: 150 } },
    { who: 'viktor', level: 5, elo: 1600 },
    { who: 'mark', level: 5, elo: 1750, lv: { depth: 4, time: 600, noise: 30, exact: true, temp: 14, margin: 80 } },
    { who: 'nadia', level: 6, elo: 1900 },
    { who: 'leo', level: 7, elo: 2250 },
    { who: 'staunton', level: 7, elo: 2300, lv: { depth: 64, time: 1150, noise: 0, exact: false } },
    { who: 'anderssen', level: 7, elo: 2375, lv: { depth: 64, time: 1650, noise: 0, exact: false } },
    { who: 'morphy', level: 7, elo: 2450, lv: { depth: 64, time: 2350, noise: 0, exact: false } },
    { who: 'golden', level: 8, elo: 2500 }
  ];
  function bot(who) { for (var i = 0; i < BOTS.length; i++) if (BOTS[i].who === who) return BOTS[i]; return null; }
  // the bot that plays an engine level as it is (games saved before the bots had names of their own)
  function levelBot(level) { for (var i = 0; i < BOTS.length; i++) if (BOTS[i].level === level && !BOTS[i].lv) return BOTS[i]; return BOTS[1]; }

  // ---- the career: the same sixteen in four seasons of four, a stage each, by rating. Three goals, a star each: a
  // win, a win with the Joker Move, a win inside so many moves; one good game can take all three. A season opens on
  // enough stars (the first asks for none, the second for half of the first), and inside an open season any opponent
  // can be played. career: { '<stage>': bits }
  var SEASONS = [{ key: 'school', need: 0 }, { key: 'park', need: 6 }, { key: 'tour', need: 14 }, { key: 'legends', need: 24 }];
  var CHAPTERS = BOTS.length, PER_SEASON = 4;
  var COLORS = 'wwbwwbwbwbwbwwbw', FAST = [0, 30, 30, 35, 35, 40, 40, 50, 50]; // the player's colour by stage; "a quick win" by level
  function stage(ch) {
    var b = BOTS[ch - 1];
    if (!b) return null;
    return { ch: ch, season: Math.floor((ch - 1) / PER_SEASON), who: b.who, level: b.level, color: COLORS.charAt(ch - 1), elo: b.elo,
      boss: ch === CHAPTERS, goals: [['win'], ['joker'], ['fast', FAST[b.level]]] };
  }
  // r: { outcome, joker, moves (the player's own moves) }
  function goalMet(g, r) {
    if (r.outcome !== 1) return false;
    if (g[0] === 'joker') return !!r.joker;
    if (g[0] === 'fast') return r.moves <= g[1];
    return true;
  }
  function stageBits(ch, r) { var bits = 0; stage(ch).goals.forEach(function (g, i) { if (goalMet(g, r)) bits |= 1 << i; }); return bits; }
  function starsOf(bits) { return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1); }
  function careerStars(career) { var s = 0; for (var k in career) s += starsOf(career[k]); return s; }
  // all: every season is open whatever the stars (Pro, prototype)
  function seasonOpen(career, i, all) { return !!SEASONS[i] && (!!all || careerStars(career) >= SEASONS[i].need); }
  function seasonStars(career, i) { var s = 0; for (var k = 1; k <= PER_SEASON; k++) s += starsOf(career[i * PER_SEASON + k] || 0); return s; }
  function isOpen(career, ch, all) { var sg = stage(ch); return !!sg && seasonOpen(career, sg.season, all); }
  // where to carry on: the first opponent of the open seasons not beaten yet; all of them beaten: the first one still
  // missing a star (none left: null). Missing stars never pull the main button back while someone is unbeaten.
  function nextStage(career, all) {
    var ch;
    for (ch = 1; ch <= CHAPTERS; ch++) if (isOpen(career, ch, all) && !(career[ch] & 1)) return stage(ch);
    for (ch = 1; ch <= CHAPTERS; ch++) if (isOpen(career, ch, all) && starsOf(career[ch] || 0) < 3) return stage(ch);
    return null;
  }
  // a finished stage game: the goals met now, the best kept; returns { bits, newStars, best, opened (a season) }
  function recordStage(career, ch, r, all) {
    var before = career[ch] || 0, now = stageBits(ch, r), best = before | now, was = [0, 1, 2, 3].map(function (i) { return seasonOpen(career, i, all); });
    if (best) career[ch] = best;
    var opened = -1;
    for (var i = 0; i < SEASONS.length; i++) if (!was[i] && seasonOpen(career, i, all)) opened = i;
    return { bits: now, newStars: starsOf(best) - starsOf(before), best: best, opened: opened };
  }

  // ---- the coach's puzzles (the Learn tab): XP the first time the player finds a puzzle's Joker Move (an answer that
  // was shown earns nothing, and the puzzle can still be earned later), more for the harder ones, a little on top for
  // a clean solve: no hint, no miss. p: the puzzle (lvl 1..3); r: { shown, hint, wrong }
  var PUZZLE_XP = [0, 10, 15, 20], CLEAN_XP = 5;
  function puzzleXp(p, r) {
    if (r.shown) return 0;
    return PUZZLE_XP[Math.max(1, Math.min(3, p.lvl || 1))] + (!r.hint && !r.wrong ? CLEAN_XP : 0);
  }

  // ---- the progress on the account: what this device keeps, merged with what the account has from another device.
  // Nothing earned is lost: the larger XP, every star and Joker card of either side, every puzzle solved, every day
  // played. (XP earned apart on two devices is not added up: the larger count stays.) Where only one side can win
  // (what is worn, the bots' scores), it is a, this device.
  // a save: { v, prog: { xp, career, cards, q, firstWin, equip, seen }, days: [day], puzzles: { id: 1 found | 2 shown },
  //   dailyDone: { day: puzzle id }, stats: { key: { w, d, l } } }
  function num(x) { x = Math.floor(+x); return x > 0 && isFinite(x) ? x : 0; }
  function mergeSave(a, b) {
    a = a || {}; b = b || {};
    var pa = a.prog || {}, pb = b.prog || {}, prog = { xp: Math.max(num(pa.xp), num(pb.xp)), career: {}, cards: {} }, k;
    [pb.career, pa.career].forEach(function (c) { for (var k in c || {}) if (stage(+k) && (c[k] & 7)) prog.career[+k] = (prog.career[+k] || 0) | (c[k] & 7); });
    [pb.cards, pa.cards].forEach(function (c) { for (var k in c || {}) if (num(c[k])) prog.cards[k] = Math.max(prog.cards[k] || 0, num(c[k])); });
    var qa = pa.q && pa.q.day ? pa.q : null, qb = pb.q && pb.q.day ? pb.q : null;
    if (qa && qb && qa.day === qb.day) {
      prog.q = { day: qa.day, ids: (qa.ids || []).slice(), p: {}, done: {} };
      prog.q.ids.forEach(function (id) {
        var n = Math.max(num((qa.p || {})[id]), num((qb.p || {})[id]));
        if (n) prog.q.p[id] = n;
        if ((qa.done || {})[id] || (qb.done || {})[id]) prog.q.done[id] = true;
      });
    } else prog.q = (qa && (!qb || qa.day > qb.day) ? qa : qb) || null;
    prog.firstWin = String(pa.firstWin || '') > String(pb.firstWin || '') ? String(pa.firstWin) : String(pb.firstWin || pa.firstWin || '');
    prog.equip = {};
    [pb.equip, pa.equip].forEach(function (e) { for (var k in e || {}) if (e[k]) prog.equip[k] = e[k]; });
    var sa = pa.seen || {}, sb = pb.seen || {};
    prog.seen = { lv: Math.max(num(sa.lv), num(sb.lv), 1), stars: Math.max(num(sa.stars), num(sb.stars)) };
    var out = { v: 1, prog: prog, days: [], puzzles: {}, dailyDone: {}, stats: {} }, seen = {};
    (a.days || []).concat(b.days || []).forEach(function (d) { if (typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) && !seen[d]) { seen[d] = 1; out.days.push(d); } });
    out.days = out.days.sort().slice(-400);
    [b.puzzles, a.puzzles].forEach(function (m) { for (var k in m || {}) if (m[k]) out.puzzles[k] = out.puzzles[k] === 1 || m[k] !== 2 ? 1 : 2; });
    var dd = {}; [b.dailyDone, a.dailyDone].forEach(function (m) { for (var k in m || {}) dd[k] = m[k]; });
    Object.keys(dd).sort().slice(-60).forEach(function (k) { out.dailyDone[k] = dd[k]; });
    var games = function (x) { return x ? num(x.w) + num(x.d) + num(x.l) : 0; };
    [b.stats, a.stats].forEach(function (m) { for (var k in m || {}) if (games(m[k]) >= games(out.stats[k]) && games(m[k])) out.stats[k] = { w: num(m[k].w), d: num(m[k].d), l: num(m[k].l) }; });
    return out;
  }
  // the same save in the same words, whatever order its parts were written in (to tell whether anything changed)
  function saveKey(x) {
    return JSON.stringify(x, function (k, v) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
      var o = {}; Object.keys(v).sort().forEach(function (n) { o[n] = v[n]; }); return o;
    });
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
      x_game: 'Game', x_win: 'Win', x_draw: 'Draw', x_joker: 'Joker Move played', x_firstWin: 'First win of the day ×2', x_star: 'New stars', x_quest: 'Quest done', x_card: 'New Joker card', x_puzzle: 'Puzzle', x_daily: 'Daily puzzle', x_review: 'Game review',
      q_daily: 'Solve the daily puzzle', q_puzzles3: 'Solve {n} puzzles', q_win2: 'Win {n} games', q_games3: 'Play {n} games', q_online: 'Play a game online', q_star: 'Earn a star', q_hist: 'Solve a puzzle from a real game',
      q_joker2: 'Play your Joker Move in {n} games', q_jokerwin: 'Win a game with your Joker Move', q_clean: 'Win without losing your queen', q_review: 'Open a game review',
      q_p_win3: 'Win {n} games', q_p_joker3: 'Play your Joker Move in {n} games', q_p_puzzles5: 'Solve {n} puzzles',
      g_win: 'Win', g_joker: 'Win with your Joker Move', g_fast: 'Win in {n} moves or fewer',
     
      s_school: 'School', s_park: 'The park', s_tour: 'The tournament', s_legends: 'Legends',
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
      t_teleporter: 'Teleporter', t_trickster: 'Trickster', t_tactician: 'Tactician', t_jokermaster: 'Joker Master', t_diamond: 'Diamond Joker', t_climber: 'Climber',
      t_pro: 'Joker Pro', f_pro: 'Pro gold', j_gold: 'Gold comet', b_royal: 'Royal', b_onyx: 'Onyx' // the looks only Pro has (prototype, src/pro.js)
    },
    ru: {
      rank_pawn: 'Пешка', rank_knight: 'Конь', rank_bishop: 'Слон', rank_rook: 'Ладья', rank_queen: 'Ферзь', rank_king: 'Король', rank_joker: 'Джокер', rank_diamond: 'Бриллиантовый Джокер',
      level: 'Уровень {n}', xp: '{n} XP', xpOf: '{a} / {b} XP', xpGain: '+{n} XP',
      x_game: 'Партия', x_win: 'Победа', x_draw: 'Ничья', x_joker: 'Сыгран ход-джокер', x_firstWin: 'Первая победа дня ×2', x_star: 'Новые звёзды', x_quest: 'Задание выполнено', x_card: 'Новая карта джокера', x_puzzle: 'Задача', x_daily: 'Задача дня', x_review: 'Разбор партии',
      q_daily: 'Реши задачу дня', q_puzzles3: 'Реши задач: {n}', q_win2: 'Выиграй партий: {n}', q_games3: 'Сыграй партий: {n}', q_online: 'Сыграй партию онлайн', q_star: 'Получи звезду', q_hist: 'Реши задачу из настоящей партии',
      q_joker2: 'Сыграй ход-джокер в партиях: {n}', q_jokerwin: 'Выиграй партию ходом-джокером', q_clean: 'Выиграй, не потеряв ферзя', q_review: 'Открой разбор партии',
      q_p_win3: 'Выиграй партий: {n}', q_p_joker3: 'Сыграй ход-джокер в партиях: {n}', q_p_puzzles5: 'Реши задач: {n}',
      g_win: 'Победа', g_joker: 'Победа с ходом-джокером', g_fast: 'Победа не дольше {n} ходов',
     
      s_school: 'Школа', s_park: 'Парк', s_tour: 'Турнир', s_legends: 'Легенды',
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
      t_teleporter: 'Телепортист', t_trickster: 'Ловкач', t_tactician: 'Тактик', t_jokermaster: 'Мастер джокера', t_diamond: 'Бриллиантовый Джокер', t_climber: 'Восходящий',
      t_pro: 'Joker Pro', f_pro: 'Золото Pro', j_gold: 'Золотая комета', b_royal: 'Королевская', b_onyx: 'Оникс'
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
    newRewards: newRewards, nextReward: nextReward, QUESTS: QUESTS, questsFor: questsFor, proQuestFor: proQuestFor, questStep: questStep, applyQuests: applyQuests,
    BOTS: BOTS, bot: bot, levelBot: levelBot, CHAPTERS: CHAPTERS, SEASONS: SEASONS, PER_SEASON: PER_SEASON, stage: stage, goalMet: goalMet, stageBits: stageBits, starsOf: starsOf, isOpen: isOpen,
    seasonOpen: seasonOpen, seasonStars: seasonStars,
    puzzleXp: puzzleXp, mergeSave: mergeSave, saveKey: saveKey,
    careerStars: careerStars, nextStage: nextStage, recordStage: recordStage, CARDS: CARDS, CARD_XP: CARD_XP, rarityOf: rarityOf,
    classify: classify, TEXT: TEXT, t: t, questText: questText, goalText: goalText, rewardName: rewardName, rankName: rankName };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
