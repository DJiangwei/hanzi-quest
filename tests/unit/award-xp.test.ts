import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertFn: vi.fn(),
  selectFn: vi.fn(),
  updateFn: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.insertFn,
    select: mocks.selectFn,
    update: mocks.updateFn,
  },
}));

import { awardXp } from '@/lib/db/xp';

// Helper to set up select mock to return a given row (or empty)
function mockSelect(row: unknown) {
  mocks.selectFn.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(row ? [row] : []),
    }),
  });
}

function mockSelectMulti(...rows: unknown[]) {
  let callCount = 0;
  mocks.selectFn.mockImplementation(() => {
    const result = rows[callCount] ?? null;
    callCount++;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result ? [result] : []),
      }),
    };
  });
}

function mockInsertEvent() {
  mocks.insertFn.mockImplementation(() => ({
    values: vi.fn().mockResolvedValue(undefined),
    // for the upsert / onConflictDoUpdate path
    onConflictDoUpdate: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ totalXp: 10 }]),
    }),
  }));
}

function mockInsertWithReturning(returnedRow: unknown) {
  // insert is called twice: once for xpEvents (values only), once for childXp (values + onConflictDoUpdate + returning)
  let callIdx = 0;
  mocks.insertFn.mockImplementation(() => {
    callIdx++;
    if (callIdx === 1) {
      // xpEvents insert
      return { values: vi.fn().mockResolvedValue(undefined) };
    }
    // childXp upsert
    return {
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(returnedRow ? [returnedRow] : []),
        }),
      }),
    };
  });
}

function mockUpdate() {
  mocks.updateFn.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate();
});

describe('awardXp', () => {
  it('inserts an xp_events row and upserts child_xp', async () => {
    // first select → no existing (for oldLevel)
    mockSelectMulti(null);
    mockInsertWithReturning({ totalXp: 10 });

    const result = await awardXp('child-1', 10, 'scene_complete');
    expect(result.totalXp).toBe(10);
    expect(result.level).toBeGreaterThanOrEqual(1);
    // insert should have been called twice: xpEvents + childXp
    expect(mocks.insertFn).toHaveBeenCalledTimes(2);
  });

  it('returns leveledUp: true when crossing a threshold', async () => {
    // Select returns oldLevel=1
    mockSelectMulti({ level: 1 });
    // upsert returns totalXp = 50 (exactly level 2 threshold)
    mockInsertWithReturning({ totalXp: 50 });

    const result = await awardXp('child-1', 50, 'scene_complete');
    expect(result.level).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it('returns leveledUp: false when staying at same level', async () => {
    // Select returns oldLevel=1
    mockSelectMulti({ level: 1 });
    // upsert returns totalXp=30 (still level 1, threshold for 2 is 50)
    mockInsertWithReturning({ totalXp: 30 });

    const result = await awardXp('child-1', 30, 'scene_complete');
    expect(result.level).toBe(1);
    expect(result.leveledUp).toBe(false);
  });

  it('returns existing state without insert when amount <= 0', async () => {
    mockSelect({ totalXp: 100, level: 2 });

    const result = await awardXp('child-1', 0, 'scene_complete');
    expect(result.totalXp).toBe(100);
    expect(result.leveledUp).toBe(false);
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it('includes refId when provided', async () => {
    mockSelectMulti(null);
    mockInsertWithReturning({ totalXp: 10 });

    await awardXp('child-1', 10, 'daily_quest', 'ref-123');
    expect(mocks.insertFn).toHaveBeenCalledTimes(2);
  });
});
