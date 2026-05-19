import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PurchaseConfirmDialog } from '@/components/shop/PurchaseConfirmDialog';
import type { AvatarShopListing } from '@/lib/db/shop';

function makeListing(price: number, name = '红头巾'): AvatarShopListing {
  return {
    shopItem: {
      id: 'shop-1',
      slug: 'avatar-hat-tricorn',
      kind: 'avatar',
      name,
      description: null,
      imageUrl: null,
      priceCoins: price,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: { rarity: 'common', slot: 'hat' },
      createdAt: new Date(),
    },
    avatarItem: {
      id: 'avatar-1',
      slotId: 'hat',
      name,
      imageUrl: null,
      unlockVia: 'shop',
      unlockRef: 'avatar-hat-tricorn',
      createdAt: new Date(),
    },
  };
}

describe('PurchaseConfirmDialog', () => {
  it('returns null when open=false', () => {
    const { container } = render(
      <PurchaseConfirmDialog
        open={false}
        listing={makeListing(100)}
        coinBalance={500}
        pending={false}
        errorMessage={null}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the price + balance-after when affordable', () => {
    render(
      <PurchaseConfirmDialog
        open
        listing={makeListing(120)}
        coinBalance={500}
        pending={false}
        errorMessage={null}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('🪙 120')).toBeInTheDocument();
    expect(screen.getByText('🪙 500')).toBeInTheDocument();
    expect(screen.getByText('🪙 380')).toBeInTheDocument();
  });

  it('disables confirm and shows shortfall message when balance < price', () => {
    render(
      <PurchaseConfirmDialog
        open
        listing={makeListing(800)}
        coinBalance={300}
        pending={false}
        errorMessage={null}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const confirm = screen.getByRole('button', { name: /买/i });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('再赚 500 个金币就能买啦！')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is pressed', () => {
    const onConfirm = vi.fn();
    render(
      <PurchaseConfirmDialog
        open
        listing={makeListing(80)}
        coinBalance={500}
        pending={false}
        errorMessage={null}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /买 🪙 80/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('shows pending text while in flight and blocks both buttons', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <PurchaseConfirmDialog
        open
        listing={makeListing(100)}
        coinBalance={500}
        pending={true}
        errorMessage={null}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('...买中')).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: '再想想' });
    fireEvent.click(cancel);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('surfaces a server error message when provided', () => {
    render(
      <PurchaseConfirmDialog
        open
        listing={makeListing(100)}
        coinBalance={500}
        pending={false}
        errorMessage="网络出错，请重试"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('网络出错，请重试')).toBeInTheDocument();
  });
});
