'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPetBySlug, setEquippedPet } from '@/lib/db/pets';
import { listChildOwnedShopItemIds, listShopItemsByKind } from '@/lib/db/shop';

export async function equipPetAction(
  childId: string,
  slug: string | null,
): Promise<{ petSlug: string | null }> {
  await requireChild(childId);

  // Unequip is always allowed.
  if (slug === null) {
    await setEquippedPet(childId, null);
    revalidatePath(`/play/${childId}`);
    revalidatePath(`/play/${childId}/shop`);
    return { petSlug: null };
  }

  // Validate the pet exists in the catalog.
  const pet = await getPetBySlug(slug);
  if (!pet) {
    throw new Error(`Unknown pet slug: ${slug}`);
  }

  // Validate ownership via shop_purchases (matched by slug).
  const petShopItems = await listShopItemsByKind('pet');
  const match = petShopItems.find((s) => s.slug === slug);
  if (!match) {
    throw new Error(`Pet "${slug}" has no shop_items row — seed is out of sync`);
  }
  const owned = await listChildOwnedShopItemIds(childId);
  if (!owned.has(match.id)) {
    throw new Error(`Pet "${slug}" not owned`);
  }

  await setEquippedPet(childId, pet.id);
  revalidatePath(`/play/${childId}`);
  revalidatePath(`/play/${childId}/shop`);
  return { petSlug: slug };
}
