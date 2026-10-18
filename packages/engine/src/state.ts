import {
  cellIndex,
  newBlockedH,
  newBlockedV,
  stampWall,
  startCell,
} from './board';
import { isLegalMove, pawnTargets } from './moves';
import { goalMask, shortestDistance } from './path';
import type {
  Cell,
  GameEndReason,
  GameResult,
  GameState,
  IllegalReason,
  Move,
  Variant,
  Wall,
} from './types';

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: IllegalReason };

export function createGame(variant: Variant): GameState {
  const pawns: Cell[] = [];
  const wallsLeft: number[] = [];
  const eliminated: boolean[] = [];

  for (let seat = 0; seat < variant.playerCount; seat++) {
    pawns.push(startCell(variant, seat));
    wallsLeft.push(variant.wallsPerPlayer);
    eliminated.push(false);
  }

  return {
    variant,
    pawns,
    wallsLeft,
    walls: [],
    wallOwners: [],
    eliminated,
    turn: 0,
    ply: 0,
    result: null,
    blockedH: newBlockedH(variant.size),
    blockedV: newBlockedV(variant.size),
  };
}

/** The next seat still in the game, wrapping around. */
function nextSeat(state: GameState, from: number): number {
  const count = state.variant.playerCount;
  for (let step = 1; step <= count; step++) {
    const seat = (from + step) % count;
    if (!state.eliminated[seat]) return seat;
  }
  return from;
}

function activeSeats(state: GameState): number[] {
  const out: number[] = [];
  for (let seat = 0; seat < state.variant.playerCount; seat++) {
    if (!state.eliminated[seat]) out.push(seat);
  }
  return out;
}

function onGoal(variant: Variant, seat: number, cell: Cell): boolean {
  return goalMask(variant, seat)[cellIndex(variant.size, cell)] === 1;
}

/**
 * Decide a game that ran out of plies: whoever is closest to their goal wins,
 * and an exact tie is a draw.
 */
function resolvePlyLimit(state: GameState): GameResult {
  let best = Number.POSITIVE_INFINITY;
  let winner: number | null = null;
  let tied = false;

  for (const seat of activeSeats(state)) {
    const d = shortestDistance(
      state.variant,
      state.blockedH,
      state.blockedV,
      state.pawns[seat]!,
      seat,
    );
    if (d < 0) continue;
    if (d < best) {
      best = d;
      winner = seat;
      tied = false;
    } else if (d === best) {
      tied = true;
    }
  }

  return { winner: tied ? null : winner, reason: 'ply-limit' };
}

/**
 * Play `move` for the side to move.
 *
 * Returns a new state; the input is never mutated, so callers can keep history
 * by holding on to previous states.
 */
export function applyMove(state: GameState, move: Move): ApplyResult {
  const seat = state.turn;
  const legality = isLegalMove(state, seat, move);
  if (!legality.ok) return { ok: false, reason: legality.reason };

  const pawns = state.pawns.slice();
  const wallsLeft = state.wallsLeft.slice();
  let walls: readonly Wall[] = state.walls;
  let wallOwners: readonly number[] = state.wallOwners;
  let blockedH = state.blockedH;
  let blockedV = state.blockedV;

  if (move.kind === 'pawn') {
    pawns[seat] = move.to;
  } else {
    walls = [...state.walls, move.wall];
    wallOwners = [...state.wallOwners, seat];
    wallsLeft[seat] = (wallsLeft[seat] ?? 0) - 1;
    blockedH = Uint8Array.from(state.blockedH);
    blockedV = Uint8Array.from(state.blockedV);
    stampWall(state.variant.size, blockedH, blockedV, move.wall, 1);
  }

  const ply = state.ply + 1;
  const next: GameState = {
    ...state,
    pawns,
    wallsLeft,
    walls,
    wallOwners,
    blockedH,
    blockedV,
    ply,
    turn: nextSeat(state, seat),
    result: null,
  };

  if (move.kind === 'pawn' && onGoal(state.variant, seat, move.to)) {
    return { ok: true, state: { ...next, result: { winner: seat, reason: 'goal' } } };
  }

  const cap = state.variant.maxPlies;
  if (cap !== null && ply >= cap) {
    return { ok: true, state: { ...next, result: resolvePlyLimit(next) } };
  }

  return { ok: true, state: next };
}

/**
 * Replay a whole move list onto a fresh game. The server stores games as move
 * lists, so this is how a position is rebuilt for review, spectating or
 * reconnection.
 */
export function replay(variant: Variant, moves: readonly Move[]): GameState {
  let state = createGame(variant);
  for (const [i, move] of moves.entries()) {
    const applied = applyMove(state, move);
    if (!applied.ok) throw new Error(`illegal move at ply ${i}: ${applied.reason}`);
    state = applied.state;
  }
  return state;
}

/** End a game for an out-of-band reason: resignation, timeout, disconnect. */
export function endGame(
  state: GameState,
  winner: number | null,
  reason: GameEndReason,
): GameState {
  if (state.result) return state;
  return { ...state, result: { winner, reason } };
}

/**
 * Remove a seat from a 4-player game (two consecutive timeouts).
 *
 * When only one player is left standing, they win outright.
 */
export function eliminate(state: GameState, seat: number): GameState {
  if (state.result || state.eliminated[seat]) return state;

  const eliminated = state.eliminated.slice();
  eliminated[seat] = true;
  const withSeatOut: GameState = { ...state, eliminated };

  const remaining = activeSeats(withSeatOut);
  if (remaining.length === 1) {
    return { ...withSeatOut, result: { winner: remaining[0]!, reason: 'elimination' } };
  }

  const turn = state.turn === seat ? nextSeat(withSeatOut, seat) : state.turn;
  return { ...withSeatOut, turn };
}

/**
 * The step a timed-out player takes automatically: one square along their own
 * shortest route to goal. Returns `null` when no such step exists.
 */
export function autoStep(state: GameState, seat: number): Move | null {
  const from = state.pawns[seat];
  if (!from) return null;

  const base = shortestDistance(state.variant, state.blockedH, state.blockedV, from, seat);
  if (base < 0) return null;

  // Try each legal destination and keep the one that shortens the route.
  const targets = pawnTargets(state, seat);
  let best: Move | null = null;
  let bestDistance = base;

  for (const to of targets) {
    const d = shortestDistance(state.variant, state.blockedH, state.blockedV, to, seat);
    if (d >= 0 && d < bestDistance) {
      bestDistance = d;
      best = { kind: 'pawn', to };
    }
  }

  return best ?? (targets[0] ? { kind: 'pawn', to: targets[0] } : null);
}
