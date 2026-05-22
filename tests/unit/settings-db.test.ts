import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhereLimit = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ limit: selectWhereLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const insertOnConflict = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertOnConflict });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return { select, selectFrom, selectWhere, selectWhereLimit, insert, insertValues, insertOnConflict };
});

vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert } }));

import { getChildSettings, setSoundTheme } from '@/lib/db/settings';

beforeEach(() => {
  mocks.selectWhereLimit.mockReset();
  mocks.select.mockClear();
  mocks.insert.mockClear();
  mocks.insertValues.mockClear();
  mocks.insertOnConflict.mockClear();
});

describe('getChildSettings', () => {
  it('returns null when no row exists', async () => {
    mocks.selectWhereLimit.mockResolvedValue([]);
    expect(await getChildSettings('c1')).toBeNull();
  });

  it('returns the row when one exists', async () => {
    mocks.selectWhereLimit.mockResolvedValue([
      { childId: 'c1', soundThemeSlug: 'theme-nautical' },
    ]);
    const row = await getChildSettings('c1');
    expect(row?.soundThemeSlug).toBe('theme-nautical');
  });
});

describe('setSoundTheme', () => {
  it('upserts the row via onConflictDoUpdate', async () => {
    await setSoundTheme('c1', 'theme-music-box');
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', soundThemeSlug: 'theme-music-box' }),
    );
    expect(mocks.insertOnConflict).toHaveBeenCalledTimes(1);
  });

  it('upserts NULL when slug is null (revert to default)', async () => {
    await setSoundTheme('c1', null);
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', soundThemeSlug: null }),
    );
  });
});
