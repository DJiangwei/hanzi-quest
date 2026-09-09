/**
 * Server-only: home/furniture placement DB queries.
 * Uses @/db (postgres) — never import in client bundles.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { homePlacements, shopItems, shopPurchases } from '@/db/schema';
import {
  getFurniture,
  HOME_FURNITURE_COPY_CAP,
} from '@/lib/home/furniture-catalog';
import { getRoom } from '@/lib/home/rooms';
import { canPlaceAt } from '@/lib/home/placement-rules';
import {
  FurnitureNotOwnedError,
  CellOccupiedError,
  InvalidPlacementError,
} from '@/lib/errors/home-errors';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface HomePlacement {
  room: string;
  slug: string;
  /** Which owned copy this is (0..HOME_FURNITURE_COPY_CAP-1). */
  copyIndex: number;
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
        copyIndex: homePlacements.copyIndex,
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
  copyIndex = 0,
): Promise<void> {
  // 1. Validate furniture exists + the copy index is sane
  const def = getFurniture(slug);
  if (!def) {
    throw new InvalidPlacementError(`Unknown furniture slug: "${slug}"`);
  }
  if (
    !Number.isInteger(copyIndex) ||
    copyIndex < 0 ||
    copyIndex >= HOME_FURNITURE_COPY_CAP
  ) {
    throw new InvalidPlacementError(
      `copyIndex ${copyIndex} out of range 0..${HOME_FURNITURE_COPY_CAP - 1}`,
    );
  }

  // 2. Validate child owns copy #copyIndex (placing copy k needs ≥ k+1 owned)
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
  if (ownedCount <= copyIndex) {
    throw new FurnitureNotOwnedError(slug);
  }

  // 3. Validate room exists
  const roomDef = getRoom(room);
  if (!roomDef) {
    throw new InvalidPlacementError(`Unknown room: "${room}"`);
  }

  // 4-6. Bounds, surface zone and collision — shared verbatim with the 3D room
  // so the two can never disagree about which cells are legal.
  const existing = await tx
    .select({
      slug: homePlacements.furnitureSlug,
      copyIndex: homePlacements.copyIndex,
      gridX: homePlacements.gridX,
      gridY: homePlacements.gridY,
    })
    .from(homePlacements)
    .where(and(eq(homePlacements.childId, childId), eq(homePlacements.room, room)));

  const verdict = canPlaceAt(room, slug, x, y, existing, copyIndex);
  if (!verdict.ok) {
    if (verdict.reason === 'occupied') {
      throw new CellOccupiedError(room, verdict.cell!.x, verdict.cell!.y);
    }
    throw new InvalidPlacementError(
      `Cannot place "${slug}" at (${x},${y}) in "${room}": ${verdict.reason}`,
    );
  }

  // 7. Upsert on (childId, furnitureSlug, copyIndex) unique key
  await tx
    .insert(homePlacements)
    .values({
      childId,
      room,
      furnitureSlug: slug,
      copyIndex,
      gridX: x,
      gridY: y,
    })
    .onConflictDoUpdate({
      target: [
        homePlacements.childId,
        homePlacements.furnitureSlug,
        homePlacements.copyIndex,
      ],
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
  copyIndex = 0,
): Promise<void> {
  await tx
    .delete(homePlacements)
    .where(
      and(
        eq(homePlacements.childId, childId),
        eq(homePlacements.furnitureSlug, slug),
        eq(homePlacements.copyIndex, copyIndex),
      ),
    );
}
