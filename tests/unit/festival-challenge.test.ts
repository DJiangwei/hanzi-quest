import { describe, expect, it, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  claimRows: [] as unknown[],
  tx: null as unknown,
  activity: [] as { dateIso: string; played: boolean }[],
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => Promise.resolve(h.claimRows) }),
    }),
    transaction: async (cb: (tx: unknown) => unknown) => cb(h.tx),
  },
}));

vi.mock('@/lib/db/activity', () => ({
  getActivityForRange: () => Promise.resolve(h.activity),
}));

import {
  getMonthlyChallengeState,
  claimFestivalReward,
} from '@/lib/db/festival-challenge';

function playedDays(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    dateIso: `2026-06-${String(i + 1).padStart(2, '0')}`,
    played: true,
  }));
}

/** A tx stub mirroring grant tests: configurable item/owned rows + claim collision. */
function makeTx(opts: {
  claimThrows?: boolean;
  itemRows: unknown[];
  ownedRows: unknown[];
  avatarRows?: unknown[];
}) {
  let insertCalls = 0;
  // Query order: card item → owned collection → avatar cosmetic item.
  const selectQueue = [opts.itemRows, opts.ownedRows, opts.avatarRows ?? []];
  let si = 0;
  const makeSelect = (): unknown => ({
    from: () => makeSelect(),
    innerJoin: () => makeSelect(),
    // `.where()` is awaited directly (card query) AND can chain `.limit()`
    // (cosmetic query) — return a thenable that also exposes limit().
    where: () => {
      const rows = selectQueue[si++] ?? [];
      return {
        limit: () => Promise.resolve(rows),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
      };
    },
  });
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        insertCalls++;
        if (insertCalls === 1 && opts.claimThrows) {
          throw { code: '23505' };
        }
        // Awaitable, and chainable for onConflictDo*.
        return {
          onConflictDoNothing: () => Promise.resolve(undefined),
          onConflictDoUpdate: () => Promise.resolve(undefined),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(undefined).then(resolve),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
    select: vi.fn(() => makeSelect()),
  };
}

beforeEach(() => {
  h.claimRows = [];
  h.tx = null;
  h.activity = [];
});

describe('getMonthlyChallengeState', () => {
  it('is eligible at/above the threshold when unclaimed', async () => {
    h.activity = playedDays(12); // June threshold = 12
    h.claimRows = [];
    const s = await getMonthlyChallengeState('c1', '2026-06');
    expect(s.activeDays).toBe(12);
    expect(s.threshold).toBe(12);
    expect(s.claimed).toBe(false);
    expect(s.eligible).toBe(true);
    expect(s.theme.cardSlug).toBe('dragon-boat');
  });

  it('is not eligible below the threshold', async () => {
    h.activity = playedDays(5);
    const s = await getMonthlyChallengeState('c1', '2026-06');
    expect(s.activeDays).toBe(5);
    expect(s.eligible).toBe(false);
  });

  it('is not eligible (but counts days) once already claimed', async () => {
    h.activity = playedDays(20);
    h.claimRows = [{ monthKey: '2026-06' }];
    const s = await getMonthlyChallengeState('c1', '2026-06');
    expect(s.claimed).toBe(true);
    expect(s.eligible).toBe(false);
  });
});

describe('claimFestivalReward', () => {
  it('returns not_eligible below the threshold (no transaction)', async () => {
    h.activity = playedDays(3);
    const r = await claimFestivalReward('c1', '2026-06');
    expect(r.granted).toBe(false);
    if (!r.granted) expect(r.reason).toBe('not_eligible');
  });

  it('grants the festival card + auto-equips the cosmetic when eligible', async () => {
    h.activity = playedDays(15);
    h.tx = makeTx({
      itemRows: [
        {
          id: 'fi1',
          slug: 'dragon-boat',
          nameZh: '端午节',
          nameEn: 'Dragon Boat Festival',
          loreZh: '赛龙舟',
          loreEn: 'Dragon boats',
        },
      ],
      ownedRows: [],
      avatarRows: [{ id: 'av1', slotId: 'hat' }],
    });
    const r = await claimFestivalReward('c1', '2026-06');
    expect(r.granted).toBe(true);
    if (r.granted) {
      expect(r.card.slug).toBe('dragon-boat');
      expect(r.card.packSlug).toBe('festivals-v1');
      expect(r.card.isDupe).toBe(false);
      // June theme cosmetic = festival-dragon on the hat slot.
      expect(r.cosmetic).toEqual({ unlockRef: 'festival-dragon', slotId: 'hat' });
    }
  });

  it('still grants the card when the cosmetic item is not seeded (cosmetic=null)', async () => {
    h.activity = playedDays(15);
    h.tx = makeTx({
      itemRows: [
        {
          id: 'fi1',
          slug: 'dragon-boat',
          nameZh: '端午节',
          nameEn: 'Dragon Boat Festival',
          loreZh: null,
          loreEn: null,
        },
      ],
      ownedRows: [],
      avatarRows: [], // no avatar item row → cosmetic skipped
    });
    const r = await claimFestivalReward('c1', '2026-06');
    expect(r.granted).toBe(true);
    if (r.granted) expect(r.cosmetic).toBeNull();
  });

  it('returns already_claimed on a PK collision (23505)', async () => {
    h.activity = playedDays(15);
    h.tx = makeTx({ claimThrows: true, itemRows: [], ownedRows: [] });
    const r = await claimFestivalReward('c1', '2026-06');
    expect(r.granted).toBe(false);
    if (!r.granted) expect(r.reason).toBe('already_claimed');
  });
});
