// src/components/play/CollectionHudPill.tsx
import Link from 'next/link';

interface Props {
  childId: string;
  ownedCount: number;
}

export function CollectionHudPill({ childId, ownedCount }: Props) {
  return (
    <Link
      href={`/play/${childId}/collection`}
      className="rounded-full bg-[var(--color-treasure-100)] px-3 py-1 text-sm font-bold text-[var(--color-treasure-700)] transition-colors hover:bg-[var(--color-treasure-400)]"
    >
      🎒 {ownedCount}/12
    </Link>
  );
}
