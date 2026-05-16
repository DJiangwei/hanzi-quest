import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturning });
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });
  const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });
  const txMock = { insert: insertMock, delete: deleteMock };
  const transactionMock = vi.fn(async (fn) => fn(txMock));
  const selectWhereMock = vi.fn();
  const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
  const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });
  const getCharsForWeekMock = vi.fn();
  return { insertValuesMock, selectWhereMock, selectMock, transactionMock, getCharsForWeekMock };
});

vi.mock('@/db', () => ({
  db: { transaction: mocks.transactionMock, select: mocks.selectMock },
}));

vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: mocks.getCharsForWeekMock,
}));

import { compileWeekIntoLevels } from '@/lib/scenes/compile-week';

const TEMPLATES = [
  { id: 'tpl-flashcard',   type: 'flashcard'   },
  { id: 'tpl-audio-pick',  type: 'audio_pick'  },
  { id: 'tpl-visual-pick', type: 'visual_pick' },
  { id: 'tpl-image-pick',  type: 'image_pick'  },
  { id: 'tpl-word-match',  type: 'word_match'  },
  { id: 'tpl-boss',        type: 'boss'        },
];

function makeChars(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `char-${i + 1}`,
    hanzi: `字${i + 1}`,
    imageHook: 'a thing',
    words: [{ word: 'word' }],
  }));
}

describe('compileWeekIntoLevels boss emission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectWhereMock.mockResolvedValue(TEMPLATES);
  });

  it('emits boss as the FINAL level when chars.length >= 10', async () => {
    mocks.getCharsForWeekMock.mockResolvedValue(makeChars(10));
    await compileWeekIntoLevels('week-1');
    const insertedRows = (mocks.insertValuesMock.mock.calls[0]?.[0] ?? []) as Array<{
      sceneTemplateId: string;
      position: number;
      sceneConfig: { characterIds?: string[]; questionTypes?: string[] };
    }>;
    const last = insertedRows[insertedRows.length - 1];
    expect(last.sceneTemplateId).toBe('tpl-boss');
    expect(last.sceneConfig.characterIds).toHaveLength(10);
    expect(last.sceneConfig.questionTypes).toEqual(
      expect.arrayContaining(['audio_pick', 'visual_pick', 'image_pick']),
    );
  });

  it('does NOT emit boss when chars.length < 10', async () => {
    mocks.getCharsForWeekMock.mockResolvedValue(makeChars(8));
    await compileWeekIntoLevels('week-1');
    const insertedRows = (mocks.insertValuesMock.mock.calls[0]?.[0] ?? []) as Array<{ sceneTemplateId: string }>;
    expect(insertedRows.some((r) => r.sceneTemplateId === 'tpl-boss')).toBe(false);
  });

  it('does NOT emit boss if scene_templates lacks a boss template', async () => {
    mocks.selectWhereMock.mockResolvedValue(TEMPLATES.filter((t) => t.type !== 'boss'));
    mocks.getCharsForWeekMock.mockResolvedValue(makeChars(10));
    await compileWeekIntoLevels('week-1');
    const insertedRows = (mocks.insertValuesMock.mock.calls[0]?.[0] ?? []) as Array<{ sceneTemplateId: string }>;
    expect(insertedRows.some((r) => r.sceneTemplateId === 'tpl-boss')).toBe(false);
  });
});
