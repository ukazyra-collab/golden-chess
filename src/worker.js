/* Worker entry: GC + Engine are concatenated before this file. */
self.onmessage = function (e) {
  var d = e.data;
  if (d.type === 'clear') { Engine.clear(); return; }
  if (d.type === 'think') {
    var res = Engine.think({
      fen: d.fen, moves: d.moves, timeMs: d.timeMs, level: d.level, analysis: !!d.analysis, maxDepth: d.maxDepth,
      onInfo: d.analysis ? function (info) { self.postMessage({ type: 'info', id: d.id, info: info }); } : null
    });
    self.postMessage({ type: 'result', id: d.id, res: res });
  }
  if (d.type === 'review') {
    for (var i = 0; i <= d.moves.length; i++) {
      var st = Engine.reviewStep(d.fen, d.moves.slice(0, i), d.timeMs);
      st.type = 'reviewStep'; st.id = d.id; st.i = i;
      self.postMessage(st);
    }
    self.postMessage({ type: 'result', id: d.id, res: { done: true } });
  }
};
