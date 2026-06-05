'use client';

import Link from 'next/link';
import type { ActivityDay } from '@/lib/db/activity';

interface Props {
  /** Exactly 7 days, oldest first. */
  activity: ActivityDay[];
  todayIso: string;
  childId: string;
  /** Number of check-in days this week. When provided, renders a gift-progress hint. */
  checkInDays?: number;
}

const DOW_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iconFor(day: ActivityDay, isToday: boolean, isFuture: boolean): string {
  if (isToday) return '●';
  if (isFuture) return '·';
  if (day.freezeBurned) return '❄️';
  if (day.dailyLoginBonus && !day.played) return '🪙';
  if (day.played) return '⭐';
  return '·';
}

export function WeekStrip({ activity, todayIso, childId, checkInDays }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <Link
        href={`/play/${childId}/calendar`}
        className="flex items-stretch justify-between gap-1 rounded-2xl border border-[var(--color-sand-200)] bg-white/80 px-2 py-2 shadow-sm transition-colors hover:bg-white"
        aria-label="Open calendar"
      >
        {activity.map((d, idx) => {
          const isToday = d.dateIso === todayIso;
          const isFuture = d.dateIso > todayIso;
          const icon = iconFor(d, isToday, isFuture);
          return (
            <div
              key={d.dateIso}
              data-testid={`week-strip-pill-${idx}`}
              data-day-iso={d.dateIso}
              className={
                isToday
                  ? 'flex flex-1 flex-col items-center rounded-xl bg-[var(--color-treasure-100)] py-1 ring-2 ring-[var(--color-treasure-400)]'
                  : 'flex flex-1 flex-col items-center py-1'
              }
            >
              <span className="text-[10px] font-semibold uppercase text-[var(--color-sand-600)]">
                {DOW_LABELS_EN[idx]}
              </span>
              <span className="text-lg leading-tight">{icon}</span>
              <span className="text-[10px] text-[var(--color-sand-700)]">
                {d.dateIso.slice(-2)}
              </span>
            </div>
          );
        })}
      </Link>
      {checkInDays != null && (
        <p
          data-testid="gift-progress"
          className="text-center text-[11px] font-semibold text-[var(--color-treasure-700)]"
        >
          {checkInDays >= 5
            ? '🎁 大礼包已达成 / Weekly gift unlocked'
            : `🎁 本周签到 ${Math.min(checkInDays, 5)}/5`}
        </p>
      )}
    </div>
  );
}
