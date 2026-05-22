import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturning });
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

  const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

  const txMock = { insert: insertMock, delete: deleteMock };

  const transactionMock = vi.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
  );

  // db.select().from().where()  — awaited directly (returns Promise<row[]>)
  const selectWhereMock = vi.fn();
  const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
  const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });

  const getCharactersWithDetailsForWeekMock = vi.fn();

  return {
    insertValuesMock,
    insertReturning,
    deleteMock,
    transactionMock,
    selectWhereMock,
    selectMock,
    getCharactersWithDetailsForWeekMock,
  };
});

vi.mock('@/db', () => ({
  db: {
    transaction: mocks.transactionMock,
    select: mocks.selectMock,
  },
}));

vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: (weekId: string) =>
    mocks.getCharactersWithDetailsForWeekMock(weekId),
}));

import { compileWeekIntoLevels } from '@/lib/scenes/compile-week';

const allTemplates = [
  { id: 'tmpl_flashcard', type: 'flashcard' },
  { id: 'tmpl_audio', type: 'audio_pick' },
  { id: 'tmpl_visual', type: 'visual_pick' },
  { id: 'tmpl_image', type: 'image_pick' },
  { id: 'tmpl_word', type: 'word_match' },
  { id: 'tmpl_boss', type: 'boss' },
  { id: 'tmpl_pinyin', type: 'pinyin_pick' },
  { id: 'tmpl_translate', type: 'translate_pick' },
  { id: 'tmpl_cloze', type: 'sentence_cloze' },
];

beforeEach(() => {
  mocks.insertReturning.mockReset();
  mocks.insertValuesMock.mockClear();
  mocks.deleteMock.mockClear();
  mocks.transactionMock.mockClear();
  mocks.selectWhereMock.mockReset();
  mocks.getCharactersWithDetailsForWeekMock.mockReset();
});

describe('compileWeekIntoLevels — segments + caps', () => {
  function makeFullChar(id: string, hanzi: string, withSentence: boolean) {
    return {
      id,
      hanzi,
      pinyinArray: ['x'],
      meaningEn: 'meaning',
      meaningZh: '意思',
      imageHook: 'hook',
      words: [{ text: hanzi + hanzi }],
      sentence: withSentence
        ? { id: 'sent_' + id, text: '这是 ' + hanzi + ' 的句子。', translationEn: null }
        : null,
    };
  }

  it('emits exactly 17 levels for a 10-char week with full data + boss', async () => {
    const chars = Array.from({ length: 10 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), true),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);
    mocks.insertReturning.mockResolvedValue([]);

    const count = await compileWeekIntoLevels('w_1');
    // 10 flashcards + 2 sound + 2 sight + 2 meaning + 1 boss
    expect(count).toBe(17);

    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const segs = rows.map((r: { sceneConfig: { segment?: string } }) => r.sceneConfig.segment);
    expect(segs.filter((s: string) => s === 'review')).toHaveLength(10);
    expect(segs.filter((s: string) => s === 'sound')).toHaveLength(2);
    expect(segs.filter((s: string) => s === 'sight')).toHaveLength(2);
    expect(segs.filter((s: string) => s === 'meaning')).toHaveLength(2);
    expect(segs.filter((s: string) => s === 'boss')).toHaveLength(1);
  });

  it('falls back from sentence_cloze to translate_pick when no example sentences exist', async () => {
    const chars = Array.from({ length: 3 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), false),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);
    mocks.insertReturning.mockResolvedValue([]);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const meaningRows = rows.filter(
      (r: { sceneConfig: { segment?: string } }) => r.sceneConfig.segment === 'meaning',
    );
    // 2 meaning rows, both should be translate_pick (cloze falls back).
    expect(meaningRows).toHaveLength(2);
    expect(meaningRows.every((r: { sceneTemplateId: string }) => r.sceneTemplateId === 'tmpl_translate')).toBe(true);
  });

  it('emits boss with 6 question types when N >= 10', async () => {
    const chars = Array.from({ length: 10 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), true),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);
    mocks.insertReturning.mockResolvedValue([]);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const bossRow = rows.find(
      (r: { sceneTemplateId: string }) => r.sceneTemplateId === 'tmpl_boss',
    );
    expect(bossRow).toBeDefined();
    const qTypes = bossRow.sceneConfig.questionTypes as string[];
    expect(qTypes).toEqual([
      'audio_pick',
      'visual_pick',
      'image_pick',
      'pinyin_pick',
      'translate_pick',
      'sentence_cloze',
    ]);
  });

  it('alternates translate_pick directions (cn_to_en then en_to_cn) deterministically', async () => {
    const chars = Array.from({ length: 4 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), false),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);
    mocks.insertReturning.mockResolvedValue([]);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const translateRows = rows.filter(
      (r: { sceneTemplateId: string }) => r.sceneTemplateId === 'tmpl_translate',
    );
    // With cloze fallback, all 2 meaning rows are translate. Directions alternate.
    expect(translateRows[0].sceneConfig.direction).toBe('cn_to_en');
    expect(translateRows[1].sceneConfig.direction).toBe('en_to_cn');
  });
});
