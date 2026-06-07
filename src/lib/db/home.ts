/**
 * Server-only: home/furniture placement DB queries.
 * Uses @/db (postgres) — never import in client bundles.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { homePlacements, shopItems, shopPurchases } from '@/db/schema';
import { getFurniture, type Surface } from '@/lib/home/furniture-catalog';
import { getRoom } from '@/lib/home/rooms';
import { cellsForFootprint, cellKey } from '@/lib/home/grid';
import { cellZone } from '@/lib/home/rooms';
import {
  FurnitureNotOwnedError,
  CellOccupiedError,
  InvalidPlacementError,
} from '@/lib/errors/home-errors';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface HomePlacement {
  room: string;
  slug: string;
  x: number;
  y: number;
}

export interface HomeState {
  ownedSlugs: string[];
  placements: HomePlacement[];
}

/**
 * Returns the furniture slugs owned by the child (via shop_purchases + shop_items WHERE kind='home').
 */
export async function getOwnedFurnitureSlugs(childId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: shopItems.slug })
    .from(shopPurchases)
    .innerJoin(shopItems, eq(shopItems.id, shopPurchases.shopItemId))
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopItems.kind, 'home'),
      ),
    );
  return rows.map((r) => r.slug);
}

/**
 * Returns the full home state for a child: owned slugs + current placements.
 */
export async function getHomeState(childId: string): Promise<HomeState> {
  const [ownedSlugs, placementRows] = await Promise.all([
    getOwnedFurnitureSlugs(childId),
    db
      .select({
        room: homePlacements.room,
        slug: homePlacements.furnitureSlug,
        x: homePlacements.gridX,
        y: homePlacements.gridY,
      })
      .from(homePlacements)
      .where(eq(homePlacements.childId, childId)),
  ]);
  return { ownedSlugs, placements: placementRows };
}

/**
 * Validates and upserts a furniture placement in a transaction.
 *
 * Throws:
 * - FurnitureNotOwnedError  — slug not in child's owned furniture
 * - InvalidPlacementError   — room unknown, out-of-bounds, or wrong surface zone
 * - CellOccupiedError       — footprint cell is occupied by a DIFFERENT item
 */
export async function placeFurnitureInTx(
  tx: Tx,
  childId: string,
  room: string,
  slug: string,
  x: number,
  y: number,
): Promise<void> {
  // 1. Validate furniture exists
  const def = getFurniture(slug);
  if (!def) {
    throw new InvalidPlacementError(`Unknown furniture slug: "${slug}"`);
  }

  // 2. Validate child owns it
  const owned = await tx
    .select({ count: sql<number>`count(*)` })
    .from(shopPurchases)
    .innerJoin(shopItems, eq(shopItems.id, shopPurchases.shopItemId))
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopItems.slug, slug),
        eq(shopItems.kind, 'home'),
      ),
    );
  const ownedCount = Number(owned[0]?.count ?? 0);
  if (ownedCount === 0) {
    throw new FurnitureNotOwnedError(slug);
  }

  // 3. Validate room exists
  const roomDef = getRoom(room);
  if (!roomDef) {
    throw new InvalidPlacementError(`Unknown room: "${room}"`);
  }

  // 4. Validate in-bounds
  const fp = def.footprint;
  if (x < 0 || y < 0 || x + fp.w > roomDef.cols || y + fp.h > roomDef.rows) {
    throw new InvalidPlacementError(
      `Footprint at (${x},${y}) with size ${fp.w}×${fp.h} is out of bounds for room "${room}" (${roomDef.cols}×${roomDef.rows})`,
    );
  }

  // 5. Validate surface zone: every cell in the footprint must match item's surface
  const cells = cellsForFootprint(x, y, fp);
  for (const cell of cells) {
    const zone = cellZone(roomDef, cell.x, cell.y) as Surface;
    if (zone !== def.surface) {
      throw new InvalidPlacementError(
        `Cell (${cell.x},${cell.y}) is in zone "${zone}" but item "${slug}" requires surface "${def.surface}"`,
      );
    }
  }

  // 6. Collision check: no OTHER placement occupies any footprint cell
  const existingPlacements = await tx
    .select({
      slug: homePlacements.furnitureSlug,
      x: homePlacements.gridX,
      y: homePlacements.gridY,
    })
    .from(homePlacements)
    .where(
      and(
        eq(homePlacements.childId, childId),
        eq(homePlacements.room, room),
      ),
    );

  // Build occupied cell set from OTHER items (skip the item being moved)
  const occupiedByOther = new Set<string>();
  for (const p of existingPlacements) {
    if (p.slug === slug) continue; // this item is being moved — skip
    const otherDef = getFurniture(p.slug);
    if (!otherDef) continue;
    const otherCells = cellsForFootprint(p.x, p.y, otherDef.footprint);
    for (const c of otherCells) {
      occupiedByOther.add(cellKey(c.x, c.y));
    }
  }

  for (const cell of cells) {
    if (occupiedByOther.has(cellKey(cell.x, cell.y))) {
      throw new CellOccupiedError(room, cell.x, cell.y);
    }
  }

  // 7. Upsert on (childId, furnitureSlug) unique key
  await tx
    .insert(homePlacements)
    .values({
      childId,
      room,
      furnitureSlug: slug,
      gridX: x,
      gridY: y,
    })
    .onConflictDoUpdate({
      target: [homePlacements.childId, homePlacements.furnitureSlug],
      set: {
        room,
        gridX: x,
        gridY: y,
        updatedAt: sql`now()`,
      },
    });
}

/**
 * Removes a furniture placement from the DB.
 */
export async function removeFurnitureInTx(
  tx: Tx,
  childId: string,
  slug: string,
): Promise<void> {
  await tx
    .delete(homePlacements)
    .where(
      and(
        eq(homePlacements.childId, childId),
        eq(homePlacements.furnitureSlug, slug),
      ),
    );
}
