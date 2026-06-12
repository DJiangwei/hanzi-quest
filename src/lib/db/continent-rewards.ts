// NEVER import this file from client code. It pulls in postgres.
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  avatarItems,
  childAvatarInventory,
  childAvatarEquipped,
} from '@/db/schema';
import { checkAndGrantTrophies, type GrantedTrophy } from './trophies';
import {
  CONTINENT_REWARDS,
  TROPHY_TO_CONTINENT,
} from '@/lib/collections/continentRewards';

/**
 * Grant + auto-equip the reward-only continent avatar cosmetic. Best effort: if
 * the item isn't seeded yet, no-ops (the trophy grant must not depend on it).
 * Idempotent — inventory insert ignores a re-grant; equip upserts the slot.
 * Mirrors `grantFestivalCosmeticInTx`.
 */
async function grantContinentCosmetic(
  childId: string,
  avatarItemRef: string,
): Promise<void> {
  const rows = await db
    .select({ id: avatarItems.id, slotId: avatarItems.slotId })
    .from(avatarItems)
    .where(eq(avatarItems.unlockRef, avatarItemRef))
    .limit(1);
  const item = rows[0];
  if (!item) return;

  await db
    .insert(childAvatarInventory)
    .values({ childId, avatarItemId: item.id })
    .onConflictDoNothing();

  await db
    .insert(childAvatarEquipped)
    .values({ childId, slotId: item.slotId, avatarItemId: item.id })
    .onConflictDoUpdate({
      target: [childAvatarEquipped.childId, childAvatarEquipped.slotId],
      set: { avatarItemId: item.id },
    });
}

/**
 * Continent-completion rewards in one call: grant the trophy (idempotent) AND,
 * for each NEWLY-earned continent, grant + auto-equip its reward cosmetic.
 * Returns the newly-earned trophies so callers can surface them via TrophyToast
 * (the cosmetic is a best-effort side effect). Drop-in replacement for the bare
 * `checkAndGrantTrophies(childId, { kind: 'continent-complete' })` call.
 */
export async function grantContinentRewards(
  childId: string,
): Promise<GrantedTrophy[]> {
  const trophies = await checkAndGrantTrophies(childId, {
    kind: 'continent-complete',
  });
  for (const t of trophies) {
    const continent = TROPHY_TO_CONTINENT[t.slug];
    if (!continent) continue;
    try {
      await grantContinentCosmetic(childId, CONTINENT_REWARDS[continent].avatarItemRef);
    } catch (err) {
      console.error('[continent] cosmetic grant failed:', err);
    }
  }
  return trophies;
}
