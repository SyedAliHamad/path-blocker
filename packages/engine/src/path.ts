import { DIRECTIONS, cellIndex, edgeBlocked, goalCells } from './board';
import type { Cell, GameState, Variant } from './types';

/**
 * Goal lookup as a flat mask. Built once per seat per variant and cached,
 * because `shortestDistance` runs thousands of times per AI search and once
 * per candidate wall during legality checks.
 */
const goalMaskCache = new WeakMap<Variant, Uint8Array[]>();

export function goalMask(variant: Variant, seat: number): Uint8Array {
  let perSeat = goalMaskCache.get(variant);
  if (!perSeat) {
    perSeat = [];
    goalMaskCache.set(variant, perSeat);
  }
  const cached = perSeat[seat];
  if (cached) return cached;

  const mask = new Uint8Array(variant.size * variant.size);
  for (const c of goalCells(variant, seat)) mask[cellIndex(variant.size, c)] = 1;
  perSeat[seat] = mask;
  return mask;
}

/**
 * Breadth-first distance from `from` to the nearest goal cell for `seat`,
 * or `-1` when no route exists.
 *
 * Pawns are deliberately ignored: they can always be jumped or walked around,
 * so they never make a goal unreachable. Treating them as obstacles here would
 * make legal wall placements look illegal.
 */
export function shortestDistance(
  variant: Variant,
  blockedH: Uint8Array,
  blockedV: Uint8Array,
  from: Cell,
  seat: number,
): number {
  const { size } = variant;
  const mask = goalMask(variant, seat);
  const start = cellIndex(size, from);
  if (mask[start] === 1) return 0;

  const dist = new Int16Array(size * size).fill(-1);
  const queue = new Int16Array(size * size);
  let head = 0;
  let tail = 0;

  dist[start] = 0;
  queue[tail++] = start;

  while (head < tail) {
    const current = queue[head++]!;
    const cx = current % size;
    const cy = (current - cx) / size;
    const d = dist[current]!;

    for (const dir of DIRECTIONS) {
      const nx = cx + dir.x;
      const ny = cy + dir.y;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;

      const next = ny * size + nx;
      if (dist[next] !== -1) continue;
      if (edgeBlocked(size, blockedH, blockedV, { x: cx, y: cy }, { x: nx, y: ny })) continue;

      if (mask[next] === 1) return d + 1;
      dist[next] = d + 1;
      queue[tail++] = next;
    }
  }

  return -1;
}

/** Convenience wrapper reading the pawn position straight off the state. */
export function distanceToGoal(state: GameState, seat: number): number {
  const pawn = state.pawns[seat];
  if (!pawn) throw new Error(`no pawn for seat ${seat}`);
  return shortestDistance(state.variant, state.blockedH, state.blockedV, pawn, seat);
}

/**
 * True when every seat still in the game can reach its goal.
 *
 * This is the invariant that makes the game finite: a wall that violates it is
 * illegal, so no position is ever unwinnable.
 */
export function allPlayersHavePath(
  variant: Variant,
  blockedH: Uint8Array,
  blockedV: Uint8Array,
  pawns: readonly Cell[],
  eliminated: readonly boolean[],
): boolean {
  for (let seat = 0; seat < pawns.length; seat++) {
    if (eliminated[seat]) continue;
    const pawn = pawns[seat]!;
    if (shortestDistance(variant, blockedH, blockedV, pawn, seat) < 0) return false;
  }
  return true;
}

/**
 * The actual route a pawn would walk to its goal, start cell first, or `null`
 * when the goal is unreachable.
 *
 * Used by the AI to decide which walls are worth considering, and by the hint
 * feature to show a player their own best line.
 */
export function shortestPath(
  variant: Variant,
  blockedH: Uint8Array,
  blockedV: Uint8Array,
  from: Cell,
  seat: number,
): Cell[] | null {
  const { size } = variant;
  const mask = goalMask(variant, seat);
  const start = cellIndex(size, from);

  const cameFrom = new Int16Array(size * size).fill(-1);
  const seen = new Uint8Array(size * size);
  const queue = new Int16Array(size * size);
  let head = 0;
  let tail = 0;

  seen[start] = 1;
  queue[tail++] = start;

  let goalIndex = mask[start] === 1 ? start : -1;

  while (head < tail && goalIndex === -1) {
    const current = queue[head++]!;
    const cx = current % size;
    const cy = (current - cx) / size;

    for (const dir of DIRECTIONS) {
      const nx = cx + dir.x;
      const ny = cy + dir.y;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;

      const next = ny * size + nx;
      if (seen[next] === 1) continue;
      if (edgeBlocked(size, blockedH, blockedV, { x: cx, y: cy }, { x: nx, y: ny })) continue;

      seen[next] = 1;
      cameFrom[next] = current;
      if (mask[next] === 1) {
        goalIndex = next;
        break;
      }
      queue[tail++] = next;
    }
  }

  if (goalIndex === -1) return null;

  const path: Cell[] = [];
  for (let at = goalIndex; at !== -1; at = cameFrom[at]!) {
    path.push({ x: at % size, y: Math.floor(at / size) });
  }
  return path.reverse();
}
