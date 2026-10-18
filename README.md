# Golden Chess

Chess plus one **golden move** per player per game: a queen, rook, bishop or knight teleports to any empty square. No capture, no check on the opponent's king afterwards, own king must be safe (so it can block a slider check). Kings and pawns can't use it. Everything else is standard chess; a rook that teleports loses its castling right.

Play: https://ukazyra-collab.github.io/golden-chess/ (bot, two players on one device, online rated games, invite a friend by link).

## Layout

| Path | What |
| --- | --- |
| `src/core.js` | Rules: 0x88 move generator, make/unmake, golden moves, SAN (`Nb1★e5`), FEN with a 7th field for golden rights (`Gg`, `G`, `g`, `-`), draws, Zobrist hashing. Shared by the browser, the bot and the server |
| `src/engine.js` | Bot and analysis: PVS alpha-beta, TT, quiescence, null move, LMR, PeSTO eval; golden moves at the root, as check evasions and as candidates at depth ≥ 3. Eight levels calibrated against Stockfish (≈600–2500 Elo) |
| `src/worker.js` | Web Worker entry for the engine |
| `src/ui/board.js` | Renderer: one id per piece, one rAF loop, every animation starts from the piece's current drawn position (no overlapping animations) |
| `src/ui/app.js` | Controller: single synchronous move path, monotonic clocks, premoves, golden mode, bot, review (accuracy, estimated Elo), online play, EN/RU |
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
- Anonymous accounts (Supabase anonymous sign-in); a random name you can change.

## Tests

- `node test/perft.js` — move generator vs reference perft counts
- `node test/golden.js` — golden-move rules + random-play fuzz
- `node test/engine.js` — tactics incl. golden block, mate finding, KQK conversion
- `node test/server/logic.test.mjs` — server: pairing, invites, legality, clocks, flags, aborts, draws, rematch, ratings, concurrent writes
- `python3 test/online_e2e.py` — two browsers play each other through `test/server/mock-server.mjs` (same server logic, in-memory store, SSE instead of Realtime): pairing, moves, premoves, golden move, clock sync, draw offer, reload, dropped realtime, flag, rating change, rematch, abort, invite link, spectator
- `python3 test/targeted.py`, `python3 test/review_test.py`, `python3 test/stress.py <seed> <games>` — offline UI flows, review, randomized input with a per-frame consistency monitor

## Deploy

`node build.js`, copy `dist/web/index.html` and `dist/web/og.png` to the repository root, push to `main`. GitHub Pages serves the site; the Supabase GitHub integration applies new migrations and deploys the `play` function.
