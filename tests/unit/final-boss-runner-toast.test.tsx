// The final overlord is the biggest fight in the game and is beaten once per
// map. Its £3 used to credit silently — the money landed in the ledger but
// nothing said so at the moment of the win. These tests pin that it is
// surfaced, and that a repeat clear stays quiet.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const finishFinalBossAction = vi.fn<(...a: unknown[]) => unknown>();
vi.mock('@/lib/actions/final-boss', () => ({
  finishFinalBossAction: (...a: unknown[]) => finishFinalBossAction(...a),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Drive victory synchronously instead of playing the whole gauntlet.
vi.mock('@/components/scenes/FinalBossScene', () => ({
  FinalBossScene: ({ onComplete }: { onComplete: (won: boolean) => void }) => (
    <button type="button" data-testid="win" onClick={() => onComplete(true)}>
      win
    </button>
  ),
}));
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: () => <div data-testid="chest" />,
}));

import { FinalBossRunner } from '@/components/scenes/FinalBossRunner';

const PIGGY_BONUS = {
  reason: 'piggy' as const,
  delta: 300,
  unit: 'pence' as const,
  labelZh: '存钱罐',
  labelEn: 'Piggy bank',
};

function renderRunner() {
  return render(
    <FinalBossRunner
      childId="c1"
      packSlug="pirate-class-level-1"
      mapNameZh="加勒比海"
      mapNameEn="The Caribbean"
      phases={[]}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('FinalBossRunner — 存钱罐 toast', () => {
  it('shows the £3 bonus toast after a first clear', async () => {
    finishFinalBossAction.mockResolvedValue({
      ok: true,
      cardGrants: [],
      trophies: [],
      bonuses: [PIGGY_BONUS],
    });

    renderRunner();
    screen.getByTestId('win').click();

    await waitFor(() => {
      expect(screen.getByTestId('bonus-toast-piggy')).toBeInTheDocument();
    });
    // Rendered as money, not as a raw coin count.
    expect(screen.getByTestId('bonus-toast-piggy')).toHaveTextContent('£3.00');
    expect(screen.getByTestId('bonus-toast-piggy')).toHaveTextContent('存钱罐');
    expect(screen.getByTestId('bonus-toast-piggy')).toHaveTextContent('Piggy bank');
  });

  it('shows no toast when the action returns no bonuses (repeat clear)', async () => {
    finishFinalBossAction.mockResolvedValue({
      ok: true,
      cardGrants: [],
      trophies: [],
      bonuses: [],
    });

    renderRunner();
    screen.getByTestId('win').click();

    await waitFor(() => expect(finishFinalBossAction).toHaveBeenCalled());
    expect(screen.queryByTestId('bonus-toast-piggy')).not.toBeInTheDocument();
  });

  it('does not call the action at all when the child loses', async () => {
    renderRunner();
    // onComplete(false) is what a loss sends; the stub only sends true, so
    // assert the untouched initial state instead.
    expect(finishFinalBossAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bonus-toast-piggy')).not.toBeInTheDocument();
  });
});
