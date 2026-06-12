'use client';

import { AvatarRender } from '@/components/play/AvatarRender';
import { FESTIVAL_THEMES } from '@/lib/calendar/festivals';
import { CONTINENT_LABELS, CONTINENT_ORDER } from '@/lib/collections/flagsData';
import { CONTINENT_REWARDS } from '@/lib/collections/continentRewards';
import type { AvatarSlotId } from '@/lib/avatar/defaultLook';
import type { RewardCosmeticListing } from '@/lib/db/shop';

/** avatarItemRef → bilingual label, from the festival themes + continent labels. */
const REF_LABEL: Record<string, { zh: string; en: string; emoji: string }> = {
  ...Object.fromEntries(
    Object.values(FESTIVAL_THEMES).map((t) => [
      t.avatarItemRef,
      { zh: t.nameZh, en: t.nameEn, emoji: t.emoji },
    ]),
  ),
  ...Object.fromEntries(
    CONTINENT_ORDER.map((c) => [
      CONTINENT_REWARDS[c].avatarItemRef,
      { zh: CONTINENT_LABELS[c].zh, en: CONTINENT_LABELS[c].en, emoji: CONTINENT_LABELS[c].emoji },
    ]),
  ),
};

interface Props {
  cosmetics: RewardCosmeticListing[];
  pending: boolean;
  onEquip: (c: RewardCosmeticListing) => void;
}

/**
 * 奖励衣橱 / Rewards Wardrobe — re-equip earned cosmetics (festival cosmetics +
 * continent-completion cosmetics). These are reward-only items (not sold in the
 * shop), so this strip is the only place to put an old reward look back on.
 * Hidden when nothing is unlocked.
 */
export function RewardWardrobe({ cosmetics, pending, onEquip }: Props) {
  if (cosmetics.length === 0) return null;

  return (
    <section className="px-4 pb-5 pt-1">
      <h3 className="text-sm font-extrabold text-amber-950">
        🎁 奖励衣橱 / Rewards Wardrobe
      </h3>
      <p className="mb-2 text-xs text-amber-800/80">
        穿上你赢得的特别装扮 / Re-equip the special looks you&apos;ve earned
      </p>
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        role="listbox"
        aria-label="Rewards wardrobe"
      >
        {cosmetics.map((c) => {
          const label = c.unlockRef ? REF_LABEL[c.unlockRef] : undefined;
          const nameZh = label ? `${label.emoji} ${label.zh}` : '奖励装扮';
          const nameEn = label?.en ?? 'Reward look';
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
