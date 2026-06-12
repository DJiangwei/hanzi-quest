import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock builders — must be created before any import resolution
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const insertOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const dbSelectMock = vi.fn();
  const dbInsertMock = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: insertOnConflictDoNothing,
    })),
  }));

  return {
    // evaluator mocks
    countCompletedLevels: vi.fn(),
    countDistinctBossWeeks: vi.fn(),
    isPerfectWeek: vi.fn(),
    lifetimeEarned: vi.fn(),
    isPackComplete: vi.fn(),
    longestStreak: vi.fn(),
    getCompletedFlagContinents: vi.fn(),
    // collections DB mock
    getPackBySlug: vi.fn(),
    // db mocks
    insertOnConflictDoNothing,
    dbSelectMock,
    dbInsertMock,
  };
});

// ---------------------------------------------------------------------------
// Module mocks — evaluated before imports below
// ---------------------------------------------------------------------------

// Mock the evaluators so checkAndGrantTrophies can be tested in isolation
vi.mock('@/lib/db/trophies-evaluators', () => ({
  countCompletedLevels: mocks.countCompletedLevels,
  countDistinctBossWeeks: mocks.countDistinctBossWeeks,
  isPerfectWeekForChild: mocks.isPerfectWeek,
  getLifetimeEarned: mocks.lifetimeEarned,
  isPackComplete: mocks.isPackComplete,
  getLongestStreak: mocks.longestStreak,
  getCompletedFlagContinents: mocks.getCompletedFlagContinents,
}));

vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: mocks.getPackBySlug,
}));

// Stub the @/db module.
// checkAndGrantTrophies uses:
//   1. db.select() → resolve slugs to trophy rows  (.from().where())
//   2. db.select() → fetch already-earned          (.from().where())
//   3. db.insert() → grant new trophies            (.values().onConflictDoNothing())
vi.mock('@/db', () => ({
  db: {
    select: mocks.dbSelectMock,
    insert: mocks.dbInsertMock,
  },
}));

// ---------------------------------------------------------------------------
// Import under test (after all vi.mock calls)
// ---------------------------------------------------------------------------
import { checkAndGrantTrophies } from '@/lib/db/trophies';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A fixture trophy row returned by the first db.select (slug→row). */
const makeTrophyRow = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  nameZh: '测试',
  nameEn: 'Test',
  emoji: '🏆',
  category: 'mastery' as const,
  displayOrder: 1,
  loreZh: null,
  loreEn: null,
  createdAt: new Date(),
});

/**
 * Set up db.select() to:
 *   - first call  → returns trophy rows for the given slugs
 *   - second call → returns [] (nothing already earned)
 *
 * Each call uses the chain .from().where() → resolvedValue.
 */
function setupSelectForNewGrants(slugs: string[]) {
  const trophyRows = slugs.map(makeTrophyRow);

  const makeSelectChain = (resolvedRows: object[]) => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(resolvedRows),
    })),
  });

  mocks.dbSelectMock
    .mockReturnValueOnce(makeSelectChain(trophyRows)) // slug → rows
    .mockReturnValueOnce(makeSelectChain([]));         // already-earned → empty
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Restore persistent mock implementations
  mocks.insertOnConflictDoNothing.mockResolvedValue(undefined);
});

describe('checkAndGrantTrophies', () => {
  // ── boss-clear ────────────────────────────────────────────────────────────

  it('boss-clear: grants first-boss', async () => {
    mocks.countDistinctBossWeeks.mockResolvedValue(1);
    setupSelectForNewGrants(['first-boss']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'boss-clear', weekId: 'w1' });

    expect(granted.map((g) => g.slug)).toContain('first-boss');
    expect(granted.map((g) => g.slug)).not.toContain('boss-trio');
  });

  it('boss-clear: grants boss-trio when 3+ distinct boss weeks', async () => {
    mocks.countDistinctBossWeeks.mockResolvedValue(3);
    setupSelectForNewGrants(['first-boss', 'boss-trio']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'boss-clear', weekId: 'w1' });

    expect(granted.map((g) => g.slug)).toContain('boss-trio');
  });

  // ── continent-complete ────────────────────────────────────────────────────

  it('continent-complete: grants a trophy for each fully-owned continent', async () => {
    mocks.getCompletedFlagContinents.mockResolvedValue(['asia', 'europe']);
    setupSelectForNewGrants(['continent-asia', 'continent-europe']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'continent-complete' });

    expect(granted.map((g) => g.slug)).toEqual(
      expect.arrayContaining(['continent-asia', 'continent-europe']),
    );
  });

  it('continent-complete: returns [] when no continent is complete', async () => {
    mocks.getCompletedFlagContinents.mockResolvedValue([]);

    const granted = await checkAndGrantTrophies('c1', { kind: 'continent-complete' });

    expect(granted).toEqual([]);
  });

  // ── perfect-week ──────────────────────────────────────────────────────────

  it('perfect-week: grants perfect-week when week qualifies', async () => {
    mocks.isPerfectWeek.mockResolvedValue(true);
    setupSelectForNewGrants(['perfect-week']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'perfect-week', weekId: 'w1' });

    expect(granted.map((g) => g.slug)).toContain('perfect-week');
  });

  it('perfect-week: returns [] when week is not perfect', async () => {
    mocks.isPerfectWeek.mockResolvedValue(false);

    const granted = await checkAndGrantTrophies('c1', { kind: 'perfect-week', weekId: 'w1' });

    expect(granted).toHaveLength(0);
    expect(mocks.dbSelectMock).not.toHaveBeenCalled();
  });

  // ── level-complete ────────────────────────────────────────────────────────

  it('level-complete: grants 100-levels at threshold; not 500', async () => {
    mocks.countCompletedLevels.mockResolvedValue(100);
    mocks.longestStreak.mockResolvedValue(0);
    setupSelectForNewGrants(['100-levels']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'level-complete' });

    const slugs = granted.map((g) => g.slug);
    expect(slugs).toContain('100-levels');
    expect(slugs).not.toContain('500-levels');
  });

  it('level-complete: grants streak-7 when longestStreak is 7', async () => {
    mocks.countCompletedLevels.mockResolvedValue(1);
    mocks.longestStreak.mockResolvedValue(7);
    setupSelectForNewGrants(['streak-7']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'level-complete' });

    expect(granted.map((g) => g.slug)).toContain('streak-7');
  });

  // ── coin-award ────────────────────────────────────────────────────────────

  it('coin-award: grants coins-100 at 100 lifetime coins', async () => {
    mocks.lifetimeEarned.mockResolvedValue(100);
    setupSelectForNewGrants(['coins-100']);

    const granted = await checkAndGrantTrophies('c1', { kind: 'coin-award' });

    expect(granted.map((g) => g.slug)).toContain('coins-100');
  });

  // ── pack-complete ─────────────────────────────────────────────────────────

  it('pack-complete: grants collect-zodiac for zodiac slug when complete', async () => {
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-id-zodiac', slug: 'zodiac-v1' });
    mocks.isPackComplete.mockResolvedValue(true);
    setupSelectForNewGrants(['collect-zodiac']);

    const granted = await checkAndGrantTrophies('c1', {
      kind: 'pack-complete',
      packSlug: 'zodiac-v1',
    });

    expect(granted.map((g) => g.slug)).toContain('collect-zodiac');
  });

  it('pack-complete: returns [] for unknown pack slug', async () => {
    const granted = await checkAndGrantTrophies('c1', {
      kind: 'pack-complete',
      packSlug: 'nonexistent-pack',
    });

    expect(granted).toHaveLength(0);
    expect(mocks.dbSelectMock).not.toHaveBeenCalled();
  });

  // ── scene-clear ───────────────────────────────────────────────────────────

  it('scene-clear: grants first-pinyin-pick when score=100', async () => {
    setupSelectForNewGrants(['first-pinyin-pick']);

    const granted = await checkAndGrantTrophies('c1', {
      kind: 'scene-clear',
      sceneType: 'pinyin_pick',
      score: 100,
    });

    expect(granted.map((g) => g.slug)).toContain('first-pinyin-pick');
  });

  it('scene-clear: does NOT grant when score < 100', async () => {
    const granted = await checkAndGrantTrophies('c1', {
      kind: 'scene-clear',
      sceneType: 'pinyin_pick',
      score: 50,
    });

    expect(granted).toHaveLength(0);
    expect(mocks.dbSelectMock).not.toHaveBeenCalled();
  });

  // ── sound-theme-equip ─────────────────────────────────────────────────────

  it('sound-theme-equip: grants equip-sound-theme for non-default slug', async () => {
    setupSelectForNewGrants(['equip-sound-theme']);

    const granted = await checkAndGrantTrophies('c1', {
      kind: 'sound-theme-equip',
      slug: 'theme-nautical',
    });

    expect(granted.map((g) => g.slug)).toContain('equip-sound-theme');
  });

  it('sound-theme-equip: does NOT grant for "default" slug', async () => {
    const granted = await checkAndGrantTrophies('c1', {
      kind: 'sound-theme-equip',
      slug: 'default',
    });

    expect(granted).toHaveLength(0);
    expect(mocks.dbSelectMock).not.toHaveBeenCalled();
  });

  it('sound-theme-equip: does NOT grant for null slug', async () => {
    const granted = await checkAndGrantTrophies('c1', {
      kind: 'sound-theme-equip',
      slug: null,
    });

    expect(granted).toHaveLength(0);
    expect(mocks.dbSelectMock).not.toHaveBeenCalled();
  });
});
