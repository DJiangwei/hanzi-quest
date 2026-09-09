/**
 * The pure half of placement validation — PURE and client-safe (no `@/db`).
 *
 * `placeFurnitureInTx` and the 3D room's green/red cells BOTH call this, so the
 * UI can never advertise a cell the server then rejects. Same rule as the 🔒
 * islands: when a surface shows what an action will accept, the showing and the
 * accepting must come from one function.
 *
 * The server still calls it inside its transaction and still owns ownership and
 * copy-index checks — sharing this is about agreement, not about trust.
 */
import { getRoom, cellZone } from '@/lib/home/rooms';
import { cellsForFootprint, cellKey } from '@/lib/home/grid';
import { getFurniture } from '@/lib/home/furniture-catalog';

export interface PlacedLite {
  slug: string;
  copyIndex: number;
  gridX: number;
  gridY: number;
}

export type PlacementVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: 'unknown-room' | 'unknown-slug' | 'out-of-bounds' | 'wrong-surface' | 'occupied';
      cell?: { x: number; y: number };
    };

export function canPlaceAt(
  roomId: string,
  slug: string,
  x: number,
  y: number,
  placements: PlacedLite[],
  /** The copy being MOVED, which must not block itself. */
  ignoreCopyIndex?: number,
): PlacementVerdict {
  const def = getFurniture(slug);
  if (!def) return { ok: false, reason: 'unknown-slug' };
  const room = getRoom(roomId);
  if (!room) return { ok: false, reason: 'unknown-room' };

  const fp = def.footprint;
  if (x < 0 || y < 0 || x + fp.w > room.cols || y + fp.h > room.rows) {
    return { ok: false, reason: 'out-of-bounds' };
  }

  const cells = cellsForFootprint(x, y, fp);
  for (const c of cells) {
    if (cellZone(room, c.x, c.y) !== def.surface) {
      return { ok: false, reason: 'wrong-surface', cell: c };
    }
  }

  // Skip ONLY the copy being moved — a second copy of the same slug still blocks.
  const occupied = new Set<string>();
  for (const p of placements) {
    if (p.slug === slug && p.copyIndex === ignoreCopyIndex) continue;
    const other = getFurniture(p.slug);
    if (!other) continue;
    for (const c of cellsForFootprint(p.gridX, p.gridY, other.footprint)) {
      occupied.add(cellKey(c.x, c.y));
    }
  }
  for (const c of cells) {
    if (occupied.has(cellKey(c.x, c.y))) {
      return { ok: false, reason: 'occupied', cell: c };
    }
  }

  return { ok: true };
}
