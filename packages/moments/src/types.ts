/**
 * The things that happen in a game worth reacting to.
 *
 * A moment is deliberately not the same as a move. Most moves deserve nothing;
 * a few deserve a horn. Every id here is something the engine can establish as
 * fact — "they added six squares to your route" is a subtraction, not a guess.
 */
export const MOMENT_IDS = [
  // Opening
  'game-start',
  'rematch',

  // Wall drama
  'first-wall',
  'wall-placed',
  'detour-mild',
  'detour-big',
  'detour-brutal',
  'wall-wasted',
  'wall-backfired',
  'wall-illegal',
  'walls-exhausted',

  // Race drama
  'lead-change',
  'comeback',
  'runaway',
  'dead-heat',
  'one-square-away',

  // Pawn moves
  'jump-over',
  'diagonal-sidestep',
  'standoff',

  // Clock
  'clock-low',
  'timed-out',

  // Endgame
  'game-won',
  'resign',
] as const;

export type MomentId = (typeof MOMENT_IDS)[number];

/**
 * How loudly to present a moment.
 *
 * `takeover` is rationed on purpose: if everything is a full-screen event then
 * nothing is, and you cannot see the board.
 */
export type MomentScale = 'corner' | 'takeover';

/** Which side of a moment a given player is on. */
export type MomentRole = 'actor' | 'target';

export interface Moment {
  readonly id: MomentId;
  /** The player who caused it — they get the smug reaction. */
  readonly actor: number;
  /** The player it happened to, when there is one. */
  readonly target: number | null;
  readonly scale: MomentScale;
  /**
   * Extra squares inflicted, for the detour moments. Carried so the admin
   * panel and the player can show "+7" alongside the reaction.
   */
  readonly magnitude: number | null;
}

/** Human-facing copy for the admin panel, kept beside the ids it describes. */
export interface MomentInfo {
  readonly id: MomentId;
  readonly name: string;
  readonly description: string;
  readonly group: string;
  readonly scale: MomentScale;
  /**
   * How interesting this moment is relative to the others that can fire on the
   * same move. "They blocked you" beats "a wall was placed"; the ordering has
   * to be explicit, because the detection code finds the generic ones first.
   */
  readonly priority: number;
  /** What the two roles mean for this moment, for the admin panel's labels. */
  readonly actorLabel: string;
  readonly targetLabel: string | null;
}
