'use client';

import Link from 'next/link';
import type { ActivityDay } from '@/lib/db/activity';
import { FestivalChallengePanel } from './FestivalChallengePanel';

export interface LunarCell {
  dayZh: string;
  emoji: string | null;
  label: string | null;
}

export interface ChallengeProps {
  nameZh: string;
  nameEn: string;
  emoji: string;
  blurbZh: string;
  blurbEn: string;
  activeDays: number;
  threshold: number;
  claimed: boolean;
  eligible: boolean;
}

interface Props {
  yyyymm: string; // "2026-05"
  activity: ActivityDay[];
  todayIso: string;
  streakDays: number;
  childId: string;
  /** Per-day 农历 info, keyed by dateIso (computed server-side). */
  lunar: Record<string, LunarCell>;
  challenge: ChallengeProps;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function leadingPad(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  return dow === 0 ? 6 : dow - 1;
}

function prevMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function iconFor(d: ActivityDay | undefined, isToday: boolean, isFuture: boolean): string {
  if (isToday) return '●';
  if (isFuture) return '·';
  if (!d) return '·';
  if (d.freezeBurned) return '❄️';
  if (d.dailyLoginBonus && !d.played) return '🪙';
  if (d.played) return '⭐';
  return '·';
}

export function MonthCalendar({
  yyyymm,
  activity,
  todayIso,
  streakDays,
  childId,
  lunar,
  challenge,
}: Props) {
  const byDate = new Map(activity.map((d) => [d.dateIso, d]));
  const total = daysInMonth(yyyymm);
  const pad = leadingPad(yyyymm);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 lg:max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          href={`/play/${childId}/calendar?yyyymm=${prevMonth(yyyymm)}`}
          className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold shadow-sm"
          aria-label="prev / 前"
        >
          ← {prevMonth(yyyymm)}
        </Link>
        <h1 className="font-hanzi text-lg font-bold">{yyyymm}</h1>
        <Link
          href={`/play/${childId}/calendar?yyyymm=${nextMonth(yyyymm)}`}
          className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold shadow-sm"
          aria-label="next / 后"
        >
          {nextMonth(yyyymm)} →
        </Link>
      </div>

      <FestivalChallengePanel
        childId={childId}
        yyyymm={yyyymm}
        nameZh={challenge.nameZh}
        nameEn={challenge.nameEn}
        emoji={challenge.emoji}
        blurbZh={challenge.blurbZh}
        blurbEn={challenge.blurbEn}
        activeDays={challenge.activeDays}
        threshold={challenge.threshold}
        claimed={challenge.claimed}
        eligible={challenge.eligible}
      />

      <div className="rounded-2xl bg-[var(--color-treasure-100)] px-4 py-3 text-center text-sm font-bold text-[var(--color-treasure-700)]">
        🔥 Current streak: {streakDays} day{streakDays === 1 ? '' : 's'}
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl bg-white/80 p-3 shadow-sm">
        {DOW.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-bold uppercase text-[var(--color-sand-600)]"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const dom = i + 1;
          const dateIso = `${yyyymm}-${String(dom).padStart(2, '0')}`;
          const d = byDate.get(dateIso);
          const isToday = dateIso === todayIso;
          const isFuture = dateIso > todayIso;
          const lc = lunar[dateIso];
          return (
            <div
              key={dateIso}
              data-testid={`cal-cell-${dateIso}`}
              className={
                isToday
                  ? 'relative flex aspect-square flex-col items-center justify-center rounded-lg bg-[var(--color-treasure-100)] ring-2 ring-[var(--color-treasure-400)]'
                  : isFuture
                    ? 'relative flex aspect-square flex-col items-center justify-center text-[var(--color-sand-300)]'
                    : 'relative flex aspect-square flex-col items-center justify-center'
              }
            >
              {lc?.emoji && (
                <span
                  data-testid={`cal-badge-${dateIso}`}
                  className="absolute right-0 top-0 text-[11px] leading-none"
                  title={lc.label ?? undefined}
                  aria-label={lc.label ?? undefined}
                >
                  {lc.emoji}
                </span>
              )}
              <span className="text-[10px] text-[var(--color-sand-700)]">
                {dom}
              </span>
              <span className="text-sm leading-none">
                {iconFor(d, isToday, isFuture)}
              </span>
              {lc?.dayZh && (
                <span className="font-hanzi text-[8px] leading-none text-[var(--color-sand-500)]">
                  {lc.dayZh}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white/60 px-4 py-2 text-center text-[11px] text-[var(--color-sand-700)]">
        Legend: ⭐ played · 🪙 daily bonus · ❄️ streak saved · ● today · 农历 lunar
      </div>
    </main>
  );
}
