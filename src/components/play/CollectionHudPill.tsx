// src/components/play/CollectionHudPill.tsx
import Link from 'next/link';

interface Props {
  childId: string;
  ownedCount: number;
  /** Total collectibles across all active packs. Falls back to "X 个" when undefined. */
  totalCount?: number;
}

export function CollectionHudPill({ childId, ownedCount, totalCount }: Props) {
  return (
    <Link
      href={`/play/${childId}/collection`}
      className="rounded-full bg-[var(--color-treasure-100)] px-3 py-1 text-sm font-bold text-[var(--color-treasure-700)] transition-colors hover:bg-[var(--color-treasure-400)]"
      aria-label={`Open collector's atlas, ${ownedCount}${totalCount ? ` of ${totalCount}` : ''} collected`}
    >
      🎒 {ownedCount}
      {totalCount !== undefined && totalCount > 0 ? `/${totalCount}` : ''}
    </Link>
  );
}
