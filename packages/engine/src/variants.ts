import type { Variant } from './types';

/**
 * Build a rule set, validating the combinations the engine relies on.
 *
 * Variants are the extension point for new game modes: board size, wall budget
 * and goal shape are all data, so a twist on the rules is a new object here
 * rather than a branch inside the engine.
 */
export function createVariant(input: {
  id: string;
  name: string;
  size: number;
  playerCount: number;
  wallsPerPlayer: number;
  goalMode?: Variant['goalMode'];
  suddenDeathPly?: number | null;
  maxPlies?: number | null;
}): Variant {
  const {
    id,
    name,
    size,
    playerCount,
    wallsPerPlayer,
    goalMode = 'opposite-side',
    suddenDeathPly = null,
    maxPlies = null,
  } = input;

  if (size < 5) throw new Error('board size must be at least 5');
  if (size % 2 === 0) throw new Error('board size must be odd so there is a middle cell');
  if (playerCount !== 2 && playerCount !== 4) throw new Error('player count must be 2 or 4');
  if (wallsPerPlayer < 0) throw new Error('wall budget cannot be negative');
  if (goalMode === 'center' && playerCount !== 4) {
    // Nothing in the engine forbids it, but a 2-player race to the middle is a
    // different game; flag it rather than silently allowing a half-tested mode.
    throw new Error('center goal is only defined for 4 players');
  }

  return {
    id,
    name,
    size,
    playerCount,
    wallsPerPlayer,
    goalMode,
    suddenDeathPly,
    maxPlies,
  };
}

/** The 2-player game: 9x9, 10 walls each, race to the far side. */
export const CLASSIC: Variant = createVariant({
  id: 'classic',
  name: 'Classic',
  size: 9,
  playerCount: 2,
  wallsPerPlayer: 10,
});

/** Casual 4-player mode: 11x11, 7 walls each, race to the middle. */
export const KING_OF_THE_HILL: Variant = createVariant({
  id: 'koth',
  name: 'King of the Hill',
  size: 11,
  playerCount: 4,
  wallsPerPlayer: 7,
  goalMode: 'center',
  suddenDeathPly: 320,
  maxPlies: 400,
});

/** Faster 2-player game on a tighter board. */
export const DUEL: Variant = createVariant({
  id: 'duel',
  name: 'Duel',
  size: 7,
  playerCount: 2,
  wallsPerPlayer: 7,
});

export const VARIANTS: Readonly<Record<string, Variant>> = {
  [CLASSIC.id]: CLASSIC,
  [KING_OF_THE_HILL.id]: KING_OF_THE_HILL,
  [DUEL.id]: DUEL,
};

export function variantById(id: string): Variant {
  const found = VARIANTS[id];
  if (!found) throw new Error(`unknown variant: ${id}`);
  return found;
}
