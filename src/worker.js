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
      var r = Engine.think({ fen: d.fen, moves: d.moves.slice(0, i), timeMs: d.timeMs, analysis: true });
      self.postMessage({ type: 'reviewStep', id: d.id, i: i, score: r.score, mate: r.mate || 0, uci: r.uci, depth: r.depth });
    }
    self.postMessage({ type: 'result', id: d.id, res: { done: true } });
  }
};
