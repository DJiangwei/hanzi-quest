import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));
const charsMock = vi.hoisted(() => ({
  getCharactersWithDetailsForWeek: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: charsMock.getCharactersWithDetailsForWeek,
}));

import { compileWeekIntoLevels } from '@/lib/scenes/compile-week';

function makeChar(i: number, overrides: Partial<{ imageHook: string | null; words: unknown[]; sentence: { id: string; text: string } | null; meaningEn: string }> = {}) {
  return {
    id: `c${i}`,
    hanzi: `字${i}`,
    pinyinArray: [`zì${i}`],
    meaningEn: overrides.meaningEn ?? `meaning-${i}`,
    imageHook: overrides.imageHook ?? 'a-hook',
    words: overrides.words ?? [{ id: `w${i}`, text: `字${i}组词`, meaningEn: 'word' }],
    sentence: overrides.sentence === undefined ? { id: `s${i}`, text: '一个例子' } : overrides.sentence,
  };
}

function setupTemplates() {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { id: 't-flashcard', type: 'flashcard' },
        { id: 't-audio_pick', type: 'audio_pick' },
        { id: 't-visual_pick', type: 'visual_pick' },
        { id: 't-image_pick', type: 'image_pick' },
        { id: 't-lianliankan', type: 'lianliankan' },
        { id: 't-translate_pick', type: 'translate_pick' },
        { id: 't-sentence_cloze', type: 'sentence_cloze' },
        { id: 't-boss', type: 'boss' },
        // pinyin_pick template intentionally absent (is_active=false in DB)
        // word_match template intentionally absent (retired in PR #57)
      ]),
    }),
  });
}

interface RowCaptured {
  sceneTemplateId: string;
  sceneConfig: { segment: string; questionTypes?: string[] };
  levelKey: string;
}

function captureInsertedRows(inserted: RowCaptured[]) {
  dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
    await fn({
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((rows: RowCaptured[]) => {
          inserted.push(...rows);
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
        }),
      }),
    });
  });
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.transaction.mockReset();
  charsMock.getCharactersWithDetailsForWeek.mockReset();
  setupTemplates();
});

describe('compileWeekIntoLevels — PR #35 structure', () => {
  it('10-char week produces 10 review + 11 practice + 1 boss = 22 levels (PR #51: visual_pick retired)', async () => {
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);

    const count = await compileWeekIntoLevels('w-test');

    // setupTemplates() has no image_word template; sight 3→2 (visual_pick retired in PR #51)
    // 10 review + 3 audio + 2 sight + 6 meaning + 1 boss = 22
    expect(count).toBe(22);
    const bySegment = inserted.reduce<Record<string, number>>((acc, r) => {
      acc[r.sceneConfig.segment] = (acc[r.sceneConfig.segment] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySegment.review).toBe(10);
    expect((bySegment.sound ?? 0) + (bySegment.sight ?? 0) + (bySegment.meaning ?? 0)).toBe(11);
    expect(bySegment.boss).toBe(1);
  });

  it('omits boss when char count < 10', async () => {
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);
    await compileWeekIntoLevels('w-test');
    const bossCount = inserted.filter((r) => r.sceneConfig.segment === 'boss').length;
    expect(bossCount).toBe(0);
  });

  it('no level uses pinyin_pick template', async () => {
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);
    await compileWeekIntoLevels('w-test');
    expect(inserted.every((r) => r.sceneTemplateId !== 't-pinyin_pick')).toBe(true);
  });

  it('boss question types are exactly 5, none pinyin_pick', async () => {
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);
    await compileWeekIntoLevels('w-test');
    const boss = inserted.find((r) => r.sceneConfig.segment === 'boss');
    expect(boss?.sceneConfig.questionTypes).toHaveLength(5);
    expect(boss?.sceneConfig.questionTypes).not.toContain('pinyin_pick');
  });
});

describe('compile-week PR #57 lianliankan slot', () => {
  function setupTemplatesWithLianliankan() {
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 't-flashcard', type: 'flashcard' },
          { id: 't-audio_pick', type: 'audio_pick' },
          { id: 't-visual_pick', type: 'visual_pick' },
          { id: 't-image_pick', type: 'image_pick' },
          { id: 't-lianliankan', type: 'lianliankan' },
          { id: 't-translate_pick', type: 'translate_pick' },
          { id: 't-sentence_cloze', type: 'sentence_cloze' },
          { id: 't-boss', type: 'boss' },
        ]),
      }),
    });
  }

  it('emits a lianliankan level in sight slot 1 for a 10-char week', async () => {
    setupTemplatesWithLianliankan();
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);

    await compileWeekIntoLevels('w-test');

    expect(inserted.some((r) => r.sceneTemplateId === 't-lianliankan')).toBe(true);
  });

  it('does NOT emit any word_match level (post-PR-#57 retirement)', async () => {
    setupTemplatesWithLianliankan();
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);

    await compileWeekIntoLevels('w-test');

    expect(inserted.filter((r) => r.sceneTemplateId === 't-word_match')).toHaveLength(0);
  });

  it('lianliankan level key is practice:lianliankan:0', async () => {
    setupTemplatesWithLianliankan();
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);

    await compileWeekIntoLevels('w-test');

    const llk = inserted.find((r) => r.sceneTemplateId === 't-lianliankan');
    expect(llk?.levelKey).toBe('practice:lianliankan:0');
    expect(llk?.sceneConfig.segment).toBe('sight');
  });

  it('lianliankan slot stays unfilled when fewer than 4 chars have meaningEn', async () => {
    setupTemplatesWithLianliankan();
    // Only 3 chars, all with meaningEn — sight>=2 but sample.length < 4 so slot unfilled
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) =>
        makeChar(i + 1, { meaningEn: i < 3 ? `meaning-${i}` : undefined }),
      ).map((c, i) => ({ ...c, meaningEn: i < 3 ? c.meaningEn : null })),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);

    await compileWeekIntoLevels('w-test');

    expect(inserted.filter((r) => r.sceneTemplateId === 't-lianliankan')).toHaveLength(0);
  });
});

describe('compile-week PR #51 visual_pick retirement', () => {
  it('does not emit visual_pick levels for a 10-char week', async () => {
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);
    await compileWeekIntoLevels('w-test');
    const visualPickRows = inserted.filter((r) => r.sceneTemplateId === 't-visual_pick');
    expect(visualPickRows).toHaveLength(0);
  });

  it('emits 11 practice-segment levels for a 10-char week without image_word template (was 12)', async () => {
    // This test uses setupTemplates() which has no image_word template.
    // PR #51: sight 3→2 (drop visual_pick). audio=3, sight=2, meaning=6 → 11 practice.
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);
    await compileWeekIntoLevels('w-test');
    const practice = inserted.filter(
      (r) =>
        r.sceneConfig.segment === 'sound' ||
        r.sceneConfig.segment === 'sight' ||
        r.sceneConfig.segment === 'meaning',
    );
    expect(practice).toHaveLength(11);
  });
});
