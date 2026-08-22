'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getSharedCurriculumPackBySlug } from '@/lib/db/curriculum';
import {
  isMapFullyCleared,
  recordFinalBossClear,
  grantMapChampionRewards,
} from '@/lib/db/final-boss';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { GrantedTrophy } from '@/lib/db/trophies';

// childId is validated by requireChild (the real auth gate) — min(1) keeps
// non-uuid test/dev ids working while still rejecting empty input.
const Schema = z.object({ childId: z.string().min(1), packSlug: z.string() });

/**
 * Finish a map final boss. Anti-cheat: re-verify the whole map is cleared.
 * Idempotent: the final_boss_clears insert is the single grant guard — a repeat
 * clear records nothing new and grants nothing. First clear grants the champion
 * bundle (card + trophy + cosmetic) and unlocks the next map (the row IS the gate).
 */
export async function finishFinalBossAction(
  input: z.input<typeof Schema>,
): Promise<{ ok: true; cardGrants: RevealCard[]; trophies: GrantedTrophy[] }> {
  const parsed = Schema.parse(input);
  const { child } = await requireChild(parsed.childId);

  // A map slug lives in curriculum_packs, NOT collection_packs — see the helper's
  // docstring. Using the collectible lookup here made every final boss throw.
  const pack = await getSharedCurriculumPackBySlug(parsed.packSlug);
  if (!pack) throw new Error('Map not found');

  const cleared = await isMapFullyCleared(child.id, pack.id);
  if (!cleared) throw new Error('Map not fully cleared');

  const { firstClear } = await recordFinalBossClear(child.id, pack.id);
  if (!firstClear) {
    revalidatePath(`/play/${child.id}`);
    return { ok: true, cardGrants: [], trophies: [] };
  }

  const { card, trophies } = await grantMapChampionRewards(
    child.id,
    parsed.packSlug,
  );
  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/maps`);
  return { ok: true, cardGrants: card ? [card] : [], trophies };
}
