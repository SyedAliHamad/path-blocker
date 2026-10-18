/**
 * Core value types for the Path Blocker rules engine.
 *
 * Everything here is plain data: no classes, no methods, no runtime deps.
 * The same structures travel over the wire, into storage and into the AI,
 * so they must stay JSON-representable.
 */

/** A square on the board. `x` is the file (0 = a), `y` is the rank (0 = rank 1). */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** Orientation of a wall: `h` spans two files, `v` spans two ranks. */
export type Orientation = 'h' | 'v';

/**
 * A wall sits on the lattice *between* cells, so its slot coordinates run
 * 0..size-2 in both axes.
 *
 * - `h` at (x, y) separates rank y from rank y+1, across files x and x+1.
 * - `v` at (x, y) separates file x from file x+1, across ranks y and y+1.
 */
export interface Wall {
  readonly x: number;
  readonly y: number;
  readonly o: Orientation;
}

/** Index of a player (seat) in `GameState.pawns`. */
export type PlayerIndex = number;

export type Move =
  | { readonly kind: 'pawn'; readonly to: Cell }
  | { readonly kind: 'wall'; readonly wall: Wall };

/** How a finished game ended. */
export type GameEndReason =
  | 'goal'
  | 'resign'
  | 'timeout'
  | 'abandon'
  | 'ply-limit'
  | 'elimination'
  | 'agreement';

export interface GameResult {
  /** Winning seat, or `null` for a draw. */
  readonly winner: PlayerIndex | null;
  readonly reason: GameEndReason;
}

/**
 * Where a player is trying to get to.
 *
 * - `opposite-side`: reach any cell on the far edge (Classic).
 * - `center`: reach the single middle cell (King of the Hill).
 */
export type GoalMode = 'opposite-side' | 'center';

/**
 * A rule set. Everything that can differ between game modes lives here, so a
 * new variant is a config object rather than a fork of the engine.
 */
export interface Variant {
  readonly id: string;
  readonly name: string;
  /** Cells per side. Must be odd so there is a true middle file. */
  readonly size: number;
  readonly playerCount: number;
  readonly wallsPerPlayer: number;
  readonly goalMode: GoalMode;
  /**
   * After this many plies no further walls may be placed (sudden death).
   * `null` disables sudden death.
   */
  readonly suddenDeathPly: number | null;
  /** Hard cap on plies; when hit, whoever is closest to goal wins. */
  readonly maxPlies: number | null;
}

/**
 * A complete, self-contained game position.
 *
 * `blockedH` / `blockedV` are derived from `walls` but kept alongside it: every
 * legality check and every BFS reads them, and recomputing per query would
 * dominate AI search time.
 */
export interface GameState {
  readonly variant: Variant;
  readonly pawns: readonly Cell[];
  readonly wallsLeft: readonly number[];
  readonly walls: readonly Wall[];
  /**
   * Who placed each wall, aligned with `walls`. A seat index, or `-1` when a
   * position was decoded from a string that did not record it.
   */
  readonly wallOwners: readonly number[];
  /** Seats that are out of the game (4-player timeouts). */
  readonly eliminated: readonly boolean[];
  readonly turn: PlayerIndex;
  readonly ply: number;
  readonly result: GameResult | null;
  /** `blockedH[y * size + x]` = 1 when (x,y)->(x,y+1) is walled off. */
  readonly blockedH: Uint8Array;
  /** `blockedV[y * (size - 1) + x]` = 1 when (x,y)->(x+1,y) is walled off. */
  readonly blockedV: Uint8Array;
}

/** Why a move was rejected. Surfaced to the UI and logged server-side. */
export type IllegalReason =
  | 'game-over'
  | 'not-your-turn'
  | 'off-board'
  | 'occupied'
  | 'blocked'
  | 'not-adjacent'
  | 'no-walls-left'
  | 'wall-overlap'
  | 'wall-out-of-bounds'
  | 'walls-closed'
  | 'would-trap';

export type Legality =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: IllegalReason };

export const LEGAL: Legality = { ok: true };

export function illegal(reason: IllegalReason): Legality {
  return { ok: false, reason };
}
