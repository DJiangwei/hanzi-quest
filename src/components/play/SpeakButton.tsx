'use client';

import { useSpeechSupported } from '@/lib/hooks/useSpeechSupported';
import { useSpeak } from '@/lib/hooks/useSpeak';

interface SpeakButtonProps {
  text: string;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center gap-1 rounded-full bg-amber-100 font-medium text-amber-900 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2';
const SIZES: Record<NonNullable<SpeakButtonProps['size']>, string> = {
  sm: 'h-11 w-11 text-base', // ≥44px tap target per spec §5
  md: 'h-11 min-w-11 px-4 text-sm',
};

export function SpeakButton({
  text,
  size = 'sm',
  label = 'Read aloud',
  className = '',
}: SpeakButtonProps) {
  const supported = useSpeechSupported();
  const speak = useSpeak();

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={label}
      className={`${BASE} ${SIZES[size]} ${className}`}
    >
      <span aria-hidden>🔊</span>
      {size === 'md' ? <span>{label}</span> : null}
    </button>
  );
}
