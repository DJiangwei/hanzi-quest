import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], sumValue: 0 }));

vi.mock('@/db', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(mocks.rows),
  };
  return {
    db: {
      select: (sel?: Record<string, unknown>) =>
        sel && 'total' in sel
          ? { from: () => ({ where: () => Promise.resolve([{ total: mocks.sumValue }]) }) }
          : chain,
    },
  };
});

import { getActiveSeason, getSeasonXp } from '@/lib/db/season';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

beforeEach(() => {
  mocks.rows = [];
  mocks.sumValue = 0;
});

describe('season db reads', () => {
  it('getActiveSeason returns null when no active row', async () => {
    mocks.rows = [];
    expect(await getActiveSeason()).toBeNull();
  });

  it('getActiveSeason maps a row to SeasonRow with parsed tierConfig', async () => {
    mocks.rows = [
      {
        id: 's1',
        nameZh: '夏',
        nameEn: 'Summer',
        themeEmoji: '⛵',
        startsAt: new Date('2026-06-15'),
        endsAt: new Date('2026-08-10'),
        tierConfig: SUMMER_VOYAGE_TIERS,
        isActive: true,
      },
    ];
    const s = await getActiveSeason();
    expect(s?.id).toBe('s1');
    expect(s?.tierConfig).toHaveLength(30);
  });

  it('getSeasonXp returns the windowed sum', async () => {
    mocks.sumValue = 1234;
    const s = {
      startsAt: new Date('2026-06-15'),
      endsAt: new Date('2026-08-10'),
    };
    expect(await getSeasonXp('c1', s)).toBe(1234);
  });
});
