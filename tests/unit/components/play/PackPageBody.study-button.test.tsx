import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/gacha', () => ({ swapShardsForItem: vi.fn(), convertDuplicateToShard: vi.fn() }));
// PackPageBody's CardDetailDialog mounts GiftDialog, which imports
// `giftCardAction` from a 'use server' file that transitively pulls in
// `@/db` + `next/cache`. Mock it directly — see the note in
// card-detail-dialog.test.tsx.
vi.mock('@/lib/actions/crew', () => ({ giftCardAction: vi.fn() }));

const NO_GIFTING = { crew: [], ownersByItem: {}, giftsSentToday: 0 };

import { STUDY_MIN_OWNED } from '@/lib/play/study';
import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem } from '@/lib/db/collections';

function item(id: string): CollectibleItem {
  return { id, packId: 'p', slug: id, nameZh: id, nameEn: id, loreZh: null, loreEn: null, rarity: 'common', dropWeight: 1, imageUrl: null, createdAt: new Date() };
}
const items = ['a', 'b', 'c', 'd'].map(item);

describe('PackPageBody study button', () => {
  it('shows the 学习 CTA enabled at the minimum owned count', () => {
    render(<PackPageBody childId="c1" packSlug="animals-v1" items={items} ownedItemIds={['a', 'b', 'c', 'd', 'e', 'f']} ownedItems={[]} balance={0} shardCount={0} {...NO_GIFTING} />);
    const btn = screen.getByTestId('study-cta');
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent(/学习/);
  });
  it('shows the collect hint below the minimum, quoting the real number', () => {
    render(<PackPageBody childId="c1" packSlug="animals-v1" items={items} ownedItemIds={['a']} ownedItems={[]} balance={0} shardCount={0} {...NO_GIFTING} />);
    expect(screen.getByTestId('study-cta')).toBeDisabled();
    // Quotes STUDY_MIN_OWNED rather than a literal: the copy used to say "3"
    // while the gate read the constant, so the two could disagree silently.
    expect(screen.getByText(new RegExp(`收集 ${STUDY_MIN_OWNED} 张`))).toBeInTheDocument();
  });
});
