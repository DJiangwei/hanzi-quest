// pickStimulusImage — picture resolution for 看图找字 (image_pick).
//
// compile-week.ts now freezes a chosen `wordId` into scene_config
// (docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md).
// pickStimulusImage gains an optional `preferredWordId` so the runtime can
// honour that frozen choice, while still falling back to the old
// "first word with a URL" behaviour for rows compiled before the recompile.
import { describe, expect, it } from 'vitest';
import { pickStimulusImage, type StimulusWord } from '@/lib/scenes/stimulus';

const word = (over: Partial<StimulusWord>): StimulusWord => ({
  id: over.id,
  imageHook: over.imageHook ?? null,
  meaningEn: over.meaningEn ?? null,
  imageUrl: over.imageUrl ?? null,
  ...over,
});

describe('pickStimulusImage', () => {
  it('with no preferredWordId, picks the first word with an imageUrl (unchanged legacy behaviour)', () => {
    const words = [
      word({ id: 'w1', imageUrl: null }),
      word({ id: 'w2', imageUrl: 'https://blob.example/w2.png' }),
      word({ id: 'w3', imageUrl: 'https://blob.example/w3.png' }),
    ];
    expect(pickStimulusImage(words, null).imageUrl).toBe(
      'https://blob.example/w2.png',
    );
  });

  it('honours preferredWordId when it is present in the words list', () => {
    const words = [
      word({ id: 'w1', imageUrl: 'https://blob.example/w1.png' }),
      word({ id: 'w2', imageUrl: 'https://blob.example/w2.png' }),
    ];
    // Legacy behaviour would pick w1 (first with a URL) — preferredWordId
    // must override that and pick w2 instead.
    const result = pickStimulusImage(words, null, 'w2');
    expect(result.imageUrl).toBe('https://blob.example/w2.png');
  });

  it('falls back to legacy "first with URL" behaviour when preferredWordId is not found', () => {
    const words = [
      word({ id: 'w1', imageUrl: 'https://blob.example/w1.png' }),
      word({ id: 'w2', imageUrl: 'https://blob.example/w2.png' }),
    ];
    // 'missing' isn't in the list — a row compiled before the recompile has
    // no wordId at all, so the caller may pass undefined; a stale wordId
    // (word deleted/changed since compile) must degrade the same way.
    const result = pickStimulusImage(words, null, 'missing');
    expect(result.imageUrl).toBe('https://blob.example/w1.png');
  });

  it('falls back to legacy behaviour when preferredWordId is undefined', () => {
    const words = [
      word({ id: 'w1', imageUrl: null }),
      word({ id: 'w2', imageUrl: 'https://blob.example/w2.png' }),
    ];
    const result = pickStimulusImage(words, null, undefined);
    expect(result.imageUrl).toBe('https://blob.example/w2.png');
  });

  it('imageHint still derives from the resolved word, preferred or not', () => {
    const words = [
      word({ id: 'w1', imageUrl: 'https://blob.example/w1.png', imageHook: 'hook-1' }),
      word({ id: 'w2', imageUrl: 'https://blob.example/w2.png', imageHook: 'hook-2' }),
    ];
    expect(pickStimulusImage(words, null, 'w2').imageHint).toBe('hook-2');
  });

  it('returns nulls when words is undefined, regardless of preferredWordId', () => {
    const result = pickStimulusImage(undefined, 'fallback-hook', 'w1');
    expect(result).toEqual({ imageUrl: null, imageHint: 'fallback-hook' });
  });
});
