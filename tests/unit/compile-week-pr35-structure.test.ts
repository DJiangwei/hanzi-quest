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
        { id: 't-word_match', type: 'word_match' },
        { id: 't-translate_pick', type: 'translate_pick' },
        { id: 't-sentence_cloze', type: 'sentence_cloze' },
        { id: 't-boss', type: 'boss' },
        // pinyin_pick template intentionally absent (is_active=false in DB)
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
  it('10-char week produces 10 review + 12 practice + 1 boss = 23 levels', async () => {
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeChar(i + 1)),
    );
    const inserted: RowCaptured[] = [];
    captureInsertedRows(inserted);

    const count = await compileWeekIntoLevels('w-test');

    expect(count).toBe(23);
    const bySegment = inserted.reduce<Record<string, number>>((acc, r) => {
      acc[r.sceneConfig.segment] = (acc[r.sceneConfig.segment] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySegment.review).toBe(10);
    expect((bySegment.sound ?? 0) + (bySegment.sight ?? 0) + (bySegment.meaning ?? 0)).toBe(12);
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
