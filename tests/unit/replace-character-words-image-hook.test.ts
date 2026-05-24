import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  delete: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

import { replaceCharacterWords } from '@/lib/db/characters';

beforeEach(() => {
  txMock.delete.mockReset();
  txMock.insert.mockReset();

  txMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
});

describe('replaceCharacterWords', () => {
  it('persists per-word imageHook when provided', async () => {
    const insertCalls: Array<Record<string, unknown>> = [];
    txMock.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((row) => {
        insertCalls.push(row as Record<string, unknown>);
        return {
          returning: vi.fn().mockResolvedValue([{ id: 'w-stub' }]),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));

    await replaceCharacterWords(
      txMock as unknown as Parameters<typeof replaceCharacterWords>[0],
      'c1',
      [
        { text: '大人', pinyinArray: ['dà', 'rén'], meaningEn: 'adult', imageHook: 'a smiling adult next to a child' },
        { text: '老人', pinyinArray: ['lǎo', 'rén'], meaningEn: 'elder', imageHook: 'a grey-haired elder sitting on a bench' },
      ],
    );

    const wordsInsertCalls = insertCalls.filter((c) => 'text' in c && 'pinyinArray' in c);
    expect(wordsInsertCalls).toHaveLength(2);
    expect(wordsInsertCalls[0]).toMatchObject({ imageHook: 'a smiling adult next to a child' });
    expect(wordsInsertCalls[1]).toMatchObject({ imageHook: 'a grey-haired elder sitting on a bench' });
  });

  it('accepts inputs without imageHook (back-compat) — persists null', async () => {
    const insertCalls: Array<Record<string, unknown>> = [];
    txMock.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((row) => {
        insertCalls.push(row as Record<string, unknown>);
        return {
          returning: vi.fn().mockResolvedValue([{ id: 'w-stub' }]),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));

    await replaceCharacterWords(
      txMock as unknown as Parameters<typeof replaceCharacterWords>[0],
      'c1',
      [
        { text: '大人', pinyinArray: ['dà', 'rén'], meaningEn: 'adult' },
      ],
    );

    const wordsInsertCalls = insertCalls.filter((c) => 'text' in c && 'pinyinArray' in c);
    expect(wordsInsertCalls[0]).toMatchObject({ imageHook: null });
  });
});
