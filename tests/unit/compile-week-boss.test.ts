import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate });
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

// pinyin_pick intentionally omitted — is_active=false in PR #35
const TEMPLATES = [
  { id: 'tpl-flashcard',   type: 'flashcard'      },
  { id: 'tpl-audio-pick',  type: 'audio_pick'     },
  { id: 'tpl-visual-pick', type: 'visual_pick'    },
  { id: 'tpl-image-pick',  type: 'image_pick'     },
  { id: 'tpl-word-match',  type: 'word_match'     },
  { id: 'tpl-boss',        type: 'boss'           },
  { id: 'tpl-translate',   type: 'translate_pick' },
  { id: 'tpl-cloze',       type: 'sentence_cloze' },
];

function makeChars(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `char-${i + 1}`,
    hanzi: `字${i + 1}`,
    pinyinArray: ['zi'],
    meaningEn: 'char',
    meaningZh: '字',
    imageHook: 'a thing',
    words: [{ text: '字' + (i + 1) }],
    sentence: null,
  }));
}

describe('compileWeekIntoLevels boss emission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectWhereMock.mockResolvedValue(TEMPLATES);
  });

  it('emits boss as the FINAL level when chars.length >= BOSS_MIN_CHARS', async () => {
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
    // PR #35 dropped pinyin_pick; this PR drops visual_pick (pinyin choices —
    // pinyin is hidden by default, and the template is retired everywhere else).
    expect(last.sceneConfig.questionTypes).toEqual([
      'audio_pick',
      'image_pick',
      'translate_pick',
      'sentence_cloze',
    ]);
  });

  it('never emits a pinyin-revealing question type in the boss rotation', async () => {
    mocks.getCharsForWeekMock.mockResolvedValue(makeChars(10));
    await compileWeekIntoLevels('week-1');
    const insertedRows = (mocks.insertValuesMock.mock.calls[0]?.[0] ?? []) as Array<{
      sceneTemplateId: string;
      sceneConfig: { questionTypes?: string[] };
    }>;
    const boss = insertedRows.find((r) => r.sceneTemplateId === 'tpl-boss');
    expect(boss?.sceneConfig.questionTypes).not.toContain('visual_pick');
    expect(boss?.sceneConfig.questionTypes).not.toContain('pinyin_pick');
  });

  it('emits a shorter boss for an 8-char week (Map 1 weeks 9 + 10)', async () => {
    // Those weeks teach 8 characters by curriculum design. At the old 10-char
    // threshold they compiled no boss, which deadlocked T3's frontier on week 9
    // and locked week 10 forever. One question per character — no padding.
    mocks.getCharsForWeekMock.mockResolvedValue(makeChars(8));
    await compileWeekIntoLevels('week-9');
    const insertedRows = (mocks.insertValuesMock.mock.calls[0]?.[0] ?? []) as Array<{
      sceneTemplateId: string;
      levelKey: string;
      sceneConfig: { characterIds?: string[] };
    }>;
    const boss = insertedRows.find((r) => r.sceneTemplateId === 'tpl-boss');
    expect(boss).toBeDefined();
    expect(boss!.levelKey).toBe('boss:boss:0');
    expect(boss!.sceneConfig.characterIds).toHaveLength(8);
    expect(insertedRows[insertedRows.length - 1]).toBe(boss);
  });

  it('does NOT emit boss below BOSS_MIN_CHARS', async () => {
    mocks.getCharsForWeekMock.mockResolvedValue(makeChars(7));
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
