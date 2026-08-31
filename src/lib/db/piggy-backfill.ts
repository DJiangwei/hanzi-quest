// Past-progress backfill. SERVER-ONLY. Split out of piggy.ts because it reads
// four other subsystems' tables and would otherwise make the core ledger
// module hard to hold in context.
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  cardGrantsLog,
  childProfiles,
  finalBossClears,
  piggyEntries,
  weekProgress,
} from '@/db/schema';
import { listBossWeekIds } from '@/lib/db/weeks';
import { creditPiggyInTx, type PiggySource } from '@/lib/db/piggy';
import {
  PIGGY_BOSS_CLEAR_PENCE,
  PIGGY_FINAL_BOSS_PENCE,
  PIGGY_KEY_VAULT_PENCE,
} from '@/lib/piggy/rates';

export interface PendingCredit {
  source: PiggySource;
  refId: string;
  pence: number;
  occurredAt: Date;
}

/**
 * Everything this child's history says she has already earned.
 *
 * Deliberately NOT included: season tiers already claimed. The season £
 * attaches to the act of claiming, those claims happened under a config that
 * paid nothing, and `child_season_progress.tiersClaimed` is an integer[] with
 * no per-tier timestamp to date them by. Claims from here on pay.
 */
export async function computePastProgressCredits(
  childId: string,
): Promise<PendingCredit[]> {
  const out: PendingCredit[] = [];

  // ── Weekly bosses ───────────────────────────────────────────────────────
  // `bossCleared` is necessary but NOT sufficient. compile-week only emits a
  // boss at >= BOSS_MIN_CHARS, so a short week is bossless and can never have
  // been beaten. Ask the compiled `boss:boss:0` row (listBossWeekIds), never
  // the week's character count — both the threshold and a week's content move,
  // and getting this backwards is what made week 10 unreachable in prod.
  const progressRows = await db
    .select({
      weekId: weekProgress.weekId,
      lastPlayedAt: weekProgress.lastPlayedAt,
    })
    .from(weekProgress)
    .where(
      and(
        eq(weekProgress.childId, childId),
        eq(weekProgress.bossCleared, true),
      ),
    );

  const bossWeekIds = await listBossWeekIds(progressRows.map((r) => r.weekId));
  for (const r of progressRows) {
    if (!bossWeekIds.has(r.weekId)) continue;
    out.push({
      source: 'boss_clear',
      refId: r.weekId,
      pence: PIGGY_BOSS_CLEAR_PENCE,
      // week_progress has no boss_cleared_at column. Do not add one to fix
      // this: the clear times were never recorded, so a new column could only
      // hold the same approximation dressed up as precision.
      occurredAt: r.lastPlayedAt ?? new Date(),
    });
  }

  // ── Key vault ───────────────────────────────────────────────────────────
  const vaultRows = await db
    .select({ refId: cardGrantsLog.refId, at: cardGrantsLog.grantedAt })
    .from(cardGrantsLog)
    .where(
      and(
        eq(cardGrantsLog.childId, childId),
        eq(cardGrantsLog.source, 'key_vault'),
      ),
    );
  for (const v of vaultRows) {
    out.push({
      source: 'key_vault',
      refId: v.refId,
      pence: PIGGY_KEY_VAULT_PENCE,
      occurredAt: v.at,
    });
  }

  // ── Final bosses ────────────────────────────────────────────────────────
  const finalRows = await db
    .select({ packId: finalBossClears.packId, at: finalBossClears.clearedAt })
    .from(finalBossClears)
    .where(eq(finalBossClears.childId, childId));
  for (const f of finalRows) {
    out.push({
      source: 'final_boss',
      refId: f.packId,
      pence: PIGGY_FINAL_BOSS_PENCE,
      occurredAt: f.at,
    });
  }

  return out;
}

/** Past-progress credits not already in the ledger (the flag may have been
 *  switched off and on again). */
export async function pendingPastProgressCredits(
  childId: string,
): Promise<PendingCredit[]> {
  const all = await computePastProgressCredits(childId);
  if (all.length === 0) return [];

  const existing = await db
    .select({ source: piggyEntries.source, refId: piggyEntries.refId })
    .from(piggyEntries)
    .where(
      and(
        eq(piggyEntries.childId, childId),
        inArray(
          piggyEntries.source,
          ['boss_clear', 'key_vault', 'final_boss'],
        ),
      ),
    );
  const seen = new Set(existing.map((e) => `${e.source}:${e.refId}`));
  return all.filter((c) => !seen.has(`${c.source}:${c.refId}`));
}

/** What the parent sees BEFORE committing to the cost. */
export async function previewPastProgress(childId: string): Promise<{
  totalPence: number;
  bossClears: number;
  vaults: number;
  finalBosses: number;
}> {
  const pending = await pendingPastProgressCredits(childId);
  return {
    totalPence: pending.reduce((sum, c) => sum + c.pence, 0),
    bossClears: pending.filter((c) => c.source === 'boss_clear').length,
    vaults: pending.filter((c) => c.source === 'key_vault').length,
    finalBosses: pending.filter((c) => c.source === 'final_boss').length,
  };
}

/**
 * Turn the piggy bank on and credit past progress in ONE transaction.
 *
 * `creditPiggyInTx` is used rather than `creditPiggy` on purpose: the flag is
 * being set by this very transaction, so a fresh read of it would race its own
 * write. The caller has established the flag; the in-tx variant trusts it.
 *
 * Exactly-once comes from `piggy_entries_auto_uq`, so a second run credits
 * nothing even if this is called twice concurrently.
 */
export async function enablePiggyBankWithBackfill(
  childId: string,
): Promise<{ creditedPence: number; entries: number }> {
  const pending = await pendingPastProgressCredits(childId);

  return db.transaction(async (tx) => {
    await tx
      .update(childProfiles)
      .set({ piggyBankEnabled: true })
      .where(eq(childProfiles.id, childId));

    let creditedPence = 0;
    let entries = 0;
    for (const c of pending) {
      const res = await creditPiggyInTx(tx, {
        childId,
        source: c.source,
        refId: c.refId,
        pence: c.pence,
        occurredAt: c.occurredAt,
      });
      if (res.credited) {
        creditedPence += c.pence;
        entries += 1;
      }
    }
    return { creditedPence, entries };
  });
}

/** Turn it off. The ledger is KEPT — real money that was earned stays earned,
 *  and switching back on must not double-credit (the unique index sees to it). */
export async function disablePiggyBank(childId: string): Promise<void> {
  await db
    .update(childProfiles)
    .set({ piggyBankEnabled: false })
    .where(eq(childProfiles.id, childId));
}
