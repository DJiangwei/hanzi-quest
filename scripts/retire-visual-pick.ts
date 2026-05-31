/**
 * Retire the `visual_pick` scene template by flipping its `is_active` flag to false.
 *
 * Usage:
 *   pnpm tsx scripts/retire-visual-pick.ts
 *
 * Idempotent: re-running has no effect on already-retired rows.
 *
 * Why a script (vs. a single SQL): the script is testable + documented + safe.
 * It also makes the rollout step explicit in CLAUDE.md and the PR description.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';

// MUST load env BEFORE importing anything that touches process.env.DATABASE_URL.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

export async function retireVisualPick(): Promise<{ updated: number }> {
  const { db } = await import('@/db');
  const { sceneTemplates } = await import('@/db/schema/game');

  const result = await db
    .update(sceneTemplates)
    .set({ isActive: false })
    .where(eq(sceneTemplates.type, 'visual_pick'))
    .returning({ id: sceneTemplates.id });

  return { updated: result.length };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const { updated } = await retireVisualPick();

  if (updated === 0) {
    console.log('[retire-visual-pick] No visual_pick scene_template found — nothing to do.');
  } else {
    console.log(`[retire-visual-pick] flipped ${updated} row(s) to is_active=false`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[retire-visual-pick] failed:', err);
    process.exit(1);
  });
}
