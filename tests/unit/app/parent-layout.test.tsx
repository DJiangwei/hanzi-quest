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

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import ParentLayout from '@/app/parent/layout';

const get = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ get });
  (ensureUserBootstrapped as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'user_abc',
  });
});

describe('ParentLayout PIN gate', () => {
  it('redirects to /parent/unlock when PIN set and cookie missing', async () => {
    get.mockReturnValue(undefined);
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      parentPinHash: '$2b$10$abc',
      failedAttempts: 0,
      lockedUntil: null,
    });

    await expect(
      ParentLayout({ children: null as unknown as React.ReactNode }),
    ).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/parent/unlock');
  });

  it('passes through when cookie present', async () => {
    get.mockReturnValue({ value: '1' });
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      parentPinHash: '$2b$10$abc',
      failedAttempts: 0,
      lockedUntil: null,
    });
    const result = await ParentLayout({ children: 'kids' as unknown as React.ReactNode });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('passes through (with FirstTimeBanner) when no PIN set', async () => {
    get.mockReturnValue(undefined);
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await ParentLayout({ children: 'kids' as unknown as React.ReactNode });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    // we don't assert on JSX shape; just that it didn't redirect
  });
});
