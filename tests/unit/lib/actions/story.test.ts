import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbStoryMock = vi.hoisted(() => ({
  upsertStoryChapter: vi.fn(),
  getStoryChapterByWeek: vi.fn(),
  getLatestBossScoreForChildWeek: vi.fn(),
  getCharactersAvailableForChildWeek: vi.fn(),
  markChapterRead: vi.fn(() => Promise.resolve({ wasNew: true })),
  listStoryChaptersForChild: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/db/story', () => dbStoryMock);

const gachaMock = vi.hoisted(() => ({
  pullCardForChild: vi.fn(() =>
    Promise.resolve({ granted: true, packSlug: 'zodiac-v1', itemId: 'item-1' }),
  ),
}));
vi.mock('@/lib/actions/gacha', () => gachaMock);
vi.mock('@/lib/play/card-grants', () => gachaMock);

const aiMock = vi.hoisted(() => ({
  generateStoryChapterWithAI: vi.fn(),
}));
vi.mock('@/lib/ai/deepseek-story', () => aiMock);

const trophiesMock = vi.hoisted(() => ({
  checkAndGrantTrophies: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/db/trophies', () => trophiesMock);

const authMock = vi.hoisted(() => ({
  requireChild: vi.fn(),
}));
vi.mock('@/lib/auth/guards', () => authMock);

const shopDbMock = vi.hoisted(() => ({
  getEquippedAvatar: vi.fn(),
}));
vi.mock('@/lib/db/shop', () => shopDbMock);

const petsDbMock = vi.hoisted(() => ({
  getEquippedPet: vi.fn(),
}));
vi.mock('@/lib/db/pets', () => petsDbMock);

const cacheMock = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => cacheMock);

const weeksDbMock = vi.hoisted(() => ({
  getPlayableWeekForChild: vi.fn(),
}));
vi.mock('@/lib/db/weeks', () => weeksDbMock);

const charsDbMock = vi.hoisted(() => ({
  getCharactersWithDetailsForWeek: vi.fn(),
}));
vi.mock('@/lib/db/characters', () => charsDbMock);

function slotEquip(unlockRef: string) {
  return {
    avatarItemId: `item-${unlockRef}`,
    unlockRef,
    slotId: 'slot',
    isDefault: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireChild.mockResolvedValue({
    child: { id: 'k1', displayName: 'Yinuo' },
  });
  weeksDbMock.getPlayableWeekForChild.mockResolvedValue({ id: 'w1' });
  charsDbMock.getCharactersWithDetailsForWeek.mockResolvedValue([
    { hanzi: '红' },
  ]);
  dbStoryMock.getCharactersAvailableForChildWeek.mockResolvedValue([
    '我',
    '红',
  ]);
  shopDbMock.getEquippedAvatar.mockResolvedValue({
    head: slotEquip('kid-default'),
    hat: slotEquip('red-bandana'),
    top: slotEquip('striped-tee'),
    background: slotEquip('ocean-frame'),
  });
  petsDbMock.getEquippedPet.mockResolvedValue(null);
});

describe('generateStoryChapter', () => {
  it('returns existing chapter without re-calling AI', async () => {
    const existing = { id: 'c1', weekId: 'w1' };
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(existing);
    const { generateStoryChapter } = await import('@/lib/actions/story');
    const result = await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(result).toEqual(existing);
    expect(aiMock.generateStoryChapterWithAI).not.toHaveBeenCalled();
    expect(trophiesMock.checkAndGrantTrophies).not.toHaveBeenCalled();
  });

  it('derives tone=triumphant when boss score >= 95', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(100);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x',
      bodyEn: 'y',
      summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({
      id: 'cN',
      tone: 'triumphant',
    });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'triumphant' }),
    );
    expect(dbStoryMock.upsertStoryChapter).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'triumphant', bossScorePct: 100 }),
    );
  });

  it('derives tone=narrow_escape when boss score < 67', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(50);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x',
      bodyEn: 'y',
      summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({
      id: 'cN',
      tone: 'narrow_escape',
    });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'narrow_escape' }),
    );
  });

  it('uses tone=standard for mid-range scores (e.g. 80)', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x',
      bodyEn: 'y',
      summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({
      id: 'cN',
      tone: 'standard',
    });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'standard' }),
    );
  });

  it('grants the first-chapter trophy after successful insert', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x',
      bodyEn: 'y',
      summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({
      id: 'cN',
      tone: 'standard',
    });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(trophiesMock.checkAndGrantTrophies).toHaveBeenCalledWith('k1', {
      kind: 'story-chapter-generated',
    });
  });

  it('does NOT grant trophy when the chapter already existed', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce({ id: 'c1' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(trophiesMock.checkAndGrantTrophies).not.toHaveBeenCalled();
  });

  it('throws StoryGenerationError when AI fails', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    const { StoryGenerationError } = await import('@/lib/errors/story-errors');
    aiMock.generateStoryChapterWithAI.mockRejectedValueOnce(
      new StoryGenerationError('boom'),
    );
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await expect(
      generateStoryChapter({ childId: 'k1', weekId: 'w1' }),
    ).rejects.toThrow(StoryGenerationError);
    expect(dbStoryMock.upsertStoryChapter).not.toHaveBeenCalled();
  });

  it('composes petHint from equipped pet name_en when pet equipped', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    petsDbMock.getEquippedPet.mockResolvedValueOnce({
      slug: 'parrot-perch',
      nameEn: 'Parrot',
    });
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x',
      bodyEn: 'y',
      summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({ id: 'cN' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ petHint: 'a parrot' }),
    );
  });
});

describe('markChapterReadAction', () => {
  it('calls markChapterRead and revalidates the home page', async () => {
    dbStoryMock.markChapterRead.mockResolvedValueOnce({ wasNew: true });
    const { markChapterReadAction } = await import('@/lib/actions/story');
    await markChapterReadAction({ chapterId: 'c1', childId: 'k1' });
    expect(dbStoryMock.markChapterRead).toHaveBeenCalledWith('c1', 'k1');
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith('/play/k1');
  });
});

describe('markChapterReadAction card grant (PR #52)', () => {
  it('calls pullCardForChild with source=story_chapter on first read', async () => {
    dbStoryMock.markChapterRead.mockResolvedValueOnce({ wasNew: true });
    const grantResult = { granted: true, packSlug: 'zodiac-v1', itemId: 'item-1' };
    gachaMock.pullCardForChild.mockResolvedValueOnce(grantResult);

    const { markChapterReadAction } = await import('@/lib/actions/story');
    const result = await markChapterReadAction({ chapterId: 'c1', childId: 'k1' });

    expect(gachaMock.pullCardForChild).toHaveBeenCalledWith(
      'k1',
      'story_chapter',
      'c1',
    );
    expect(result).toEqual({ ok: true, cardGrant: grantResult });
  });

  it('does NOT call pullCardForChild when chapter was already read', async () => {
    dbStoryMock.markChapterRead.mockResolvedValueOnce({ wasNew: false });

    const { markChapterReadAction } = await import('@/lib/actions/story');
    const result = await markChapterReadAction({ chapterId: 'c1', childId: 'k1' });

    expect(gachaMock.pullCardForChild).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, cardGrant: null });
  });
});
