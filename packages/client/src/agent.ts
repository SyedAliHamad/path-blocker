import type { GameSnapshot } from '@pb/protocol';

/**
 * Something that plays a seat on its own: the built-in bot today, possibly a
 * remote engine later.
 *
 * It receives a snapshot rather than a `GameState` so an agent can live behind
 * a worker or a network boundary without changing this contract.
 */
export interface Agent {
  readonly name: string;
  chooseMove(snapshot: GameSnapshot, signal: AbortSignal): Promise<string>;
}
