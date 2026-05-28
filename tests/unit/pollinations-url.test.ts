import { describe, expect, it } from 'vitest';
import { buildPollinationsUrl, POLLINATIONS_STYLE_PREAMBLE } from '@/lib/ai/pollinations';

describe('buildPollinationsUrl', () => {
  const wordId = '8b2c3f47-1234-5678-9abc-def012345678';
  const hook = 'a friendly grey elephant with a long trunk raised up';

  it('prepends the style preamble to the imageHook', () => {
    const url = buildPollinationsUrl(hook, wordId);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain(POLLINATIONS_STYLE_PREAMBLE);
    expect(decoded).toContain(hook);
  });

  it('uses the Pollinations prompt endpoint', () => {
    const url = buildPollinationsUrl(hook, wordId);
    expect(url.startsWith('https://image.pollinations.ai/prompt/')).toBe(true);
  });

  it('URL-encodes the prompt (no raw spaces, no literal colons in prompt)', () => {
    const url = buildPollinationsUrl(hook, wordId);
    const promptPart = url.replace('https://image.pollinations.ai/prompt/', '').split('?')[0];
    expect(promptPart).not.toContain(' ');
    expect(promptPart).toContain('%20');
  });

  it('sets the required query params (model=turbo, no enhance — both are paid)', () => {
    const url = new URL(buildPollinationsUrl(hook, wordId));
    expect(url.searchParams.get('model')).toBe('turbo');
    expect(url.searchParams.get('width')).toBe('512');
    expect(url.searchParams.get('height')).toBe('512');
    expect(url.searchParams.get('nologo')).toBe('true');
    expect(url.searchParams.has('enhance')).toBe(false);
  });

  it('seed is deterministic from the wordId prefix', () => {
    const url1 = buildPollinationsUrl(hook, wordId);
    const url2 = buildPollinationsUrl('a totally different hook', wordId);
    const seed1 = new URL(url1).searchParams.get('seed');
    const seed2 = new URL(url2).searchParams.get('seed');
    expect(seed1).toBe(seed2);
    // parseInt of first 8 hex chars of "8b2c3f47" → 2334720839
    expect(seed1).toBe(String(parseInt('8b2c3f47', 16)));
  });

  it('different wordIds produce different seeds', () => {
    const otherId = 'ffffffff-1234-5678-9abc-def012345678';
    const seedA = new URL(buildPollinationsUrl(hook, wordId)).searchParams.get('seed');
    const seedB = new URL(buildPollinationsUrl(hook, otherId)).searchParams.get('seed');
    expect(seedA).not.toBe(seedB);
  });
});
