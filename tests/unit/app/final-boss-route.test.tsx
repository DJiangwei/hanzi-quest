import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireChild = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  parent: { id: 'p' },
  child: { id: 'c1' },
}));
vi.mock('@/lib/auth/guards', () => ({
  requireChild: (...a: unknown[]) => requireChild(...a),
}));
const redirect = vi.fn((..._a: unknown[]) => {
  throw new Error('redirect');
});
const notFound = vi.fn(() => {
  throw new Error('notFound');
});
vi.mock('next/navigation', () => ({
  redirect: (...a: unknown[]) => redirect(...a),
  notFound: () => notFound(),
}));
const getPackBySlug = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  id: 'pk',
  slug: 'pirate-class-level-1',
  name: 'Caribbean',
}));
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
}));
const isMapFullyCleared = vi.fn<(...a: unknown[]) => unknown>();
vi.mock('@/lib/db/final-boss', () => ({
  isMapFullyCleared: (...a: unknown[]) => isMapFullyCleared(...a),
}));
vi.mock('@/lib/db/weeks', () => ({
  listChildPlayableWeeks: vi.fn(async () => [
    { id: 'w1', curriculumPackId: 'pk' },
  ]),
}));
vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: vi.fn(async () => [
    {
      id: 'ch1',
      hanzi: '好',
      pinyinArray: ['hǎo'],
      meaningEn: 'good',
      meaningZh: null,
      imageHook: null,
      words: [],
      sentence: null,
    },
  ]),
}));
vi.mock('@/lib/collections/packRegistry', () => ({
  getPackMeta: () => ({ displayNameZh: '加勒比海', displayNameEn: 'Caribbean' }),
}));
vi.mock('@/components/scenes/FinalBossRunner', () => ({
  FinalBossRunner: () => <div data-testid="fb-runner" />,
}));

import FinalBossPage from '@/app/play/[childId]/final-boss/[packSlug]/page';

beforeEach(() => {
  vi.clearAllMocks();
  getPackBySlug.mockResolvedValue({
    id: 'pk',
    slug: 'pirate-class-level-1',
    name: 'Caribbean',
  });
});

describe('final-boss route', () => {
  it('redirects to /maps when the map is not fully cleared', async () => {
    isMapFullyCleared.mockResolvedValue(false);
    await expect(
      FinalBossPage({
        params: Promise.resolve({
          childId: 'c1',
          packSlug: 'pirate-class-level-1',
        }),
      }),
    ).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith('/play/c1/maps');
  });

  it('renders the runner when fully cleared', async () => {
    isMapFullyCleared.mockResolvedValue(true);
    const ui = await FinalBossPage({
      params: Promise.resolve({
        childId: 'c1',
        packSlug: 'pirate-class-level-1',
      }),
    });
    const { render, screen } = await import('@testing-library/react');
    render(ui);
    expect(screen.getByTestId('fb-runner')).toBeInTheDocument();
  });
});
