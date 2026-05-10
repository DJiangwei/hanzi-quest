import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturning });
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

  const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

  const txMock = {
    insert: insertMock,
    delete: deleteMock,
  };

  const transactionMock = vi.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
  );

  const selectLimitMock = vi.fn();
  const selectWhereMock = vi.fn().mockReturnValue({ limit: selectLimitMock });
  const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
  const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });

  const getCharactersWithDetailsForWeekMock = vi.fn();

  return {
    insertValuesMock,
    insertReturning,
    deleteMock,
    transactionMock,
    selectLimitMock,
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

beforeEach(() => {
  mocks.insertReturning.mockReset();
  mocks.insertValuesMock.mockClear();
  mocks.deleteMock.mockClear();
  mocks.transactionMock.mockClear();
  mocks.selectLimitMock.mockReset();
  mocks.getCharactersWithDetailsForWeekMock.mockReset();
});

describe('compileWeekIntoLevels', () => {
  it('throws when the week has no characters', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([]);
    await expect(compileWeekIntoLevels('w_1')).rejects.toThrow(
      /no characters/,
    );
  });

  it('throws when no active flashcard template exists', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      { id: 'c1', hanzi: '人', words: [], sentence: null },
    ]);
    mocks.selectLimitMock.mockResolvedValue([]);
    await expect(compileWeekIntoLevels('w_1')).rejects.toThrow(
      /no active flashcard scene_template/i,
    );
  });

  it('inserts one flashcard week_level per character in order', async () => {
    mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue([
      { id: 'c_ren', hanzi: '人', words: [], sentence: null },
      { id: 'c_kou', hanzi: '口', words: [], sentence: null },
      { id: 'c_da', hanzi: '大', words: [], sentence: null },
    ]);
    mocks.selectLimitMock.mockResolvedValue([{ id: 'tmpl_flashcard' }]);
    mocks.insertReturning.mockResolvedValue([]);

    const count = await compileWeekIntoLevels('w_1');
    expect(count).toBe(3);
    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMock).toHaveBeenCalledTimes(1);
    expect(mocks.insertValuesMock).toHaveBeenCalledTimes(1);

    const [insertedRows] = mocks.insertValuesMock.mock.calls[0];
    expect(insertedRows).toHaveLength(3);
    expect(insertedRows[0]).toMatchObject({
      weekId: 'w_1',
      position: 0,
      sceneTemplateId: 'tmpl_flashcard',
      sceneConfig: { characterId: 'c_ren', hanzi: '人' },
    });
    expect(insertedRows[2]).toMatchObject({
      position: 2,
      sceneConfig: { characterId: 'c_da', hanzi: '大' },
    });
  });
});
