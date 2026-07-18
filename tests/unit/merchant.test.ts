// E2 旅行商人 — pure offer helpers + the auth-gated buy action.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getMerchantOffer: vi.fn(),
  buyMerchantOffer: vi.fn(),
  safePackCompleteTrophy: vi.fn().mockResolvedValue(undefined),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-07-18' }));
vi.mock('@/lib/db/merchant', () => ({
  getMerchantOffer: mocks.getMerchantOffer,
  buyMerchantOffer: mocks.buyMerchantOffer,
  hasBoughtMerchantToday: vi.fn(),
}));
vi.mock('@/lib/play/card-grants', () => ({
  safePackCompleteTrophy: mocks.safePackCompleteTrophy,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import {
  MERCHANT_PRICES,
  merchantPriceForRarity,
  pickMerchantIndex,
} from '@/lib/merchant/offer';
import { buyMerchantOfferAction } from '@/lib/actions/merchant';

describe('merchant pure helpers', () => {
  it('prices by rarity, defaulting unknown to common', () => {
    expect(merchantPriceForRarity('common')).toBe(MERCHANT_PRICES.common);
    expect(merchantPriceForRarity('rare')).toBe(MERCHANT_PRICES.rare);
    expect(merchantPriceForRarity('epic')).toBe(MERCHANT_PRICES.epic);
    expect(merchantPriceForRarity('mystery')).toBe(MERCHANT_PRICES.common);
  });

  it('pick is deterministic for (child, day) and always in range', () => {
    const a = pickMerchantIndex('child-1', '2026-07-18', 137);
    expect(pickMerchantIndex('child-1', '2026-07-18', 137)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(137);
    expect(pickMerchantIndex('child-1', '2026-07-18', 1)).toBe(0);
    expect(pickMerchantIndex('child-1', '2026-07-18', 0)).toBe(0);
  });

  it('the offer rotates: across a month of days more than one index appears', () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 30; d++) {
      const day = `2026-07-${String(d).padStart(2, '0')}`;
      seen.add(pickMerchantIndex('child-1', day, 137));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

const OFFER = {
  itemId: 'i1',
  slug: 'jp',
  packSlug: 'flags-v1',
  nameZh: '日本',
  nameEn: 'Japan',
  loreZh: null,
  loreEn: null,
  rarity: 'common',
  imageUrl: null,
  price: 800,
};

describe('buyMerchantOfferAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getMerchantOffer.mockResolvedValue(OFFER);
  });

  it('recomputes the offer server-side and buys it', async () => {
    mocks.buyMerchantOffer.mockResolvedValue({
      ok: true,
      card: { id: 'i1', slug: 'jp', packSlug: 'flags-v1', nameZh: '日本', nameEn: 'Japan', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 },
      balanceAfter: 11780,
    });
    const res = await buyMerchantOfferAction('c1', 'i1');
    expect(mocks.getMerchantOffer).toHaveBeenCalledWith('c1', '2026-07-18');
    expect(mocks.buyMerchantOffer).toHaveBeenCalledWith('c1', '2026-07-18', OFFER, 'i1');
    expect(res.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/play/c1');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/play/c1/collection/flags-v1');
    expect(mocks.safePackCompleteTrophy).toHaveBeenCalledWith('c1', 'flags-v1');
  });

  it('returns no_offer when everything is owned', async () => {
    mocks.getMerchantOffer.mockResolvedValue(null);
    const res = await buyMerchantOfferAction('c1', 'i1');
    expect(res).toEqual({ ok: false, reason: 'no_offer' });
    expect(mocks.buyMerchantOffer).not.toHaveBeenCalled();
  });

  it('failure outcomes pass through without revalidate or trophies', async () => {
    mocks.buyMerchantOffer.mockResolvedValue({ ok: false, reason: 'already_bought_today' });
    const res = await buyMerchantOfferAction('c1', 'i1');
    expect(res).toEqual({ ok: false, reason: 'already_bought_today' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.safePackCompleteTrophy).not.toHaveBeenCalled();
  });
});
