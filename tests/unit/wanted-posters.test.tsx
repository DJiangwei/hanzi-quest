// T2 通缉令 — kid-facing poster panel.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  claimBountyAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/actions/bounty', () => ({ claimBountyAction: mocks.claimBountyAction }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

import { WantedPosters } from '@/components/play/WantedPosters';
import type { BountyPosterView } from '@/lib/db/bounties';

const poster = (over: Partial<BountyPosterView>): BountyPosterView => ({
  characterId: over.characterId ?? 'c1',
  hanzi: over.hanzi ?? '难',
  weekId: over.weekId ?? 'w4',
  weekNumber: over.weekNumber ?? 4,
  required: 2,
  progress: 0,
  claimed: false,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('WantedPosters', () => {
  it('renders nothing when there are no posters today', () => {
    const { container } = render(<WantedPosters childId="k1" posters={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the wanted hanzi with progress pips and a week deep-link', () => {
    render(
      <WantedPosters
        childId="k1"
        posters={[poster({ hanzi: '难', progress: 1, weekId: 'w4', weekNumber: 4 })]}
      />,
    );
    expect(screen.getByTestId('wanted-posters').textContent).toContain('通缉令');
    const link = screen.getByRole('link', { name: /难/ });
    expect(link.getAttribute('href')).toBe('/play/k1/week/w4');
    expect(screen.getByText('●○')).toBeTruthy();
  });

  it('a full poster offers 领赏; claiming marks it claimed', async () => {
    mocks.claimBountyAction.mockResolvedValue({ ok: true, coins: 40, card: null });
    render(
      <WantedPosters childId="k1" posters={[poster({ hanzi: '难', progress: 2 })]} />,
    );
    fireEvent.click(screen.getByTestId('bounty-claim-难'));
    await waitFor(() => expect(mocks.claimBountyAction).toHaveBeenCalledWith('k1', 'c1'));
    await waitFor(() => expect(screen.getByText(/已领/)).toBeTruthy());
  });

  it('the all-3 card opens the chest reveal', async () => {
    mocks.claimBountyAction.mockResolvedValue({
      ok: true,
      coins: 40,
      card: { id: 'i1', slug: 'jp', packSlug: 'flags-v1', nameZh: '日本', nameEn: 'Japan', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 },
    });
    render(
      <WantedPosters childId="k1" posters={[poster({ hanzi: '周', progress: 2 })]} />,
    );
    fireEvent.click(screen.getByTestId('bounty-claim-周'));
    await waitFor(() => expect(screen.getByTestId('card-chest-reveal')).toBeTruthy());
  });

  it('claimed posters show ✓ and no button', () => {
    render(
      <WantedPosters childId="k1" posters={[poster({ hanzi: '难', claimed: true, progress: 2 })]} />,
    );
    expect(screen.getByText(/已领/)).toBeTruthy();
    expect(screen.queryByTestId('bounty-claim-难')).toBeNull();
  });
});
