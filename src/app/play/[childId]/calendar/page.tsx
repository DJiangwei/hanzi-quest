import { requireChild } from '@/lib/auth/guards';
import { getActivityForRange } from '@/lib/db/activity';
import { getStreakState, todayUtcIso } from '@/lib/db/streaks';
import { MonthCalendar } from '@/components/play/MonthCalendar';

interface PageProps {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ yyyymm?: string }>;
}

function currentYyyyMm(): string {
  return todayUtcIso().slice(0, 7);
}

function monthRange(yyyymm: string): { startIso: string; endIso: string } {
  const [y, m] = yyyymm.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    startIso: `${yyyymm}-01`,
    endIso: `${yyyymm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { childId } = await params;
  const { yyyymm: yyyymmParam } = await searchParams;
  const { child } = await requireChild(childId);

  const yyyymm = /^\d{4}-\d{2}$/.test(yyyymmParam ?? '')
    ? (yyyymmParam as string)
    : currentYyyyMm();
  const { startIso, endIso } = monthRange(yyyymm);

  const [activity, streak] = await Promise.all([
    getActivityForRange(child.id, startIso, endIso),
    getStreakState(child.id),
  ]);

  return (
    <MonthCalendar
      yyyymm={yyyymm}
      activity={activity}
      todayIso={todayUtcIso()}
      streakDays={streak.currentStreak}
      childId={child.id}
    />
  );
}
