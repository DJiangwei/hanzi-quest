'use client';

import { useSpeechSupported } from '@/lib/hooks/useSpeechSupported';
import { useSpeak, usableAudioUrl } from '@/lib/hooks/useSpeak';

interface SpeakButtonProps {
  text: string;
  /** Pre-recorded clip; preferred over browser TTS when present. */
  audioUrl?: string | null;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center gap-1 rounded-full bg-sky-100 font-medium text-sky-900 hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';
const SIZES: Record<NonNullable<SpeakButtonProps['size']>, string> = {
  sm: 'h-11 w-11 text-base', // ≥44px tap target per spec §5
  md: 'h-11 min-w-11 px-4 text-sm',
};

export function SpeakButton({
  text,
  audioUrl = null,
  size = 'sm',
  label = 'Read aloud',
  className = '',
}: SpeakButtonProps) {
  const supported = useSpeechSupported();
  const speak = useSpeak();

  // Render if EITHER a usable pre-recorded clip exists OR the browser can do
  // TTS. Char clips are not "usable" (filtered to the device voice), so a button
  // backed only by a char clip must hide when TTS is unsupported (else silent).
  if (!supported && !usableAudioUrl(audioUrl)) return null;

  return (
    <button
      type="button"
      onClick={() => speak(text, audioUrl)}
      aria-label={label}
      className={`${BASE} ${SIZES[size]} ${className}`}
    >
      <span aria-hidden>🔊</span>
      {size === 'md' ? <span>{label}</span> : null}
    </button>
  );
}
