import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate });
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
    onConflictDoUpdate,
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

// pinyin_pick intentionally omitted — is_active=false in PR #35
// word_match intentionally omitted — retired in PR #57, replaced by lianliankan
const allTemplates = [
  { id: 'tmpl_flashcard', type: 'flashcard' },
  { id: 'tmpl_audio', type: 'audio_pick' },
  { id: 'tmpl_visual', type: 'visual_pick' },
  { id: 'tmpl_image', type: 'image_pick' },
  { id: 'tmpl_lianliankan', type: 'lianliankan' },
  { id: 'tmpl_boss', type: 'boss' },
  { id: 'tmpl_translate', type: 'translate_pick' },
  { id: 'tmpl_cloze', type: 'sentence_cloze' },
];

beforeEach(() => {
  mocks.onConflictDoUpdate.mockClear();
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

  it('emits exactly 24 levels for a 10-char week with full data + boss (image_pick 1→3)', async () => {
    const chars = Array.from({ length: 10 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), true),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    const count = await compileWeekIntoLevels('w_1');
    // 10 flashcards + 3 audio + 3 image_pick + 1 lianliankan + 6 meaning + 1 boss = 24
    // (no image_word template here)
    expect(count).toBe(24);

    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const segs = rows.map((r: { sceneConfig: { segment?: string } }) => r.sceneConfig.segment);
    expect(segs.filter((s: string) => s === 'review')).toHaveLength(10);
    // sound+sight+meaning = 13 practice scenes (image_pick 1→3)
    expect(segs.filter((s: string) => s === 'sound').length +
      segs.filter((s: string) => s === 'sight').length +
      segs.filter((s: string) => s === 'meaning').length).toBe(13);
    expect(segs.filter((s: string) => s === 'boss')).toHaveLength(1);
  });

  it('falls back from sentence_cloze to translate_pick when no example sentences exist', async () => {
    const chars = Array.from({ length: 3 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), false),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const meaningRows = rows.filter(
      (r: { sceneConfig: { segment?: string } }) => r.sceneConfig.segment === 'meaning',
    );
    // N=3 → meaning sizing = 4; cloze falls back to translate since no sentences
    expect(meaningRows.length).toBeGreaterThan(0);
    expect(meaningRows.every((r: { sceneTemplateId: string }) => r.sceneTemplateId === 'tmpl_translate')).toBe(true);
  });

  it('emits boss with 5 question types when N >= 10 (pinyin_pick removed in PR #35)', async () => {
    const chars = Array.from({ length: 10 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), true),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const bossRow = rows.find(
      (r: { sceneTemplateId: string }) => r.sceneTemplateId === 'tmpl_boss',
    );
    expect(bossRow).toBeDefined();
    const qTypes = bossRow.sceneConfig.questionTypes as string[];
    expect(qTypes).toHaveLength(5);
    expect(qTypes).toEqual([
      'audio_pick',
      'visual_pick',
      'image_pick',
      'translate_pick',
      'sentence_cloze',
    ]);
    expect(qTypes).not.toContain('pinyin_pick');
  });

  it('alternates translate_pick directions (cn_to_en then en_to_cn) for the first two slots', async () => {
    const chars = Array.from({ length: 4 }, (_, i) =>
      makeFullChar('c' + i, String.fromCharCode(0x4eba + i), false),
    );
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const translateRows = rows.filter(
      (r: { sceneTemplateId: string }) => r.sceneTemplateId === 'tmpl_translate',
    );
    // First translate slot: cn_to_en; second: en_to_cn
    expect(translateRows[0].sceneConfig.direction).toBe('cn_to_en');
    expect(translateRows[1].sceneConfig.direction).toBe('en_to_cn');
  });
});
