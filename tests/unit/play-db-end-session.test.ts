import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { playSessions } from '@/db/schema';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
}));
vi.mock('@/db', () => ({ db: { update: mocks.update } }));

import { endPlaySession } from '@/lib/db/play';

beforeEach(() => vi.clearAllMocks());

describe('endPlaySession db (F8: scoped by childId)', () => {
  // Regression guard: endPlaySession used to filter only on the
  // client-supplied sessionId, after a requireChild guard on a *different*
  // resource — the same IDOR shape as the homework finding (see
  // tests/unit/homework-db.test.ts). A scoped UPDATE matching nothing
  // silently affects zero rows rather than throwing, so this asserts on the
  // exact `where` clause built (the real, unmocked drizzle-orm `and`/`eq`)
  // rather than on rejection. Reverting to
  // `where(eq(playSessions.id, sessionId))` alone fails this.
  it('scopes the UPDATE by sessionId + childId', async () => {
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    mocks.update.mockReturnValue({ set: setSpy });

    await endPlaySession('s1', 'c1', { weekId: 'w1', completionPercent: 100 });

    expect(whereSpy).toHaveBeenCalledWith(
      and(eq(playSessions.id, 's1'), eq(playSessions.childId, 'c1')),
    );
  });
});
