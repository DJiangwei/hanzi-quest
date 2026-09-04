// V1 航海日志 — the read behind the Logbook. SERVER-ONLY, and deliberately NOT
// under src/lib/actions/: every exported async function in a 'use server' file
// is a public RPC endpoint, and this one takes a raw childId.
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { answerEvents } from '@/db/schema/answer-events';
import { childProfiles } from '@/db/schema/auth';
import {
  characterSentence,
  characterWord,
  characters,
  exampleSentences,
  weekCharacters,
  weeks,
  words,
} from '@/db/schema/content';
import { weekProgress } from '@/db/schema/game';
import { frontierWeekNumber, isWeekUnlockedFrom, listBossWeekIds } from '@/lib/db/weeks';

export interface LogbookEntry {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  weekNumber: number;
  firstWord: string | null;
  sentence: string | null;
  scored: number;
  wrong: number;
  dontKnow: number;
}

/**
 * Every character in a week the child has UNLOCKED, with the counts
 * `masteryForChar` needs.
 *
 * Wider than getReviewSessionData on purpose: 温故 reviews weeks she has
 * FINISHED (bossCleared), the Logbook shows what she is learning, including
 * the week in progress. Locked weeks stay out — showing them would spoil
 * unseen content and pad the total with characters she has never met.
 */
export async function getLogbookEntries(childId: string): Promise<LogbookEntry[]> {
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  const packId = child?.packId ?? null;

  const packCondition = packId
    ? and(
        eq(weeks.status, 'published'),
        or(eq(weeks.childId, childId), and(isNull(weeks.childId), eq(weeks.curriculumPackId, packId))),
      )
    : and(eq(weeks.status, 'published'), eq(weeks.childId, childId));

  const playable = await db
    .select({ weekId: weeks.id, weekNumber: weeks.weekNumber })
    .from(weeks)
    .where(packCondition);
  if (playable.length === 0) return [];

  const progress = await db
    .select({ weekId: weekProgress.weekId, bossCleared: weekProgress.bossCleared })
    .from(weekProgress)
    .where(eq(weekProgress.childId, childId));
  const clearedSet = new Set(progress.filter((p) => p.bossCleared).map((p) => p.weekId));

  // Same trio the home board uses, so the Logbook can never show a character
  // from an island the map paints as 🔒. A bossless week can never be cleared,
  // so leaving it in the candidate set would pin the frontier there forever.
  const bossWeekIds = await listBossWeekIds(playable.map((w) => w.weekId));
  const frontier = frontierWeekNumber(
    playable.map((w) => ({ id: w.weekId, weekNumber: w.weekNumber, hasBoss: bossWeekIds.has(w.weekId) })),
    clearedSet,
  );
  const unlocked = playable.filter((w) =>
    isWeekUnlockedFrom(w.weekNumber, frontier, clearedSet.has(w.weekId)),
  );
  if (unlocked.length === 0) return [];

  const weekNumberById = new Map(unlocked.map((w) => [w.weekId, w.weekNumber]));
  const weekIds = unlocked.map((w) => w.weekId);

  const charRows = await db
    .select({
      characterId: weekCharacters.characterId,
      weekId: weekCharacters.weekId,
      position: weekCharacters.position,
      hanzi: characters.hanzi,
      pinyin: characters.pinyinArray,
      meaningEn: characters.meaningEn,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(inArray(weekCharacters.weekId, weekIds));
  if (charRows.length === 0) return [];

  // A character taught twice keeps its HIGHEST week number, matching how
  // review.ts ranks by most recent appearance. `position` is tracked
  // alongside, in a separate map, purely to order the final array below — it
  // is not part of the public LogbookEntry shape.
  const byChar = new Map<string, Omit<LogbookEntry, 'scored' | 'wrong' | 'dontKnow' | 'firstWord' | 'sentence'>>();
  const positionByChar = new Map<string, number>();
  for (const r of charRows) {
    // Belt and braces against the WHERE above: a character whose week the gate
    // did not unlock is skipped outright rather than defaulting to week 0.
    // review.ts's `?? 0` would silently admit it as a week-zero entry.
    const wn = weekNumberById.get(r.weekId);
    if (wn === undefined) continue;
    const cur = byChar.get(r.characterId);
    if (!cur || wn > cur.weekNumber) {
      byChar.set(r.characterId, {
        characterId: r.characterId,
        hanzi: r.hanzi,
        pinyin: r.pinyin,
        meaningEn: r.meaningEn,
        weekNumber: wn,
      });
      positionByChar.set(r.characterId, r.position);
    }
  }

  // The curriculum's own order — island by island, then teaching order within
  // the island — not Postgres's PK-index (uuid) order, which interleaves week
  // 1 with week 9 and shifts whenever a row is rewritten.
  const charIds = Array.from(byChar.keys()).sort((a, b) => {
    const A = byChar.get(a)!;
    const B = byChar.get(b)!;
    if (A.weekNumber !== B.weekNumber) return A.weekNumber - B.weekNumber;
    const posA = positionByChar.get(a) ?? 0;
    const posB = positionByChar.get(b) ?? 0;
    if (posA !== posB) return posA - posB;
    return A.hanzi.localeCompare(B.hanzi);
  });

  // Mutually independent reads (all keyed only on childId/charIds, no
  // cross-dependency) — run together rather than one round-trip at a time.
  // This path runs on every Backpack render as well as the Logbook page.
  const [stats, wordRows, sentenceRows] = await Promise.all([
    // LEFT JOIN semantics by construction: a character with no answer_events
    // rows has no stat row and defaults to zero evidence. 57 of the 96
    // characters in production have only 1-2 scored answers, so this path is
    // the common one.
    db
      .select({
        characterId: answerEvents.characterId,
        scored: sql<number>`count(*) filter (where ${answerEvents.correct} is not null)`,
        wrong: sql<number>`count(*) filter (where ${answerEvents.correct} = false)`,
        dontKnow: sql<number>`count(*) filter (where ${answerEvents.selfRating} in ('dont_know', 'not_sure'))`,
      })
      .from(answerEvents)
      .where(and(eq(answerEvents.childId, childId), inArray(answerEvents.characterId, charIds)))
      .groupBy(answerEvents.characterId),
    // ORDER BY position is load-bearing: without it Postgres returns rows in
    // undefined order and the "first word" changes between refreshes.
    db
      .select({ characterId: characterWord.characterId, text: words.text })
      .from(characterWord)
      .innerJoin(words, eq(words.id, characterWord.wordId))
      .where(inArray(characterWord.characterId, charIds))
      .orderBy(asc(characterWord.position)),
    db
      .select({ characterId: characterSentence.characterId, text: exampleSentences.text })
      .from(characterSentence)
      .innerJoin(exampleSentences, eq(exampleSentences.id, characterSentence.sentenceId))
      .where(inArray(characterSentence.characterId, charIds)),
  ]);
  const statByChar = new Map(stats.map((s) => [s.characterId as string, s]));

  const firstWordByChar = new Map<string, string>();
  for (const w of wordRows) {
    if (!firstWordByChar.has(w.characterId)) firstWordByChar.set(w.characterId, w.text);
  }

  const sentenceByChar = new Map<string, string>();
  for (const s of sentenceRows) {
    if (!sentenceByChar.has(s.characterId)) sentenceByChar.set(s.characterId, s.text);
  }

  return charIds.map((id) => {
    const meta = byChar.get(id)!;
    const s = statByChar.get(id);
    return {
      ...meta,
      firstWord: firstWordByChar.get(id) ?? null,
      sentence: sentenceByChar.get(id) ?? null,
      scored: Number(s?.scored ?? 0),
      wrong: Number(s?.wrong ?? 0),
      dontKnow: Number(s?.dontKnow ?? 0),
    };
  });
}
