import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

const getUserByIdMock = vi.fn();
const upsertUserMock = vi.fn();
vi.mock('@/lib/db/users', () => ({
  getUserById: (id: string) => getUserByIdMock(id),
  upsertUser: (input: unknown) => upsertUserMock(input),
}));

const ensureSchoolCustomPackMock = vi.fn();
vi.mock('@/lib/db/curriculum', () => ({
  ensureSchoolCustomPack: (id: string) => ensureSchoolCustomPackMock(id),
}));

import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';

beforeEach(() => {
  authMock.mockReset();
  currentUserMock.mockReset();
  getUserByIdMock.mockReset();
  upsertUserMock.mockReset();
  ensureSchoolCustomPackMock.mockReset();
});

describe('ensureUserBootstrapped', () => {
  it('returns null when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    const result = await ensureUserBootstrapped();
    expect(result).toBeNull();
    expect(currentUserMock).not.toHaveBeenCalled();
  });

  it('returns the existing row without hitting Clerk currentUser API', async () => {
    authMock.mockResolvedValue({ userId: 'user_a' });
    const existing = { id: 'user_a', email: 'a@b.com' };
    getUserByIdMock.mockResolvedValue(existing);

    const result = await ensureUserBootstrapped();
    expect(result).toBe(existing);
    expect(currentUserMock).not.toHaveBeenCalled();
    expect(upsertUserMock).not.toHaveBeenCalled();
    expect(ensureSchoolCustomPackMock).not.toHaveBeenCalled();
  });

  it('bootstraps user + school-custom pack on first touch', async () => {
    authMock.mockResolvedValue({ userId: 'user_a' });
    getUserByIdMock.mockResolvedValue(undefined);
    currentUserMock.mockResolvedValue({
      firstName: 'David',
      lastName: 'Jiang',
      primaryEmailAddress: { emailAddress: 'd@example.com' },
      emailAddresses: [{ emailAddress: 'd@example.com' }],
    });
    const inserted = { id: 'user_a', email: 'd@example.com' };
    upsertUserMock.mockResolvedValue(inserted);

    const result = await ensureUserBootstrapped();
    expect(result).toBe(inserted);
    expect(upsertUserMock).toHaveBeenCalledWith({
      id: 'user_a',
      email: 'd@example.com',
      displayName: 'David Jiang',
    });
    expect(ensureSchoolCustomPackMock).toHaveBeenCalledWith('user_a');
  });

  it('falls back to first email when primary is missing', async () => {
    authMock.mockResolvedValue({ userId: 'user_a' });
    getUserByIdMock.mockResolvedValue(undefined);
    currentUserMock.mockResolvedValue({
      firstName: null,
      lastName: null,
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: 'fallback@example.com' }],
    });
    upsertUserMock.mockResolvedValue({ id: 'user_a' });

    await ensureUserBootstrapped();
    expect(upsertUserMock).toHaveBeenCalledWith({
      id: 'user_a',
      email: 'fallback@example.com',
      displayName: null,
    });
  });

  it('throws when Clerk has no email at all', async () => {
    authMock.mockResolvedValue({ userId: 'user_a' });
    getUserByIdMock.mockResolvedValue(undefined);
    currentUserMock.mockResolvedValue({
      firstName: 'A',
      lastName: 'B',
      primaryEmailAddress: null,
      emailAddresses: [],
    });

    await expect(ensureUserBootstrapped()).rejects.toThrow(/no email/);
  });
});
