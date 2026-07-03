import { db } from '@/db';
import { answerEvents } from '@/db/schema';
import {
  MAX_EVENTS_PER_CALL,
  SceneAnswerEventSchema,
  type AnswerSource,
} from '@/lib/play/answer-events';

/**
 * Batch-insert answer telemetry. NEVER throws (mirrors safeAwardXp /
 * tickQuestProgressSafe): invalid elements are dropped individually, any
 * db error is swallowed + logged. Returns the number of rows inserted.
 * childId/weekId/source come from the calling action's validated context —
 * never from per-event client data.
 */
export async function logAnswerEventsSafe(
  childId: string,
  weekId: string | null,
  source: AnswerSource,
  events: unknown[],
): Promise<number> {
  try {
    const rows = events
      .slice(0, MAX_EVENTS_PER_CALL)
      .map((e) => SceneAnswerEventSchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => ({
        childId,
        weekId,
        source,
        sceneType: r.data.sceneType,
        characterId: r.data.characterId ?? null,
        wordId: r.data.wordId ?? null,
        itemKey: r.data.itemKey ?? null,
        correct: r.data.correct ?? null,
        selfRating: r.data.selfRating ?? null,
        pickedKey: r.data.pickedKey ?? null,
      }));
    if (rows.length === 0) return 0;
    await db.insert(answerEvents).values(rows);
    return rows.length;
  } catch (err) {
    console.error('[answer-events] logAnswerEventsSafe error:', err);
    return 0;
  }
}
