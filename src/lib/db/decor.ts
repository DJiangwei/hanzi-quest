import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { decorations, shopItems, shopPurchases } from '@/db/schema';

export type DecorationRow = typeof decorations.$inferSelect;
export type ShopItemRow = typeof shopItems.$inferSelect;

export interface DecorShopListing {
  shopItem: ShopItemRow;
  decoration: DecorationRow;
}

export async function listDecorShopListings(): Promise<DecorShopListing[]> {
  return await db
    .select({ shopItem: shopItems, decoration: decorations })
    .from(shopItems)
    .innerJoin(decorations, eq(decorations.slug, shopItems.slug))
    .where(and(eq(shopItems.kind, 'decor'), eq(shopItems.isActive, true)));
}

export async function listOwnedDecorationsForChild(
  childId: string,
): Promise<DecorationRow[]> {
  const rows = await db
    .select({ decoration: decorations })
    .from(shopPurchases)
    .innerJoin(shopItems, eq(shopItems.id, shopPurchases.shopItemId))
    .innerJoin(decorations, eq(decorations.slug, shopItems.slug))
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopItems.kind, 'decor'),
      ),
    );
  return rows.map((r) => r.decoration);
}
