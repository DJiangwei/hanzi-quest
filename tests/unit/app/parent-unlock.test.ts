import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));
vi.mock('@/lib/db/parent-settings', () => ({
  getParentSettings: vi.fn(),
  setParentPin: vi.fn(),
  recordFailedAttempt: vi.fn(),
  clearFailedAttempts: vi.fn(),
}));

import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import {
  getParentSettings,
  setParentPin,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/db/parent-settings';
import { hashPin } from '@/lib/auth/parent-pin';
import { POST } from '@/app/api/parent-unlock/route';

const setCookieMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ set: setCookieMock });
  (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user_abc' });
});

function makeReq(body: Record<string, unknown>): Request {
  return new Request('http://test/api/parent-unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/parent-unlock', () => {
  it('returns 401 when signed out', async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const res = await POST(makeReq({ pin: '1234' }));
    expect(res.status).toBe(401);
  });

  it('rejects malformed PIN', async () => {
    const res = await POST(makeReq({ pin: 'abcd' }));
    expect(res.status).toBe(400);
  });

  it('sets PIN on first-time submission (no existing row)', async () => {
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(makeReq({ pin: '1234', mode: 'set' }));
    expect(setParentPin).toHaveBeenCalledWith('user_abc', expect.stringMatching(/^\$2/));
    expect(setCookieMock).toHaveBeenCalledWith(
      'parent_unlocked',
      '1',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 900 }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 423 when locked', async () => {
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      clerkUserId: 'user_abc',
      parentPinHash: await hashPin('1234'),
      pinSetAt: new Date(),
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    const res = await POST(makeReq({ pin: '1234' }));
    expect(res.status).toBe(423);
  });

  it('verifies correct PIN, sets cookie, clears attempts', async () => {
    const hash = await hashPin('1234');
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      clerkUserId: 'user_abc',
      parentPinHash: hash,
      pinSetAt: new Date(),
      failedAttempts: 2,
      lockedUntil: null,
    });
    const res = await POST(makeReq({ pin: '1234' }));
    expect(res.status).toBe(200);
    expect(clearFailedAttempts).toHaveBeenCalledWith('user_abc');
    expect(setCookieMock).toHaveBeenCalled();
  });

  it('records failure on wrong PIN', async () => {
    const hash = await hashPin('1234');
    (getParentSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      clerkUserId: 'user_abc',
      parentPinHash: hash,
      pinSetAt: new Date(),
      failedAttempts: 1,
      lockedUntil: null,
    });
    const res = await POST(makeReq({ pin: '9999' }));
    expect(res.status).toBe(401);
    expect(recordFailedAttempt).toHaveBeenCalledWith('user_abc', 1);
    expect(setCookieMock).not.toHaveBeenCalled();
  });
});
