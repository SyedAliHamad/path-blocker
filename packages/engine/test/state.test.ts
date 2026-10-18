import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  KING_OF_THE_HILL,
  applyMove,
  autoStep,
  createGame,
  createVariant,
  decodePosition,
  distanceToGoal,
  eliminate,
  endGame,
  isLegalMove,
  parseMove,
  replay,
} from '../src/index';
import type { GameState, Move } from '../src/index';

const play = (state: GameState, text: string): GameState => {
  const applied = applyMove(state, parseMove(text));
  if (!applied.ok) throw new Error(`unexpected rejection: ${applied.reason}`);
  return applied.state;
};

describe('turn order', () => {
  it('alternates seats and counts plies', () => {
    let state = createGame(CLASSIC);
    expect(state.turn).toBe(0);
    state = play(state, 'e2');
    expect(state.turn).toBe(1);
    expect(state.ply).toBe(1);
    state = play(state, 'e8');
    expect(state.turn).toBe(0);
    expect(state.ply).toBe(2);
  });

  it('leaves the input state untouched', () => {
    const before = createGame(CLASSIC);
    const after = play(before, 'e2');
    expect(before.pawns[0]).toEqual({ x: 4, y: 0 });
    expect(after.pawns[0]).toEqual({ x: 4, y: 1 });
    expect(before.ply).toBe(0);
  });

  it('spends a wall from the placing seat only', () => {
    const state = play(createGame(CLASSIC), 'e5h');
    expect(state.wallsLeft).toEqual([9, 10]);
    expect(state.walls).toHaveLength(1);
  });

  it('refuses a move claimed by the seat that is not on turn', () => {
    // The server validates with an explicit seat, so a client cannot move for
    // its opponent by sending a move out of turn.
    const state = decodePosition('classic|e1,e9|-|10,10|1|0');
    expect(isLegalMove(state, 0, parseMove('e2'))).toEqual({
      ok: false,
      reason: 'not-your-turn',
    });
    expect(isLegalMove(state, 1, parseMove('e8')).ok).toBe(true);
  });
});

describe('winning', () => {
  it('ends the game when a pawn reaches the far edge', () => {
    const state = play(decodePosition('classic|e8,a1|-|10,10|0|0'), 'e9');
    expect(state.result).toEqual({ winner: 0, reason: 'goal' });
  });

  it('ends the game when the second seat reaches rank 1', () => {
    const state = play(decodePosition('classic|a9,e2|-|10,10|1|0'), 'e1');
    expect(state.result).toEqual({ winner: 1, reason: 'goal' });
  });

  it('refuses any further move once decided', () => {
    const state = play(decodePosition('classic|e8,a1|-|10,10|0|0'), 'e9');
    expect(applyMove(state, parseMove('a2'))).toEqual({ ok: false, reason: 'game-over' });
  });

  it('records resignations without touching the position', () => {
    const state = endGame(createGame(CLASSIC), 1, 'resign');
    expect(state.result).toEqual({ winner: 1, reason: 'resign' });
    expect(state.pawns).toEqual(createGame(CLASSIC).pawns);
  });
});

describe('replay', () => {
  it('rebuilds a position from its move list', () => {
    const moves: Move[] = ['e2', 'e8', 'e5h', 'e7'].map(parseMove);
    const state = replay(CLASSIC, moves);
    expect(state.ply).toBe(4);
    expect(state.pawns[0]).toEqual({ x: 4, y: 1 });
    expect(state.walls).toHaveLength(1);
  });

  it('throws on a move list that contains an illegal move', () => {
    expect(() => replay(CLASSIC, [parseMove('e2'), parseMove('e2')])).toThrow(/ply 1/);
  });
});

describe('distance', () => {
  it('measures the open-board race as the full board height', () => {
    const state = createGame(CLASSIC);
    expect(distanceToGoal(state, 0)).toBe(8);
    expect(distanceToGoal(state, 1)).toBe(8);
  });

  it('grows when a wall forces a detour', () => {
    const state = decodePosition('classic|e1,e9|e1h,d1h|9,10|0|0');
    expect(distanceToGoal(state, 0)).toBeGreaterThan(8);
  });
});

describe('ply limit', () => {
  const shortGame = createVariant({
    id: 'short',
    name: 'Short',
    size: 9,
    playerCount: 2,
    wallsPerPlayer: 10,
    maxPlies: 2,
  });

  it('awards the win to whoever is closest to goal', () => {
    let state = createGame(shortGame);
    state = play(state, 'e2');
    state = play(state, 'e8h');
    expect(state.result?.reason).toBe('ply-limit');
    expect(state.result?.winner).toBe(0);
  });
});

describe('four-player rules', () => {
  it('seats everyone on their own edge facing the centre', () => {
    const state = createGame(KING_OF_THE_HILL);
    expect(state.pawns).toHaveLength(4);
    expect(state.wallsLeft).toEqual([7, 7, 7, 7]);
    expect(distanceToGoal(state, 0)).toBe(5);
  });

  it('skips eliminated seats in the turn order', () => {
    const state = eliminate(createGame(KING_OF_THE_HILL), 1);
    expect(play(state, 'f2').turn).toBe(2);
  });

  it('awards the game to the last player standing', () => {
    let state = createGame(KING_OF_THE_HILL);
    state = eliminate(state, 1);
    state = eliminate(state, 2);
    state = eliminate(state, 3);
    expect(state.result).toEqual({ winner: 0, reason: 'elimination' });
  });

  it('closes wall placement once sudden death begins', () => {
    const state = { ...createGame(KING_OF_THE_HILL), ply: 320 };
    expect(applyMove(state, parseMove('e5h'))).toEqual({
      ok: false,
      reason: 'walls-closed',
    });
  });
});

describe('auto step on timeout', () => {
  it('moves one square closer to goal', () => {
    const state = createGame(CLASSIC);
    expect(autoStep(state, 0)).toEqual({ kind: 'pawn', to: { x: 4, y: 1 } });
  });

  it('still returns a legal move when no step shortens the route', () => {
    const state = decodePosition('classic|e1,e9|e1h,d1h|9,10|0|0');
    const move = autoStep(state, 0);
    expect(move).not.toBeNull();
    expect(applyMove(state, move as Move).ok).toBe(true);
  });
});
