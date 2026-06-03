/**
 * Retire the `word_match` scene template by flipping its `is_active` flag
 * to false. Same idempotent pattern as scripts/retire-visual-pick.ts.
 *
 * Usage:
 *   pnpm tsx scripts/retire-word-match.ts
 *
 * Idempotent: re-running has no effect on already-retired rows.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

export async function retireWordMatch(): Promise<{ updated: number }> {
  const { db } = await import('@/db');
  const { sceneTemplates } = await import('@/db/schema/game');

  const result = await db
    .update(sceneTemplates)
    .set({ isActive: false })
    .where(eq(sceneTemplates.type, 'word_match'))
    .returning({ id: sceneTemplates.id });

  return { updated: result.length };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const { updated } = await retireWordMatch();

  if (updated === 0) {
    console.log('[retire-word-match] No word_match scene_template found — nothing to do.');
  } else {
    console.log(`[retire-word-match] flipped ${updated} row(s) to is_active=false`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[retire-word-match] failed:', err);
    process.exit(1);
  });
}
