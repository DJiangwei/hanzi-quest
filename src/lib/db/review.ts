// A2 温故 — the read behind the daily review. SERVER-ONLY, and deliberately NOT
// under src/lib/actions/: every exported async function in a 'use server' file
// is a public RPC endpoint, and this one takes a raw childId.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { answerEvents } from '@/db/schema/answer-events';
import { childProfiles } from '@/db/schema/auth';
import { characterWord, characters, weekCharacters, weeks, words } from '@/db/schema/content';
import { weekProgress } from '@/db/schema/game';
import type { ReviewCandidate } from '@/lib/review/selection';
import type { ReviewPoolChar } from '@/lib/review/session';

/**
 * Characters from weeks the child has already CLEARED, with the telemetry
 * needed to rank them and the word data needed to build questions.
 *
 * Cleared, not merely playable: a week still being taught is covered by
 * practice, and re-drilling it here would duplicate that rather than review.
 */
export async function getReviewCandidates(childId: string): Promise<{
  candidates: ReviewCandidate[];
  pool: ReviewPoolChar[];
}> {
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  const packId = child?.packId ?? null;

  // Cleared weeks in the child's current pack (or their own authored weeks).
  const packCondition = packId
    ? sql`(${weeks.childId} = ${childId} OR (${weeks.childId} IS NULL AND ${weeks.curriculumPackId} = ${packId}))`
    : eq(weeks.childId, childId);

  const clearedWeeks = await db
    .select({ weekId: weeks.id, weekNumber: weeks.weekNumber })
    .from(weekProgress)
    .innerJoin(weeks, eq(weeks.id, weekProgress.weekId))
    .where(
      and(
        eq(weekProgress.childId, childId),
        eq(weekProgress.bossCleared, true),
        packCondition,
      ),
    );
  if (clearedWeeks.length === 0) return { candidates: [], pool: [] };

  const weekNumberById = new Map(clearedWeeks.map((w) => [w.weekId, w.weekNumber]));
  const weekIds = clearedWeeks.map((w) => w.weekId);

  // Characters in those weeks. A character keeps its HIGHEST week number, so a
  // char taught twice ranks by its most recent appearance.
  const charRows = await db
    .select({
      characterId: weekCharacters.characterId,
      weekId: weekCharacters.weekId,
      hanzi: characters.hanzi,
      meaningEn: characters.meaningEn,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(inArray(weekCharacters.weekId, weekIds));
  if (charRows.length === 0) return { candidates: [], pool: [] };

  const byChar = new Map<
    string,
    { hanzi: string; meaningEn: string | null; weekNumber: number }
  >();
  for (const r of charRows) {
    const wn = weekNumberById.get(r.weekId) ?? 0;
    const cur = byChar.get(r.characterId);
    if (!cur || wn > cur.weekNumber) {
      byChar.set(r.characterId, { hanzi: r.hanzi, meaningEn: r.meaningEn, weekNumber: wn });
    }
  }
  const charIds = Array.from(byChar.keys());

  // All-time telemetry per character, plus recency.
  //
  // LEFT JOIN semantics by construction: characters with no answer_events rows
  // simply have no stat row, and default to total 0 / null recency. That is
  // what NEUTRAL_WEAKNESS exists for — every character from a week cleared
  // before answer_events started (2026-07-03) is in exactly that position.
  const stats = await db
    .select({
      characterId: answerEvents.characterId,
      total: sql<number>`count(*)`,
      wrong: sql<number>`count(*) filter (where ${answerEvents.correct} = false)`,
      dontKnow: sql<number>`count(*) filter (where ${answerEvents.selfRating} in ('dont_know', 'not_sure'))`,
      daysSinceLastSeen: sql<
        number | null
      >`floor(extract(epoch from (now() - max(${answerEvents.createdAt}))) / 86400)`,
    })
    .from(answerEvents)
    .where(
      and(
        eq(answerEvents.childId, childId),
        inArray(answerEvents.characterId, charIds),
      ),
    )
    .groupBy(answerEvents.characterId);
  const statByChar = new Map(stats.map((s) => [s.characterId as string, s]));

  // Words for the pool — image_pick's stimulus and the cross-week ambiguity map.
  const wordRows = await db
    .select({
      characterId: characterWord.characterId,
      wordId: words.id,
      text: words.text,
      imageUrl: words.imageUrl,
    })
    .from(characterWord)
    .innerJoin(words, eq(words.id, characterWord.wordId))
    .where(inArray(characterWord.characterId, charIds));

  const wordsByChar = new Map<string, ReviewPoolChar['words']>();
  for (const w of wordRows) {
    const list = wordsByChar.get(w.characterId) ?? [];
    list.push({ wordId: w.wordId, text: w.text, imageUrl: w.imageUrl });
    wordsByChar.set(w.characterId, list);
  }

  const candidates: ReviewCandidate[] = charIds.map((id) => {
    const meta = byChar.get(id)!;
    const s = statByChar.get(id);
    return {
      characterId: id,
      hanzi: meta.hanzi,
      weekNumber: meta.weekNumber,
      total: Number(s?.total ?? 0),
      wrong: Number(s?.wrong ?? 0),
      dontKnow: Number(s?.dontKnow ?? 0),
      daysSinceLastSeen:
        s?.daysSinceLastSeen === null || s?.daysSinceLastSeen === undefined
          ? null
          : Number(s.daysSinceLastSeen),
    };
  });

  const pool: ReviewPoolChar[] = charIds.map((id) => {
    const meta = byChar.get(id)!;
    return {
      characterId: id,
      hanzi: meta.hanzi,
      meaningEn: meta.meaningEn,
      words: wordsByChar.get(id) ?? [],
    };
  });

  return { candidates, pool };
}
