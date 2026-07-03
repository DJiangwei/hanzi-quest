import { describe, expect, it } from 'vitest';
import { SceneAnswerEventSchema, MAX_EVENTS_PER_CALL } from '@/lib/play/answer-events';

describe('SceneAnswerEventSchema', () => {
  it('accepts a graded MCQ event', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'translate_pick',
      characterId: '4c9f0d5e-1111-2222-3333-444455556666',
      correct: false,
      pickedKey: 'some-char-id',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a flashcard self-rating event (correct null)', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'flashcard',
      characterId: '4c9f0d5e-1111-2222-3333-444455556666',
      selfRating: 'not_sure',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an event with BOTH correct and selfRating', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'flashcard',
      correct: true,
      selfRating: 'got_it',
    });
    expect(r.success).toBe(false);
  });

  it('rejects an event with NEITHER correct nor selfRating', () => {
    const r = SceneAnswerEventSchema.safeParse({ sceneType: 'audio_pick' });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown selfRating', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'flashcard',
      selfRating: 'kinda',
    });
    expect(r.success).toBe(false);
  });

  it('exports the per-call cap', () => {
    expect(MAX_EVENTS_PER_CALL).toBe(40);
  });
});
