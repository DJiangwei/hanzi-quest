'use client';

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

export type ShopCategory = 'avatar' | 'sound' | 'pet' | 'decor' | 'powerup' | 'home';

interface TabDef {
  id: ShopCategory;
  emoji: string;
  label: string;
  disabled: boolean;
}

const TABS: TabDef[] = [
  { id: 'avatar', emoji: '👒', label: '装扮 / Looks', disabled: false },
  { id: 'sound', emoji: '🎵', label: '音效 / Sounds', disabled: false },
  { id: 'pet', emoji: '🐦', label: '伙伴 / Pets', disabled: false },
  { id: 'decor', emoji: '🏝️', label: '装饰 / Decor', disabled: false },
  { id: 'powerup', emoji: '💡', label: '道具 / Items', disabled: false },
  { id: 'home', emoji: '🏠', label: '家具 / Furniture', disabled: false },
];

interface Props {
  active: ShopCategory;
  onChange: (id: ShopCategory) => void;
}

export function ShopCategoryTabs({ active, onChange }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <nav
      className="flex w-full justify-around overflow-x-auto border-b-2 border-amber-800/30 bg-amber-50/95 px-2 py-2 backdrop-blur"
      aria-label="商店分类 / Shop categories"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active && !tab.disabled;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            aria-pressed={isActive}
            aria-disabled={tab.disabled}
            className={[
              'flex min-w-[68px] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
              reduceMotion ? '' : 'transition-transform',
              isActive
                ? 'bg-amber-200 text-amber-900 shadow-inner'
                : tab.disabled
                  ? 'text-amber-900/40'
                  : 'text-amber-900 hover:bg-amber-100',
            ].join(' ')}
          >
            <span className="text-2xl leading-none">{tab.emoji}</span>
            <span className="whitespace-nowrap text-[11px] leading-tight">{tab.label}</span>
            {tab.disabled && (
              <span className="text-[10px] font-normal text-amber-900/50">
                即将上线 / Coming soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
