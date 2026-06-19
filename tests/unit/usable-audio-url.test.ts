import { describe, expect, it } from 'vitest';
import { usableAudioUrl } from '@/lib/hooks/useSpeak';

const BLOB = 'https://mfl7ap4djy0w98ey.public.blob.vercel-storage.com';

describe('usableAudioUrl — character clips fall back to the device voice', () => {
  it('filters out single-character clips (audio/chars/…) → null (use TTS)', () => {
    expect(usableAudioUrl(`${BLOB}/audio/chars/abc-123.mp3`)).toBeNull();
  });

  it('keeps word clips (audio/words/…)', () => {
    const url = `${BLOB}/audio/words/def-456.mp3`;
    expect(usableAudioUrl(url)).toBe(url);
  });

  it('returns null for null / undefined / empty', () => {
    expect(usableAudioUrl(null)).toBeNull();
    expect(usableAudioUrl(undefined)).toBeNull();
    expect(usableAudioUrl('')).toBeNull();
  });

  it('passes through an unrelated (future-provider) clip URL unchanged', () => {
    const url = 'https://example.com/tts/zh/hello.mp3';
    expect(usableAudioUrl(url)).toBe(url);
  });
});
