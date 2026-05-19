import Link from 'next/link';
import type { PackUiMeta } from '@/lib/collections/packRegistry';

interface Props {
  childId: string;
  packSlug: string;
  meta: PackUiMeta;
  ownedCount: number;
  totalCount: number;
}

export function AtlasHallCard({
  childId,
  packSlug,
  meta,
  ownedCount,
  totalCount,
}: Props) {
  const pct = totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
  return (
    <Link
      href={`/play/${childId}/collection/${packSlug}`}
      data-testid={`atlas-hall-${packSlug}`}
      className={`group block rounded-3xl border-2 border-stone-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div
        className={`flex items-start gap-4 rounded-t-[1.4rem] p-5 ${meta.themeBannerClass}`}
      >
        <div className="text-5xl drop-shadow-sm" aria-hidden="true">
          {meta.themeEmoji}
        </div>
        <div className="flex-1">
          <h2
            className={`font-hanzi text-2xl font-extrabold leading-tight ${meta.themeAccentClass}`}
          >
            {meta.displayNameZh}
          </h2>
          <p className={`text-sm font-semibold ${meta.themeAccentClass}`}>
            {meta.displayNameEn}
          </p>
          <p className={`mt-1 text-xs ${meta.themeAccentClass} opacity-80`}>
            {meta.sloganZh}
          </p>
          <p className={`text-[11px] italic ${meta.themeAccentClass} opacity-80`}>
            {meta.sloganEn}
          </p>
        </div>
      </div>
      <div className="rounded-b-[1.4rem] bg-white/90 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div
              className="h-2 overflow-hidden rounded-full bg-stone-200"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${meta.displayNameZh} 进度 ${pct}%`}
            >
              <div
                className={`h-full ${meta.themeBannerClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-xs font-semibold text-stone-700">
              {ownedCount} / {totalCount} ·{' '}
              <span className="text-stone-500">{pct}%</span>
            </div>
          </div>
          <span
            className={`text-sm font-bold ${meta.themeAccentClass} transition group-hover:translate-x-0.5`}
          >
            进入 →
          </span>
        </div>
      </div>
    </Link>
  );
}
