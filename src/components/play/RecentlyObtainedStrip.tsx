import Link from 'next/link';
import type { RecentItem } from '@/lib/db/recent-obtained';

interface Props {
  items: RecentItem[];
  /** Server-computed reference time for the "NEW" sticker cutoff. */
  nowMs: number;
}

const ONE_DAY_MS = 24 * 3600 * 1000;

export function RecentlyObtainedStrip({ items, nowMs }: Props) {
  if (items.length === 0) return null;
  return (
    <section
      className="rounded-2xl border border-[var(--color-sand-200)] bg-white/80 p-3 shadow-sm"
      data-testid="recently-obtained-strip"
    >
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        最近获得 · Recently Obtained
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, idx) => {
          const isNew = nowMs - item.obtainedAt.getTime() < ONE_DAY_MS;
          return (
            <Link
              key={`${item.kind}-${item.nameZh}-${idx}`}
              href={item.href}
              className="relative flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border border-[var(--color-sand-200)] bg-white px-2 py-2 shadow-sm transition-transform active:scale-95"
            >
              {isNew && (
                <span className="absolute -right-1 -top-1 rounded-full bg-[var(--color-sunset-500)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                  新 NEW
                </span>
              )}
              <span className="text-2xl leading-none">{item.displayEmoji}</span>
              <span className="text-center text-[10px] leading-tight text-[var(--color-ocean-900)]">
                {item.nameZh}
              </span>
              <span className="text-center text-[10px] leading-tight text-[var(--color-sand-700)]">
                {item.nameEn}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
