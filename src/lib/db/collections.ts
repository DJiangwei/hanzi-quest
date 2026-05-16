import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  childCollections,
  collectibleItems,
  collectionPacks,
} from '@/db/schema';

export type CollectionPack = typeof collectionPacks.$inferSelect;
export type CollectibleItem = typeof collectibleItems.$inferSelect;

export interface OwnedCollectibleItem extends CollectibleItem {
  count: number;
  firstObtainedAt: Date;
}

export async function getPackBySlug(
  slug: string,
): Promise<CollectionPack | null> {
  const [row] = await db
    .select()
    .from(collectionPacks)
    .where(eq(collectionPacks.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function listPackItems(packId: string): Promise<CollectibleItem[]> {
  return db
    .select()
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packId));
}

export async function listChildCollection(
  childId: string,
  packId: string,
): Promise<OwnedCollectibleItem[]> {
  const rows = await db
    .select({
      // childCollections fields
      itemId: childCollections.itemId,
      count: childCollections.count,
      firstObtainedAt: childCollections.firstObtainedAt,
      // collectibleItems fields
      id: collectibleItems.id,
      packId: collectibleItems.packId,
      slug: collectibleItems.slug,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh,
      loreEn: collectibleItems.loreEn,
      rarity: collectibleItems.rarity,
      dropWeight: collectibleItems.dropWeight,
      imageUrl: collectibleItems.imageUrl,
      createdAt: collectibleItems.createdAt,
    })
    .from(childCollections)
    .innerJoin(
      collectibleItems,
      eq(collectibleItems.id, childCollections.itemId),
    )
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(collectibleItems.packId, packId),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    packId: r.packId,
    slug: r.slug,
    nameZh: r.nameZh,
    nameEn: r.nameEn,
    loreZh: r.loreZh,
    loreEn: r.loreEn,
    rarity: r.rarity,
    dropWeight: r.dropWeight,
    imageUrl: r.imageUrl,
    createdAt: r.createdAt,
    count: r.count,
    firstObtainedAt: r.firstObtainedAt,
  }));
}
