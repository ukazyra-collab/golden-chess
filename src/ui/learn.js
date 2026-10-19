/* Golden Chess — the Learn tab: what the golden move is, autoplay boards that show it, and one-move puzzles.
 * Positions and answers were checked with the engine (see README): every accepted answer wins or saves the game,
 * every other golden move falls short.
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
    // a check that only the golden move can stop (the rook block on g2 only draws: ...Qd1+ Rg1 Qd5+)
    block: { fen: '3q2k1/Q4ppp/8/8/8/6P1/PP2n2P/R6K b - - 0 1 G', glow: -1, cap0: 'r2Cap0',
      steps: [{ uci: 'd8d5', cap: 'r2Cap1', wait: 2200 }, { sel: 'a7', wait: 1400 }, { uci: 'a7g2*', cap: 'r2Cap2', wait: 3200 }] }
  };
  // where a rook may teleport: gold dots; empty squares it may not use (they would give check): red crosses
  var RULE_DIAGRAM = { fen: '4k3/8/2n5/8/8/8/5PPP/R5K1 w - - 0 1 G', sel: 'a1' };
  var PUZZLES = [
    { fen: '2r3k1/RQ3ppp/8/8/8/8/5PPP/3q2K1 w - - 0 1 G', last: ['d5', 'd1'], prompt: 'p1Prompt', good: 'p1Good', hint: 'p1Hint',
      accept: { 'a7f1*': [], 'b7f1*': [] } },
    { fen: 'r4r1k/pb3p1p/1p4p1/4q3/8/8/PP3PPP/R1BQ1RK1 w - - 0 1 G', prompt: 'p2Prompt', good: 'p2Good', hint: 'p2Hint',
      accept: { 'c1d4*': ['e5d4', 'd1d4', 'h8g8'], 'c1c3*': ['e5c3', 'b2c3'] } },
    { fen: '6N1/k7/6K1/7P/8/8/2p5/8 w - - 0 1 G', prompt: 'p3Prompt', good: 'p3Good', hint: 'p3Hint',
      accept: { 'g8c1*': ['a7b7', 'h5h6', 'b7c6', 'h6h7', 'c6d5', 'h7h8q'], 'g8e2*': ['a7b6', 'h5h6', 'b6c5', 'h6h7', 'c5c4', 'h7h8q'],
        'g8a2*': ['a7b6', 'h5h6', 'b6c5', 'h6h7', 'c5d5', 'h7h8q'], 'g8d3*': ['a7b6', 'h5h6', 'b6b5', 'h6h7', 'b5c4', 'h7h8q'],
        'g8b3*': ['a7b6', 'h5h6', 'b6b5', 'b3c1', 'b5c4', 'h6h7'] } }
  ];

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
    if (this.cap) this.cap.innerHTML = this.d.cap0 ? this.ctx.T(this.d.cap0) : '&nbsp;';
  };
  Demo.prototype.step = function () {
    var self = this, s = this.d.steps[this.i], v = this.mb.view;
    if (!s) {
      this.timer = setTimeout(function () { self.reset(); self.timer = setTimeout(function () { self.step(); }, 1300); }, 400);
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
      if (gold) v.markGolden(-1);
    }
    if (this.cap && s.cap) this.cap.innerHTML = this.ctx.T(s.cap);
    this.timer = setTimeout(function () { self.step(); }, s.wait || 1500);
  };
  Demo.prototype.run = function () { if (this.running) return; this.running = true; var self = this; this.timer = setTimeout(function () { self.step(); }, 1300); };
  Demo.prototype.stop = function () { this.running = false; clearTimeout(this.timer); };
  Demo.prototype.update = function () {
    var on = this.wanted && this.visible && !document.hidden;
    if (on && !this.running) { this.reset(); this.run(); } else if (!on && this.running) this.stop();
  };

  // ---- a one-move puzzle: only golden moves, the side to move's pieces glow
  function Puzzle(boardHost, p, ctx, ui) {
    this.p = p; this.ctx = ctx; this.ui = ui;
    this.selected = -1; this.locked = false; this.solved = false; this.timers = [];
    var self = this;
    this.mb = new MiniBoard(boardHost, { coords: true, handlers: {
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
    this.mb.show(this.pos, [], true);
    this.mb.el.classList.add('armed');
    this.mb.view.markGolden(this.pos.side);
    this.paint();
  };
  Puzzle.prototype.baseMarks = function () {
    var marks = [];
    if (this.p.last) marks.push({ sq: sq(this.p.last[0]), cls: 'hl-last' }, { sq: sq(this.p.last[1]), cls: 'hl-last' });
    if (this.pos.inCheck()) marks.push({ sq: this.pos.kings[this.pos.side], cls: 'hl-check' });
    return marks;
  };
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
    this.mb.el.classList.remove('armed'); this.mb.view.markGolden(-1);
    this.mb.view.setMarks([{ sq: from, cls: 'hl-gold' }, { sq: to, cls: 'hl-gold' }]); this.mb.view.setDots([]);
    this.ctx.Sound.play('golden');
    var cont = this.p.accept[uci];
    if (cont) {
      this.solved = true;
      this.ui.status(T(this.p.good), 'good');
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
      this.later(function () { self.ui.solved(); }, Math.max(600, t - 500));
    } else {
      this.ui.status(T('badMove'), 'bad');
      this.later(function () {
        self.pos.unmakeMove();
        self.mb.show(self.pos, [{ from: to, to: from, golden: true }]);
        self.mb.el.classList.add('armed'); self.mb.view.markGolden(self.pos.side);
        self.locked = false; self.paint();
        self.ui.wrong();
      }, 1300);
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
    function saveDone() { try { localStorage.setItem('goldenchess.puzzles', JSON.stringify(done)); } catch (e) { /* ignore */ } }
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
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1 6.1 3.4 8.5 9.5 9.5-6.1 1-8.5 3.4-9.5 9.5-1-6.1-3.4-8.5-9.5-9.5 6.1-1 8.5-3.4 9.5-9.5z" ' +
          (lit ? 'fill="#e7b44a"' : 'fill="none" stroke="#93a39f" stroke-width="1.3"') + '/></svg>';
      };
      return el('div', 'stars-art', '<div class="row">' + star(true) + '<span>' + esc(T('white')) + '<small>' + esc(T('inHand')) + '</small></span></div>' +
        '<div class="row">' + star(false) + '<span>' + esc(T('black')) + '<small>' + esc(T('usedUp')) + '</small></span></div>');
    }

    function render(host) {
      demos.forEach(function (d) { d.stop(); if (io) io.unobserve(d.mb.wrap); });
      demos = [];
      if (puzzle) { puzzle.clearTimers(); puzzle = null; }
      host.innerHTML = '';
      var inn = el('div', 'page-in learn');
      host.appendChild(inn);

      // what it is
      var hero = el('header', 'learn-hero');
      var ht = el('div');
      ht.appendChild(el('h1', null, esc(T('learnTitle'))));
      ht.appendChild(el('p', 'lead', esc(T('learnLead'))));
      hero.appendChild(ht);
      var hb = el('div', 'demo-box'), cap = el('div', 'demo-cap');
      var hd = new Demo(hb, DEMOS.hero, ctx, cap); hb.appendChild(cap);
      hero.appendChild(hb); inn.appendChild(hero);
      demos.push(hd);

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

      // try it
      var ts = section(T('tryH'));
      ts.id = 'try';
      ts.appendChild(el('p', 'muted', esc(T('tryLead'))));
      var head = el('div', 'try-head'), tabs = el('div', 'try-tabs');
      head.appendChild(tabs); ts.appendChild(head);
      var body = el('div', 'try-body'), bhost = el('div'), side = el('div', 'try-side');
      var prompt = el('div', 'try-prompt'), status = el('div', 'try-status'), acts = el('div', 'try-actions');
      side.appendChild(prompt); side.appendChild(status); side.appendChild(acts);
      body.appendChild(bhost); body.appendChild(side); ts.appendChild(body);
      inn.appendChild(ts);
      function btn(label, cls, fn, id) { var b = el('button', 'sbtn' + (cls ? ' ' + cls : ''), esc(label)); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; }
      function drawTabs() {
        tabs.innerHTML = '';
        PUZZLES.forEach(function (_, i) {
          var b = el('button', 'try-tab' + (done[i] ? ' done' : ''), String(i + 1));
          b.type = 'button'; b.id = 'try-tab-' + (i + 1); b.setAttribute('aria-pressed', String(i === pIndex));
          b.setAttribute('aria-label', String(i + 1));
          b.addEventListener('click', function () { open(i); });
          tabs.appendChild(b);
        });
      }
      function actions(kind) {
        acts.innerHTML = '';
        if (kind === 'solved') {
          if (pIndex < PUZZLES.length - 1) acts.appendChild(btn(T('nextPuzzle'), 'hot', function () { open(pIndex + 1); }, 'try-next'));
          else { status.textContent = T(PUZZLES[pIndex].good) + ' ' + T('allSolved'); acts.appendChild(btn(T('learnCta'), 'hot', function () { ctx.go('bots'); }, 'try-play')); }
          acts.appendChild(btn(T('tryAgain'), '', function () { open(pIndex); }, 'try-again'));
          return;
        }
        acts.appendChild(btn(T('puzzleHint'), '', function () { status.className = 'try-status'; status.textContent = T(PUZZLES[pIndex].hint); }, 'try-hint'));
        acts.appendChild(btn(T('showAnswer'), '', function () { puzzle.answer(); }, 'try-answer'));
      }
      var ui = {
        status: function (text, cls) { status.className = 'try-status' + (cls ? ' ' + cls : ''); status.textContent = text; },
        solved: function () { done[pIndex] = 1; saveDone(); drawTabs(); actions('solved'); },
        wrong: function () { /* keep the message until the next try */ }
      };
      function open(i) {
        pIndex = i;
        if (puzzle) puzzle.clearTimers();
        bhost.innerHTML = '';
        puzzle = new Puzzle(bhost, PUZZLES[i], ctx, ui);
        puzzle.mb.wrap.classList.add('try-board'); puzzle.mb.wrap.id = 'try-board';
        prompt.textContent = T(PUZZLES[i].prompt);
        ui.status('', '');
        drawTabs(); actions('open');
      }
      open(Math.min(pIndex, PUZZLES.length - 1));

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

      demos.forEach(function (d) { d.wanted = view === 'learn'; watch(d); d.update(); });
    }
    // the Play tab on wide screens: the same golden move on a bigger board
    function heroBoard(host) {
      if (playDemo) { host.appendChild(playDemo.mb.wrap); playDemo.mb.fit(); }
      else { playDemo = new Demo(host, DEMOS.hero, ctx, null); watch(playDemo); }
      playDemo.wanted = view === 'play'; playDemo.update();
    }
    function active(v) {
      view = v;
      demos.forEach(function (d) { d.wanted = v === 'learn'; d.update(); });
      if (playDemo) { playDemo.wanted = v === 'play' && playDemo.mb.wrap.isConnected; playDemo.update(); }
      if (puzzle && v !== 'learn') puzzle.clearTimers();
    }
    return { render: render, active: active, heroBoard: heroBoard, PUZZLES: PUZZLES };
  }
  return { create: create, DEMOS: DEMOS, PUZZLES: PUZZLES };
})();
