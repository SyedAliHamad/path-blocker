'use client';

import { useEffect, useRef, useState } from 'react';
import type { Cell } from '@pb/engine';
import { CELL, squareCentre } from './board-geometry';

export interface FighterOverlayProps {
  size: number;
  winner: number;
  loser: number;
  winnerCell: Cell;
  loserCell: Cell;
}

const ARMS_MS = 420;
const HOP_END = 1600;
const PUNCH_PERIOD = 320;
const PUNCH_END = 4400;

const ARM = CELL * 0.26;
const BODY = CELL * 0.3;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The winner grows arms, hops over and beats up the loser.
 *
 * It draws both pawns itself while it runs — the board hides them — because
 * the puncher and the punched have to move together, and splitting them across
 * two components animating on separate clocks would put them out of step.
 *
 * It lives inside the board's rotated group, so it shares the board's
 * coordinates and comes out the right way up on a flipped board.
 */
export function FighterOverlay({
  size,
  winner,
  loser,
  winnerCell,
  loserCell,
}: FighterOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced.current) {
      // Still show the pose, just never move it.
      setElapsed(ARMS_MS);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const tick = (now: number): void => {
      const since = now - started;
      setElapsed(since);
      // Stop once the last punch lands. The winner stays standing over the
      // loser, but nothing keeps re-rendering to hold a pose that is no
      // longer moving.
      if (since < PUNCH_END + 200) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const start = squareCentre(size, winnerCell.x, winnerCell.y);
  const target = squareCentre(size, loserCell.x, loserCell.y);

  // Stand just short of the loser rather than on top of them.
  const dx = target.cx - start.cx;
  const dy = target.cy - start.cy;
  const reach = Math.hypot(dx, dy) || 1;
  const ux = dx / reach;
  const uy = dy / reach;
  const standX = target.cx - ux * CELL * 0.95;
  const standY = target.cy - uy * CELL * 0.95;

  const armOut = clamp01(elapsed / ARMS_MS);
  const hop = clamp01((elapsed - ARMS_MS) / (HOP_END - ARMS_MS));

  // Three bounces on the way over, rather than one long glide.
  const arc = -Math.abs(Math.sin(hop * Math.PI * 3)) * CELL * 0.75 * (1 - hop * 0.3);
  const bodyX = start.cx + (standX - start.cx) * hop;
  const bodyY = start.cy + (standY - start.cy) * hop + (hop > 0 && hop < 1 ? arc : 0);

  const punching = elapsed > HOP_END && elapsed < PUNCH_END;
  const punchTime = elapsed - HOP_END;
  const punchIndex = Math.floor(punchTime / PUNCH_PERIOD);
  const punchPhase = (punchTime % PUNCH_PERIOD) / PUNCH_PERIOD;
  const thrust = punching ? Math.sin(punchPhase * Math.PI) : 0;

  // The second half of a thrust is the half that lands.
  const impact = thrust > 0.55 ? (thrust - 0.55) / 0.45 : 0;
  const shake = impact > 0 ? Math.sin(elapsed / 14) * 2.2 : 0;
  const loserX = target.cx + ux * impact * CELL * 0.22 - uy * shake;
  const loserY = target.cy + uy * impact * CELL * 0.22 + ux * shake;

  const armLength = ARM * armOut + thrust * CELL * 0.55;
  const perpX = -uy;
  const perpY = ux;
  const lead = punchIndex % 2 === 0 ? 1 : -1;

  // Resting arms sit out to the sides; the punching arm drives at the target.
  const jabX = bodyX + ux * armLength + perpX * lead * BODY * 0.5;
  const jabY = bodyY + uy * armLength + perpY * lead * BODY * 0.5;
  const idleX = bodyX - ux * ARM * armOut * 0.3 - perpX * lead * (BODY + ARM * armOut);
  const idleY = bodyY - uy * ARM * armOut * 0.3 - perpY * lead * (BODY + ARM * armOut);

  const winnerColour = `var(--color-seat-${winner})`;
  const loserColour = `var(--color-seat-${loser})`;

  return (
    <g aria-hidden>
      {/* The loser, flinching. */}
      <circle cx={loserX} cy={loserY} r={BODY} fill={loserColour} opacity={0.9} />

      {impact > 0 ? (
        <g stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round" opacity={impact}>
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * Math.PI * 2 + punchIndex;
            const inner = BODY * 1.1;
            const outer = inner + CELL * 0.3 * impact;
            return (
              <line
                key={i}
                x1={loserX + Math.cos(angle) * inner}
                y1={loserY + Math.sin(angle) * inner}
                x2={loserX + Math.cos(angle) * outer}
                y2={loserY + Math.sin(angle) * outer}
              />
            );
          })}
        </g>
      ) : null}

      {/* The winner, with arms. */}
      {armOut > 0 ? (
        <g stroke={winnerColour} strokeWidth={5} strokeLinecap="round">
          <line x1={bodyX} y1={bodyY} x2={jabX} y2={jabY} />
          <line x1={bodyX} y1={bodyY} x2={idleX} y2={idleY} />
        </g>
      ) : null}

      <circle cx={jabX} cy={jabY} r={BODY * 0.42 * armOut} fill={winnerColour} />
      <circle cx={idleX} cy={idleY} r={BODY * 0.42 * armOut} fill={winnerColour} />
      <circle
        cx={bodyX}
        cy={bodyY}
        r={BODY}
        fill={winnerColour}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={1.5}
      />
    </g>
  );
}
