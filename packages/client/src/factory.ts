import { anonymousPlayer, botPlayer, type ClockConfig, type GameClient } from '@pb/protocol';
import type { Agent } from './agent';
import { LocalGameClient } from './local-client';
import { SocketGameClient } from './socket-client';

/**
 * How a game was started.
 *
 * Adding online play means adding a case here and an implementation beside
 * `LocalGameClient`; no page or component changes, because they all consume
 * the `GameClient` interface.
 */
export type GameDescriptor =
  | {
      readonly mode: 'hotseat';
      readonly variantId?: string;
      readonly clockConfig?: ClockConfig | null;
    }
  | {
      readonly mode: 'bot';
      readonly variantId?: string;
      readonly level: number;
      /** Display name for the bot; falls back to the level number. */
      readonly levelName?: string;
      /** Seat the human takes. */
      readonly playerSeat?: number;
      readonly clockConfig?: ClockConfig | null;
    }
  | {
      readonly mode: 'online';
      readonly gameId: string;
      readonly url: string;
      readonly playerId: string;
      readonly name?: string;
    };

export interface ClientDeps {
  /** Supplied by the app so the AI bundle only loads for bot games. */
  createAgent?: (level: number) => Agent;
}

export function createGameClient(descriptor: GameDescriptor, deps: ClientDeps = {}): GameClient {
  switch (descriptor.mode) {
    case 'hotseat': {
      const variantId = descriptor.variantId ?? 'classic';
      const seats = variantId === 'koth' ? [0, 1, 2, 3] : [0, 1];
      return new LocalGameClient({
        variantId,
        seats,
        players: seats.map((seat) => anonymousPlayer(seat)),
        clockConfig: descriptor.clockConfig ?? null,
      });
    }

    case 'bot': {
      if (!deps.createAgent) throw new Error('bot games need a createAgent dependency');

      const playerSeat = descriptor.playerSeat ?? 0;
      const botSeat = playerSeat === 0 ? 1 : 0;
      const players = [];
      players[playerSeat] = anonymousPlayer(playerSeat);
      players[botSeat] = botPlayer(descriptor.level, descriptor.levelName);

      return new LocalGameClient({
        variantId: descriptor.variantId ?? 'classic',
        seats: [playerSeat],
        players,
        agents: { [botSeat]: deps.createAgent(descriptor.level) },
        clockConfig: descriptor.clockConfig ?? null,
      });
    }

    case 'online':
      return new SocketGameClient({
        url: descriptor.url,
        gameId: descriptor.gameId,
        playerId: descriptor.playerId,
        ...(descriptor.name === undefined ? {} : { name: descriptor.name }),
      });

    default:
      throw new Error('unknown game mode');
  }
}
