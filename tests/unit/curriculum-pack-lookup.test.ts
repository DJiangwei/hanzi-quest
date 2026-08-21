import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as { id: string; slug: string; name: string }[],
  whereArgs: [] as unknown[],
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (arg: unknown) => {
          mocks.whereArgs.push(arg);
          return { limit: async () => mocks.rows };
        },
      }),
    }),
  },
}));

import { getSharedCurriculumPackBySlug } from '@/lib/db/curriculum';

beforeEach(() => {
  mocks.rows = [];
  mocks.whereArgs = [];
});

describe('getSharedCurriculumPackBySlug', () => {
  it('returns the shared curriculum pack row for a map slug', async () => {
    mocks.rows = [{ id: 'pk1', slug: 'pirate-class-level-1', name: '海盗班 Level 1' }];
    const pack = await getSharedCurriculumPackBySlug('pirate-class-level-1');
    expect(pack).toEqual({ id: 'pk1', slug: 'pirate-class-level-1', name: '海盗班 Level 1' });
  });

  it('returns null when no shared pack has that slug', async () => {
    mocks.rows = [];
    expect(await getSharedCurriculumPackBySlug('nope')).toBeNull();
  });

  it('filters on owner_user_id IS NULL (school-custom repeats per family)', async () => {
    mocks.rows = [];
    await getSharedCurriculumPackBySlug('school-custom');
    // The where() clause must be a composite (and(...)), not a bare eq on slug.
    expect(mocks.whereArgs).toHaveLength(1);
    // Real drizzle Column objects back-reference their PgTable, which in turn
    // exposes every column (including the one being serialized) — a genuine
    // cycle, so a plain JSON.stringify throws. A circular-safe replacer lets
    // us still assert the `owner_user_id` column made it into the where tree.
    const seen = new WeakSet<object>();
    const serialized = JSON.stringify(mocks.whereArgs[0], (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
    expect(serialized).toContain('owner_user_id');
  });
});
