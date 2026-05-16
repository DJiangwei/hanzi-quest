// tests/unit/gacha-pull-button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actions/gacha', () => ({
  pullPaid: vi.fn(),
}));

import { pullPaid } from '@/lib/actions/gacha';
import { GachaPullButton } from '@/components/play/GachaPullButton';

describe('GachaPullButton', () => {
  it('disables button when balance < cost', () => {
    render(
      <GachaPullButton
        balance={300}
        cost={500}
        packSlug="zodiac-v1"
        childId="c1"
        onResult={() => undefined}
      />,
    );
    const btn = screen.getByRole('button', { name: /抽卡/ });
    expect(btn).toBeDisabled();
  });

  it('calls pullPaid on click when enabled', async () => {
    vi.mocked(pullPaid).mockResolvedValue({
      item: { id: 'i1', slug: 'rabbit', nameZh: '兔', nameEn: 'Rabbit', loreZh: null, loreEn: null } as never,
      wasDuplicate: false,
      shardsAfter: null,
      coinsAfter: 500,
    });
    const onResult = vi.fn();
    const user = userEvent.setup();
    render(
      <GachaPullButton balance={1000} cost={500} packSlug="zodiac-v1" childId="c1" onResult={onResult} />,
    );
    await user.click(screen.getByRole('button', { name: /抽卡/ }));
    expect(pullPaid).toHaveBeenCalledWith('zodiac-v1', { childId: 'c1' });
  });
});
