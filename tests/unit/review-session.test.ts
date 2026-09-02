// A2 温故 — pure session builder. The load-bearing test here is the cross-week
// ambiguity guard: 温故's pool is cross-week BY DEFINITION, which reopens the
// exact bug PR #158 fixed for single weeks.
import { describe, expect, it } from 'vitest';
import {
  buildReviewSession,
  buildWordOwners,
  type ReviewPoolChar,
} from '@/lib/review/session';
import type { ReviewCandidate } from '@/lib/review/selection';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const target = (id: string, hanzi: string): ReviewCandidate => ({
  characterId: id,
  hanzi,
  weekNumber: 1,
  total: 4,
  wrong: 2,
  dontKnow: 0,
  daysSinceLastSeen: 5,
});

const poolChar = (
  id: string,
  hanzi: string,
  meaningEn: string | null,
  words: { wordId: string; text: string; imageUrl: string | null }[] = [],
): ReviewPoolChar => ({ characterId: id, hanzi, meaningEn, words });

/** Four plain characters with distinct meanings — enough for any MCQ. */
const BASE_POOL = [
  poolChar('c1', '猫', 'cat'),
  poolChar('c2', '狗', 'dog'),
  poolChar('c3', '鸟', 'bird'),
  poolChar('c4', '鱼', 'fish'),
];

describe('buildWordOwners', () => {
  it('maps a word to EVERY character that owns it, across the whole pool', () => {
    const owners = buildWordOwners([
      poolChar('sing', '唱', 'sing', [{ wordId: 'w1', text: '唱歌', imageUrl: 'http://x/1.png' }]),
      poolChar('song', '歌', 'song', [{ wordId: 'w2', text: '唱歌', imageUrl: 'http://x/1.png' }]),
    ]);
    // Keyed on HANZI, matching validStimulusWords' documented contract
    // ("word TEXT -> the set of hanzi that word is linked to").
    expect(owners.get('唱歌')).toEqual(new Set(['唱', '歌']));
  });
});

describe('buildReviewSession — the PR #158 hazard, cross-week', () => {
  it('never offers an image_pick whose picture two POOL characters could answer', () => {
    // 唱歌 is owned by 唱 and 歌. In a single week PR #158 already rejects this;
    // 温故's pool spans weeks, so the same collision returns one week over —
    // the picture would have TWO correct answers and the scene no right one.
    const pool = [
      poolChar('sing', '唱', 'sing', [{ wordId: 'w1', text: '唱歌', imageUrl: 'http://x/1.png' }]),
      poolChar('song', '歌', 'song', [{ wordId: 'w2', text: '唱歌', imageUrl: 'http://x/1.png' }]),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('sing', '唱')], pool, seq([0]));
    for (const q of questions) {
      expect(q.type).not.toBe('image_pick');
    }
  });

  it('DOES offer an image_pick when the picture is unambiguous', () => {
    const pool = [
      poolChar('cat', '猫', 'cat', [{ wordId: 'w9', text: '小猫', imageUrl: 'http://x/9.png' }]),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('cat', '猫')], pool, seq([0]));
    expect(questions[0].type).toBe('image_pick');
    expect(questions[0].stimulusWordId).toBe('w9');
  });

  it('never offers an image_pick for a counting character', () => {
    // 一…十 hinge on a count diffusion art cannot render (PR #158).
    const pool = [
      poolChar('seven', '七', 'seven', [{ wordId: 'w7', text: '七个', imageUrl: 'http://x/7.png' }]),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('seven', '七')], pool, seq([0]));
    for (const q of questions) expect(q.type).not.toBe('image_pick');
  });
});

describe('buildReviewSession', () => {
  it('builds one question per target', () => {
    const qs = buildReviewSession(
      [target('c1', '猫'), target('c2', '狗')],
      BASE_POOL,
      seq([0.1]),
    );
    expect(qs).toHaveLength(2);
    expect(qs.map((q) => q.targetCharacterId)).toEqual(['c1', 'c2']);
  });

  it('always includes the target among the choices, with 4 distinct choices', () => {
    for (const q of buildReviewSession([target('c1', '猫')], BASE_POOL, seq([0.1]))) {
      expect(q.choiceCharacterIds).toContain(q.targetCharacterId);
      expect(q.choiceCharacterIds).toHaveLength(4);
      expect(new Set(q.choiceCharacterIds).size).toBe(4);
    }
  });

  it('drops a target that can support no question type at all', () => {
    // No meaning, no art, and a pool too small for an audio MCQ.
    const tiny = [poolChar('lonely', '孤', null), poolChar('other', '他', null)];
    expect(buildReviewSession([target('lonely', '孤')], tiny, seq([0.1]))).toEqual([]);
  });

  it('is deterministic under an injected rng', () => {
    const a = buildReviewSession([target('c1', '猫')], BASE_POOL, seq([0.42]));
    const b = buildReviewSession([target('c1', '猫')], BASE_POOL, seq([0.42]));
    expect(a).toEqual(b);
  });

  it('gives every question a stable unique id', () => {
    const qs = buildReviewSession(
      [target('c1', '猫'), target('c2', '狗')],
      BASE_POOL,
      seq([0.1]),
    );
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
});
