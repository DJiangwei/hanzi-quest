'use client';

import { useCallback } from 'react';

export function useSpeak(): (text: string) => void {
  return useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (synth == null) return;
    try {
      synth.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'zh-CN';
      utt.rate = 0.85;
      synth.speak(utt);
    } catch (err) {
      console.warn('[useSpeak] speak failed:', err);
    }
  }, []);
}
