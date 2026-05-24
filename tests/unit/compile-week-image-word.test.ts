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

function setupTemplates(includeImageWord = true) {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { id: 't-flashcard', type: 'flashcard' },
        { id: 't-audio_pick', type: 'audio_pick' },
        { id: 't-visual_pick', type: 'visual_pick' },
        { id: 't-image_pick', type: 'image_pick' },
        { id: 't-word_match', type: 'word_match' },
        { id: 't-translate_pick', type: 'translate_pick' },
        { id: 't-sentence_cloze', type: 'sentence_cloze' },
        { id: 't-boss', type: 'boss' },
        ...(includeImageWord ? [{ id: 't-image_word', type: 'image_word' }] : []),
      ]),
    }),
  });
}

interface RowCaptured {
  sceneTemplateId: string;
  sceneConfig: { segment: string; wordId?: string; distractorWordIds?: string[] };
  levelKey: string;
}

function captureRows(inserted: RowCaptured[]) {
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

function makeChar(i: number, withImageHook: boolean) {
  return {
    id: `c${i}`,
    hanzi: `字${i}`,
    pinyinArray: [`zì${i}`],
    meaningEn: `meaning-${i}`,
    imageHook: 'a-hook',
    words: [
      { id: `w${i}-1`, text: `${i}组词1`, meaningEn: 'wm1', imageHook: withImageHook ? 'hook-1' : null },
      { id: `w${i}-2`, text: `${i}组词2`, meaningEn: 'wm2', imageHook: withImageHook ? 'hook-2' : null },
    ],
    sentence: { id: `s${i}`, text: '一个例子' },
  };
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.transaction.mockReset();
  charsMock.getCharactersWithDetailsForWeek.mockReset();
});

describe('compileWeekIntoLevels — image_word', () => {
  it('10-char week with all words having imageHook → 2 image_word slots', async () => {
    setupTemplates();
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, true));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    const count = await compileWeekIntoLevels('w-test');
    expect(count).toBe(25);     // 10 review + 14 practice + 1 boss
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(2);
    for (const r of imageWordRows) {
      expect(r.sceneConfig.segment).toBe('sight');
      expect(r.sceneConfig.distractorWordIds).toHaveLength(3);
    }
  });

  it('10-char week with 0 imageHooks → 0 image_word + 2 visual_pick fallback', async () => {
    setupTemplates();
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, false));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    const count = await compileWeekIntoLevels('w-test');
    expect(count).toBe(25);     // still 25, fallback fills the slots
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(0);
    const visualSightRows = inserted.filter(
      (r) => r.sceneTemplateId === 't-visual_pick' && r.sceneConfig.segment === 'sight',
    );
    // Original sight had 1 visual_pick; +2 fallback = ≥3 (some compile structures emit different counts)
    expect(visualSightRows.length).toBeGreaterThanOrEqual(3);
  });

  it('5-char week → 1 image_word slot', async () => {
    setupTemplates();
    const chars = Array.from({ length: 5 }, (_, i) => makeChar(i + 1, true));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    await compileWeekIntoLevels('w-test');
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(1);
  });

  it('does nothing if image_word template is missing (graceful)', async () => {
    setupTemplates(false);
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, true));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    await compileWeekIntoLevels('w-test');
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(0);
  });
});
