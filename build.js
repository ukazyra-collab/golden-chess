// Builds every deliverable from src/:
//   dist/golden-chess.html        artifact page (offline: bot + two players; the host adds the document skeleton)
//   dist/preview.html             the same page wrapped in a document, for local testing
//   dist/web/index.html           the website (GitHub Pages): online play via Supabase
//   dist/mock/index.html          the website wired to the local test server (test/server/mock-server.mjs)
//   app/www/index.html            the copy of the site inside the iPhone / Android app, opened when there's no internet
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
  otpLength: 6, // digits in the email sign-in code (Supabase: Authentication > Sign In / Providers > Email > Email OTP length)
  // the stores' reviewers can't receive our emails: this one account signs in with a password (a Supabase user created
  // with a password in the dashboard); everyone else signs in with an email code
  reviewEmail: 'review@kozyramedia.com',
  appleAuth: true, // "Continue with Apple" in the iPhone app (Supabase provider Apple on, client id com.kozyramedia.goldenchess)
  googleAuth: true, // "Continue with Google" (Google Cloud project golden-chess-512108, client "Golden Chess web"; Supabase provider on)
  // the Google client (public id): Google's own button on the website (authorised JavaScript origin https://golden-chess.com)
  googleClientId: '977363935890-q5rnfd17nih6agv3ha00af926ev6j275.apps.googleusercontent.com',
  // where Google's sign-in page answers (an authorised redirect URI of that client): google.html hands the token on
  googleReturn: 'https://golden-chess.com/google.html',
};
const SITE = 'https://golden-chess.com/';

const pieces = JSON.parse(rd('build/pieces.json'));
let css = '';
for (const [k, svg] of Object.entries(pieces)) css += `.p-${k}{background-image:url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}")}\n`;
const SCENE = rd('app/resources/scene.svg').replace(/^<\?xml[^>]*>\s*/, '');
const core = rd('src/core.js'), engine = rd('src/engine.js');
const workerSrc = [core, engine, rd('src/worker.js')].join('\n;\n');
// the icon (app/resources/icon.svg, made by app/resources/brand.py): the logo in the page and the favicon
const ICON_INNER = rd('app/resources/icon.svg').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
if (/'/.test(ICON_INNER)) throw new Error('icon.svg contains a single quote');
const LOGO = '<svg class="logo" viewBox="0 0 100 100" aria-hidden="true">' + ICON_INNER + '</svg>';
// the name (app/resources/wordmark.svg, made by app/resources/make_wordmark.py)
const WORDMARK = rd('app/resources/wordmark.svg').trim().replace(/^<svg xmlns="[^"]*" /, '<svg ');
if (/'/.test(WORDMARK)) throw new Error('wordmark.svg contains a single quote');
// the piece alone (app/resources/piece.svg): the search, empty screens, the puzzle bar, a win
const PIECE = rd('app/resources/piece.svg').trim().replace(/^<svg xmlns="[^"]*" /, '<svg ');
if (/'/.test(PIECE)) throw new Error('piece.svg contains a single quote');
// each copy put in the page gets its own ids (clip paths, masks)
let uniqN = 0;
const uniq = (svg) => { const n = 'b' + (++uniqN); return svg.replace(/id="([^"]+)"/g, 'id="$1' + n + '"').replace(/url\(#([^)]+)\)/g, 'url(#$1' + n + ')'); };
const mainSrc = [core, engine, rd('src/book.js'), rd('src/review.js'), rd('src/ui/sound.js'), rd('src/ui/board.js'), rd('src/puzzles.js'), rd('src/ui/learn.js'), rd('src/ui/bots.js'), rd('src/ui/app.js').replace("'__LOGO_SVG__'", () => "'" + LOGO + "'").replace("'__WORDMARK__'", () => "'" + WORDMARK + "'")].join('\n;\n').split("'__PIECE_SVG__'").join("'" + PIECE + "'");
const supa = rd('vendor/supabase-js-2.117.2.umd.js');
for (const [name, src] of [['worker', workerSrc], ['main', mainSrc], ['supabase', supa]]) if (/<\/script/i.test(src)) throw new Error(name + ' contains </script');

const page = (pre) => rd('src/ui/template.html').replace('/*PIECE_CSS*/', () => css).replace('<!--INTRO_SCENE-->', () => SCENE).replace(/<!--LOGO-->/g, () => uniq(LOGO)).replace(/<!--WORDMARK-->/g, () => uniq(WORDMARK)).replace('/*ENGINE_SRC*/', () => workerSrc).replace('/*MAIN_SRC*/', () => pre + mainSrc);
const body = page('');
// the artifact can't reach the game server, so it points to the website for online play
const artifactBody = page('window.GC_SITE = ' + JSON.stringify(SITE) + ';\n');
const RESET = '<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}html{box-sizing:border-box}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>';
const doc = (head, b) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + head + RESET + '</head><body>' + b + '</body></html>\n';

// the favicon: the same icon as the logo in the page
const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + ICON_INNER + '</svg>');
const DESC = 'Chess with one Joker Move per game: teleport a queen, rook, bishop or knight to any empty square. Play the bot, a friend, or rated games online.';
// plain http (an old link, the github.io redirect before HTTPS is enforced) goes to https: one origin, one saved session
const TO_HTTPS = '<script>if(location.protocol==="http:"&&/(^|\\.)golden-chess\\.com$/.test(location.hostname))location.replace("https://golden-chess.com"+location.pathname+location.search+location.hash)</script>';
const webHead = TO_HTTPS + '<title>Joker Chess</title><meta name="description" content="' + DESC + '"><meta name="theme-color" content="#2a2f2d">' +
  '<link rel="icon" href="' + ICON + '"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="privacy-policy" href="privacy.html">' +
  '<meta property="og:title" content="Joker Chess"><meta property="og:description" content="' + DESC + '">' +
  '<meta property="og:type" content="website"><meta property="og:url" content="' + SITE + '"><meta property="og:image" content="' + SITE + 'og.png?v=2"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
  '<meta name="twitter:card" content="summary_large_image">';
const webBody = body.replace(/^<title>[^<]*<\/title>\n/, '').replace(/^<meta name="claude:viewport-fit-sides"[^>]*>\n/m, '');

write('dist/golden-chess.html', artifactBody);
write('dist/preview.html', doc('', artifactBody));
// the build's id: the app (which shows the live site) checks it when it opens or comes back and reloads when the site
// has moved on, instead of waiting for the phone's cached copy to expire
const BUILD = require('crypto').createHash('sha1').update(webBody).digest('hex').slice(0, 10);
write('dist/web/index.html', doc(webHead + '<script>' + supa + '</script><script>window.GC_ONLINE=' + JSON.stringify(ONLINE) + '</script><script>window.GC_BUILD=' + JSON.stringify(BUILD) + '</script>', webBody));
write('dist/web/version.json', JSON.stringify({ build: BUILD }) + '\n');
write('version.json', JSON.stringify({ build: BUILD }) + '\n');
write('dist/mock/index.html', doc('<title>Joker Chess (local server)</title><script>window.GC_ONLINE={mock:"",reviewEmail:"review@kozyramedia.com"}</script>', webBody));
// the app shows the live site; this copy (bots and two players, no online play) is what it opens without internet
const appBody = page('window.GC_SITE = ' + JSON.stringify(SITE) + ';\nwindow.GC_APP_OFFLINE = true;\n').replace(/^<title>[^<]*<\/title>\n/, '').replace(/^<meta name="claude:viewport-fit-sides"[^>]*>\n/m, '');
write('app/www/index.html', doc('<title>Joker Chess</title><meta name="theme-color" content="#2a2f2d">', appBody));
write('supabase/functions/play/core.js', '// Generated from src/core.js by build.js. Do not edit.\n' + core + '\nexport default GC;\n');
console.log('built: artifact', (body.length / 1024).toFixed(0) + ' KB, web', (fs.statSync(path.join(__dirname, 'dist/web/index.html')).size / 1024).toFixed(0) + ' KB');
