import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  consumePowerupAtomic: vi.fn(),
  getPowerupCounts: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/powerups', () => ({
  consumePowerupAtomic: mocks.consumePowerupAtomic,
  getPowerupCounts: mocks.getPowerupCounts,
  recordSkippedAttempt: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { useHintAction } from '@/lib/actions/powerups';

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
});

describe('useHintAction', () => {
  it('decrements + returns remaining count', async () => {
    mocks.consumePowerupAtomic.mockResolvedValue(true);
    mocks.getPowerupCounts.mockResolvedValue({ hint: 2, skip: 1, streak_freeze: 0 });
    const result = await useHintAction('c1');
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(2);
    expect(mocks.consumePowerupAtomic).toHaveBeenCalledWith('c1', 'hint');
  });

  it('returns ok=false when count was 0', async () => {
    mocks.consumePowerupAtomic.mockResolvedValue(false);
    mocks.getPowerupCounts.mockResolvedValue({ hint: 0, skip: 1, streak_freeze: 0 });
    const result = await useHintAction('c1');
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
