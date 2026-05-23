import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const evalMock = vi.hoisted(() => ({
  countOwnedDecorations: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/trophies-evaluators', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/db/trophies-evaluators')>();
  return { ...orig, countOwnedDecorations: evalMock.countOwnedDecorations };
});

import { checkAndGrantTrophies } from '@/lib/db/trophies';

function setupTrophyLookups(slugsRequested: string[], alreadyEarnedIds: string[] = []) {
  const trophyRows = slugsRequested.map((s, i) => ({
    id: `tid-${i}`,
    slug: s,
    nameZh: `zh-${s}`,
    nameEn: `en-${s}`,
    emoji: '🏆',
  }));
  const trophiesByCheck = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(trophyRows),
    }),
  };
  const earnedCheck = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(alreadyEarnedIds.map((id) => ({ trophyId: id }))),
    }),
  };
  dbMock.select
    .mockReturnValueOnce(trophiesByCheck)
    .mockReturnValueOnce(earnedCheck);
  dbMock.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return trophyRows;
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.insert.mockReset();
  evalMock.countOwnedDecorations.mockReset();
});

describe('decor-purchase trophy grants', () => {
  it('grants decor-starter at 1 owned', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(1);
    setupTrophyLookups(['decor-starter']);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result.map((t) => t.slug)).toEqual(['decor-starter']);
  });

  it('grants both starter + completionist at 10 owned', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(10);
    setupTrophyLookups(['decor-starter', 'decor-completionist']);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result.map((t) => t.slug).sort()).toEqual(['decor-completionist', 'decor-starter']);
  });

  it('grants nothing at 0 owned', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(0);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result).toEqual([]);
  });

  it('idempotent: already-earned trophies are filtered out', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(10);
    setupTrophyLookups(['decor-starter', 'decor-completionist'], ['tid-0', 'tid-1']);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result).toEqual([]);
  });
});
