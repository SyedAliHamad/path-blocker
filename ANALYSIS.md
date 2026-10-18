# barricade.gg — teardown & build plan

## 1. What the site actually is

Barricade is **Quoridor** with serial numbers filed off, wrapped in a
lichess.org-style online platform. It is a single game, not a games portal.

**Rules (from /rules):**

| | Classic (2P) | King of the Hill (4P) |
|---|---|---|
| Board | 9×9 | 11×11 |
| Start | middle of your back row | middle of your own edge |
| Walls ("barricades") | 10 each | 7 each |
| Goal | reach the opposite row | reach the centre crown |
| Ranked | yes | no — casual only |

Core mechanics:
- Each turn: **move one orthogonal step** OR **place one wall**. No passing.
- Walls are 2 cells long, sit on the lattice *between* cells, block both players.
- Walls may not overlap or cross.
- **A wall may never fully cut off any player from their goal** → every wall
  placement needs a path-existence check (BFS/DFS) for every player.
- **Jumping:** adjacent pawns → jump straight over. If a wall or board edge sits
  directly behind the opponent → diagonal step to either side instead.
- 4P extras: per-turn timer with auto-step on timeout, two timeouts = eliminated;
  sudden death (no more walls) late game; 400-turn cap → closest to centre wins.

Notation is chess-like: files `a–i`, ranks `1–9`.

## 2. Feature inventory (the platform around the game)

**Routes seen:** `/`, `/puzzle`, `/tv`, `/leaderboard`, `/rules`, `/settings`

- **Play lobby** (`/`) — Play Now (anonymous, no account), Play with Friends
  (share link), vs Computer (4 difficulty levels), King of the Hill (4P casual),
  Local Game (hotseat). Live "N players online · M in game" counter.
- **Live Lobby** — open casual rooms table (player, rating, time control), room
  codes, Create Room, filters.
- **Puzzles** (`/puzzle`) — Daily Puzzle #N with 3 difficulty tiers, "find the
  best move", share button, puzzles matched to your rating.
- **TV** (`/tv`) — auto-streams the highest-rated game in progress, rolls to the
  next when it ends. Also pulls **Twitch** streams in the Barricade category.
- **Leaderboard** — top 100 by rating, with games played. Elo-style, updates per
  ranked game.
- **Accounts** — optional. Anonymous play works (`anon-85483` seen in lobby);
  signing up gets you rating, saved games, matched puzzles.
- **Settings**, **i18n** (language switcher), country flags on profiles.
- **Premium tier** ("Go Premium") + heavy programmatic ads for free users.
- **Mobile apps** — iOS + Android ("Get app" banner).

**In-game UI:** board centre, two player cards (name, rating, flag, wall counter
as pip bar, clock), move list / nav controls (⏮ ◀ ▶ ⏭), sound toggle, board flip,
last-wall highlighted gold, dark theme throughout.

## 3. Their stack (observed, not guessed)

| Layer | Evidence | What it is |
|---|---|---|
| Frontend | `/_next/static/chunks/turbopack-*.js`, `?dpl=` query | **Next.js** (App Router, Turbopack), deployed on **Vercel** |
| Game API/realtime | `api.barricade.gg` (separate origin) | dedicated stateful backend — Vercel can't hold game sockets |
| Light API | `barricade.gg/api/twitch/streams` | Next route handlers for non-realtime bits |
| Analytics | `us-assets.i.posthog.com`, GTM, GA4 | PostHog + Google Analytics |
| Ads | Playwire (`config.playwire.com`, `intergient.com`) + ~60 bidder domains | programmatic header bidding |
| Audio | `/sounds/move.mp3`, `wall.mp3`, `game_start.ogg` | plain static assets |

The split matters: **the real-time game server is its own service**, and the
Next.js app is the shell. Any clone needs the same split.

## 4. The hard parts (where the real work is)

1. **Rules engine** — legal-move generation, wall legality incl. the
   no-full-block invariant (BFS per player per candidate wall), jump/diagonal
   cases. Must be one shared, well-tested module usable by client, server and AI.
2. **Server-authoritative realtime** — the client must never be trusted. Moves
   validated server-side, clocks ticked server-side, reconnect/resume,
   abandonment handling.
3. **Matchmaking + Elo** — rating pools, time controls, pairing, rating updates.
4. **AI opponent** — minimax/MCTS over the move tree with a
   shortest-path-difference evaluation; 4 difficulty levels.
5. **Puzzle generation** — mine finished games for positions with one clearly
   best move (needs the engine to score candidates).
6. **Anti-cheat / abuse** — engine-assistance detection, anon spam, rating abuse.

## 5. Recommended stack for the clone

Deliberately close to theirs, because the shape of the problem forces it.

- **Monorepo** (npm workspaces — pnpm was not installed on this machine)
  - `packages/engine` — pure TypeScript rules engine, zero deps, heavily unit
    tested. The single source of truth.
  - `apps/web` — **Next.js 15 (App Router) + TypeScript + Tailwind**. Board
    rendered as SVG or CSS grid (not canvas — accessibility + simpler hit areas).
  - `apps/server` — **Node + TypeScript, WebSocket** (ws or Socket.IO), holds
    live games in memory, persists on completion. Redis for presence/lobby/
    pub-sub once there's more than one instance.
  - `packages/ai` — engine-backed bot, runs in a worker thread.
- **Postgres** (Neon/Supabase) + **Drizzle** or Prisma — users, games, ratings,
  puzzles.
- **Auth** — Auth.js / Lucia, with first-class anonymous sessions.
- **Hosting** — web on Vercel, game server on Fly.io / Railway / Render
  (needs persistent connections), Redis on Upstash.

Local toolchain checked: Node v24.18.0, npm 11.16.0, git 2.55 — all fine.
No Docker, no Python on this machine.

## 6. Suggested build order

1. `packages/engine` + test suite (the whole game, headless).
2. Board UI + **local hotseat** game — playable in a browser, no server.
3. AI opponent (easy → hard).
4. WebSocket server + online play with room links.
5. Accounts, ratings, leaderboard, saved games.
6. Matchmaking lobby, TV, puzzles, i18n, mobile polish.

Phases 1–3 give a genuinely playable product with no backend at all.

## 7. Decisions taken

- **Game:** same rules as Barricade, with room for our own twists — hence the
  variant system in the engine rather than hard-coded 9x9 constants.
- **v1 scope:** rules engine with tests, board UI, local two-player, AI
  opponent. No server.
- **But designed for more:** online multiplayer with friend-link rooms,
  leaderboards and matchmaking are planned, so the UI talks only to a
  `GameClient` interface and the local game is written as an authority that
  emits the same payloads a server will. See the README.
- **Stack:** npm workspaces monorepo, Next.js 16 + React 19 + Tailwind 4.

## 8. Still open

- Which twist(s) on the rules to build first.
- Branding and domain.
- Whether monetisation (ads/premium) shapes anything early.
