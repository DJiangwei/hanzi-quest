import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { homeworkItems } from '@/db/schema';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert, update: mocks.update, delete: mocks.delete } }));

import { listHomeworkItems, weekHasHomework, updateHomeworkItem, deleteHomeworkItem } from '@/lib/db/homework';

beforeEach(() => vi.clearAllMocks());

describe('homework db', () => {
  // Regression guard for the homework IDOR (Finding 4): a scoped UPDATE/DELETE
  // that matches nothing silently affects zero rows rather than throwing, so
  // these assert on the exact `where` clause built — not on rejection — using
  // the real (unmocked) `and`/`eq` from drizzle-orm for a structural match.
  // Reverting to `where(eq(homeworkItems.id, id))` alone fails both.
  it('updateHomeworkItem scopes the UPDATE by id + childId + weekId (IDOR guard)', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    mocks.update.mockReturnValue({ set: setSpy });

    await updateHomeworkItem('c1', 'w1', 'h1', { tokens: ['我', '爱'] });

    expect(whereSpy).toHaveBeenCalledWith(
      and(
        eq(homeworkItems.id, 'h1'),
        eq(homeworkItems.childId, 'c1'),
        eq(homeworkItems.weekId, 'w1'),
      ),
    );
  });

  it('deleteHomeworkItem scopes the DELETE by id + childId + weekId (IDOR guard)', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    mocks.delete.mockReturnValue({ where: whereSpy });

    await deleteHomeworkItem('c1', 'w1', 'h1');

    expect(whereSpy).toHaveBeenCalledWith(
      and(
        eq(homeworkItems.id, 'h1'),
        eq(homeworkItems.childId, 'c1'),
        eq(homeworkItems.weekId, 'w1'),
      ),
    );
  });

  it('listHomeworkItems orders by position', async () => {
    const rows = [{ id: 'h1', childId: 'c1', weekId: 'w1', position: 0, type: 'char_quiz', config: {} }];
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }),
    });
    const items = await listHomeworkItems('c1', 'w1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('h1');
  });

  it('weekHasHomework returns true when at least one row exists', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'h1' }]) }) }),
    });
    expect(await weekHasHomework('c1', 'w1')).toBe(true);
  });

  it('weekHasHomework returns false when none', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    expect(await weekHasHomework('c1', 'w1')).toBe(false);
  });
});
