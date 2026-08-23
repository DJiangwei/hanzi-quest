import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => routerMocks }));

const actionMocks = vi.hoisted(() => ({ giftCardAction: vi.fn() }));
vi.mock('@/lib/actions/crew', () => ({
  giftCardAction: actionMocks.giftCardAction,
}));

import { CardDetailDialog } from '@/components/play/CardDetailDialog';
import { GiftDialog } from '@/components/play/GiftDialog';
import { GIFTS_SENT_PER_DAY } from '@/lib/crew/gift-config';
import type { CollectibleItem } from '@/lib/db/collections';
import type { CrewMate } from '@/lib/db/crew';

function flagItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
  return {
    id: 'item-1',
    packId: 'pack-flags',
    slug: 'china',
    nameZh: '中国',
    nameEn: 'China',
    loreZh: '首都：北京。大熊猫的故乡。',
    loreEn: 'Capital: Beijing. Home of the giant panda!',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🇨🇳',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * A real name that must NEVER be visible anywhere in this feature. `CrewMate`
 * (src/lib/db/crew.ts) structurally carries only `childId`, `nickname`, and
 * `equipped` — there is no field on the type a real name could travel
 * through. This constant exists purely so a test can look for its absence.
 */
const REAL_NAME = 'Amelia Realname';

function crewMate(overrides: Partial<CrewMate> = {}): CrewMate {
  return {
    childId: 'c-mate-1',
    nickname: { zh: '红帆船长', en: 'Captain Redsail' },
    equipped: { head: 'default-kid-warm', hat: 'default-bandana-red' },
    ...overrides,
  };
}

function giftDialogProps(
  over: Partial<ComponentProps<typeof GiftDialog>> = {},
): ComponentProps<typeof GiftDialog> {
  return {
    open: true,
    onClose: vi.fn(),
    fromChildId: 'c-self',
    itemId: 'item-1',
    itemNameZh: '中国',
    itemNameEn: 'China',
    crew: [crewMate()],
    ownerIds: [],
    giftsSentToday: 0,
    onSent: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  actionMocks.giftCardAction.mockReset();
  routerMocks.refresh.mockReset();
});

describe('CardDetailDialog — gift button visibility', () => {
  function cardProps(over: Partial<ComponentProps<typeof CardDetailDialog>> = {}) {
    return {
      packSlug: 'flags-v1',
      item: flagItem(),
      owned: true,
      onClose: vi.fn(),
      childId: 'c-self',
      crew: [crewMate()],
      ownersByItem: {},
      giftsSentToday: 0,
      ownedCount: 0,
      ...over,
    };
  }

  it('is absent when the child owns exactly 1 copy', () => {
    render(<CardDetailDialog {...cardProps({ ownedCount: 1 })} />);
    expect(screen.queryByTestId('gift-button')).not.toBeInTheDocument();
  });

  it('is present when the child owns 2 or more copies', () => {
    render(<CardDetailDialog {...cardProps({ ownedCount: 2 })} />);
    expect(screen.getByTestId('gift-button')).toBeInTheDocument();
  });

  it('is also present well above 2 copies', () => {
    render(<CardDetailDialog {...cardProps({ ownedCount: 5 })} />);
    expect(screen.getByTestId('gift-button')).toBeInTheDocument();
  });

  it('opens the crewmate picker on tap', () => {
    render(<CardDetailDialog {...cardProps({ ownedCount: 3 })} />);
    fireEvent.click(screen.getByTestId('gift-button'));
    expect(screen.getByTestId('gift-dialog')).toBeInTheDocument();
  });
});

describe('GiftDialog — crewmate picker', () => {
  const mateA = crewMate({
    childId: 'c-mate-a',
    nickname: { zh: '蓝浪大副', en: 'Firstmate Bluewave' },
  });
  const mateB = crewMate({
    childId: 'c-mate-b',
    nickname: { zh: '金锚舵手', en: 'Helmsman Goldanchor' },
  });

  it('renders a crewmate who already owns the card as disabled, labelled 已经有了', () => {
    render(
      <GiftDialog
        {...giftDialogProps({ crew: [mateA, mateB], ownerIds: [mateA.childId] })}
      />,
    );
    const ownerBtn = screen.getByTestId(`gift-mate-${mateA.childId}`);
    expect(ownerBtn).toBeDisabled();
    expect(ownerBtn).toHaveTextContent(/已经有了/);
    expect(ownerBtn).toHaveTextContent(/already has it/i);

    // The other mate — who doesn't own it — stays selectable.
    const selectableBtn = screen.getByTestId(`gift-mate-${mateB.childId}`);
    expect(selectableBtn).not.toBeDisabled();
    expect(selectableBtn).not.toHaveTextContent(/已经有了/);
  });

  it('calls giftCardAction with exactly the three expected ids on tap', async () => {
    actionMocks.giftCardAction.mockResolvedValue({ ok: true, itemId: 'item-1' });
    const onSent = vi.fn();
    render(
      <GiftDialog
        {...giftDialogProps({
          crew: [mateA, mateB],
          fromChildId: 'c-self',
          itemId: 'item-1',
          onSent,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId(`gift-mate-${mateB.childId}`));

    await waitFor(() => expect(actionMocks.giftCardAction).toHaveBeenCalledTimes(1));
    expect(actionMocks.giftCardAction).toHaveBeenCalledWith({
      fromChildId: 'c-self',
      toChildId: mateB.childId,
      itemId: 'item-1',
    });
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
  });

  it('never calls the action when tapping a crewmate who already owns the card', () => {
    render(
      <GiftDialog
        {...giftDialogProps({ crew: [mateA], ownerIds: [mateA.childId] })}
      />,
    );
    fireEvent.click(screen.getByTestId(`gift-mate-${mateA.childId}`));
    expect(actionMocks.giftCardAction).not.toHaveBeenCalled();
  });

  it('shows remaining send capacity as GIFTS_SENT_PER_DAY - giftsSentToday', () => {
    render(<GiftDialog {...giftDialogProps({ giftsSentToday: 1 })} />);
    const remaining = GIFTS_SENT_PER_DAY - 1;
    const el = screen.getByTestId('gift-remaining');
    expect(el).toHaveTextContent(String(remaining));
    expect(el).toHaveTextContent(/今天还能送/);
    expect(el).toHaveTextContent(/gifts left today/i);
  });

  it('clamps remaining capacity at 0 rather than showing a negative number', () => {
    render(
      <GiftDialog {...giftDialogProps({ giftsSentToday: GIFTS_SENT_PER_DAY + 5 })} />,
    );
    expect(screen.getByTestId('gift-remaining')).toHaveTextContent('0');
  });

  it('maps already_gifted_today to a warm, non-blaming bilingual message', async () => {
    actionMocks.giftCardAction.mockResolvedValue({
      ok: false,
      reason: 'already_gifted_today',
    });
    render(<GiftDialog {...giftDialogProps({ crew: [mateB] })} />);
    fireEvent.click(screen.getByTestId(`gift-mate-${mateB.childId}`));
    await waitFor(() => expect(screen.getByTestId('gift-failure')).toBeInTheDocument());
    expect(screen.getByTestId('gift-failure')).toHaveTextContent(/今天已经送过他啦/);
    expect(screen.getByTestId('gift-failure')).toHaveTextContent(
      /you already sent them one today/i,
    );
  });

  it('closes on Cancel without calling the action', () => {
    const onClose = vi.fn();
    render(<GiftDialog {...giftDialogProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /取消|Cancel/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actionMocks.giftCardAction).not.toHaveBeenCalled();
  });
});

describe("GiftDialog — never a rank, a received count, or another child's real name", () => {
  it('CrewMate carries only childId, nickname, and equipped — no field exists to leak a name', () => {
    const mate = crewMate();
    expect(Object.keys(mate).sort()).toEqual(['childId', 'equipped', 'nickname']);
  });

  it('renders the nickname but never a real name, even one forced onto the fixture', () => {
    // A real name should never exist on CrewMate. Force one on anyway (via an
    // unchecked cast) so the test can prove the component doesn't render it
    // even if an upstream bug ever let one through — the same defence-in-depth
    // shape as crew-db.test.ts's RAW_ROWS leak check.
    const mateWithHiddenName = {
      ...crewMate({ childId: 'c-mate-real' }),
      displayName: REAL_NAME,
    } as unknown as CrewMate;

    render(<GiftDialog {...giftDialogProps({ crew: [mateWithHiddenName] })} />);

    expect(screen.getByText(mateWithHiddenName.nickname.zh)).toBeInTheDocument();
    expect(screen.queryByText(REAL_NAME)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(REAL_NAME);
  });

  it('never renders a rank or a received-count figure', () => {
    render(
      <GiftDialog
        {...giftDialogProps({ crew: [crewMate(), crewMate({ childId: 'c-mate-2' })] })}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/排名|rank/i);
    expect(text).not.toMatch(/收到了?\s*\d+|received\s*\d+/i);
  });
});
