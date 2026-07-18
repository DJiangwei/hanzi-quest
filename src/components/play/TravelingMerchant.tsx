'use client';

// E2 旅行商人 — home-page stall selling ONE visible card per day for coins.
// The coin → collection bridge: coins finally buy the thing she cares about,
// at a price steep enough to be a savings goal (not a gacha — no randomness).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buyMerchantOfferAction } from '@/lib/actions/merchant';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { MerchantOffer } from '@/lib/merchant/offer';
import type { RevealCard } from '@/lib/play/reveal-card';

interface Props {
  childId: string;
  offer: MerchantOffer | null;
  boughtToday: boolean;
  balance: number;
}

const RARITY_LABEL: Record<string, { zh: string; en: string }> = {
  common: { zh: '普通', en: 'Common' },
  rare: { zh: '稀有', en: 'Rare' },
  epic: { zh: '史诗', en: 'Epic' },
};

export function TravelingMerchant({ childId, offer, boughtToday, balance }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<RevealCard[] | null>(null);
  const [soldOut, setSoldOut] = useState(boughtToday);
  const [notice, setNotice] = useState<{ zh: string; en: string } | null>(null);

  if (!offer) return null;

  const meta = getPackMeta(offer.packSlug);
  const emoji = meta?.resolveRevealEmoji?.(offer.slug) ?? meta?.themeEmoji ?? '🎴';
  const rarity = RARITY_LABEL[offer.rarity] ?? RARITY_LABEL.common;
  const affordable = balance >= offer.price;

  const buy = () => {
    setNotice(null);
    startTransition(async () => {
      const outcome = await buyMerchantOfferAction(childId, offer.itemId);
      if (outcome.ok) {
        setReveal([outcome.card]);
        setSoldOut(true);
      } else if (outcome.reason === 'already_bought_today') {
        setSoldOut(true);
      } else if (outcome.reason === 'insufficient_coins') {
        setNotice({
          zh: `还差 ${outcome.price - outcome.balance} 金币,继续闯关赚吧!`,
          en: `${outcome.price - outcome.balance} more coins to go — keep playing!`,
        });
      } else {
        // offer_changed / no_offer — the stall restocked; show the fresh one.
        setNotice({ zh: '商人换货了,看看新的!', en: 'The merchant restocked!' });
        router.refresh();
      }
    });
  };

  return (
    <section
      data-testid="merchant-panel"
      className="rounded-3xl border-2 border-[var(--color-sand-700)]/30 bg-gradient-to-br from-amber-50 to-orange-100 p-4 shadow-md"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-hanzi text-lg font-extrabold text-[var(--color-sand-900)]">
          ⛵ 旅行商人 <span className="text-sm font-semibold opacity-80">/ Traveling Merchant</span>
        </h2>
        <span className="text-xs font-semibold text-[var(--color-sand-700)]">
          每日一卡 / One card a day
        </span>
      </div>

      {soldOut ? (
        <p
          data-testid="merchant-sold-out"
          className="mt-3 rounded-2xl bg-white/70 p-4 text-center text-sm font-semibold text-[var(--color-sand-900)]"
        >
          🌙 今天的货卖完啦,明天再来! <span className="block text-xs opacity-80">Sold out — come back tomorrow!</span>
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-inner">
            {offer.imageUrl?.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl" aria-hidden="true">{emoji}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-hanzi text-base font-bold text-[var(--color-sand-900)]">
              {offer.nameZh} <span className="text-sm font-semibold opacity-80">/ {offer.nameEn}</span>
            </p>
            <p className="text-xs text-[var(--color-sand-700)]">
              {rarity.zh} / {rarity.en} · {meta?.displayNameZh ?? offer.packSlug}
            </p>
            {notice && (
              <p data-testid="merchant-notice" className="mt-1 text-xs font-semibold text-orange-700">
                {notice.zh} <span className="opacity-80">{notice.en}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <WoodSignButton
              size="sm"
              onClick={buy}
              disabled={pending || !affordable}
              data-testid="merchant-buy"
            >
              🪙 {offer.price}
            </WoodSignButton>
            {!affordable && (
              <span className="text-[10px] font-semibold text-[var(--color-sand-700)]">
                金币不够 / Not enough
              </span>
            )}
          </div>
        </div>
      )}

      {reveal && (
        <CardChestReveal
          cards={reveal}
          onDone={() => {
            setReveal(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
