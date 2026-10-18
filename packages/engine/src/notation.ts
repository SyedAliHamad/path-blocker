import { newBlockedH, newBlockedV, stampWall } from './board';
import type { Cell, GameState, Move, Orientation, Wall } from './types';
import { variantById } from './variants';

const FILES = 'abcdefghijklmnopqrstuvwxyz';

/** `{x:4, y:0}` -> `"e1"`. */
export function cellToString(c: Cell): string {
  const file = FILES[c.x];
  if (file === undefined) throw new Error(`file out of range: ${c.x}`);
  return `${file}${c.y + 1}`;
}

export function parseCell(text: string): Cell {
  const match = /^([a-z])(\d+)$/.exec(text.trim().toLowerCase());
  if (!match) throw new Error(`bad cell: ${text}`);
  return { x: FILES.indexOf(match[1]!), y: Number(match[2]) - 1 };
}

/** `{x:4, y:2, o:'h'}` -> `"e3h"`. The coordinates name the slot's lower-left corner. */
export function wallToString(w: Wall): string {
  return `${cellToString({ x: w.x, y: w.y })}${w.o}`;
}

export function parseWall(text: string): Wall {
  const match = /^([a-z])(\d+)([hv])$/.exec(text.trim().toLowerCase());
  if (!match) throw new Error(`bad wall: ${text}`);
  return {
    x: FILES.indexOf(match[1]!),
    y: Number(match[2]) - 1,
    o: match[3] as Orientation,
  };
}

export function moveToString(move: Move): string {
  return move.kind === 'pawn' ? cellToString(move.to) : wallToString(move.wall);
}

export function parseMove(text: string): Move {
  const trimmed = text.trim().toLowerCase();
  return /[hv]$/.test(trimmed)
    ? { kind: 'wall', wall: parseWall(trimmed) }
    : { kind: 'pawn', to: parseCell(trimmed) };
}

/**
 * Compact, human-readable position encoding — the project's answer to FEN.
 *
 * `variant|pawns|walls|wallsLeft|turn|ply`, with `-` for an empty wall list.
 * Each wall carries the seat that placed it (`e5h:0`), which the board uses to
 * colour it. Used for puzzles, bug reports and position sharing.
 */
export function encodePosition(state: GameState): string {
  const pawns = state.pawns.map(cellToString).join(',');
  const walls =
    state.walls.length > 0
      ? state.walls
          .map((wall, i) => {
            const owner = state.wallOwners[i] ?? -1;
            const text = wallToString(wall);
            return owner >= 0 ? text + ':' + owner : text;
          })
          .join(',')
      : '-';
  const left = state.wallsLeft.join(',');
  return [state.variant.id, pawns, walls, left, state.turn, state.ply].join('|');
}

export function decodePosition(text: string): GameState {
  const parts = text.trim().split('|');
  if (parts.length !== 6) throw new Error(`bad position: expected 6 fields, got ${parts.length}`);

  const [variantId, pawnText, wallText, leftText, turnText, plyText] = parts as [
    string, string, string, string, string, string,
  ];

  const variant = variantById(variantId);
  const pawns = pawnText.split(',').map(parseCell);
  if (pawns.length !== variant.playerCount) {
    throw new Error(`expected ${variant.playerCount} pawns, got ${pawns.length}`);
  }

  // The owner suffix is optional: a position written by hand, in a test or in a
  // puzzle file need not record who placed what. Those walls get -1, and the
  // board draws them in the neutral colour rather than guessing a player.
  const entries = wallText === '-' ? [] : wallText.split(',');
  const walls: Wall[] = [];
  const wallOwners: number[] = [];
  for (const entry of entries) {
    const [wallText_, ownerText] = entry.split(':') as [string, string | undefined];
    walls.push(parseWall(wallText_));
    wallOwners.push(ownerText === undefined ? -1 : Number(ownerText));
  }

  const wallsLeft = leftText.split(',').map(Number);
  if (wallsLeft.length !== variant.playerCount) {
    throw new Error(`expected ${variant.playerCount} wall counts, got ${wallsLeft.length}`);
  }

  const blockedH = newBlockedH(variant.size);
  const blockedV = newBlockedV(variant.size);
  for (const wall of walls) stampWall(variant.size, blockedH, blockedV, wall, 1);

  return {
    variant,
    pawns,
    wallsLeft,
    walls,
    wallOwners,
    eliminated: pawns.map(() => false),
    turn: Number(turnText),
    ply: Number(plyText),
    result: null,
    blockedH,
    blockedV,
  };
}
