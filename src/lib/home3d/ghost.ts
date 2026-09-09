import { cellsForFootprint } from '@/lib/home/grid';

/** Green when the cell accepts the piece, red when it does not. */
export function ghostTint(legal: boolean): string {
  return legal ? '#4ade80' : '#f87171';
}

/** Which cells the footprint highlights. */
export function ghostTiles(gridX: number, gridY: number, w: number, h: number) {
  return cellsForFootprint(gridX, gridY, { w, h });
}
