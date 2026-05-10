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
];

function makeChar(id: string, hanzi: string, opts: {
  imageHook?: string | null;
  words?: Array<{ text: string }>;
} = {}) {
  return {
    id,
    hanzi,
    pinyinArray: ['x'],
    meaningEn: null,
    meaningZh: null,
    imageHook: opts.imageHook ?? null,
    words: opts.words ?? [],
    sentence: null,
  };
}

beforeEach(() => {
  mocks.insertReturning.mockReset();
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
    mocks.insertReturning.mockResolvedValue([]);

    const count = await compileWeekIntoLevels('w_1');
    expect(count).toBe(1);
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].sceneTemplateId).toBe('tmpl_flashcard');
  });

  it('with chars + words + imageHook emits flashcards + full quiz block', async () => {
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
    mocks.insertReturning.mockResolvedValue([]);

    const count = await compileWeekIntoLevels('w_1');
    // 3 flashcards + 1 audio + 1 visual + 1 image (has imageHook) + 1 word_match (≥2 chars w/ words)
    expect(count).toBe(7);

    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const types = rows.map((r: { sceneTemplateId: string }) => r.sceneTemplateId);
    expect(types.slice(0, 3)).toEqual([
      'tmpl_flashcard',
      'tmpl_flashcard',
      'tmpl_flashcard',
    ]);
    expect(types.slice(3)).toEqual([
      'tmpl_audio',
      'tmpl_visual',
      'tmpl_image',
      'tmpl_word',
    ]);
  });

  it('skips image_pick when no character has an imageHook', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      makeChar('c1', '人', { words: [{ text: '大人' }] }),
      makeChar('c2', '口', { words: [{ text: '门口' }] }),
    ]);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);
    mocks.insertReturning.mockResolvedValue([]);

    const count = await compileWeekIntoLevels('w_1');
    // 2 flashcards + audio + visual + word_match (no image_pick)
    expect(count).toBe(5);
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const types = rows.map((r: { sceneTemplateId: string }) => r.sceneTemplateId);
    expect(types).not.toContain('tmpl_image');
  });

  it('skips word_match when fewer than 2 characters have words', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      makeChar('c1', '人', { words: [{ text: '大人' }] }),
      makeChar('c2', '口'),
    ]);
    mocks.selectWhereMock.mockResolvedValue(allTemplates);
    mocks.insertReturning.mockResolvedValue([]);

    const count = await compileWeekIntoLevels('w_1');
    // 2 flashcards + audio + visual (no image, no word_match)
    expect(count).toBe(4);
    const [rows] = mocks.insertValuesMock.mock.calls[0];
    const types = rows.map((r: { sceneTemplateId: string }) => r.sceneTemplateId);
    expect(types).not.toContain('tmpl_word');
  });
});
