'use client';

import { useEffect } from 'react';
import { markChapterReadAction } from '@/lib/actions/story';

interface Props {
  chapterId: string;
  childId: string;
  shouldMark: boolean;
}

export function MarkChapterReadOnMount({
  chapterId,
  childId,
  shouldMark,
}: Props) {
  useEffect(() => {
    if (!shouldMark) return;
    markChapterReadAction({ chapterId, childId }).catch(() => {
      // Non-fatal — pill will simply remain on next load.
    });
  }, [chapterId, childId, shouldMark]);
  return null;
}
