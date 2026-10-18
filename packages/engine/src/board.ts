import type { Cell, Orientation, Variant, Wall } from './types';

/** The four orthogonal steps, in a stable order (N, E, S, W). */
export const DIRECTIONS: readonly Cell[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];

export function cellEquals(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function wallEquals(a: Wall, b: Wall): boolean {
  return a.x === b.x && a.y === b.y && a.o === b.o;
}

export function inBounds(size: number, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < size && c.y < size;
}

/** Wall slots live on an interior lattice one smaller than the board. */
export function slotInBounds(size: number, w: Wall): boolean {
  return w.x >= 0 && w.y >= 0 && w.x < size - 1 && w.y < size - 1;
}

export function cellIndex(size: number, c: Cell): number {
  return c.y * size + c.x;
}

export function cellFromIndex(size: number, i: number): Cell {
  return { x: i % size, y: Math.floor(i / size) };
}

/** Index into `blockedH` for the edge between (x,y) and (x,y+1). */
export function hEdgeIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

/** Index into `blockedV` for the edge between (x,y) and (x+1,y). */
export function vEdgeIndex(size: number, x: number, y: number): number {
  return y * (size - 1) + x;
}

export function newBlockedH(size: number): Uint8Array {
  return new Uint8Array(size * (size - 1));
}

export function newBlockedV(size: number): Uint8Array {
  return new Uint8Array((size - 1) * size);
}

/**
 * True when a pawn may not step from `from` to the adjacent cell `to`.
 * Callers must have already checked that the two cells are orthogonal
 * neighbours and both on the board.
 */
export function edgeBlocked(
  size: number,
  blockedH: Uint8Array,
  blockedV: Uint8Array,
  from: Cell,
  to: Cell,
): boolean {
  if (from.x === to.x) {
    const y = Math.min(from.y, to.y);
    return blockedH[hEdgeIndex(size, from.x, y)] === 1;
  }
  const x = Math.min(from.x, to.x);
  return blockedV[vEdgeIndex(size, x, from.y)] === 1;
}

/** Write a wall's two blocked edges into the given lookup tables. */
export function stampWall(
  size: number,
  blockedH: Uint8Array,
  blockedV: Uint8Array,
  wall: Wall,
  value: 0 | 1,
): void {
  if (wall.o === 'h') {
    blockedH[hEdgeIndex(size, wall.x, wall.y)] = value;
    blockedH[hEdgeIndex(size, wall.x + 1, wall.y)] = value;
  } else {
    blockedV[vEdgeIndex(size, wall.x, wall.y)] = value;
    blockedV[vEdgeIndex(size, wall.x, wall.y + 1)] = value;
  }
}

/**
 * Two walls conflict when they would occupy the same slot (a cross) or share
 * one of their two half-segments (an overlap).
 */
export function wallsConflict(a: Wall, b: Wall): boolean {
  if (a.x === b.x && a.y === b.y) return true;
  if (a.o !== b.o) return false;
  if (a.o === 'h') return a.y === b.y && Math.abs(a.x - b.x) === 1;
  return a.x === b.x && Math.abs(a.y - b.y) === 1;
}

export function centerCell(size: number): Cell {
  const m = (size - 1) / 2;
  return { x: m, y: m };
}

/** Starting square for a seat: middle of that seat's own edge. */
export function startCell(variant: Variant, seat: number): Cell {
  const { size } = variant;
  const m = (size - 1) / 2;
  switch (seat) {
    case 0:
      return { x: m, y: 0 };
    case 1:
      return { x: m, y: size - 1 };
    case 2:
      return { x: 0, y: m };
    case 3:
      return { x: size - 1, y: m };
    default:
      throw new Error(`unsupported seat ${seat}`);
  }
}

/**
 * Every cell that ends the game for `seat`.
 *
 * Classic sends each player to the edge opposite their start; King of the Hill
 * sends everyone to the middle.
 */
export function goalCells(variant: Variant, seat: number): Cell[] {
  const { size } = variant;
  if (variant.goalMode === 'center') return [centerCell(size)];

  const out: Cell[] = [];
  switch (seat) {
    case 0:
      for (let x = 0; x < size; x++) out.push({ x, y: size - 1 });
      break;
    case 1:
      for (let x = 0; x < size; x++) out.push({ x, y: 0 });
      break;
    case 2:
      for (let y = 0; y < size; y++) out.push({ x: size - 1, y });
      break;
    case 3:
      for (let y = 0; y < size; y++) out.push({ x: 0, y });
      break;
    default:
      throw new Error(`unsupported seat ${seat}`);
  }
  return out;
}
