import {
  encodePosition,
  parseMove,
  replay,
  variantById,
  type GameState,
} from '@pb/engine';
import type { ClockConfig, ClockState, GameSnapshot, PlayerInfo, SeatIndex } from './types';

/**
 * Rebuild the full game state from a snapshot.
 *
 * The snapshot carries the move list rather than a board dump, so the client
 * reconstructs the position with the same engine the server used. A desync
 * becomes an exception here instead of a silently wrong board.
 */
export function stateFromSnapshot(snapshot: GameSnapshot): GameState {
  const variant = variantById(snapshot.variantId);
  const state = replay(variant, snapshot.moves.map(parseMove));
  return snapshot.result ? { ...state, result: snapshot.result } : state;
}

export function snapshotFromState(
  state: GameState,
  meta: {
    gameId: string;
    moves: readonly string[];
    players: readonly (PlayerInfo | null)[];
    rated?: boolean;
    clockConfig?: ClockConfig | null;
    clock?: ClockState | null;
    status?: GameSnapshot['status'];
  },
): GameSnapshot {
  return {
    gameId: meta.gameId,
    variantId: state.variant.id,
    moves: [...meta.moves],
    position: encodePosition(state),
    players: meta.players,
    turn: state.turn,
    ply: state.ply,
    status: meta.status ?? (state.result ? 'finished' : 'active'),
    result: state.result,
    rated: meta.rated ?? false,
    clockConfig: meta.clockConfig ?? null,
    clock: meta.clock ?? null,
    eliminated: [...state.eliminated],
  };
}

export function anonymousPlayer(seat: SeatIndex): PlayerInfo {
  return {
    id: `local-${seat}`,
    name: seat === 0 ? 'Player 1' : `Player ${seat + 1}`,
    rating: null,
    country: null,
    isBot: false,
    botLevel: null,
  };
}

export function botPlayer(level: number, label?: string): PlayerInfo {
  return {
    id: `bot-${level}`,
    name: label ?? `Computer (level ${level})`,
    rating: null,
    country: null,
    isBot: true,
    botLevel: level,
  };
}
