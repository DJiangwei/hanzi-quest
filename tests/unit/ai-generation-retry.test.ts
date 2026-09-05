// Authoring resilience: the AI SDK will not retry a dropped connection.
//
// deepseek-v4-pro is a reasoning model, so a week's generation is one long HTTP
// call — and long calls are the ones whose connections get dropped. Authoring
// Map 2 died on week 1 with `ECONNRESET` AFTER a HTTP 200, and the SDK marks
// that `isRetryable: false` because a 200 that fails afterwards is not a status
// it classifies. Its own retry never fired. So the retry lives in
// generate-content.ts, where both authoring actions and the seed scripts get it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateObject: vi.fn(), persist: vi.fn() }));

vi.mock('@/db', () => ({ db: {} }));
vi.mock('ai', () => ({ generateObject: mocks.generateObject }));
vi.mock('@ai-sdk/deepseek', () => ({ deepseek: () => ({}) }));

import { withAiRetry, AI_ATTEMPTS, isWorthRetrying } from '@/lib/ai/generate-content';

class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('isWorthRetrying', () => {
  it('retries a dropped connection', () => {
    // The real shape: HTTP 200, then the body terminates. No usable status.
    expect(isWorthRetrying(new Error('terminated: read ECONNRESET'))).toBe(true);
  });

  it('retries a 500 and a 429', () => {
    expect(isWorthRetrying(new ApiError('server error', 500))).toBe(true);
    expect(isWorthRetrying(new ApiError('rate limited', 429))).toBe(true);
  });

  it('does NOT retry auth or bad-request failures', () => {
    // These repeat identically. Retrying a wrong API key three times just makes
    // the author wait two extra minutes for the same message.
    expect(isWorthRetrying(new ApiError('unauthorized', 401))).toBe(false);
    expect(isWorthRetrying(new ApiError('forbidden', 403))).toBe(false);
    expect(isWorthRetrying(new ApiError('bad request', 400))).toBe(false);
  });
});

describe('withAiRetry', () => {
  it('returns the first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withAiRetry('x', fn, () => 0)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recovers from a dropped connection on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('terminated'))
      .mockResolvedValue('ok');
    await expect(withAiRetry('x', fn, () => 0)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after AI_ATTEMPTS and rethrows the LAST error', async () => {
    // Rethrowing matters: the authoring action puts this message in front of
    // David, and "attempt 3 failed" is more useful than the first attempt's.
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(new Error('third'));
    await expect(withAiRetry('x', fn, () => 0)).rejects.toThrow('third');
    expect(fn).toHaveBeenCalledTimes(AI_ATTEMPTS);
  });

  it('stops immediately on an auth failure instead of burning attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError('unauthorized', 401));
    await expect(withAiRetry('x', fn, () => 0)).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });
}, 30_000);
