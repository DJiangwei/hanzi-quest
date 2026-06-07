import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock requireChild ─────────────────────────────────────────────────────────
vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(),
}));

// ── Mock next/cache ───────────────────────────────────────────────────────────
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ── Mock @/db ─────────────────────────────────────────────────────────────────
const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));
vi.mock('@/db', () => ({
  db: {
    transaction: mockTransaction,
  },
}));

// ── Mock @/lib/db/home ────────────────────────────────────────────────────────
const { mockPlaceFurnitureInTx, mockRemoveFurnitureInTx } = vi.hoisted(() => ({
  mockPlaceFurnitureInTx: vi.fn(),
  mockRemoveFurnitureInTx: vi.fn(),
}));
vi.mock('@/lib/db/home', () => ({
  placeFurnitureInTx: mockPlaceFurnitureInTx,
  removeFurnitureInTx: mockRemoveFurnitureInTx,
}));

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  FurnitureNotOwnedError,
  CellOccupiedError,
  InvalidPlacementError,
} from '@/lib/errors/home-errors';
import {
  placeFurnitureAction,
  removeFurnitureAction,
} from '@/lib/actions/home';

const CHILD_ID = 'child-abc-123';
const CHILD = { id: CHILD_ID, displayName: 'Yinuo' };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: requireChild succeeds
  vi.mocked(requireChild).mockResolvedValue({
    child: CHILD as never,
    parent: {} as never,
  });
  // Default: transaction runs the callback
  mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb({}),
  );
  // Default: DB calls succeed
  mockPlaceFurnitureInTx.mockResolvedValue(undefined);
  mockRemoveFurnitureInTx.mockResolvedValue(undefined);
});

// ─── placeFurnitureAction ─────────────────────────────────────────────────────

describe('placeFurnitureAction', () => {
  it('calls requireChild with the given childId', async () => {
    await placeFurnitureAction(CHILD_ID, 'bedroom', 'chair-wood', 2, 3);
    expect(requireChild).toHaveBeenCalledWith(CHILD_ID);
  });

  it('passes the placement to placeFurnitureInTx inside a transaction', async () => {
    await placeFurnitureAction(CHILD_ID, 'living', 'rug-round', 1, 4);
    expect(mockPlaceFurnitureInTx).toHaveBeenCalledWith(
      expect.anything(),
      CHILD_ID,
      'living',
      'rug-round',
      1,
      4,
    );
  });

  it('returns {ok:true} and revalidates on success', async () => {
    const result = await placeFurnitureAction(CHILD_ID, 'bedroom', 'chair-wood', 2, 3);
    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/play/${CHILD_ID}/home`);
  });

  it('returns {ok:false, reason} for FurnitureNotOwnedError', async () => {
    mockTransaction.mockImplementation(() => {
      throw new FurnitureNotOwnedError('chair-wood');
    });
    const result = await placeFurnitureAction(CHILD_ID, 'bedroom', 'chair-wood', 2, 3);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns {ok:false, reason} for CellOccupiedError', async () => {
    mockTransaction.mockImplementation(() => {
      throw new CellOccupiedError('bedroom', 2, 3);
    });
    const result = await placeFurnitureAction(CHILD_ID, 'bedroom', 'chair-wood', 2, 3);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns {ok:false, reason} for InvalidPlacementError', async () => {
    mockTransaction.mockImplementation(() => {
      throw new InvalidPlacementError('out of bounds');
    });
    const result = await placeFurnitureAction(CHILD_ID, 'bedroom', 'chair-wood', 2, 3);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rethrows unknown errors', async () => {
    mockTransaction.mockImplementation(() => {
      throw new Error('DB connection lost');
    });
    await expect(
      placeFurnitureAction(CHILD_ID, 'bedroom', 'chair-wood', 2, 3),
    ).rejects.toThrow('DB connection lost');
  });
});

// ─── removeFurnitureAction ────────────────────────────────────────────────────

describe('removeFurnitureAction', () => {
  it('calls requireChild with the given childId', async () => {
    await removeFurnitureAction(CHILD_ID, 'chair-wood');
    expect(requireChild).toHaveBeenCalledWith(CHILD_ID);
  });

  it('passes removal to removeFurnitureInTx inside a transaction', async () => {
    await removeFurnitureAction(CHILD_ID, 'rug-round');
    expect(mockRemoveFurnitureInTx).toHaveBeenCalledWith(
      expect.anything(),
      CHILD_ID,
      'rug-round',
    );
  });

  it('returns {ok:true} and revalidates on success', async () => {
    const result = await removeFurnitureAction(CHILD_ID, 'chair-wood');
    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/play/${CHILD_ID}/home`);
  });

  it('returns {ok:false, reason} for any home error', async () => {
    mockTransaction.mockImplementation(() => {
      throw new FurnitureNotOwnedError('chair-wood');
    });
    const result = await removeFurnitureAction(CHILD_ID, 'chair-wood');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rethrows unknown errors', async () => {
    mockTransaction.mockImplementation(() => {
      throw new Error('unexpected');
    });
    await expect(removeFurnitureAction(CHILD_ID, 'chair-wood')).rejects.toThrow(
      'unexpected',
    );
  });
});
