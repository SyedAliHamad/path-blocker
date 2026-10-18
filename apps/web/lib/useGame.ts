'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stateFromSnapshot, type GameClient, type GameSnapshot } from '@pb/protocol';
import { parseMove, type GameState } from '@pb/engine';
import { detectMoments, resultMoments, type Moment } from '@pb/moments';

/** A batch of moments from one event, with a counter so repeats still fire. */
export interface MomentBurst {
  readonly seq: number;
  readonly items: readonly Moment[];
}

export interface UseGameResult {
  client: GameClient;
  snapshot: GameSnapshot;
  state: GameState;
  error: string | null;
  moments: MomentBurst;
  dismissError: () => void;
}

/**
 * Bind a React tree to a `GameClient`.
 *
 * The hook knows nothing about where the game runs. Swapping a local game for
 * an online one is a different `create` function and nothing else, which is
 * the whole point of the client interface.
 *
 * It also reads the moments out of each move — the position before and after
 * are both here, and that difference is what the reaction system runs on.
 */
export function useGame(create: () => GameClient): UseGameResult {
  // Lazy initialiser so the client is constructed once per mount, not on every
  // render. Callers remount with a React key when the game setup changes.
  const [client] = useState(create);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => client.getSnapshot());
  const [error, setError] = useState<string | null>(null);
  const [moments, setMoments] = useState<MomentBurst>({ seq: 0, items: [] });

  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = useRef<GameState | null>(null);
  const started = useRef(false);
  const sawResult = useRef(false);

  useEffect(() => {
    const fire = (items: Moment[]): void => {
      if (items.length > 0) setMoments((burst) => ({ seq: burst.seq + 1, items }));
    };

    const unsubscribe = client.subscribe((event) => {
      switch (event.type) {
        case 'snapshot': {
          const state = stateFromSnapshot(event.snapshot);

          // A fresh board is either the first game or a rematch. React may
          // subscribe twice in development, so the opening moment is guarded
          // by a flag rather than by the snapshot alone.
          if (state.ply === 0) {
            if (sawResult.current) {
              sawResult.current = false;
              fire([{ id: 'rematch', actor: 0, target: null, scale: 'corner', magnitude: null }]);
            } else if (!started.current) {
              fire([{ id: 'game-start', actor: 0, target: null, scale: 'corner', magnitude: null }]);
            }
            started.current = true;
          }

          previous.current = state;
          setSnapshot(event.snapshot);
          break;
        }

        case 'move': {
          const before = previous.current;
          const after = stateFromSnapshot(event.snapshot);

          if (before) {
            fire(
              detectMoments({
                before,
                after,
                move: parseMove(event.move),
                mover: event.by,
                auto: event.auto ?? false,
              }),
            );
          }

          previous.current = after;
          setSnapshot(event.snapshot);
          break;
        }

        case 'game-over': {
          // A game can end without a move — a resignation or a flag fall — and
          // those endings produce no move event to detect anything from. When
          // the result did come from a move it has already been reported, and
          // `resultMoments` returns nothing the second time.
          const ended = stateFromSnapshot(event.snapshot);
          const before = previous.current;
          if (before) fire(resultMoments(before, ended));

          sawResult.current = true;
          previous.current = ended;
          setSnapshot(event.snapshot);
          break;
        }

        case 'clock':
          setSnapshot((current) => ({ ...current, clock: event.clock }));
          break;

        case 'error':
          setError(event.message);
          // The engine's own word for "that wall would have sealed someone in".
          if (event.message === 'would-trap') {
            const turn = previous.current?.turn ?? 0;
            fire([
              { id: 'wall-illegal', actor: turn, target: null, scale: 'corner', magnitude: null },
            ]);
          }
          if (errorTimer.current) clearTimeout(errorTimer.current);
          errorTimer.current = setTimeout(() => setError(null), 2600);
          break;

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      if (errorTimer.current) clearTimeout(errorTimer.current);
      client.dispose();
    };
  }, [client]);

  // Rebuilding from the move list is cheap and keeps one source of truth: the
  // board always shows exactly what the authority says happened.
  const state = useMemo(() => stateFromSnapshot(snapshot), [snapshot]);

  const dismissError = useCallback(() => setError(null), []);

  return { client, snapshot, state, error, moments, dismissError };
}
