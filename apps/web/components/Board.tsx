'use client';

import { cellToString, wallToString, type Cell, type GameState, type Move, type Wall } from '@pb/engine';

import { CELL, GAP, PAD, boardExtent, fileX, rankY } from './board-geometry';
import { FighterOverlay } from './FighterOverlay';

export interface BoardProps {
  state: GameState;
  /** Squares the player may move to right now. */
  targets: readonly Cell[];
  /** Wall slots the player may fill right now. */
  walls: readonly Wall[];
  lastMove: Move | null;
  /** Seat at the bottom of the screen; seat 1 sees the board from its own side. */
  perspective: number;
  interactive: boolean;
  /** Set once somebody has won, which hands both pawns to the celebration. */
  celebration: { winner: number; loser: number } | null;
  /** Square to zoom in on while a big moment plays out. */
  focus: Cell | null;
  onPawnMove: (cell: Cell) => void;
  onWallPlace: (wall: Wall) => void;
}

const FILES = 'abcdefghijklmnopqrstuvwxyz';

/**
 * The board, drawn as SVG.
 *
 * SVG rather than canvas because every square, wall slot and pawn is then a
 * real element: hit areas, hover states and labels come for free, and the
 * board scales to any size without redrawing logic.
 */
export function Board({
  state,
  targets,
  walls,
  lastMove,
  perspective,
  interactive,
  celebration,
  focus,
  onPawnMove,
  onWallPlace,
}: BoardProps) {
  const { size } = state.variant;
  const extent = boardExtent(size);
  const flipped = perspective === 1;

  const px = fileX;
  const py = (y: number): number => rankY(size, y);

  const targetKeys = new Set(targets.map(cellToString));
  const lastWall = lastMove?.kind === 'wall' ? wallToString(lastMove.wall) : null;
  const lastCell = lastMove?.kind === 'pawn' ? cellToString(lastMove.to) : null;

  // Zooming by scaling the wrapper and moving the transform origin onto the
  // square, rather than animating the viewBox: this is a plain CSS transition
  // the browser can run on its own, so nothing re-renders while it moves.
  const focusPoint = focus
    ? {
        fx: (px(focus.x) + CELL / 2) / extent,
        fy: (py(focus.y) + CELL / 2) / extent,
      }
    : null;
  const origin = focusPoint
    ? flipped
      ? { x: (1 - focusPoint.fx) * 100, y: (1 - focusPoint.fy) * 100 }
      : { x: focusPoint.fx * 100, y: focusPoint.fy * 100 }
    : { x: 50, y: 50 };

  return (
    <div className="board w-full overflow-hidden rounded-lg">
      <div
        style={{
          transform: focus ? "scale(2.1)" : "scale(1)",
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transition: "transform 650ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
      <svg
        viewBox={`0 0 ${extent} ${extent}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Game board, ${size} by ${size}`}
      >
        {/* Rotating the whole board keeps every coordinate calculation in one
            orientation; only the rank and file labels are drawn separately. */}
        <g transform={flipped ? `rotate(180 ${extent / 2} ${extent / 2})` : undefined}>
          {Array.from({ length: size * size }, (_, i) => {
            const x = i % size;
            const y = Math.floor(i / size);
            const key = cellToString({ x, y });
            const isGoalFor0 = state.variant.goalMode === 'opposite-side' && y === size - 1;
            const isGoalFor1 = state.variant.goalMode === 'opposite-side' && y === 0;

            return (
              <rect
                key={key}
                x={px(x)}
                y={py(y)}
                width={CELL}
                height={CELL}
                rx={5}
                fill={
                  isGoalFor0
                    ? 'var(--color-cell-goal-0)'
                    : isGoalFor1
                      ? 'var(--color-cell-goal-1)'
                      : 'var(--color-cell)'
                }
              />
            );
          })}

          {lastCell
            ? (() => {
                const cell = (lastMove as { to: Cell }).to;
                return (
                  <rect
                    x={px(cell.x)}
                    y={py(cell.y)}
                    width={CELL}
                    height={CELL}
                    rx={5}
                    fill="var(--color-accent)"
                    opacity={0.14}
                  />
                );
              })()
            : null}

          {/* Placed walls, in the colour of whoever played them. The newest one
              keeps a pale outline so it is obvious what just changed. */}
          {state.walls.map((wall, i) => {
            const key = wallToString(wall);
            const horizontal = wall.o === "h";
            const owner = state.wallOwners[i] ?? -1;
            return (
              <rect
                key={key}
                x={horizontal ? px(wall.x) : px(wall.x) + CELL}
                y={horizontal ? py(wall.y) - GAP : py(wall.y + 1)}
                width={horizontal ? CELL * 2 + GAP : GAP}
                height={horizontal ? GAP : CELL * 2 + GAP}
                rx={3}
                fill={owner >= 0 ? `var(--color-seat-${owner})` : "var(--color-wall)"}
                stroke={key === lastWall ? "var(--color-ink)" : "none"}
                strokeWidth={key === lastWall ? 1.5 : 0}
              />
            );
          })}

          {interactive
            ? walls.map((wall) => {
                const horizontal = wall.o === 'h';
                return (
                  <rect
                    key={`slot-${wallToString(wall)}`}
                    data-interactive="true"
                    className="fill-transparent transition-colors hover:fill-[var(--color-wall-ghost)]"
                    x={horizontal ? px(wall.x) : px(wall.x) + CELL}
                    y={horizontal ? py(wall.y) - GAP : py(wall.y + 1)}
                    width={horizontal ? CELL * 2 + GAP : GAP}
                    height={horizontal ? GAP : CELL * 2 + GAP}
                    rx={3}
                    onClick={() => onWallPlace(wall)}
                  >
                    <title>{`Place wall ${wallToString(wall)}`}</title>
                  </rect>
                );
              })
            : null}

          {/* The celebration draws its own two pawns, so they are skipped here. */}
          {state.pawns.map((pawn, seat) =>
            state.eliminated[seat] ||
            celebration?.winner === seat ||
            celebration?.loser === seat ? null : (
              <circle
                key={`pawn-${seat}`}
                cx={px(pawn.x) + CELL / 2}
                cy={py(pawn.y) + CELL / 2}
                r={CELL * 0.3}
                fill={`var(--color-seat-${seat})`}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={1.5}
              >
                <title>{`Player ${seat + 1} on ${cellToString(pawn)}`}</title>
              </circle>
            ),
          )}

          {celebration ? (
            <FighterOverlay
              size={size}
              winner={celebration.winner}
              loser={celebration.loser}
              winnerCell={state.pawns[celebration.winner]!}
              loserCell={state.pawns[celebration.loser]!}
            />
          ) : null}

          {interactive
            ? targets.map((cell) => (
                <rect
                  key={`target-${cellToString(cell)}`}
                  data-interactive="true"
                  className="fill-transparent transition-colors hover:fill-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]"
                  x={px(cell.x)}
                  y={py(cell.y)}
                  width={CELL}
                  height={CELL}
                  rx={5}
                  onClick={() => onPawnMove(cell)}
                >
                  <title>{`Move to ${cellToString(cell)}`}</title>
                </rect>
              ))
            : null}

          {interactive
            ? targets.map((cell) => (
                <circle
                  key={`dot-${cellToString(cell)}`}
                  cx={px(cell.x) + CELL / 2}
                  cy={py(cell.y) + CELL / 2}
                  r={6}
                  fill="var(--color-accent)"
                  opacity={targetKeys.has(cellToString(cell)) ? 0.5 : 0}
                  pointerEvents="none"
                />
              ))
            : null}
        </g>

        {/* Labels stay upright whichever way the board is turned. */}
        {Array.from({ length: size }, (_, i) => {
          const file = flipped ? size - 1 - i : i;
          const rank = flipped ? size - 1 - i : i;
          return (
            <g key={`label-${i}`} fill="var(--color-ink-faint)" fontSize={10}>
              <text x={px(i) + CELL / 2} y={extent - 6} textAnchor="middle">
                {FILES[file]}
              </text>
              <text x={PAD - 8} y={py(i) + CELL / 2 + 3} textAnchor="end">
                {rank + 1}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
