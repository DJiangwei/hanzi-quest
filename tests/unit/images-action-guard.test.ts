import { describe, expect, it, vi, beforeEach } from 'vitest';

const { assertAdminMock } = vi.hoisted(() => ({ assertAdminMock: vi.fn() }));

vi.mock('@/lib/auth/guards', () => ({ assertAdmin: assertAdminMock }));
vi.mock('@/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@/lib/ai/pollinations', () => ({ fetchAndUploadImage: vi.fn() }));

import { generateMissingImagesForWeek } from '@/lib/actions/images';

beforeEach(() => vi.clearAllMocks());

describe('generateMissingImagesForWeek auth', () => {
  it('rejects when assertAdmin throws (non-admin caller)', async () => {
    assertAdminMock.mockRejectedValue(new Error('Admin role required'));
    await expect(generateMissingImagesForWeek('w1')).rejects.toThrow('Admin role required');
  });
});
