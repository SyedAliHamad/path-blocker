import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  applyMove,
  createGame,
  distanceToGoal,
  isLegalMove,
  parseMove,
  replay,
  type GameState,
} from '@pb/engine';
import { LEVELS, bestMove, levelById, rankMoves, wallCandidates } from '../src/index';

/** Deterministic generator so a failing test can be reproduced exactly. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const midgame = (): GameState =>
  replay(CLASSIC, ['e2', 'e8', 'e3', 'e7', 'e5h', 'd7', 'd3', 'b5h'].map(parseMove));

describe('move selection', () => {
  it('returns a legal move at every level, from several positions', () => {
    const positions = [createGame(CLASSIC), midgame()];
    for (const level of LEVELS) {
      for (const state of positions) {
        const move = bestMove(state, level, seeded(level.id));
        expect(isLegalMove(state, state.turn, move).ok).toBe(true);
      }
    }
  });

  it('walks towards goal when there is nothing to gain from a wall', () => {
    const move = bestMove(createGame(CLASSIC), levelById(3), () => 0.99);
    expect(move.kind).toBe('pawn');
    if (move.kind === 'pawn') expect(move.to.y).toBe(1);
  });

  it('takes the win when one is available', () => {
    const state = replay(CLASSIC, ['e2', 'e8', 'e3', 'e7'].map(parseMove));
    const nearGoal: GameState = { ...state, pawns: [{ x: 4, y: 7 }, state.pawns[1]!] };
    const move = bestMove(nearGoal, levelById(3), () => 0.99);
    expect(move).toEqual({ kind: 'pawn', to: { x: 4, y: 8 } });
  });

  it('ranks moves best-first', () => {
    const ranked = rankMoves(midgame(), levelById(2));
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score);
    }
  });
});

describe('wall candidates', () => {
  it('only proposes walls that actually cost the opponent distance', () => {
    const state = midgame();
    const seat = state.turn;
    const opponent = seat === 0 ? 1 : 0;
    const before = distanceToGoal(state, opponent);

    const candidates = wallCandidates(state, seat, levelById(4));
    expect(candidates.length).toBeGreaterThan(0);

    for (const wall of candidates) {
      const applied = applyMove(state, { kind: 'wall', wall });
      expect(applied.ok).toBe(true);
      if (applied.ok) {
        expect(distanceToGoal(applied.state, opponent)).toBeGreaterThan(before);
      }
    }
  });

  it('stops spending walls once the easy bot is clearly ahead', () => {
    const state = replay(CLASSIC, ['e2', 'e8', 'e3', 'e7'].map(parseMove));
    const wayAhead: GameState = { ...state, pawns: [{ x: 4, y: 6 }, state.pawns[1]!] };
    expect(wallCandidates(wayAhead, 0, levelById(1))).toEqual([]);
  });
});

describe('self-play', () => {
  const playOut = (levels: [number, number], seed: number): GameState => {
    let state = createGame(CLASSIC);
    const random = seeded(seed);

    while (!state.result && state.ply < 300) {
      const level = levelById(levels[state.turn === 0 ? 0 : 1]);
      const applied = applyMove(state, bestMove(state, level, random));
      if (!applied.ok) throw new Error(`bot produced an illegal move: ${applied.reason}`);
      state = applied.state;
    }
    return state;
  };

  it('plays a full legal game to a decisive finish', () => {
    const state = playOut([2, 2], 7);
    expect(state.result).not.toBeNull();
    expect(state.result?.reason).toBe('goal');
  });

  it('gives the stronger level the better of it from both seats', () => {
    const asFirst = playOut([3, 1], 11);
    const asSecond = playOut([1, 3], 11);
    expect(asFirst.result?.winner).toBe(0);
    expect(asSecond.result?.winner).toBe(1);
  });
});
