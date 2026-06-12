import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert, update: mocks.update, delete: mocks.delete } }));

import { listHomeworkItems, weekHasHomework } from '@/lib/db/homework';

beforeEach(() => vi.clearAllMocks());

describe('homework db', () => {
  it('listHomeworkItems orders by position', async () => {
    const rows = [{ id: 'h1', weekId: 'w1', position: 0, type: 'char_quiz', config: {} }];
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }),
    });
    const items = await listHomeworkItems('w1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('h1');
  });

  it('weekHasHomework returns true when at least one row exists', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'h1' }]) }) }),
    });
    expect(await weekHasHomework('w1')).toBe(true);
  });

  it('weekHasHomework returns false when none', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    expect(await weekHasHomework('w1')).toBe(false);
  });
});
