/** Floor-plane hit-testing for the 3D room. PURE — no React, no three, no drei. */
import { worldToCell } from '@/lib/home3d/coords';

/**
 * A floor-plane hit point → the cell a w×h footprint anchored there occupies,
 * clamped so a drag past the edge rests against it rather than vanishing.
 */
export function pickCell(
  point: { x: number; z: number },
  w: number, h: number,
  cols: number, rows: number,
) {
  const { gridX, gridY } = worldToCell(point.x, point.z, w, h);
  return {
    gridX: Math.min(Math.max(gridX, 0), cols - w),
    gridY: Math.min(Math.max(gridY, 0), rows - h),
  };
}
