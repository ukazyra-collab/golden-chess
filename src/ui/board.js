/* BoardView — the rendering half of the board.
 * One source of truth per piece: a stable id with a current visual position (x, y in board files/ranks).
 * Every change of position goes through sync(board, hints); each moved piece animates from wherever it is
 * *drawn right now* to its new square, inside a single requestAnimationFrame loop. Because nothing is chained
 * (no CSS transitions, no callbacks waiting on other animations), rapid sequences — premove right after the
 * opponent's move, scrubbing through moves, flipping mid-animation — can never stack or desync.
 */
var BoardView = (function () {
  'use strict';
  var TYPE = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
  function cls(code) { return 'p-' + ((code >> 3) ? 'b' : 'w') + TYPE[code & 7]; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function now() { return performance.now(); }
  function div(c) { var d = document.createElement('div'); d.className = c; return d; }

  function BoardView(el, handlers) {
    this.el = el; this.h = handlers || {};
    this.orient = 0;
    this.pieces = new Map(); this.bySq = new Map(); this.nextId = 1;
    this.speed = 1; this.raf = 0; this.drag = null; this.promo = null;
    this.marks = []; this.dots = []; this.arrowList = []; this.showCoords = true; this.goldColor = -1;
    this.lHl = div('layer'); this.lCoords = div('layer'); this.lDots = div('layer'); this.lPieces = div('layer'); this.lFx = div('layer');
    this.hover = div('sqx'); this.hover.hidden = true; this.lHl.appendChild(this.hover);
    this.lMarks = div('layer'); this.lHl.appendChild(this.lMarks);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'arrows'); this.svg.setAttribute('viewBox', '0 0 8 8');
    el.appendChild(this.lHl); el.appendChild(this.lCoords); el.appendChild(this.lDots); el.appendChild(this.lPieces);
    el.appendChild(this.svg); el.appendChild(this.lFx);
    this._frame = this.frame.bind(this);
    this.bind();
    this.renderCoords();
  }
  var P = BoardView.prototype;

  P.toScreen = function (bx, by) { return this.orient ? [7 - bx, by] : [bx, 7 - by]; };
  P.fromScreen = function (sx, sy) { return this.orient ? [7 - sx, sy] : [sx, 7 - sy]; };
  P.sqFromPoint = function (cx, cy) {
    var r = this.el.getBoundingClientRect(), s = r.width / 8;
    var sx = Math.floor((cx - r.left) / s), sy = Math.floor((cy - r.top) / s);
    if (sx < 0 || sx > 7 || sy < 0 || sy > 7) return -1;
    var b = this.fromScreen(sx, sy);
    return b[1] * 16 + b[0];
  };
  P.posStyle = function (el, sq) {
    var s = this.toScreen(sq & 7, sq >> 4);
    el.style.transform = 'translate(' + (s[0] * 100) + '%,' + (s[1] * 100) + '%)';
  };
  P.place = function (p) {
    var s = this.toScreen(p.x, p.y), tr = 'translate(' + (s[0] * 100) + '%,' + (s[1] * 100) + '%)';
    if (p.scale !== 1) tr += ' scale(' + p.scale.toFixed(3) + ')';
    p.el.style.transform = tr;
    p.el.style.opacity = p.opacity >= 1 ? '' : String(Math.max(0, p.opacity));
  };
  P.setCode = function (p, code) {
    p.code = code;
    p.el.className = 'pc ' + cls(code) + (p.anim ? ' lift' : '') + (this.goldColor >= 0 && (code >> 3) === this.goldColor && (code & 7) >= 2 && (code & 7) <= 5 ? ' gcan' : '');
  };
  P.createPiece = function (code, sq, fade) {
    var el = div('pc ' + cls(code));
    var p = { id: this.nextId++, code: code, sq: sq, x: sq & 7, y: sq >> 4, el: el, anim: null, scale: 1, opacity: 1, fade: null, dead: false, removeAt: 0, pendingCode: 0, dragging: false };
    if (fade && this.speed > 0) { p.opacity = 0; p.fade = { t0: now(), dur: 170, from: 0, to: 1 }; }
    this.setCode(p, code);
    this.lPieces.appendChild(el); this.pieces.set(p.id, p); this.place(p);
    return p;
  };

  // ---- animation primitives ----
  P.slide = function (p, tx, ty, t) {
    p.scale = 1; if (!p.fade) p.opacity = 1; // an interrupted teleport must not leave the piece shrunk
    var dx = tx - p.x, dy = ty - p.y, dist = Math.sqrt(dx * dx + dy * dy);
    p.anim = { kind: 'slide', fx: p.x, fy: p.y, tx: tx, ty: ty, t0: t, dur: (115 + Math.min(dist, 7) * 13) * this.speed };
    p.el.classList.add('lift');
  };
  P.teleport = function (p, tx, ty, t) {
    p.anim = { kind: 'tele', fx: p.x, fy: p.y, tx: tx, ty: ty, t0: t, dur: 480 * Math.max(this.speed, 0.7), burst: false };
    p.el.classList.add('lift');
  };
  P.snap = function (p, tx, ty) {
    p.anim = null; p.x = tx; p.y = ty; p.scale = 1; if (!p.fade) p.opacity = 1;
    p.el.classList.remove('lift');
    this.place(p);
  };
  P.kick = function () { if (!this.raf) this.raf = requestAnimationFrame(this._frame); };
  P.idle = function () {
    var busy = false;
    this.pieces.forEach(function (p) { if (p.anim || p.fade || p.dead) busy = true; });
    return !busy && !this.drag;
  };

  P.frame = function () {
    this.raf = 0;
    var t = now(), active = false, self = this;
    this.pieces.forEach(function (p) {
      if (p.dragging) return;
      var a = p.anim;
      if (a) {
        var k = a.dur > 0 ? Math.min(1, (t - a.t0) / a.dur) : 1;
        if (a.kind === 'slide') {
          var e = easeOut(k);
          p.x = a.fx + (a.tx - a.fx) * e; p.y = a.fy + (a.ty - a.fy) * e;
        } else if (k < 0.42) {
          var u = k / 0.42;
          p.x = a.fx; p.y = a.fy; p.scale = 1 - 0.7 * u; p.opacity = 1 - u;
        } else {
          var v = (k - 0.42) / 0.58;
          if (!a.burst) { a.burst = true; if (!p.dead) self.burst(a.tx, a.ty); }
          p.x = a.tx; p.y = a.ty; p.scale = 0.3 + 0.7 * easeOut(v); p.opacity = Math.min(1, v * 1.7);
        }
        if (k >= 1) {
          p.anim = null; p.x = a.tx; p.y = a.ty; p.scale = 1; if (!p.fade) p.opacity = 1;
          p.el.classList.remove('lift');
          if (p.pendingCode) { self.setCode(p, p.pendingCode); p.pendingCode = 0; }
        } else active = true;
      }
      if (p.fade) {
        var f = p.fade, kf = Math.min(1, (t - f.t0) / f.dur);
        p.opacity = f.from + (f.to - f.from) * kf;
        if (kf >= 1) p.fade = null; else active = true;
      }
      if (p.dead) {
        if (t >= p.removeAt) { p.el.remove(); self.pieces.delete(p.id); return; }
        active = true;
      }
      self.place(p);
    });
    if (active) this.raf = requestAnimationFrame(this._frame);
  };

  // board: Int8Array(128) of piece codes. hints: [{from, to, code?, golden?, instant?}]
  P.sync = function (board, hints, opts) {
    opts = opts || {};
    var t = now(), self = this, animate = this.speed > 0 && !opts.instantAll;
    hints = hints || [];
    var old = [], oldBySq = new Map(), i, j, p;
    this.pieces.forEach(function (q) { if (!q.dead) { old.push(q); oldBySq.set(q.sq, q); } });
    var expected = new Map(), hintOf = new Map();
    for (i = 0; i < hints.length; i++) {
      var h = hints[i]; p = oldBySq.get(h.from);
      if (p && (h.code == null || p.code === h.code) && !expected.has(p.id)) { expected.set(p.id, h.to); hintOf.set(p.id, h); }
    }
    var exp = function (q) { return expected.has(q.id) ? expected.get(q.id) : q.sq; };
    var targets = [];
    for (var sq = 0; sq < 120; sq++) { if (sq & 0x88) { sq += 7; continue; } if (board[sq]) targets.push({ sq: sq, code: board[sq], p: null }); }
    var used = new Set();
    // 1) same piece where we expect it
    targets.forEach(function (tg) {
      for (var j = 0; j < old.length; j++) { var q = old[j]; if (!used.has(q.id) && q.code === tg.code && exp(q) === tg.sq) { tg.p = q; used.add(q.id); return; } }
    });
    // 2) same kind of piece, nearest
    targets.forEach(function (tg) {
      if (tg.p) return;
      var best = null, bd = 1e9;
      for (var j = 0; j < old.length; j++) {
        var q = old[j]; if (used.has(q.id) || q.code !== tg.code) continue;
        var e = exp(q), d = Math.abs((e & 7) - (tg.sq & 7)) + Math.abs((e >> 4) - (tg.sq >> 4));
        if (d < bd) { bd = d; best = q; }
      }
      if (best) { tg.p = best; used.add(best.id); }
    });
    // 3) promotion / un-promotion: a same-coloured piece expected on exactly this square changes kind
    targets.forEach(function (tg) {
      if (tg.p) return;
      for (var j = 0; j < old.length; j++) {
        var q = old[j]; if (used.has(q.id) || (q.code >> 3) !== (tg.code >> 3) || exp(q) !== tg.sq) continue;
        tg.p = q; used.add(q.id); return;
      }
    });
    var newBySq = new Map();
    targets.forEach(function (tg) {
      var q = tg.p;
      if (!q) { q = self.createPiece(tg.code, tg.sq, animate); newBySq.set(tg.sq, q); return; }
      q.sq = tg.sq; newBySq.set(tg.sq, q);
      // the latest target always decides the piece's kind (an older pending change must not survive)
      q.pendingCode = q.code !== tg.code ? tg.code : 0;
      if (q.dragging) return;
      var tx = tg.sq & 7, ty = tg.sq >> 4, hh = hintOf.get(q.id);
      if (!animate || (hh && hh.instant)) self.snap(q, tx, ty);
      else if (q.anim ? (q.anim.tx !== tx || q.anim.ty !== ty) : (q.x !== tx || q.y !== ty)) {
        if (hh && hh.golden) self.teleport(q, tx, ty, t); else self.slide(q, tx, ty, t);
      }
      if (!q.anim && q.pendingCode) { self.setCode(q, q.pendingCode); q.pendingCode = 0; }
      if (q.fade && q.fade.to === 0) { q.fade = null; q.opacity = 1; }
    });
    old.forEach(function (q) {
      if (used.has(q.id)) return;
      q.dead = true;
      if (q.dragging) { q.dragging = false; if (self.drag && self.drag.p === q) self.drag = null; q.removeAt = t; return; }
      if (!animate) { q.removeAt = t; return; }
      if (expected.has(q.id)) {
        var e = expected.get(q.id), hh = hintOf.get(q.id);
        if (hh && hh.instant) { q.removeAt = t; return; }
        if (hh && hh.golden) self.teleport(q, e & 7, e >> 4, t); else self.slide(q, e & 7, e >> 4, t);
        q.removeAt = q.anim.t0 + q.anim.dur;
        return;
      }
      var arriving = newBySq.get(q.sq);
      if (arriving && arriving.anim) {
        q.removeAt = arriving.anim.t0 + arriving.anim.dur * (arriving.anim.kind === 'tele' ? 0.45 : 0.92);
      } else { q.fade = { t0: t, dur: 140, from: q.opacity, to: 0 }; q.removeAt = t + 140; }
    });
    this.bySq = newBySq;
    this.kick();
  };

  // ---- golden burst ----
  P.burst = function (bx, by) {
    if (this.speed === 0) return;
    var s = this.toScreen(bx, by), host = div('fx-ring'), sqPx = this.el.clientWidth / 8;
    host.style.transform = 'translate(' + (s[0] * 100) + '%,' + (s[1] * 100) + '%)';
    for (var i = 0; i < 9; i++) {
      var sp = document.createElement('i'), ang = (i / 9) * Math.PI * 2 + Math.random() * 0.5, r = sqPx * (0.75 + Math.random() * 0.45);
      sp.className = 'fx-spark';
      sp.style.setProperty('--dx', (Math.cos(ang) * r).toFixed(1) + 'px');
      sp.style.setProperty('--dy', (Math.sin(ang) * r).toFixed(1) + 'px');
      host.appendChild(sp);
    }
    this.lFx.appendChild(host);
    setTimeout(function () { host.remove(); }, 900);
  };

  // ---- overlays: marks, dots, coordinates, arrows ----
  P.setMarks = function (marks) { this.marks = marks || []; this.renderMarks(); };
  P.renderMarks = function () {
    var frag = document.createDocumentFragment(), self = this;
    this.marks.forEach(function (m) { var d = div('sqx ' + m.cls); self.posStyle(d, m.sq); frag.appendChild(d); });
    this.lMarks.replaceChildren(frag);
  };
  P.setDots = function (dots) { this.dots = dots || []; this.renderDots(); };
  P.renderDots = function () {
    var frag = document.createDocumentFragment(), self = this;
    this.dots.forEach(function (m) { var d = div('sqx ' + m.cls); d.dataset.sq = m.sq; self.posStyle(d, m.sq); frag.appendChild(d); });
    this.lDots.replaceChildren(frag);
  };
  P.setHover = function (sq, gold) {
    if (sq < 0) { this.hover.hidden = true; return; }
    this.hover.hidden = false; this.hover.className = 'sqx hl-hover' + (gold ? ' g' : ''); this.posStyle(this.hover, sq);
  };
  P.setCoords = function (on) { this.showCoords = on; this.renderCoords(); };
  P.renderCoords = function () {
    var frag = document.createDocumentFragment();
    if (this.showCoords) {
      for (var i = 0; i < 8; i++) {
        var lb = this.fromScreen(0, i), sqL = lb[1] * 16 + lb[0], light = ((lb[0] + lb[1]) & 1) === 1;
        var r = div('sqx'); this.posStyle(r, sqL);
        var c = div('coord rk ' + (light ? 'on-l' : 'on-d')); c.textContent = String(lb[1] + 1); r.appendChild(c); frag.appendChild(r);
        var bb = this.fromScreen(i, 7), sqB = bb[1] * 16 + bb[0], lightB = ((bb[0] + bb[1]) & 1) === 1;
        var f = div('sqx'); this.posStyle(f, sqB);
        var c2 = div('coord fl ' + (lightB ? 'on-l' : 'on-d')); c2.textContent = 'abcdefgh'[bb[0]]; f.appendChild(c2); frag.appendChild(f);
      }
    }
    this.lCoords.replaceChildren(frag);
  };
  P.setArrows = function (list) { this.arrowList = list || []; this.renderArrows(); };
  P.renderArrows = function () {
    var svg = this.svg, ns = 'http://www.w3.org/2000/svg', self = this;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this.arrowList.forEach(function (a) {
      var f = self.toScreen(a.from & 7, a.from >> 4), t = self.toScreen(a.to & 7, a.to >> 4);
      var x1 = f[0] + 0.5, y1 = f[1] + 0.5, x2 = t[0] + 0.5, y2 = t[1] + 0.5, dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.01) return;
      var ux = dx / len, uy = dy / len, head = 0.42, bx = x2 - ux * head, by = y2 - uy * head;
      var col = a.gold ? '#f2c661' : a.pre ? '#e2685a' : a.best ? '#96d16f' : '#7fd0e6';
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1 + ux * 0.18); line.setAttribute('y1', y1 + uy * 0.18); line.setAttribute('x2', bx); line.setAttribute('y2', by);
      line.setAttribute('stroke', col); line.setAttribute('stroke-width', '0.17'); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', '0.86');
      if (a.gold) line.setAttribute('stroke-dasharray', '0.28 0.16');
      var px = -uy, py = ux, w = 0.28;
      var poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', [x2, y2, bx + px * w, by + py * w, bx - px * w, by - py * w].map(function (v) { return v.toFixed(3); }).join(' '));
      poly.setAttribute('fill', col); poly.setAttribute('opacity', '0.9');
      svg.appendChild(line); svg.appendChild(poly);
    });
  };
  P.markGolden = function (color) {
    this.goldColor = color;
    var self = this;
    this.pieces.forEach(function (p) { if (!p.dead) self.setCode(p, p.code); });
  };
  P.setOrientation = function (o) {
    if (o === this.orient) return;
    this.orient = o;
    var self = this;
    this.pieces.forEach(function (p) { self.place(p); });
    this.renderMarks(); this.renderDots(); this.renderCoords(); this.renderArrows();
    if (this.drag) this.cancelDrag();
  };

  // ---- promotion picker ----
  P.askPromotion = function (sq, color, done) {
    this.closePromotion();
    var self = this, ov = div('promo'), s = this.toScreen(sq & 7, sq >> 4), dir = s[1] === 0 ? 1 : -1;
    [5, 2, 4, 3].forEach(function (t, i) {
      var o = div('opt');
      o.style.left = (s[0] * 12.5) + '%'; o.style.top = ((s[1] + dir * i) * 12.5) + '%';
      var ic = document.createElement('i'); ic.className = cls((color << 3) | t); o.appendChild(ic);
      o.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); self.closePromotion(); done(t); });
      ov.appendChild(o);
    });
    ov.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); self.closePromotion(); done(0); });
    this.el.appendChild(ov);
    this.promo = { el: ov, done: done };
  };
  P.closePromotion = function () { if (this.promo) { this.promo.el.remove(); this.promo = null; } };

  // ---- input ----
  P.bind = function () {
    var self = this, el = this.el;
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) { self.onDown(e); });
    el.addEventListener('pointermove', function (e) { self.onMove(e); });
    el.addEventListener('pointerup', function (e) { self.onUp(e, false); });
    el.addEventListener('pointercancel', function (e) { self.onUp(e, true); });
    el.addEventListener('lostpointercapture', function (e) { if (self.drag && self.drag.id === e.pointerId) self.onUp(e, true); });
  };
  P.onDown = function (e) {
    if (this.promo) return;
    if (this.h.onAny) this.h.onAny();
    if (e.button === 2) { e.preventDefault(); if (this.h.onRight) this.h.onRight(); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.drag) { this.cancelDrag(); return; }
    var sq = this.sqFromPoint(e.clientX, e.clientY);
    if (sq < 0) return;
    e.preventDefault();
    var r = this.h.onDown ? this.h.onDown(sq) : null;
    if (r && r.drag) {
      var p = this.bySq.get(sq);
      if (p && !p.dead) {
        this.drag = { p: p, from: sq, id: e.pointerId, x0: e.clientX, y0: e.clientY, px: e.clientX, py: e.clientY, started: false, touch: e.pointerType !== 'mouse', toggle: !!r.wasSelected, hover: -1, gold: !!r.gold };
        try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    }
  };
  P.onMove = function (e) {
    var d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    d.px = e.clientX; d.py = e.clientY;
    if (!d.started) {
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < (d.touch ? 8 : 4)) return;
      if (d.p.dead) { this.drag = null; return; }
      d.started = true; d.p.dragging = true; d.p.anim = null; d.p.scale = 1; d.p.opacity = 1;
      d.p.el.classList.add('dragging');
    }
    this.positionDrag();
  };
  P.positionDrag = function () {
    var d = this.drag, r = this.el.getBoundingClientRect(), s = r.width / 8;
    var lift = d.touch ? s * 0.5 : 0, scale = d.touch ? 1.55 : 1.06;
    var px = d.px - r.left - s / 2, py = d.py - r.top - s / 2 - lift;
    d.p.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) scale(' + scale + ')';
    d.p.el.style.opacity = '';
    var hov = this.sqFromPoint(d.px, d.py);
    if (hov !== d.hover) { d.hover = hov; this.setHover(hov === d.from ? -1 : hov, d.gold); }
  };
  P.endDragVisual = function (d) {
    var p = d.p, r = this.el.getBoundingClientRect(), s = r.width / 8;
    p.dragging = false; p.el.classList.remove('dragging');
    var sx = (d.px - r.left) / s - 0.5, sy = (d.py - r.top) / s - 0.5 - (d.touch ? 0.5 : 0);
    var b = this.fromScreen(sx, sy);
    p.x = b[0]; p.y = b[1]; p.scale = 1;
    this.place(p);
  };
  P.onUp = function (e, cancelled) {
    var d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    try { this.el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this.setHover(-1);
    if (!d.started) { if (!cancelled && this.h.onTap) this.h.onTap(d.from, d.toggle); return; }
    this.endDragVisual(d);
    var p = d.p, to = cancelled ? -1 : this.sqFromPoint(d.px, d.py), accepted = false;
    if (to >= 0 && to !== d.from && this.h.onDrop) accepted = this.h.onDrop(d.from, to);
    if (!p.dead && (!accepted || p.anim === null) && (p.x !== (p.sq & 7) || p.y !== (p.sq >> 4))) {
      this.slide(p, p.sq & 7, p.sq >> 4, now());
    }
    this.kick();
  };
  P.cancelDrag = function () {
    var d = this.drag;
    if (!d) return;
    this.drag = null; this.setHover(-1);
    if (d.started && !d.p.dead) { this.endDragVisual(d); this.slide(d.p, d.p.sq & 7, d.p.sq >> 4, now()); this.kick(); }
    else d.p.dragging = false;
  };

  // ---- testing helpers ----
  P.snapshot = function () {
    var out = {};
    this.pieces.forEach(function (p) { if (!p.dead) out[p.sq] = p.code; });
    return out;
  };
  P.visualCheck = function () {
    // after animations settle: every live piece is drawn exactly on its square, no extra DOM nodes
    var errs = [], self = this, n = 0;
    this.pieces.forEach(function (p) {
      if (p.dead) { errs.push('dead piece lingering ' + p.id); return; }
      n++;
      if (p.x !== (p.sq & 7) || p.y !== (p.sq >> 4)) errs.push('piece ' + p.id + ' drawn at ' + p.x + ',' + p.y + ' but belongs on ' + p.sq);
      if (p.scale !== 1 || p.opacity < 1) errs.push('piece ' + p.id + ' scale/opacity ' + p.scale + '/' + p.opacity);
      if (!p.el.isConnected) errs.push('piece ' + p.id + ' not in DOM');
      var expect = 'p-' + ((p.code >> 3) ? 'b' : 'w') + TYPE[p.code & 7];
      if (!p.el.classList.contains(expect)) errs.push('piece ' + p.id + ' has wrong image ' + p.el.className);
    });
    var domCount = this.lPieces.querySelectorAll('.pc').length;
    if (domCount !== n) errs.push('DOM has ' + domCount + ' piece nodes, model has ' + n);
    return errs;
  };

  BoardView.cls = cls;
  return BoardView;
})();
