import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/bootstrap', () => ({ ensureUserBootstrapped: vi.fn() }));
vi.mock('@/lib/db/children', () => ({ listChildrenForUser: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
// EntryChooser pulls in 'use server' actions (→ @/db); stub it.
vi.mock('@/components/EntryChooser', () => ({ EntryChooser: () => null }));

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { listChildrenForUser } from '@/lib/db/children';
import HomePage from '@/app/page';

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function mockCookie(value?: string) {
  asMock(cookies).mockResolvedValue({
    get: (name: string) =>
      value !== undefined && name === 'hq_entry' ? { value } : undefined,
  });
}

function call(choose?: string) {
  return HomePage({
    searchParams: Promise.resolve(choose ? { choose } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage entry routing', () => {
  it('renders the landing (no redirect) when signed-out', async () => {
    asMock(ensureUserBootstrapped).mockResolvedValue(null);
    const result = await call();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('shows the chooser (no redirect) on first login with no saved choice', async () => {
    asMock(ensureUserBootstrapped).mockResolvedValue({ id: 'user_abc' });
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    mockCookie(undefined);
    const result = await call();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('auto-redirects to the remembered kid game', async () => {
    asMock(ensureUserBootstrapped).mockResolvedValue({ id: 'user_abc' });
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    mockCookie('kid:child_1');
    await expect(call()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/play/child_1');
  });

  it('auto-redirects to /parent when parent was remembered', async () => {
    asMock(ensureUserBootstrapped).mockResolvedValue({ id: 'user_abc' });
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    mockCookie('parent');
    await expect(call()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/parent');
  });

  it('ignores the remembered choice when ?choose=1 forces the chooser', async () => {
    asMock(ensureUserBootstrapped).mockResolvedValue({ id: 'user_abc' });
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    mockCookie('kid:child_1');
    const result = await call('1');
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('does not redirect to a remembered kid that no longer exists', async () => {
    asMock(ensureUserBootstrapped).mockResolvedValue({ id: 'user_abc' });
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_2', displayName: 'Other' },
    ]);
    mockCookie('kid:child_1');
    const result = await call();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
