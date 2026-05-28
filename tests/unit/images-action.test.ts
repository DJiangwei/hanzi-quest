import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));
const authMock = vi.hoisted(() => vi.fn());
const fetchAndUploadMock = vi.hoisted(() => vi.fn());

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/ai/pollinations', () => ({ fetchAndUploadImage: fetchAndUploadMock }));

import { generateMissingImagesForWeek } from '@/lib/actions/images';

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.update.mockReset();
  authMock.mockReset();
  fetchAndUploadMock.mockReset();
  authMock.mockResolvedValue({ userId: 'user_x' });
});

function mockWordsQuery(rows: Array<{ id: string; text: string; imageHook: string | null }>) {
  // Drizzle chain: db.select({...}).from(words).innerJoin(...).innerJoin(...).where(...)
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  });
}

function mockUpdateChain() {
  dbMock.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

describe('generateMissingImagesForWeek', () => {
  it('returns counts after iterating eligible words', async () => {
    mockWordsQuery([
      { id: 'w1', text: '大人', imageHook: 'hook-1' },
      { id: 'w2', text: '火车', imageHook: 'hook-2' },
    ]);
    mockUpdateChain();
    fetchAndUploadMock.mockResolvedValue('https://blob/x.png');

    const result = await generateMissingImagesForWeek('week-1');

    expect(result).toEqual({ attempted: 2, succeeded: 2, failed: 0 });
    expect(fetchAndUploadMock).toHaveBeenCalledTimes(2);
  });

  it('per-word error does not fail the batch', async () => {
    mockWordsQuery([
      { id: 'w1', text: 'word1', imageHook: 'hook-1' },
      { id: 'w2', text: 'word2', imageHook: 'hook-2' },
      { id: 'w3', text: 'word3', imageHook: 'hook-3' },
    ]);
    mockUpdateChain();
    fetchAndUploadMock
      .mockResolvedValueOnce('https://blob/1.png')
      .mockRejectedValueOnce(new Error('pollinations 503'))
      .mockResolvedValueOnce('https://blob/3.png');

    const result = await generateMissingImagesForWeek('week-1');

    expect(result).toEqual({ attempted: 3, succeeded: 2, failed: 1 });
  });

  it('returns zero counts when there are no eligible words', async () => {
    mockWordsQuery([]);
    const result = await generateMissingImagesForWeek('week-1');
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    expect(fetchAndUploadMock).not.toHaveBeenCalled();
  });

  it('throws when auth() returns no session', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(generateMissingImagesForWeek('week-1')).rejects.toThrow();
  });
});
