import { describe, expect, it } from 'vitest';
import { ImageWordConfigSchema } from '@/lib/scenes/configs';

describe('ImageWordConfigSchema', () => {
  const validConfig = {
    characterId: '11111111-2222-4333-a444-555555555551',
    wordId: '11111111-2222-4333-a444-555555555552',
    distractorWordIds: [
      '11111111-2222-4333-a444-555555555553',
      '11111111-2222-4333-a444-555555555554',
      '11111111-2222-4333-a444-555555555555',
    ],
    segment: 'sight',
  };

  it('parses a valid config', () => {
    expect(() => ImageWordConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('rejects when distractorWordIds is missing', () => {
    const { distractorWordIds: _d, ...rest } = validConfig;
    expect(() => ImageWordConfigSchema.parse(rest)).toThrow();
  });

  it('rejects when distractorWordIds length != 3', () => {
    expect(() =>
      ImageWordConfigSchema.parse({ ...validConfig, distractorWordIds: validConfig.distractorWordIds.slice(0, 2) }),
    ).toThrow();
    expect(() =>
      ImageWordConfigSchema.parse({
        ...validConfig,
        distractorWordIds: [...validConfig.distractorWordIds, '11111111-2222-4333-a444-555555555556'],
      }),
    ).toThrow();
  });
});
