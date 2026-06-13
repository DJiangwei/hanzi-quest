import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { listHomeworkItems } from '@/lib/db/homework';
import { parseHomeworkConfig } from '@/lib/homework/schemas';
import { HomeworkRunner } from '@/components/homework/HomeworkRunner';
import { MidSceneFlag } from '@/components/play/MidSceneProvider';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function HomeworkPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  const { child } = await requireChild(childId);
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) notFound();

  const rows = await listHomeworkItems(child.id, weekId);
  if (rows.length === 0) notFound();

  // Validate + narrow each config; skip any that fail (defensive).
  const items = rows.flatMap((r) => {
    try {
      return [{ id: r.id, type: r.type, config: parseHomeworkConfig(r.type, r.config) }];
    } catch {
      return [];
    }
  });
  if (items.length === 0) notFound();

  return (
    <>
      <MidSceneFlag />
      <HomeworkRunner childId={child.id} weekId={week.id} weekLabel={week.label} items={items} />
    </>
  );
}
