/**
 * Pure grid helpers for the home/furniture placement system.
 * Client-safe: NO @/db import.
 */

import type { RoomDef } from './rooms';
import { cellZone } from './rooms';
import type { Surface } from './furniture-catalog';

export interface CellCoord {
  x: number;
  y: number;
}

/**
 * Returns all grid cells occupied by a furniture item placed at (x, y)
 * with the given footprint.
 */
export function cellsForFootprint(
  x: number,
  y: number,
  fp: { w: number; h: number },
): CellCoord[] {
  const cells: CellCoord[] = [];
  for (let dx = 0; dx < fp.w; dx++) {
    for (let dy = 0; dy < fp.h; dy++) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

/**
 * Returns the set of valid top-left placement positions for an item with
 * `footprint` + `surface` in `room`, given the set of already-occupied cells.
 *
 * A position is valid when:
 * 1. The full footprint is in-bounds (0 ≤ x+w-1 < room.cols, 0 ≤ y+h-1 < room.rows).
 * 2. Every cell in the footprint matches the item's surface zone.
 * 3. None of the footprint cells are in `occupiedCells`.
 */
export function validCells(
  room: RoomDef,
  fp: { w: number; h: number },
  surface: Surface,
  occupiedCells: Set<string>,
): CellCoord[] {
  const valid: CellCoord[] = [];
  for (let x = 0; x <= room.cols - fp.w; x++) {
    for (let y = 0; y <= room.rows - fp.h; y++) {
      const cells = cellsForFootprint(x, y, fp);
      const allInZone = cells.every((c) => cellZone(room, c.x, c.y) === surface);
      if (!allInZone) continue;
      const noCollision = cells.every((c) => !occupiedCells.has(`${c.x},${c.y}`));
      if (noCollision) valid.push({ x, y });
    }
  }
  return valid;
}

/** Encode a cell as a string key for use in a Set/Map. */
export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
