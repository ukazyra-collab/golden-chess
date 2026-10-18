const { spawn } = require('child_process');
const sf = spawn('node', ['vendor/sf/package/bin/stockfish-18-lite-single.js']);
let buf = '';
sf.stdout.on('data', d => { buf += d; process.stdout.write(d.toString().split('\n').filter(l => /uciok|readyok|bestmove|UCI_Elo|Skill/.test(l)).join('\n') + (/bestmove/.test(d) ? '\n' : '')); if (/bestmove/.test(d)) { sf.stdin.write('quit\n'); } });
sf.stdin.write('uci\nsetoption name UCI_LimitStrength value true\nsetoption name UCI_Elo value 1320\nisready\nposition startpos moves e2e4\ngo movetime 200\n');
