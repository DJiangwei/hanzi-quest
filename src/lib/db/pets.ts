import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childPetEquipped, pets, shopItems } from '@/db/schema';

export type PetRow = typeof pets.$inferSelect;
export type ShopItemRow = typeof shopItems.$inferSelect;

export interface PetShopListing {
  shopItem: ShopItemRow;
  pet: PetRow;
}

export async function getPetBySlug(slug: string): Promise<PetRow | null> {
  const rows = await db.select().from(pets).where(eq(pets.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getEquippedPet(childId: string): Promise<PetRow | null> {
  const rows = await db
    .select({ childPetEquipped, pet: pets })
    .from(childPetEquipped)
    .innerJoin(pets, eq(pets.id, childPetEquipped.petId))
    .where(eq(childPetEquipped.childId, childId));
  return rows[0]?.pet ?? null;
}

export async function setEquippedPet(
  childId: string,
  petId: string | null,
): Promise<void> {
  await db
    .insert(childPetEquipped)
    .values({ childId, petId })
    .onConflictDoUpdate({
      target: childPetEquipped.childId,
      set: { petId, updatedAt: sql`NOW()` },
    });
}

export async function listPetShopListings(): Promise<PetShopListing[]> {
  return await db
    .select({ shopItem: shopItems, pet: pets })
    .from(shopItems)
    .innerJoin(pets, eq(pets.slug, shopItems.slug))
    .where(and(eq(shopItems.kind, 'pet'), eq(shopItems.isActive, true)));
}
