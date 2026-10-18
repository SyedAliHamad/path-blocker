# Path Blocker

A web game in the mould of [barricade.gg](https://barricade.gg): race your pawn
to the far side of the board while walling off your opponent — and never seal
anyone in completely.

Playable right now against the computer or a second player on the same device.
Built so that online play, ratings and matchmaking are additions rather than
rewrites.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 75 tests
```

## Layout

```
packages/engine     rules: moves, walls, jumping, pathfinding, notation
packages/protocol   wire types: snapshots, commands, events, clocks
packages/client     things that run a game: local, bot — online slots in here
packages/ai         the computer opponent, four levels
apps/server         authoritative websocket game server
packages/moments    what just happened: 23 reactable scenarios
apps/web            Next.js front end
```

## The one architectural rule

**The UI only ever talks to a `GameClient`.** It never calls the engine to
change a game, and it never knows whether the game is running in this tab or on
a server.

```
components/  ->  GameClient  ->  LocalGameClient   (this tab, today)
                              ->  SocketGameClient  (a server, later)
```

`LocalGameClient` is written as an authority, not a convenience: it owns the
state, validates every command against the engine, and publishes `GameSnapshot`
payloads in exactly the shape a websocket server would send. A snapshot carries
the **move list**, not a board dump, so a client rebuilds the position by
replaying it through the same engine the server used — a desync raises an
exception instead of quietly drawing the wrong board.

That is what keeps the later work small:

| Later | What it touches |
|---|---|
| Online play | a new `GameClient`, plus a case in `createGameClient` |
| Friend-link rooms | server-side; the client joins by game id |
| Ratings, leaderboard | server + new pages; the game loop is untouched |
| Matchmaking lobby | new pages feeding a descriptor into the factory |
| Puzzles | `analysePosition` already scores a position |
| 4-player, new variants | a `Variant` object; the engine is already variant-driven |

## Online play

```bash
npm run dev --workspace=@pb/server   # game server on :8787
npm run dev                          # web app on :3000
```

"Play with friends" invents a room code and goes to `/play/<code>`. The server
creates the room when the first player arrives, so a link works before anyone
has opened it. A third visitor spectates.

The server runs a `LocalGameClient` per room — the same object the
single-device game uses — and broadcasts its events. That reuse is deliberate:
the rules, clock, flag timer, rematch and auto-step are already written and
tested, so the server adds only what is genuinely new, which is who may act and
who to tell.

**The client has no authority and cannot be given any.** It holds no rules;
every move goes to the server and the board changes only when the server says
so. Three things follow, each of which was a real bug first:

- `pause` and `resume` are **never** accepted from a client. A client that
  could pause would freeze its opponent's clock forever, so the server drives
  the cinematic pause itself.
- `resign` carries the seat that is resigning. Without it, resigning on your
  opponent's turn handed *them* the loss.
- The clock does not start until both players are present, and stops when one
  drops. Otherwise the per-move timer auto-steps both pawns down the board
  while the first player is still waiting for the invite to be opened.

Seats are remembered per browser, so a refresh or a dropped connection puts you
back in your own seat rather than demoting you to a spectator of your own game.

**Testing two players on one machine:** `localStorage` is per origin, so two
tabs on `localhost` share an identity and land in the same seat. Load the
second player from `127.0.0.1` instead.

## Deployment

| Piece | Where | Why |
|---|---|---|
| Web app | Vercel | static pages, nothing stateful |
| Game server | Fly.io (`apps/server/fly.toml`) | needs connections that outlive a request |

Not Vercel for the game server. Its WebSocket support is real, but it pins each
connection to one instance with no cross-instance broadcast and caps duration
at 5 minutes by default — two players could land on different instances, and a
game routinely runs longer than five minutes.

```bash
fly launch --no-deploy --dockerfile apps/server/Dockerfile
fly secrets set ALLOWED_ORIGINS=https://your-domain
fly deploy
```

Set `NEXT_PUBLIC_GAME_SERVER_URL` on the web app to the deployed `wss://` URL.
`ALLOWED_ORIGINS` matters: browsers do not apply CORS to WebSockets, so without
it any site could open connections using a visitor's browser.

## The engine

Pure TypeScript, no dependencies, no I/O. It runs unchanged in the browser, in
a Node server and inside the AI.

- `createGame(variant)` / `applyMove(state, move)` — `applyMove` returns a new
  state and never mutates the old one, so history is just the states you kept.
- `replay(variant, moves)` — rebuild any position from its move list.
- `legalMoves`, `pawnTargets`, `legalWalls` — the board offers only legal moves.
- `shortestDistance`, `shortestPath` — the race metric, and the basis of the
  no-trapping rule.
- `encodePosition` / `decodePosition` — a compact FEN-like string
  (`classic|e1,e9|e5h|9,10|0|2`) for puzzles, bug reports and sharing.

Notation is chess-like: cells are `e5`, walls add an orientation — `e5h`,
`c3v`, naming the slot's lower-left corner.

### Rules, exactly

9×9, 10 walls each. Move one orthogonal square **or** place a wall; no passing.
Walls are two cells long, block both players, and may not overlap or cross.
**No wall may leave any player without a route to their goal** — checked with a
BFS per player on every candidate placement, which is why the game always ends.
Adjacent pawns jump straight over; when a wall or the board edge sits behind the
opponent, the jump becomes a diagonal step.

Variants are data (`packages/engine/src/variants.ts`): `CLASSIC`, `DUEL` (7×7)
and `KING_OF_THE_HILL` (11×11, four players, race to the middle, sudden death,
move cap) all come from the same engine.

## The AI

Negamax with alpha-beta over the shared engine, scoring positions by the
difference in distance-to-goal. The trick that makes depth 4 affordable is
candidate selection: of ~128 legal walls, only those that sit on the opponent's
current best route can change the race, so the search sees a dozen instead of a
hundred. Levels 1–4 differ in depth, how many walls they consider, how far ahead
they must be before they stop spending walls, and how often they deliberately
pick a worse move.

Roughly 2ms (level 1) to 100ms (level 4) per move. It runs on the main thread;
moving it into a worker means changing `packages/ai/src/bot.ts` alone, since
callers only await a promise.

## Reactions

Music and memes are driven by *moments*, not by moves. `packages/moments`
turns each move into facts — "that wall added six squares to their route" is a
subtraction over `shortestDistance`, not a guess — and the media library maps
those to gifs and sounds.

There are 23 scenarios (`packages/moments/src/catalogue.ts`), each with two
sides: the player who caused it and the player it happened to.

**Both sides are heard.** A block is an exchange — someone lands it, someone
wears it — so the attacker's sound plays and the victim's answers it 300ms
later, whoever is sitting at the keyboard and whether the other side is a
person or the bot. Playing only the local player's half made the game feel
like it was reacting to one player. The *gif* still follows your own role, so
you see your side of it.

Moments are ranked by priority, and the player walks down that ranking until
it finds a scenario the library actually has media for. That matters while the
library is half-filled: the opening wall is both `first-wall` and
`detour-mild`, and if only one of them is curated, that is the one you get.

Four limits keep it bearable, all editable in the admin panel: a short gap
between one player's reactions, a short gap before the same player repeats a
scenario, a cap per game, and a rule that a scenario never plays the same clip
twice running.

**The gaps are per player, and that matters.** Held globally, your own sound
suppressed your opponent's reply — and since a bot answers within 350-700ms,
the computer was silenced on nearly every move. Reactions from the two sides
are allowed to overlap; only the backlog is capped.

Those numbers were tuned against real play rather than guessed. The scenario
gap is the one that decides the rate — walls arrive in runs, so the same
scenario keeps coming up — and setting it high silences most of a game. It is
deliberately low, with the no-repeat rule providing variety instead.

Sound length and gif length are separate settings: clip lengths vary wildly, so
tying the two together cut a four-second victory fanfare off halfway. Endgame
sounds are not capped at all — nothing follows them, and a victory that fades
mid-phrase reads as a bug. Starting a new game silences whatever the last one
left ringing.

**Big moments stop the game.** A takeover-scale moment (a brutal detour, a
comeback) pauses play, zooms the board onto the player it happened *to*, and
holds there while the meme runs. The pause is real, not cosmetic: it stops the
clock and calls off a thinking bot, so a cutscene cannot cost somebody their
turn or let the computer move behind it. A win is excluded — the celebration is
already the payoff.

Game music is a separate looping element that reaction sounds never touch, so
the bed runs unbroken for the whole game and stings layer over it.

**The admin panel is at `/admin`.** It stores URLs and settings — no uploads,
no hosting — in `localStorage`, with Export/Import to move a library between
browsers. It therefore needs no login today; when the library moves to the
game server, that page is what needs auth in front of it.
`apps/web/lib/media-library.ts` is the only module that has to change.

## Not done yet

- Online play, accounts, ratings, matchmaking, puzzles, spectating
- A chess clock (time carried forward, with increment) is implemented in
  `@pb/protocol` but no mode uses it — both modes run a 10s-per-move timer,
  where running out steps your pawn one square towards goal instead of losing
- The media library is per browser until there is a server to hold it
- Keyboard play on the board (the move list is readable; the SVG is click-only)
- Wall hit areas are ~7px on a phone — fine with a mouse, tight with a thumb

[ANALYSIS.md](ANALYSIS.md) has the barricade.gg teardown this was built from.
[docs/sound-research.md](docs/sound-research.md) has the trending-audio research,
licensing tiers and a suggested sound for each of the 23 scenarios.
