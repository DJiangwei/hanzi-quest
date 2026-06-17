import { describe, expect, it, vi, beforeEach } from 'vitest';

const { authMock, getUserByIdMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/db/users', () => ({ getUserById: getUserByIdMock }));
vi.mock('@/lib/db/children', () => ({ getChildOwnedBy: vi.fn() }));

import { assertAdmin } from '@/lib/auth/guards';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/guards';

beforeEach(() => vi.clearAllMocks());

describe('assertAdmin', () => {
  it('returns the user when role is admin', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    getUserByIdMock.mockResolvedValue({ id: 'u1', role: 'admin' });
    await expect(assertAdmin()).resolves.toMatchObject({ id: 'u1', role: 'admin' });
  });
  it('throws ForbiddenError for a parent', async () => {
    authMock.mockResolvedValue({ userId: 'u2' });
    getUserByIdMock.mockResolvedValue({ id: 'u2', role: 'parent' });
    await expect(assertAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('throws UnauthorizedError when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(assertAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
