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
const allTemplates = [
  { id: 'tmpl_flashcard', type: 'flashcard' },
  { id: 'tmpl_audio', type: 'audio_pick' },
  { id: 'tmpl_visual', type: 'visual_pick' },
  { id: 'tmpl_image', type: 'image_pick' },
  { id: 'tmpl_word', type: 'word_match' },
  { id: 'tmpl_boss', type: 'boss' },
  { id: 'tmpl_translate', type: 'translate_pick' },
  { id: 'tmpl_cloze', type: 'sentence_cloze' },
];

function makeChar(id: string, hanzi: string, opts: {
  imageHook?: string | null;
  words?: Array<{ text: string }>;
} = {}) {
  return {
    id,
    hanzi,
    pinyinArray: ['x'],
    meaningEn: 'meaning',
    meaningZh: null,
    imageHook: opts.imageHook ?? null,
    words: opts.words ?? [],
    sentence: null,
  };
}

beforeEach(() => {
  mocks.onConflictDoUpdate.mockClear();
  mocks.insertValuesMock.mockClear();
  mocks.deleteMock.mockClear();
  mocks.transactionMock.mockClear();
  mocks.selectWhereMock.mockReset();
  mocks.getCharactersWithDetailsForWeekMock.mockReset();
});

describe('compileWeekIntoLevels', () => {
  it('throws when the week has no characters', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([]);
    await expect(compileWeekIntoLevels('w_1')).rejects.toThrow(/no characters/);
  });

  it('throws when no active flashcard template exists', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      makeChar('c1', '人'),
    ]);
    mocks.selectWhereMock.mockResolvedValue([]);
    await expect(compileWeekIntoLevels('w_1')).rejects.toThrow(
      /no active flashcard scene_template/i,
    );
  });

  it('with 1 char emits a single flashcard (no quiz block — needs ≥2)', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      makeChar('c_ren', '人'),
    ]);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    const count = await compileWeekIntoLevels('w_1');
    expect(count).toBe(1);
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].sceneTemplateId).toBe('tmpl_flashcard');
  });

  it('with 3 chars + words + imageHook emits correct PR #35 shape (no boss, N<10)', async () => {
    const chars = [
      makeChar('c1', '人', {
        imageHook: 'a smiling crowd',
        words: [{ text: '大人' }],
      }),
      makeChar('c2', '口', {
        imageHook: 'a wide-open mouth',
        words: [{ text: '门口' }],
      }),
      makeChar('c3', '大', { words: [{ text: '大人' }] }),
    ];
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    const count = await compileWeekIntoLevels('w_1');
    // N=3: review(3) + audio(1) + sight(1) + meaning(4) = 9; no boss (N<10).
    expect(count).toBe(9);

    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const segments = rows.map((r: { sceneConfig: { segment?: string } }) => r.sceneConfig.segment);

    expect(segments.filter((s: string) => s === 'review')).toHaveLength(3);
    expect(segments.filter((s: string) => s === 'boss')).toHaveLength(0);

    // No pinyin_pick
    const templateIds = rows.map((r: { sceneTemplateId: string }) => r.sceneTemplateId);
    expect(templateIds).not.toContain('tmpl_pinyin');
  });

  it('substitutes visual_pick when no character has an imageHook', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      makeChar('c1', '人', { words: [{ text: '大人' }] }),
      makeChar('c2', '口', { words: [{ text: '门口' }] }),
    ]);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    const count = await compileWeekIntoLevels('w_1');
    // N=2: review(2) + audio(1) + sight(1: visual_pick, no word_match since sight<3) + meaning(4) = 8
    expect(count).toBe(8);
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const templateIds = rows.map((r: { sceneTemplateId: string }) => r.sceneTemplateId);
    expect(templateIds).not.toContain('tmpl_image');
    expect(templateIds).toContain('tmpl_visual');
  });

  it('skips word_match when N<4 (sight count = 1 for N=2-3); keeps other sight scenes', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      makeChar('c1', '人', { words: [{ text: '大人' }] }),
      makeChar('c2', '口'),
    ]);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);

    await compileWeekIntoLevels('w_1');
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const templateIds = rows.map((r: { sceneTemplateId: string }) => r.sceneTemplateId);
    expect(templateIds).not.toContain('tmpl_word');
  });
});
