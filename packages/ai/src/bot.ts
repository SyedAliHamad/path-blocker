import { decodePosition, moveToString, type GameState } from '@pb/engine';
import { stateFromSnapshot, type GameSnapshot } from '@pb/protocol';
import { levelById, type Level } from './levels';
import { bestMove } from './search';

/** Matches `@pb/client`'s Agent without importing it, keeping the dependency one-way. */
export interface BotAgent {
  readonly name: string;
  chooseMove(snapshot: GameSnapshot, signal: AbortSignal): Promise<string>;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The computer opponent.
 *
 * The deliberate pause is for the human: an instant reply reads as a glitch,
 * and the strong levels need the time anyway. Search runs on the main thread
 * for now; moving it into a worker means changing this file alone, because
 * everything upstream only awaits a promise.
 */
export function createBotAgent(levelId: number): BotAgent {
  const level: Level = levelById(levelId);

  return {
    name: `Computer (${level.name})`,

    async chooseMove(snapshot: GameSnapshot, signal: AbortSignal): Promise<string> {
      const started = Date.now();
      const state: GameState = stateFromSnapshot(snapshot);
      const move = bestMove(state, level);

      const elapsed = Date.now() - started;
      if (elapsed < level.thinkMs) await wait(level.thinkMs - elapsed, signal);
      if (signal.aborted) throw new Error('aborted');

      return moveToString(move);
    },
  };
}

/**
 * Best move for an encoded position, for puzzle tooling and tests.
 *
 * Takes the position directly rather than a snapshot: a puzzle is a board, not
 * a game with a move history behind it.
 */
export function analysePosition(position: string, levelId = 4): string {
  return moveToString(bestMove(decodePosition(position), levelById(levelId)));
}
