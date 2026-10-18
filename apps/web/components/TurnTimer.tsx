'use client';

import { useEffect, useState } from 'react';
import { remainingFor, type ClockConfig, type ClockState } from '@pb/protocol';

export interface TurnTimerProps {
  clock: ClockState | null;
  config: ClockConfig | null;
  /** The seat this timer belongs to. */
  seat: number;
  /** True only while this seat is the one on the clock. */
  active: boolean;
}

/**
 * One player's move timer.
 *
 * Only the player on the clock sees a bar; the other side shows an empty
 * track of the same height. Reserving the space matters — if the row appeared
 * and vanished, both cards would change height every turn and shunt the board
 * up and down the page.
 *
 * It owns its own animation frame so that only this component re-renders
 * sixty times a second. The board beside it is a few hundred SVG nodes and
 * has no reason to redraw while a clock ticks.
 */
export function TurnTimer({ clock, config, seat, active }: TurnTimerProps) {
  // Null until the browser takes over. The server has no business guessing a
  // clock reading: it would differ from the client's by however long the
  // response took, and React will not patch that mismatch. Both sides render
  // the unextrapolated time, then rAF takes over.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const tick = (): void => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const limit = config?.perMoveMs ?? null;
  if (!clock || limit === null) return null;

  const left = now === null ? (clock.remainingMs[seat] ?? limit) : remainingFor(clock, seat, now);
  const fraction = Math.max(0, Math.min(1, left / limit));
  const low = active && left <= 3000;

  // The row is a fixed height rather than one that follows its content: the
  // idle side renders an empty label, and an empty inline box is shorter than
  // one holding "5.1s", which would leave the two cards different heights.
  return (
    <div className="mt-2 flex h-4 items-center gap-2">
      <div
        className={`h-1.5 flex-1 overflow-hidden rounded-full ${active ? 'bg-edge/60' : ''}`}
        {...(active
          ? { role: 'timer', 'aria-label': `${(left / 1000).toFixed(0)} seconds left this move` }
          : { 'aria-hidden': true })}
      >
        {active ? (
          <div
            className="h-full rounded-full"
            style={{ width: `${fraction * 100}%`, background: `var(--color-seat-${seat})` }}
          />
        ) : null}
      </div>
      <span
        className={`w-9 text-right font-mono text-[11px] tabular-nums ${
          low ? 'text-accent' : 'text-ink-faint'
        }`}
      >
        {active ? `${(left / 1000).toFixed(1)}s` : ''}
      </span>
    </div>
  );
}
