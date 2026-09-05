import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  sumValue: 0,
  orderBy: [] as unknown[],
}));

vi.mock('@/db', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: (...a: unknown[]) => {
      mocks.orderBy = a;
      return chain;
    },
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

import { PgDialect } from 'drizzle-orm/pg-core';
import { getActiveSeason, getSeasonXp } from '@/lib/db/season';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

beforeEach(() => {
  mocks.rows = [];
  mocks.sumValue = 0;
  mocks.orderBy = [];
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

  it('getActiveSeason ORDERS the active rows — a bare limit(1) is non-deterministic', async () => {
    // `is_active` is set by a seed script and cleared by hand, so two active
    // rows is the normal state during a changeover. Without an ORDER BY,
    // Postgres may return either — and possibly a different one between
    // requests. Symptom: "the season page sometimes shows the wrong season".
    //
    // Rendered through PgDialect rather than asserted behaviourally: the mock
    // returns a fixed rowset, so no amount of returned data can prove which
    // ordering asked for it.
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
    await getActiveSeason();
    expect(mocks.orderBy).toHaveLength(1);
    const q = new PgDialect().sqlToQuery(mocks.orderBy[0] as never);
    expect(q.sql).toContain('"starts_at"');
    expect(q.sql).toMatch(/desc/i);
  });
});
