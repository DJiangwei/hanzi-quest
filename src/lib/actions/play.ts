'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireChild } from '@/lib/auth/guards';
import {
  awardCoins,
  awardDailyLoginIfDue,
  awardPerfectWeekIfDue,
  awardStreakMilestoneIfDue,
} from '@/lib/db/coins';
import {
  endPlaySession,
  getLevelById,
  getWeekProgress,
  hasPriorAttempt,
  isPerfectWeekForChild,
  recordSceneAttempt,
  startPlaySession,
  upsertWeekProgress,
} from '@/lib/db/play';
import { checkAndGrantTrophies, type GrantedTrophy } from '@/lib/db/trophies';
import { grantContinentRewards } from '@/lib/db/continent-rewards';
export type { GrantedTrophy } from '@/lib/db/trophies';
import { tickStreak, todayUtcIso } from '@/lib/db/streaks';
import {
  getPlayableWeekForChild,
  listCharactersForWeek,
} from '@/lib/db/weeks';
import { pullCardForChild, claimWeeklyGiftIfDue } from './gacha';
import type { GiftCard } from '@/lib/db/grants';
import type { RevealCard } from '@/lib/play/reveal-card';
import { awardXp, type AwardXpResult } from '@/lib/db/xp';
import { tickQuestProgressSafe } from '@/lib/db/quests';

// ─── XP helpers ──────────────────────────────────────────────────────────────

/** Guarded awardXp — logs on error and returns a zero result so callers can accumulate totals. */
async function safeAwardXp(
  childId: string,
  amount: number,
  source: Parameters<typeof awardXp>[2],
  refId?: string,
): Promise<AwardXpResult> {
  try {
    return await awardXp(childId, amount, source, refId);
  } catch (err) {
    console.error('[play] safeAwardXp error:', err);
    return { totalXp: 0, level: 1, leveledUp: false };
  }
}

function toRevealCard(g: Awaited<ReturnType<typeof pullCardForChild>>): RevealCard | null {
  if (!g.granted) return null;
  return {
    id: g.itemId,
    slug: g.slug,
    packSlug: g.packSlug,
    nameZh: g.nameZh,
    nameEn: g.nameEn,
    loreZh: g.loreZh,
    loreEn: g.loreEn,
    isDupe: g.isDupe,
    shardsAfter: g.shardsAfter,
  };
}

/**
 * Pull a card and map it to a RevealCard, degrading to null on ANY failure.
 * A gacha error (DB hiccup, empty-catalog throw) must never break boss-clear —
 * the kid still finishes the level, just without a card to reveal. Both the
 * boss-clear and perfect-week pulls are awaited (so they can surface in the
 * reveal), so both go through this guard.
 */
async function safePullRevealCard(
  childId: string,
  source: 'boss_clear' | 'perfect_week',
  refId: string,
): Promise<RevealCard | null> {
  try {
    return toRevealCard(await pullCardForChild(childId, source, refId));
  } catch (err) {
    console.error(`[finishLevelAction] ${source} pullCardForChild failed:`, err);
    return null;
  }
}

/** Why a card grant did not produce a card, surfaced to the kid on the fanfare. */
export type CardSkipReason = 'review_done_today' | 'daily_cap_reached';

/**
 * Pull a card and report BOTH the card (if any) and why it was skipped — so the
 * caller can tell the kid "今日回顾已完成" (review already done today) vs "今日卡片
 * 已发放完毕" (daily cap reached). Guarded: any failure degrades to no card / no
 * message and never breaks level completion.
 */
async function pullSectionCard(
  childId: string,
  source: 'boss_clear' | 'review' | 'practice',
  refId: string,
): Promise<{ card: RevealCard | null; skip: CardSkipReason | null }> {
  try {
    const res = await pullCardForChild(childId, source, refId);
    if (res.granted) return { card: toRevealCard(res), skip: null };
    if (res.reason === 'already_granted') return { card: null, skip: 'review_done_today' };
    if (res.reason === 'daily_cap_reached') return { card: null, skip: 'daily_cap_reached' };
    return { card: null, skip: null };
  } catch (err) {
    console.error(`[finishLevelAction] ${source} pullCardForChild failed:`, err);
    return { card: null, skip: null };
  }
}

const SCENE_COMPLETE_AWARD = 50;
const SCENE_REPLAY_AWARD = 5;
const PERFECT_BONUS = 25;
const BOSS_CLEAR_REWARD = 300;

/**
 * Kick off story chapter generation in the background. Errors are logged
 * but never bubble up — boss completion must succeed even if DeepSeek is
 * down. The chapter page synchronously falls back if eager gen didn't
 * finish in time.
 *
 * NOTE: this is `async` only to satisfy the `'use server'` constraint that
 * all exports must be async. Callers in this file invoke it WITHOUT await
 * (prefixed with `void`) so the fire-and-forget contract is preserved.
 */
export async function triggerEagerStoryGeneration(
  childId: string,
  weekId: string,
): Promise<void> {
  try {
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId, weekId });
  } catch (err) {
    console.error('[finishLevelAction] eager story gen failed:', err);
  }
}

export type EconomyBonusReason =
  | 'daily_login'
  | 'streak_milestone'
  | 'perfect_week'
  | 'streak_freeze';

export interface EconomyBonus {
  reason: EconomyBonusReason;
  delta: number;
  labelZh: string;
  labelEn: string;
  meta?: { milestone?: number };
}

export async function startSessionAction(
  childId: string,
): Promise<{ sessionId: string }> {
  const { child } = await requireChild(childId);
  const session = await startPlaySession({ childId: child.id });
  return { sessionId: session.id };
}

const FinishAttemptSchema = z.object({
  sessionId: z.string().uuid(),
  weekLevelId: z.string().uuid(),
  weekId: z.string().uuid(),
  childId: z.string().uuid(),
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0),
});

export async function finishAttemptAction(
  input: z.input<typeof FinishAttemptSchema>,
): Promise<{
  coinsAwarded: number;
  perfect: boolean;
  bonuses: EconomyBonus[];
  trophies: GrantedTrophy[];
  giftPack: { cards: GiftCard[] } | null;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishAttemptSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const isReplay = await hasPriorAttempt(child.id, parsed.weekLevelId);
  const baseAward = isReplay ? SCENE_REPLAY_AWARD : SCENE_COMPLETE_AWARD;
  const perfect =
    parsed.totalCount > 0 && parsed.correctCount === parsed.totalCount;
  const sceneBonus = perfect && !isReplay ? PERFECT_BONUS : 0;
  const coinsAwarded = baseAward + sceneBonus;

  const score = parsed.totalCount > 0
    ? Math.round((parsed.correctCount / parsed.totalCount) * 100)
    : 100;

  const attempt = await recordSceneAttempt({
    sessionId: parsed.sessionId,
    weekLevelId: parsed.weekLevelId,
    correctCount: parsed.correctCount,
    totalCount: parsed.totalCount,
    hintsUsed: parsed.hintsUsed,
    score,
    coinsAwarded,
  });

  if (coinsAwarded > 0) {
    await awardCoins({
      childId: child.id,
      delta: coinsAwarded,
      reason: isReplay ? 'scene_replay' : 'scene_complete',
      refType: 'scene_attempt',
      refId: attempt.id,
    });
    if (sceneBonus > 0) {
      await awardCoins({
        childId: child.id,
        delta: sceneBonus,
        reason: 'scene_perfect_bonus',
        refType: 'scene_attempt',
        refId: attempt.id,
      });
    }
  }

  // Economy: tick the streak and award any due first-of-day / milestone
  // bonuses. Both helpers are idempotent so retries are safe.
  const bonuses: EconomyBonus[] = [];
  let giftPack: { cards: GiftCard[] } | null = null;
  const today = todayUtcIso();
  const tick = await tickStreak(child.id, today);
  if (tick.ticked) {
    const daily = await awardDailyLoginIfDue(child.id, today);
    if (daily.awarded) {
      bonuses.push({
        reason: 'daily_login',
        delta: daily.delta,
        labelZh: '今日首战！',
        labelEn: "First play of the day!",
      });
      // Fresh check-in today → maybe the 5-of-7 weekly gift is now due.
      giftPack = await claimWeeklyGiftIfDue(child.id);
    }
    const milestone = await awardStreakMilestoneIfDue(
      child.id,
      tick.currentStreak,
    );
    if (milestone.awarded && milestone.milestone) {
      bonuses.push({
        reason: 'streak_milestone',
        delta: milestone.delta,
        labelZh: `连胜 ${milestone.milestone} 天！`,
        labelEn: `${milestone.milestone}-day streak!`,
        meta: { milestone: milestone.milestone },
      });
      // Streak milestone XP — guarded, fire-and-forget
      void safeAwardXp(child.id, 100, 'streak_milestone', String(milestone.milestone));
    }
    if (tick.freezeBurned) {
      bonuses.push({
        reason: 'streak_freeze',
        delta: 0,
        labelZh: '连胜保住了！',
        labelEn: 'Streak saved!',
      });
    }
  }

  const collectedTrophies: GrantedTrophy[] = [];

  // scene-clear trophy check (first-pinyin/translate/cloze)
  const levelRow = await getLevelById(parsed.weekLevelId);
  if (levelRow) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, {
        kind: 'scene-clear',
        sceneType: levelRow.sceneType as string,
        score,
      })),
    );
  }

  // level-complete trophy check (100/500-levels + streak rollups)
  collectedTrophies.push(
    ...(await checkAndGrantTrophies(child.id, { kind: 'level-complete' })),
  );

  // coin-award trophy check (only fires if a coin was just awarded)
  if (coinsAwarded > 0) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, { kind: 'coin-award' })),
    );
  }

  // ─── XP + Quest ticks (additive, guarded, fire-and-forget) ──────────────
  // These run AFTER all primary DB writes. A failure here must never break
  // the action — each group is wrapped so throws cannot escape.
  let xpGained = 0;
  let lastXpResult: AwardXpResult = { totalXp: 0, level: 1, leveledUp: false };

  try {
    // Always on a successful attempt: scene_complete XP + quest tick
    const r1 = await safeAwardXp(child.id, 10, 'scene_complete', attempt.id);
    xpGained += 10;
    lastXpResult = r1;

    // Segment-specific quest ticks
    if (levelRow?.sceneType === 'flashcard') {
      void tickQuestProgressSafe(child.id, 'review_flashcards', 1);
    } else if (levelRow && levelRow.sceneType !== 'boss') {
      void tickQuestProgressSafe(child.id, 'practice_scenes', 1);
    }
    void tickQuestProgressSafe(child.id, 'complete_scenes', 1);

    // Perfect score bonus
    if (perfect) {
      const r2 = await safeAwardXp(child.id, 5, 'scene_perfect', attempt.id);
      xpGained += 5;
      lastXpResult = r2;
      void tickQuestProgressSafe(child.id, 'perfect_scores', 1);
    }
  } catch (err) {
    console.error('[finishAttemptAction] XP/quest tick error:', err);
  }

  return {
    coinsAwarded,
    perfect,
    bonuses,
    trophies: collectedTrophies,
    giftPack,
    xp: { gained: xpGained, level: lastXpResult.level, leveledUp: lastXpResult.leveledUp },
  };
}

const FinishLevelSchema = z.object({
  sessionId: z.string().uuid(),
  childId: z.string().uuid(),
  weekId: z.string().uuid(),
  /** Which section just finished. Drives boss detection + per-section card grants. */
  section: z.enum(['review', 'practice', 'boss']).default('boss'),
  totalScenesPassed: z.number().int().min(0),
  totalScenesInWeek: z.number().int().min(1),
  durationSeconds: z.number().int().min(0),
});

export async function finishLevelAction(
  input: z.input<typeof FinishLevelSchema>,
): Promise<{
  ok: true;
  bossCleared: boolean;
  freePullClaimed: boolean;
  cardGrants: RevealCard[];
  /** Why no card was granted this completion (review-done / cap), or null. */
  cardMessage?: CardSkipReason | null;
  bonuses: EconomyBonus[];
  trophies: GrantedTrophy[];
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishLevelSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  // Use getPlayableWeekForChild — works for both per-family weeks AND shared
  // pack weeks (parent_user_id IS NULL + child enrolled in pack). The older
  // getWeekOwnedBy(weekId, parent.id) path was a regression for shared-pack
  // sessions (hotfix 22f0a24 patched the level page but missed this action).
  const week = await getPlayableWeekForChild(child.id, parsed.weekId);
  if (!week) throw new Error('Week not playable for this child');

  const completionPercent = Math.round(
    (parsed.totalScenesPassed / parsed.totalScenesInWeek) * 100,
  );

  // Boss clear = the BOSS section finished with all its scenes passed. (Pre-2026-06
  // this was derived from the week's last level being a boss, which mis-fired for
  // review/practice section runs — they'd mark the week boss-cleared and pay out
  // boss rewards. Threading the section makes it exact.)
  const allScenesCleared = parsed.totalScenesPassed === parsed.totalScenesInWeek;
  const bossCleared = parsed.section === 'boss' && allScenesCleared;
  // Message shown on the fanfare when a completion earns no card (review already
  // done today, or the daily cap is hit).
  let cardMessage: CardSkipReason | null = null;

  // Read existing progress BEFORE the upsert to guard against double-awarding on retry.
  const existing = await getWeekProgress(child.id, parsed.weekId);
  const alreadyAwarded = existing?.bossCleared === true;

  await upsertWeekProgress({
    childId: child.id,
    weekId: parsed.weekId,
    completionPercent,
    totalTimeDeltaSeconds: parsed.durationSeconds,
    bossCleared,
  });

  const bonuses: EconomyBonus[] = [];
  let perfectCard: RevealCard | null = null;
  if (bossCleared && !alreadyAwarded) {
    await awardCoins({
      childId: child.id,
      delta: BOSS_CLEAR_REWARD,
      reason: 'boss_clear',
      refType: 'week',
      refId: parsed.weekId,
    });
    // Eager story generation — fire-and-forget. Boss completion MUST NOT
    // depend on this; the story page synchronously regenerates if missing.
    void triggerEagerStoryGeneration(child.id, parsed.weekId);
    // Check for perfect-week bonus: every scene this child played for this
    // week must have at least one attempt with score=100.
    if (await isPerfectWeekForChild(child.id, parsed.weekId)) {
      const perfectAward = await awardPerfectWeekIfDue(child.id, parsed.weekId);
      if (perfectAward.awarded) {
        bonuses.push({
          reason: 'perfect_week',
          delta: perfectAward.delta,
          labelZh: '完美一周！',
          labelEn: 'Perfect week!',
        });
        // Await so the card surfaces in the reveal queue; guarded so a gacha
        // failure can't break boss-clear (kid still finishes the level).
        perfectCard = await safePullRevealCard(child.id, 'perfect_week', parsed.weekId);
      }
    }
  }

  await endPlaySession(parsed.sessionId, {
    weekId: parsed.weekId,
    completionPercent,
    durationSeconds: parsed.durationSeconds,
  });

  const collectedTrophies: GrantedTrophy[] = [];

  if (bossCleared) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, { kind: 'boss-clear', weekId: parsed.weekId })),
    );
  }

  // perfect-week — the bonus path already determined this; calling here is idempotent.
  collectedTrophies.push(
    ...(await checkAndGrantTrophies(child.id, { kind: 'perfect-week', weekId: parsed.weekId })),
  );

  // level-complete catches the rare boss-completion cross-100 case.
  collectedTrophies.push(
    ...(await checkAndGrantTrophies(child.id, { kind: 'level-complete' })),
  );

  let bossCard: RevealCard | null = null;
  if (bossCleared) {
    const r = await pullSectionCard(child.id, 'boss_clear', parsed.sessionId);
    bossCard = r.card;
    if (r.skip) cardMessage = r.skip; // boss never returns 'already_granted'
  }

  // Per-section card grant for review / practice (boss handled above).
  //  • review   → once per (week, day): refId = `${weekId}:${dayUtc}`. A repeat of
  //    the SAME week's review the same day reports 'review_done_today'.
  //  • practice → every full completion: refId = sessionId (only the daily cap
  //    bounds it). Both still consume the shared daily card cap.
  let sectionCard: RevealCard | null = null;
  if (
    allScenesCleared &&
    (parsed.section === 'review' || parsed.section === 'practice')
  ) {
    const refId =
      parsed.section === 'review'
        ? `${parsed.weekId}:${todayUtcIso()}`
        : parsed.sessionId;
    const r = await pullSectionCard(child.id, parsed.section, refId);
    sectionCard = r.card;
    if (r.skip) cardMessage = r.skip;
  }

  const cardGrants: RevealCard[] = [bossCard, perfectCard, sectionCard].filter(
    (c): c is RevealCard => c !== null,
  );

  // A boss/perfect-week card may have completed a pack — surface the trophy in
  // this response so the toast fires the moment the pack is finished.
  for (const slug of new Set(cardGrants.map((c) => c.packSlug))) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, { kind: 'pack-complete', packSlug: slug })),
    );
  }

  // A granted flag card may have completed a whole continent — grant + surface
  // the continent trophy AND its reward cosmetic (idempotent; only newly-earned
  // trophies come back).
  if (cardGrants.some((c) => c.packSlug === 'flags-v1')) {
    collectedTrophies.push(...(await grantContinentRewards(child.id)));
  }

  // ─── XP + Quest ticks (additive, guarded, fire-and-forget) ──────────────
  // Run AFTER all primary DB writes. A failure here must never break the action.
  let levelXpGained = 0;
  let levelLastXpResult: AwardXpResult = { totalXp: 0, level: 1, leveledUp: false };

  try {
    if (bossCleared) {
      const r = await safeAwardXp(child.id, 50, 'boss_clear', parsed.sessionId);
      levelXpGained += 50;
      levelLastXpResult = r;
      void tickQuestProgressSafe(child.id, 'boss_clear', 1);
      // Boss clear = completing the week's final level
      void tickQuestProgressSafe(child.id, 'full_level', 1);
    }
    if (cardGrants.length > 0) {
      void tickQuestProgressSafe(child.id, 'earn_card', cardGrants.length);
    }
  } catch (err) {
    console.error('[finishLevelAction] XP/quest tick error:', err);
  }

  revalidatePath(`/play/${child.id}`);
  return {
    ok: true,
    bossCleared,
    freePullClaimed: existing?.freePullClaimed ?? false,
    cardGrants,
    cardMessage,
    bonuses,
    trophies: collectedTrophies,
    xp: { gained: levelXpGained, level: levelLastXpResult.level, leveledUp: levelLastXpResult.leveledUp },
  };
}

export async function listWeekChars(weekId: string, childId: string) {
  const { child } = await requireChild(childId);
  // Same fix as finishLevelAction — handle shared pack weeks where the parent
  // doesn't own the week directly.
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) return [];
  return listCharactersForWeek(weekId);
}
