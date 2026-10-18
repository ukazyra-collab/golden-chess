// Builds every deliverable from src/:
//   dist/golden-chess.html        artifact page (offline: bot + two players; the host adds the document skeleton)
//   dist/preview.html             the same page wrapped in a document, for local testing
//   dist/web/index.html           the website (GitHub Pages): online play via Supabase
//   dist/mock/index.html          the website wired to the local test server (test/server/mock-server.mjs)
//   supabase/functions/play/core.js   the rules module as an ES module for the edge function
const fs = require('fs');
const path = require('path');
const rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(__dirname, f)), { recursive: true }); fs.writeFileSync(path.join(__dirname, f), s); };

const ONLINE = {
  url: 'https://wduoqpoqbtpkrgbcsegg.supabase.co',
  // public anon key (safe to ship: the database only allows reads, every write goes through the edge function)
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkdW9xcG9xYnRwa3JnYmNzZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjg2MTQsImV4cCI6MjEwNzkwNDYxNH0.3kvc1Mk9DoO-9FIswh2Tch_yGMfRt1Q1T_YSnTGnkto',
  fn: 'play',
  region: 'eu-central-1',
};
const SITE = 'https://ukazyra-collab.github.io/golden-chess/';

const pieces = JSON.parse(rd('build/pieces.json'));
let css = '';
for (const [k, svg] of Object.entries(pieces)) css += `.p-${k}{background-image:url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}")}\n`;
const core = rd('src/core.js'), engine = rd('src/engine.js');
const workerSrc = [core, engine, rd('src/worker.js')].join('\n;\n');
const mainSrc = [core, engine, rd('src/ui/sound.js'), rd('src/ui/board.js'), rd('src/ui/app.js')].join('\n;\n');
const supa = rd('vendor/supabase-js-2.117.2.umd.js');
for (const [name, src] of [['worker', workerSrc], ['main', mainSrc], ['supabase', supa]]) if (/<\/script/i.test(src)) throw new Error(name + ' contains </script');

const page = (pre) => rd('src/ui/template.html').replace('/*PIECE_CSS*/', () => css).replace('/*ENGINE_SRC*/', () => workerSrc).replace('/*MAIN_SRC*/', () => pre + mainSrc);
const body = page('');
// the artifact can't reach the game server, so it points to the website for online play
const artifactBody = page('window.GC_SITE = ' + JSON.stringify(SITE) + ';\n');
const RESET = '<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}html{box-sizing:border-box}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>';
const doc = (head, b) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + head + RESET + '</head><body>' + b + '</body></html>\n';

const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="7" fill="#1f2c2a"/><path d="M16 5.5c.9 5.4 3.6 8.1 9 9-5.4.9-8.1 3.6-9 9-.9-5.4-3.6-8.1-9-9 5.4-.9 8.1-3.6 9-9z" fill="#e7b44a"/></svg>');
const DESC = 'Chess with one golden move per game: teleport a queen, rook, bishop or knight to any empty square. Play the bot, a friend, or rated games online.';
const webHead = '<title>Golden Chess</title><meta name="description" content="' + DESC + '"><meta name="theme-color" content="#0f1716">' +
  '<link rel="icon" href="' + ICON + '"><meta property="og:title" content="Golden Chess"><meta property="og:description" content="' + DESC + '">' +
  '<meta property="og:type" content="website"><meta property="og:url" content="' + SITE + '"><meta property="og:image" content="' + SITE + 'og.png">' +
  '<meta name="twitter:card" content="summary_large_image">';
const webBody = body.replace(/^<title>[^<]*<\/title>\n/, '').replace(/^<meta name="claude:viewport-fit-sides"[^>]*>\n/m, '');

write('dist/golden-chess.html', artifactBody);
write('dist/preview.html', doc('', artifactBody));
write('dist/web/index.html', doc(webHead + '<script>' + supa + '</script><script>window.GC_ONLINE=' + JSON.stringify(ONLINE) + '</script>', webBody));
write('dist/mock/index.html', doc('<title>Golden Chess (local server)</title><script>window.GC_ONLINE={mock:""}</script>', webBody));
write('supabase/functions/play/core.js', '// Generated from src/core.js by build.js. Do not edit.\n' + core + '\nexport default GC;\n');
console.log('built: artifact', (body.length / 1024).toFixed(0) + ' KB, web', (fs.statSync(path.join(__dirname, 'dist/web/index.html')).size / 1024).toFixed(0) + ' KB');
