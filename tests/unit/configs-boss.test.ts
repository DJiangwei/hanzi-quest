// tests/unit/configs-boss.test.ts
import { describe, expect, it } from 'vitest';
import {
  BossConfigSchema,
  BossQuestionTypeSchema,
  PinyinPickConfigSchema,
  SentenceClozeConfigSchema,
  SegmentSchema,
  TranslatePickConfigSchema,
} from '@/lib/scenes/configs';

describe('BossConfigSchema', () => {
  it('parses a valid boss config', () => {
    const result = BossConfigSchema.parse({
      characterIds: [
        '11111111-2222-4333-a444-555555555555',
        '11111111-2222-4333-a444-555555555556',
      ],
      questionTypes: ['audio_pick', 'visual_pick'],
    });
    expect(result.characterIds).toHaveLength(2);
    expect(result.questionTypes).toContain('audio_pick');
  });

  it('rejects characterIds with fewer than 2 entries', () => {
    expect(() =>
      BossConfigSchema.parse({
        characterIds: ['11111111-2222-4333-a444-555555555555'],
        questionTypes: ['audio_pick'],
      }),
    ).toThrow();
  });

  it('rejects unknown questionType', () => {
    expect(() =>
      BossConfigSchema.parse({
        characterIds: ['11111111-2222-4333-a444-555555555555', '11111111-2222-4333-a444-555555555556'],
        questionTypes: ['boss'],
      }),
    ).toThrow();
  });
});

describe('PR30 — new scene configs', () => {
  it('Segment enum lists the 5 values from the spec', () => {
    for (const v of ['review', 'sound', 'sight', 'meaning', 'boss']) {
      expect(SegmentSchema.safeParse(v).success).toBe(true);
    }
    expect(SegmentSchema.safeParse('foo').success).toBe(false);
  });

  it('PinyinPickConfigSchema accepts a uuid characterId and segment', () => {
    const parsed = PinyinPickConfigSchema.parse({
      characterId: '11111111-2222-4333-a444-555555555555',
      segment: 'sound',
    });
    expect(parsed.characterId).toBe('11111111-2222-4333-a444-555555555555');
    expect(parsed.segment).toBe('sound');
  });

  it('TranslatePickConfigSchema requires direction', () => {
    const ok = TranslatePickConfigSchema.parse({
      characterId: '11111111-2222-4333-a444-555555555555',
      direction: 'cn_to_en',
      segment: 'meaning',
    });
    expect(ok.direction).toBe('cn_to_en');
    expect(
      TranslatePickConfigSchema.safeParse({
        characterId: '11111111-2222-4333-a444-555555555555',
        direction: 'sideways',
        segment: 'meaning',
      }).success,
    ).toBe(false);
  });

  it('SentenceClozeConfigSchema requires characterId + sentenceId', () => {
    expect(
      SentenceClozeConfigSchema.parse({
        characterId: '11111111-2222-4333-a444-555555555555',
        sentenceId: '22222222-2222-4333-a444-555555555556',
        segment: 'meaning',
      }).characterId,
    ).toBe('11111111-2222-4333-a444-555555555555');
  });

  it('BossQuestionTypeSchema now accepts pinyin_pick / translate_pick / sentence_cloze', () => {
    for (const t of ['pinyin_pick', 'translate_pick', 'sentence_cloze']) {
      expect(BossQuestionTypeSchema.safeParse(t).success).toBe(true);
    }
    expect(BossQuestionTypeSchema.safeParse('word_match').success).toBe(false);
  });

  it('BossConfigSchema accepts the 6 new boss-able types in questionTypes', () => {
    const ok = BossConfigSchema.parse({
      characterIds: [
        '11111111-2222-4333-a444-555555555555',
        '11111111-2222-4333-a444-555555555556',
      ],
      questionTypes: ['audio_pick', 'pinyin_pick', 'translate_pick', 'sentence_cloze'],
    });
    expect(ok.questionTypes).toHaveLength(4);
  });
});
