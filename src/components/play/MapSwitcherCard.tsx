import Link from 'next/link';
import { getMapAccent } from '@/lib/play/map-boards';

interface Props {
  childId: string;
  currentMap: { slug: string; nameZh: string; nameEn: string } | null;
}

/**
 * The way into 航海图 / Nautical Charts, from the top of home.
 *
 * This used to be a small pill reading `📍 加勒比海 / Caribbean Sea ⬇`, and it
 * failed for a reason worth writing down: it was shaped like a STATUS BADGE.
 * Every other pill on this page — coins, level, champion title — reports a fact
 * and does nothing when tapped, so a pill that happens to be a link reads as
 * one more fact. David watched the child still have to hunt for where to change
 * seas. A control has to be shaped like a control and say what it does; naming
 * the destination ("换海域 / Switch sea") is the part the badge was missing,
 * not the colour or the size.
 *
 * Kept at the top of the HUD column rather than moved down beside the board:
 * on a phone the map pane sits below the whole HUD stack, so associating it
 * with the board would have bought recognition at the cost of being off-screen.
 */
export function MapSwitcherCard({ childId, currentMap }: Props) {
  if (!currentMap) return null;
  const accent = getMapAccent(currentMap.slug);
  return (
    <Link
      href={`/play/${childId}/maps`}
      data-testid="map-switcher"
      style={{ backgroundColor: accent.pillBg, borderColor: accent.cardBorder }}
      className="flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 shadow-md transition-transform active:scale-[0.98] hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-label={`换海域 / Switch sea — currently ${currentMap.nameEn}`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70 text-2xl shadow-inner"
        aria-hidden
      >
        🗺️
      </span>
      <span className="min-w-0 flex-1" style={{ color: accent.pillText }}>
        <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">
          <span className="font-hanzi">当前海域</span> / Current sea
        </span>
        <span className="font-hanzi block truncate text-lg font-extrabold leading-tight">
          {currentMap.nameZh}
        </span>
        <span className="block truncate text-xs font-semibold opacity-75">
          {currentMap.nameEn}
        </span>
      </span>
      {/* The whole point of the redesign: the action, named, on the control. */}
      <span
        className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-center text-xs font-extrabold shadow-sm"
        style={{ color: accent.pillText }}
      >
        <span>
          <span className="font-hanzi block leading-tight">换海域</span>
          <span className="block text-[10px] font-bold leading-tight opacity-70">Switch</span>
        </span>
        <span aria-hidden className="text-base">›</span>
      </span>
    </Link>
  );
}
