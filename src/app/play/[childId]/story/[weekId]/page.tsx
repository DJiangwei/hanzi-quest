import Link from 'next/link';
import { requireChild } from '@/lib/auth/guards';
import { generateStoryChapter } from '@/lib/actions/story';
import {
  getStoryChapterByWeek,
  listStoryChaptersForChild,
  type StoryChapterRow,
} from '@/lib/db/story';
import { getEquippedAvatar } from '@/lib/db/shop';
import { getEquippedPet } from '@/lib/db/pets';
import { ChapterCard } from '@/components/play/story/ChapterCard';
import { ChapterBody } from '@/components/play/story/ChapterBody';
import { MarkChapterReadOnMount } from '@/components/play/MarkChapterReadOnMount';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

async function loadChapter(
  childId: string,
  weekId: string,
): Promise<{ chapter: StoryChapterRow } | { error: string }> {
  const existing = await getStoryChapterByWeek(childId, weekId);
  if (existing) return { chapter: existing };
  try {
    const chapter = await generateStoryChapter({ childId, weekId });
    return { chapter };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : 'Story generation failed.',
    };
  }
}

export default async function StoryChapterPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  const { child } = await requireChild(childId);

  const result = await loadChapter(child.id, weekId);

  if ('error' in result) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-8 text-center">
        <Link
          href={`/play/${child.id}`}
          className="self-start text-sm text-stone-600 hover:text-stone-900"
        >
          ← 回家
        </Link>
        <div className="rounded-3xl bg-rose-50 px-6 py-6">
          <p className="text-lg font-medium text-rose-800">
            📖 Story could not be written this time.
          </p>
          <p className="mt-2 text-sm text-rose-700">{result.error}</p>
          <Link
            href={`/play/${child.id}/story/${weekId}`}
            className="mt-4 inline-block rounded-full bg-rose-600 px-4 py-2 text-white"
          >
            再试一次 / Try again
          </Link>
        </div>
      </main>
    );
  }

  const { chapter } = result;
  const allChapters = await listStoryChaptersForChild(child.id);
  const idx = allChapters.findIndex((c) => c.id === chapter.id);
  const chapterNumber =
    idx === -1 ? allChapters.length + 1 : allChapters.length - idx;

  const [rawAvatar, pet] = await Promise.all([
    getEquippedAvatar(child.id),
    getEquippedPet(child.id),
  ]);

  // ChapterCard expects { slot: unlockRef-string }. Flatten the SlotEquip
  // objects returned by getEquippedAvatar.
  const equippedAvatar = Object.fromEntries(
    Object.entries(rawAvatar ?? {}).map(([slot, equip]) => [
      slot,
      equip?.unlockRef ?? null,
    ]),
  );

  // Pet field projection — PetRow is wider than ChapterPet, narrow explicitly
  // to keep the contract obvious.
  const petForCard = pet
    ? {
        emoji: pet.emoji,
        nameZh: pet.nameZh,
        nameEn: pet.nameEn,
        speechZh: pet.speechZh,
        speechEn: pet.speechEn,
      }
    : null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <Link
        href={`/play/${child.id}`}
        className="self-start text-sm text-stone-600 hover:text-stone-900"
      >
        ← 回家
      </Link>
      <ChapterCard
        equippedAvatar={equippedAvatar}
        pet={petForCard}
        chapterNumber={chapterNumber}
        tone={chapter.tone}
      />
      <ChapterBody bodyZh={chapter.bodyZh} bodyEn={chapter.bodyEn} />
      <Link
        href={`/play/${child.id}`}
        className="self-center rounded-full bg-amber-600 px-6 py-2 text-white shadow"
      >
        回家
      </Link>
      <MarkChapterReadOnMount
        chapterId={chapter.id}
        childId={child.id}
        shouldMark={chapter.readAt === null}
      />
    </main>
  );
}
