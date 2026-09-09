/** Grid ↔ world mapping for the 3D room. PURE — no three, no React. */

export const COLS = 8;
export const ROWS = 6;
export const WALL_ROWS = 2;
export const FLOOR_ROWS = ROWS - WALL_ROWS;

/** Grid cell → world centre of a w×h footprint anchored at (gridX, gridY). */
export function cellToWorld(gridX: number, gridY: number, w: number, h: number) {
  const x = gridX + w / 2 - COLS / 2;
  const zRow = gridY - WALL_ROWS;
  const z = zRow + h / 2 - FLOOR_ROWS / 2;
  return { x, z };
}

/**
 * World point → the grid cell a w×h footprint anchored there occupies.
 * Exact inverse of `cellToWorld`; a round-trip test pins every floor cell.
 */
export function worldToCell(x: number, z: number, w: number, h: number) {
  const gridX = Math.round(x - w / 2 + COLS / 2);
  const zRow = z - h / 2 + FLOOR_ROWS / 2;
  const gridY = Math.round(zRow + WALL_ROWS);
  return { gridX, gridY };
}
