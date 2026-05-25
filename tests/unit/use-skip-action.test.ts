import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  consumePowerupAtomic: vi.fn(),
  getPowerupCounts: vi.fn(),
  recordSkippedAttempt: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/powerups', () => ({
  consumePowerupAtomic: mocks.consumePowerupAtomic,
  getPowerupCounts: mocks.getPowerupCounts,
  recordSkippedAttempt: mocks.recordSkippedAttempt,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { useSkipAction } from '@/lib/actions/powerups';

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
});

describe('useSkipAction', () => {
  it('decrements + records skipped attempt + returns remaining', async () => {
    mocks.consumePowerupAtomic.mockResolvedValue(true);
    mocks.recordSkippedAttempt.mockResolvedValue(undefined);
    mocks.getPowerupCounts.mockResolvedValue({ hint: 1, skip: 0, streak_freeze: 0 });
    const result = await useSkipAction('c1', 'wl-1', 'sess-1');
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(0);
    expect(mocks.recordSkippedAttempt).toHaveBeenCalledWith('sess-1', 'wl-1');
  });

  it('returns ok=false + does NOT record attempt when count was 0', async () => {
    mocks.consumePowerupAtomic.mockResolvedValue(false);
    mocks.getPowerupCounts.mockResolvedValue({ hint: 1, skip: 0, streak_freeze: 0 });
    const result = await useSkipAction('c1', 'wl-1', 'sess-1');
    expect(result.ok).toBe(false);
    expect(mocks.recordSkippedAttempt).not.toHaveBeenCalled();
  });
});
