// T2 通缉令 — claimBountyInTx outcomes + the auth-gated claim action.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  claimBountyInTx: vi.fn(),
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
  pullCardForChild: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-07-18' }));
vi.mock('@/lib/db/bounties', () => ({ claimBountyInTx: mocks.claimBountyInTx }));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/db', () => ({
  db: { transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn({})) },
}));

import { claimBountyAction } from '@/lib/actions/bounty';

const GRANTED = {
  granted: true,
  itemId: 'i1',
  packId: 'p1',
  packSlug: 'flags-v1',
  slug: 'jp',
  nameZh: '日本',
  nameEn: 'Japan',
  loreZh: null,
  loreEn: null,
  isDupe: false,
  shardsAfter: 0,
  cardsToday: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
  mocks.awardXp.mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false });
});

describe('claimBountyAction', () => {
  it('pays coins + XP on a completed poster (no card until all 3)', async () => {
    mocks.claimBountyInTx.mockResolvedValue({ ok: true, coins: 40, allClaimedToday: false });
    const res = await claimBountyAction('c1', 'char-1');
    expect(res).toEqual({ ok: true, coins: 40, card: null });
    expect(mocks.awardXp).toHaveBeenCalledWith('c1', 10, 'bounty_claim', '2026-07-18:char-1');
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/play/c1');
  });

  it('the LAST claim of the day pulls the bounty card (cap-consuming source)', async () => {
    mocks.claimBountyInTx.mockResolvedValue({ ok: true, coins: 40, allClaimedToday: true });
    mocks.pullCardForChild.mockResolvedValue(GRANTED);
    const res = await claimBountyAction('c1', 'char-3');
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'bounty', '2026-07-18');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.card).toMatchObject({ slug: 'jp', packSlug: 'flags-v1' });
  });

  it('a cap-blocked card pull still succeeds with coins (card: null)', async () => {
    mocks.claimBountyInTx.mockResolvedValue({ ok: true, coins: 40, allClaimedToday: true });
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'daily_cap_reached', cardsToday: 10 });
    const res = await claimBountyAction('c1', 'char-3');
    expect(res).toEqual({ ok: true, coins: 40, card: null });
  });

  it('failure outcomes pass through without side effects', async () => {
    for (const reason of ['not_found', 'not_ready', 'already_claimed'] as const) {
      mocks.claimBountyInTx.mockResolvedValue({ ok: false, reason });
      const res = await claimBountyAction('c1', 'char-1');
      expect(res).toEqual({ ok: false, reason });
    }
    expect(mocks.awardXp).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('an XP failure never undoes a successful claim', async () => {
    mocks.claimBountyInTx.mockResolvedValue({ ok: true, coins: 40, allClaimedToday: false });
    mocks.awardXp.mockRejectedValue(new Error('xp down'));
    const res = await claimBountyAction('c1', 'char-1');
    expect(res).toEqual({ ok: true, coins: 40, card: null });
  });
});
