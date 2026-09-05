// C3 — the error log behind /admin/errors.
//
// The whole point of this table is to be trustworthy when something has
// already gone wrong, so the helper's contract is unusually strict: it must
// never throw, never reject, and never be the reason a caller fails. A logger
// that breaks the thing it is logging is worse than no logger.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), values: vi.fn() }));
vi.mock('@/db', () => ({
  db: { insert: (...a: unknown[]) => mocks.insert(...a) },
}));

import { logError, ERROR_MESSAGE_MAX, ERROR_STACK_MAX } from '@/lib/db/error-events';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.values.mockResolvedValue(undefined);
  mocks.insert.mockReturnValue({ values: (...a: unknown[]) => mocks.values(...a) });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('logError', () => {
  it('does not touch @/db until it is actually called', async () => {
    // The first version imported `@/db` at module scope, and `@/db` throws on
    // import when DATABASE_URL is unset — which is every suite that mocks the
    // individual `@/lib/db/*` modules instead of `@/db` itself. Adding logError
    // to one action broke 14 unrelated suites at once. A logger has to be safe
    // to drop into any file, so the client is imported inside the call.
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/lib/db/error-events.ts', 'utf8'),
    );
    const topLevelImports = src
      .split('\n')
      .filter((l) => l.startsWith('import ') || l.startsWith('} from '));
    expect(topLevelImports.join('\n')).not.toContain("'@/db'");
    expect(src).toContain("await import('@/db')");
  });

  it('writes scope, message and stack', async () => {
    await logError('finishAttemptAction', new Error('boom'));
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'finishAttemptAction', message: 'boom' }),
    );
    const row = mocks.values.mock.calls[0][0] as { stack: string | null };
    expect(row.stack).toContain('Error: boom');
  });

  it('still console.errors, so Vercel runtime logs keep working', async () => {
    // The DB table is the durable, browsable record; the runtime log is the
    // one that survives the database itself being the thing that broke.
    await logError('someScope', new Error('boom'));
    expect(console.error).toHaveBeenCalled();
  });

  it('NEVER throws when the insert fails', async () => {
    // The caller is already handling a failure. If logging that failure throws,
    // it replaces a handled error with an unhandled one.
    mocks.values.mockRejectedValueOnce(new Error('db is down'));
    await expect(logError('someScope', new Error('boom'))).resolves.toBeUndefined();
  });

  it('NEVER throws when handed something that is not an Error', async () => {
    // Real catch blocks receive strings, objects, and undefined.
    await expect(logError('someScope', 'just a string')).resolves.toBeUndefined();
    await expect(logError('someScope', undefined)).resolves.toBeUndefined();
    await expect(logError('someScope', { weird: true })).resolves.toBeUndefined();
    expect(mocks.values).toHaveBeenCalledTimes(3);
  });

  it('truncates a huge message and stack rather than refusing to log', async () => {
    const huge = 'x'.repeat(ERROR_MESSAGE_MAX + 5_000);
    const err = new Error(huge);
    err.stack = 'y'.repeat(ERROR_STACK_MAX + 50_000);
    await logError('someScope', err);
    const row = mocks.values.mock.calls[0][0] as { message: string; stack: string };
    expect(row.message.length).toBe(ERROR_MESSAGE_MAX);
    expect(row.stack.length).toBe(ERROR_STACK_MAX);
  });

  it('carries an optional childId and context', async () => {
    await logError('someScope', new Error('boom'), {
      childId: 'aaaaaaaa-0000-4000-a000-000000000001',
      context: { weekId: 'w1' },
    });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: 'aaaaaaaa-0000-4000-a000-000000000001',
        context: { weekId: 'w1' },
      }),
    );
  });

  it('defaults childId and context to null rather than undefined', async () => {
    // undefined makes drizzle omit the column from the INSERT; null is the
    // value the column actually wants.
    await logError('someScope', new Error('boom'));
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ childId: null, context: null }),
    );
  });
});
