import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

const getUserByIdMock = vi.fn();
vi.mock('@/lib/db/users', () => ({
  getUserById: (id: string) => getUserByIdMock(id),
}));

const getChildOwnedByMock = vi.fn();
vi.mock('@/lib/db/children', () => ({
  getChildOwnedBy: (childId: string, parentUserId: string) =>
    getChildOwnedByMock(childId, parentUserId),
}));

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  assertParent,
  requireChild,
} from '@/lib/auth/guards';

const parentRow = {
  id: 'user_parent_1',
  email: 'a@b.com',
  displayName: null,
  role: 'parent' as const,
  locale: 'en',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  authMock.mockReset();
  getUserByIdMock.mockReset();
  getChildOwnedByMock.mockReset();
});

describe('assertParent', () => {
  it('throws Unauthorized when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(assertParent()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws Unauthorized when DB row missing (webhook delivery lost)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    getUserByIdMock.mockResolvedValue(undefined);
    await expect(assertParent()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws Forbidden when role is not parent or admin', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    getUserByIdMock.mockResolvedValue({ ...parentRow, role: 'guest' });
    await expect(assertParent()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns the row when signed in and parent', async () => {
    authMock.mockResolvedValue({ userId: 'user_parent_1' });
    getUserByIdMock.mockResolvedValue(parentRow);
    await expect(assertParent()).resolves.toBe(parentRow);
  });
});

describe('requireChild', () => {
  it('returns parent + child when ownership checks out', async () => {
    authMock.mockResolvedValue({ userId: 'user_parent_1' });
    getUserByIdMock.mockResolvedValue(parentRow);
    const childRow = { id: 'child_1', parentUserId: 'user_parent_1' };
    getChildOwnedByMock.mockResolvedValue(childRow);

    const result = await requireChild('child_1');
    expect(result.parent).toBe(parentRow);
    expect(result.child).toBe(childRow);
    expect(getChildOwnedByMock).toHaveBeenCalledWith('child_1', 'user_parent_1');
  });

  it('throws NotFound when child does not belong to parent', async () => {
    authMock.mockResolvedValue({ userId: 'user_parent_1' });
    getUserByIdMock.mockResolvedValue(parentRow);
    getChildOwnedByMock.mockResolvedValue(undefined);

    await expect(requireChild('foreign_child')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
