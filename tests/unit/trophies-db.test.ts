import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectFromOrderBy = vi.fn();
  const selectFromWhereInnerJoinWhere = vi.fn();
  return { selectFromOrderBy, selectFromWhereInnerJoinWhere };
});

vi.mock('@/db', () => {
  // Builder that handles:
  //   listAllTrophies:     .select().from().orderBy()
  //   listEarnedTrophies:  .select().from().innerJoin().where()
  const innerJoinBuilder = { where: vi.fn(() => mocks.selectFromWhereInnerJoinWhere()) };
  const fromBuilder = {
    orderBy: vi.fn(() => mocks.selectFromOrderBy()),
    where: vi.fn(() => mocks.selectFromOrderBy()),
    innerJoin: vi.fn(() => innerJoinBuilder),
  };
  return { db: { select: vi.fn(() => ({ from: vi.fn(() => fromBuilder) })) } };
});

import { listAllTrophies, listEarnedTrophies } from '@/lib/db/trophies';

beforeEach(() => {
  mocks.selectFromOrderBy.mockReset();
  mocks.selectFromWhereInnerJoinWhere.mockReset();
});

describe('listAllTrophies', () => {
  it('returns the rows ordered by (category, displayOrder)', async () => {
    mocks.selectFromOrderBy.mockResolvedValue([
      { slug: 'first-boss', category: 'mastery', displayOrder: 1 },
      { slug: 'streak-7', category: 'streak', displayOrder: 10 },
    ]);
    const rows = await listAllTrophies();
    expect(rows).toHaveLength(2);
    expect(rows[0].slug).toBe('first-boss');
  });
});

describe('listEarnedTrophies', () => {
  it('returns trophy ids + earned_at for a child', async () => {
    mocks.selectFromWhereInnerJoinWhere.mockResolvedValue([
      { trophyId: 't1', slug: 'first-boss', earnedAt: new Date('2026-05-23') },
    ]);
    const rows = await listEarnedTrophies('c1');
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('first-boss');
  });
});
