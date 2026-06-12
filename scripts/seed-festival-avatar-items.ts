/**
 * Seed ALL reward-only avatar cosmetics into `avatar_items` — festival cosmetics
 * (theme='festival') AND continent-completion cosmetics (theme='continent').
 * Iterates `rewardItems()`, so it stays current as reward themes are added.
 *
 * Usage:
 *   pnpm tsx scripts/seed-festival-avatar-items.ts
 *
 * Idempotent: inserts only the reward items whose `unlock_ref` isn't present.
 * These are REWARD-ONLY (`unlock_via='achievement'`) — never sold, never auto-
 * granted; the monthly festival challenge / continent completion grants +
 * auto-equips them. They use existing slots (hat/decor), so no avatar_slots
 * change is needed.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }

  const { db } = await import('../src/db');
  const { avatarItems } = await import('../src/db/schema');
  const { rewardItems } = await import('../src/lib/avatar/itemCatalog');

  const items = rewardItems();

  const existing = await db
    .select({ unlockRef: avatarItems.unlockRef })
    .from(avatarItems);
  const existingRefs = new Set(existing.map((e) => e.unlockRef));

  const toInsert = items.filter((i) => !existingRefs.has(i.unlockRef));
  if (toInsert.length > 0) {
    await db.insert(avatarItems).values(
      toInsert.map((i) => ({
        slotId: i.slot,
        name: i.displayName,
        unlockVia: 'achievement' as const,
        unlockRef: i.unlockRef,
        theme: i.theme,
      })),
    );
  }

  console.log(
    `seeded festival avatar items: ${items.length} reward items, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
