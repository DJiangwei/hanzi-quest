import { describe, expect, it } from 'vitest';
import { buildStudyLesson, STUDY_LESSON_SIZE, type StudyCardLite } from '@/lib/play/study';

function card(n: number): StudyCardLite {
  return { id: `id${n}`, slug: `s${n}`, nameZh: `中${n}`, nameEn: `En${n}`, imageUrl: null };
}
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('buildStudyLesson', () => {
  it('returns [] below the minimum, so the lesson never repeats a card', () => {
    expect(buildStudyLesson([card(1), card(2)], [card(1), card(2)], Math.random)).toEqual([]);
  });
  it('builds STUDY_LESSON_SIZE questions, each with the target among its choices', () => {
    const owned = [card(1), card(2), card(3), card(4), card(5), card(6), card(7)];
    const pool = [...owned, card(8), card(9), card(10)];
    const qs = buildStudyLesson(owned, pool, seq([0.1, 0.4, 0.9]));
    expect(qs).toHaveLength(STUDY_LESSON_SIZE);
    for (const q of qs) {
      expect(q.choices).toContainEqual(q.target);
      expect(q.choices.length).toBeLessThanOrEqual(4);
      expect(owned.map((o) => o.id)).toContain(q.target.id);
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(q.choices.length);
      expect(['picture_to_word', 'audio_to_picture']).toContain(q.type);
    }
  });
  it('gives every question a unique id (stable MCQ keys)', () => {
    const owned = [card(1), card(2), card(3), card(4), card(5), card(6)];
    const qs = buildStudyLesson(owned, owned, seq([0.2, 0.7]));
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
});

describe('the two bugs David reported', () => {
  it('NEVER repeats a card, even when asked for more questions than cards', () => {
    // The bug: `shuffledOwned[i % length]` cycled, so a pack with a handful of
    // owned cards asked about each of them twice and she noticed immediately.
    //
    // The size must EXCEED the owned count for this to discriminate. With
    // owned >= size the cycling index produces distinct targets anyway, so a
    // test using the default size passes against the broken code — the first
    // draft of this did exactly that and the mutation caught it.
    for (const [n, size] of [[6, 10], [7, 12], [9, 20]] as const) {
      const owned = Array.from({ length: n }, (_, i) => card(i + 1));
      const qs = buildStudyLesson(owned, owned, seq([0.13, 0.57, 0.81, 0.29]), size);
      const targets = qs.map((q) => q.target.id);
      expect(new Set(targets).size, `${n} owned, size ${size}`).toBe(targets.length);
      expect(qs.length, 'lesson is capped by what she owns').toBe(n);
    }
  });

  it('refuses to start rather than shrinking or repeating', () => {
    // The alternative — a silently shorter lesson — hides from the child why
    // today's practice was different. The entry point waits instead.
    for (const n of [0, 1, 3, 5]) {
      const owned = Array.from({ length: n }, (_, i) => card(i + 1));
      expect(buildStudyLesson(owned, owned, Math.random), `${n} owned`).toEqual([]);
    }
    expect(buildStudyLesson(
      Array.from({ length: 6 }, (_, i) => card(i + 1)),
      Array.from({ length: 6 }, (_, i) => card(i + 1)),
      Math.random,
    )).toHaveLength(6);
  });

  it('every question direction is picture ↔ 中文, never English ↔ English', () => {
    // "重点在于学习中文" — a question answerable from the English gloss tests
    // nothing this lesson is for.
    const owned = Array.from({ length: 12 }, (_, i) => card(i + 1));
    const qs = buildStudyLesson(owned, owned, seq([0.05, 0.4, 0.75, 0.95, 0.2, 0.6]));
    const kinds = new Set(qs.map((q) => q.type));
    for (const k of kinds) {
      expect(['picture_to_word', 'word_to_picture', 'audio_to_picture']).toContain(k);
    }
  });
});
