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
  it('returns [] when fewer than 3 owned', () => {
    expect(buildStudyLesson([card(1), card(2)], [card(1), card(2)], Math.random)).toEqual([]);
  });
  it('builds STUDY_LESSON_SIZE questions, each with the target among its choices', () => {
    const owned = [card(1), card(2), card(3), card(4)];
    const pool = [...owned, card(5), card(6), card(7)];
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
    const owned = [card(1), card(2), card(3)];
    const qs = buildStudyLesson(owned, owned, seq([0.2, 0.7]));
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
});
