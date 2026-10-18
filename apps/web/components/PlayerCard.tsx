'use client';

import type { ClockConfig, ClockState, PlayerInfo } from '@pb/protocol';
import { TurnTimer } from './TurnTimer';

export interface PlayerCardProps {
  player: PlayerInfo | null;
  seat: number;
  wallsLeft: number;
  wallsTotal: number;
  toMove: boolean;
  outcome: 'won' | 'lost' | 'drew' | null;
  clock: ClockState | null;
  clockConfig: ClockConfig | null;
}

/**
 * One player's side of the board: who they are, how many walls they have left,
 * and their move timer.
 *
 * These sit directly above and below the board rather than off in the sidebar,
 * so the thing you check mid-move — your own wall stock and clock — is next to
 * the squares you are looking at.
 */
export function PlayerCard({
  player,
  seat,
  wallsLeft,
  wallsTotal,
  toMove,
  outcome,
  clock,
  clockConfig,
}: PlayerCardProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors ${
        toMove ? 'border-accent/40 bg-accent-soft/40' : 'border-edge bg-panel'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: `var(--color-seat-${seat})` }}
        />
        <span className="truncate text-sm font-medium">{player?.name ?? `Player ${seat + 1}`}</span>

        <span className="ml-auto flex items-center gap-2">
          {/* Wall stock as pips: how many you have left is a glance, not a sum. */}
          <span className="flex gap-[3px]" aria-hidden>
            {Array.from({ length: wallsTotal }, (_, i) => (
              <span
                key={i}
                className="h-3 w-[3px] rounded-full"
                style={{
                  background: i < wallsLeft ? `var(--color-seat-${seat})` : 'var(--color-edge)',
                }}
              />
            ))}
          </span>
          <span className="text-xs whitespace-nowrap text-ink-faint">
            {wallsLeft}/{wallsTotal} walls
          </span>
        </span>
      </div>

      <TurnTimer clock={clock} config={clockConfig} seat={seat} active={toMove} />

      {outcome ? (
        <p className="mt-1 text-xs font-medium text-ink-dim capitalize">{outcome}</p>
      ) : null}
    </div>
  );
}
