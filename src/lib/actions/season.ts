'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { requireChild } from '@/lib/auth/guards';
import {
  getActiveSeason,
  getSeasonXp,
  getSeasonProgress,
  claimSeasonTierInTx,
} from '@/lib/db/season';
import { claimableTiers, tierForSeasonXp } from '@/lib/season/levels';
import { NoActiveSeasonError, TierNotReachedError } from '@/lib/errors/season-errors';
import type { RevealCard } from '@/lib/play/reveal-card';

const TierSchema = z.number().int().min(1).max(60);

/** Claim a single reached tier. Throws if no active season or the tier is unreached. */
export async function claimSeasonTierAction(
  childId: string,
  tierNum: number,
): Promise<{ ok: true; reveals: RevealCard[] }> {
  const { child } = await requireChild(childId);
  TierSchema.parse(tierNum);
  const season = await getActiveSeason();
  if (!season) throw new NoActiveSeasonError();
  const xp = await getSeasonXp(child.id, season);
  if (tierForSeasonXp(xp, season.tierConfig) < tierNum) {
    throw new TierNotReachedError(tierNum);
  }
  const tier = season.tierConfig.find((t) => t.tier === tierNum);
  if (!tier) throw new TierNotReachedError(tierNum);

  const result = await db.transaction((tx) =>
    claimSeasonTierInTx(tx, child.id, season.id, tier),
  );
  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/season`);
  return { ok: true, reveals: result.reveal ? [result.reveal] : [] };
}

/** Claim every currently-claimable tier in one transaction. */
export async function claimAllSeasonTiersAction(
  childId: string,
): Promise<{ ok: true; reveals: RevealCard[] }> {
  const { child } = await requireChild(childId);
  const season = await getActiveSeason();
  if (!season) throw new NoActiveSeasonError();
  const xp = await getSeasonXp(child.id, season);
  const claimed = await getSeasonProgress(child.id, season.id);
  const toClaim = claimableTiers(xp, claimed, season.tierConfig);
  const reveals: RevealCard[] = [];
  await db.transaction(async (tx) => {
    for (const tierNum of toClaim) {
      const tier = season.tierConfig.find((t) => t.tier === tierNum)!;
      const r = await claimSeasonTierInTx(tx, child.id, season.id, tier);
      if (r.reveal) reveals.push(r.reveal);
    }
  });
  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/season`);
  return { ok: true, reveals };
}
