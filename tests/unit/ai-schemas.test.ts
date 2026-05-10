import { describe, expect, it } from 'vitest';
import { PerCharacterSchema, WeekContentSchemaV1 } from '@/lib/ai/schemas';

const validChar = {
  hanzi: '山',
  pinyin: ['shān'],
  meaningEn: 'mountain',
  meaningZh: '高高的山',
  words: [
    { word: '山水', pinyin: ['shān', 'shuǐ'], meaningEn: 'mountains and rivers' },
    { word: '高山', pinyin: ['gāo', 'shān'], meaningEn: 'tall mountain' },
    { word: '火山', pinyin: ['huǒ', 'shān'], meaningEn: 'volcano' },
  ],
  sentence: {
    text: '我看到一座大山。',
    pinyin: ['wǒ', 'kàn', 'dào', 'yí', 'zuò', 'dà', 'shān'],
    meaningEn: 'I see a big mountain.',
  },
  imageHook: 'a smiling green mountain with three pointed peaks',
};

describe('PerCharacterSchema', () => {
  it('accepts a well-formed entry', () => {
    expect(PerCharacterSchema.parse(validChar)).toBeTruthy();
  });

  it('rejects when words.length !== 3', () => {
    const bad = { ...validChar, words: validChar.words.slice(0, 2) };
    expect(() => PerCharacterSchema.parse(bad)).toThrow();
  });

  it('rejects empty pinyin array', () => {
    const bad = { ...validChar, pinyin: [] };
    expect(() => PerCharacterSchema.parse(bad)).toThrow();
  });

  it('rejects when sentence text is too long', () => {
    const bad = {
      ...validChar,
      sentence: { ...validChar.sentence, text: 'x'.repeat(50) },
    };
    expect(() => PerCharacterSchema.parse(bad)).toThrow();
  });

  it('rejects empty hanzi', () => {
    const bad = { ...validChar, hanzi: '' };
    expect(() => PerCharacterSchema.parse(bad)).toThrow();
  });
});

describe('WeekContentSchemaV1', () => {
  it('parses an array of valid characters', () => {
    const result = WeekContentSchemaV1.parse({
      perCharacter: [validChar, { ...validChar, hanzi: '火' }],
    });
    expect(result.perCharacter).toHaveLength(2);
  });
});
