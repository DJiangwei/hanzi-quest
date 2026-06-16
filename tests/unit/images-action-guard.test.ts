import { describe, expect, it, vi, beforeEach } from 'vitest';

const { assertParentMock } = vi.hoisted(() => ({ assertParentMock: vi.fn() }));

vi.mock('@/lib/auth/guards', () => ({ assertParent: assertParentMock }));
vi.mock('@/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@/lib/ai/pollinations', () => ({ fetchAndUploadImage: vi.fn() }));

import { generateMissingImagesForWeek } from '@/lib/actions/images';

beforeEach(() => vi.clearAllMocks());

describe('generateMissingImagesForWeek auth', () => {
  it('rejects when assertParent throws (non-parent caller)', async () => {
    assertParentMock.mockRejectedValue(new Error('Parent role required'));
    await expect(generateMissingImagesForWeek('w1')).rejects.toThrow('Parent role required');
  });
});
