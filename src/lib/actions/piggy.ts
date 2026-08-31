'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  deleteManualEntry,
  getPiggyBalance,
  insertManualEntry,
  isPiggyEnabled,
} from '@/lib/db/piggy';
import {
  disablePiggyBank,
  enablePiggyBankWithBackfill,
} from '@/lib/db/piggy-backfill';
import { isPiggyCategory } from '@/lib/piggy/categories';
import { parsePoundsToPence } from '@/lib/piggy/money';

// childId is validated by requireChild (the real gate) — min(1) keeps
// non-uuid test/dev ids working while still rejecting empty input.
const CreditSchema = z.object({
  childId: z.string().min(1),
  pounds: z.string(),
  note: z.string().max(200).optional(),
  occurredAt: z.string().optional(),
});

const PurchaseSchema = CreditSchema.extend({ category: z.string() });

const ReconcileSchema = z.object({
  childId: z.string().min(1),
  actualPounds: z.string(),
});

const EntrySchema = z.object({
  childId: z.string().min(1),
  entryId: z.string().min(1),
});

const EnableSchema = z.object({
  childId: z.string().min(1),
  enabled: z.boolean(),
});

type Result = { ok: true } | { ok: false; error: string };

function revalidate(childId: string) {
  revalidatePath(`/parent/children/${childId}/piggy-bank`);
  revalidatePath(`/play/${childId}`);
  revalidatePath(`/play/${childId}/piggy-bank`);
}

/** Optional date from a <input type="date">; invalid input falls back to now. */
function parseOccurredAt(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parent adds real money to the jar (birthday money, a gift from a relative). */
export async function addPiggyCreditAction(
  input: z.input<typeof CreditSchema>,
): Promise<Result> {
  const parsed = CreditSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  if (!(await isPiggyEnabled(child.id))) {
    return { ok: false, error: 'piggy_disabled' };
  }

  const pence = parsePoundsToPence(parsed.pounds);
  if (pence === null || pence === 0) {
    return { ok: false, error: 'invalid_amount' };
  }

  await insertManualEntry({
    childId: child.id,
    source: 'parent_credit',
    pence,
    note: parsed.note?.trim() || null,
    occurredAt: parseOccurredAt(parsed.occurredAt),
  });
  revalidate(child.id);
  return { ok: true };
}

/** Parent records something the child's money bought. Stored NEGATIVE. */
export async function recordPiggyPurchaseAction(
  input: z.input<typeof PurchaseSchema>,
): Promise<Result> {
  const parsed = PurchaseSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  if (!(await isPiggyEnabled(child.id))) {
    return { ok: false, error: 'piggy_disabled' };
  }

  const pence = parsePoundsToPence(parsed.pounds);
  if (pence === null || pence === 0) {
    return { ok: false, error: 'invalid_amount' };
  }
  if (!isPiggyCategory(parsed.category)) {
    return { ok: false, error: 'invalid_category' };
  }

  await insertManualEntry({
    childId: child.id,
    source: 'purchase',
    pence: -pence,
    category: parsed.category,
    note: parsed.note?.trim() || null,
    occurredAt: parseOccurredAt(parsed.occurredAt),
  });
  revalidate(child.id);
  return { ok: true };
}

/**
 * The jar and the ledger disagree. The parent types what is ACTUALLY in the
 * jar; the difference is recorded as one entry.
 *
 * This is not a reversal and must not be used as one — a mistyped row is
 * deleted, whereas a genuine disagreement between the jar and the books is a
 * real event worth keeping.
 */
export async function reconcilePiggyAction(
  input: z.input<typeof ReconcileSchema>,
): Promise<
  { ok: true; adjustedPence: number } | { ok: false; error: string }
> {
  const parsed = ReconcileSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  if (!(await isPiggyEnabled(child.id))) {
    return { ok: false, error: 'piggy_disabled' };
  }

  const actual = parsePoundsToPence(parsed.actualPounds);
  if (actual === null) return { ok: false, error: 'invalid_amount' };

  const balance = await getPiggyBalance(child.id);
  const diff = actual - balance;
  if (diff === 0) return { ok: true, adjustedPence: 0 };

  await insertManualEntry({
    childId: child.id,
    source: 'reconcile',
    pence: diff,
    note: 'Counted the jar',
  });
  revalidate(child.id);
  return { ok: true, adjustedPence: diff };
}

/** Delete a parent-typed entry. Auto-earned entries are immutable. */
export async function deletePiggyEntryAction(
  input: z.input<typeof EntrySchema>,
): Promise<Result> {
  const parsed = EntrySchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const deleted = await deleteManualEntry(child.id, parsed.entryId);
  if (!deleted) return { ok: false, error: 'not_deletable' };
  revalidate(child.id);
  return { ok: true };
}

/**
 * Opt this child in or out. Enabling credits past progress in the same
 * transaction; disabling KEEPS the ledger, because money already earned stays
 * earned and the unique index prevents a re-enable from double-crediting.
 */
export async function setPiggyEnabledAction(
  input: z.input<typeof EnableSchema>,
): Promise<{ ok: true; creditedPence: number; entries: number }> {
  const parsed = EnableSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  if (!parsed.enabled) {
    await disablePiggyBank(child.id);
    revalidate(child.id);
    return { ok: true, creditedPence: 0, entries: 0 };
  }

  const res = await enablePiggyBankWithBackfill(child.id);
  revalidate(child.id);
  return { ok: true, ...res };
}
