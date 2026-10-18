import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  KING_OF_THE_HILL,
  centerCell,
  createVariant,
  goalCells,
  startCell,
  wallsConflict,
} from '../src/index';
import type { Wall } from '../src/index';

describe('board geometry', () => {
  it('starts each classic pawn in the middle of its own back row', () => {
    expect(startCell(CLASSIC, 0)).toEqual({ x: 4, y: 0 });
    expect(startCell(CLASSIC, 1)).toEqual({ x: 4, y: 8 });
  });

  it('gives each classic player the whole opposite edge as a goal', () => {
    const goals = goalCells(CLASSIC, 0);
    expect(goals).toHaveLength(9);
    expect(goals.every((c) => c.y === 8)).toBe(true);
  });

  it('sends every king-of-the-hill player to the one centre cell', () => {
    for (let seat = 0; seat < 4; seat++) {
      expect(goalCells(KING_OF_THE_HILL, seat)).toEqual([centerCell(11)]);
    }
  });
});

describe('wall conflicts', () => {
  const h: Wall = { x: 4, y: 4, o: 'h' };

  it('rejects a second wall in the same slot, either orientation', () => {
    expect(wallsConflict(h, { x: 4, y: 4, o: 'h' })).toBe(true);
    expect(wallsConflict(h, { x: 4, y: 4, o: 'v' })).toBe(true);
  });

  it('rejects a collinear neighbour that would overlap half a segment', () => {
    expect(wallsConflict(h, { x: 3, y: 4, o: 'h' })).toBe(true);
    expect(wallsConflict(h, { x: 5, y: 4, o: 'h' })).toBe(true);
  });

  it('allows walls that only touch end to end or sit clear', () => {
    expect(wallsConflict(h, { x: 6, y: 4, o: 'h' })).toBe(false);
    expect(wallsConflict(h, { x: 4, y: 5, o: 'h' })).toBe(false);
    expect(wallsConflict(h, { x: 5, y: 5, o: 'v' })).toBe(false);
  });
});

describe('variant validation', () => {
  it('insists on an odd board so there is a true middle file', () => {
    expect(() =>
      createVariant({ id: 'x', name: 'X', size: 8, playerCount: 2, wallsPerPlayer: 10 }),
    ).toThrow(/odd/);
  });

  it('rejects unsupported player counts', () => {
    expect(() =>
      createVariant({ id: 'x', name: 'X', size: 9, playerCount: 3, wallsPerPlayer: 10 }),
    ).toThrow(/2 or 4/);
  });
});
