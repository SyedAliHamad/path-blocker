import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  createGame,
  decodePosition,
  isLegalWall,
  legalMoves,
  legalWalls,
  moveToString,
  pawnTargets,
  parseWall,
} from '../src/index';
import type { GameState } from '../src/index';

const targetsOf = (position: string, seat = 0): string[] =>
  pawnTargets(decodePosition(position), seat)
    .map((c) => moveToString({ kind: 'pawn', to: c }))
    .sort();

describe('pawn movement', () => {
  it('offers the three open steps from the starting square', () => {
    expect(targetsOf('classic|e1,e9|-|10,10|0|0')).toEqual(['d1', 'e2', 'f1']);
  });

  it('offers every orthogonal step from open ground', () => {
    expect(targetsOf('classic|e5,a9|-|10,10|0|0')).toEqual(['d5', 'e4', 'e6', 'f5']);
  });

  it('will not step through a wall', () => {
    // e5h seals e5-e6 and f5-f6.
    expect(targetsOf('classic|e5,a9|e5h|10,10|0|0')).toEqual(['d5', 'e4', 'f5']);
  });

  it('will not step off the board', () => {
    expect(targetsOf('classic|a1,e9|-|10,10|0|0')).toEqual(['a2', 'b1']);
  });
});

describe('jumping', () => {
  it('jumps straight over an adjacent pawn', () => {
    expect(targetsOf('classic|e4,e5|-|10,10|0|0')).toEqual(['d4', 'e3', 'e6', 'f4']);
  });

  it('sidesteps diagonally when a wall sits behind the opponent', () => {
    // e5h blocks e5-e6, so the straight jump is unavailable.
    const targets = targetsOf('classic|e4,e5|e5h|10,10|0|0');
    expect(targets).toContain('d5');
    expect(targets).toContain('f5');
    expect(targets).not.toContain('e6');
  });

  it('sidesteps diagonally when the board edge sits behind the opponent', () => {
    const targets = targetsOf('classic|e8,e9|-|10,10|0|0');
    expect(targets).toContain('d9');
    expect(targets).toContain('f9');
    expect(targets).not.toContain('e10');
  });

  it('refuses a diagonal that is itself walled off', () => {
    // e5h blocks the straight jump; e5v blocks e5-f5, killing one diagonal.
    const targets = targetsOf('classic|e4,e5|e5h,d5v|10,10|0|0');
    expect(targets).not.toContain('e6');
    expect(targets).not.toContain('d5');
    expect(targets).toContain('f5');
  });
});

describe('wall placement', () => {
  const start = (): GameState => createGame(CLASSIC);

  it('allows every slot and orientation on an empty board', () => {
    expect(legalWalls(start())).toHaveLength(8 * 8 * 2);
  });

  it('counts 3 pawn moves plus 128 walls as the opening move set', () => {
    expect(legalMoves(start())).toHaveLength(3 + 128);
  });

  it('rejects a wall in an occupied slot', () => {
    const state = decodePosition('classic|e1,e9|e5h|9,10|0|0');
    expect(isLegalWall(state, 0, parseWall('e5h')).ok).toBe(false);
    expect(isLegalWall(state, 0, parseWall('e5v')).ok).toBe(false);
  });

  it('rejects a collinear wall that would overlap', () => {
    const state = decodePosition('classic|e1,e9|e5h|9,10|0|0');
    expect(isLegalWall(state, 0, parseWall('f5h'))).toEqual({
      ok: false,
      reason: 'wall-overlap',
    });
    expect(isLegalWall(state, 0, parseWall('d5h')).ok).toBe(false);
  });

  it('allows a crossing-free wall alongside an existing one', () => {
    const state = decodePosition('classic|e1,e9|e5h|9,10|0|0');
    expect(isLegalWall(state, 0, parseWall('g5h')).ok).toBe(true);
    expect(isLegalWall(state, 0, parseWall('e6h')).ok).toBe(true);
  });

  it('rejects slots past the interior lattice', () => {
    expect(isLegalWall(start(), 0, parseWall('i1h'))).toEqual({
      ok: false,
      reason: 'wall-out-of-bounds',
    });
  });

  it('rejects a wall once the budget is spent', () => {
    const state = decodePosition('classic|e1,e9|-|0,10|0|0');
    expect(isLegalWall(state, 0, parseWall('e5h'))).toEqual({
      ok: false,
      reason: 'no-walls-left',
    });
  });
});

describe('the no-trapping invariant', () => {
  it('rejects a wall that seals a player away from their goal', () => {
    // a1v already closes a1-b1 and a2-b2; a2h would close the pocket entirely.
    const state = decodePosition('classic|a1,e9|a1v|9,10|0|0');
    expect(isLegalWall(state, 0, parseWall('a2h'))).toEqual({
      ok: false,
      reason: 'would-trap',
    });
  });

  it('allows a wall that merely lengthens the route', () => {
    const state = decodePosition('classic|a1,e9|-|10,10|0|0');
    expect(isLegalWall(state, 0, parseWall('a1v')).ok).toBe(true);
    expect(isLegalWall(state, 0, parseWall('a2h')).ok).toBe(true);
  });

  it('checks the invariant for the opponent too, not just the mover', () => {
    // Seat 1 sits on a9 racing to rank 1. a8v already closes a9-b9 and a8-b8,
    // leaving an {a8, a9} pocket; a7h would shut its last exit.
    const state = decodePosition('classic|e5,a9|a8v|10,9|0|0');
    expect(isLegalWall(state, 0, parseWall('a7h'))).toEqual({
      ok: false,
      reason: 'would-trap',
    });
  });

  it('never leaves a legal-move list that strands anyone', () => {
    const state = decodePosition('classic|a1,e9|a1v|9,10|0|0');
    for (const wall of legalWalls(state)) {
      expect(isLegalWall(state, 0, wall).ok).toBe(true);
    }
  });
});
