'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  consumePowerupAtomic,
  getPowerupCounts,
  recordSkippedAttempt,
} from '@/lib/db/powerups';

interface HintResult {
  ok: boolean;
  remaining: number;
}

export async function useHintAction(childId: string): Promise<HintResult> {
  const { child } = await requireChild(childId);
  const ok = await consumePowerupAtomic(child.id, 'hint');
  const counts = await getPowerupCounts(child.id);
  return { ok, remaining: counts.hint };
}

interface SkipResult {
  ok: boolean;
  remaining: number;
}

export async function useSkipAction(
  childId: string,
  weekLevelId: string,
  sessionId: string,
): Promise<SkipResult> {
  const { child } = await requireChild(childId);
  const ok = await consumePowerupAtomic(child.id, 'skip');
  if (ok) {
    await recordSkippedAttempt(sessionId, weekLevelId);
    revalidatePath(`/play/${child.id}/week`);
  }
  const counts = await getPowerupCounts(child.id);
  return { ok, remaining: counts.skip };
}
