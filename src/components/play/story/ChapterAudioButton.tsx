'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () =>
  typeof window !== 'undefined' && window.speechSynthesis != null;
const getServerSnapshot = () => false;

export function ChapterAudioButton({ text }: { text: string }) {
  const supported = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!supported) return null;

  const speak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN';
    utt.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  return (
    <button
      type="button"
      onClick={speak}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-200"
      aria-label="Read aloud"
    >
      <span aria-hidden>🔊</span>
      <span>Read aloud</span>
    </button>
  );
}
