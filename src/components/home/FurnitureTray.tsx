'use client';

import { getFurniture } from '@/lib/home/furniture-catalog';

export interface TrayItem {
  slug: string;
  /** Spare (owned − placed) copies of this slug — always ≥ 1 in the tray. */
  count: number;
}

interface Props {
  /** Owned-but-unplaced furniture, one entry per slug with a spare count. */
  items: TrayItem[];
  /** Currently tapped slug (null = nothing selected). */
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

/**
 * Horizontal scrollable tray of owned-but-unplaced furniture items.
 * Tap a chip to select it for placement on the canvas. Multi-buy copies
 * collapse into one chip with a ×N badge.
 * Each chip is ≥44px tall to satisfy touch-target requirements.
 */
export function FurnitureTray({ items, selectedSlug, onSelect }: Props) {
  return (
    <div
      data-testid="furniture-tray"
      className="flex gap-2 overflow-x-auto pb-1"
      role="listbox"
      aria-label="Furniture to place"
    >
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-[var(--color-sand-600)]">
          全部已摆放 / All placed
        </p>
      ) : (
        items.map(({ slug, count }) => {
          const def = getFurniture(slug);
          if (!def) return null;
          const isSelected = slug === selectedSlug;
          return (
            <button
              key={slug}
              role="option"
              aria-selected={isSelected}
              data-testid={`tray-item-${slug}`}
              onClick={() => onSelect(slug)}
              className={[
                'relative flex min-h-[44px] min-w-[52px] shrink-0 flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-xs transition-colors',
                isSelected
                  ? 'border-[var(--color-treasure-500)] bg-[var(--color-treasure-50)] shadow-md'
                  : 'border-[var(--color-sand-200)] bg-white/80 hover:bg-white',
              ].join(' ')}
            >
              {count > 1 && (
                <span
                  data-testid={`tray-count-${slug}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--color-treasure-500)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
                >
                  ×{count}
                </span>
              )}
              {/* Tiny SVG preview */}
              <svg
                width={32}
                height={32}
                viewBox={`0 0 ${def.footprint.w * 12.5} ${def.footprint.h * 12.5}`}
                aria-hidden
              >
                <def.Component />
              </svg>
              <span className="mt-0.5 text-center font-hanzi leading-tight">{def.nameZh}</span>
              <span className="text-center text-[9px] leading-tight text-[var(--color-sand-600)]">
                {def.nameEn}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
