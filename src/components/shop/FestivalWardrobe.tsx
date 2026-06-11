'use client';

import { AvatarRender } from '@/components/play/AvatarRender';
import { FESTIVAL_THEMES } from '@/lib/calendar/festivals';
import type { AvatarSlotId } from '@/lib/avatar/defaultLook';
import type { FestivalCosmeticListing } from '@/lib/db/shop';

/** avatarItemRef → bilingual label, derived from the festival theme map. */
const REF_LABEL: Record<string, { zh: string; en: string; emoji: string }> =
  Object.fromEntries(
    Object.values(FESTIVAL_THEMES).map((t) => [
      t.avatarItemRef,
      { zh: t.nameZh, en: t.nameEn, emoji: t.emoji },
    ]),
  );

interface Props {
  cosmetics: FestivalCosmeticListing[];
  pending: boolean;
  onEquip: (c: FestivalCosmeticListing) => void;
}

/**
 * 节日衣橱 / Festival Wardrobe — re-equip past festival cosmetics. These are
 * reward-only items (not sold in the shop), so this strip is the only place the
 * kid can put an old festival look back on. Hidden when nothing is unlocked.
 */
export function FestivalWardrobe({ cosmetics, pending, onEquip }: Props) {
  if (cosmetics.length === 0) return null;

  return (
    <section className="px-4 pb-5 pt-1">
      <h3 className="text-sm font-extrabold text-amber-950">
        🎀 节日衣橱 / Festival Wardrobe
      </h3>
      <p className="mb-2 text-xs text-amber-800/80">
        穿上你解锁过的节日装扮 / Re-equip festival looks you&apos;ve unlocked
      </p>
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        role="listbox"
        aria-label="Festival wardrobe"
      >
        {cosmetics.map((c) => {
          const label = c.unlockRef ? REF_LABEL[c.unlockRef] : undefined;
          const nameZh = label ? `${label.emoji} ${label.zh}` : '节日装扮';
          const nameEn = label?.en ?? 'Festival look';
          return (
            <button
              key={c.avatarItemId}
              type="button"
              role="option"
              aria-selected={c.equipped}
              data-testid={`wardrobe-${c.unlockRef ?? c.avatarItemId}`}
              disabled={pending}
              onClick={() => onEquip(c)}
              className={[
                'flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-colors disabled:opacity-50',
                c.equipped
                  ? 'border-[var(--color-treasure-500)] bg-[var(--color-treasure-50)] shadow-md'
                  : 'border-amber-800/30 bg-amber-50 hover:bg-amber-100',
              ].join(' ')}
            >
              <AvatarRender
                equipped={{ [c.slotId as AvatarSlotId]: c.unlockRef }}
                size={56}
                label={`${nameZh} / ${nameEn}`}
              />
              <span className="text-center text-[11px] font-bold leading-tight text-amber-950">
                {nameZh}
              </span>
              <span className="text-center text-[9px] leading-tight text-amber-700">
                {nameEn}
              </span>
              {c.equipped && (
                <span className="rounded-full bg-[var(--color-treasure-500)] px-1.5 py-0.5 text-[8px] font-bold text-white">
                  已穿戴 / Worn
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
