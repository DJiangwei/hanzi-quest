import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  // select chain: db.select().from().where().limit()
  const selectWhereLimit = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ limit: selectWhereLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  // insert chain: db.insert().values().onConflictDoUpdate()
  const insertOnConflict = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertOnConflict });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  // update chain: db.update().set().where()
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    select,
    selectFrom,
    selectWhere,
    selectWhereLimit,
    insert,
    insertValues,
    insertOnConflict,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock('@/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
  },
}));

import {
  getParentSettings,
  setParentPin,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/db/parent-settings';

beforeEach(() => {
  mocks.selectWhereLimit.mockReset();
  mocks.select.mockClear();
  mocks.insert.mockClear();
  mocks.insertValues.mockClear();
  mocks.insertOnConflict.mockClear();
  mocks.update.mockClear();
  mocks.updateSet.mockClear();
  mocks.updateWhere.mockClear();
  // Re-wire chains after clear
  mocks.selectWhereLimit.mockResolvedValue([]);
  mocks.insertOnConflict.mockResolvedValue(undefined);
  mocks.updateWhere.mockResolvedValue(undefined);
});

describe('parent-settings', () => {
  it('getParentSettings returns null when no row', async () => {
    mocks.selectWhereLimit.mockResolvedValueOnce([]);
    const result = await getParentSettings('user_abc');
    expect(result).toBeNull();
  });

  it('getParentSettings returns row when present', async () => {
    const row = {
      clerkUserId: 'user_abc',
      parentPinHash: '$2b$10$abc',
      pinSetAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    };
    mocks.selectWhereLimit.mockResolvedValueOnce([row]);
    const result = await getParentSettings('user_abc');
    expect(result).toEqual(row);
  });

  it('setParentPin upserts hashed PIN and resets attempt counters', async () => {
    await setParentPin('user_abc', '$2b$10$newhash');
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: 'user_abc',
        parentPinHash: '$2b$10$newhash',
        failedAttempts: 0,
        lockedUntil: null,
      }),
    );
  });

  it('recordFailedAttempt increments and sets lockedUntil when threshold reached', async () => {
    await recordFailedAttempt('user_abc', /* currentAttempts */ 4);
    expect(mocks.update).toHaveBeenCalled();
    // The call sets failedAttempts=5 and lockedUntil to ~now+5min.
    const setArg = mocks.updateSet.mock.calls[0][0];
    expect(setArg.failedAttempts).toBe(5);
    expect(setArg.lockedUntil).toBeInstanceOf(Date);
  });

  it('recordFailedAttempt with attempts<4 only increments, no lock', async () => {
    await recordFailedAttempt('user_abc', /* currentAttempts */ 2);
    const setArg = mocks.updateSet.mock.calls[0][0];
    expect(setArg.failedAttempts).toBe(3);
    expect(setArg.lockedUntil).toBeUndefined();
  });

  it('clearFailedAttempts resets both', async () => {
    await clearFailedAttempts('user_abc');
    expect(mocks.update).toHaveBeenCalled();
    const setArg = mocks.updateSet.mock.calls[0][0];
    expect(setArg.failedAttempts).toBe(0);
    expect(setArg.lockedUntil).toBeNull();
  });
});
