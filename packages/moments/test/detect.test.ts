import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  applyMove,
  createGame,
  decodePosition,
  endGame,
  parseMove,
  replay,
  type GameState,
  type Move,
} from '@pb/engine';
import {
  detectMoments,
  emptyLibrary,
  orderedMoments,
  pickAsset,
  primaryMoment,
  resultMoments,
  roleFor,
} from '../src/index';
import type { MomentId } from '../src/index';

/** Play `text` and report what the reaction system makes of it. */
function momentsFrom(before: GameState, text: string, auto = false): MomentId[] {
  const move: Move = parseMove(text);
  const mover = before.turn;
  const applied = applyMove(before, move);
  if (!applied.ok) throw new Error(`illegal setup move: ${applied.reason}`);

  return detectMoments({ before, after: applied.state, move, mover, auto }).map((m) => m.id);
}

describe('wall moments', () => {
  it('calls the opening wall out as the first', () => {
    expect(momentsFrom(createGame(CLASSIC), 'e5h')).toContain('first-wall');
  });

  it('grades a detour by how many squares it actually costs', () => {
    // Nothing in the way: a wall across the e-file costs a step or two.
    const open = decodePosition('classic|e1,e9|-|10,10|0|0');
    expect(momentsFrom(open, 'e8h')).toContain('detour-mild');
  });

  it('notices a wall that cost the opponent nothing', () => {
    // A wall far from the opponent's route leaves their distance untouched.
    const state = decodePosition('classic|e1,e9|-|10,10|0|0');
    expect(momentsFrom(state, 'a2h')).toContain('wall-wasted');
  });

  it('notices a wall that hurt the player who placed it', () => {
    // a1h sits across seat 0's own corner while seat 1 runs down the e-file.
    const state = decodePosition('classic|a1,e9|-|10,10|0|0');
    expect(momentsFrom(state, 'a1h')).toContain('wall-backfired');
  });

  it('flags the last wall leaving the rack', () => {
    const state = decodePosition('classic|e1,e9|-|1,10|0|0');
    expect(momentsFrom(state, 'e5h')).toContain('walls-exhausted');
  });
});

describe('pawn moments', () => {
  it('spots a straight jump', () => {
    const state = decodePosition('classic|e4,e5|-|10,10|0|0');
    expect(momentsFrom(state, 'e6')).toContain('jump-over');
  });

  it('spots the diagonal sidestep', () => {
    // e5h blocks the square behind, so the only way past is round the side.
    const state = decodePosition('classic|e4,e5|e5h|10,10|0|0');
    expect(momentsFrom(state, 'f5')).toContain('diagonal-sidestep');
  });

  it('spots the pawns ending up nose to nose', () => {
    const state = decodePosition('classic|e3,e5|-|10,10|0|0');
    expect(momentsFrom(state, 'e4')).toContain('standoff');
  });

  it('says nothing special about an ordinary step', () => {
    const quiet = momentsFrom(createGame(CLASSIC), 'e2');
    expect(quiet).not.toContain('jump-over');
    expect(quiet).not.toContain('standoff');
  });
});

describe('race moments', () => {
  it('calls the moment a trailing player goes ahead', () => {
    // Seat 0 is a step behind and about to draw level, then ahead.
    const state = decodePosition('classic|e4,e5|-|10,10|0|0');
    expect(momentsFrom(state, 'e6')).toContain('lead-change');
  });

  it('calls a pawn that is one square from home', () => {
    const state = decodePosition('classic|e7,a1|-|10,10|0|0');
    expect(momentsFrom(state, 'e8')).toContain('one-square-away');
  });
});

describe('endgame moments', () => {
  it('reports a win with the winner as actor and the loser as target', () => {
    const before = decodePosition('classic|e8,a1|-|10,10|0|0');
    const applied = applyMove(before, parseMove('e9'));
    if (!applied.ok) throw new Error('setup failed');

    const [moment] = detectMoments({
      before,
      after: applied.state,
      move: parseMove('e9'),
      mover: 0,
    }).filter((m) => m.id === 'game-won');

    expect(moment).toBeDefined();
    expect(moment?.actor).toBe(0);
    expect(moment?.target).toBe(1);
  });

  it('blames the player who resigned, not the one who benefited', () => {
    const before = replay(CLASSIC, ['e2'].map(parseMove));
    const after = endGame(before, 0, 'resign');

    const moments = detectMoments({ before, after, move: parseMove('e2'), mover: 1 });
    const resign = moments.find((m) => m.id === 'resign');

    expect(resign?.actor).toBe(1);
    expect(resign?.target).toBe(0);
  });
});

describe('choosing what to show', () => {
  it('puts the sharper moment ahead of the generic one it arrived with', () => {
    // The opening wall is both the first of the game and a detour; only the
    // detour is worth reacting to, and detection finds the generic one first.
    const before = createGame(CLASSIC);
    const move = parseMove('e8h');
    const applied = applyMove(before, move);
    if (!applied.ok) throw new Error(applied.reason);

    const found = detectMoments({ before, after: applied.state, move, mover: 0 });
    expect(found.map((m) => m.id)).toContain('first-wall');
    expect(orderedMoments(found)[0]?.id).toBe('detour-mild');
  });

  it('prefers a full-screen moment over a corner one', () => {
    const moments = [
      { id: 'wall-placed' as const, actor: 0, target: 1, scale: 'corner' as const, magnitude: null },
      { id: 'comeback' as const, actor: 0, target: 1, scale: 'takeover' as const, magnitude: 5 },
    ];
    expect(primaryMoment(moments)?.id).toBe('comeback');
  });

  it('returns nothing when nothing happened', () => {
    expect(primaryMoment([])).toBeNull();
  });

  it('gives the mover the actor reaction and the other side the target one', () => {
    const moment = {
      id: 'detour-brutal' as const,
      actor: 0,
      target: 1,
      scale: 'takeover' as const,
      magnitude: 7,
    };
    expect(roleFor(moment, [0])).toBe('actor');
    expect(roleFor(moment, [1])).toBe('target');
    // Hotseat holds both seats; the person at the keyboard just moved.
    expect(roleFor(moment, [0, 1])).toBe('actor');
  });
});

describe('timeouts', () => {
  it('marks a move the clock played', () => {
    expect(momentsFrom(createGame(CLASSIC), 'e2', true)).toContain('timed-out');
  });
});

describe('picking media', () => {
  const library = (() => {
    const base = emptyLibrary();
    return {
      ...base,
      scenarios: {
        ...base.scenarios,
        'detour-big': {
          actor: [
            {
              id: 'c1',
              name: 'Taunts',
              enabled: true,
              weight: 1,
              assets: [
                { id: 'a1', label: 'one', gifUrl: null, soundUrl: 'one.mp3', weight: 1 },
                { id: 'a2', label: 'two', gifUrl: null, soundUrl: 'two.mp3', weight: 1 },
              ],
            },
          ],
          target: [],
        },
      },
    };
  })();

  it('never replays the clip a scenario just used', () => {
    // Hearing the same sound twice in a row is the thing that makes a
    // reaction system feel cheap, so it is skipped even when the dice say so.
    for (const roll of [0, 0.25, 0.5, 0.99]) {
      const picked = pickAsset(library, 'detour-big', 'actor', () => roll, 'a1');
      expect(picked?.id).toBe('a2');
    }
  });

  it('replays the only clip there is rather than going silent', () => {
    const single = {
      ...library,
      scenarios: {
        ...library.scenarios,
        'detour-big': {
          actor: [
            {
              id: 'c1',
              name: 'Taunts',
              enabled: true,
              weight: 1,
              assets: [
                { id: 'a1', label: 'one', gifUrl: null, soundUrl: 'one.mp3', weight: 1 },
              ],
            },
          ],
          target: [],
        },
      },
    };
    expect(pickAsset(single, 'detour-big', 'actor', () => 0.5, 'a1')?.id).toBe('a1');
  });

  it('skips categories that are switched off', () => {
    const off = {
      ...library,
      scenarios: {
        ...library.scenarios,
        'detour-big': {
          actor: library.scenarios['detour-big'].actor.map((c) => ({ ...c, enabled: false })),
          target: [],
        },
      },
    };
    expect(pickAsset(off, 'detour-big', 'actor', () => 0.5)).toBeNull();
  });
});

describe('endings without a move', () => {
  it('reports a resignation, which produces no move to detect from', () => {
    const before = replay(CLASSIC, ['e2'].map(parseMove));
    const after = endGame(before, 0, 'resign');

    const found = resultMoments(before, after);
    expect(found.map((m) => m.id)).toEqual(['resign']);
    expect(found[0]?.actor).toBe(1);
    expect(found[0]?.target).toBe(0);
  });

  it('reports a win on time the same way', () => {
    const before = replay(CLASSIC, ['e2'].map(parseMove));
    const after = endGame(before, 1, 'timeout');

    expect(resultMoments(before, after).map((m) => m.id)).toEqual(['game-won']);
  });

  it('stays quiet when the result was already known', () => {
    // The move path reports the ending; the game-over event that follows it
    // must not report the same thing again.
    const before = replay(CLASSIC, ['e2'].map(parseMove));
    const after = endGame(before, 0, 'resign');
    expect(resultMoments(after, after)).toEqual([]);
  });

  it('says nothing about a draw', () => {
    const before = replay(CLASSIC, ['e2'].map(parseMove));
    expect(resultMoments(before, endGame(before, null, 'agreement'))).toEqual([]);
  });
});
