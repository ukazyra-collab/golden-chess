/* Synthesized sounds (no samples): wooden knocks for moves, a gilded chime for the golden move. */
var Sound = (function () {
  'use strict';
  var ctx = null, master = null, buffers = {}, enabled = true, ready = false;

  function noise(n) { var a = new Float32Array(n); for (var i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }
  // RBJ biquad band-pass applied in place
  function bandpass(x, sr, f0, Q) {
    var w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * Q), cw = Math.cos(w);
    var b0 = al, b1 = 0, b2 = -al, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
    }
    return x;
  }
  function add(dst, src, offset, gain) {
    for (var i = 0; i < src.length && offset + i < dst.length; i++) dst[offset + i] += src[i] * gain;
  }
  function env(n, sr, attackMs, decayMs) {
    var a = new Float32Array(n), at = Math.max(1, attackMs * sr / 1000), dc = decayMs * sr / 1000;
    for (var i = 0; i < n; i++) a[i] = (i < at ? i / at : 1) * Math.exp(-Math.max(0, i - at) / dc);
    return a;
  }
  function tone(sr, ms, freq, decayMs, attackMs, vibrato) {
    var n = Math.round(sr * ms / 1000), out = new Float32Array(n), e = env(n, sr, attackMs || 2, decayMs), ph = 0;
    for (var i = 0; i < n; i++) {
      var f = freq * (vibrato ? 1 + vibrato * Math.sin(2 * Math.PI * 5.5 * i / sr) : 1);
      ph += 2 * Math.PI * f / sr;
      out[i] = Math.sin(ph) * e[i];
    }
    return out;
  }
  function click(sr, f0, Q, decayMs, ms) {
    var n = Math.round(sr * (ms || 60) / 1000), x = bandpass(noise(n), sr, f0, Q), e = env(n, sr, 0.6, decayMs);
    for (var i = 0; i < n; i++) x[i] *= e[i];
    return x;
  }
  // a piece set down on wood: short bright transient + hollow body
  function knock(sr, bright, body) {
    var n = Math.round(sr * 0.11), out = new Float32Array(n);
    add(out, click(sr, bright, 1.3, 6, 40), 0, 1.0);
    add(out, click(sr, bright * 0.45, 2.2, 14, 80), 0, 0.9);
    add(out, tone(sr, 100, body, 22, 0.8), 0, 0.55);
    add(out, tone(sr, 60, body * 2.71, 9, 0.5), 0, 0.22);
    return out;
  }
  function normalize(x, peak) {
    var m = 0; for (var i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
    if (m > 0) for (i = 0; i < x.length; i++) x[i] *= peak / m;
    return x;
  }
  function mk(sr, ms) { return new Float32Array(Math.round(sr * ms / 1000)); }

  function build(sr) {
    var b = {};
    b.move = normalize(knock(sr, 2600, 330), 0.55);
    var cap = mk(sr, 170);
    add(cap, knock(sr, 3400, 420), 0, 1);
    add(cap, knock(sr, 2300, 300), Math.round(sr * 0.022), 0.8);
    b.capture = normalize(cap, 0.75);
    var cas = mk(sr, 200);
    add(cas, knock(sr, 2600, 330), 0, 1);
    add(cas, knock(sr, 2300, 300), Math.round(sr * 0.085), 0.85);
    b.castle = normalize(cas, 0.6);
    var chk = mk(sr, 380);
    add(chk, knock(sr, 2900, 360), 0, 0.9);
    add(chk, tone(sr, 360, 1046.5, 120, 3), Math.round(sr * 0.012), 0.38);
    add(chk, tone(sr, 300, 1568, 80, 3), Math.round(sr * 0.012), 0.22);
    b.check = normalize(chk, 0.7);
    var pro = mk(sr, 420);
    add(pro, knock(sr, 2600, 330), 0, 0.8);
    [784, 988, 1175, 1568].forEach(function (f, i) { add(pro, tone(sr, 220, f, 90, 3), Math.round(sr * (0.03 + i * 0.055)), 0.3); });
    b.promote = normalize(pro, 0.65);
    // golden: gilded shimmer + soft rising whoosh
    var g = mk(sr, 1250);
    var wn = Math.round(sr * 0.32), wh = noise(wn), we = env(wn, sr, 140, 90);
    for (var i = 0; i < wn; i++) wh[i] *= we[i];
    var seg = Math.round(sr * 0.04);
    for (var s = 0; s * seg < wn; s++) { var part = wh.subarray(s * seg, Math.min(wn, (s + 1) * seg)); bandpass(part, sr, 700 + s * 420, 1.8); }
    add(g, wh, 0, 0.35);
    var partials = [[1318.5, 0.0, 620], [1975.5, 0.035, 520], [2637, 0.07, 460], [3136, 0.105, 400], [3951, 0.14, 340], [5274, 0.175, 280]];
    partials.forEach(function (p, k) { add(g, tone(sr, 1000, p[0], p[2], 4, 0.003), Math.round(sr * (0.12 + p[1])), 0.22 - k * 0.022); });
    add(g, tone(sr, 1000, 659.25, 520, 6), Math.round(sr * 0.12), 0.32);
    add(g, tone(sr, 1000, 987.8, 420, 6), Math.round(sr * 0.13), 0.16);
    b.golden = normalize(g, 0.7);
    b.premove = normalize(click(sr, 2200, 1.6, 4, 40), 0.22);
    var cn = mk(sr, 260);
    add(cn, tone(sr, 120, 587.3, 45, 3), 0, 0.5); add(cn, tone(sr, 160, 392, 70, 3), Math.round(sr * 0.085), 0.55);
    b.cancel = normalize(cn, 0.32);
    b.select = normalize(click(sr, 3000, 2, 2.5, 25), 0.12);
    var ill = mk(sr, 120);
    for (i = 0; i < ill.length; i++) { var t = i / sr; ill[i] = (Math.abs(((t * 140) % 1) * 4 - 2) - 1) * Math.exp(-t / 0.05) * Math.min(1, t * 400); }
    b.illegal = normalize(ill, 0.25);
    var st = mk(sr, 520);
    add(st, tone(sr, 300, 523.25, 140, 4), 0, 0.5); add(st, tone(sr, 360, 784, 170, 4), Math.round(sr * 0.11), 0.5);
    b.start = normalize(st, 0.45);
    var win = mk(sr, 900);
    [523.25, 659.25, 784, 1046.5].forEach(function (f, i) { add(win, tone(sr, 500, f, 200, 4), Math.round(sr * i * 0.09), 0.4); });
    b.win = normalize(win, 0.5);
    var lose = mk(sr, 800);
    [659.25, 523.25, 392].forEach(function (f, i) { add(lose, tone(sr, 500, f, 220, 4), Math.round(sr * i * 0.12), 0.4); });
    b.lose = normalize(lose, 0.45);
    var draw = mk(sr, 700);
    [587.3, 587.3].forEach(function (f, i) { add(draw, tone(sr, 400, f, 160, 4), Math.round(sr * i * 0.16), 0.4); });
    b.draw = normalize(draw, 0.42);
    var tick = mk(sr, 60);
    add(tick, click(sr, 3600, 3, 2, 30), 0, 1); add(tick, tone(sr, 50, 1760, 12, 1), 0, 0.5);
    b.lowtime = normalize(tick, 0.35);
    return b;
  }

  function unlock() {
    if (ready) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      var raw = build(ctx.sampleRate);
      for (var k in raw) {
        var buf = ctx.createBuffer(1, raw[k].length, ctx.sampleRate);
        buf.getChannelData(0).set(raw[k]);
        buffers[k] = buf;
      }
      ready = true;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }

  function play(name, gain) {
    if (!enabled || !ready || !buffers[name]) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var src = ctx.createBufferSource(); src.buffer = buffers[name];
      var g = ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
      src.connect(g); g.connect(master); src.start();
    } catch (e) { /* ignore */ }
  }

  return { unlock: unlock, play: play, setEnabled: function (v) { enabled = !!v; }, isEnabled: function () { return enabled; }, _build: build };
})();
