import Link from 'next/link';
import { ChapterCard } from './ChapterCard';
import type { StoryChapterRow } from '@/lib/db/story';

interface Props {
  childId: string;
  chapters: StoryChapterRow[];
}

export function StoryLibraryGrid({ childId, chapters }: Props) {
  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-stone-50 px-6 py-12 text-center">
        <p className="text-4xl">📖</p>
        <p className="text-base text-stone-700">还没有故事 / No chapters yet</p>
        <p className="text-sm text-stone-500">
          Clear a week&apos;s boss to write your first chapter.
        </p>
      </div>
    );
  }

  // Chapters arrive newest-first from listStoryChaptersForChild; the index
  // is the reverse-saga position, so card N from the top is "chapter total-idx".
  const total = chapters.length;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {chapters.map((c, idx) => (
        <Link
          key={c.id}
          href={`/play/${childId}/story/${c.weekId}`}
          className="block"
        >
          <ChapterCard
            equippedAvatar={undefined}
            pet={null}
            chapterNumber={total - idx}
            tone={c.tone}
          />
        </Link>
      ))}
    </div>
  );
}
