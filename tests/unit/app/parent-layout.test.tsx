import type React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('@/lib/auth/bootstrap', () => ({
  ensureUserBootstrapped: vi.fn(),
}));
vi.mock('@/lib/db/parent-settings', () => ({
  getParentSettings: vi.fn(),
}));
vi.mock('@/lib/db/children', () => ({
  listChildrenForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/actions/entry', () => ({
  chooseKidEntryAction: vi.fn(),
}));
vi.mock('@clerk/nextjs', () => ({ UserButton: () => null }));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import ParentLayout from '@/app/parent/layout';
import SecuredParentLayout from '@/app/parent/(secured)/layout';

const get = vi.fn();
const mockUser = (v: unknown) =>
  (ensureUserBootstrapped as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);
const mockSettings = (v: unknown) =>
  (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

beforeEach(() => {
  vi.clearAllMocks();
  (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ get });
  mockUser({ id: 'user_abc' });
});

describe('ParentLayout (base — auth only, NO PIN gate)', () => {
  // Regression guard for the infinite-redirect loop: /parent/unlock renders
  // under THIS layout, so it must never redirect to /parent/unlock.
  it('does NOT redirect to /parent/unlock even when PIN set + cookie missing', async () => {
    get.mockReturnValue(undefined);
    mockSettings({ parentPinHash: '$2b$10$abc' });
    const result = await ParentLayout({ children: 'x' as unknown as React.ReactNode });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('redirects to /sign-in when not authenticated', async () => {
    mockUser(null);
    await expect(
      ParentLayout({ children: null as unknown as React.ReactNode }),
    ).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });
});

describe('SecuredParentLayout PIN gate', () => {
  it('redirects to /parent/unlock when PIN set and cookie missing', async () => {
    get.mockReturnValue(undefined);
    mockSettings({ parentPinHash: '$2b$10$abc', failedAttempts: 0, lockedUntil: null });

    await expect(
      SecuredParentLayout({ children: null as unknown as React.ReactNode }),
    ).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/parent/unlock');
  });

  it('passes through when cookie present', async () => {
    get.mockReturnValue({ value: '1' });
    mockSettings({ parentPinHash: '$2b$10$abc', failedAttempts: 0, lockedUntil: null });
    const result = await SecuredParentLayout({ children: 'kids' as unknown as React.ReactNode });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('passes through (with FirstTimeBanner) when no PIN set', async () => {
    get.mockReturnValue(undefined);
    mockSettings(null);
    const result = await SecuredParentLayout({ children: 'kids' as unknown as React.ReactNode });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('renders a Play button linking straight into the game (single child)', async () => {
    get.mockReturnValue({ value: '1' });
    mockSettings({ parentPinHash: '$2b$10$abc', failedAttempts: 0, lockedUntil: null });
    const { listChildrenForUser } = await import('@/lib/db/children');
    (listChildrenForUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    const { render, screen } = await import('@testing-library/react');
    const result = await SecuredParentLayout({ children: 'kids' as unknown as React.ReactNode });
    render(result as React.ReactElement);
    expect(screen.getByRole('button', { name: /进入游戏/ })).toBeTruthy();
  });
});
