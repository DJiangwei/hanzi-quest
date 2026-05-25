import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
const powerupMock = vi.hoisted(() => ({
  consumePowerupAtomic: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/powerups', () => ({
  consumePowerupAtomic: powerupMock.consumePowerupAtomic,
}));

import { tickStreak } from '@/lib/db/streaks';

beforeEach(() => {
  for (const m of Object.values(dbMock)) m.mockReset();
  powerupMock.consumePowerupAtomic.mockReset();
  // UPSERT mock chain
  dbMock.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    }),
  });
});

function setupPriorState(prior: {
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
}) {
  dbMock.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          { ...prior, freezeTokens: 0 },
        ]),
      }),
    }),
  });
}

describe('tickStreak — freeze auto-burn', () => {
  it('gap > 1 + freeze available → preserves streak, decrements freeze, marks freezeBurned', async () => {
    setupPriorState({ currentStreak: 5, longestStreak: 10, lastPlayedDate: '2026-05-22' });
    powerupMock.consumePowerupAtomic.mockResolvedValue(true);
    const tick = await tickStreak('c1', '2026-05-25');
    expect(tick.currentStreak).toBe(6);
    expect(tick.reset).toBe(false);
    expect(tick.freezeBurned).toBe(true);
    expect(powerupMock.consumePowerupAtomic).toHaveBeenCalledWith('c1', 'streak_freeze');
  });

  it('gap > 1 + no freeze → resets streak to 1', async () => {
    setupPriorState({ currentStreak: 5, longestStreak: 10, lastPlayedDate: '2026-05-22' });
    powerupMock.consumePowerupAtomic.mockResolvedValue(false);
    const tick = await tickStreak('c1', '2026-05-25');
    expect(tick.currentStreak).toBe(1);
    expect(tick.reset).toBe(true);
    expect(tick.freezeBurned).toBe(false);
  });

  it('gap = 1 → normal +1 (no freeze consumed)', async () => {
    setupPriorState({ currentStreak: 5, longestStreak: 10, lastPlayedDate: '2026-05-24' });
    const tick = await tickStreak('c1', '2026-05-25');
    expect(tick.currentStreak).toBe(6);
    expect(tick.freezeBurned).toBe(false);
    expect(powerupMock.consumePowerupAtomic).not.toHaveBeenCalled();
  });

  it('gap = 0 → no change', async () => {
    setupPriorState({ currentStreak: 5, longestStreak: 10, lastPlayedDate: '2026-05-25' });
    const tick = await tickStreak('c1', '2026-05-25');
    expect(tick.ticked).toBe(false);
    expect(tick.currentStreak).toBe(5);
    expect(tick.freezeBurned).toBe(false);
    expect(powerupMock.consumePowerupAtomic).not.toHaveBeenCalled();
  });

  it('first ever play (no lastPlayedDate) → streak = 1, no freeze attempted', async () => {
    setupPriorState({ currentStreak: 0, longestStreak: 0, lastPlayedDate: null });
    const tick = await tickStreak('c1', '2026-05-25');
    expect(tick.currentStreak).toBe(1);
    expect(tick.freezeBurned).toBe(false);
    expect(powerupMock.consumePowerupAtomic).not.toHaveBeenCalled();
  });
});
