import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  insertManualEntry: vi.fn(),
  deleteManualEntry: vi.fn(),
  getPiggyBalance: vi.fn(),
  enablePiggyBankWithBackfill: vi.fn(),
  disablePiggyBank: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/piggy', () => ({
  insertManualEntry: mocks.insertManualEntry,
  deleteManualEntry: mocks.deleteManualEntry,
  getPiggyBalance: mocks.getPiggyBalance,
}));
vi.mock('@/lib/db/piggy-backfill', () => ({
  enablePiggyBankWithBackfill: mocks.enablePiggyBankWithBackfill,
  disablePiggyBank: mocks.disablePiggyBank,
}));

import {
  addPiggyCreditAction,
  deletePiggyEntryAction,
  recordPiggyPurchaseAction,
  reconcilePiggyAction,
  setPiggyEnabledAction,
} from '@/lib/actions/piggy';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' }, parent: { id: 'p1' } });
  mocks.insertManualEntry.mockResolvedValue({ id: 'e1' });
});

describe('auth', () => {
  // Named explicitly, one row per exported action — a sixth action added
  // later without an entry here would silently pass this suite, which is
  // exactly the gap the previous single-case version of this test had (it
  // only ever exercised addPiggyCreditAction). The static export-set pin in
  // distribution-isolation-guard.test.ts is the backstop for a NEW action
  // shipping with no gate at all; this table's job is to prove that when
  // requireChild rejects, each of these five specific actions rejects too
  // and never reaches its underlying db write.
  const cases: Array<{
    name: string;
    call: () => Promise<unknown>;
    dbMocks: Array<keyof typeof mocks>;
  }> = [
    {
      name: 'addPiggyCreditAction',
      call: () =>
        addPiggyCreditAction({ childId: 'other', pounds: '5', note: 'x' }),
      dbMocks: ['insertManualEntry'],
    },
    {
      name: 'recordPiggyPurchaseAction',
      call: () =>
        recordPiggyPurchaseAction({
          childId: 'other',
          pounds: '5',
          category: 'toys',
          note: '',
        }),
      dbMocks: ['insertManualEntry'],
    },
    {
      name: 'reconcilePiggyAction',
      call: () =>
        reconcilePiggyAction({ childId: 'other', actualPounds: '5' }),
      dbMocks: ['getPiggyBalance', 'insertManualEntry'],
    },
    {
      name: 'deletePiggyEntryAction',
      call: () =>
        deletePiggyEntryAction({ childId: 'other', entryId: 'e1' }),
      dbMocks: ['deleteManualEntry'],
    },
    {
      name: 'setPiggyEnabledAction',
      call: () =>
        setPiggyEnabledAction({ childId: 'other', enabled: true }),
      dbMocks: ['enablePiggyBankWithBackfill', 'disablePiggyBank'],
    },
  ];

  it.each(cases)(
    '$name gates on requireChild — assertParent only proves "signed in"',
    async ({ call, dbMocks }) => {
      mocks.requireChild.mockRejectedValue(new Error('Not found'));
      await expect(call()).rejects.toThrow();
      for (const key of dbMocks) {
        expect(mocks[key]).not.toHaveBeenCalled();
      }
    },
  );
});

describe('addPiggyCreditAction', () => {
  it('stores a positive delta in pence', async () => {
    await addPiggyCreditAction({ childId: 'c1', pounds: '2.50', note: 'Birthday' });
    expect(mocks.insertManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', source: 'parent_credit', pence: 250 }),
    );
  });

  it('rejects an unparseable or zero amount without writing', async () => {
    await expect(
      addPiggyCreditAction({ childId: 'c1', pounds: 'lots', note: '' }),
    ).resolves.toEqual({ ok: false, error: 'invalid_amount' });
    await expect(
      addPiggyCreditAction({ childId: 'c1', pounds: '0', note: '' }),
    ).resolves.toEqual({ ok: false, error: 'invalid_amount' });
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('recordPiggyPurchaseAction', () => {
  it('stores a NEGATIVE delta with its category', async () => {
    await recordPiggyPurchaseAction({
      childId: 'c1', pounds: '3.00', category: 'toys', note: 'Lego',
    });
    expect(mocks.insertManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'purchase', pence: -300, category: 'toys' }),
    );
  });

  it('rejects an unknown category', async () => {
    await expect(
      recordPiggyPurchaseAction({
        childId: 'c1', pounds: '3.00', category: 'crypto', note: '',
      }),
    ).resolves.toEqual({ ok: false, error: 'invalid_category' });
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('reconcilePiggyAction', () => {
  it('writes the difference between the jar and the ledger', async () => {
    mocks.getPiggyBalance.mockResolvedValue(1000);
    await expect(
      reconcilePiggyAction({ childId: 'c1', actualPounds: '9.40' }),
    ).resolves.toEqual({ ok: true, adjustedPence: -60 });
    expect(mocks.insertManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'reconcile', pence: -60 }),
    );
  });

  it('writes NOTHING when the jar already agrees', async () => {
    mocks.getPiggyBalance.mockResolvedValue(1000);
    await expect(
      reconcilePiggyAction({ childId: 'c1', actualPounds: '10.00' }),
    ).resolves.toEqual({ ok: true, adjustedPence: 0 });
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('deletePiggyEntryAction', () => {
  it('reports refusal when the row was auto-earned and thus immutable', async () => {
    mocks.deleteManualEntry.mockResolvedValue(false);
    await expect(
      deletePiggyEntryAction({ childId: 'c1', entryId: 'auto-1' }),
    ).resolves.toEqual({ ok: false, error: 'not_deletable' });
  });
});

describe('setPiggyEnabledAction', () => {
  it('enabling runs the backfill and reports what it credited', async () => {
    mocks.enablePiggyBankWithBackfill.mockResolvedValue({
      creditedPence: 1400, entries: 12,
    });
    await expect(
      setPiggyEnabledAction({ childId: 'c1', enabled: true }),
    ).resolves.toEqual({ ok: true, creditedPence: 1400, entries: 12 });
  });

  it('disabling keeps the ledger — money earned stays earned', async () => {
    await expect(
      setPiggyEnabledAction({ childId: 'c1', enabled: false }),
    ).resolves.toEqual({ ok: true, creditedPence: 0, entries: 0 });
    expect(mocks.disablePiggyBank).toHaveBeenCalledWith('c1');
  });
});
