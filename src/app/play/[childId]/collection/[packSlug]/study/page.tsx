import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug, listChildCollection, listPackItems } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { StudyRunner } from '@/components/play/StudyRunner';
import { buildStudyLesson, STUDY_MIN_OWNED, type StudyCardLite } from '@/lib/play/study';

interface PageProps {
  params: Promise<{ childId: string; packSlug: string }>;
}

export default async function StudyPage({ params }: PageProps) {
  const { childId, packSlug } = await params;
  await requireChild(childId);

  const pack = await getPackBySlug(packSlug);
  const meta = getPackMeta(packSlug);
  if (!pack || !meta) notFound();

  const [owned, allItems] = await Promise.all([
    listChildCollection(childId, pack.id),
    listPackItems(pack.id),
  ]);

  if (owned.length < STUDY_MIN_OWNED) {
    redirect(`/play/${childId}/collection/${packSlug}`);
  }

  const toLite = (i: { id: string; slug: string; nameZh: string; nameEn: string; imageUrl: string | null }): StudyCardLite => ({
    id: i.id,
    slug: i.slug,
    nameZh: i.nameZh,
    nameEn: i.nameEn,
    imageUrl: i.imageUrl,
  });

  const questions = buildStudyLesson(owned.map(toLite), allItems.map(toLite));

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <StudyRunner
        childId={childId}
        packSlug={packSlug}
        packNameZh={meta.displayNameZh}
        packNameEn={meta.displayNameEn}
        questions={questions}
      />
    </main>
  );
}
