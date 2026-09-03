import Link from 'next/link';

interface Props {
  childId: string;
  /** False when the child has fewer than REVIEW_SESSION_SIZE candidates. */
  available: boolean;
}

/**
 * Home entry to 温故. Hidden entirely when there is too little cleared
 * material — an entry point to an empty session is worse than none.
 *
 * Deliberately carries NO streak, day counter or score. 温故 gates nothing and
 * must not acquire pressure: this product softens 畏难情绪 elsewhere on purpose
 * (boss_courage pays on a failed boss; retries keep progress), and a
 * don't-break-the-chain counter here would undo that.
 */
export function DailyReviewCard({ childId, available }: Props) {
  if (!available) return null;

  return (
    <Link
      href={`/play/${childId}/review`}
      data-testid="daily-review-card"
      className="flex items-center justify-between rounded-2xl border-2 border-[var(--color-ocean-200)] bg-white/80 px-4 py-3 shadow-sm transition hover:border-[var(--color-ocean-300)]"
    >
      <span className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          📜
        </span>
        <span className="leading-tight">
          <span className="font-hanzi block font-bold text-[var(--color-ocean-900)]">
            温故
          </span>
          <span className="block text-[11px] italic text-[var(--color-sand-700)]">
            Review old friends
          </span>
        </span>
      </span>
      <span className="text-xs text-[var(--color-sand-600)]" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
