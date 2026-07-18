// E2 merchant panel + E1 shard nudge — kid-facing UI.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  buyMerchantOfferAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/actions/merchant', () => ({
  buyMerchantOfferAction: mocks.buyMerchantOfferAction,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

import { TravelingMerchant } from '@/components/play/TravelingMerchant';
import { AtlasHub } from '@/components/play/AtlasHub';

const OFFER = {
  itemId: 'i1',
  slug: 'jp',
  packSlug: 'flags-v1',
  nameZh: '日本',
  nameEn: 'Japan',
  loreZh: null,
  loreEn: null,
  rarity: 'rare',
  imageUrl: null,
  price: 1200,
};

beforeEach(() => vi.clearAllMocks());

describe('TravelingMerchant', () => {
  it('shows the offer card, bilingual, with the coin price', () => {
    render(<TravelingMerchant childId="c1" offer={OFFER} boughtToday={false} balance={5000} />);
    expect(screen.getByTestId('merchant-panel').textContent).toContain('旅行商人');
    expect(screen.getByText(/日本/).textContent).toContain('Japan');
    expect(screen.getByTestId('merchant-buy').textContent).toContain('1200');
  });

  it('renders nothing without an offer', () => {
    const { container } = render(
      <TravelingMerchant childId="c1" offer={null} boughtToday={false} balance={5000} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('sold-out state when already bought today', () => {
    render(<TravelingMerchant childId="c1" offer={OFFER} boughtToday balance={5000} />);
    expect(screen.getByTestId('merchant-sold-out')).toBeTruthy();
    expect(screen.queryByTestId('merchant-buy')).toBeNull();
  });

  it('disables buy when coins are short', () => {
    render(<TravelingMerchant childId="c1" offer={OFFER} boughtToday={false} balance={100} />);
    expect((screen.getByTestId('merchant-buy') as HTMLButtonElement).disabled).toBe(true);
  });

  it('buy → chest reveal, then the stall closes for the day', async () => {
    mocks.buyMerchantOfferAction.mockResolvedValue({
      ok: true,
      card: { id: 'i1', slug: 'jp', packSlug: 'flags-v1', nameZh: '日本', nameEn: 'Japan', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 },
      balanceAfter: 3800,
    });
    render(<TravelingMerchant childId="c1" offer={OFFER} boughtToday={false} balance={5000} />);
    fireEvent.click(screen.getByTestId('merchant-buy'));
    await waitFor(() =>
      expect(mocks.buyMerchantOfferAction).toHaveBeenCalledWith('c1', 'i1'),
    );
    await waitFor(() => expect(screen.getByTestId('card-chest-reveal')).toBeTruthy());
    expect(screen.getByTestId('merchant-sold-out')).toBeTruthy();
  });

  it('insufficient-coins outcome shows a friendly bilingual nudge', async () => {
    mocks.buyMerchantOfferAction.mockResolvedValue({
      ok: false,
      reason: 'insufficient_coins',
      price: 1200,
      balance: 700,
    });
    render(<TravelingMerchant childId="c1" offer={OFFER} boughtToday={false} balance={5000} />);
    fireEvent.click(screen.getByTestId('merchant-buy'));
    await waitFor(() => {
      const note = screen.getByTestId('merchant-notice');
      expect(note.textContent).toContain('500');
      expect(note.textContent).toContain('coins');
    });
  });
});

describe('AtlasHub shard nudge (E1)', () => {
  it('appears only when the wallet can afford a swap (≥3)', () => {
    const { rerender } = render(<AtlasHub childId="c1" halls={[]} shards={23} />);
    const nudge = screen.getByTestId('shard-nudge');
    expect(nudge.textContent).toContain('23');
    expect(nudge.textContent).toContain('7'); // floor(23 / 3) swaps
    rerender(<AtlasHub childId="c1" halls={[]} shards={2} />);
    expect(screen.queryByTestId('shard-nudge')).toBeNull();
  });
});
