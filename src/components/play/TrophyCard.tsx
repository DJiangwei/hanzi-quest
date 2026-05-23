import type { TrophyRow } from '@/lib/db/trophies';

interface Props {
  trophy: TrophyRow;
  earned: boolean;
  earnedAt?: Date | null;
}

export function TrophyCard({ trophy, earned, earnedAt }: Props) {
  const dateLabel = earnedAt
    ? new Intl.DateTimeFormat('en-CA').format(earnedAt) // YYYY-MM-DD
    : null;

  return (
    <article
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-amber-700/30 bg-amber-50 p-4 shadow-sm ${
        earned ? '' : 'grayscale opacity-60'
      }`}
    >
      <div className="text-5xl" aria-hidden>
        {trophy.emoji}
      </div>
      <div className="text-center">
        <div className="text-base font-extrabold text-amber-950">{trophy.nameZh}</div>
        <div className="text-sm font-semibold text-amber-900">{trophy.nameEn}</div>
      </div>
      {earned && trophy.loreZh && (
        <p className="text-center text-xs italic text-amber-900/80">
          {trophy.loreZh}
        </p>
      )}
      {earned && trophy.loreEn && (
        <p className="text-center text-[11px] italic text-amber-900/70">
          {trophy.loreEn}
        </p>
      )}
      {!earned && (
        <p className="text-center text-xs text-amber-900/70">
          {trophy.descriptionZh}
          <br />
          <span className="italic">{trophy.descriptionEn}</span>
        </p>
      )}
      {earned && dateLabel && (
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
          {dateLabel}
        </span>
      )}
    </article>
  );
}
