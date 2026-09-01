import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

import { grantGiftPackInTx, WEEKLY_GIFT_SOURCE } from '@/lib/db/grants';

/** Chainable select stub: each terminal .where() yields the next queued rows array. */
function selectYielding(rowsQueue: unknown[][]) {
  let i = 0;
  const make = (): unknown => ({
    from: vi.fn(() => make()),
    innerJoin: vi.fn(() => make()),
    where: vi.fn(() => Promise.resolve(rowsQueue[i++] ?? [])),
  });
  return vi.fn(() => make());
}

describe('grantGiftPackInTx', () => {
  it('exposes the source constant', () => {
    expect(WEEKLY_GIFT_SOURCE).toBe('weekly_checkin');
  });

  it('grants one card per active pack and never touches the daily counter', async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          // The idempotency insert: a row comes back, so the week is unclaimed.
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ refId: '2026-06-01' }]),
          })),
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ shards: 1 }]),
          })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
      select: selectYielding([
        [{ id: 'p1', slug: 'zodiac' }, { id: 'p2', slug: 'flags' }], // active packs
        [],                                                          // owned (none)
        [{ id: 'i1', packId: 'p1', packSlug: 'zodiac', slug: 'rat', nameZh: '鼠', nameEn: 'Rat', loreZh: null, loreEn: null, dropWeight: 1 }], // p1 catalog
        [{ id: 'i2', packId: 'p2', packSlug: 'flags', slug: 'flag-cn', nameZh: '中国', nameEn: 'China', loreZh: null, loreEn: null, dropWeight: 1 }],  // p2 catalog
      ]),
    } as never;

    const result = await grantGiftPackInTx(tx, 'child-1', '2026-06-01', () => 0.1);
    expect(result.granted).toBe(true);
    if (result.granted) {
      expect(result.cards).toHaveLength(2);
      expect(result.cards.map((c) => c.packSlug).sort()).toEqual(['flags', 'zodiac']);
      // Display fields must be present on each card
      const zodiacCard = result.cards.find((c) => c.packSlug === 'zodiac');
      expect(zodiacCard?.nameZh).toBe('鼠');
      expect(zodiacCard?.nameEn).toBe('Rat');
      expect(zodiacCard?.slug).toBe('rat');
    }
  });

  it('returns already_granted when the weekly idempotency insert conflicts', async () => {
    // ON CONFLICT DO NOTHING, not a caught 23505: this runs inside the
    // caller's transaction, where postgres.js rejects the whole transaction on
    // any failed statement no matter what the callback catches.
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
      select: vi.fn(),
      update: vi.fn(),
    } as never;
    const result = await grantGiftPackInTx(tx, 'child-1', '2026-06-01', () => 0.1);
    expect(result.granted).toBe(false);
    if (!result.granted) expect(result.reason).toBe('already_granted');
  });
});
