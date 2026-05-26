import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  childCollections,
  collectibleItems,
  collectionPacks,
  childAvatarInventory,
  avatarItems,
  shopPurchases,
  shopItems,
} from '@/db/schema';

export type RecentItemKind = 'collection' | 'avatar' | 'pet' | 'decor';

export interface RecentItem {
  kind: RecentItemKind;
  obtainedAt: Date;
  displayEmoji: string;
  nameZh: string;
  nameEn: string;
  href: string;
}

export interface CollectionSourceRow {
  obtainedAt: Date;
  packSlug: string;
  imageUrl: string | null;
  nameZh: string;
  nameEn: string;
}

export interface AvatarSourceRow {
  obtainedAt: Date;
  slotId: string;
  name: string;
}

export interface ShopSourceRow {
  obtainedAt: Date;
  kind: 'pet' | 'decor';
  name: string;
  imageUrl: string | null;
}

function slotEmoji(slotId: string): string {
  switch (slotId) {
    case 'hat':
      return '🎩';
    case 'top':
      return '👕';
    case 'head':
      return '🧒';
    case 'background':
      return '🖼️';
    default:
      return '✨';
  }
}

function splitBilingual(name: string): { nameZh: string; nameEn: string } {
  const slash = name.indexOf(' / ');
  if (slash === -1) return { nameZh: name, nameEn: name };
  return {
    nameZh: name.slice(0, slash).replace(/^\p{Extended_Pictographic}\s*/u, '').trim(),
    nameEn: name.slice(slash + 3).trim(),
  };
}

export function mergeRecentItems(
  collection: readonly CollectionSourceRow[],
  avatar: readonly AvatarSourceRow[],
  purchases: readonly ShopSourceRow[],
  childId: string,
  limit: number,
): RecentItem[] {
  const merged: RecentItem[] = [
    ...collection.map((r) => ({
      kind: 'collection' as const,
      obtainedAt: r.obtainedAt,
      displayEmoji: r.imageUrl ?? '🎁',
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      href: `/play/${childId}/collection/${r.packSlug}`,
    })),
    ...avatar.map((r) => ({
      kind: 'avatar' as const,
      obtainedAt: r.obtainedAt,
      displayEmoji: slotEmoji(r.slotId),
      nameZh: r.name,
      nameEn: r.name,
      href: `/play/${childId}/shop?tab=avatar`,
    })),
    ...purchases.map((r) => {
      const { nameZh, nameEn } = splitBilingual(r.name);
      return {
        kind: r.kind,
        obtainedAt: r.obtainedAt,
        displayEmoji: r.imageUrl ?? '🎁',
        nameZh,
        nameEn,
        href: `/play/${childId}/shop?tab=${r.kind}`,
      };
    }),
  ];

  merged.sort((a, b) => b.obtainedAt.getTime() - a.obtainedAt.getTime());
  return merged.slice(0, limit);
}

export async function getRecentlyObtainedForChild(
  childId: string,
  limit = 3,
): Promise<RecentItem[]> {
  const overFetch = Math.max(limit * 3, limit);

  const [collRows, avatarRows, purchaseRows] = await Promise.all([
    db
      .select({
        obtainedAt: childCollections.firstObtainedAt,
        packSlug: collectionPacks.slug,
        imageUrl: collectibleItems.imageUrl,
        nameZh: collectibleItems.nameZh,
        nameEn: collectibleItems.nameEn,
      })
      .from(childCollections)
      .innerJoin(collectibleItems, eq(childCollections.itemId, collectibleItems.id))
      .innerJoin(collectionPacks, eq(collectibleItems.packId, collectionPacks.id))
      .where(eq(childCollections.childId, childId))
      .orderBy(desc(childCollections.firstObtainedAt))
      .limit(overFetch),

    db
      .select({
        obtainedAt: childAvatarInventory.obtainedAt,
        slotId: avatarItems.slotId,
        name: avatarItems.name,
      })
      .from(childAvatarInventory)
      .innerJoin(avatarItems, eq(childAvatarInventory.avatarItemId, avatarItems.id))
      .where(eq(childAvatarInventory.childId, childId))
      .orderBy(desc(childAvatarInventory.obtainedAt))
      .limit(overFetch),

    db
      .select({
        obtainedAt: shopPurchases.createdAt,
        kind: shopItems.kind,
        name: shopItems.name,
        imageUrl: shopItems.imageUrl,
      })
      .from(shopPurchases)
      .innerJoin(shopItems, eq(shopPurchases.shopItemId, shopItems.id))
      .where(eq(shopPurchases.childId, childId))
      .orderBy(desc(shopPurchases.createdAt))
      .limit(overFetch),
  ]);

  const petDecorPurchases: ShopSourceRow[] = purchaseRows
    .filter((r): r is typeof r & { kind: 'pet' | 'decor' } =>
      r.kind === 'pet' || r.kind === 'decor',
    )
    .map((r) => ({
      obtainedAt: r.obtainedAt,
      kind: r.kind,
      name: r.name,
      imageUrl: r.imageUrl,
    }));

  return mergeRecentItems(collRows, avatarRows, petDecorPurchases, childId, limit);
}
