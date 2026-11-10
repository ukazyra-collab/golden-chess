/* Joker Chess — the Learn tab: what the Joker Move is, autoplay boards that show it, and one-move puzzles.
 * Positions and answers were checked with the engine (see README): every accepted answer wins or saves the game,
 * every other Joker Move falls short.
 */
var GCLearn = (function () {
  'use strict';
  var F_GOLDEN = GC.F_GOLDEN;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function sq(name) { return 'abcdefgh'.indexOf(name[0]) + (+name[1] - 1) * 16; }

  // ---- content
  var DEMOS = {
    // the golden rook pins the queen to the king
    hero: { fen: '4k2r/pp2qppp/8/8/8/8/PP3PPP/R2Q2K1 w - - 0 1 G', glow: 0, cap0: 'heroCap1',
      steps: [{ sel: 'a1', wait: 1500 }, { uci: 'a1e1*', cap: 'heroCap2', wait: 2400 }, { uci: 'e8f8', cap: 'heroCap3', wait: 1000 }, { uci: 'e1e7', wait: 2800 }] },
    // a check that only the Joker Move can stop (the rook block on g2 only draws: ...Qd1+ Rg1 Qd5+)
    block: { fen: '3q2k1/Q4ppp/8/8/8/6P1/PP2n2P/R6K b - - 0 1 G', glow: -1, cap0: 'r2Cap0',
      steps: [{ uci: 'd8d5', cap: 'r2Cap1', wait: 2200 }, { sel: 'a7', wait: 1400 }, { uci: 'a7g2*', cap: 'r2Cap2', wait: 3200 }] }
  };
  // the Play tab: a loop of Joker Moves that turn the game, easy one-movers first, combinations last
  // (every line checked with the engine: node test/reel_check.js)
  var REEL = [
    // 1. the rook teleports and pins the queen to the king
    { fen: '4k2r/pp2qppp/8/8/8/8/PP3PPP/R2Q2K1 w - - 0 1 G', glow: 0, cap0: 'reelPin0',
      steps: [{ sel: 'a1', wait: 1300 }, { uci: 'a1e1*', cap: 'reelPin', wait: 2200 }, { uci: 'e8f8', wait: 900 }, { uci: 'e1e7', cap: 'reelPin2', wait: 2400 }] },
    // 2. mate on the board, the rook teleports into the line
    { fen: '5rk1/5ppp/1Q6/8/P7/1B6/R4PPP/4q1K1 w - - 0 1 G', glow: 0, cap0: 'reelMate0',
      steps: [{ sel: 'a2', wait: 1300 }, { uci: 'a2f1*', cap: 'reelMate', wait: 2600 }] },
    // 3. the knight lands between the queen and a rook
    { fen: 'r1b1r1k1/1q1p1ppp/p7/1p6/4PB2/6P1/PP3P1P/1N1Q1RK1 w - - 0 1 G', glow: 0, cap0: 'reelFork0',
      steps: [{ sel: 'b1', wait: 1300 }, { uci: 'b1d6*', cap: 'reelFork', wait: 2400 }, { uci: 'b7c7', wait: 900 }, { uci: 'd6e8', cap: 'reelFork2', wait: 2400 }] },
    // 4. the bishop appears on the diagonal: the queen goes for a bishop
    { fen: '2r4k/1p3p1p/6p1/4q3/8/8/1P3PPP/R2R1BK1 w - - 0 1 G', glow: 0, cap0: 'reelDiag0',
      steps: [{ sel: 'f1', wait: 1300 }, { uci: 'f1d4*', cap: 'reelDiag', wait: 2400 }, { uci: 'e5d4', wait: 900 }, { uci: 'd1d4', cap: 'reelDiag2', wait: 2400 }] },
    // 5. a check that is mate in normal chess, blocked by a teleport
    { fen: '3q2k1/Q4ppp/8/8/8/6P1/PP2n2P/R6K b - - 0 1 G', glow: -1, cap0: 'reelBlock0',
      steps: [{ uci: 'd8d5', cap: 'reelBlock1', wait: 1800 }, { sel: 'a7', wait: 1200 }, { uci: 'a7g2*', cap: 'reelBlock', wait: 2600 }] },
    // 6. the knight drops in next to the king: Rxh7 mate cannot be stopped
    { fen: '1r5k/pppR3p/6p1/8/8/8/q4PP1/1NB3KR w - - 0 1 G', glow: 0, cap0: 'reelNet0',
      steps: [{ sel: 'b1', wait: 1300 }, { uci: 'b1f6*', cap: 'reelNet', wait: 2600 }, { uci: 'a2g8', cap: 'reelNet2', wait: 1500 }, { uci: 'd7h7', wait: 900 }, { uci: 'g8h7', wait: 900 }, { uci: 'h1h7', cap: 'reelNet3', wait: 2600 }] },
    // 7. both sides hold a Joker Move: White pins the queen, Black drops a rook into the line
    { fen: '2n1k2r/pp2qppp/8/8/8/8/PP3PPP/R2Q2K1 w - - 0 1 Gg', glow: 0, cap0: 'reelBoth0',
      steps: [{ sel: 'a1', wait: 1200 }, { uci: 'a1e1*', cap: 'reelBoth1', wait: 2400, refuted: true }, { sel: 'h8', wait: 1200 }, { uci: 'h8e4*', cap: 'reelBoth2', wait: 2400 }, { uci: 'e1e4', wait: 900 }, { uci: 'e7e4', cap: 'reelBoth3', wait: 2600 }] }
  ];
  REEL.forEach(function (d, i) { d.next = REEL[(i + 1) % REEL.length]; });
  // where a rook may teleport: gold dots; empty squares it may not use (they would give check): red crosses
  var RULE_DIAGRAM = { fen: '4k3/8/2n5/8/8/8/5PPP/R5K1 w - - 0 1 G', sel: 'a1' };
  // the three first ones explain themselves (they teach the move); the made-up ones after them (src/puzzles.js, made by
  // the engine: tools/puzzles) only say whose move it is, easy to hard
  var PUZZLES = [
    { id: 'i1', lvl: 1, fen: '2r3k1/RQ3ppp/8/8/8/8/5PPP/3q2K1 w - - 0 1 G', last: ['d5', 'd1'], prompt: 'p1Prompt', good: 'p1Good', hint: 'p1Hint',
      accept: { 'a7f1*': [], 'b7f1*': [] } },
    { id: 'i2', lvl: 1, fen: 'r4r1k/pb3p1p/1p4p1/4q3/8/8/PP3PPP/R1BQ1RK1 w - - 0 1 G', prompt: 'p2Prompt', good: 'p2Good', hint: 'p2Hint',
      accept: { 'c1d4*': ['e5d4', 'd1d4', 'h8g8'], 'c1c3*': ['e5c3', 'b2c3'] } },
    { id: 'i3', lvl: 1, fen: '6N1/k7/6K1/7P/8/8/2p5/8 w - - 0 1 G', prompt: 'p3Prompt', good: 'p3Good', hint: 'p3Hint',
      accept: { 'g8c1*': ['a7b7', 'h5h6', 'b7c6', 'h6h7', 'c6d5', 'h7h8q'], 'g8e2*': ['a7b6', 'h5h6', 'b6c5', 'h6h7', 'c5c4', 'h7h8q'],
        'g8a2*': ['a7b6', 'h5h6', 'b6c5', 'h6h7', 'c5d5', 'h7h8q'], 'g8d3*': ['a7b6', 'h5h6', 'b6b5', 'h6h7', 'b5c4', 'h7h8q'],
        'g8b3*': ['a7b6', 'h5h6', 'b6b5', 'b3c1', 'b5c4', 'h6h7'] } }
  ].concat(typeof JOKER_PUZZLES !== 'undefined' ? JOKER_PUZZLES : []);

  function speedOf(ctx) { return ctx.settings.anim === 'off' ? 0 : ctx.settings.anim === 'fast' ? 0.6 : 1; }
  function goldenTargets(pos, from) {
    return pos.legalMoves(true).filter(function (m) { return (m & F_GOLDEN) && (m & 127) === from; }).map(function (m) { return (m >> 7) & 127; });
  }
  function moveHints(pos, m) {
    var from = m & 127, to = (m >> 7) & 127, hints = [{ from: from, to: to, golden: !!(m & F_GOLDEN) }];
    if (m & GC.F_CASTLE) { var r = to > from ? [from + 3, from + 1] : [from - 4, from - 1]; hints.push({ from: r[0], to: r[1] }); }
    return hints;
  }

  // ---- a board sized to its box (BoardView reads the board size from --bs)
  function MiniBoard(host, opts) {
    this.wrap = el('div', 'mini-board' + (opts.demo ? ' demo' : ''));
    this.el = el('div', 'board');
    this.wrap.appendChild(this.el);
    host.appendChild(this.wrap);
    this.view = new BoardView(this.el, opts.handlers || {});
    this.view.setCoords(!!opts.coords);
    var self = this;
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { self.fit(); }) : null;
    if (this.ro) this.ro.observe(this.wrap);
    this.fit();
  }
  MiniBoard.prototype.fit = function () { var w = this.wrap.clientWidth; if (w) this.wrap.style.setProperty('--bs', w + 'px'); };
  MiniBoard.prototype.show = function (pos, hints, instant) { this.view.sync(pos.board, hints || [], instant ? { instantAll: true } : {}); };

  // ---- an autoplay board: plays a short script, holds, starts over; tap to restart
  function Demo(host, d, ctx, cap) {
    this.d = d; this.ctx = ctx; this.cap = cap || null;
    this.mb = new MiniBoard(host, { demo: true });
    this.timer = 0; this.running = false; this.visible = false; this.wanted = false;
    var self = this;
    this.mb.wrap.addEventListener('click', function () { if (self.running) { self.stop(); self.reset(); self.run(); } });
    this.reset();
  }
  Demo.prototype.reset = function () {
    this.pos = new GC.Position(this.d.fen); this.i = 0;
    this.mb.view.speed = speedOf(this.ctx);
    this.mb.show(this.pos, [], true);
    this.mb.view.setMarks([]); this.mb.view.setDots([]);
    this.mb.view.markGolden(this.d.glow != null ? this.d.glow : -1);
    if (this.cap) setCap(this.cap, this.d.cap0 ? this.ctx.T(this.d.cap0) : '&nbsp;');
  };
  // the caption fades out and comes back with the new text (the line itself keeps its place)
  function setCap(el, html) {
    if (el.innerHTML === html) return;
    if (!el.innerHTML || el.innerHTML === '&nbsp;' || !el.isConnected) { el.innerHTML = html; return; }
    el.classList.add('swap');
    clearTimeout(el._swap);
    el._swap = setTimeout(function () { el.innerHTML = html; el.classList.remove('swap'); }, 130);
  }
  Demo.prototype.step = function () {
    var self = this, s = this.d.steps[this.i], v = this.mb.view;
    if (!s) {
      // the script is over: hold, then start again (a chained script goes on to the next one)
      this.timer = setTimeout(function () { if (self.d.next) self.d = self.d.next; self.reset(); self.timer = setTimeout(function () { self.step(); }, 1300); }, 400);
      return;
    }
    this.i++;
    if (s.sel) {
      var from = sq(s.sel);
      v.setMarks([{ sq: from, cls: 'hl-sel' }]);
      v.setDots(goldenTargets(this.pos, from).map(function (t) { return { sq: t, cls: 'gdot' }; }));
    } else {
      var m = this.pos.moveFromUci(s.uci);
      if (!m) { this.i = this.d.steps.length; this.step(); return; }
      var gold = !!(m & F_GOLDEN), hints = moveHints(this.pos, m);
      this.pos.makeMove(m);
      this.mb.show(this.pos, hints);
      var marks = [{ sq: hints[0].from, cls: gold ? 'hl-gold' : 'hl-last' }, { sq: hints[0].to, cls: gold ? 'hl-gold' : 'hl-last' }];
      if (this.pos.inCheck()) marks.push({ sq: this.pos.kings[this.pos.side], cls: 'hl-check' });
      v.setMarks(marks); v.setDots([]);
      v.markGolden(this.pos.goldenAvailable(this.pos.side) ? this.pos.side : -1);
    }
    if (this.cap && s.cap) setCap(this.cap, this.ctx.T(s.cap));
    this.timer = setTimeout(function () { self.step(); }, s.wait || 1500);
  };
  Demo.prototype.run = function () { if (this.running) return; this.running = true; var self = this; this.timer = setTimeout(function () { self.step(); }, 1300); };
  Demo.prototype.stop = function () { this.running = false; clearTimeout(this.timer); };
  Demo.prototype.update = function () {
    var on = this.wanted && this.visible && !document.hidden;
    if (on && !this.running) { this.reset(); this.run(); } else if (!on && this.running) this.stop();
  };

  // ---- a one-move puzzle: only Joker Moves, the side to move's pieces glow
  function Puzzle(boardHost, p, ctx, ui) {
    this.p = p; this.ctx = ctx; this.ui = ui;
    this.selected = -1; this.locked = false; this.solved = false; this.timers = [];
    var self = this;
    this.mb = new MiniBoard(boardHost, { coords: false, handlers: {
      onAny: function () { ctx.Sound.unlock(); },
      onDown: function (s) { return self.down(s); },
      onDrop: function (from, to) { return self.drop(from, to); }
    } });
    this.reset();
  }
  Puzzle.prototype.clearTimers = function () { this.timers.forEach(clearTimeout); this.timers = []; };
  Puzzle.prototype.later = function (fn, ms) { this.timers.push(setTimeout(fn, ms)); };
  Puzzle.prototype.reset = function () {
    this.clearTimers();
    this.pos = new GC.Position(this.p.fen); this.selected = -1; this.locked = false; this.solved = false;
    this.mb.view.speed = speedOf(this.ctx);
    this.mb.view.setOrientation(this.pos.side); // the side to move at the bottom
    this.mb.show(this.pos, [], true);
    this.mb.el.classList.add('pz-glow');
    this.mb.view.markGolden(this.pos.side);
    this.paint();
  };
  Puzzle.prototype.baseMarks = function () {
    var marks = [];
    if (this.p.last) marks.push({ sq: sq(this.p.last[0]), cls: 'hl-last' }, { sq: sq(this.p.last[1]), cls: 'hl-last' });
    if (this.pos.inCheck()) marks.push({ sq: this.pos.kings[this.pos.side], cls: 'hl-check' });
    if (this.hinted && !this.solved) marks.push({ sq: sq(Object.keys(this.p.accept)[0].slice(0, 2)), cls: 'hl-hint' });
    return marks;
  };
  Puzzle.prototype.hint = function () { this.hinted = true; this.paint(); };
  Puzzle.prototype.paint = function () {
    var marks = this.baseMarks(), dots = [];
    if (this.selected >= 0) {
      marks.push({ sq: this.selected, cls: 'hl-sel' });
      dots = goldenTargets(this.pos, this.selected).map(function (t) { return { sq: t, cls: 'gdot' }; });
    }
    this.mb.view.setMarks(marks); this.mb.view.setDots(dots);
  };
  Puzzle.prototype.canPick = function (s) {
    var pc = this.pos.board[s];
    return pc && (pc >> 3) === this.pos.side && (pc & 7) >= 2 && (pc & 7) <= 5;
  };
  Puzzle.prototype.down = function (s) {
    if (this.locked || this.solved) return null;
    if (this.selected >= 0 && s !== this.selected && goldenTargets(this.pos, this.selected).indexOf(s) >= 0) { this.play(this.selected, s); return null; }
    if (this.canPick(s)) { this.selected = s; this.ctx.Sound.play('select'); this.paint(); return { drag: true, gold: true }; }
    this.selected = -1; this.paint();
    return null;
  };
  Puzzle.prototype.drop = function (from, to) {
    if (this.locked || this.solved || goldenTargets(this.pos, from).indexOf(to) < 0) return false;
    this.play(from, to);
    return true;
  };
  Puzzle.prototype.play = function (from, to) {
    var m = this.pos.legalMoves(true).filter(function (x) { return (x & F_GOLDEN) && (x & 127) === from && ((x >> 7) & 127) === to; })[0];
    if (!m) return;
    var uci = GC.moveToUci(m), self = this, T = this.ctx.T;
    this.selected = -1; this.locked = true;
    this.pos.makeMove(m);
    this.mb.show(this.pos, moveHints(this.pos, m));
    this.mb.el.classList.remove('pz-glow'); this.mb.view.markGolden(-1);
    this.mb.view.setDots([]);
    var cont = this.p.accept[uci];
    if (cont) {
      // right: the Joker's gold, its sound, "Found it" on the board itself, a win chime when the line has played out
      this.mb.view.setMarks([{ sq: from, cls: 'hl-gold' }, { sq: to, cls: 'hl-gold' }]);
      this.ctx.Sound.play('golden');
      this.solved = true;
      this.ui.flash(T('pzYes'), 'good');
      this.ui.status(this.ui.goodText(this.p), 'good');
      var t = 900;
      cont.forEach(function (u) {
        self.later(function () {
          var mm = self.pos.moveFromUci(u); if (!mm) return;
          var cap = !!(mm & GC.F_CAPTURE), hints = moveHints(self.pos, mm);
          self.pos.makeMove(mm);
          self.mb.show(self.pos, hints);
          var marks = [{ sq: hints[0].from, cls: 'hl-last' }, { sq: hints[0].to, cls: 'hl-last' }];
          if (self.pos.inCheck()) marks.push({ sq: self.pos.kings[self.pos.side], cls: 'hl-check' });
          self.mb.view.setMarks(marks);
          self.ctx.Sound.play(cap ? 'capture' : 'move');
        }, t);
        t += 850;
      });
      this.later(function () { self.ctx.Sound.play('win'); self.ui.solved(); }, Math.max(600, t - 500));
    } else {
      // wrong: red squares, the error sound, "Not this one" on the board, and the piece goes straight back
      this.mb.view.setMarks([{ sq: from, cls: 'hl-bad' }, { sq: to, cls: 'hl-bad' }]);
      this.ctx.Sound.play('illegal');
      this.ui.flash(T('pzNo'), 'bad');
      this.ui.status(T('badMove'), 'bad');
      this.later(function () {
        self.pos.unmakeMove();
        self.mb.show(self.pos, [{ from: to, to: from }]);
        self.mb.el.classList.add('pz-glow'); self.mb.view.markGolden(self.pos.side);
        self.locked = false; self.paint();
        self.ui.wrong();
      }, 850);
    }
  };
  Puzzle.prototype.answer = function () {
    if (this.solved) return;
    this.reset();
    var u = Object.keys(this.p.accept)[0], m = this.pos.moveFromUci(u), self = this;
    this.selected = m & 127; this.paint();
    this.locked = true;
    this.later(function () { self.locked = false; self.play(m & 127, (m >> 7) & 127); }, 700);
  };

  function create(ctx) {
    var T = ctx.T, esc = ctx.esc;
    var demos = [], playDemo = null, view = '', io = null, puzzle = null, pIndex = 0;
    var done = {};
    try { done = JSON.parse(localStorage.getItem('goldenchess.puzzles') || '{}') || {}; } catch (e) { done = {}; }
    // solved puzzles by id (the first version kept the three of then by their place: 0, 1, 2)
    ['0', '1', '2'].forEach(function (k, i) { if (done[k]) { done['i' + (i + 1)] = 1; delete done[k]; } });
    function saveDone() { try { localStorage.setItem('goldenchess.puzzles', JSON.stringify(done)); } catch (e) { /* ignore */ } }
    // where the player is: the puzzle open last time, else the first one not solved yet
    (function () {
      var at = -1;
      try { var id = localStorage.getItem('goldenchess.puzzleAt'); for (var k = 0; k < PUZZLES.length; k++) if (PUZZLES[k].id === id) at = k; } catch (e) { /* ignore */ }
      if (at < 0) for (var j = 0; j < PUZZLES.length; j++) if (!done[PUZZLES[j].id]) { at = j; break; }
      pIndex = Math.max(0, at);
    })();
    function savePlace() { try { localStorage.setItem('goldenchess.puzzleAt', PUZZLES[pIndex].id); } catch (e) { /* ignore */ } }
    function watch(d) {
      if (!io && typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { var x = en.target.__demo; if (x) { x.visible = en.isIntersecting; x.update(); } });
        }, { threshold: 0.35 });
      }
      d.mb.wrap.__demo = d;
      if (io) io.observe(d.mb.wrap); else d.visible = true;
    }
    document.addEventListener('visibilitychange', function () { demos.forEach(function (d) { d.update(); }); if (playDemo) playDemo.update(); });

    function section(title) { var s = el('section'); s.appendChild(el('h2', null, esc(title))); return s; }
    function staticDiagram(host) {
      var mb = new MiniBoard(host, { demo: true }), pos = new GC.Position(RULE_DIAGRAM.fen), from = sq(RULE_DIAGRAM.sel);
      mb.view.speed = 0;
      mb.show(pos, [], true);
      var ok = goldenTargets(pos, from), marks = [{ sq: from, cls: 'hl-sel' }], dots = ok.map(function (t) { return { sq: t, cls: 'gdot' }; });
      for (var s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } if (!pos.board[s] && ok.indexOf(s) < 0) marks.push({ sq: s, cls: 'xmark' }); }
      mb.view.setMarks(marks); mb.view.setDots(dots);
      return mb;
    }
    function starsArt() {
      var star = function (lit) {
        return '<svg viewBox="0 0 100 100" aria-hidden="true"><g ' + (lit ? 'fill="var(--gold)" stroke="var(--gold)"' : 'fill="#93a39f" stroke="#93a39f" opacity=".55"') + '>' +
          '<rect x="24" y="90" width="52" height="9" rx="4"/> <rect x="24" y="90" width="52" height="5" rx="3"/> <rect x="30" y="84" width="40" height="8" rx="3"/> <path d="M40 86 L41 70 L59 70 L60 86 Z"/> <path d="M43 86 L44 72 L56 72 L57 86 Z"/> <path d="M31 40 C25 35 25 27 30 25 C34 28 36 34 36 40 Z"/> <path d="M69 40 C75 35 75 27 70 25 C66 28 64 34 64 40 Z"/> <circle cx="50" cy="54" r="27"/> <circle cx="50" cy="56" r="21"/> <ellipse cx="50" cy="66" rx="14" ry="9"/> <path d="M40 67 C44 74 56 74 60 67" stroke-width="2.8" stroke-linecap="round"/> <circle cx="50" cy="60" r="7"/> <ellipse cx="47.4" cy="57.4" rx="2" ry="1.4" /> <ellipse cx="41" cy="49" rx="4.8" ry="5.2"/><ellipse cx="59" cy="49" rx="4.8" ry="5.2"/> <circle cx="41.6" cy="49.6" r="3.2"/><circle cx="59.6" cy="49.6" r="3.2"/> <circle cx="42.8" cy="48.2" r="1.1"/><circle cx="60.8" cy="48.2" r="1.1"/> <path d="M35.5 42.5 C38.5 39.5 43.5 39.5 46 41.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M54 41.5 C56.5 39.5 61.5 39.5 64.5 42.5" stroke-width="2.3" stroke-linecap="round"/> <path d="M34 30 C26 24 14 20 6 24 C14 26 20 30 26 36 Z"/> <path d="M35 34 C45 31 48.5 20 50 2 C51.5 20 55 31 65 34 Z"/> <path d="M66 30 C74 24 86 20 94 24 C86 26 80 30 74 36 Z"/> <path d="M29 35 C40 26 60 26 71 35 L71 39 C60 31 40 31 29 39 Z"/> <circle cx="6" cy="24" r="3.2" stroke-width=".8"/> <circle cx="50" cy="3.5" r="3.2" stroke-width=".8"/> <circle cx="94" cy="24" r="3.2" stroke-width=".8"/></g></svg>';
      };
      return el('div', 'stars-art', '<div class="row">' + star(true) + '<span>' + esc(T('white')) + '<small>' + esc(T('inHand')) + '</small></span></div>' +
        '<div class="row">' + star(false) + '<span>' + esc(T('black')) + '<small>' + esc(T('usedUp')) + '</small></span></div>');
    }

    var wantDaily = false; // asked for from outside (the daily board on Play): the next render opens the daily puzzle
    function showDaily() { wantDaily = true; }
    function render(host) {
      demos.forEach(function (d) { d.stop(); if (io) io.unobserve(d.mb.wrap); });
      demos = [];
      if (puzzle) { puzzle.clearTimers(); puzzle = null; }
      host.innerHTML = '';
      var inn = el('div', 'page-in learn');
      host.appendChild(inn);

      // the first screen: the tab's name, the rule in one line, and straight into the puzzles (the Play tab already
      // shows what a Joker Move looks like); the rule in full, why it matters and every rule follow below
      var ts = el('section', 'learn-hero');
      ts.id = 'try';
      var ht = el('div', 'hero-text');
      ht.appendChild(el('h1', 'page-h', esc(T('navLearn'))));
      ht.appendChild(el('p', 'lead', esc(T('learnLead'))));
      ts.appendChild(ht);
      // which puzzle, how hard, how many solved: one line (there are too many for a row of numbers)
      // the daily puzzle: the same for everyone today. Played first when it isn't solved yet (a newcomer starts with the
      // easy ones and finds it on the line above them); once solved, the line says so and opens the streak
      var dailyNow = ctx.daily ? ctx.daily() : null, inDaily = false;
      var dLine = el('button', 'daily-line'); dLine.type = 'button'; dLine.id = 'daily-line';
      if (dailyNow) ts.appendChild(dLine);
      function drawDailyLine() {
        if (!dailyNow) return;
        var sl = ctx.streakLine ? ctx.streakLine() : null;
        dLine.classList.toggle('done', !!dailyNow.solved); dLine.classList.toggle('here', inDaily);
        dLine.innerHTML = '<span class="dl-t"><b>' + esc(T('dailyN', { n: dailyNow.n })) + '</b><span class="try-lvl l' + dailyNow.lvl + '">' + esc(T(['', 'lvlEasy', 'lvlMedium', 'lvlHard'][dailyNow.lvl])) + '</span></span>' +
          '<span class="dl-s">' + (sl ? '<span class="dl-flame">' + sl.html + '</span>' : '') + (dailyNow.solved ? '<span class="dl-ok">\u2713 ' + esc(T('dailySolvedLine')) + '</span>' : inDaily ? '' : '<span class="dl-go">' + esc(T('dailyOpen')) + '</span>') + '</span>';
      }
      dLine.addEventListener('click', function () {
        if (!dailyNow) return;
        if (dailyNow.solved || inDaily) { if (ctx.streakSheet) ctx.streakSheet(); return; }
        if (ctx.track) ctx.track('daily_open', { from: 'learn' });
        openDaily();
      });
      var head = el('div', 'try-head'), tTitle = el('div', 'try-title'), tCount = el('div', 'try-count');
      head.appendChild(tTitle); head.appendChild(tCount); ts.appendChild(head);
      // how far along: a thin bar of solved puzzles, the Joker walking along it; where Medium and Hard begin, marked
      var prog = el('div', 'try-prog'), pFill = el('i', 'tp-fill'), pWalk = el('span', 'tp-walk');
      prog.setAttribute('aria-hidden', 'true');
      pWalk.innerHTML = ctx.piece ? ctx.piece() : '';
      prog.appendChild(pFill);
      [2, 3].forEach(function (lv) {
        for (var q = 0; q < PUZZLES.length; q++) if ((PUZZLES[q].lvl || 1) >= lv) { var mk = el('b', 'tp-mark'); mk.style.left = (q / PUZZLES.length * 100).toFixed(2) + '%'; prog.appendChild(mk); break; }
      });
      prog.appendChild(pWalk); ts.appendChild(prog);
      var body = el('div', 'try-body'), bhost = el('div', 'try-host'), side = el('div', 'try-side');
      var prompt = el('div', 'try-prompt'), status = el('div', 'try-status'), acts = el('div', 'try-actions');
      side.appendChild(prompt); side.appendChild(status); side.appendChild(acts);
      body.appendChild(bhost); body.appendChild(side); ts.appendChild(body);
      inn.appendChild(ts);
      function btn(label, cls, fn, id) { var b = el('button', 'sbtn' + (cls ? ' ' + cls : ''), esc(label)); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; }
      var LVL = ['', 'lvlEasy', 'lvlMedium', 'lvlHard'];
      function solvedCount() { return PUZZLES.filter(function (p) { return done[p.id]; }).length; }
      function drawHead() {
        drawDailyLine();
        prog.style.visibility = inDaily ? 'hidden' : '';
        dLine.hidden = inDaily;
        if (inDaily) {
          tTitle.innerHTML = esc(T('dailyN', { n: dailyNow.n })) + '<span class="try-lvl l' + dailyNow.lvl + '">' + esc(T(['', 'lvlEasy', 'lvlMedium', 'lvlHard'][dailyNow.lvl])) + '</span>';
          var dt = new Date(); try { tCount.textContent = dt.toLocaleDateString(document.documentElement.lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { tCount.textContent = ''; }
          return;
        }
        var p = PUZZLES[pIndex];
        tTitle.innerHTML = esc(T('puzzleN', { n: pIndex + 1 })) + '<span class="try-lvl l' + (p.lvl || 1) + '">' + esc(T(LVL[p.lvl || 1])) + '</span>';
        tCount.textContent = T('solvedOf', { n: solvedCount(), total: PUZZLES.length });
        var at = ((pIndex + 0.5) / PUZZLES.length * 100).toFixed(2) + '%';
        pFill.style.width = (solvedCount() / PUZZLES.length * 100).toFixed(2) + '%';
        pWalk.style.left = at;
      }
      function nextIndex() {
        for (var k = 1; k <= PUZZLES.length; k++) { var j = (pIndex + k) % PUZZLES.length; if (!done[PUZZLES[j].id]) return j; }
        return (pIndex + 1) % PUZZLES.length;
      }
      function actions(kind) {
        acts.innerHTML = '';
        if (kind === 'daily-solved') {
          acts.appendChild(btn(T('morePuzzles'), 'hot', function () { inDaily = false; open(pIndex); }, 'try-next'));
          return;
        }
        if (kind === 'solved') {
          if (solvedCount() < PUZZLES.length) acts.appendChild(btn(T('nextPuzzle'), 'hot', function () { open(nextIndex()); }, 'try-next'));
          else { status.textContent = ui.goodText(PUZZLES[pIndex]) + ' ' + T('allSolved'); acts.appendChild(btn(T('learnCta'), 'hot', function () { ctx.go('bots'); }, 'try-play')); }
          acts.appendChild(btn(T('tryAgain'), '', function () { open(pIndex); }, 'try-again'));
          return;
        }
        acts.appendChild(btn(T('puzzleHint'), '', function () {
          var p = inDaily ? dailyNow.p : PUZZLES[pIndex];
          status.className = 'try-status'; status.textContent = p.hint ? T(p.hint) : T('pzHint');
          if (!p.hint) puzzle.hint();
        }, 'try-hint'));
        acts.appendChild(btn(T('showAnswer'), '', function () { puzzle.answer(); }, 'try-answer'));
        // from the daily puzzle back to the series at any time (the daily stays a tap away on its line)
        if (inDaily) acts.appendChild(btn(T('puzzleSeries'), '', function () { inDaily = false; open(pIndex); }, 'try-series'));
      }
      var ui = {
        status: function (text, cls) { status.className = 'try-status' + (cls ? ' ' + cls : ''); status.textContent = text; },
        goodText: function (p) { return p.good ? T(p.good) : p.mate ? T('pzMate', { n: p.mate }) : T('pzGood'); },
        solved: function () {
          if (inDaily) {
            if (ctx.solveDaily) ctx.solveDaily(dailyNow);
            dailyNow.solved = true;
            status.textContent = T('dailyDone');
            drawHead(); actions('daily-solved');
            return;
          }
          var first = !done[PUZZLES[pIndex].id];
          done[PUZZLES[pIndex].id] = 1; saveDone(); drawHead(); actions('solved');
          if (ctx.track) ctx.track('puzzle_solved', { puzzle: PUZZLES[pIndex].id, first: first, solved: solvedCount() });
        },
        wrong: function () { /* keep the message until the next try */ },
        // right or wrong, said on the board itself, where the eyes are
        flash: function (text, cls) {
          if (!puzzle) return;
          var w = puzzle.mb.wrap, old = w.querySelector('.pz-flash'); if (old) old.remove();
          var f = el('div', 'pz-flash ' + cls, '<i aria-hidden="true">' + (cls === 'good' ? '\u2713' : '\u2715') + '</i>' + esc(text));
          f.setAttribute('role', 'status'); w.appendChild(f);
          setTimeout(function () { f.classList.add('out'); }, cls === 'good' ? 1300 : 750);
          setTimeout(function () { f.remove(); }, cls === 'good' ? 1700 : 1100);
        }
      };
      function openDaily() {
        inDaily = true;
        if (puzzle) puzzle.clearTimers();
        bhost.innerHTML = '';
        puzzle = new Puzzle(bhost, dailyNow.p, ctx, ui);
        puzzle.mb.wrap.classList.add('try-board'); puzzle.mb.wrap.id = 'try-board';
        prompt.textContent = T(puzzle.pos.side ? 'pzBlack' : 'pzWhite');
        ui.status('', '');
        drawHead(); actions('open'); fitTry();
      }
      function open(i) {
        inDaily = false;
        pIndex = i; savePlace();
        if (puzzle) puzzle.clearTimers();
        bhost.innerHTML = '';
        var p = PUZZLES[i];
        puzzle = new Puzzle(bhost, p, ctx, ui);
        puzzle.mb.wrap.classList.add('try-board'); puzzle.mb.wrap.id = 'try-board';
        prompt.textContent = p.prompt ? T(p.prompt) : T(puzzle.pos.side ? 'pzBlack' : 'pzWhite');
        ui.status('', '');
        drawHead(); actions('open'); fitTry();
      }
      // on a phone the first screen is the whole puzzle: the board takes the height the text and buttons leave
      function fitTry() {
        if (!inn.isConnected) return;
        if (window.innerWidth >= 760) { bhost.style.removeProperty('--try-board'); return; }
        var H = host.clientHeight - 18 - 12;
        var used = ht.offsetHeight + head.offsetHeight + prog.offsetHeight + 26 + side.offsetHeight + 14 * 4 + (dailyNow ? dLine.offsetHeight + 14 : 0);
        bhost.style.setProperty('--try-board', Math.max(240, Math.min(bhost.clientWidth || 9999, H - used)) + 'px');
      }
      if (typeof ResizeObserver !== 'undefined') { var tro = new ResizeObserver(function () { fitTry(); }); tro.observe(host); }
      // the daily puzzle first, unless it is solved or this is someone's first day (they start with the easy ones)
      // a player back from an earlier day starts on the daily puzzle, once a day (the daily line above the board opens it
      // any time); a new player goes through the series undisturbed, and a reload keeps the place in it
      var asked = wantDaily; wantDaily = false;
      if (dailyNow && !dailyNow.solved && (asked || (ctx.newcomer && !ctx.newcomer() && (!ctx.dailyAuto || ctx.dailyAuto())))) openDaily();
      else open(Math.min(pIndex, PUZZLES.length - 1));

      // the rule
      var rs = section(T('ruleH')), grid = el('div', 'rule-grid');
      var c1 = el('div', 'card rule-card'); staticDiagram(c1);
      c1.appendChild(el('h3', null, esc(T('r1T')))); c1.appendChild(el('p', null, esc(T('r1P'))));
      var c2 = el('div', 'card rule-card'), cap2 = el('div', 'demo-cap');
      var bd = new Demo(c2, DEMOS.block, ctx, cap2); c2.appendChild(cap2);
      c2.appendChild(el('h3', null, esc(T('r2T')))); c2.appendChild(el('p', null, esc(T('r2P'))));
      demos.push(bd);
      var c3 = el('div', 'card rule-card'); c3.appendChild(starsArt());
      c3.appendChild(el('h3', null, esc(T('r3T')))); c3.appendChild(el('p', null, esc(T('r3P'))));
      grid.appendChild(c1); grid.appendChild(c2); grid.appendChild(c3);
      rs.appendChild(grid); inn.appendChild(rs);

      // why it matters
      var ws = section(T('whyH')), ug = el('div', 'usp-grid');
      [1, 2, 3, 4].forEach(function (i) { ug.appendChild(el('div', 'usp', '<b>' + esc(T('u' + i + 'N')) + '</b><span>' + esc(T('u' + i + 'T')) + '</span>')); });
      ws.appendChild(ug);
      ws.appendChild(el('p', 'vs960', esc(T('vs960'))));
      inn.appendChild(ws);


      // every rule
      var rr = section(T('rulesH'));
      rr.className = 'rules-full';
      var ol = el('ol', 'rules');
      ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'premoveRule'].forEach(function (k) { ol.appendChild(el('li', null, '<span>' + esc(T(k)) + '</span>')); });
      rr.appendChild(ol); inn.appendChild(rr);

      var cta = el('button', 'start-btn learn-cta', esc(T('learnCta')));
      cta.type = 'button'; cta.id = 'learn-play';
      cta.addEventListener('click', function () { ctx.go('bots'); });
      inn.appendChild(cta);
      // the closing titles: where the game came from
      inn.appendChild(el('p', 'credits learn-credits', esc(T('credits'))));
      var pv = el('a', 'page-foot', esc(T('privacy'))); pv.href = ctx.privacyUrl ? ctx.privacyUrl() : 'privacy.html'; pv.target = '_blank'; pv.rel = 'noopener'; inn.appendChild(pv);

      demos.forEach(function (d) { d.wanted = view === 'learn'; watch(d); d.update(); });
    }
    // the Play tab: the reel of Joker Moves (one board, the scripts chained), its caption under the board
    function heroBoard(host, cap) {
      if (playDemo) { host.appendChild(playDemo.mb.wrap); playDemo.cap = cap || null; playDemo.mb.fit(); playDemo.stop(); playDemo.reset(); }
      else { playDemo = new Demo(host, REEL[0], ctx, cap || null); watch(playDemo); }
      playDemo.wanted = view === 'play'; playDemo.update();
    }
    // the Play tab for a returning player: today's daily puzzle on the board (the pieces that can jump glowing), a tap
    // opens it on the Learn tab
    function dailyBoard(host, d, onTap) {
      if (playDemo) { playDemo.stop(); playDemo.wanted = false; }
      var mb = new MiniBoard(host, { demo: true }), pos = new GC.Position(d.p.fen);
      mb.view.speed = 0;
      mb.view.setOrientation(pos.side);
      mb.show(pos, [], true);
      if (!d.solved) { mb.el.classList.add('pz-glow'); mb.view.markGolden(pos.side); }
      mb.wrap.classList.add('daily-board'); mb.wrap.id = 'daily-board';
      if (d.solved) mb.wrap.appendChild(el('div', 'daily-done', '<i>\u2713</i>'));
      mb.wrap.addEventListener('click', onTap);
      return mb;
    }
    function active(v) {
      view = v;
      demos.forEach(function (d) { d.wanted = v === 'learn'; d.update(); });
      if (playDemo) { playDemo.wanted = v === 'play' && playDemo.mb.wrap.isConnected; playDemo.update(); }
      if (puzzle && v !== 'learn') puzzle.clearTimers();
    }
    return { render: render, active: active, heroBoard: heroBoard, dailyBoard: dailyBoard, showDaily: showDaily, PUZZLES: PUZZLES };
  }
  return { create: create, DEMOS: DEMOS, PUZZLES: PUZZLES, REEL: REEL };
})();
