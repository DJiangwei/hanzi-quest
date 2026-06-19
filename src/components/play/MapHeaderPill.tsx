import Link from 'next/link';
import { getMapAccent } from '@/lib/play/map-boards';

interface Props {
  childId: string;
  currentMap: { slug: string; nameZh: string; nameEn: string } | null;
}

export function MapHeaderPill({ childId, currentMap }: Props) {
  if (!currentMap) return null;
  const accent = getMapAccent(currentMap.slug);
  return (
    <Link
      href={`/play/${childId}/maps`}
      style={{ backgroundColor: accent.pillBg, color: accent.pillText }}
      className="inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3 py-1 text-sm font-bold shadow-sm transition-[filter] hover:brightness-95"
      aria-label="open nautical charts"
    >
      <span aria-hidden>📍</span>
      <span className="font-hanzi">{currentMap.nameZh}</span>
      <span className="text-xs opacity-70">/ {currentMap.nameEn}</span>
      <span aria-hidden>⬇</span>
    </Link>
  );
}
