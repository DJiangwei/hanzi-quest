import { describe, expect, it, vi, beforeEach } from 'vitest';
vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (id: string) => ({
    parent: { id: 'p' },
    child: { id },
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const listMapsForChild = vi.fn();
const setCurrentPackForChild = vi.fn();
vi.mock('@/lib/db/maps', () => ({
  listMapsForChild: (...a: unknown[]) => listMapsForChild(...a),
  setCurrentPackForChild: (...a: unknown[]) => setCurrentPackForChild(...a),
}));
import { switchMapAction } from '@/lib/actions/maps';
import { MapLockedError } from '@/lib/errors/maps-errors';

beforeEach(() => vi.clearAllMocks());

describe('switchMapAction gating', () => {
  it('throws MapLockedError for a gated map', async () => {
    listMapsForChild.mockResolvedValue([
      { packId: 'p2', isLocked: true, gated: true },
    ]);
    await expect(switchMapAction('c1', 'p2')).rejects.toBeInstanceOf(
      MapLockedError,
    );
    expect(setCurrentPackForChild).not.toHaveBeenCalled();
  });
});
