import Link from 'next/link';

interface Props {
  childId: string;
  /** Optional coin balance to render alongside the button. */
  coinBalance?: number;
}

/**
 * Persistent shop entry point in the play HUD. Lives on every play surface
 * (island map, level page) so the kid is always one tap away from buying or
 * equipping cosmetics.
 */
export function ShopHudButton({ childId }: Props) {
  return (
    <Link
      href={`/play/${childId}/shop`}
      aria-label="打开商店 / Open shop"
      className="flex items-center gap-1 rounded-full border-2 border-amber-900/40 bg-amber-100 px-3 py-1 text-base font-extrabold text-amber-900 shadow-sm transition hover:scale-105 hover:bg-amber-200 active:scale-100"
      data-testid="shop-hud-button"
    >
      <span className="text-lg leading-none">🛒</span>
      <span className="text-[11px] uppercase tracking-wider">商店 / Shop</span>
    </Link>
  );
}
