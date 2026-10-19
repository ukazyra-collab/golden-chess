# Golden Chess

Chess plus one **golden move** per player per game: a queen, rook, bishop or knight teleports to any empty square. No capture, no check on the opponent's king afterwards, own king must be safe (so it can block a slider check). Kings and pawns can't use it. Everything else is standard chess; a rook that teleports loses its castling right.

Play: https://golden-chess.com (bot, two players on one device, online rated games, invite a friend by link).

The site has five tabs, like a chess site: **Play** (time control, Play, Play a friend by link or on one device), **Bots** (eight characters, one per engine level, from Pip at 600 to Golden at 2500), **Learn** (what the golden move is, autoplay boards, three one-move puzzles), **Ratings** (leaderboard per pool) and **Profile** (name, ratings, settings). A bottom tab bar on phones, a side rail on wider screens; the address hash names the tab (`#play`, `#bots`, `#learn`, `#ratings`, `#profile`, `#signin`, `#game`), so the browser's back button works. Each screen has one main action in gold and at most one quieter one. Online play needs an account (email code, free); bot and two-player games don't. Bot games have no clock, and the bot takes a human-like pause before each move (shorter in the opening, on forced moves and recaptures, longer in rich positions and before its golden move).

## Layout

| Path | What |
| --- | --- |
| `src/core.js` | Rules: 0x88 move generator, make/unmake, golden moves, SAN (`Nb1★e5`), FEN with a 7th field for golden rights (`Gg`, `G`, `g`, `-`), draws, Zobrist hashing. Shared by the browser, the bot and the server |
| `src/engine.js` | Bot and analysis: PVS alpha-beta, TT, quiescence, null move, LMR, PeSTO eval; golden moves at the root, as check evasions and as candidates at depth ≥ 3. Eight levels calibrated against Stockfish (≈600–2500 Elo) |
| `src/worker.js` | Web Worker entry for the engine |
| `src/ui/board.js` | Renderer: one id per piece, one rAF loop, every animation starts from the piece's current drawn position (no overlapping animations) |
| `src/ui/app.js` | Controller: single synchronous move path, monotonic clocks, premoves, golden mode, bot, review (accuracy, estimated Elo), online play, tabs and sign-in page, EN/RU |
| `src/ui/learn.js` | The Learn tab: autoplay boards and puzzles (positions checked by `test/learn.js`) |
| `src/ui/bots.js` | The eight bot characters: names, bios, portraits drawn as inline SVG |
| `src/ui/sound.js` | Synthesized sounds (WebAudio, no samples) |
| `src/ui/template.html` | Page shell + CSS |
| `supabase/functions/play/` | Game server (edge function): `logic.js` is runtime-agnostic, `index.ts` wires it to Postgres and Realtime, `core.js` is generated from `src/core.js` |
| `supabase/migrations/` | Tables `profiles`, `ratings` (Glicko-2 per pool: bullet, blitz, rapid), `games`, `seeks`; atomic matchmaking `gc_pair`; read-only RLS for clients |
| `build.js` | Builds `dist/` (artifact page, website, local-test page) and the server's `core.js` |
| `index.html`, `og.png` | The published website (copied from `dist/web/`) |

## Online play

- Clients only read the database; every change goes through the `play` edge function, which replays the game with the same rules module, checks the move, runs the clocks on server time (150 ms lag credit per move) and settles results and ratings.
- Writes are guarded by a row `version`, so two simultaneous requests can never both apply.
- Each state change is broadcast on a private Realtime channel `g:<game id>`; clients also poll as a fallback. Own moves are shown at once and confirmed by the server; a rejected move rolls back.
- A flag falls on the server: the client that sees a clock at zero asks the server to settle it (`claim`). A player who doesn't make a first move within 30 s gets the game aborted.
- Matchmaking pairs the closest rating with the same time control and rated/casual choice. Invites are links (`?join=<id>`); a third person opening one watches.
- Accounts: a visitor starts as a guest (Supabase anonymous sign-in). Online play (Start Game, Play a Friend, opening an invite link) asks a guest to sign in first; the chosen action is remembered (`goldenchess.pending`, 30 min, also across a reload or the email link) and continues right after. Signing in adds an email to that same account (`updateUser({ email })` + a 6-digit code, `verifyOtp` type `email_change`), so anything the guest had stays, and a new account then picks a name; an email that already has an account signs in to it (`signInWithOtp` + code, type `email`). The email also carries a one-tap link for the same device. The server marks a profile registered (`profiles.is_guest = false`) from the token's `is_anonymous` claim. Sign out leaves a fresh guest. Email templates and the Auth settings they need: `supabase/emails/README.md`. Google sign-in is wired (`linkIdentity` for guests) behind `googleAuth` in `build.js`.
- Latency: the function talks to Postgres directly (postgres.js over `SUPABASE_DB_URL`, REST API as a fallback), runs in the database's region (`?forceFunctionRegion=eu-central-1`), and clients send CORS-simple requests (text/plain body with the token inside), so no preflight round trip. Every response carries a `Server-Timing` header (auth, db, total).

## Tests

- `node test/perft.js` — move generator vs reference perft counts
- `node test/golden.js` — golden-move rules + random-play fuzz
- `node test/engine.js` — tactics incl. golden block, mate finding, KQK conversion
- `node test/server/logic.test.mjs` — server: pairing, invites, legality, clocks, flags, aborts, draws, rematch, ratings, concurrent writes; `PG=1` runs the same tests on real Postgres (PGlite) through postgres.js with the production migration (dev deps in `test/server/package.json`)
- `DENO=<path to deno> node test/server/edge-local.mjs` — the production `index.ts` under Deno against PGlite, with a fake JWKS (ES256 tokens) and a fake Realtime endpoint
- `python3 test/online_e2e.py` — two browsers play each other through `test/server/mock-server.mjs` (same server logic, in-memory store, SSE instead of Realtime): pairing, moves, premoves, golden move, clock sync, draw offer, reload, dropped realtime, flag, rating change, rematch, abort, invite link, spectator
- `python3 test/account_e2e.py` — accounts through the mock server's stand-in for Supabase Auth (codes land in an outbox): Start Game sends a guest to the sign-in page and the search starts after it, a new account keeps the guest's id and picks a name (a taken one is refused), signing in from Profile and Ratings returns there, a second device signs in and is the same player, sign out, wrong code, resend limit, refused during a live game, expired link
- `python3 test/bot_think.py` — the Bots tab, no clock in bot games, the bot's thinking pause (never instant, varies, quick forced moves, longer before a golden move)
- `node test/learn.js` — the Learn tab: scripted moves are legal, the "mate in normal chess" positions are mate, every accepted puzzle answer wins or saves the game and every other golden move scores clearly worse (engine)
- `python3 test/targeted.py`, `python3 test/review_test.py`, `python3 test/stress.py <seed> <games>` — offline UI flows, review, randomized input with a per-frame consistency monitor
- `python3 test/shots.py`, `python3 test/online_shots.py en ru` — screenshots (phone and desktop) into `test/shots/`
- `python3 test/native_app.py` — the site inside the iPhone / Android app, with stand-ins for the app's bridge and for supabase-js: Google opens in the system browser and comes back through `goldenchess://auth` (same player, another player, a link taken once, a link the app was started with), the Android back button, the system share sheet for invites, the app's offline copy

## The app (iPhone / Android)

`app/` is a Capacitor 8 shell around the live site, with the site's offline copy (`app/www/index.html`, made by `build.js`) for launches without internet. Every change under `app/` builds an Android test APK (release `android-test`) and checks the iPhone project in `.github/workflows/app.yml`. Steps for Xcode, Android Studio and the stores: `app/README.md` (in Russian).

## Deploy

`node build.js`, copy `dist/web/index.html` and `dist/web/og.png` to the repository root, push to `main`. GitHub Pages serves the site; the Supabase GitHub integration applies new migrations and deploys the `play` function.

The address is https://golden-chess.com (GoDaddy DNS: four A records for `@` to GitHub Pages, 185.199.108.153 – 185.199.111.153, and `www` as a CNAME to `ukazyra-collab.github.io`; the `CNAME` file in the repository root names the domain). The old https://ukazyra-collab.github.io/golden-chess/ redirects there.
