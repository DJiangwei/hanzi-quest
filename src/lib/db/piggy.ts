// 存钱罐 ledger. SERVER-ONLY — never imported by a client component, and
// deliberately NOT under src/lib/actions/: every exported async function in a
// 'use server' file is a public RPC endpoint, and these take a raw childId.
import { and, desc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles, piggyEntries } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Auto sources carry a ref_id and are idempotent; manual sources do not. */
export type PiggySource =
  | 'boss_clear'
  | 'key_vault'
  | 'final_boss'
  | 'season_tier'
  | 'parent_credit'
  | 'purchase'
  | 'reconcile';

export interface PiggyEntry {
  id: string;
  deltaPence: number;
  source: PiggySource;
  category: string | null;
  note: string | null;
  occurredAt: Date;
}

export interface CreditInput {
  childId: string;
  source: PiggySource;
  /** Idempotency key. Same (child, source, refId) can only ever credit once. */
  refId: string;
  pence: number;
  occurredAt?: Date;
  note?: string;
}

/**
 * Credit inside an existing transaction, WITHOUT checking the enable flag.
 *
 * Two callers: `creditPiggy` (which checked the flag itself) and
 * `enablePiggyBankWithBackfill` (which is the statement that sets the flag, so
 * a fresh read would race its own write).
 *
 * Idempotency is ON CONFLICT DO NOTHING against `piggy_entries_auto_uq`, NOT a
 * caught 23505. This runs inside `claimSeasonTierInTx`'s transaction, and
 * Postgres aborts an entire transaction on any error unless it is wrapped in a
 * savepoint — catching the violation would poison the enclosing season claim
 * and fail every statement after it.
 */
export async function creditPiggyInTx(
  tx: Tx,
  input: CreditInput,
): Promise<{ credited: boolean }> {
  if (input.pence === 0) return { credited: false };
  const rows = await tx
    .insert(piggyEntries)
    .values({
      childId: input.childId,
      deltaPence: input.pence,
      source: input.source,
      refId: input.refId,
      note: input.note ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: piggyEntries.id });
  return { credited: rows.length > 0 };
}

/** True when this child's parent has opted them into the piggy bank. */
export async function isPiggyEnabled(childId: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: childProfiles.piggyBankEnabled })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  return row?.enabled === true;
}

/**
 * Credit an auto source. Checks the enable flag so no call site has to
 * remember: a disabled child accrues NOTHING, rather than accruing invisibly.
 * A hidden balance would surface at enable time as a number that bypassed the
 * parent's confirmation screen, which is what the confirmation exists for.
 */
export async function creditPiggy(
  input: CreditInput,
): Promise<{ credited: boolean }> {
  if (input.pence === 0) return { credited: false };
  if (!(await isPiggyEnabled(input.childId))) return { credited: false };
  return db.transaction((tx) => creditPiggyInTx(tx, input));
}

/** Balance = SUM(delta_pence). Never stored. */
export async function getPiggyBalance(childId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${piggyEntries.deltaPence}), 0)::int`,
    })
    .from(piggyEntries)
    .where(eq(piggyEntries.childId, childId));
  return row?.total ?? 0;
}

export async function listPiggyEntries(
  childId: string,
  limit = 50,
): Promise<PiggyEntry[]> {
  const rows = await db
    .select({
      id: piggyEntries.id,
      deltaPence: piggyEntries.deltaPence,
      source: piggyEntries.source,
      category: piggyEntries.category,
      note: piggyEntries.note,
      occurredAt: piggyEntries.occurredAt,
    })
    .from(piggyEntries)
    .where(eq(piggyEntries.childId, childId))
    .orderBy(desc(piggyEntries.occurredAt), desc(piggyEntries.createdAt))
    .limit(limit);
  return rows as PiggyEntry[];
}

/**
 * Total spend per category, as POSITIVE pence. Credits are excluded, and a
 * category with no spend is simply absent — the chart draws bars for what
 * exists rather than a row of zero-length stubs.
 */
export async function getSpendByCategory(
  childId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      category: piggyEntries.category,
      total: sql<number>`(-sum(${piggyEntries.deltaPence}))::int`,
    })
    .from(piggyEntries)
    .where(
      and(
        eq(piggyEntries.childId, childId),
        lt(piggyEntries.deltaPence, 0),
        isNotNull(piggyEntries.category),
      ),
    )
    .groupBy(piggyEntries.category);

  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.category) out[r.category] = r.total;
  }
  return out;
}

/**
 * Earned / spent, lifetime or inside a window. Derived, never stored — the same
 * rule season XP already follows, so a season is just a range and a NEW season
 * is just a later one.
 *
 * The parent surface calls this with no range (lifetime); the child's season
 * panel passes the active season's window.
 */
export async function getPiggyTotals(
  childId: string,
  range?: { from: Date; to: Date },
): Promise<{ earnedPence: number; spentPence: number }> {
  const scope = range
    ? and(
        eq(piggyEntries.childId, childId),
        gte(piggyEntries.occurredAt, range.from),
        lte(piggyEntries.occurredAt, range.to),
      )
    : eq(piggyEntries.childId, childId);

  const [row] = await db
    .select({
      earned: sql<number>`coalesce(sum(${piggyEntries.deltaPence}) filter (where ${piggyEntries.deltaPence} > 0), 0)::int`,
      spent: sql<number>`coalesce(-sum(${piggyEntries.deltaPence}) filter (where ${piggyEntries.deltaPence} < 0), 0)::int`,
    })
    .from(piggyEntries)
    .where(scope);
  return { earnedPence: row?.earned ?? 0, spentPence: row?.spent ?? 0 };
}

export interface ManualEntryInput {
  childId: string;
  source: Extract<PiggySource, 'parent_credit' | 'purchase' | 'reconcile'>;
  pence: number;
  category?: string | null;
  note?: string | null;
  occurredAt?: Date;
}

/** Manual entries carry ref_id = null, so they fall outside the unique index. */
export async function insertManualEntry(
  input: ManualEntryInput,
): Promise<PiggyEntry> {
  const [row] = await db
    .insert(piggyEntries)
    .values({
      childId: input.childId,
      deltaPence: input.pence,
      source: input.source,
      category: input.category ?? null,
      note: input.note ?? null,
      refId: null,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .returning({
      id: piggyEntries.id,
      deltaPence: piggyEntries.deltaPence,
      source: piggyEntries.source,
      category: piggyEntries.category,
      note: piggyEntries.note,
      occurredAt: piggyEntries.occurredAt,
    });
  return row as PiggyEntry;
}

const DELETABLE_SOURCES = ['parent_credit', 'purchase', 'reconcile'];

/**
 * Delete a parent-typed entry. Auto-earned entries are immutable: they double
 * as the idempotency guard, so deleting one would let it re-credit on a later
 * backfill.
 *
 * Deleting rather than writing a reversal is deliberate — a "-£45 correction"
 * row is unreadable to a six-year-old scanning her own history, and the parent
 * is the sole writer.
 */
export async function deleteManualEntry(
  childId: string,
  entryId: string,
): Promise<boolean> {
  const rows = await db
    .delete(piggyEntries)
    .where(
      and(
        eq(piggyEntries.id, entryId),
        eq(piggyEntries.childId, childId),
        sql`${piggyEntries.source} = any(${DELETABLE_SOURCES})`,
      ),
    )
    .returning({ id: piggyEntries.id });
  return rows.length > 0;
}
