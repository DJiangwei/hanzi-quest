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
  scored: 4,
  wrong: 2,
  dontKnow: 0,
  daysSinceLastSeen: 5,
});

const poolChar = (
  id: string,
  hanzi: string,
  meaningEn: string | null,
  words: { wordId: string; text: string; imageUrl: string | null }[] = [],
  pinyin: string[] = [],
): ReviewPoolChar => ({ characterId: id, hanzi, meaningEn, words, pinyin });

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

describe('buildReviewSession — F1, audio_pick homophone clash (final-fix review)', () => {
  it('never offers a homophone as an audio_pick distractor', () => {
    // 木(mù) / 目(mù) is one of four real homophone pairs in the corpus, all
    // cross-week — see pinyinClash's doc comment. The target has no meaning
    // and no words, so audio_pick is the ONLY buildable type: this pins the
    // guard rather than getting lucky on rng. rng=0.99 keeps shuffle() close
    // to identity order (floor(0.99*(i+1)) === i for every i here), which
    // places mu-eye — first in `others` — inside the slice(0, 3) distractors
    // whenever the guard is absent; a constant rng of 0 was tried first and
    // happened to always swap the first element to the END of the array
    // regardless of the guard, silently vacuous — see the final-fix report.
    const pool = [
      poolChar('mu-tree', '木', null, [], ['mù']),
      poolChar('mu-eye', '目', 'eye', [], ['mù']),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('mu-tree', '木')], pool, seq([0.99]));
    expect(questions).toHaveLength(1);
    expect(questions[0].type).toBe('audio_pick');
    expect(questions[0].choiceCharacterIds).not.toContain('mu-eye');
  });

  it('drops a target whose only pool-mates are all homophones, rather than building an ambiguous question', () => {
    // Exactly 3 others (the minimum an MCQ needs) and every one clashes on
    // pinyin with the target; no meaning and no words rule out the other two
    // types. No question type survives, so the target must be dropped, not
    // built with a homophone standing in as a distractor.
    const pool = [
      poolChar('mu-tree', '木', null, [], ['mù']),
      poolChar('mu-eye', '目', null, [], ['mù']),
      poolChar('other1', '甲', null, [], ['mù']),
      poolChar('other2', '乙', null, [], ['mù']),
    ];
    const questions = buildReviewSession([target('mu-tree', '木')], pool, seq([0]));
    expect(questions).toEqual([]);
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

  it('never selects a translate_pick distractor with the same meaning as the target', () => {
    // Two characters sharing the same meaning 'cat' — if not filtered from distractors,
    // the question would have two correct answers and no right one.
    const pool = [
      poolChar('cat', '猫', 'cat', []),
      poolChar('cat2', '咪', 'cat', []), // Same meaning — must be filtered
      poolChar('dog', '狗', 'dog', []),
      poolChar('bird', '鸟', 'bird', []),
      poolChar('fish', '鱼', 'fish', []),
    ];
    // Force translate_pick with deterministic shuffle that places cat2 in distractor pool.
    // With no valid image words, types=['translate_pick', 'audio_pick'].
    // rng=0.3: Math.floor(0.3 * 2) = 0 → translate_pick;
    // shuffle with rng=0.3 places cat2 in the first 3 of [cat2,dog,bird,fish],
    // ensuring the test fails if the same-meaning filter is removed.
    const questions = buildReviewSession(
      [target('cat', '猫')],
      pool,
      seq([0.3, 0.3, 0.3, 0.3, 0.3, 0.3]),
    );
    expect(questions).toHaveLength(1);
    const q = questions[0];
    expect(q.type).toBe('translate_pick');
    expect(q.choiceCharacterIds).toHaveLength(4);
    expect(q.choiceCharacterIds).toContain('cat'); // target included
    expect(q.choiceCharacterIds).not.toContain('cat2'); // same-meaning distractor filtered
  });

  it('gives every question a stable unique id', () => {
    const qs = buildReviewSession(
      [target('c1', '猫'), target('c2', '狗')],
      BASE_POOL,
      seq([0.1]),
    );
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });

  it('never lets a null-meaningEn character into a translate_pick question, as target or distractor', () => {
    // Renderer trust: ReviewRunner's translate_pick branch renders
    // `c.meaningEn` with NO fallback, on the strength of this invariant —
    // a null here would render a blank, unguessable button. `mystery` is
    // placed LAST in the pool so it lands mid-shuffle (not truncated off
    // the end by the CHOICE_COUNT slice) if the distractor filter's
    // `c.meaningEn &&` guard is ever dropped — see the mutation note below.
    const pool = [
      poolChar('cat', '猫', 'cat'),
      poolChar('dog', '狗', 'dog'),
      poolChar('bird', '鸟', 'bird'),
      poolChar('fish', '鱼', 'fish'),
      poolChar('mystery', '谜', null),
    ];
    const questions = buildReviewSession([target('cat', '猫')], pool, seq([0]));
    expect(questions).toHaveLength(1);
    const q = questions[0];
    expect(q.type).toBe('translate_pick');
    expect(q.choiceCharacterIds).not.toContain('mystery');
  });
});
