import { distanceToGoal, type GameState, type Move } from '@pb/engine';
import { momentInfo } from './catalogue';
import type { Moment, MomentId } from './types';

export interface DetectInput {
  readonly before: GameState;
  readonly after: GameState;
  readonly move: Move;
  readonly mover: number;
  /** True when the clock played this move rather than the player. */
  readonly auto?: boolean;
}

function make(id: MomentId, actor: number, target: number | null, magnitude?: number): Moment {
  return {
    id,
    actor,
    target,
    scale: momentInfo(id).scale,
    magnitude: magnitude ?? null,
  };
}

/**
 * Work out what just happened, in terms worth reacting to.
 *
 * Pure, and derived entirely from two positions and the move between them, so
 * it runs identically on a player's machine, on a spectator's, and on a server
 * replaying a finished game.
 *
 * The distance-based scenarios need exactly one opponent to measure against,
 * so they are limited to the two-player game; four-player mode still gets the
 * wall, pawn and endgame moments.
 */
export function detectMoments(input: DetectInput): Moment[] {
  const { before, after, move, mover, auto } = input;
  const moments: Moment[] = [];

  const duel = before.variant.playerCount === 2;
  const opponent = duel ? (mover === 0 ? 1 : 0) : null;

  if (auto) moments.push(make('timed-out', mover, opponent));

  if (move.kind === 'wall') {
    if (before.walls.length === 0) moments.push(make('first-wall', mover, opponent));

    let claimed = false;

    if (opponent !== null) {
      const theirsBefore = distanceToGoal(before, opponent);
      const theirsAfter = distanceToGoal(after, opponent);
      const mineBefore = distanceToGoal(before, mover);
      const mineAfter = distanceToGoal(after, mover);

      const cost = theirsAfter - theirsBefore;
      const selfCost = mineAfter - mineBefore;

      claimed = true;
      if (selfCost > cost) {
        moments.push(make('wall-backfired', mover, opponent, selfCost));
      } else if (cost === 0) {
        moments.push(make('wall-wasted', mover, opponent, 0));
      } else if (cost >= 6) {
        moments.push(make('detour-brutal', mover, opponent, cost));
      } else if (cost >= 3) {
        moments.push(make('detour-big', mover, opponent, cost));
      } else {
        moments.push(make('detour-mild', mover, opponent, cost));
      }
    }

    if (!claimed) moments.push(make('wall-placed', mover, opponent));
    if ((after.wallsLeft[mover] ?? 0) === 0) moments.push(make('walls-exhausted', mover, opponent));
  } else {
    const from = before.pawns[mover];
    const to = after.pawns[mover];
    if (from && to) {
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);

      if (dx === 2 || dy === 2) moments.push(make('jump-over', mover, opponent));
      else if (dx === 1 && dy === 1) moments.push(make('diagonal-sidestep', mover, opponent));
    }

    if (opponent !== null) {
      const mine = after.pawns[mover];
      const theirs = after.pawns[opponent];
      if (mine && theirs && Math.abs(mine.x - theirs.x) + Math.abs(mine.y - theirs.y) === 1) {
        moments.push(make('standoff', mover, opponent));
      }
    }
  }

  if (opponent !== null && !after.result) {
    // Positive gap means the mover is closer to home than the opponent.
    const gapBefore = distanceToGoal(before, opponent) - distanceToGoal(before, mover);
    const gapAfter = distanceToGoal(after, opponent) - distanceToGoal(after, mover);
    const mineAfter = distanceToGoal(after, mover);
    const theirsAfter = distanceToGoal(after, opponent);

    if (gapBefore <= -5 && gapAfter >= 0) moments.push(make('comeback', mover, opponent, -gapBefore));
    else if (gapBefore < 0 && gapAfter > 0) moments.push(make('lead-change', mover, opponent, gapAfter));

    if (gapBefore < 6 && gapAfter >= 6) moments.push(make('runaway', mover, opponent, gapAfter));
    if (gapAfter === 0 && mineAfter <= 4 && theirsAfter <= 4) {
      moments.push(make('dead-heat', mover, opponent, 0));
    }
    if (mineAfter === 1) moments.push(make('one-square-away', mover, opponent, 1));
  }

  moments.push(...resultMoments(before, after));

  return moments;
}

/**
 * Moments that come from the game ending.
 *
 * Kept apart from `detectMoments` because a game can end without anybody
 * moving: a resignation or a flag fall produces a result and no move at all,
 * and those endings were silent while this lived inside the move path.
 *
 * Safe to call twice for the same ending — it reports nothing if `before`
 * already carried the result.
 */
export function resultMoments(before: GameState, after: GameState): Moment[] {
  const result = after.result;
  if (!result || before.result) return [];

  const duel = after.variant.playerCount === 2;

  if (result.reason === 'resign' && result.winner !== null) {
    // The seat that resigned is the one that did not win.
    const quitter = result.winner === 0 ? 1 : 0;
    return [make('resign', quitter, result.winner)];
  }

  if (result.winner !== null) {
    const loser = duel ? (result.winner === 0 ? 1 : 0) : null;
    return [make('game-won', result.winner, loser)];
  }

  return [];
}

/**
 * The moments from one move, most interesting first.
 *
 * Ordering by catalogue priority rather than by the order they were detected:
 * a wall that forces a six-square detour is also the first wall of the game
 * and also empties somebody's rack, and only one of those is worth a gif.
 */
export function orderedMoments(moments: readonly Moment[]): Moment[] {
  return [...moments].sort((a, b) => momentInfo(b.id).priority - momentInfo(a.id).priority);
}

/** The single moment worth showing, when several fired at once. */
export function primaryMoment(moments: readonly Moment[]): Moment | null {
  return orderedMoments(moments)[0] ?? null;
}

/** Which side of a moment a viewer holding `seats` is on. */
export function roleFor(moment: Moment, seats: readonly number[]): 'actor' | 'target' {
  // Hotseat holds both seats: the person at the keyboard is the one who just
  // moved, so they get the actor's reaction.
  if (seats.includes(moment.actor)) return 'actor';
  if (moment.target !== null && seats.includes(moment.target)) return 'target';
  return 'actor';
}
