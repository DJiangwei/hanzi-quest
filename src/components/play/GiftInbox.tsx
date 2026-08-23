'use client';

import { useState } from 'react';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { markGiftsSeenAction } from '@/lib/actions/crew';
import type { RevealCard } from '@/lib/play/reveal-card';

export interface InboxGift {
  giftId: string;
  /** The giver's generated pirate nickname — never a real name. */
  from: { zh: string; en: string };
  card: RevealCard;
}

interface Props {
  childId: string;
  gifts: InboxGift[];
}

/**
 * Delivers gifts through the SAME chest the child already associates with
 * getting a card, rather than a bespoke animation — so a gift reads as the good
 * thing the instant it appears.
 *
 * The card itself transferred when the gift was sent; this is ceremony plus the
 * `seen_at` stamp. Deliberately shows no running total of gifts received: a
 * visible tally would hand the child nobody sends to a fresh way to feel behind,
 * which is the same mistake as a leaderboard wearing a friendlier face.
 */
export function GiftInbox({ childId, gifts }: Props) {
  const [open, setOpen] = useState(gifts.length > 0);
  if (!open || gifts.length === 0) return null;

  // Every unseen gift shares one chest run; the giver line names whoever sent
  // the card currently on screen.
  return (
    <div data-testid="gift-inbox">
      <p className="pointer-events-none fixed inset-x-0 top-6 z-[60] text-center text-base font-bold text-white drop-shadow">
        <span className="font-hanzi">
          🎁 来自 {gifts[0]!.from.zh} 的礼物
        </span>
        <span className="ml-2 text-sm font-medium opacity-90">
          A gift from {gifts[0]!.from.en}
        </span>
      </p>
      <CardChestReveal
        cards={gifts.map((g) => g.card)}
        onDone={() => {
          setOpen(false);
          void markGiftsSeenAction({
            childId,
            giftIds: gifts.map((g) => g.giftId),
          });
        }}
      />
    </div>
  );
}
