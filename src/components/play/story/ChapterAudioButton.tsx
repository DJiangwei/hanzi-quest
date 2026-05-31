'use client';

import { SpeakButton } from '@/components/play/SpeakButton';

export function ChapterAudioButton({ text }: { text: string }) {
  return <SpeakButton text={text} size="md" label="Read aloud" />;
}
