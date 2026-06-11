'use client';

import { listSurfaces, type SurfaceKind } from '@/lib/home/surfaces';

interface Props {
  /** Buyable surface slugs the kid owns (defaults are always available). */
  ownedSurfaceSlugs: string[];
  wallpaperSlug: string;
  floorSlug: string;
  onSelect: (kind: SurfaceKind, slug: string) => void;
}

/**
 * Per-room wallpaper + floor picker. Lists every default surface plus the ones
 * the kid has bought, as tappable swatches; the equipped one is ringed.
 * Bilingual labels per the locked rule.
 */
export function SurfacePicker({
  ownedSurfaceSlugs,
  wallpaperSlug,
  floorSlug,
  onSelect,
}: Props) {
  const owned = new Set(ownedSurfaceSlugs);

  function row(
    kind: SurfaceKind,
    equipped: string,
    labelZh: string,
    labelEn: string,
    icon: string,
  ) {
    const items = listSurfaces(kind).filter((s) => s.isDefault || owned.has(s.slug));
    // Swatch shows only this surface's zone of the 100×75 room.
    const vb = kind === 'wallpaper' ? '0 0 100 25' : '0 25 100 50';
    return (
      <div>
        <div className="mb-1 text-xs font-bold text-[var(--color-sand-700)]">
          {icon} {labelZh} / {labelEn}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label={`${labelEn} options`}>
          {items.map((s) => {
            const active = s.slug === equipped;
            return (
              <button
                key={s.slug}
                role="option"
                aria-selected={active}
                data-testid={`surface-${s.slug}`}
                onClick={() => onSelect(kind, s.slug)}
                className={[
                  'flex min-h-[44px] w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 p-1 transition-colors',
                  active
                    ? 'border-[var(--color-treasure-500)] bg-[var(--color-treasure-50)] shadow-md'
                    : 'border-[var(--color-sand-200)] bg-white/80 hover:bg-white',
                ].join(' ')}
              >
                <svg viewBox={vb} className="h-7 w-full rounded" preserveAspectRatio="none" aria-hidden>
                  {s.render()}
                </svg>
                <span className="text-center text-[8px] font-hanzi leading-tight">{s.nameZh}</span>
                <span className="text-center text-[7px] leading-tight text-[var(--color-sand-600)]">
                  {s.nameEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/50 p-2">
      {row('wallpaper', wallpaperSlug, '墙纸', 'Wallpaper', '🖼️')}
      {row('floor', floorSlug, '地板', 'Floor', '🪵')}
    </div>
  );
}
