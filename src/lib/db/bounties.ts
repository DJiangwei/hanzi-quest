// T2 通缉令 — server-side bounty generation, ticking, and claiming.
// Selection is the pure engine in src/lib/bounty/ranking.ts fed with
// answer_events stats; storage is bounty_posters (one row per poster/day).

import { and, asc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bountyPosters } from '@/db/schema/bounties';
import { answerEvents } from '@/db/schema/answer-events';
import { characters, weekCharacters, weeks } from '@/db/schema/content';
import { childProfiles } from '@/db/schema/auth';
import { awardCoinsInTx } from '@/lib/db/coins';
import {
  BOUNTY_COOLDOWN_DAYS,
  BOUNTY_REQUIRED_HITS,
  BOUNTY_REWARD_COINS,
  pickBounties,
  type BountyCandidate,
} from '@/lib/bounty/ranking';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BountyPosterView {
  characterId: string;
  hanzi: string;
  weekId: string;
  weekNumber: number;
  required: number;
  progress: number;
  claimed: boolean;
}

function isoDaysAgo(dayUtc: string, days: number): string {
  const d = new Date(`${dayUtc}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** The playable published weeks for a child (per-family + current-pack shared). */
async function playableWeekIds(
  childId: string,
): Promise<{ weekId: string; weekNumber: number }[]> {
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  const packId = child?.packId ?? null;

  const condition = packId
    ? sql`(${weeks.childId} = ${childId} OR (${weeks.childId} IS NULL AND ${weeks.curriculumPackId} = ${packId})) AND ${weeks.status} = 'published'`
    : and(eq(weeks.childId, childId), eq(weeks.status, 'published'));

  const rows = await db
    .select({ weekId: weeks.id, weekNumber: weeks.weekNumber })
    .from(weeks)
    .where(condition);
  return rows;
}

/**
 * Idempotently generate today's posters (quests pattern: rows for today →
 * return them). May create fewer than 3 (or none) when the child has little
 * eligible material — the UI hides an empty panel.
 */
export async function generateDailyBounties(
  childId: string,
  dayUtc: string,
): Promise<void> {
  const existing = await db
    .select({ id: bountyPosters.id })
    .from(bountyPosters)
    .where(and(eq(bountyPosters.childId, childId), eq(bountyPosters.dayUtc, dayUtc)))
    .limit(1);
  if (existing.length > 0) return;

  const weekRows = await playableWeekIds(childId);
  if (weekRows.length === 0) return;
  const weekNumberById = new Map(weekRows.map((w) => [w.weekId, w.weekNumber]));

  // Candidate chars across playable weeks (a char keeps its highest week number).
  const charRows = await db
    .select({
      characterId: weekCharacters.characterId,
      weekId: weekCharacters.weekId,
      hanzi: characters.hanzi,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(inArray(weekCharacters.weekId, weekRows.map((w) => w.weekId)));
  if (charRows.length === 0) return;

  const byChar = new Map<string, { hanzi: string; weekNumber: number }>();
  for (const r of charRows) {
    const wn = weekNumberById.get(r.weekId) ?? 0;
    const cur = byChar.get(r.characterId);
    if (!cur || wn > cur.weekNumber) byChar.set(r.characterId, { hanzi: r.hanzi, weekNumber: wn });
  }

  // All-time per-char telemetry stats.
  const stats = await db
    .select({
      characterId: answerEvents.characterId,
      total: sql<number>`count(*)`,
      wrong: sql<number>`count(*) filter (where ${answerEvents.correct} = false)`,
      dontKnow: sql<number>`count(*) filter (where ${answerEvents.selfRating} in ('dont_know', 'not_sure'))`,
    })
    .from(answerEvents)
    .where(
      and(
        eq(answerEvents.childId, childId),
        inArray(answerEvents.characterId, Array.from(byChar.keys())),
      ),
    )
    .groupBy(answerEvents.characterId);
  const statByChar = new Map(stats.map((s) => [s.characterId as string, s]));

  // Cooldown: chars posted within the last N days don't repeat.
  const cooldownRows = await db
    .select({ characterId: bountyPosters.characterId })
    .from(bountyPosters)
    .where(
      and(
        eq(bountyPosters.childId, childId),
        gte(bountyPosters.dayUtc, isoDaysAgo(dayUtc, BOUNTY_COOLDOWN_DAYS)),
      ),
    );

  const candidates: BountyCandidate[] = Array.from(byChar.entries()).map(
    ([characterId, meta]) => {
      const s = statByChar.get(characterId);
      return {
        characterId,
        hanzi: meta.hanzi,
        weekNumber: meta.weekNumber,
        total: Number(s?.total ?? 0),
        wrong: Number(s?.wrong ?? 0),
        dontKnow: Number(s?.dontKnow ?? 0),
      };
    },
  );

  const picked = pickBounties(
    candidates,
    new Set(cooldownRows.map((r) => r.characterId)),
  );
  if (picked.length === 0) return;

  await db
    .insert(bountyPosters)
    .values(
      picked.map((c) => ({
        childId,
        dayUtc,
        characterId: c.characterId,
        required: BOUNTY_REQUIRED_HITS,
      })),
    )
    .onConflictDoNothing();
}

/** Today's posters with the char + a deep-link week resolved. */
export async function listTodayBounties(
  childId: string,
  dayUtc: string,
): Promise<BountyPosterView[]> {
  const rows = await db
    .select({
      characterId: bountyPosters.characterId,
      required: bountyPosters.required,
      progress: bountyPosters.progress,
      claimedAt: bountyPosters.claimedAt,
      hanzi: characters.hanzi,
    })
    .from(bountyPosters)
    .innerJoin(characters, eq(characters.id, bountyPosters.characterId))
    .where(and(eq(bountyPosters.childId, childId), eq(bountyPosters.dayUtc, dayUtc)))
    .orderBy(asc(bountyPosters.createdAt));
  if (rows.length === 0) return [];

  // Resolve each char's playable week for the deep-link (highest week number).
  const weekRows = await playableWeekIds(childId);
  const weekNumberById = new Map(weekRows.map((w) => [w.weekId, w.weekNumber]));
  const links = await db
    .select({
      characterId: weekCharacters.characterId,
      weekId: weekCharacters.weekId,
    })
    .from(weekCharacters)
    .where(
      and(
        inArray(weekCharacters.characterId, rows.map((r) => r.characterId)),
        inArray(weekCharacters.weekId, weekRows.map((w) => w.weekId)),
      ),
    );
  const weekByChar = new Map<string, { weekId: string; weekNumber: number }>();
  for (const l of links) {
    const wn = weekNumberById.get(l.weekId) ?? 0;
    const cur = weekByChar.get(l.characterId);
    if (!cur || wn > cur.weekNumber) {
      weekByChar.set(l.characterId, { weekId: l.weekId, weekNumber: wn });
    }
  }

  return rows.map((r) => ({
    characterId: r.characterId,
    hanzi: r.hanzi,
    weekId: weekByChar.get(r.characterId)?.weekId ?? '',
    weekNumber: weekByChar.get(r.characterId)?.weekNumber ?? 0,
    required: r.required,
    progress: r.progress,
    claimed: r.claimedAt !== null,
  }));
}

/**
 * Bump today's unclaimed posters for correct answers. `characterIds` may
 * contain repeats (several correct answers in one batch) — each counts.
 * Never throws: bounty bookkeeping must not break the attempt (call via
 * try/catch like the other post-write ticks).
 */
export async function tickBountyProgress(
  childId: string,
  dayUtc: string,
  characterIds: string[],
): Promise<void> {
  if (characterIds.length === 0) return;
  const hits = new Map<string, number>();
  for (const id of characterIds) hits.set(id, (hits.get(id) ?? 0) + 1);

  for (const [characterId, n] of hits) {
    await db
      .update(bountyPosters)
      .set({
        progress: sql`least(${bountyPosters.progress} + ${n}, ${bountyPosters.required})`,
      })
      .where(
        and(
          eq(bountyPosters.childId, childId),
          eq(bountyPosters.dayUtc, dayUtc),
          eq(bountyPosters.characterId, characterId),
          isNull(bountyPosters.claimedAt),
        ),
      );
  }
}

export type BountyClaimResult =
  | { ok: true; coins: number; allClaimedToday: boolean }
  | { ok: false; reason: 'not_found' | 'not_ready' | 'already_claimed' };

/**
 * Claim one completed poster: stamp claimed_at + pay the coin bounty in one
 * tx. `allClaimedToday` tells the caller whether the all-3 card is due.
 */
export async function claimBountyInTx(
  tx: Tx,
  childId: string,
  dayUtc: string,
  characterId: string,
): Promise<BountyClaimResult> {
  const rows = await tx
    .select()
    .from(bountyPosters)
    .where(
      and(
        eq(bountyPosters.childId, childId),
        eq(bountyPosters.dayUtc, dayUtc),
        eq(bountyPosters.characterId, characterId),
      ),
    )
    .for('update');
  const poster = rows[0];
  if (!poster) return { ok: false, reason: 'not_found' };
  if (poster.claimedAt !== null) return { ok: false, reason: 'already_claimed' };
  if (poster.progress < poster.required) return { ok: false, reason: 'not_ready' };

  await tx
    .update(bountyPosters)
    .set({ claimedAt: sql`now()` })
    .where(eq(bountyPosters.id, poster.id));
  await awardCoinsInTx(tx, {
    childId,
    delta: BOUNTY_REWARD_COINS,
    reason: 'bounty_claim',
    refType: 'bounty_poster',
    refId: poster.id,
  });

  const open = await tx
    .select({ id: bountyPosters.id })
    .from(bountyPosters)
    .where(
      and(
        eq(bountyPosters.childId, childId),
        eq(bountyPosters.dayUtc, dayUtc),
        isNull(bountyPosters.claimedAt),
      ),
    );

  return { ok: true, coins: BOUNTY_REWARD_COINS, allClaimedToday: open.length === 0 };
}
