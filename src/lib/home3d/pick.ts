/** Floor-plane hit-testing for the 3D room. PURE — no React, no three, no drei. */
import { worldToCell, WALL_ROWS } from '@/lib/home3d/coords';

/**
 * A floor-plane hit point → the cell a w×h footprint anchored there occupies,
 * clamped so a drag past the edge rests against it rather than vanishing.
 * The floor starts at WALL_ROWS, so gridY's lower bound is WALL_ROWS, not 0.
 * This prevents tall pieces (e.g. 2×2 yard-swing) from anchoring in the wall zone.
 */
export function pickCell(
  point: { x: number; z: number },
  w: number, h: number,
  cols: number, rows: number,
) {
  const { gridX, gridY } = worldToCell(point.x, point.z, w, h);
  return {
    gridX: Math.min(Math.max(gridX, 0), cols - w),
    gridY: Math.min(Math.max(gridY, WALL_ROWS), rows - h),
  };
}
