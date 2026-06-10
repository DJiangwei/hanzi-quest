import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'c1' } }),
}));
vi.mock('@/lib/db/activity', () => ({
  getActivityForRange: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/db/streaks', () => ({
  getStreakState: vi.fn().mockResolvedValue({
    currentStreak: 7,
    longestStreak: 14,
    lastPlayedDate: '2026-05-15',
    freezeTokens: 0,
  }),
  todayUtcIso: vi.fn(() => '2026-05-15'),
}));
vi.mock('@/lib/db/festival-challenge', () => ({
  getMonthlyChallengeState: vi.fn().mockResolvedValue({
    theme: {
      month: 5,
      cardSlug: 'start-summer',
      nameZh: '立夏',
      nameEn: 'Start of Summer',
      emoji: '🍃',
      thresholdDays: 12,
      blurbZh: '夏天来了',
      blurbEn: 'Summer begins',
    },
    activeDays: 0,
    threshold: 12,
    claimed: false,
    eligible: false,
  }),
}));
// FestivalChallengePanel (rendered by MonthCalendar) pulls the action + reveal;
// mock them so the page's module graph doesn't load the real @/db chain.
vi.mock('@/lib/actions/festival', () => ({
  claimFestivalRewardAction: vi.fn(),
}));
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: () => null,
}));

import CalendarPage from '@/app/play/[childId]/calendar/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CalendarPage', () => {
  it('renders for current month when no yyyymm param', async () => {
    const result = await CalendarPage({
      params: Promise.resolve({ childId: 'c1' }),
      searchParams: Promise.resolve({}),
    });
    expect(result).toBeDefined();
  });

  it('renders for a specific yyyymm', async () => {
    const result = await CalendarPage({
      params: Promise.resolve({ childId: 'c1' }),
      searchParams: Promise.resolve({ yyyymm: '2026-04' }),
    });
    expect(result).toBeDefined();
  });
});
