import type { GameCommand, GameEvent, GameSnapshot, SeatIndex } from './types';

/**
 * What travels over the socket.
 *
 * `GameCommand` and `GameEvent` say nothing about which game they belong to,
 * because a local client only ever has one. A connection can watch a room and
 * be told which seat it got, so those two facts need an envelope.
 */
export type ClientMessage =
  | {
      readonly type: 'join';
      readonly gameId: string;
      /**
       * Stable per-browser id. It is how a seat survives a refresh: the server
       * hands the same seat back to the same player rather than demoting them
       * to a spectator.
       */
      readonly playerId: string;
      readonly name?: string;
    }
  | { readonly type: 'command'; readonly command: GameCommand }
  | { readonly type: 'ping' };

export type ServerMessage =
  | {
      readonly type: 'joined';
      /** `null` means spectating: the room already had two players. */
      readonly seat: SeatIndex | null;
      readonly snapshot: GameSnapshot;
    }
  | { readonly type: 'event'; readonly event: GameEvent }
  | { readonly type: 'pong' };

/** Room codes are typed by humans, so they avoid characters that look alike. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function makeGameId(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidGameId(value: string): boolean {
  return /^[a-z0-9]{4,24}$/.test(value);
}
