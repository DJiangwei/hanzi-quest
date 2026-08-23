import { describe, expect, it } from 'vitest';
import { ImagePickConfigSchema } from '@/lib/scenes/configs';

// image_pick starts compiling its chosen wordId (the stimulus-validity fix,
// docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md) —
// mirroring image_word, which has done this since PR #42. wordId MUST stay
// optional: rows compiled before the post-merge recompile have no wordId at
// all, and they need to keep validating until that recompile runs.
describe('ImagePickConfigSchema', () => {
  const validConfig = {
    characterId: '11111111-2222-4333-a444-555555555551',
    wordId: '11111111-2222-4333-a444-555555555552',
    segment: 'sight',
  };

  it('parses a valid config with wordId', () => {
    expect(() => ImagePickConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('parses a config with NO wordId — the pre-recompile compatibility case', () => {
    const withoutWordId: Partial<typeof validConfig> = { ...validConfig };
    delete withoutWordId.wordId;
    expect(() => ImagePickConfigSchema.parse(withoutWordId)).not.toThrow();
    const parsed = ImagePickConfigSchema.parse(withoutWordId);
    expect(parsed.wordId).toBeUndefined();
  });

  it('rejects a wordId that is not a UUID', () => {
    expect(() =>
      ImagePickConfigSchema.parse({ ...validConfig, wordId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('still requires characterId', () => {
    const rest: Partial<typeof validConfig> = { ...validConfig };
    delete rest.characterId;
    expect(() => ImagePickConfigSchema.parse(rest)).toThrow();
  });
});
