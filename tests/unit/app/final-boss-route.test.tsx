import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireChild = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  parent: { id: 'p' },
  child: { id: 'c1' },
}));
vi.mock('@/lib/auth/guards', () => ({
  requireChild: (...a: unknown[]) => requireChild(...a),
}));
const redirect = vi.fn<(...a: unknown[]) => never>(() => {
  throw new Error('redirect');
});
const notFound = vi.fn(() => {
  throw new Error('notFound');
});
vi.mock('next/navigation', () => ({
  redirect: (...a: unknown[]) => redirect(...a),
  notFound: () => notFound(),
}));
const getSharedCurriculumPackBySlug = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  id: 'pk',
  slug: 'pirate-class-level-1',
  name: '海盗班 Level 1',
  nameZh: '加勒比海',
  nameEn: 'Caribbean Sea',
}));
vi.mock('@/lib/db/curriculum', () => ({
  getSharedCurriculumPackBySlug: (...a: unknown[]) =>
    getSharedCurriculumPackBySlug(...a),
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
const finalBossRunnerProps = vi.fn();
vi.mock('@/components/scenes/FinalBossRunner', () => ({
  FinalBossRunner: (props: unknown) => {
    finalBossRunnerProps(props);
    return <div data-testid="fb-runner" />;
  },
}));

import FinalBossPage from '@/app/play/[childId]/final-boss/[packSlug]/page';

beforeEach(() => {
  vi.clearAllMocks();
  getSharedCurriculumPackBySlug.mockResolvedValue({
    id: 'pk',
    slug: 'pirate-class-level-1',
    name: '海盗班 Level 1',
    nameZh: '加勒比海',
    nameEn: 'Caribbean Sea',
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

  it('looks the map up in curriculum_packs, not collection_packs', async () => {
    isMapFullyCleared.mockResolvedValue(true);
    await FinalBossPage({
      params: Promise.resolve({ childId: 'c1', packSlug: 'pirate-class-level-1' }),
    });
    // Regression guard: `pirate-class-level-1` has no row in collection_packs,
    // so resolving it there returned null and the route 404'd in production.
    expect(getSharedCurriculumPackBySlug).toHaveBeenCalledWith('pirate-class-level-1');
  });

  it('passes the bilingual map name to FinalBossRunner, not the internal class label', async () => {
    isMapFullyCleared.mockResolvedValue(true);
    // name ('海盗班 Level 1') is the internal class label; nameZh/nameEn are the
    // real bilingual map name. Regression guard for the getPackMeta() bug: that
    // helper is keyed by COLLECTIBLE pack slug and always returned null for a
    // curriculum slug, so both props silently fell back to `name`.
    const ui = await FinalBossPage({
      params: Promise.resolve({ childId: 'c1', packSlug: 'pirate-class-level-1' }),
    });
    const { render } = await import('@testing-library/react');
    render(ui);
    expect(finalBossRunnerProps).toHaveBeenCalledWith(
      expect.objectContaining({ mapNameZh: '加勒比海', mapNameEn: 'Caribbean Sea' }),
    );
  });

  it('falls back to name when the bilingual columns are null (e.g. school-custom)', async () => {
    isMapFullyCleared.mockResolvedValue(true);
    getSharedCurriculumPackBySlug.mockResolvedValue({
      id: 'pk2',
      slug: 'school-custom',
      name: 'School (custom)',
      nameZh: null,
      nameEn: null,
    });
    const ui = await FinalBossPage({
      params: Promise.resolve({ childId: 'c1', packSlug: 'school-custom' }),
    });
    const { render } = await import('@testing-library/react');
    render(ui);
    expect(finalBossRunnerProps).toHaveBeenCalledWith(
      expect.objectContaining({ mapNameZh: 'School (custom)', mapNameEn: 'School (custom)' }),
    );
  });
});
