import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarTryOnPreview, type TryOnState } from '@/components/shop/AvatarTryOnPreview';
import type { AvatarShopListing } from '@/lib/db/shop';

function listing(id: string, slug: string, price: number, name: string): AvatarShopListing {
  return {
    shopItem: {
      id, slug, kind: 'avatar', name, description: null, imageUrl: null,
      priceCoins: price, availableFrom: null, availableTo: null, isActive: true,
      metadata: { rarity: 'common', slot: 'hat' }, createdAt: new Date(),
    },
    avatarItem: {
      id: `avatar-${id}`, slotId: 'hat', name, imageUrl: null,
      unlockVia: 'shop', unlockRef: slug, theme: null, createdAt: new Date(),
    },
  };
}

const tryOn: TryOnState = { slot: 'hat', listing: listing('shop-crown', 'crown-gold', 120, '王冠 / Crown') };

const base = {
  equippedRefs: { head: 'default-head' },
  pending: false,
  onBuy: vi.fn(),
  onClearTryOn: vi.fn(),
};

describe('AvatarTryOnPreview', () => {
  it('always renders the big avatar preview', () => {
    render(<AvatarTryOnPreview {...base} tryOn={null} owned={false} coinBalance={0} />);
    expect(screen.getByTestId('tryon-preview')).toBeInTheDocument();
  });

  it('shows no Buy bar when nothing is being tried on', () => {
    render(<AvatarTryOnPreview {...base} tryOn={null} owned={false} coinBalance={500} />);
    expect(screen.queryByTestId('tryon-buy')).not.toBeInTheDocument();
  });

  it('shows a bilingual Buy button with price for an unowned tried item', () => {
    render(<AvatarTryOnPreview {...base} tryOn={tryOn} owned={false} coinBalance={500} />);
    const buy = screen.getByTestId('tryon-buy');
    expect(buy).toHaveTextContent(/购买/);
    expect(buy).toHaveTextContent(/Buy/);
    expect(buy).toHaveTextContent('120');
    expect(buy).toBeEnabled();
  });

  it('calls onBuy when the affordable Buy button is pressed', () => {
    const onBuy = vi.fn();
    render(<AvatarTryOnPreview {...base} onBuy={onBuy} tryOn={tryOn} owned={false} coinBalance={500} />);
    fireEvent.click(screen.getByTestId('tryon-buy'));
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('disables Buy and shows a shortfall helper when unaffordable', () => {
    render(<AvatarTryOnPreview {...base} tryOn={tryOn} owned={false} coinBalance={50} />);
    expect(screen.getByTestId('tryon-buy')).toBeDisabled();
    expect(screen.getByText(/再赚 70 个金币 \/ Earn 70 more coins/)).toBeInTheDocument();
  });

  it('shows no Buy bar when the tried item is already owned', () => {
    render(<AvatarTryOnPreview {...base} tryOn={tryOn} owned coinBalance={500} />);
    expect(screen.queryByTestId('tryon-buy')).not.toBeInTheDocument();
  });
});
