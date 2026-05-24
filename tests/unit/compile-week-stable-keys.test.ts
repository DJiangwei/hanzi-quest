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
      ]),
    }),
  });
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.transaction.mockReset();
  charsMock.getCharactersWithDetailsForWeek.mockReset();
  setupTemplates();
});

describe('compileWeekIntoLevels — stable keys', () => {
  it('uses onConflictDoUpdate (upsert, not delete-then-insert) and writes deterministic level_keys', async () => {
    const chars = Array.from({ length: 3 }, (_, i) => ({
      id: `c${i + 1}`, hanzi: `字${i + 1}`, pinyinArray: ['x'],
      meaningEn: 'm', imageHook: 'h',
      words: [{ id: `w${i}`, text: 'w', meaningEn: 'w' }],
      sentence: { id: `s${i}`, text: 's' },
    }));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: Array<{ levelKey: string }> = [];
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((rows: typeof inserted) => {
            inserted.push(...rows);
            return { onConflictDoUpdate };
          }),
        }),
      });
    });

    await compileWeekIntoLevels('w-test');

    // Upsert path was taken
    expect(onConflictDoUpdate).toHaveBeenCalled();

    // Review level_keys are deterministic per character
    expect(inserted.some((r) => r.levelKey === 'review:flashcard:c1')).toBe(true);
    expect(inserted.some((r) => r.levelKey === 'review:flashcard:c2')).toBe(true);
    expect(inserted.some((r) => r.levelKey === 'review:flashcard:c3')).toBe(true);

    // Practice level_keys follow the slot pattern
    const slotKeyRegex = /^practice:(audio_pick|visual_pick|image_pick|word_match|translate_pick|sentence_cloze):\d+$/;
    const practiceKeys = inserted
      .filter((r) => r.levelKey.startsWith('practice:'))
      .map((r) => r.levelKey);
    expect(practiceKeys.length).toBeGreaterThan(0);
    expect(practiceKeys.every((k) => slotKeyRegex.test(k))).toBe(true);

    // All keys distinct within a single compile
    const allKeys = inserted.map((r) => r.levelKey);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
