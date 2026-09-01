'use client';

import { useState } from 'react';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { RevealCard } from '@/lib/play/reveal-card';
import { TreasureChestReveal } from './TreasureChestReveal';
import { HoloShimmer, isLimitedPack } from '@/components/play/items/HoloShimmer';

interface Props {
  cards: RevealCard[];
  onDone: () => void;
}

const ZODIAC_PACK_SLUG = 'zodiac-v1';

/**
 * Resolve the per-card glyph: zodiac pack → null (TreasureChestReveal then
 * draws the per-animal ZodiacIcon), else an emoji.
 *
 * This compared against 'zodiac' for months. The real pack slug is
 * 'zodiac-v1', so the branch never fired and every zodiac card revealed the
 * pack's generic 🐲 — the same wrong-slug-namespace class as PR #153. Keep the
 * constant; do not re-inline the literal.
 */
function emojiFor(card: RevealCard): string | null {
  if (card.packSlug === ZODIAC_PACK_SLUG) return null;
  const meta = getPackMeta(card.packSlug);
  return meta?.resolveRevealEmoji?.(card.slug) ?? meta?.themeEmoji ?? '🎴';
}

export function CardChestReveal({ cards, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState(false);

  if (cards.length === 0) return null;
  const card = cards[index];
  const isLast = index >= cards.length - 1;

  return (
    <div
      data-testid="card-chest-reveal"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/55 px-6 text-center"
    >
      {cards.length > 1 && (
        <div className="text-sm font-semibold text-white/90">
          {index + 1} / {cards.length}
        </div>
      )}

      {!opened ? (
        <>
          <div className="text-8xl" aria-hidden="true">🎁</div>
          <WoodSignButton size="lg" onClick={() => setOpened(true)}>
            开启宝箱 / Open
          </WoodSignButton>
        </>
      ) : (
        <>
          <HoloShimmer active={isLimitedPack(card.packSlug)}>
            <div className="rounded-3xl bg-white/95 px-4 py-2 shadow-xl">
              <TreasureChestReveal
                item={{
                  id: card.id,
                  slug: card.slug,
                  nameZh: card.nameZh,
                  nameEn: card.nameEn,
                  loreZh: card.loreZh,
                  loreEn: card.loreEn,
                  emoji: emojiFor(card),
                }}
                wasDuplicate={card.isDupe}
                shardsAfter={card.shardsAfter}
              />
            </div>
          </HoloShimmer>
          {isLast ? (
            <WoodSignButton size="lg" onClick={onDone}>
              继续 / Continue
            </WoodSignButton>
          ) : (
            <WoodSignButton
              size="lg"
              onClick={() => {
                setIndex((i) => i + 1);
                setOpened(false);
              }}
            >
              下一个 / Next
            </WoodSignButton>
          )}
        </>
      )}
    </div>
  );
}
