import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeak } from '@/lib/hooks/useSpeak';

describe('useSpeak', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let speak: ReturnType<typeof vi.fn>;
  let originalSpeech: SpeechSynthesis | undefined;
  let originalUtterance: typeof SpeechSynthesisUtterance | undefined;

  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
    originalUtterance = window.SpeechSynthesisUtterance;
    cancel = vi.fn();
    speak = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    // jsdom does not ship SpeechSynthesisUtterance — provide a minimal stub
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class SpeechSynthesisUtterance {
        text: string;
        lang: string = '';
        rate: number = 1;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });

  afterEach(() => {
    if (originalSpeech !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeech,
      });
    }
    if (originalUtterance !== undefined) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: originalUtterance,
      });
    }
  });

  it('cancels in-flight speech before speaking', () => {
    const { result } = renderHook(() => useSpeak());
    act(() => result.current('妈'));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      speak.mock.invocationCallOrder[0],
    );
  });

  it('builds an utterance with lang=zh-CN and rate=0.85', () => {
    const { result } = renderHook(() => useSpeak());
    act(() => result.current('妈'));
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('妈');
    expect(utt.lang).toBe('zh-CN');
    expect(utt.rate).toBe(0.85);
  });

  it('is a no-op when speechSynthesis is undefined', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useSpeak());
    expect(() => act(() => result.current('妈'))).not.toThrow();
    expect(speak).not.toHaveBeenCalled();
  });
});
