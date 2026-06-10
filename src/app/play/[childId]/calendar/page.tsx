import { requireChild } from '@/lib/auth/guards';
import { getActivityForRange } from '@/lib/db/activity';
import { getStreakState, todayUtcIso } from '@/lib/db/streaks';
import { MonthCalendar, type LunarCell } from '@/components/play/MonthCalendar';
import { lunarInfo } from '@/lib/calendar/lunar';
import { getMonthlyChallengeState } from '@/lib/db/festival-challenge';

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

  const [activity, streak, challengeState] = await Promise.all([
    getActivityForRange(child.id, startIso, endIso),
    getStreakState(child.id),
    getMonthlyChallengeState(child.id, yyyymm),
  ]);

  // 农历 info per day, computed server-side (keeps lunar-typescript off the
  // client bundle). Keyed by dateIso.
  const [year, month] = yyyymm.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lunar: Record<string, LunarCell> = {};
  for (let dom = 1; dom <= lastDay; dom++) {
    const iso = `${yyyymm}-${String(dom).padStart(2, '0')}`;
    const info = lunarInfo(iso);
    lunar[iso] = { dayZh: info.dayZh, emoji: info.emoji, label: info.label };
  }

  const { theme } = challengeState;

  return (
    <MonthCalendar
      yyyymm={yyyymm}
      activity={activity}
      todayIso={todayUtcIso()}
      streakDays={streak.currentStreak}
      childId={child.id}
      lunar={lunar}
      challenge={{
        nameZh: theme.nameZh,
        nameEn: theme.nameEn,
        emoji: theme.emoji,
        blurbZh: theme.blurbZh,
        blurbEn: theme.blurbEn,
        activeDays: challengeState.activeDays,
        threshold: challengeState.threshold,
        claimed: challengeState.claimed,
        eligible: challengeState.eligible,
      }}
    />
  );
}
