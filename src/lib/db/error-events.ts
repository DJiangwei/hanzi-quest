// C3 — the write side of /admin/errors. SERVER-ONLY, and deliberately NOT
// under src/lib/actions/: every exported async function in a 'use server'
// file is a public RPC endpoint, and an endpoint that appends arbitrary rows
// to an error table is a spam vector.
import { and, desc, gte, sql } from 'drizzle-orm';
import { errorEvents } from '@/db/schema/error-events';

/**
 * How far back /admin/errors looks. The page states this out loud: "no errors"
 * and "no errors in this window" are different claims, and only one is true.
 */
export const ERROR_WINDOW_DAYS = 7;

/** Longer messages are truncated, never dropped. */
export const ERROR_MESSAGE_MAX = 2_000;
/** Stacks are the bulk of the row; enough frames to locate the throw. */
export const ERROR_STACK_MAX = 8_000;

export interface LogErrorOptions {
  childId?: string | null;
  /**
   * Small structured extras. IDs and primitives ONLY — never a child's display
   * name. /admin/errors is visible across accounts, so this field is inside
   * the isolation rule, not outside it.
   */
  context?: Record<string, unknown> | null;
}

function describe(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) {
    return {
      message: (err.message || err.name).slice(0, ERROR_MESSAGE_MAX),
      stack: err.stack ? err.stack.slice(0, ERROR_STACK_MAX) : null,
    };
  }
  // Real catch blocks receive strings, plain objects and undefined.
  let asText: string;
  try {
    asText = typeof err === 'string' ? err : JSON.stringify(err);
  } catch {
    asText = Object.prototype.toString.call(err);
  }
  return { message: (asText ?? String(err)).slice(0, ERROR_MESSAGE_MAX), stack: null };
}

/**
 * Record a server-side failure, and echo it to the runtime log.
 *
 * **This function never throws and never rejects.** Its callers are already
 * handling a failure; if logging that failure threw, it would replace a
 * handled error with an unhandled one — the logger becoming the outage. The
 * console.error is kept deliberately: the database is the browsable record,
 * but the runtime log is the one that still works when the database is itself
 * the thing that broke.
 */
export async function logError(
  scope: string,
  err: unknown,
  opts: LogErrorOptions = {},
): Promise<void> {
  const { message, stack } = describe(err);
  console.error(`[${scope}]`, err);
  try {
    // Imported HERE, not at module scope. A logger has to be safe to drop into
    // any file, and `@/db` throws on import when DATABASE_URL is unset — which
    // is every test that mocks the individual `@/lib/db/*` modules rather than
    // `@/db` itself. Adding logError to an action must never oblige someone to
    // go and edit that action's test; the first version of this file did, and
    // broke 14 suites at once.
    const { db } = await import('@/db');
    await db.insert(errorEvents).values({
      scope,
      message,
      stack,
      childId: opts.childId ?? null,
      context: opts.context ?? null,
    });
  } catch (writeErr) {
    // Swallowed on purpose — see the contract above. Echoed so the failure to
    // log is not itself invisible.
    console.error('[logError] could not persist error event:', writeErr);
  }
}

export interface ErrorGroup {
  scope: string;
  count: number;
  lastSeen: Date;
  lastMessage: string;
}

/** Failures in the window, newest-first by most recent occurrence. */
export async function listErrorGroups(sinceDays = ERROR_WINDOW_DAYS): Promise<ErrorGroup[]> {
  const { db } = await import('@/db');
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      scope: errorEvents.scope,
      count: sql<number>`count(*)::int`,
      lastSeen: sql<Date>`max(${errorEvents.createdAt})`,
      lastMessage: sql<string>`(array_agg(${errorEvents.message} order by ${errorEvents.createdAt} desc))[1]`,
    })
    .from(errorEvents)
    .where(gte(errorEvents.createdAt, since))
    .groupBy(errorEvents.scope)
    .orderBy(desc(sql`max(${errorEvents.createdAt})`));
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export interface ErrorInstance {
  id: string;
  message: string;
  stack: string | null;
  childId: string | null;
  createdAt: Date;
}

/** The most recent instances of one scope, for reading the actual stack. */
export async function listErrorInstances(
  scope: string,
  sinceDays = ERROR_WINDOW_DAYS,
  limit = 20,
): Promise<ErrorInstance[]> {
  const { db } = await import('@/db');
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  return db
    .select({
      id: errorEvents.id,
      message: errorEvents.message,
      stack: errorEvents.stack,
      childId: errorEvents.childId,
      createdAt: errorEvents.createdAt,
    })
    .from(errorEvents)
    .where(and(sql`${errorEvents.scope} = ${scope}`, gte(errorEvents.createdAt, since)))
    .orderBy(desc(errorEvents.createdAt))
    .limit(limit);
}
