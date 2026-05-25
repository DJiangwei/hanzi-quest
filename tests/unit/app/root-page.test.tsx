import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('@/lib/auth/bootstrap', () => ({
  ensureUserBootstrapped: vi.fn(),
}));
vi.mock('@/lib/db/children', () => ({
  listChildrenForUser: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { listChildrenForUser } from '@/lib/db/children';
import HomePage from '@/app/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage root redirect', () => {
  it('redirects to /play/[childId] when signed-in single-child', async () => {
    (ensureUserBootstrapped as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user_abc' });
    (listChildrenForUser as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    await expect(HomePage()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/play/child_1');
  });

  it('does NOT redirect for signed-out', async () => {
    (ensureUserBootstrapped as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('does NOT redirect when signed-in multi-child', async () => {
    (ensureUserBootstrapped as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user_abc' });
    (listChildrenForUser as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', displayName: 'A' },
      { id: 'c2', displayName: 'B' },
    ]);
    const result = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('does NOT redirect when signed-in zero-child', async () => {
    (ensureUserBootstrapped as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user_abc' });
    (listChildrenForUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
