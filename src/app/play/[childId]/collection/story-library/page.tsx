import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { listStoryChaptersForChild } from '@/lib/db/story';
import { StoryLibraryGrid } from '@/components/play/story/StoryLibraryGrid';

/** Story mode hidden 2026-06-13 (ZH text quality). Flip to false to re-enable. */
const STORY_HIDDEN = true;

export default async function StoryLibraryPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  if (STORY_HIDDEN) notFound();
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const chapters = await listStoryChaptersForChild(child.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/play/${child.id}/collection`}
        className="text-sm text-stone-600 hover:text-stone-900"
      >
        ← 背包 / Bag
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-amber-900">
        📖 Story Library / 故事书
      </h1>
      <p className="text-sm text-stone-600">
        每周通关 boss 都会写下新的一章。/ Clear each week’s boss to unlock a new chapter.
      </p>
      <div className="mt-6">
        <StoryLibraryGrid childId={child.id} chapters={chapters} />
      </div>
    </main>
  );
}
