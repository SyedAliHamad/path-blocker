import {
  applyMove,
  distanceToGoal,
  isLegalWall,
  legalMoves,
  pawnTargets,
  shortestDistance,
  shortestPath,
  stampWall,
  type Cell,
  type GameState,
  type Move,
  type Wall,
} from '@pb/engine';
import type { Level } from './levels';

const WIN_SCORE = 100_000;

/**
 * Position score from `seat`'s point of view, in tenths of a step.
 *
 * Distance to goal dominates everything: Path Blocker is a race, and a wall is
 * only worth what it adds to the opponent's route. Spare walls get a small
 * credit so the bot does not dump its stock early for no gain.
 */
export function evaluate(state: GameState, seat: number): number {
  const opponent = seat === 0 ? 1 : 0;
  const mine = distanceToGoal(state, seat);
  const theirs = distanceToGoal(state, opponent);

  if (mine < 0) return -WIN_SCORE;
  if (theirs < 0) return WIN_SCORE;

  const wallEdge = (state.wallsLeft[seat] ?? 0) - (state.wallsLeft[opponent] ?? 0);
  return (theirs - mine) * 10 + wallEdge * 2;
}

/** The one or two wall slots that would close the step from `a` to `b`. */
function wallsBlockingStep(a: Cell, b: Cell): Wall[] {
  if (a.x === b.x) {
    const y = Math.min(a.y, b.y);
    return [
      { x: a.x, y, o: 'h' },
      { x: a.x - 1, y, o: 'h' },
    ];
  }
  const x = Math.min(a.x, b.x);
  return [
    { x, y: a.y, o: 'v' },
    { x, y: a.y - 1, o: 'v' },
  ];
}

/** Distance for `seat` if `wall` were placed, without building a new state. */
function distanceWithWall(state: GameState, wall: Wall, seat: number): number {
  const h = Uint8Array.from(state.blockedH);
  const v = Uint8Array.from(state.blockedV);
  stampWall(state.variant.size, h, v, wall, 1);
  return shortestDistance(state.variant, h, v, state.pawns[seat]!, seat);
}

/**
 * The handful of walls worth searching.
 *
 * Considering all ~128 legal walls makes anything past depth 2 unaffordable,
 * and almost all of them are pointless. Only walls that sit on the opponent's
 * current best route can change the race, so those are scored by how much they
 * cost the opponent net of what they cost us, and the best few are kept.
 */
export function wallCandidates(state: GameState, seat: number, level: Level): Wall[] {
  if (level.wallCandidates === 0) return [];
  if ((state.wallsLeft[seat] ?? 0) <= 0) return [];

  const opponent = seat === 0 ? 1 : 0;
  const myDistance = distanceToGoal(state, seat);
  const theirDistance = distanceToGoal(state, opponent);

  // Comfortably ahead: keep running rather than spending walls.
  if (theirDistance - myDistance >= level.wallThreshold) return [];

  const route = shortestPath(
    state.variant,
    state.blockedH,
    state.blockedV,
    state.pawns[opponent]!,
    opponent,
  );
  if (!route) return [];

  const seen = new Set<string>();
  const scored: { wall: Wall; gain: number }[] = [];

  for (let i = 0; i + 1 < route.length; i++) {
    for (const wall of wallsBlockingStep(route[i]!, route[i + 1]!)) {
      const key = `${wall.x},${wall.y},${wall.o}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (!isLegalWall(state, seat, wall).ok) continue;

      const theirCost = distanceWithWall(state, wall, opponent) - theirDistance;
      const myCost = distanceWithWall(state, wall, seat) - myDistance;
      const gain = theirCost - myCost;
      if (gain > 0) scored.push({ wall, gain });
    }
  }

  scored.sort((a, b) => b.gain - a.gain);
  return scored.slice(0, level.wallCandidates).map((entry) => entry.wall);
}

/** Pawn steps first, then the shortlisted walls: good moves early prune more. */
export function candidateMoves(state: GameState, level: Level): Move[] {
  const seat = state.turn;
  const moves: Move[] = pawnTargets(state, seat).map((to) => ({ kind: 'pawn', to }));
  for (const wall of wallCandidates(state, seat, level)) moves.push({ kind: 'wall', wall });
  return moves;
}

/**
 * Negamax with alpha-beta pruning, scored from the side to move.
 *
 * Two-player only: with four players there is no single opponent to minimise
 * against, so `bestMove` falls back to a greedy choice there.
 */
function negamax(
  state: GameState,
  level: Level,
  depth: number,
  alpha: number,
  beta: number,
  fromRoot: number,
): number {
  if (state.result) {
    const { winner } = state.result;
    if (winner === null) return 0;
    // The winner has just moved, so the side to move here is the loser.
    return winner === state.turn ? WIN_SCORE - fromRoot : fromRoot - WIN_SCORE;
  }

  if (depth === 0) return evaluate(state, state.turn);

  let best = -Infinity;
  let window = alpha;

  for (const move of candidateMoves(state, level)) {
    const applied = applyMove(state, move);
    if (!applied.ok) continue;

    const score = -negamax(applied.state, level, depth - 1, -beta, -window, fromRoot + 1);
    if (score > best) best = score;
    if (best > window) window = best;
    if (window >= beta) break;
  }

  return best === -Infinity ? evaluate(state, state.turn) : best;
}

export interface SearchResult {
  readonly move: Move;
  readonly score: number;
}

/** Score every root move so callers can blunder deliberately or explain a choice. */
export function rankMoves(state: GameState, level: Level): SearchResult[] {
  const twoPlayer = state.variant.playerCount === 2;
  const moves = twoPlayer ? candidateMoves(state, level) : legalMoves(state).slice(0, 32);
  const ranked: SearchResult[] = [];

  for (const move of moves) {
    const applied = applyMove(state, move);
    if (!applied.ok) continue;

    const score = twoPlayer
      ? -negamax(applied.state, level, level.depth - 1, -Infinity, Infinity, 1)
      : evaluate(applied.state, state.turn);

    ranked.push({ move, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/**
 * Pick a move for the side to move.
 *
 * `random` is injected so games can be replayed exactly in tests; the easy
 * levels use it to pick a sound-looking but inferior move now and then.
 */
export function bestMove(state: GameState, level: Level, random: () => number = Math.random): Move {
  const ranked = rankMoves(state, level);
  if (ranked.length === 0) {
    const fallback = legalMoves(state)[0];
    if (!fallback) throw new Error('no legal move available');
    return fallback;
  }

  const shouldBlunder = level.blunderRate > 0 && random() < level.blunderRate && ranked.length > 1;
  if (!shouldBlunder) return ranked[0]!.move;

  // Pick from the runners-up rather than anything at all, so an easy bot looks
  // careless instead of broken.
  const pool = ranked.slice(1, Math.min(ranked.length, 4));
  return pool[Math.floor(random() * pool.length)]!.move;
}
