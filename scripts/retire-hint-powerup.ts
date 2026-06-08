/**
 * Retire the `pw-hint` shop item by flipping `is_active` to false. Hints are
 * free in practice as of 2026-06-07, so the shop no longer sells them.
 *
 * Usage:
 *   pnpm tsx scripts/retire-hint-powerup.ts
 *
 * Idempotent: re-running has no effect on already-retired rows. The `'hint'`
 * powerup_kind enum value and any existing inventory rows are left intact.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

export async function retireHintPowerup(): Promise<{ updated: number }> {
  const { db } = await import('@/db');
  const { shopItems } = await import('@/db/schema');

  const result = await db
    .update(shopItems)
    .set({ isActive: false })
    .where(eq(shopItems.slug, 'pw-hint'))
    .returning({ id: shopItems.id });

  return { updated: result.length };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const { updated } = await retireHintPowerup();

  if (updated === 0) {
    console.log('[retire-hint-powerup] No pw-hint shop item found — nothing to do.');
  } else {
    console.log(`[retire-hint-powerup] flipped ${updated} row(s) to is_active=false`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[retire-hint-powerup] failed:', err);
    process.exit(1);
  });
}
