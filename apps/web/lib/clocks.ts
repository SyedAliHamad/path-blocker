import type { ClockConfig } from '@pb/protocol';

/**
 * Ten seconds per move.
 *
 * A per-move timer, not a chess clock: time does not carry over, and running
 * out does not lose the game — the engine takes one step towards your goal for
 * you. It sets a pace without turning a moment's inattention into a loss.
 */
export const TEN_SECOND_TURNS: ClockConfig = {
  initialMs: 10_000,
  incrementMs: 0,
  perMoveMs: 10_000,
};
