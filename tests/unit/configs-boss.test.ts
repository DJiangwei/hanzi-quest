// tests/unit/configs-boss.test.ts
import { describe, expect, it } from 'vitest';
import { BossConfigSchema } from '@/lib/scenes/configs';

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
