import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/gacha', () => ({ swapShardsForItem: vi.fn(), convertDuplicateToShard: vi.fn() }));

import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem } from '@/lib/db/collections';

function item(id: string): CollectibleItem {
  return { id, packId: 'p', slug: id, nameZh: id, nameEn: id, loreZh: null, loreEn: null, rarity: 'common', dropWeight: 1, imageUrl: null, createdAt: new Date() };
}
const items = ['a', 'b', 'c', 'd'].map(item);

describe('PackPageBody study button', () => {
  it('shows the 学习 CTA enabled when ≥3 owned', () => {
    render(<PackPageBody childId="c1" packSlug="animals-v1" items={items} ownedItemIds={['a', 'b', 'c']} ownedItems={[]} balance={0} shardCount={0} />);
    const btn = screen.getByTestId('study-cta');
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent(/学习/);
  });
  it('shows the collect-3 hint when fewer than 3 owned', () => {
    render(<PackPageBody childId="c1" packSlug="animals-v1" items={items} ownedItemIds={['a']} ownedItems={[]} balance={0} shardCount={0} />);
    expect(screen.getByTestId('study-cta')).toBeDisabled();
    expect(screen.getByText(/收集 3 张/)).toBeInTheDocument();
  });
});
