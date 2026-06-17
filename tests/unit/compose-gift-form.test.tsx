import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  sendAdminGiftAction: vi.fn(),
}));

vi.mock('@/lib/actions/admin', () => ({
  sendAdminGiftAction: mocks.sendAdminGiftAction,
  undoAdminGiftAction: vi.fn().mockResolvedValue({ ok: true }),
}));

// next/link renders as a plain <a> in jsdom
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ComposeGiftForm } from '@/components/admin/ComposeGiftForm';
import { WELCOME_GIFT_DEFAULT } from '@/lib/admin/bundle';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const CARDS = [
  { id: 'card-1', label: '[zodiac-v1] 鼠 / Rat' },
  { id: 'card-2', label: '[zodiac-v1] 牛 / Ox' },
];

const SHOP_CATALOG = [
  { id: 'shop-avatar-1', kind: 'avatar', label: 'Hat (avatar-hat-tricorn)' },
  { id: 'shop-avatar-2', kind: 'avatar', label: 'Crown (avatar-hat-crown)' },
  { id: 'shop-decor-1', kind: 'decor', label: 'Sailboat (decor-sailboat)' },
  { id: 'shop-pet-1', kind: 'pet', label: 'Parrot (pet-parrot)' },
];

const BASE_PROPS = {
  childId: 'child-123',
  cards: CARDS,
  shopCatalog: SHOP_CATALOG,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function openConfirmAndConfirm() {
  // Click "Send Gift" to open confirm dialog
  await act(async () => {
    fireEvent.click(screen.getByTestId('btn-send-gift'));
  });
  // Click confirm
  await act(async () => {
    fireEvent.click(screen.getByTestId('btn-confirm'));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ComposeGiftForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAdminGiftAction.mockResolvedValue({
      ok: true,
      result: {
        coins: WELCOME_GIFT_DEFAULT.coins!,
        xp: WELCOME_GIFT_DEFAULT.xp!,
        cardItemIds: [],
        shopItemIds: [],
      },
    });
  });

  // -------------------------------------------------------------------------
  // Pre-fill from WELCOME_GIFT_DEFAULT
  // -------------------------------------------------------------------------
  it('renders the form pre-filled with WELCOME_GIFT_DEFAULT', () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);

    const coinsInput = screen.getByTestId(
      'input-coins',
    ) as HTMLInputElement;
    const xpInput = screen.getByTestId('input-xp') as HTMLInputElement;
    const giftPackCheckbox = screen.getByTestId(
      'checkbox-gift-pack',
    ) as HTMLInputElement;

    expect(coinsInput.value).toBe(String(WELCOME_GIFT_DEFAULT.coins)); // '500'
    expect(xpInput.value).toBe(String(WELCOME_GIFT_DEFAULT.xp)); // '100'
    expect(giftPackCheckbox.checked).toBe(
      WELCOME_GIFT_DEFAULT.giftPack ?? false,
    ); // true
  });

  it('coins default is 500', () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    const input = screen.getByTestId('input-coins') as HTMLInputElement;
    expect(input.value).toBe('500');
  });

  it('xp default is 100', () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    const input = screen.getByTestId('input-xp') as HTMLInputElement;
    expect(input.value).toBe('100');
  });

  it('gift-pack is checked by default', () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    const checkbox = screen.getByTestId(
      'checkbox-gift-pack',
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Card list renders
  // -------------------------------------------------------------------------
  it('renders the card catalog list', () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    expect(screen.getByTestId('card-list')).toBeInTheDocument();
    expect(screen.getByText('鼠 / Rat', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('牛 / Ox', { exact: false })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Unlock-all checkbox includes the category in shopUnlockAll
  // -------------------------------------------------------------------------
  it('checking avatar unlock-all includes "avatar" in shopUnlockAll when submitted', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);

    // Check the "unlock all avatar" checkbox
    await act(async () => {
      fireEvent.click(screen.getByTestId('unlock-all-avatar'));
    });

    await openConfirmAndConfirm();

    expect(mocks.sendAdminGiftAction).toHaveBeenCalledTimes(1);
    const [, bundle] = mocks.sendAdminGiftAction.mock.calls[0] as [
      string,
      { shopUnlockAll?: string[] },
    ];
    expect(bundle.shopUnlockAll).toContain('avatar');
  });

  it('checking decor unlock-all includes "decor" in shopUnlockAll', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('unlock-all-decor'));
    });

    await openConfirmAndConfirm();

    const [, bundle] = mocks.sendAdminGiftAction.mock.calls[0] as [
      string,
      { shopUnlockAll?: string[] },
    ];
    expect(bundle.shopUnlockAll).toContain('decor');
  });

  it('checking unlock-all hides the per-item checkboxes for that kind', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);

    // Initially per-item checks are visible
    expect(
      screen.getByText('Hat (avatar-hat-tricorn)', { exact: false }),
    ).toBeInTheDocument();

    // Check unlock-all for avatar
    await act(async () => {
      fireEvent.click(screen.getByTestId('unlock-all-avatar'));
    });

    // Per-item items should no longer be visible
    expect(
      screen.queryByText('Hat (avatar-hat-tricorn)', { exact: false }),
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Confirm dialog flow
  // -------------------------------------------------------------------------
  it('shows confirm dialog when Send Gift is clicked', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-send-gift'));
    });

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('cancel closes the confirm dialog without calling the action', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-send-gift'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-cancel'));
    });

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(mocks.sendAdminGiftAction).not.toHaveBeenCalled();
  });

  it('calls sendAdminGiftAction with the correct childId on confirm', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    await openConfirmAndConfirm();

    expect(mocks.sendAdminGiftAction).toHaveBeenCalledWith(
      'child-123',
      expect.any(Object),
    );
  });

  // -------------------------------------------------------------------------
  // Default bundle contents are correct
  // -------------------------------------------------------------------------
  it('bundle contains coins=500, xp=100, giftPack=true from defaults', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    await openConfirmAndConfirm();

    const [, bundle] = mocks.sendAdminGiftAction.mock.calls[0] as [
      string,
      { coins?: number; xp?: number; giftPack?: boolean },
    ];
    expect(bundle.coins).toBe(500);
    expect(bundle.xp).toBe(100);
    expect(bundle.giftPack).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Success state
  // -------------------------------------------------------------------------
  it('shows the success panel after a successful grant', async () => {
    render(<ComposeGiftForm {...BASE_PROPS} />);
    await openConfirmAndConfirm();

    expect(screen.getByTestId('gift-form-success')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  it('shows an error message when the action throws', async () => {
    mocks.sendAdminGiftAction.mockRejectedValue(new Error('DB connection lost'));
    render(<ComposeGiftForm {...BASE_PROPS} />);
    await openConfirmAndConfirm();

    expect(screen.getByTestId('gift-form-error')).toBeInTheDocument();
    expect(
      screen.getByText(/DB connection lost/, { exact: false }),
    ).toBeInTheDocument();
  });
});
