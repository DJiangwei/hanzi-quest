import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild, getWeekGateState } from '@/lib/db/weeks';
import { getSectionStatsForChild } from '@/lib/db/play';
import { listHomeworkItems } from '@/lib/db/homework';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';
import { WeekHub } from '@/components/play/WeekHub';
import { isPiggyEnabled } from '@/lib/db/piggy';
import { PIGGY_BOSS_CLEAR_PENCE } from '@/lib/piggy/rates';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function WeekHubPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  await requireChild(childId);

  const week = await getPlayableWeekForChild(childId, weekId);
  if (!week) notFound();

  const [stats, homeworkItems, gate, piggyEnabled] = await Promise.all([
    getSectionStatsForChild(childId, weekId),
    listHomeworkItems(childId, weekId),
    getWeekGateState(childId, weekId),
    isPiggyEnabled(childId),
  ]);

  // T3 linear gating — server-authoritative. A locked island must not be
  // reachable by typing the URL, so bounce back to the voyage board rather
  // than rendering a hub the kid can't play.
  if (!gate.isUnlocked) redirect(`/play/${childId}`);

  const bossLocked = stats.practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD;
  const piggyPence = piggyEnabled ? PIGGY_BOSS_CLEAR_PENCE : undefined;

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
      frontier={gate.isFrontier}
      keys={{ earned: gate.keysEarned, total: gate.keysTotal }}
      piggyPence={piggyPence}
    />
  );
}
