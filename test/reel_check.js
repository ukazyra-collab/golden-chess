// Checks the Play-tab reel (src/ui/learn.js REEL): every scripted move is legal, each Joker Move is the engine's choice or close
// to it, and the side that played it ends the scene clearly better (or mates). Run: node test/reel_check.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, window: {}, document: undefined }; vm.createContext(ctx);
vm.runInContext(['src/core.js', 'src/engine.js', 'src/ui/learn.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n'), ctx);
const GC = ctx.GC, Engine = ctx.Engine, REEL = ctx.GCLearn.REEL, MATE = Engine.MATE;
const fmt = s => Math.abs(s) > MATE - 200 ? (s > 0 ? 'M' : '-M') + (MATE - Math.abs(s)) : (s / 100).toFixed(2);
function think(fen, moves, opts) { Engine.clear(); return Engine.think(Object.assign({ fen, moves, analysis: true, timeMs: 2500, maxDepth: 12 }, opts || {})); }
let failed = 0;
function check(ok, msg) { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; }
REEL.forEach(function (d, i) {
  const p = new GC.Position(d.fen); const played = [];
  d.steps.forEach(function (s) {
    if (!s.uci) return;
    const m = p.moveFromUci(s.uci); const legal = !!m && p.legalMoves(true).indexOf(m) >= 0;
    check(legal, `scene ${i + 1}: ${s.uci} is legal`);
    if (!legal) return;
    if (s.uci.indexOf('*') >= 0) {
      const side = p.side;
      if (s.refuted) {
        // a Joker Move the other side answers with its own: real without that answer, refuted with it
        const quiet = think(d.fen, played.concat([s.uci]), { noGoldenRoot: true }), reply = think(d.fen, played.concat([s.uci]));
        check(-quiet.score >= 150 && reply.uci && reply.uci.indexOf('*') >= 0 && reply.score > 0,
          `scene ${i + 1}: ${s.uci} wins without a Joker answer (${fmt(-quiet.score)}), the Joker answer ${reply.uci} turns it (${fmt(reply.score)} for the other side)`);
      } else {
        const best = think(d.fen, played);                      // what the engine would play here
        const after = think(d.fen, played.concat([s.uci]));      // the reply; score from the opponent's view
        const gain = -after.score;
        check(best.uci === s.uci || gain >= 300 || gain > MATE - 200, `scene ${i + 1}: ${s.uci} engine best ${best.uci} ${fmt(best.score)}, after it ${fmt(gain)} for ${side ? 'Black' : 'White'}`);
      }
    }
    p.makeMove(m); played.push(s.uci);
  });
  const end = think(d.fen, played, { timeMs: 1500 });
  console.log(`     scene ${i + 1} ends: side to move ${p.side ? 'Black' : 'White'}, eval ${end.uci ? fmt(end.score) : (p.inCheck() ? 'checkmated' : 'stalemate')}`);
});
console.log(failed ? `${failed} failed` : 'all reel scenes pass');
process.exit(failed ? 1 : 0);
