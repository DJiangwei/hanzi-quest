import { describe, expect, it } from 'vitest';
import { parseHomeworkConfig } from '@/lib/homework/schemas';

describe('parseHomeworkConfig', () => {
  it('parses a valid char_quiz', () => {
    const cfg = parseHomeworkConfig('char_quiz', {
      hanzi: '水',
      questionZh: '「水」是什么意思？',
      options: [
        { textZh: '水', textEn: 'water' },
        { textZh: '火', textEn: 'fire' },
      ],
      correctIndex: 0,
    });
    expect(cfg.type).toBe('char_quiz');
  });

  it('rejects a char_quiz whose correctIndex is out of range', () => {
    expect(() =>
      parseHomeworkConfig('char_quiz', {
        questionZh: 'q',
        options: [{ textZh: 'a', textEn: 'a' }],
        correctIndex: 5,
      }),
    ).toThrow();
  });

  it('parses word_building + sentence_order', () => {
    expect(
      parseHomeworkConfig('word_building', {
        baseChar: '水',
        correctWord: '喝水',
        distractors: ['火车', '吃饭'],
      }).type,
    ).toBe('word_building');
    expect(
      parseHomeworkConfig('sentence_order', {
        tokens: ['我', '喝', '水'],
      }).type,
    ).toBe('sentence_order');
  });

  it('rejects sentence_order with fewer than 2 tokens', () => {
    expect(() => parseHomeworkConfig('sentence_order', { tokens: ['我'] })).toThrow();
  });
});
