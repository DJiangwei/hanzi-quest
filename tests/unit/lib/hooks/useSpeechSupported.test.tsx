import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpeechSupported } from '@/lib/hooks/useSpeechSupported';

describe('useSpeechSupported', () => {
  let originalSpeech: SpeechSynthesis | undefined;

  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
  });

  afterEach(() => {
    if (originalSpeech === undefined) {
      // delete back to undefined
      // @ts-expect-error test cleanup
      delete window.speechSynthesis;
    } else {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeech,
      });
    }
  });

  it('returns true when speechSynthesis is present', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
    });
    const { result } = renderHook(() => useSpeechSupported());
    expect(result.current).toBe(true);
  });

  it('returns false when speechSynthesis is undefined', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useSpeechSupported());
    expect(result.current).toBe(false);
  });
});
