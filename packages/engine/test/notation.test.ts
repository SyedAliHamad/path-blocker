import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  cellToString,
  createGame,
  decodePosition,
  encodePosition,
  moveToString,
  parseCell,
  parseMove,
  parseWall,
  replay,
  wallToString,
} from '../src/index';

describe('cell and wall notation', () => {
  it('names the bottom-left corner a1', () => {
    expect(cellToString({ x: 0, y: 0 })).toBe('a1');
    expect(cellToString({ x: 8, y: 8 })).toBe('i9');
  });

  it('round-trips cells', () => {
    for (const text of ['a1', 'e5', 'i9', 'c7']) {
      expect(cellToString(parseCell(text))).toBe(text);
    }
  });

  it('round-trips walls with their orientation suffix', () => {
    for (const text of ['a1h', 'e3v', 'h8h']) {
      expect(wallToString(parseWall(text))).toBe(text);
    }
  });

  it('tells a wall from a pawn move by its suffix', () => {
    expect(parseMove('e5')).toEqual({ kind: 'pawn', to: { x: 4, y: 4 } });
    expect(parseMove('e5h')).toEqual({ kind: 'wall', wall: { x: 4, y: 4, o: 'h' } });
  });

  it('rejects malformed input', () => {
    expect(() => parseCell('5e')).toThrow();
    expect(() => parseWall('e5x')).toThrow();
  });

  it('round-trips every kind of move', () => {
    for (const text of ['e2', 'e5h', 'd3', 'a1v']) {
      expect(moveToString(parseMove(text))).toBe(text);
    }
  });
});

describe('position encoding', () => {
  it('encodes the opening position', () => {
    expect(encodePosition(createGame(CLASSIC))).toBe('classic|e1,e9|-|10,10|0|0');
  });

  it('round-trips a position with walls', () => {
    const state = replay(CLASSIC, ['e2', 'e8', 'e5h', 'c3v'].map(parseMove));
    const text = encodePosition(state);
    const decoded = decodePosition(text);

    expect(encodePosition(decoded)).toBe(text);
    expect(decoded.pawns).toEqual(state.pawns);
    expect(decoded.wallsLeft).toEqual(state.wallsLeft);
    expect([...decoded.blockedH]).toEqual([...state.blockedH]);
    expect([...decoded.blockedV]).toEqual([...state.blockedV]);
  });

  it('rejects a position whose fields do not match the variant', () => {
    expect(() => decodePosition('classic|e1|-|10,10|0|0')).toThrow(/2 pawns/);
    expect(() => decodePosition('classic|e1,e9|-|10,10|0')).toThrow(/6 fields/);
    expect(() => decodePosition('nope|e1,e9|-|10,10|0|0')).toThrow(/unknown variant/);
  });
});

describe('wall ownership', () => {
  it('records who placed each wall', () => {
    const state = replay(CLASSIC, ['e5h', 'c3v', 'g5h'].map(parseMove));
    expect(state.wallOwners).toEqual([0, 1, 0]);
    expect(state.wallsLeft).toEqual([8, 9]);
  });

  it('carries the owner through the encoded position', () => {
    const state = replay(CLASSIC, ['e5h', 'c3v'].map(parseMove));
    const text = encodePosition(state);

    expect(text).toContain('e5h:0');
    expect(text).toContain('c3v:1');
    expect(decodePosition(text).wallOwners).toEqual([0, 1]);
  });

  it('marks a wall with no recorded owner as unknown rather than guessing', () => {
    // Hand-written positions and puzzle files need not say who played what.
    const state = decodePosition('classic|e1,e9|e5h,c3v:1|9,9|0|2');
    expect(state.wallOwners).toEqual([-1, 1]);
  });
});
