import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
}));

const requireChildMock = vi.fn();
const assertParentMock = vi.fn();
vi.mock('@/lib/auth/guards', () => ({
  assertParent: () => assertParentMock(),
  requireChild: (id: string) => requireChildMock(id),
}));

const ensureSchoolCustomPackMock = vi.fn();
vi.mock('@/lib/db/curriculum', () => ({
  ensureSchoolCustomPack: (id: string) => ensureSchoolCustomPackMock(id),
}));

const createWeekMock = vi.fn();
const getWeekOwnedByMock = vi.fn();
const setWeekStatusMock = vi.fn();
const listCharactersForWeekMock = vi.fn();
const listWeeksByChildMock = vi.fn();
vi.mock('@/lib/db/weeks', () => ({
  createWeek: (input: unknown) => createWeekMock(input),
  getWeekOwnedBy: (weekId: string, parentId: string) =>
    getWeekOwnedByMock(weekId, parentId),
  setWeekStatus: (weekId: string, status: string) =>
    setWeekStatusMock(weekId, status),
  listCharactersForWeek: (weekId: string) => listCharactersForWeekMock(weekId),
  listWeeksByChild: (childId: string) => listWeeksByChildMock(childId),
}));

const upsertSimplifiedCharacterMock = vi.fn();
const linkWeekCharactersMock = vi.fn();
vi.mock('@/lib/db/characters', () => ({
  upsertSimplifiedCharacter: (_tx: unknown, input: unknown) =>
    upsertSimplifiedCharacterMock(input),
  linkWeekCharacters: (_tx: unknown, weekId: string, pairs: unknown) =>
    linkWeekCharactersMock(weekId, pairs),
  replaceCharacterWords: vi.fn(),
  replaceCharacterSentence: vi.fn(),
  getCharacterOwnedByWeek: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

const generateWeekContentMock = vi.fn();
vi.mock('@/lib/ai/generate-content', () => ({
  generateWeekContent: (input: unknown) => generateWeekContentMock(input),
  regenerateCharacter: vi.fn(),
}));

import { createStageAction, generateWeekAction } from '@/lib/actions/weeks';

const parentRow = { id: 'user_p', email: 'p@b.com', role: 'parent' as const };
const childRow = {
  id: 'child_1',
  parentUserId: 'user_p',
  currentCurriculumPackId: null,
  birthYear: null,
  displayName: 'Anna',
};

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireChildMock.mockReset();
  assertParentMock.mockReset();
  ensureSchoolCustomPackMock.mockReset().mockResolvedValue('pack_1');
  createWeekMock.mockReset();
  getWeekOwnedByMock.mockReset();
  setWeekStatusMock.mockReset();
  listCharactersForWeekMock.mockReset();
  listWeeksByChildMock.mockReset();
  upsertSimplifiedCharacterMock.mockReset();
  linkWeekCharactersMock.mockReset();
  generateWeekContentMock.mockReset();
});

describe('createStageAction', () => {
  it('rejects when no non-empty lines', async () => {
    const res = await createStageAction(
      {},
      fd({ childId: '11111111-2222-4333-a444-555555555555', labelPrefix: 'Lesson', rawText: '\n\n   \n' }),
    );
    expect(res.error).toMatch(/no non-empty lines/i);
  });

  it('rejects line with 0 unique hanzi', async () => {
    const res = await createStageAction(
      {},
      fd({
        childId: '11111111-2222-4333-a444-555555555555',
        labelPrefix: 'Lesson',
        rawText: '人 口 大\nhello world\n爸 妈 天',
      }),
    );
    expect(res.error).toMatch(/Line 2 has 0 unique/);
  });

  it('rejects line with > 12 unique hanzi', async () => {
    const longLine = '一 二 三 四 五 六 七 八 九 十 百 千 万';
    const res = await createStageAction(
      {},
      fd({ childId: '11111111-2222-4333-a444-555555555555', labelPrefix: 'Lesson', rawText: longLine }),
    );
    expect(res.error).toMatch(/Line 1 has 13 unique/);
  });

  it('creates one draft week per non-empty line', async () => {
    requireChildMock.mockResolvedValue({ parent: parentRow, child: childRow });
    let createdCount = 0;
    createWeekMock.mockImplementation(async () => ({
      id: `week_${++createdCount}`,
      label: '...',
    }));
    upsertSimplifiedCharacterMock.mockImplementation(async (input) => ({
      id: `char_${input.hanzi}`,
      hanzi: input.hanzi,
    }));

    await expect(
      createStageAction(
        {},
        fd({
          childId: '11111111-2222-4333-a444-555555555555',
          labelPrefix: 'Stage A',
          rawText: '人 口 大\n爸 妈 天\n云 火 水',
        }),
      ),
    ).rejects.toThrow('__REDIRECT__:/parent');

    expect(createWeekMock).toHaveBeenCalledTimes(3);
    expect(createWeekMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      label: 'Stage A 1',
      status: 'draft',
    }));
    expect(createWeekMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      label: 'Stage A 3',
    }));
    expect(linkWeekCharactersMock).toHaveBeenCalledTimes(3);
  });
});

describe('generateWeekAction', () => {
  it('errors when week not found', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    getWeekOwnedByMock.mockResolvedValue(undefined);

    const res = await generateWeekAction('week_x');
    expect(res.error).toMatch(/not found/i);
  });

  it('errors when no characters stored', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    getWeekOwnedByMock.mockResolvedValue({ id: 'week_1', label: 'L 1' });
    listCharactersForWeekMock.mockResolvedValue([]);

    const res = await generateWeekAction('week_1');
    expect(res.error).toMatch(/no stored characters/i);
  });

  it('flips week to ai_generating then calls generateWeekContent', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    getWeekOwnedByMock.mockResolvedValue({ id: 'week_1', label: 'L 1' });
    listCharactersForWeekMock.mockResolvedValue([
      { character: { hanzi: '人' }, position: 0 },
      { character: { hanzi: '口' }, position: 1 },
    ]);
    generateWeekContentMock.mockResolvedValue({});

    await expect(generateWeekAction('week_1')).rejects.toThrow(
      '__REDIRECT__:/parent/week/week_1/review',
    );

    expect(setWeekStatusMock).toHaveBeenCalledWith('week_1', 'ai_generating');
    expect(generateWeekContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        weekId: 'week_1',
        characters: ['人', '口'],
      }),
    );
  });

  it('returns AI error and does not redirect', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    getWeekOwnedByMock.mockResolvedValue({ id: 'week_1', label: 'L 1' });
    listCharactersForWeekMock.mockResolvedValue([
      { character: { hanzi: '人' }, position: 0 },
    ]);
    generateWeekContentMock.mockRejectedValue(new Error('Rate limit'));

    const res = await generateWeekAction('week_1');
    expect(res.error).toBe('Rate limit');
  });
});
