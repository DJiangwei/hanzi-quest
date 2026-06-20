import { describe, expect, it } from 'vitest';
import { usableAudioUrl } from '@/lib/hooks/useSpeak';

const BLOB = 'https://mfl7ap4djy0w98ey.public.blob.vercel-storage.com';

describe('usableAudioUrl — all MeloTTS clips fall back to the device voice', () => {
  it('filters out single-character clips (audio/chars/…) → null (use TTS)', () => {
    expect(usableAudioUrl(`${BLOB}/audio/chars/abc-123.mp3`)).toBeNull();
  });

  it('filters out word clips (audio/words/…) → null (use TTS)', () => {
    // MeloTTS word clips were found mispronounced too — disabled like char clips.
    expect(usableAudioUrl(`${BLOB}/audio/words/def-456.mp3`)).toBeNull();
  });

  it('returns null for null / undefined / empty', () => {
    expect(usableAudioUrl(null)).toBeNull();
    expect(usableAudioUrl(undefined)).toBeNull();
    expect(usableAudioUrl('')).toBeNull();
  });

  it('passes through a future-provider clip on a different path unchanged', () => {
    // Only the bad MeloTTS paths are filtered; a verified provider on a new path
    // (e.g. audio/v2/…) must still play.
    const url = `${BLOB}/audio/v2/zh/hello.mp3`;
    expect(usableAudioUrl(url)).toBe(url);
  });

  it('passes through an unrelated external clip URL unchanged', () => {
    const url = 'https://example.com/tts/zh/hello.mp3';
    expect(usableAudioUrl(url)).toBe(url);
  });
});
