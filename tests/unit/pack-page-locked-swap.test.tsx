// 钥匙宝库 / 海域霸主 are proof-of-clear packs: their cards can never be bought
// with shards. The server refuses it (swapShardsInTx → 'pack_locked'); this
// pins that the UI does not offer it in the first place, and says why instead
// of silently omitting a control the child saw on every other pack page.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/gacha', () => ({
  swapShardsForItem: vi.fn(),
  convertDuplicateToShard: vi.fn(),
}));
// PackPageBody's CardDetailDialog mounts GiftDialog, which imports
// giftCardAction from a 'use server' file that transitively pulls in @/db.
vi.mock('@/lib/actions/crew', () => ({ giftCardAction: vi.fn() }));

import { PackPageBody } from '@/components/play/PackPageBody';

const item = (id: string) => ({
  id,
  slug: `s-${id}`,
  packId: 'pack-1',
  nameZh: '宝藏',
  nameEn: 'Treasure',
  loreZh: null,
  loreEn: null,
  imageUrl: null,
  rarity: 'epic' as const,
  dropWeight: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

function renderPack(packSlug: string) {
  return render(
    <PackPageBody
      childId="c1"
      packSlug={packSlug}
      items={[item('a'), item('b')]}
      ownedItemIds={[]}
      ownedItems={[]}
      balance={0}
      shardCount={999}
      crew={[]}
      ownersByItem={{}}
      giftsSentToday={0}
    />,
  );
}

describe('PackPageBody — locked packs offer no shard swap', () => {
  for (const packSlug of ['key-vault-v1', 'champions-v1']) {
    it(`shows no swap chip on ${packSlug}, even with shards to spare`, () => {
      renderPack(packSlug);
      expect(screen.queryAllByTestId('swap-chip')).toHaveLength(0);
    });

    it(`explains WHY ${packSlug} cannot be traded, bilingually`, () => {
      renderPack(packSlug);
      const note = screen.getByTestId('locked-pack-note');
      expect(note.textContent).toMatch(/[一-鿿]/);
      expect(note.textContent).toMatch(/[A-Za-z]/);
    });
  }

  it('still offers the swap on an ordinary pack', () => {
    renderPack('zodiac-v1');
    expect(screen.queryAllByTestId('swap-chip').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('locked-pack-note')).not.toBeInTheDocument();
  });

  it('still offers the swap on a timed exclusive — those keep their recovery path', () => {
    renderPack('festivals-v1');
    expect(screen.queryAllByTestId('swap-chip').length).toBeGreaterThan(0);
  });
});
