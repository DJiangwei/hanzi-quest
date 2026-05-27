import Link from 'next/link';

interface Props {
  childId: string;
  currentMap: { nameZh: string; nameEn: string } | null;
}

export function MapHeaderPill({ childId, currentMap }: Props) {
  if (!currentMap) return null;
  return (
    <Link
      href={`/play/${childId}/maps`}
      className="inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-[var(--color-ocean-100)] px-3 py-1 text-sm font-bold text-[var(--color-ocean-700)] shadow-sm transition-colors hover:bg-[var(--color-ocean-200)]"
      aria-label="open nautical charts"
    >
      <span aria-hidden>📍</span>
      <span className="font-hanzi">{currentMap.nameZh}</span>
      <span className="text-xs opacity-70">/ {currentMap.nameEn}</span>
      <span aria-hidden>⬇</span>
    </Link>
  );
}
