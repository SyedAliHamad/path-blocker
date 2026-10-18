/**
 * Board measurements, shared by the board and anything drawn on top of it.
 *
 * The celebration animation has to land on the same squares the pawns are
 * standing on, so the arithmetic lives here rather than being duplicated and
 * drifting out of step.
 */
export const CELL = 46;
export const GAP = 10;
export const PAD = 20;
export const STEP = CELL + GAP;

export function boardExtent(size: number): number {
  return size * CELL + (size - 1) * GAP + PAD * 2;
}

/** Left edge of file `x`. */
export function fileX(x: number): number {
  return PAD + x * STEP;
}

/**
 * Top edge of rank `y`. Ranks count up the screen, so rank 0 sits at the
 * bottom and the arithmetic is inverted.
 */
export function rankY(size: number, y: number): number {
  return PAD + (size - 1 - y) * STEP;
}

/** Centre of a square, which is what anything round wants. */
export function squareCentre(size: number, x: number, y: number): { cx: number; cy: number } {
  return { cx: fileX(x) + CELL / 2, cy: rankY(size, y) + CELL / 2 };
}
