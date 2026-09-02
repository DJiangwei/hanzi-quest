// 'daily_review' has to be accepted by four separate unions before the feature
// can pay anything. Three are TS-only; coin_reason is a pgEnum and needs a
// migration.
import { describe, expect, it } from 'vitest';
import { ANSWER_SOURCES } from '@/lib/play/answer-events';

describe("the 'daily_review' source", () => {
  it('is a distinct answer source from the per-week flashcard section', () => {
    // ANSWER_SOURCES already contains 'review' — that is the per-week 回顾
    // section, NOT this feature. Reusing it would make the two
    // indistinguishable in answer_events and corrupt the exact signal A3
    // parent insights and V1 mastery will read back.
    expect(ANSWER_SOURCES).toContain('review');
    expect(ANSWER_SOURCES).toContain('daily_review');
  });
});
