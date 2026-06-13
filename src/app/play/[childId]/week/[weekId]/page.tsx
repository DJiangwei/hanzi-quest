import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { getSectionStatsForChild } from '@/lib/db/play';
import { listHomeworkItems } from '@/lib/db/homework';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';
import { WeekHub } from '@/components/play/WeekHub';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function WeekHubPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  await requireChild(childId);

  const week = await getPlayableWeekForChild(childId, weekId);
  if (!week) notFound();

  const [stats, homeworkItems] = await Promise.all([
    getSectionStatsForChild(childId, weekId),
    listHomeworkItems(childId, weekId),
  ]);
  const bossLocked = stats.practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD;

  return (
    <WeekHub
      childId={childId}
      weekId={weekId}
      week={{ id: week.id, weekNumber: week.weekNumber, label: week.label }}
      sections={{
        review: stats.review,
        practice: stats.practice,
        boss: { ...stats.boss, locked: bossLocked },
      }}
      homework={{ present: homeworkItems.length > 0, doneToday: false, count: homeworkItems.length }}
    />
  );
}
