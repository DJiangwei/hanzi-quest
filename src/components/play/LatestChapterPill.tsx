import Link from 'next/link';
import { getLatestUnreadChapter } from '@/lib/db/story';

interface Props {
  childId: string;
}

export async function LatestChapterPill({ childId }: Props) {
  const chapter = await getLatestUnreadChapter(childId);
  if (!chapter) return null;
  return (
    <Link
      href={`/play/${childId}/story/${chapter.weekId}`}
      className="block rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-md transition hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            📖 你最新的故事
          </p>
          <p className="text-xs text-amber-800/80">
            Captain Yinuo&apos;s latest chapter
          </p>
        </div>
        <span aria-hidden className="text-2xl">
          →
        </span>
      </div>
    </Link>
  );
}
