'use client';

import { SHOP_FILTER_THEMES, THEME_DISPLAY_NAMES, type AvatarTheme } from '@/lib/avatar/themes';

export type ThemeChipValue = 'all' | AvatarTheme;

interface ThemeChipStripProps {
  selected: ThemeChipValue;
  onSelect: (value: ThemeChipValue) => void;
}

export function ThemeChipStrip({ selected, onSelect }: ThemeChipStripProps) {
  const chips: { value: ThemeChipValue; label: string }[] = [
    { value: 'all', label: '全部 / All' },
    ...SHOP_FILTER_THEMES.map((t) => ({
      value: t,
      label: `${THEME_DISPLAY_NAMES[t].zh} / ${THEME_DISPLAY_NAMES[t].en}`,
    })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Theme filter">
      {chips.map((chip) => {
        const isActive = chip.value === selected;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(chip.value)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
              isActive
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
            ].join(' ')}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
