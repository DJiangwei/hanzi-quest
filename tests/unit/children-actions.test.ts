import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
}));

const assertParentMock = vi.fn();
vi.mock('@/lib/auth/guards', () => ({
  assertParent: () => assertParentMock(),
}));

const createChildProfileMock = vi.fn();
const updateChildOwnedByMock = vi.fn();
const deleteChildOwnedByMock = vi.fn();
vi.mock('@/lib/db/children', () => ({
  createChildProfile: (input: unknown) => createChildProfileMock(input),
  updateChildOwnedBy: (childId: string, parentUserId: string, input: unknown) =>
    updateChildOwnedByMock(childId, parentUserId, input),
  deleteChildOwnedBy: (childId: string, parentUserId: string) =>
    deleteChildOwnedByMock(childId, parentUserId),
}));

import {
  createChildAction,
  deleteChildAction,
  updateChildAction,
} from '@/lib/actions/children';

const parentRow = { id: 'user_p', email: 'p@b.com', role: 'parent' as const };

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  assertParentMock.mockReset();
  createChildProfileMock.mockReset();
  updateChildOwnedByMock.mockReset();
  deleteChildOwnedByMock.mockReset();
});

describe('createChildAction', () => {
  it('rejects empty display name with field error', async () => {
    const res = await createChildAction({}, fd({ displayName: '   ' }));
    expect(res.error).toMatch(/Name is required/);
    expect(createChildProfileMock).not.toHaveBeenCalled();
  });

  it('rejects bogus birth year', async () => {
    const res = await createChildAction(
      {},
      fd({ displayName: 'Anna', birthYear: '1900' }),
    );
    expect(res.error).toBeTruthy();
    expect(createChildProfileMock).not.toHaveBeenCalled();
  });

  it('persists when input is valid and returns no error', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    createChildProfileMock.mockResolvedValue({ id: 'c_new' });

    const res = await createChildAction(
      {},
      fd({ displayName: 'Anna', birthYear: '2019' }),
    );
    expect(res).toEqual({});
    expect(createChildProfileMock).toHaveBeenCalledWith({
      parentUserId: 'user_p',
      displayName: 'Anna',
      birthYear: 2019,
    });
  });

  it('persists with null birthYear when omitted', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    createChildProfileMock.mockResolvedValue({ id: 'c_new' });

    const res = await createChildAction({}, fd({ displayName: 'Anna' }));
    expect(res).toEqual({});
    expect(createChildProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ birthYear: null }),
    );
  });
});

describe('updateChildAction', () => {
  it('returns NotFound when child does not belong to parent', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    updateChildOwnedByMock.mockResolvedValue(undefined);

    const res = await updateChildAction(
      'foreign_child',
      {},
      fd({ displayName: 'Anna' }),
    );
    expect(res.error).toMatch(/not found/i);
  });

  it('updates when input valid and child owned', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    updateChildOwnedByMock.mockResolvedValue({ id: 'c1' });

    const res = await updateChildAction(
      'c1',
      {},
      fd({ displayName: 'Anna 2', birthYear: '2018' }),
    );
    expect(res).toEqual({});
    expect(updateChildOwnedByMock).toHaveBeenCalledWith('c1', 'user_p', {
      displayName: 'Anna 2',
      birthYear: 2018,
    });
  });
});

describe('deleteChildAction', () => {
  it('deletes then redirects', async () => {
    assertParentMock.mockResolvedValue(parentRow);
    deleteChildOwnedByMock.mockResolvedValue(true);

    await expect(deleteChildAction('c1')).rejects.toThrow(
      '__REDIRECT__:/parent/children',
    );
    expect(deleteChildOwnedByMock).toHaveBeenCalledWith('c1', 'user_p');
  });
});
