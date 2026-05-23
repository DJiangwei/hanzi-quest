'use client';

import { useEffect } from 'react';
import { setAudioTheme } from '@/lib/audio/play';

interface Props {
  themeSlug: string | null;
}

export function SoundThemeBootstrap({ themeSlug }: Props) {
  useEffect(() => {
    setAudioTheme(themeSlug);
  }, [themeSlug]);
  return null;
}
