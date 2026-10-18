import type { GameResult } from '@pb/engine';

/** Seat 0 is the first player; seats match `GameState.pawns` indices. */
export type SeatIndex = number;

/**
 * Who is sitting in a seat.
 *
 * Anonymous players get a generated id and no rating, which is why both
 * `rating` and `country` are nullable rather than absent.
 */
export interface PlayerInfo {
  readonly id: string;
  readonly name: string;
  readonly rating: number | null;
  readonly country: string | null;
  readonly isBot: boolean;
  /** 1-4 for bots, `null` for humans. */
  readonly botLevel: number | null;
}

export interface ClockConfig {
  readonly initialMs: number;
  readonly incrementMs: number;
  /**
   * When set, this is a per-move timer rather than a chess clock: the mover's
   * time resets to this at the start of every turn, and `initialMs` and
   * `incrementMs` stop mattering.
   */
  readonly perMoveMs: number | null;
}

/**
 * Clock readings at a known instant.
 *
 * `asOf` lets a client render a smooth countdown between server updates
 * without drifting: it extrapolates from this timestamp rather than counting
 * its own frames.
 */
export interface ClockState {
  readonly remainingMs: readonly number[];
  readonly runningSeat: SeatIndex | null;
  readonly asOf: number;
}

export type GameStatus = 'waiting' | 'active' | 'finished';

/**
 * Everything a client needs to render a game.
 *
 * Deliberately transport-shaped: this is exactly what a websocket server would
 * send, so the local and online clients emit identical payloads and the UI
 * cannot tell them apart.
 */
export interface GameSnapshot {
  readonly gameId: string;
  readonly variantId: string;
  /** Move list in engine notation; replaying it reproduces the position. */
  readonly moves: readonly string[];
  readonly position: string;
  readonly players: readonly (PlayerInfo | null)[];
  readonly turn: SeatIndex;
  readonly ply: number;
  readonly status: GameStatus;
  readonly result: GameResult | null;
  readonly rated: boolean;
  readonly clockConfig: ClockConfig | null;
  readonly clock: ClockState | null;
  /** Seats that have left the game (4-player timeouts). */
  readonly eliminated: readonly boolean[];
}

/** Client -> server. */
export type GameCommand =
  | { readonly type: 'move'; readonly move: string }
  | {
      readonly type: 'resign';
      /**
       * Who is resigning. Omitted locally, where it can only be whoever is on
       * turn; required online, or a player could resign on their opponent's
       * turn and the game would hand the win to the wrong person.
       */
      readonly seat?: SeatIndex;
    }
  | { readonly type: 'offer-draw' }
  | { readonly type: 'accept-draw' }
  | { readonly type: 'decline-draw' }
  | { readonly type: 'rematch' }
  | { readonly type: 'request-snapshot' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' };

export type GameErrorCode =
  | 'illegal-move'
  | 'not-your-seat'
  | 'game-over'
  | 'not-connected'
  | 'unsupported';

/** Server -> client. */
export type GameEvent =
  | { readonly type: 'snapshot'; readonly snapshot: GameSnapshot }
  | {
      readonly type: 'move';
      readonly snapshot: GameSnapshot;
      readonly move: string;
      readonly by: SeatIndex;
      /** True when the clock played this move rather than the player. */
      readonly auto?: boolean;
    }
  | { readonly type: 'game-over'; readonly snapshot: GameSnapshot }
  | { readonly type: 'clock'; readonly clock: ClockState }
  | { readonly type: 'draw-offer'; readonly from: SeatIndex }
  | {
      readonly type: 'error';
      readonly code: GameErrorCode;
      readonly message: string;
    };

export type Unsubscribe = () => void;

/**
 * The only interface the UI is allowed to talk to.
 *
 * Local hotseat, a bot game and an online game are three implementations of
 * this one contract, so adding online play later changes which object the page
 * constructs and nothing else.
 */
export interface GameClient {
  readonly gameId: string;
  /** Seats this client may act for. Empty means spectating. */
  readonly seats: readonly SeatIndex[];
  getSnapshot(): GameSnapshot;
  subscribe(listener: (event: GameEvent) => void): Unsubscribe;
  send(command: GameCommand): void;
  dispose(): void;
}
