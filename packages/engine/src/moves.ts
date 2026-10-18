import {
  DIRECTIONS,
  cellEquals,
  edgeBlocked,
  inBounds,
  slotInBounds,
  stampWall,
  wallsConflict,
} from './board';
import { allPlayersHavePath } from './path';
import type { Cell, GameState, Legality, Move, Wall } from './types';
import { LEGAL, illegal } from './types';

function occupantAt(state: GameState, c: Cell): number | null {
  for (let seat = 0; seat < state.pawns.length; seat++) {
    if (state.eliminated[seat]) continue;
    if (cellEquals(state.pawns[seat]!, c)) return seat;
  }
  return null;
}

/** Walls are locked out once sudden death begins. */
export function wallsClosed(state: GameState): boolean {
  const limit = state.variant.suddenDeathPly;
  return limit !== null && state.ply >= limit;
}

/**
 * Every square `seat` may step to, including jumps.
 *
 * Jump rules: when a neighbour holds a pawn, you land on the square directly
 * behind it. If that square is off the board, walled off, or itself occupied,
 * you instead step diagonally to either square beside the blocked pawn.
 */
export function pawnTargets(state: GameState, seat: number): Cell[] {
  const { size } = state.variant;
  const from = state.pawns[seat];
  if (!from) return [];

  const out: Cell[] = [];
  const push = (c: Cell): void => {
    if (!out.some((existing) => cellEquals(existing, c))) out.push(c);
  };

  for (const dir of DIRECTIONS) {
    const next: Cell = { x: from.x + dir.x, y: from.y + dir.y };
    if (!inBounds(size, next)) continue;
    if (edgeBlocked(size, state.blockedH, state.blockedV, from, next)) continue;

    if (occupantAt(state, next) === null) {
      push(next);
      continue;
    }

    const beyond: Cell = { x: next.x + dir.x, y: next.y + dir.y };
    const canJumpStraight =
      inBounds(size, beyond) &&
      !edgeBlocked(size, state.blockedH, state.blockedV, next, beyond) &&
      occupantAt(state, beyond) === null;

    if (canJumpStraight) {
      push(beyond);
      continue;
    }

    // Blocked behind: sidestep to either square flanking the occupied cell.
    for (const side of DIRECTIONS) {
      if (side.x === dir.x && side.y === dir.y) continue;
      if (side.x === -dir.x && side.y === -dir.y) continue;

      const diagonal: Cell = { x: next.x + side.x, y: next.y + side.y };
      if (!inBounds(size, diagonal)) continue;
      if (edgeBlocked(size, state.blockedH, state.blockedV, next, diagonal)) continue;
      if (occupantAt(state, diagonal) !== null) continue;
      push(diagonal);
    }
  }

  return out;
}

export function isLegalPawnMove(state: GameState, seat: number, to: Cell): Legality {
  if (state.result) return illegal('game-over');
  if (state.turn !== seat) return illegal('not-your-turn');
  if (!inBounds(state.variant.size, to)) return illegal('off-board');
  if (occupantAt(state, to) !== null) return illegal('occupied');

  const targets = pawnTargets(state, seat);
  if (!targets.some((t) => cellEquals(t, to))) {
    const from = state.pawns[seat]!;
    const step = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    return illegal(step === 1 ? 'blocked' : 'not-adjacent');
  }
  return LEGAL;
}

export function isLegalWall(state: GameState, seat: number, wall: Wall): Legality {
  if (state.result) return illegal('game-over');
  if (state.turn !== seat) return illegal('not-your-turn');
  if (wallsClosed(state)) return illegal('walls-closed');
  if (!slotInBounds(state.variant.size, wall)) return illegal('wall-out-of-bounds');
  if ((state.wallsLeft[seat] ?? 0) <= 0) return illegal('no-walls-left');

  for (const placed of state.walls) {
    if (wallsConflict(placed, wall)) return illegal('wall-overlap');
  }

  // The expensive check goes last: stamp the wall onto scratch copies and make
  // sure nobody has been sealed away from their goal.
  const { size } = state.variant;
  const h = Uint8Array.from(state.blockedH);
  const v = Uint8Array.from(state.blockedV);
  stampWall(size, h, v, wall, 1);
  if (!allPlayersHavePath(state.variant, h, v, state.pawns, state.eliminated)) {
    return illegal('would-trap');
  }

  return LEGAL;
}

export function isLegalMove(state: GameState, seat: number, move: Move): Legality {
  return move.kind === 'pawn'
    ? isLegalPawnMove(state, seat, move.to)
    : isLegalWall(state, seat, move.wall);
}

/** Every legal wall for the side to move. */
export function legalWalls(state: GameState): Wall[] {
  if (state.result || wallsClosed(state)) return [];
  if ((state.wallsLeft[state.turn] ?? 0) <= 0) return [];

  const out: Wall[] = [];
  const limit = state.variant.size - 1;
  for (let y = 0; y < limit; y++) {
    for (let x = 0; x < limit; x++) {
      for (const o of ['h', 'v'] as const) {
        const wall: Wall = { x, y, o };
        if (isLegalWall(state, state.turn, wall).ok) out.push(wall);
      }
    }
  }
  return out;
}

/**
 * Every legal move for the side to move.
 *
 * Pawn moves come first: they are cheap to generate and are usually the best
 * candidates, which helps alpha-beta pruning in the AI.
 */
export function legalMoves(state: GameState): Move[] {
  if (state.result) return [];
  const moves: Move[] = pawnTargets(state, state.turn).map((to) => ({ kind: 'pawn', to }));
  for (const wall of legalWalls(state)) moves.push({ kind: 'wall', wall });
  return moves;
}
