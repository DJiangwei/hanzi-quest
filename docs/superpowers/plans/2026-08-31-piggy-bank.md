# 存钱罐 Piggy Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track a child's real pocket money in-app — the parent keeps the books, the child sees her balance and where her money went, and beating bosses pays £.

**Architecture:** One append-only `piggy_entries` ledger; the balance is `SUM(delta_pence)` and is never stored. Auto-credits fire from four existing reward paths through a single `creditPiggy` helper, made idempotent by a partial unique index on `(child_id, source, ref_id)`. The whole subsystem is off by default behind a per-child `piggy_bank_enabled` flag, and enabling it credits past progress in the same transaction.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM + Neon Postgres, Clerk auth, Vitest + React Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-31-piggy-bank-design.md`

## Global Constraints

- **Integer pence everywhere. Never a float.** All money in the DB, in props, and in function signatures is `number` meaning pence. Formatting happens only in `formatPence`.
- **Bilingual chrome on every kid-facing label** — `中文 / English`, ZH first. Use `bi(zh, en)` from `@/lib/i18n/bilingual` for single strings, or a ZH-span + EN-span pair in JSX. The parent dashboard is **English-only** and exempt.
- **£ never appears on any social/crew surface** — no rank, no comparison, no gifts-style tally between children. Ever.
- **A zero balance is never rendered as failure.** £0 shows an empty jar and 攒钱中… / Saving up. No "£0 earned", no streak, no since-last-earned counter.
- **`src/lib/db/piggy.ts` is a plain server module, never `'use server'`.** Every exported async function in a `'use server'` file is a public RPC endpoint; a trust-caller helper taking a raw `childId` must not live there.
- **Every server action opens with `requireChild(childId)`** — it proves *this parent owns this child*, which `assertParent()` does not (that only means "is signed in").
- **Migrations are append-only.** Never edit a committed `drizzle/*.sql`; generate a new one. Schema source of truth is `src/db/schema/*.ts`.
- **Tests mock external boundaries** (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`). No test hits a real DB or network.
- **`pnpm typecheck && pnpm lint && pnpm test` must be green** at every commit. Use `npx next build` for a compile-only check — `pnpm build` runs migrations against a live Neon branch first.
- **Reduced motion**: any animated component must respect `useReducedMotion()`.

---

## File Structure

**New — pure, client-safe (no db imports):**
- `src/lib/piggy/money.ts` — pence formatting and parsing. The only place a £ string is produced.
- `src/lib/piggy/categories.ts` — the seven spend categories, emoji + bilingual labels.
- `src/lib/piggy/rates.ts` — what each game event pays, in pence.

**New — server-only:**
- `src/db/schema/piggy.ts` — the `piggy_entries` table.
- `src/lib/db/piggy.ts` — reads and writes. `creditPiggy`, `creditPiggyInTx`, balance, entries, category totals, season summary.
- `src/lib/db/piggy-backfill.ts` — `computePastProgressCredits` + `enablePiggyBankWithBackfill`. Split from `piggy.ts` because it reaches into four other subsystems' tables and would otherwise make the core module hard to hold in context.
- `src/lib/actions/piggy.ts` — the parent's server actions.

**New — UI:**
- `src/components/piggy/PiggyJar.tsx` — the balance + jar illustration (client, shared by kid page and home card).
- `src/components/piggy/PiggyHistory.tsx` — the entry list (kid-facing, bilingual).
- `src/components/piggy/PiggyBreakdown.tsx` — horizontal category bars.
- `src/components/play/PiggyBankCard.tsx` — the home-page entry card.
- `src/app/play/[childId]/piggy-bank/page.tsx` — the kid page.
- `src/components/parent/PiggyBankPanel.tsx` — the parent's forms (client).
- `src/app/parent/(secured)/children/[id]/piggy-bank/page.tsx` — the parent page.

**New — scripts:**
- `scripts/sync-season-tier-config.ts` — updates a live season's `tier_config` only.

**Modified:**
- `src/db/schema/auth.ts` — add `piggyBankEnabled` to `childProfiles`.
- `src/db/schema/index.ts` — export the new schema file.
- `src/lib/season/types.ts` — `SeasonTier.bonusMoneyPence?: number`.
- `src/lib/season/summerVoyage.ts` — money on tiers 10 / 20 / 30.
- `src/lib/db/season.ts` — `claimSeasonTierInTx` credits the piggy bank.
- `src/lib/actions/play.ts` — `EconomyBonus.unit`; boss + vault credits.
- `src/lib/actions/final-boss.ts` — final-boss credit.
- `src/components/play/BonusToast.tsx` — render pence bonuses.
- `src/components/play/WeekHub.tsx` — the 💷 pre-fight line.
- `src/app/play/[childId]/page.tsx` — mount the home card.

---

## Task 1: Pure money, categories, and rates

Three small client-safe modules with no dependencies. Everything else imports them, so they come first.

**Files:**
- Create: `src/lib/piggy/money.ts`
- Create: `src/lib/piggy/categories.ts`
- Create: `src/lib/piggy/rates.ts`
- Test: `tests/unit/piggy-money.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatPence(pence: number): string`
  - `parsePoundsToPence(input: string): number | null`
  - `PIGGY_CATEGORIES: readonly PiggyCategoryDef[]`, `type PiggyCategory`, `getPiggyCategory(slug: string): PiggyCategoryDef | null`, `isPiggyCategory(v: string): v is PiggyCategory`
  - `PIGGY_BOSS_CLEAR_PENCE`, `PIGGY_KEY_VAULT_PENCE`, `PIGGY_FINAL_BOSS_PENCE`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-money.test.ts`:

```ts
// Pure money + category modules. No db, no mocks — if this file ever needs
// vi.mock('@/db'), something has leaked a server import into a client module.
import { describe, expect, it } from 'vitest';
import { formatPence, parsePoundsToPence } from '@/lib/piggy/money';
import {
  PIGGY_CATEGORIES,
  getPiggyCategory,
  isPiggyCategory,
} from '@/lib/piggy/categories';

describe('formatPence', () => {
  it('renders whole pounds, pence, and the zero case', () => {
    expect(formatPence(100)).toBe('£1.00');
    expect(formatPence(1450)).toBe('£14.00');
    expect(formatPence(0)).toBe('£0.00');
  });

  it('pads single-digit pence — £0.05 must never render as £0.5', () => {
    expect(formatPence(5)).toBe('£0.05');
    expect(formatPence(150)).toBe('£1.50');
    expect(formatPence(1205)).toBe('£12.05');
  });

  it('renders negatives with the sign outside the symbol', () => {
    expect(formatPence(-250)).toBe('-£2.50');
  });
});

describe('parsePoundsToPence', () => {
  it('accepts the shapes a parent actually types', () => {
    expect(parsePoundsToPence('1.50')).toBe(150);
    expect(parsePoundsToPence('1.5')).toBe(150);
    expect(parsePoundsToPence('2')).toBe(200);
    expect(parsePoundsToPence('0.05')).toBe(5);
    expect(parsePoundsToPence(' £3.25 ')).toBe(325);
  });

  it('rounds rather than truncating — 1.15 * 100 is 114.999… in binary', () => {
    expect(parsePoundsToPence('1.15')).toBe(115);
    expect(parsePoundsToPence('8.29')).toBe(829);
  });

  it('rejects anything that is not a plain non-negative amount', () => {
    expect(parsePoundsToPence('')).toBeNull();
    expect(parsePoundsToPence('.')).toBeNull();
    expect(parsePoundsToPence('abc')).toBeNull();
    expect(parsePoundsToPence('1.234')).toBeNull();
    expect(parsePoundsToPence('-5')).toBeNull();
    expect(parsePoundsToPence('1e3')).toBeNull();
  });
});

describe('piggy categories', () => {
  it('has the seven agreed categories, each bilingual with an emoji', () => {
    expect(PIGGY_CATEGORIES).toHaveLength(7);
    for (const c of PIGGY_CATEGORIES) {
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.zh.length).toBeGreaterThan(0);
      expect(c.en.length).toBeGreaterThan(0);
    }
    expect(PIGGY_CATEGORIES.map((c) => c.slug)).toEqual([
      'toys', 'snacks', 'books', 'gifts', 'crafts', 'outings', 'other',
    ]);
  });

  it('includes gifts — spending on someone else is the one kind worth praising', () => {
    expect(getPiggyCategory('gifts')?.zh).toBe('礼物');
  });

  it('narrows unknown slugs', () => {
    expect(isPiggyCategory('toys')).toBe(true);
    expect(isPiggyCategory('crypto')).toBe(false);
    expect(getPiggyCategory('crypto')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-money.test.ts`
Expected: FAIL — `Cannot find module '@/lib/piggy/money'`.

- [ ] **Step 3: Write the implementations**

Create `src/lib/piggy/money.ts`:

```ts
// Pure money formatting. Client-safe — NO db imports.
//
// Every £ string in the app is produced here. Money is integer pence
// everywhere else: a float column drifts by rounding error, and 1.15 has no
// exact binary representation.

/** Format integer pence as a £ string: 150 → "£1.50", -250 → "-£2.50". */
export function formatPence(pence: number): string {
  const negative = pence < 0;
  const abs = Math.abs(Math.trunc(pence));
  const body = `£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}

/**
 * Parse a £ amount typed by a parent ("1.50", "1.5", ".5", "2", "£3.25") into
 * integer pence. Returns null for anything that is not a plain non-negative
 * amount with at most two decimal places.
 *
 * `Math.round` is load-bearing: Number('1.15') * 100 === 114.99999999999999,
 * so truncating would quietly bill 1p less on a large fraction of inputs.
 */
export function parsePoundsToPence(input: string): number | null {
  const trimmed = input.trim().replace(/^£/, '').trim();
  if (trimmed === '' || trimmed === '.') return null;
  if (!/^\d*\.?\d{0,2}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
```

Create `src/lib/piggy/categories.ts`:

```ts
// The seven spend categories. Client-safe — NO db imports.
//
// Fixed once the child has history: changing a slug orphans past entries.
// Adding one is safe (the column is plain text, not a pgEnum).

export interface PiggyCategoryDef {
  slug: string;
  emoji: string;
  zh: string;
  en: string;
}

/**
 * 礼物 is here deliberately: spending money on someone else is the one
 * spending category worth encouraging, and it has to be nameable before it
 * can be praised.
 */
export const PIGGY_CATEGORIES = [
  { slug: 'toys', emoji: '🧸', zh: '玩具', en: 'Toys' },
  { slug: 'snacks', emoji: '🍬', zh: '零食', en: 'Snacks' },
  { slug: 'books', emoji: '📚', zh: '书', en: 'Books' },
  { slug: 'gifts', emoji: '🎁', zh: '礼物', en: 'Gifts' },
  { slug: 'crafts', emoji: '🎨', zh: '手工', en: 'Crafts' },
  { slug: 'outings', emoji: '🎢', zh: '玩乐', en: 'Fun' },
  { slug: 'other', emoji: '✨', zh: '其他', en: 'Other' },
] as const satisfies readonly PiggyCategoryDef[];

export type PiggyCategory = (typeof PIGGY_CATEGORIES)[number]['slug'];

export function getPiggyCategory(slug: string): PiggyCategoryDef | null {
  return PIGGY_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

export function isPiggyCategory(value: string): value is PiggyCategory {
  return PIGGY_CATEGORIES.some((c) => c.slug === value);
}
```

Create `src/lib/piggy/rates.ts`:

```ts
// What each game event pays, in pence. Client-safe — the WeekHub pre-fight
// preview is a client component and imports PIGGY_BOSS_CLEAR_PENCE.
//
// A map pays £14: ten weekly bosses (£1 each) + the key vault (£1) + the
// final overlord (£3). Season tiers carry their own amounts in the season's
// tier_config, not here, so a season's payout can change without a deploy.

export const PIGGY_BOSS_CLEAR_PENCE = 100;
export const PIGGY_KEY_VAULT_PENCE = 100;
export const PIGGY_FINAL_BOSS_PENCE = 300;
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/piggy-money.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/piggy tests/unit/piggy-money.test.ts
git commit -m "feat(piggy): pure money, category, and rate modules

Integer pence everywhere; formatPence is the only place a £ string is made.
parsePoundsToPence rounds rather than truncates — Number('1.15') * 100 is
114.99999999999999, so truncation would silently bill a penny less."
```

---

## Task 2: Schema and migration 0041

**Files:**
- Create: `src/db/schema/piggy.ts`
- Modify: `src/db/schema/auth.ts` (add one column to `childProfiles`)
- Modify: `src/db/schema/index.ts` (one export line)
- Create: `drizzle/0041_*.sql` (generated, do not hand-write)

**Interfaces:**
- Consumes: `childProfiles` from `./auth`.
- Produces: `piggyEntries` table object; `childProfiles.piggyBankEnabled` boolean column.

There is no unit test here — schema shape is verified by the generated SQL and by `pnpm typecheck`. The tests that matter arrive in Task 3.

- [ ] **Step 1: Create the schema file**

Create `src/db/schema/piggy.ts`:

```ts
// Drizzle schema · 存钱罐 piggy bank — real pocket money.
//
// ONE append-only ledger. The balance is SUM(delta_pence) and is deliberately
// NOT stored: a denormalised total drifts from its history, and this number
// has to match a jar the child can physically count. Same rule as 🗝️ keys
// (derived from week_progress) and season XP (derived from xp_events).
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const piggyEntries = pgTable(
  'piggy_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    /** Signed: credits positive, debits negative. One code path per change. */
    deltaPence: integer('delta_pence').notNull(),
    /**
     * PiggySource (src/lib/db/piggy.ts). Plain text, NOT a pgEnum — same
     * choice as card_grants_log.source, so a future source needs no migration.
     */
    source: text('source').notNull(),
    /** PiggyCategory slug. Debits only; null on every credit. */
    category: text('category'),
    note: text('note'),
    /** Idempotency key for auto sources; null on manual entries. */
    refId: text('ref_id'),
    /**
     * When the money actually moved — the parent may log yesterday's purchase,
     * and backfilled entries carry the date they were earned. Every list and
     * chart orders by this; created_at exists only for audit.
     */
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('piggy_entries_child_idx').on(t.childId, t.occurredAt.desc()),
    /**
     * PARTIAL on purpose. Auto-credits are idempotent through this index;
     * manual entries legitimately repeat (two 🍬 purchases in one day are two
     * rows, not a conflict), and they carry ref_id = null so they fall outside
     * it entirely.
     */
    uniqueIndex('piggy_entries_auto_uq')
      .on(t.childId, t.source, t.refId)
      .where(sql`${t.refId} is not null`),
  ],
);
```

- [ ] **Step 2: Add the per-child flag**

In `src/db/schema/auth.ts`, inside the `childProfiles` table definition, add after the `gender` column:

```ts
  /**
   * 存钱罐: off by default and opted into per-child by that child's OWN parent.
   * Auto-crediting every child in the deployment would commit other families
   * to a real payout schedule they never agreed to.
   */
  piggyBankEnabled: boolean('piggy_bank_enabled').notNull().default(false),
```

Add `boolean` to the existing `drizzle-orm/pg-core` import list at the top of that file if it is not already there.

- [ ] **Step 3: Export the schema**

In `src/db/schema/index.ts`, append:

```ts
export * from './piggy';
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `drizzle/0041_<name>.sql` plus an updated `drizzle/meta/` journal.

- [ ] **Step 5: Read the generated SQL and confirm it matches**

Run: `cat drizzle/0041_*.sql`

Confirm all four of these appear. If the partial index predicate is missing, **stop** — the whole idempotency story depends on it:

```sql
ALTER TABLE "child_profiles" ADD COLUMN "piggy_bank_enabled" boolean DEFAULT false NOT NULL;
CREATE TABLE "piggy_entries" ( ... );
CREATE INDEX "piggy_entries_child_idx" ON "piggy_entries" USING btree ("child_id","occurred_at" DESC);
CREATE UNIQUE INDEX "piggy_entries_auto_uq" ON "piggy_entries" USING btree ("child_id","source","ref_id") WHERE "piggy_entries"."ref_id" is not null;
```

- [ ] **Step 6: Apply against the dev branch and verify the index really exists**

Local `.env.local` points at the Neon **dev** branch, so this is safe.

```bash
pnpm db:migrate
```

Then confirm the index is real — this is the one thing no unit test can prove, because tests mock `@/db`:

```bash
pnpm tsx -e "
import { loadEnv } from './scripts/_env';
loadEnv();
const { db } = await import('@/db');
const { sql } = await import('drizzle-orm');
const r = await db.execute(sql\`select indexdef from pg_indexes where indexname = 'piggy_entries_auto_uq'\`);
console.log(r.rows ?? r);
"
```

Expected: one row whose `indexdef` ends in `WHERE (ref_id IS NOT NULL)`.

If `scripts/_env` does not exist, read how `scripts/seed-pirate-class.ts` loads env and mirror it — env must be loaded *before* the db client is imported.

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm typecheck
git add src/db/schema drizzle
git commit -m "feat(piggy): piggy_entries ledger + per-child enable flag (migration 0041)

Balance is SUM(delta_pence), never stored — the number has to match a jar the
child can count, and a denormalised total drifts from its history.

The unique index is PARTIAL (WHERE ref_id IS NOT NULL): auto-credits are
idempotent through it, while manual entries carry ref_id = null and may
legitimately repeat."
```

---

## Task 3: The ledger module

**Files:**
- Create: `src/lib/db/piggy.ts`
- Test: `tests/unit/piggy-db.test.ts`

**Interfaces:**
- Consumes: `piggyEntries`, `childProfiles` from `@/db/schema`; `PiggyCategory` from Task 1.
- Produces:
  - `type PiggySource = 'boss_clear' | 'key_vault' | 'final_boss' | 'season_tier' | 'parent_credit' | 'purchase' | 'reconcile'`
  - `interface PiggyEntry { id, deltaPence, source, category, note, occurredAt }`
  - `creditPiggyInTx(tx, input: CreditInput): Promise<{ credited: boolean }>`
  - `creditPiggy(input: CreditInput): Promise<{ credited: boolean }>`
  - `isPiggyEnabled(childId: string): Promise<boolean>`
  - `getPiggyBalance(childId: string): Promise<number>`
  - `listPiggyEntries(childId: string, limit?: number): Promise<PiggyEntry[]>`
  - `getSpendByCategory(childId: string): Promise<Record<string, number>>`
  - `getPiggyTotals(childId, range?: { from: Date; to: Date }): Promise<{ earnedPence: number; spentPence: number }>` — no range means lifetime
  - `insertManualEntry(input): Promise<PiggyEntry>`
  - `deleteManualEntry(childId: string, entryId: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-db.test.ts`:

```ts
// The ledger. Note what is NOT here: a 23505 guard. Auto-credits insert with
// .onConflictDoNothing().returning() and read rows.length, because
// creditPiggyInTx runs inside claimSeasonTierInTx's transaction and Postgres
// aborts an entire transaction on any error without a savepoint — a caught
// unique violation would poison the enclosing season claim.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: (...a: unknown[]) => mocks.insert(...a),
    select: (...a: unknown[]) => mocks.select(...a),
    transaction: (...a: unknown[]) => mocks.transaction(...a),
  },
}));

import {
  creditPiggy,
  creditPiggyInTx,
  getPiggyBalance,
  getSpendByCategory,
} from '@/lib/db/piggy';

/** An insert chain whose returning() resolves to `rows`. */
function insertChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    values: vi.fn(() => chain),
    onConflictDoNothing: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(rows)),
  });
  return chain;
}

/** A select chain whose terminal await resolves to `rows`. */
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => Promise.resolve(rows)),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
  });
  return chain;
}

beforeEach(() => vi.clearAllMocks());

describe('creditPiggyInTx', () => {
  it('reports credited when the insert produced a row', async () => {
    const tx = { insert: vi.fn(() => insertChain([{ id: 'e1' }])) } as never;
    await expect(
      creditPiggyInTx(tx, {
        childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100,
      }),
    ).resolves.toEqual({ credited: true });
  });

  it('reports NOT credited when the row already existed, without throwing', async () => {
    const tx = { insert: vi.fn(() => insertChain([])) } as never;
    await expect(
      creditPiggyInTx(tx, {
        childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100,
      }),
    ).resolves.toEqual({ credited: false });
  });

  it('uses ON CONFLICT DO NOTHING — never a caught exception', async () => {
    const chain = insertChain([{ id: 'e1' }]);
    const tx = { insert: vi.fn(() => chain) } as never;
    await creditPiggyInTx(tx, {
      childId: 'c1', source: 'final_boss', refId: 'p1', pence: 300,
    });
    expect(chain.onConflictDoNothing).toHaveBeenCalled();
  });
});

describe('creditPiggy', () => {
  it('writes nothing for a child with the piggy bank disabled', async () => {
    mocks.select.mockReturnValue(selectChain([{ enabled: false }]));
    await expect(
      creditPiggy({ childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100 }),
    ).resolves.toEqual({ credited: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('writes nothing for a child that does not exist', async () => {
    mocks.select.mockReturnValue(selectChain([]));
    await expect(
      creditPiggy({ childId: 'ghost', source: 'boss_clear', refId: 'w1', pence: 100 }),
    ).resolves.toEqual({ credited: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('credits when enabled', async () => {
    mocks.select.mockReturnValue(selectChain([{ enabled: true }]));
    mocks.transaction.mockImplementation(
      (fn: (tx: unknown) => unknown) =>
        fn({ insert: () => insertChain([{ id: 'e1' }]) }),
    );
    await expect(
      creditPiggy({ childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100 }),
    ).resolves.toEqual({ credited: true });
  });

  it('refuses a zero-pence credit outright', async () => {
    await expect(
      creditPiggy({ childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 0 }),
    ).resolves.toEqual({ credited: false });
    expect(mocks.select).not.toHaveBeenCalled();
  });
});

describe('getPiggyBalance', () => {
  it('returns the summed delta', async () => {
    mocks.select.mockReturnValue(selectChain([{ total: 1275 }]));
    await expect(getPiggyBalance('c1')).resolves.toBe(1275);
  });

  it('returns 0 for a child with no entries at all', async () => {
    mocks.select.mockReturnValue(selectChain([{ total: null }]));
    await expect(getPiggyBalance('c1')).resolves.toBe(0);
  });
});

describe('getSpendByCategory', () => {
  it('returns positive magnitudes keyed by category', async () => {
    mocks.select.mockReturnValue(
      selectChain([
        { category: 'snacks', total: 450 },
        { category: 'toys', total: 1200 },
      ]),
    );
    await expect(getSpendByCategory('c1')).resolves.toEqual({
      snacks: 450,
      toys: 1200,
    });
  });

  it('omits categories with no spend rather than emitting a zero bar', async () => {
    mocks.select.mockReturnValue(selectChain([{ category: 'toys', total: 300 }]));
    const out = await getSpendByCategory('c1');
    expect(Object.keys(out)).toEqual(['toys']);
    expect(out).not.toHaveProperty('books');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-db.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db/piggy'`.

- [ ] **Step 3: Write the module**

Create `src/lib/db/piggy.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/piggy-db.test.ts`
Expected: PASS, 11 tests.

If the `selectChain` helper's thenable does not satisfy a query, adjust the helper — do **not** weaken an assertion to make it pass.

- [ ] **Step 5: Run the full suite, typecheck, and lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green. The full suite matters — a new `@/lib/db/*` module has broken unrelated suites before.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/piggy.ts tests/unit/piggy-db.test.ts
git commit -m "feat(piggy): ledger reads and writes

Idempotency is ON CONFLICT DO NOTHING, not a caught 23505. creditPiggyInTx
runs inside claimSeasonTierInTx's transaction, and Postgres aborts a whole
transaction on any error without a savepoint — catching the violation would
poison the enclosing season claim and fail every statement after it.

Balance, category totals, and the season window are all derived on read."
```

---

## Task 4: Past-progress backfill and the enable switch

Enabling the flag credits past progress **in the same transaction**. There is no
backfill script: the parent sees the cost before incurring it, it works for every
family rather than one, and re-running is a no-op.

**Files:**
- Create: `src/lib/db/piggy-backfill.ts`
- Test: `tests/unit/piggy-backfill.test.ts`

**Interfaces:**
- Consumes: `creditPiggyInTx`, `PiggySource` (Task 3); `PIGGY_*_PENCE` (Task 1); `listBossWeekIds` from `@/lib/db/weeks`.
- Produces:
  - `interface PendingCredit { source: PiggySource; refId: string; pence: number; occurredAt: Date }`
  - `computePastProgressCredits(childId: string): Promise<PendingCredit[]>`
  - `pendingPastProgressCredits(childId: string): Promise<PendingCredit[]>`
  - `previewPastProgress(childId: string): Promise<{ totalPence: number; bossClears: number; vaults: number; finalBosses: number }>`
  - `enablePiggyBankWithBackfill(childId: string): Promise<{ creditedPence: number; entries: number }>`
  - `disablePiggyBank(childId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-backfill.test.ts`:

```ts
// The backfill reads four subsystems' tables. The load-bearing assertion is
// the bossless-week one: a week below BOSS_MIN_CHARS has no boss and can never
// be beaten, so it must never pay. Reading bossability from week content
// instead of the compiled boss row is what made week 10 unreachable in prod.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  listBossWeekIds: vi.fn(),
  creditPiggyInTx: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...a: unknown[]) => mocks.select(...a),
    update: (...a: unknown[]) => mocks.update(...a),
    transaction: (...a: unknown[]) => mocks.transaction(...a),
  },
}));
vi.mock('@/lib/db/weeks', () => ({ listBossWeekIds: mocks.listBossWeekIds }));
vi.mock('@/lib/db/piggy', () => ({ creditPiggyInTx: mocks.creditPiggyInTx }));

import {
  computePastProgressCredits,
  enablePiggyBankWithBackfill,
} from '@/lib/db/piggy-backfill';

/** Queue one resolved row-set per db.select() call, in order. */
function queueSelects(...rowSets: unknown[][]) {
  for (const rows of rowSets) {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      from: vi.fn(() => chain),
      where: vi.fn(() => Promise.resolve(rows)),
    });
    mocks.select.mockReturnValueOnce(chain);
  }
}

const DAY = new Date('2026-07-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.creditPiggyInTx.mockResolvedValue({ credited: true });
});

describe('computePastProgressCredits', () => {
  it('pays £1 per beaten weekly boss, dated to last_played_at', async () => {
    queueSelects(
      [{ weekId: 'w1', lastPlayedAt: DAY }],  // week_progress
      [],                                      // card_grants_log
      [],                                      // final_boss_clears
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));

    await expect(computePastProgressCredits('c1')).resolves.toEqual([
      { source: 'boss_clear', refId: 'w1', pence: 100, occurredAt: DAY },
    ]);
  });

  it('pays NOTHING for a bossless week, even with boss_cleared set', async () => {
    queueSelects(
      [
        { weekId: 'w1', lastPlayedAt: DAY },
        { weekId: 'short', lastPlayedAt: DAY },
      ],
      [],
      [],
    );
    // 'short' is below BOSS_MIN_CHARS, so compile-week emitted no boss row.
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));

    const out = await computePastProgressCredits('c1');
    expect(out.map((c) => c.refId)).toEqual(['w1']);
  });

  it('pays £1 for a claimed vault and £3 for a final boss, exactly dated', async () => {
    const vaultAt = new Date('2026-07-10T00:00:00Z');
    const finalAt = new Date('2026-07-20T00:00:00Z');
    queueSelects(
      [],
      [{ refId: 'pack-1', at: vaultAt }],
      [{ packId: 'pack-1', at: finalAt }],
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set());

    await expect(computePastProgressCredits('c1')).resolves.toEqual([
      { source: 'key_vault', refId: 'pack-1', pence: 100, occurredAt: vaultAt },
      { source: 'final_boss', refId: 'pack-1', pence: 300, occurredAt: finalAt },
    ]);
  });

  it('never credits an already-claimed season tier', async () => {
    queueSelects([], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set());
    const out = await computePastProgressCredits('c1');
    expect(out.some((c) => c.source === 'season_tier')).toBe(false);
  });
});

describe('enablePiggyBankWithBackfill', () => {
  function stubTx() {
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const tx = { update: vi.fn(() => ({ set })) };
    mocks.transaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    return { tx, set };
  }

  it('sets the flag and credits every pending entry once', async () => {
    queueSelects([{ weekId: 'w1', lastPlayedAt: DAY }], [], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));
    const { set } = stubTx();

    await expect(enablePiggyBankWithBackfill('c1')).resolves.toEqual({
      creditedPence: 100,
      entries: 1,
    });
    expect(set).toHaveBeenCalledWith({ piggyBankEnabled: true });
  });

  it('is exactly-once — a second run credits nothing', async () => {
    queueSelects([{ weekId: 'w1', lastPlayedAt: DAY }], [], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));
    stubTx();
    // The unique index already holds this row, so the insert returns no rows.
    mocks.creditPiggyInTx.mockResolvedValue({ credited: false });

    await expect(enablePiggyBankWithBackfill('c1')).resolves.toEqual({
      creditedPence: 0,
      entries: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-backfill.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db/piggy-backfill'`.

- [ ] **Step 3: Write the module**

Create `src/lib/db/piggy-backfill.ts`:

```ts
// Past-progress backfill. SERVER-ONLY. Split out of piggy.ts because it reads
// four other subsystems' tables and would otherwise make the core ledger
// module hard to hold in context.
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  cardGrantsLog,
  childProfiles,
  finalBossClears,
  piggyEntries,
  weekProgress,
} from '@/db/schema';
import { listBossWeekIds } from '@/lib/db/weeks';
import { creditPiggyInTx, type PiggySource } from '@/lib/db/piggy';
import {
  PIGGY_BOSS_CLEAR_PENCE,
  PIGGY_FINAL_BOSS_PENCE,
  PIGGY_KEY_VAULT_PENCE,
} from '@/lib/piggy/rates';

export interface PendingCredit {
  source: PiggySource;
  refId: string;
  pence: number;
  occurredAt: Date;
}

/**
 * Everything this child's history says she has already earned.
 *
 * Deliberately NOT included: season tiers already claimed. The season £
 * attaches to the act of claiming, those claims happened under a config that
 * paid nothing, and `child_season_progress.tiersClaimed` is an integer[] with
 * no per-tier timestamp to date them by. Claims from here on pay.
 */
export async function computePastProgressCredits(
  childId: string,
): Promise<PendingCredit[]> {
  const out: PendingCredit[] = [];

  // ── Weekly bosses ───────────────────────────────────────────────────────
  // `bossCleared` is necessary but NOT sufficient. compile-week only emits a
  // boss at >= BOSS_MIN_CHARS, so a short week is bossless and can never have
  // been beaten. Ask the compiled `boss:boss:0` row (listBossWeekIds), never
  // the week's character count — both the threshold and a week's content move,
  // and getting this backwards is what made week 10 unreachable in prod.
  const progressRows = await db
    .select({
      weekId: weekProgress.weekId,
      lastPlayedAt: weekProgress.lastPlayedAt,
    })
    .from(weekProgress)
    .where(
      and(
        eq(weekProgress.childId, childId),
        eq(weekProgress.bossCleared, true),
      ),
    );

  const bossWeekIds = await listBossWeekIds(progressRows.map((r) => r.weekId));
  for (const r of progressRows) {
    if (!bossWeekIds.has(r.weekId)) continue;
    out.push({
      source: 'boss_clear',
      refId: r.weekId,
      pence: PIGGY_BOSS_CLEAR_PENCE,
      // week_progress has no boss_cleared_at column. Do not add one to fix
      // this: the clear times were never recorded, so a new column could only
      // hold the same approximation dressed up as precision.
      occurredAt: r.lastPlayedAt ?? new Date(),
    });
  }

  // ── Key vault ───────────────────────────────────────────────────────────
  const vaultRows = await db
    .select({ refId: cardGrantsLog.refId, at: cardGrantsLog.grantedAt })
    .from(cardGrantsLog)
    .where(
      and(
        eq(cardGrantsLog.childId, childId),
        eq(cardGrantsLog.source, 'key_vault'),
      ),
    );
  for (const v of vaultRows) {
    out.push({
      source: 'key_vault',
      refId: v.refId,
      pence: PIGGY_KEY_VAULT_PENCE,
      occurredAt: v.at,
    });
  }

  // ── Final bosses ────────────────────────────────────────────────────────
  const finalRows = await db
    .select({ packId: finalBossClears.packId, at: finalBossClears.clearedAt })
    .from(finalBossClears)
    .where(eq(finalBossClears.childId, childId));
  for (const f of finalRows) {
    out.push({
      source: 'final_boss',
      refId: f.packId,
      pence: PIGGY_FINAL_BOSS_PENCE,
      occurredAt: f.at,
    });
  }

  return out;
}

/** Past-progress credits not already in the ledger (the flag may have been
 *  switched off and on again). */
export async function pendingPastProgressCredits(
  childId: string,
): Promise<PendingCredit[]> {
  const all = await computePastProgressCredits(childId);
  if (all.length === 0) return [];

  const existing = await db
    .select({ source: piggyEntries.source, refId: piggyEntries.refId })
    .from(piggyEntries)
    .where(
      and(
        eq(piggyEntries.childId, childId),
        inArray(
          piggyEntries.source,
          ['boss_clear', 'key_vault', 'final_boss'],
        ),
      ),
    );
  const seen = new Set(existing.map((e) => `${e.source}:${e.refId}`));
  return all.filter((c) => !seen.has(`${c.source}:${c.refId}`));
}

/** What the parent sees BEFORE committing to the cost. */
export async function previewPastProgress(childId: string): Promise<{
  totalPence: number;
  bossClears: number;
  vaults: number;
  finalBosses: number;
}> {
  const pending = await pendingPastProgressCredits(childId);
  return {
    totalPence: pending.reduce((sum, c) => sum + c.pence, 0),
    bossClears: pending.filter((c) => c.source === 'boss_clear').length,
    vaults: pending.filter((c) => c.source === 'key_vault').length,
    finalBosses: pending.filter((c) => c.source === 'final_boss').length,
  };
}

/**
 * Turn the piggy bank on and credit past progress in ONE transaction.
 *
 * `creditPiggyInTx` is used rather than `creditPiggy` on purpose: the flag is
 * being set by this very transaction, so a fresh read of it would race its own
 * write. The caller has established the flag; the in-tx variant trusts it.
 *
 * Exactly-once comes from `piggy_entries_auto_uq`, so a second run credits
 * nothing even if this is called twice concurrently.
 */
export async function enablePiggyBankWithBackfill(
  childId: string,
): Promise<{ creditedPence: number; entries: number }> {
  const pending = await pendingPastProgressCredits(childId);

  return db.transaction(async (tx) => {
    await tx
      .update(childProfiles)
      .set({ piggyBankEnabled: true })
      .where(eq(childProfiles.id, childId));

    let creditedPence = 0;
    let entries = 0;
    for (const c of pending) {
      const res = await creditPiggyInTx(tx, {
        childId,
        source: c.source,
        refId: c.refId,
        pence: c.pence,
        occurredAt: c.occurredAt,
      });
      if (res.credited) {
        creditedPence += c.pence;
        entries += 1;
      }
    }
    return { creditedPence, entries };
  });
}

/** Turn it off. The ledger is KEPT — real money that was earned stays earned,
 *  and switching back on must not double-credit (the unique index sees to it). */
export async function disablePiggyBank(childId: string): Promise<void> {
  await db
    .update(childProfiles)
    .set({ piggyBankEnabled: false })
    .where(eq(childProfiles.id, childId));
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/piggy-backfill.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Full suite, typecheck, lint, commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/db/piggy-backfill.ts tests/unit/piggy-backfill.test.ts
git commit -m "feat(piggy): credit past progress when the flag is switched on

No backfill script — enabling runs inside the same transaction, idempotent via
piggy_entries_auto_uq, with the parent shown the cost first.

Bossability is read from listBossWeekIds (the compiled boss:boss:0 row), never
from a week's character count: a week below BOSS_MIN_CHARS has no boss and must
never pay."
```

---

## Task 5: Parent surface

**Files:**
- Create: `src/lib/actions/piggy.ts`
- Create: `src/components/parent/PiggyBankPanel.tsx`
- Create: `src/app/parent/(secured)/children/[id]/piggy-bank/page.tsx`
- Modify: `src/app/parent/(secured)/children/[id]/page.tsx` (add a link)
- Test: `tests/unit/piggy-actions.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces: `setPiggyEnabledAction`, `addPiggyCreditAction`, `recordPiggyPurchaseAction`, `reconcilePiggyAction`, `deletePiggyEntryAction`.

English-only — this is the parent dashboard, exempt from the bilingual rule.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  insertManualEntry: vi.fn(),
  deleteManualEntry: vi.fn(),
  getPiggyBalance: vi.fn(),
  enablePiggyBankWithBackfill: vi.fn(),
  disablePiggyBank: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/piggy', () => ({
  insertManualEntry: mocks.insertManualEntry,
  deleteManualEntry: mocks.deleteManualEntry,
  getPiggyBalance: mocks.getPiggyBalance,
}));
vi.mock('@/lib/db/piggy-backfill', () => ({
  enablePiggyBankWithBackfill: mocks.enablePiggyBankWithBackfill,
  disablePiggyBank: mocks.disablePiggyBank,
}));

import {
  addPiggyCreditAction,
  deletePiggyEntryAction,
  recordPiggyPurchaseAction,
  reconcilePiggyAction,
  setPiggyEnabledAction,
} from '@/lib/actions/piggy';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' }, parent: { id: 'p1' } });
  mocks.insertManualEntry.mockResolvedValue({ id: 'e1' });
});

describe('auth', () => {
  it('every action gates on requireChild — assertParent only proves "signed in"', async () => {
    mocks.requireChild.mockRejectedValue(new Error('Not found'));
    await expect(
      addPiggyCreditAction({ childId: 'other', pounds: '5', note: 'x' }),
    ).rejects.toThrow();
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('addPiggyCreditAction', () => {
  it('stores a positive delta in pence', async () => {
    await addPiggyCreditAction({ childId: 'c1', pounds: '2.50', note: 'Birthday' });
    expect(mocks.insertManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', source: 'parent_credit', pence: 250 }),
    );
  });

  it('rejects an unparseable or zero amount without writing', async () => {
    await expect(
      addPiggyCreditAction({ childId: 'c1', pounds: 'lots', note: '' }),
    ).resolves.toEqual({ ok: false, error: 'invalid_amount' });
    await expect(
      addPiggyCreditAction({ childId: 'c1', pounds: '0', note: '' }),
    ).resolves.toEqual({ ok: false, error: 'invalid_amount' });
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('recordPiggyPurchaseAction', () => {
  it('stores a NEGATIVE delta with its category', async () => {
    await recordPiggyPurchaseAction({
      childId: 'c1', pounds: '3.00', category: 'toys', note: 'Lego',
    });
    expect(mocks.insertManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'purchase', pence: -300, category: 'toys' }),
    );
  });

  it('rejects an unknown category', async () => {
    await expect(
      recordPiggyPurchaseAction({
        childId: 'c1', pounds: '3.00', category: 'crypto', note: '',
      }),
    ).resolves.toEqual({ ok: false, error: 'invalid_category' });
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('reconcilePiggyAction', () => {
  it('writes the difference between the jar and the ledger', async () => {
    mocks.getPiggyBalance.mockResolvedValue(1000);
    await expect(
      reconcilePiggyAction({ childId: 'c1', actualPounds: '9.40' }),
    ).resolves.toEqual({ ok: true, adjustedPence: -60 });
    expect(mocks.insertManualEntry).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'reconcile', pence: -60 }),
    );
  });

  it('writes NOTHING when the jar already agrees', async () => {
    mocks.getPiggyBalance.mockResolvedValue(1000);
    await expect(
      reconcilePiggyAction({ childId: 'c1', actualPounds: '10.00' }),
    ).resolves.toEqual({ ok: true, adjustedPence: 0 });
    expect(mocks.insertManualEntry).not.toHaveBeenCalled();
  });
});

describe('deletePiggyEntryAction', () => {
  it('reports refusal when the row was auto-earned and thus immutable', async () => {
    mocks.deleteManualEntry.mockResolvedValue(false);
    await expect(
      deletePiggyEntryAction({ childId: 'c1', entryId: 'auto-1' }),
    ).resolves.toEqual({ ok: false, error: 'not_deletable' });
  });
});

describe('setPiggyEnabledAction', () => {
  it('enabling runs the backfill and reports what it credited', async () => {
    mocks.enablePiggyBankWithBackfill.mockResolvedValue({
      creditedPence: 1400, entries: 12,
    });
    await expect(
      setPiggyEnabledAction({ childId: 'c1', enabled: true }),
    ).resolves.toEqual({ ok: true, creditedPence: 1400, entries: 12 });
  });

  it('disabling keeps the ledger — money earned stays earned', async () => {
    await expect(
      setPiggyEnabledAction({ childId: 'c1', enabled: false }),
    ).resolves.toEqual({ ok: true, creditedPence: 0, entries: 0 });
    expect(mocks.disablePiggyBank).toHaveBeenCalledWith('c1');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-actions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/actions/piggy'`.

- [ ] **Step 3: Write the actions**

Create `src/lib/actions/piggy.ts`:

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  deleteManualEntry,
  getPiggyBalance,
  insertManualEntry,
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
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/piggy-actions.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Build the parent panel**

Create `src/components/parent/PiggyBankPanel.tsx`. English-only.

```tsx
'use client';

import { useState, useTransition } from 'react';
import {
  addPiggyCreditAction,
  deletePiggyEntryAction,
  recordPiggyPurchaseAction,
  reconcilePiggyAction,
  setPiggyEnabledAction,
} from '@/lib/actions/piggy';
import { PIGGY_CATEGORIES, getPiggyCategory } from '@/lib/piggy/categories';
import { formatPence } from '@/lib/piggy/money';

export interface PanelEntry {
  id: string;
  deltaPence: number;
  source: string;
  category: string | null;
  note: string | null;
  occurredAt: string; // ISO — Dates do not cross the RSC boundary cleanly
}

interface Props {
  childId: string;
  childName: string;
  enabled: boolean;
  balancePence: number;
  /** Lifetime earned / spent, both positive. */
  totals: { earnedPence: number; spentPence: number };
  entries: PanelEntry[];
  preview: {
    totalPence: number;
    bossClears: number;
    vaults: number;
    finalBosses: number;
  };
}

const DELETABLE = new Set(['parent_credit', 'purchase', 'reconcile']);

export function PiggyBankPanel({
  childId,
  childName,
  enabled,
  balancePence,
  totals,
  entries,
  preview,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      setMessage(res.ok ? okMsg : `Failed: ${res.error ?? 'unknown error'}`);
    });
  }

  if (!enabled) {
    return (
      <section
        data-testid="piggy-disabled"
        className="flex flex-col gap-3 rounded-2xl border border-[var(--color-sand-200)] bg-white/60 p-4"
      >
        <h2 className="text-sm font-bold text-[var(--color-ocean-900)]">
          🐷 Piggy Bank
        </h2>
        <p className="text-xs text-[var(--color-sand-700)]">
          Off. When on, {childName} earns real pocket money for beating bosses:
          £1 per weekly boss, £1 for opening a map&apos;s vault, £3 for a final
          boss, plus up to £3 across a season.
        </p>
        <p className="text-sm font-semibold text-[var(--color-ocean-900)]">
          Turning this on will credit {formatPence(preview.totalPence)} of past
          progress ({preview.bossClears} boss clears · {preview.vaults} vaults ·{' '}
          {preview.finalBosses} final bosses).
        </p>
        <button
          type="button"
          disabled={pending}
          data-testid="piggy-enable"
          onClick={() =>
            startTransition(async () => {
              const res = await setPiggyEnabledAction({ childId, enabled: true });
              setMessage(
                `Enabled — credited ${formatPence(res.creditedPence)} across ${res.entries} entries.`,
              );
            })
          }
          className="self-start rounded-full bg-[var(--color-ocean-700)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Turn on &amp; credit past progress
        </button>
        {message && <p className="text-xs text-[var(--color-sand-700)]">{message}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-sand-200)] bg-white/60 p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-[var(--color-ocean-900)]">
          🐷 Piggy Bank
        </h2>
        <span data-testid="piggy-balance" className="text-2xl font-bold text-[var(--color-ocean-900)]">
          {formatPence(balancePence)}
        </span>
      </header>

      <p data-testid="piggy-totals" className="text-xs text-[var(--color-sand-700)]">
        Earned {formatPence(totals.earnedPence)} lifetime · spent{' '}
        {formatPence(totals.spentPence)}.
      </p>

      <p className="text-xs text-[var(--color-sand-700)]">
        This balance mirrors the real jar. Handing {childName} cash is not a
        transaction — it moves the same money from virtual to physical. Only
        purchases reduce the balance.
      </p>

      <form
        data-testid="piggy-add-form"
        action={(fd) =>
          run(
            () =>
              addPiggyCreditAction({
                childId,
                pounds: String(fd.get('pounds') ?? ''),
                note: String(fd.get('note') ?? ''),
                occurredAt: String(fd.get('date') ?? ''),
              }),
            'Money added.',
          )
        }
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-sand-200)] pt-3"
      >
        <label className="flex flex-col text-xs font-semibold">
          Add money (£)
          <input name="pounds" inputMode="decimal" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Note
          <input name="note" className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Date
          <input name="date" type="date" className="rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          Add
        </button>
      </form>

      <form
        data-testid="piggy-purchase-form"
        action={(fd) =>
          run(
            () =>
              recordPiggyPurchaseAction({
                childId,
                pounds: String(fd.get('pounds') ?? ''),
                category: String(fd.get('category') ?? ''),
                note: String(fd.get('note') ?? ''),
                occurredAt: String(fd.get('date') ?? ''),
              }),
            'Purchase recorded.',
          )
        }
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-sand-200)] pt-3"
      >
        <label className="flex flex-col text-xs font-semibold">
          Spent (£)
          <input name="pounds" inputMode="decimal" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          On
          <select name="category" required className="rounded border px-2 py-1">
            {PIGGY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.en}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Note
          <input name="note" className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Date
          <input name="date" type="date" className="rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          Record
        </button>
      </form>

      <form
        data-testid="piggy-reconcile-form"
        action={(fd) =>
          run(
            () =>
              reconcilePiggyAction({
                childId,
                actualPounds: String(fd.get('actual') ?? ''),
              }),
            'Reconciled.',
          )
        }
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-sand-200)] pt-3"
      >
        <label className="flex flex-col text-xs font-semibold">
          Actually in the jar (£)
          <input name="actual" inputMode="decimal" required className="rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--color-ocean-700)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          Reconcile
        </button>
      </form>

      {message && (
        <p data-testid="piggy-message" className="text-xs text-[var(--color-sand-700)]">
          {message}
        </p>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-sand-700)]">
            <th className="py-1">Date</th>
            <th>What</th>
            <th className="text-right">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody data-testid="piggy-entry-table">
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-[var(--color-sand-200)]">
              <td className="py-1">{e.occurredAt.slice(0, 10)}</td>
              <td>
                {e.category ? `${getPiggyCategory(e.category)?.emoji ?? ''} ` : ''}
                {e.note || e.source.replace(/_/g, ' ')}
              </td>
              <td className={`text-right font-semibold ${e.deltaPence < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatPence(e.deltaPence)}
              </td>
              <td className="text-right">
                {DELETABLE.has(e.source) && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Delete entry from ${e.occurredAt.slice(0, 10)}`}
                    onClick={() =>
                      run(
                        () => deletePiggyEntryAction({ childId, entryId: e.id }),
                        'Entry deleted.',
                      )
                    }
                    className="text-rose-700 hover:underline disabled:opacity-50"
                  >
                    delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        disabled={pending}
        data-testid="piggy-disable"
        onClick={() =>
          run(
            () => setPiggyEnabledAction({ childId, enabled: false }).then(() => ({ ok: true })),
            'Turned off. History kept.',
          )
        }
        className="self-start text-xs text-[var(--color-sand-700)] underline"
      >
        Turn off (history is kept)
      </button>
    </section>
  );
}
```

- [ ] **Step 6: Build the parent page**

Create `src/app/parent/(secured)/children/[id]/piggy-bank/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PiggyBankPanel } from '@/components/parent/PiggyBankPanel';
import { requireChild } from '@/lib/auth/guards';
import { getPiggyBalance, getPiggyTotals, listPiggyEntries } from '@/lib/db/piggy';
import { previewPastProgress } from '@/lib/db/piggy-backfill';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PiggyBankPage({ params }: PageProps) {
  const { id } = await params;

  let child;
  try {
    ({ child } = await requireChild(id));
  } catch {
    notFound();
  }

  const [balancePence, totals, entries, preview] = await Promise.all([
    getPiggyBalance(child.id),
    getPiggyTotals(child.id),
    listPiggyEntries(child.id, 100),
    previewPastProgress(child.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          {child.displayName}&apos;s Piggy Bank
        </h1>
        <Link
          href={`/parent/children/${child.id}`}
          className="text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          ← Back
        </Link>
      </header>

      <PiggyBankPanel
        childId={child.id}
        childName={child.displayName}
        enabled={child.piggyBankEnabled}
        balancePence={balancePence}
        totals={totals}
        entries={entries.map((e) => ({
          id: e.id,
          deltaPence: e.deltaPence,
          source: e.source,
          category: e.category,
          note: e.note,
          occurredAt: e.occurredAt.toISOString(),
        }))}
        preview={preview}
      />
    </main>
  );
}
```

- [ ] **Step 7: Link it from the child page**

In `src/app/parent/(secured)/children/[id]/page.tsx`, after the Homework `<section>`, add:

```tsx
      <section className="flex flex-col gap-2 rounded-2xl border border-[var(--color-sand-200)] bg-white/60 p-4">
        <h2 className="text-sm font-bold text-[var(--color-ocean-900)]">
          🐷 Piggy Bank
        </h2>
        <p className="text-xs text-[var(--color-sand-700)]">
          Real pocket money — balance, purchases, and what the game has paid.
        </p>
        <Link
          href={`/parent/children/${child.id}/piggy-bank`}
          className="self-start text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          Open piggy bank →
        </Link>
      </section>
```

- [ ] **Step 8: Verify and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && npx next build
git add src/lib/actions/piggy.ts src/components/parent/PiggyBankPanel.tsx "src/app/parent/(secured)/children/[id]" tests/unit/piggy-actions.test.ts
git commit -m "feat(piggy): parent bookkeeping surface

Add money, record a purchase with a category, reconcile against the real jar,
delete a mistyped row. Every action gates on requireChild — assertParent only
proves 'is signed in'.

The panel states in words that handing over cash is not a transaction; its
absence would otherwise read as a missing feature."
```

---

## Task 6: Wire the three game payouts

**Files:**
- Modify: `src/lib/actions/play.ts` (`EconomyBonusReason`, `EconomyBonus`, the boss branch, the vault branch)
- Modify: `src/lib/actions/final-boss.ts`
- Modify: `src/components/play/BonusToast.tsx`
- Test: `tests/unit/piggy-play-wiring.test.ts`

**Interfaces:**
- Consumes: `creditPiggy` (Task 3), `PIGGY_*_PENCE` (Task 1).
- Produces: `EconomyBonus.unit?: 'coins' | 'pence'`; `'piggy'` added to `EconomyBonusReason`.

`key_shard` already sets the precedent that `delta` is not always coins. `unit`
makes that explicit instead of implicit.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-play-wiring.test.ts`. The mock block below is
`tests/unit/key-vault-grant.test.ts`'s, plus `@/lib/db/piggy` — copy it verbatim
rather than trimming it: `finishLevelAction` pulls in every one of those modules,
and a missing mock fails only on CI with `DATABASE_URL is not set`.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  getWeekGateState: vi.fn(),
  getWeekProgress: vi.fn(),
  upsertWeekProgress: vi.fn(),
  endPlaySession: vi.fn(),
  awardCoins: vi.fn(),
  claimKeyVaultPrize: vi.fn(),
  isMapFullyCleared: vi.fn(),
  getPackSlugById: vi.fn(),
  creditPiggy: vi.fn(),
  pullCardForChild: vi
    .fn()
    .mockResolvedValue({ granted: false, reason: 'daily_cap_reached' }),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/piggy', () => ({ creditPiggy: mocks.creditPiggy }));
vi.mock('@/lib/db/bounties', () => ({ tickBountyProgress: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db/key-vault', () => ({ claimKeyVaultPrize: mocks.claimKeyVaultPrize }));
vi.mock('@/lib/db/final-boss', () => ({ isMapFullyCleared: mocks.isMapFullyCleared }));
vi.mock('@/lib/db/maps', () => ({ getPackSlugById: mocks.getPackSlugById }));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: mocks.getPlayableWeekForChild,
  getWeekGateState: mocks.getWeekGateState,
  isFrontierWeek: vi.fn().mockResolvedValue(false),
  listCharactersForWeek: vi.fn(),
}));
vi.mock('@/lib/db/play', () => ({
  startPlaySession: vi.fn(),
  endPlaySession: mocks.endPlaySession,
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'a1' }),
  upsertWeekProgress: mocks.upsertWeekProgress,
  listLevelsForWeek: vi.fn().mockResolvedValue([]),
  getWeekProgress: mocks.getWeekProgress,
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
  getLevelById: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
  awardPerfectWeekIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  awardDailyLoginIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  awardStreakMilestoneIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0, milestone: null }),
}));
vi.mock('@/lib/db/streaks', () => ({
  tickStreak: vi.fn().mockResolvedValue({
    currentStreak: 1, longestStreak: 1, ticked: false, reset: false,
  }),
  todayUtcIso: () => '2026-08-31',
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/db/continent-rewards', () => ({ grantContinentRewards: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/db/trophies', () => ({ checkAndGrantTrophies: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/actions/gacha', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/db/xp', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
}));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined) }));

import { finishLevelAction } from '@/lib/actions/play';

const BOSS_RUN = {
  sessionId: '11111111-2222-4333-a444-555555555555',
  childId: '22222222-3333-4444-a555-666666666666',
  weekId: '33333333-4444-4555-a666-777777777777',
  section: 'boss' as const,
  totalScenesPassed: 1,
  totalScenesInWeek: 1,
  durationSeconds: 60,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.getPlayableWeekForChild.mockResolvedValue({
    id: 'w1', childId: null, curriculumPackId: 'pack-1',
  });
  mocks.getWeekProgress.mockResolvedValue(null); // first clear
  mocks.getWeekGateState.mockResolvedValue({
    isFrontier: false, isUnlocked: true, keysEarned: 4, keysTotal: 10,
  });
  mocks.isMapFullyCleared.mockResolvedValue(false);
  mocks.getPackSlugById.mockResolvedValue('pirate-class-level-1');
  mocks.claimKeyVaultPrize.mockResolvedValue({ card: null, coins: 0 });
  mocks.creditPiggy.mockResolvedValue({ credited: true });
});

describe('finishLevelAction — 存钱罐 payouts', () => {
  it('pays £1 on a FIRST weekly boss clear', async () => {
    await finishLevelAction(BOSS_RUN);
    expect(mocks.creditPiggy).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: 'c1',
        source: 'boss_clear',
        refId: BOSS_RUN.weekId,
        pence: 100,
      }),
    );
  });

  it('pays NOTHING on a REPEAT clear — bosses replay and a loss pays boss_courage', async () => {
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true });
    await finishLevelAction(BOSS_RUN);
    expect(mocks.creditPiggy).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: 'boss_clear' }),
    );
  });

  it('pays nothing at all for a review section run', async () => {
    await finishLevelAction({ ...BOSS_RUN, section: 'review' as const });
    expect(mocks.creditPiggy).not.toHaveBeenCalled();
  });

  it('pays £1 when the map vault opens', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(true);
    await finishLevelAction(BOSS_RUN);
    expect(mocks.creditPiggy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'key_vault', refId: 'pack-1', pence: 100,
      }),
    );
  });

  it('surfaces the award as a PENCE bonus, not a coin one', async () => {
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.bonuses.find((b) => b.reason === 'piggy')).toMatchObject({
      unit: 'pence',
      delta: 100,
    });
  });

  it('emits no bonus when the credit was a duplicate', async () => {
    mocks.creditPiggy.mockResolvedValue({ credited: false });
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.bonuses.find((b) => b.reason === 'piggy')).toBeUndefined();
  });

  it('still clears the boss when the piggy credit THROWS', async () => {
    mocks.creditPiggy.mockRejectedValue(new Error('db down'));
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.ok).toBe(true);
    expect(res.bossCleared).toBe(true);
    expect(res.bonuses.find((b) => b.reason === 'piggy')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-play-wiring.test.ts`
Expected: FAIL — `creditPiggy` never called.

- [ ] **Step 3: Extend the bonus type**

In `src/lib/actions/play.ts`, extend the union and interface:

```ts
export type EconomyBonusReason =
  | 'daily_login'
  | 'streak_milestone'
  | 'perfect_week'
  | 'streak_freeze'
  | 'boss_courage'
  // T3: 'key_shard' is NOT a coin award — its `delta` is 1 key, shown as a
  // toast so the kid sees the island-unlock currency tick up.
  | 'key_shard'
  | 'key_vault'
  // 存钱罐: `delta` is PENCE of real pocket money. See `unit`.
  | 'piggy';

export interface EconomyBonus {
  reason: EconomyBonusReason;
  delta: number;
  labelZh: string;
  labelEn: string;
  /** What `delta` counts. Absent means coins — 'key_shard' was already an
   *  unmarked exception; 'piggy' makes the distinction explicit. */
  unit?: 'coins' | 'pence';
  meta?: { milestone?: number };
}
```

- [ ] **Step 4: Add the guarded helper**

In `src/lib/actions/play.ts`, next to `safeClaimKeyVault`:

```ts
import { creditPiggy } from '@/lib/db/piggy';
import { PIGGY_BOSS_CLEAR_PENCE, PIGGY_KEY_VAULT_PENCE } from '@/lib/piggy/rates';

/** Guarded 存钱罐 credit. Real money rides on a boss clear as a bonus; a
 *  failure must never fail the clear. Same rule as `safeClaimKeyVault`:
 *  SceneRunner awaits these actions inside startTransition with no catch, so
 *  an unguarded throw freezes the child's screen mid-question. */
async function safeCreditPiggy(
  childId: string,
  source: 'boss_clear' | 'key_vault',
  refId: string,
  pence: number,
): Promise<boolean> {
  try {
    const res = await creditPiggy({ childId, source, refId, pence });
    return res.credited;
  } catch (err) {
    console.error(`[finishLevelAction] piggy ${source} credit failed:`, err);
    return false;
  }
}

/** One bonus shape for both piggy payouts. */
function piggyBonus(pence: number): EconomyBonus {
  return {
    reason: 'piggy',
    delta: pence,
    unit: 'pence',
    labelZh: '存钱罐',
    labelEn: 'Piggy bank',
  };
}
```

- [ ] **Step 5: Credit on a first boss clear**

In `finishLevelAction`, inside `if (bossCleared && !alreadyAwarded) { ... }`,
immediately after the `awardCoins({ ... reason: 'boss_clear' ... })` call:

```ts
    // 存钱罐: real money, FIRST clear only. Bosses are replayable (refId is the
    // sessionId) and a LOSS pays boss_courage, so a repeatable £ would let her
    // farm real money indefinitely.
    if (
      await safeCreditPiggy(
        child.id,
        'boss_clear',
        parsed.weekId,
        PIGGY_BOSS_CLEAR_PENCE,
      )
    ) {
      bonuses.push(piggyBonus(PIGGY_BOSS_CLEAR_PENCE));
    }
```

- [ ] **Step 6: Credit when the vault opens**

In the key-vault branch, inside `if (packSlug) { ... }`, after the
`if (prize.coins > 0) { bonuses.push(...) }` block:

```ts
      // The vault is idempotent per (child, map), so this can only pay once.
      if (
        await safeCreditPiggy(
          child.id,
          'key_vault',
          week.curriculumPackId,
          PIGGY_KEY_VAULT_PENCE,
        )
      ) {
        bonuses.push(piggyBonus(PIGGY_KEY_VAULT_PENCE));
      }
```

- [ ] **Step 7: Credit on a final-boss first clear**

In `src/lib/actions/final-boss.ts`, after `grantMapChampionRewards(...)`:

```ts
import { creditPiggy } from '@/lib/db/piggy';
import { PIGGY_FINAL_BOSS_PENCE } from '@/lib/piggy/rates';

  // 存钱罐 £3. Guarded — the champion bundle must land even if this fails.
  // Reached only on firstClear, and recordFinalBossClear is the single guard.
  try {
    await creditPiggy({
      childId: child.id,
      source: 'final_boss',
      refId: pack.id,
      pence: PIGGY_FINAL_BOSS_PENCE,
    });
  } catch (err) {
    console.error('[finishFinalBossAction] piggy credit failed:', err);
  }
```

- [ ] **Step 8: Render pence in the toast**

In `src/components/play/BonusToast.tsx`, add the icon and branch the amount:

```tsx
import { formatPence } from '@/lib/piggy/money';

const REASON_ICON: Record<EconomyBonus['reason'], string> = {
  daily_login: '🌞',
  streak_milestone: '🔥',
  perfect_week: '🏆',
  streak_freeze: '🧊',
  boss_courage: '🛡️',
  key_shard: '🗝️',
  key_vault: '💎',
  piggy: '💷',
};
```

and replace the amount span with:

```tsx
            <span className="font-hanzi text-stone-900">
              {b.labelZh}{' '}
              <span className="font-bold text-amber-700">
                {b.unit === 'pence' ? `+${formatPence(b.delta)}` : `+${b.delta}`}
              </span>
            </span>
```

- [ ] **Step 9: Run the full suite**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: green. If suites that import `finishLevelAction` now fail with
`DATABASE_URL is not set`, they need `vi.mock('@/lib/db/piggy', ...)` added —
this is the mock-`@/db` landmine, and it bit six suites the last time a new
`@/lib/db/*` import reached these actions. Add the mock; do not remove the import.

- [ ] **Step 10: Commit**

```bash
git add src/lib/actions/play.ts src/lib/actions/final-boss.ts src/components/play/BonusToast.tsx tests/unit/piggy-play-wiring.test.ts
git commit -m "feat(piggy): pay £ on boss clears, the vault, and the final boss

FIRST clear only — bosses are replayable and losing pays boss_courage, so a
repeatable £ would let her farm real money.

All three credits are guarded: SceneRunner awaits these actions inside
startTransition with no catch, so an unguarded throw freezes the child's screen
mid-question.

EconomyBonus gains `unit` so pence and coins share the existing toast pipeline
rather than growing a parallel surface."
```

---

## Task 7: Season tiers pay £

**Files:**
- Modify: `src/lib/season/types.ts`
- Modify: `src/lib/season/summerVoyage.ts`
- Modify: `src/lib/db/season.ts` (`claimSeasonTierInTx`)
- Create: `scripts/sync-season-tier-config.ts`
- Test: `tests/unit/piggy-season.test.ts`

**Interfaces:**
- Consumes: `creditPiggyInTx` (Task 3).
- Produces: `SeasonTier.bonusMoneyPence?: number`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-season.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

const mocks = vi.hoisted(() => ({ creditPiggyInTx: vi.fn() }));
// db/season.ts and coins.ts import @/db at module load; claimSeasonTierInTx
// receives its tx directly, so the client itself is never touched.
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/db/piggy', () => ({ creditPiggyInTx: mocks.creditPiggyInTx }));

import { claimSeasonTierInTx } from '@/lib/db/season';

describe('summer voyage money tiers', () => {
  it('pays 50p / £1 / £1.50 at tiers 10, 20, 30 — £3 across the season', () => {
    const byTier = new Map(SUMMER_VOYAGE_TIERS.map((t) => [t.tier, t]));
    expect(byTier.get(10)?.bonusMoneyPence).toBe(50);
    expect(byTier.get(20)?.bonusMoneyPence).toBe(100);
    expect(byTier.get(30)?.bonusMoneyPence).toBe(150);

    const total = SUMMER_VOYAGE_TIERS.reduce(
      (s, t) => s + (t.bonusMoneyPence ?? 0),
      0,
    );
    expect(total).toBe(300);
  });

  it('keeps every tier its ORIGINAL reward — money is a bonus, not a swap', () => {
    const byTier = new Map(SUMMER_VOYAGE_TIERS.map((t) => [t.tier, t]));
    expect(byTier.get(10)?.reward).toEqual({
      type: 'card',
      cardSlug: 'season-tortoise',
    });
    expect(byTier.get(20)?.reward).toEqual({
      type: 'card',
      cardSlug: 'season-dolphin',
    });
  });

  it('leaves the other 27 tiers with no money', () => {
    const paying = SUMMER_VOYAGE_TIERS.filter((t) => t.bonusMoneyPence);
    expect(paying.map((t) => t.tier)).toEqual([10, 20, 30]);
  });
});

describe('claimSeasonTierInTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.creditPiggyInTx.mockResolvedValue({ credited: true });
  });

  /** The fake Drizzle tx from tests/unit/season-claim.test.ts. `selectResults`
   *  is a FIFO queue feeding each select(). */
  function makeTx(selectResults: unknown[][]) {
    const queue = [...selectResults];
    const tx = {
      insert: () => ({
        values: () =>
          Object.assign(Promise.resolve(), {
            onConflictDoNothing: () => Promise.resolve(),
            onConflictDoUpdate: () => Promise.resolve(),
          }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      select: () => {
        const result = queue.shift() ?? [];
        const node: Record<string, unknown> = {};
        node.from = () => node;
        node.innerJoin = () => node;
        node.where = () => node;
        node.limit = () => Promise.resolve(result);
        node.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
          Promise.resolve(result).then(res, rej);
        return node;
      },
    };
    return tx as never;
  }

  const moneyTier = {
    tier: 30,
    xpRequired: 9000,
    reward: { type: 'coins', amount: 100 } as const,
    bonusMoneyPence: 150,
  };
  const plainTier = {
    tier: 29,
    xpRequired: 8500,
    reward: { type: 'coins', amount: 100 } as const,
  };

  it('credits inside the SAME tx, so a rollback takes the money with it', async () => {
    const tx = makeTx([[]]); // claim-state read: nothing claimed yet
    await claimSeasonTierInTx(tx, 'c1', 's1', moneyTier);
    expect(mocks.creditPiggyInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        childId: 'c1',
        source: 'season_tier',
        refId: 's1:30',
        pence: 150,
      }),
    );
  });

  it('credits nothing for a tier with no money on it', async () => {
    await claimSeasonTierInTx(makeTx([[]]), 'c1', 's1', plainTier);
    expect(mocks.creditPiggyInTx).not.toHaveBeenCalled();
  });

  it('credits nothing when the tier was already claimed', async () => {
    const tx = makeTx([[{ tiersClaimed: [30] }]]);
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', moneyTier);
    expect(res).toEqual({ claimed: false, reveal: null });
    expect(mocks.creditPiggyInTx).not.toHaveBeenCalled();
  });
});
```

Complete the three `claimSeasonTierInTx` cases against the tx-stub shapes
already used by the existing season suite. Do not invent new mock shapes.

- [ ] **Step 2: Run and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-season.test.ts`
Expected: FAIL — `bonusMoneyPence` is undefined on every tier.

- [ ] **Step 3: Extend the tier type**

In `src/lib/season/types.ts`:

```ts
export interface SeasonTier {
  /** 1..30 */
  tier: number;
  /** Cumulative season XP required to reach this tier. */
  xpRequired: number;
  reward: SeasonReward;
  /**
   * 存钱罐: real pocket money paid ON TOP of `reward`, in pence.
   *
   * Deliberately not a `{ type: 'money' }` variant of SeasonReward — that union
   * is one-reward-per-tier, so a money variant would REPLACE this tier's card
   * or cosmetic instead of adding to it.
   */
  bonusMoneyPence?: number;
}
```

- [ ] **Step 4: Put money on three tiers**

In `src/lib/season/summerVoyage.ts`, add `bonusMoneyPence` to tiers 10, 20 and 30,
leaving each `reward` untouched:

```ts
  { tier: 10, xpRequired: 950, reward: { type: 'card', cardSlug: 'season-tortoise' }, bonusMoneyPence: 50 },
  // ...
  { tier: 20, xpRequired: 2800, reward: { type: 'card', cardSlug: 'season-dolphin' }, bonusMoneyPence: 100 },
  // ...
  {
    tier: 30,
    // ...existing fields unchanged...
    bonusMoneyPence: 150,
  },
```

£3 across a whole season, against £14 for a map. Season XP accrues from time in
the app; boss clears cost effort. Paying them comparably would teach the wrong
lesson.

- [ ] **Step 5: Credit inside the claim transaction**

In `src/lib/db/season.ts`, inside `claimSeasonTierInTx`, after
`const reveal = await grantRewardInTx(...)` and before the `tiers_claimed` update:

```ts
  // 存钱罐 bonus, INSIDE the tx: if the claim rolls back, the money must roll
  // back with it. creditPiggyInTx uses ON CONFLICT DO NOTHING rather than a
  // caught 23505 precisely so it cannot poison this transaction.
  if (tier.bonusMoneyPence) {
    await creditPiggyInTx(tx, {
      childId,
      source: 'season_tier',
      refId: `${seasonId}:${tier.tier}`,
      pence: tier.bonusMoneyPence,
    });
  }
```

with `import { creditPiggyInTx } from '@/lib/db/piggy';` at the top.

Placing it in the shared `…InTx` helper means `claimSeasonTierAction` and
`claimAllSeasonTiersAction` both get it with no second implementation.

- [ ] **Step 6: Write the sync script**

Create `scripts/sync-season-tier-config.ts`:

```ts
/**
 * Push the TS tier config into a LIVE season row.
 *
 * Why this exists: `seed-season-summer.ts` ends in `onConflictDoNothing()` — on
 * purpose, so a re-run cannot silently re-window a running season. The
 * consequence is that editing `summerVoyage.ts` and re-running the seed does
 * NOT update an existing row's `tier_config`. Without this script the season
 * £ would sit in TypeScript and never reach the row `getActiveSeason` reads.
 *
 * Updates `tier_config` ONLY — never starts_at, ends_at, or is_active.
 *
 * Usage: pnpm tsx scripts/sync-season-tier-config.ts
 */
import { loadEnv } from './_env';

loadEnv();

async function main() {
  const { db } = await import('@/db');
  const { seasons } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const { SUMMER_VOYAGE_TIERS, SUMMER_VOYAGE_SEASON_ID } = await import(
    '@/lib/season/summerVoyage'
  );

  const updated = await db
    .update(seasons)
    .set({ tierConfig: SUMMER_VOYAGE_TIERS })
    .where(eq(seasons.id, SUMMER_VOYAGE_SEASON_ID))
    .returning({ id: seasons.id });

  if (updated.length === 0) {
    console.error(
      `No season row with id '${SUMMER_VOYAGE_SEASON_ID}' — run seed-season-summer.ts first.`,
    );
    process.exit(1);
  }

  const money = SUMMER_VOYAGE_TIERS.filter((t) => t.bonusMoneyPence);
  console.log(
    `Synced ${SUMMER_VOYAGE_TIERS.length} tiers; ${money.length} pay money ` +
      `(${money.reduce((s, t) => s + (t.bonusMoneyPence ?? 0), 0)}p total).`,
  );
}

main();
```

Match the env-loading and dynamic-import shape of `scripts/seed-season-summer.ts`
exactly — env must load **before** the db client is imported, and the season id
constant must come from wherever that seed script already reads it. If
`SUMMER_VOYAGE_SEASON_ID` is not exported today, export it rather than
hard-coding the slug in two places.

- [ ] **Step 7: Run, verify, commit**

```bash
pnpm vitest run tests/unit/piggy-season.test.ts
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/season src/lib/db/season.ts scripts/sync-season-tier-config.ts tests/unit/piggy-season.test.ts
git commit -m "feat(piggy): season tiers 10/20/30 pay 50p/£1/£1.50

bonusMoneyPence rides ALONGSIDE each tier's existing reward rather than being a
SeasonReward variant, which would have replaced their cards.

The credit goes inside claimSeasonTierInTx's transaction so a failed claim takes
the money with it.

sync-season-tier-config.ts exists because seed-season-summer.ts ends in
onConflictDoNothing() — editing the TS config and re-running the seed would NOT
have updated the live season, and the money would never have reached prod."
```

---

## Task 8: The child's page

**Files:**
- Create: `src/components/piggy/PiggyJar.tsx`
- Create: `src/components/piggy/PiggyBreakdown.tsx`
- Create: `src/components/piggy/PiggyHistory.tsx`
- Create: `src/app/play/[childId]/piggy-bank/page.tsx`
- Test: `tests/unit/piggy-kid-ui.test.tsx`

**Interfaces:**
- Consumes: `formatPence`, `PIGGY_CATEGORIES`, `getPiggyCategory` (Task 1); `getPiggyBalance`, `listPiggyEntries`, `getSpendByCategory`, `getPiggyTotals` (Task 3).
- Produces: `PiggyJar`, `PiggyBreakdown`, `PiggyHistory` — all client components taking plain serialisable props.

**Before writing `PiggyBreakdown`, load the `dataviz` skill.** It is a chart, and
the skill's colour and mark rules apply even to something this small.

Bilingual on every label. Zero balance renders 攒钱中… / Saving up — never
"£0 earned", never a streak, never a since-last-earned counter.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-kid-ui.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PiggyJar } from '@/components/piggy/PiggyJar';
import { PiggyBreakdown } from '@/components/piggy/PiggyBreakdown';
import { PiggyHistory } from '@/components/piggy/PiggyHistory';

describe('PiggyJar', () => {
  it('shows the balance in £ with bilingual chrome', () => {
    render(<PiggyJar balancePence={1450} />);
    expect(screen.getByTestId('piggy-balance')).toHaveTextContent('£14.50');
    expect(screen.getByText(/存钱罐/)).toBeInTheDocument();
    expect(screen.getByText(/Piggy Bank/i)).toBeInTheDocument();
  });

  it('renders £0 as "saving up", never as a failure or a zero-earned message', () => {
    render(<PiggyJar balancePence={0} />);
    expect(screen.getByTestId('piggy-balance')).toHaveTextContent('£0.00');
    expect(screen.getByText(/攒钱中/)).toBeInTheDocument();
    expect(screen.getByText(/Saving up/i)).toBeInTheDocument();
    expect(screen.queryByText(/earned nothing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/没有/)).not.toBeInTheDocument();
  });
});

describe('PiggyBreakdown', () => {
  it('draws one labelled bar per category that has spend', () => {
    render(<PiggyBreakdown spendByCategory={{ snacks: 450, toys: 1200 }} />);
    const bars = screen.getAllByTestId(/^piggy-bar-/);
    expect(bars).toHaveLength(2);
    expect(screen.getByTestId('piggy-bar-toys')).toHaveTextContent('£12.00');
    expect(screen.getByTestId('piggy-bar-snacks')).toHaveTextContent('£4.50');
  });

  it('orders bars largest first so the biggest is instantly readable', () => {
    render(<PiggyBreakdown spendByCategory={{ snacks: 450, toys: 1200 }} />);
    const ids = screen.getAllByTestId(/^piggy-bar-/).map((el) => el.dataset.testid);
    expect(ids).toEqual(['piggy-bar-toys', 'piggy-bar-snacks']);
  });

  it('renders nothing at all when she has not spent anything yet', () => {
    const { container } = render(<PiggyBreakdown spendByCategory={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PiggyHistory', () => {
  const entries = [
    {
      id: 'e1', deltaPence: 100, source: 'boss_clear',
      category: null, note: null, occurredAt: '2026-08-30T10:00:00.000Z',
    },
    {
      id: 'e2', deltaPence: -450, source: 'purchase',
      category: 'snacks', note: 'Ice cream', occurredAt: '2026-08-29T10:00:00.000Z',
    },
  ];

  it('shows credits and debits with their signs', () => {
    render(<PiggyHistory entries={entries} />);
    expect(screen.getByTestId('piggy-entry-e1')).toHaveTextContent('£1.00');
    expect(screen.getByTestId('piggy-entry-e2')).toHaveTextContent('-£4.50');
  });

  it('labels an earned entry bilingually and a purchase by its category emoji', () => {
    render(<PiggyHistory entries={entries} />);
    expect(screen.getByTestId('piggy-entry-e1')).toHaveTextContent('打败Boss');
    expect(screen.getByTestId('piggy-entry-e1')).toHaveTextContent('Boss defeated');
    expect(screen.getByTestId('piggy-entry-e2')).toHaveTextContent('🍬');
  });

  it('shows a bilingual empty state rather than an empty list', () => {
    render(<PiggyHistory entries={[]} />);
    expect(screen.getByText(/还没有记录/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-kid-ui.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `PiggyJar`**

Create `src/components/piggy/PiggyJar.tsx`:

```tsx
'use client';

import { formatPence } from '@/lib/piggy/money';

interface Props {
  balancePence: number;
  /** Compact variant for the home-page card. */
  compact?: boolean;
}

/**
 * Procedural SVG, deliberately not generated art: the Blob free tier is 2,000
 * advanced operations a month, and a jar that re-renders at several fill levels
 * is exactly the wrong thing to spend them on.
 *
 * £0 says 攒钱中 / Saving up. It NEVER says "earned nothing" — this product
 * pays boss_courage on a FAILED boss and keeps question progress on retry
 * precisely because the child was avoiding hard fights, and a scolding empty
 * state would undo that.
 */
export function PiggyJar({ balancePence, compact = false }: Props) {
  const empty = balancePence <= 0;
  // Fill rises with the balance but saturates — a full jar at £20 keeps the
  // art readable without implying a target she is failing to hit.
  const fill = Math.min(1, Math.max(0, balancePence / 2000));

  return (
    <div
      data-testid="piggy-jar"
      className={`flex items-center gap-3 ${compact ? '' : 'flex-col text-center'}`}
    >
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="存钱罐 / Piggy bank"
        className={compact ? 'h-12 w-12' : 'h-24 w-24'}
      >
        <defs>
          <clipPath id="piggy-jar-clip">
            <path d="M14 26 h36 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-36 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z" />
          </clipPath>
        </defs>
        <path
          d="M14 26 h36 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-36 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z"
          fill="#fde8ef"
          stroke="#e59ab4"
          strokeWidth="2"
        />
        <g clipPath="url(#piggy-jar-clip)">
          <rect
            x="10"
            y={54 - 28 * fill}
            width="44"
            height={28 * fill}
            fill="#f7c948"
          />
        </g>
        <rect x="26" y="20" width="12" height="4" rx="2" fill="#e59ab4" />
        <circle cx="22" cy="38" r="2" fill="#8a5a70" />
      </svg>

      <div className={compact ? '' : 'flex flex-col items-center'}>
        <p className="text-[11px] font-semibold text-stone-600">
          <span className="font-hanzi">存钱罐</span>{' '}
          <span className="italic">/ Piggy Bank</span>
        </p>
        <p
          data-testid="piggy-balance"
          className={`font-bold text-stone-900 ${compact ? 'text-xl' : 'text-4xl'}`}
        >
          {formatPence(balancePence)}
        </p>
        {empty && (
          <p className="text-[11px] text-stone-600">
            <span className="font-hanzi">攒钱中…</span>{' '}
            <span className="italic">/ Saving up</span>
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `PiggyBreakdown`**

Create `src/components/piggy/PiggyBreakdown.tsx`:

```tsx
'use client';

import { getPiggyCategory } from '@/lib/piggy/categories';
import { formatPence } from '@/lib/piggy/money';

interface Props {
  /** Positive pence per category slug. Categories with no spend are absent. */
  spendByCategory: Record<string, number>;
}

/**
 * Horizontal bars, largest first — NOT a pie. A six-year-old reads "🍬 is the
 * longest bar" instantly and cannot read a pie's angles.
 *
 * Renders nothing when she has spent nothing: a row of zero-length stubs would
 * be noise, and an "you have spent nothing" message is the kind of scolding
 * empty state this feature avoids everywhere else.
 */
export function PiggyBreakdown({ spendByCategory }: Props) {
  const rows = Object.entries(spendByCategory)
    .filter(([, pence]) => pence > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  const max = rows[0][1];

  return (
    <section
      data-testid="piggy-breakdown"
      className="flex flex-col gap-2 rounded-2xl bg-white/70 p-3"
    >
      <h2 className="text-xs font-bold text-stone-700">
        <span className="font-hanzi">花在哪儿</span>{' '}
        <span className="font-normal italic text-stone-500">
          / Where it went
        </span>
      </h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([slug, pence]) => {
          const cat = getPiggyCategory(slug);
          return (
            <li
              key={slug}
              data-testid={`piggy-bar-${slug}`}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-5 text-base" aria-hidden="true">
                {cat?.emoji ?? '✨'}
              </span>
              <span className="w-20 shrink-0">
                <span className="font-hanzi">{cat?.zh ?? slug}</span>
                <span className="block text-[10px] italic text-stone-500">
                  {cat?.en ?? slug}
                </span>
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-stone-200">
                <span
                  className="block h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.round((pence / max) * 100)}%` }}
                />
              </span>
              <span className="w-16 text-right font-semibold text-stone-800">
                {formatPence(pence)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Write `PiggyHistory`**

Create `src/components/piggy/PiggyHistory.tsx`:

```tsx
'use client';

import { getPiggyCategory } from '@/lib/piggy/categories';
import { formatPence } from '@/lib/piggy/money';

export interface HistoryEntry {
  id: string;
  deltaPence: number;
  source: string;
  category: string | null;
  note: string | null;
  /** ISO string — Dates do not cross the RSC boundary cleanly. */
  occurredAt: string;
}

interface Props {
  entries: HistoryEntry[];
}

const SOURCE_LABEL: Record<string, { emoji: string; zh: string; en: string }> = {
  boss_clear: { emoji: '⚔️', zh: '打败Boss', en: 'Boss defeated' },
  key_vault: { emoji: '💎', zh: '开启宝库', en: 'Vault opened' },
  final_boss: { emoji: '👑', zh: '打败霸主', en: 'Overlord defeated' },
  season_tier: { emoji: '🎗️', zh: '季票奖励', en: 'Season reward' },
  parent_credit: { emoji: '💷', zh: '存入', en: 'Added' },
  purchase: { emoji: '🛍️', zh: '花掉', en: 'Spent' },
  reconcile: { emoji: '⚖️', zh: '对账', en: 'Counted the jar' },
};

export function PiggyHistory({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p
        data-testid="piggy-history-empty"
        className="rounded-2xl bg-white/70 p-4 text-center text-xs text-stone-600"
      >
        <span className="font-hanzi">还没有记录</span>{' '}
        <span className="italic">/ Nothing yet</span>
      </p>
    );
  }

  return (
    <ul data-testid="piggy-history" className="flex flex-col gap-1.5">
      {entries.map((e) => {
        const cat = e.category ? getPiggyCategory(e.category) : null;
        const label = SOURCE_LABEL[e.source] ?? {
          emoji: '✨',
          zh: '记录',
          en: 'Entry',
        };
        const credit = e.deltaPence >= 0;
        return (
          <li
            key={e.id}
            data-testid={`piggy-entry-${e.id}`}
            className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs"
          >
            <span className="text-base" aria-hidden="true">
              {cat?.emoji ?? label.emoji}
            </span>
            <span className="flex-1 leading-tight">
              <span className="font-hanzi text-stone-900">
                {e.note || (cat ? cat.zh : label.zh)}
              </span>
              <span className="block text-[10px] italic text-stone-500">
                {cat ? cat.en : label.en}
              </span>
            </span>
            <span className="text-[10px] text-stone-500">
              {e.occurredAt.slice(0, 10)}
            </span>
            <span
              className={`w-16 text-right font-bold ${
                credit ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatPence(e.deltaPence)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 6: Write the page**

Create `src/app/play/[childId]/piggy-bank/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { PiggyJar } from '@/components/piggy/PiggyJar';
import { PiggyBreakdown } from '@/components/piggy/PiggyBreakdown';
import { PiggyHistory } from '@/components/piggy/PiggyHistory';
import {
  getPiggyBalance,
  getPiggyTotals,
  getSpendByCategory,
  isPiggyEnabled,
  listPiggyEntries,
} from '@/lib/db/piggy';
import { getActiveSeason } from '@/lib/db/season';
import { formatPence } from '@/lib/piggy/money';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function PiggyBankPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  // Disabled is not an error state — the child simply has no piggy bank.
  if (!(await isPiggyEnabled(child.id))) redirect(`/play/${child.id}`);

  const [balancePence, entries, spendByCategory, season] = await Promise.all([
    getPiggyBalance(child.id),
    listPiggyEntries(child.id, 50),
    getSpendByCategory(child.id),
    getActiveSeason(),
  ]);

  const seasonSummary = season
    ? await getPiggyTotals(child.id, { from: season.startsAt, to: season.endsAt })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <PiggyJar balancePence={balancePence} />

      {seasonSummary && (
        <section
          data-testid="piggy-season-panel"
          className="rounded-2xl bg-white/70 p-3 text-xs"
        >
          <h2 className="font-bold text-stone-700">
            <span className="font-hanzi">本季</span>{' '}
            <span className="font-normal italic text-stone-500">
              / This season
            </span>
          </h2>
          <p className="mt-1 text-stone-800">
            <span className="font-hanzi">赚了</span>{' '}
            <span className="font-bold text-emerald-700">
              {formatPence(seasonSummary.earnedPence)}
            </span>
            {' · '}
            <span className="font-hanzi">花了</span>{' '}
            <span className="font-bold text-rose-700">
              {formatPence(seasonSummary.spentPence)}
            </span>
          </p>
          <p className="text-[10px] italic text-stone-500">
            Earned {formatPence(seasonSummary.earnedPence)} · spent{' '}
            {formatPence(seasonSummary.spentPence)}
          </p>
        </section>
      )}

      <PiggyBreakdown spendByCategory={spendByCategory} />

      <PiggyHistory
        entries={entries.map((e) => ({
          id: e.id,
          deltaPence: e.deltaPence,
          source: e.source,
          category: e.category,
          note: e.note,
          occurredAt: e.occurredAt.toISOString(),
        }))}
      />
    </main>
  );
}
```

If `getActiveSeason` is not the exported name in `src/lib/db/season.ts`, use the
one that is — read the file rather than guessing.

- [ ] **Step 7: Verify and commit**

```bash
pnpm vitest run tests/unit/piggy-kid-ui.test.tsx
pnpm test && pnpm typecheck && pnpm lint && npx next build
git add src/components/piggy "src/app/play/[childId]/piggy-bank" tests/unit/piggy-kid-ui.test.tsx
git commit -m "feat(piggy): the child's balance, breakdown, and history

Bars not a pie — a six-year-old reads 'the 🍬 bar is longest' instantly and
cannot read a pie's angles.

£0 renders 攒钱中… / Saving up. Never 'earned nothing', never a streak: this
product pays boss_courage on a FAILED boss for a reason, and a scolding empty
state would undo it."
```

---

## Task 9: Home card, the pre-fight line, and the isolation guard

**Files:**
- Create: `src/components/play/PiggyBankCard.tsx`
- Modify: `src/app/play/[childId]/page.tsx`
- Modify: `src/components/play/WeekHub.tsx`
- Modify: `tests/unit/distribution-isolation-guard.test.ts`
- Test: `tests/unit/piggy-entry-points.test.tsx`

**Interfaces:**
- Consumes: `PiggyJar` (Task 8), `isPiggyEnabled` / `getPiggyBalance` (Task 3), `PIGGY_BOSS_CLEAR_PENCE` (Task 1).
- Produces: `WeekHub` gains `piggyPence?: number`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/piggy-entry-points.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PiggyBankCard } from '@/components/play/PiggyBankCard';
import { WeekHub } from '@/components/play/WeekHub';

const sections = {
  review: { done: 0, total: 10 },
  practice: { done: 7, total: 15 },
  boss: { done: 0, total: 1, locked: false },
};
const week = { id: 'w1', weekNumber: 3, label: '第三周' };

describe('PiggyBankCard', () => {
  it('links to the piggy page and shows the balance', () => {
    render(<PiggyBankCard childId="c1" balancePence={1450} />);
    const link = screen.getByTestId('piggy-home-card');
    expect(link).toHaveAttribute('href', '/play/c1/piggy-bank');
    expect(link).toHaveTextContent('£14.50');
  });
});

describe('WeekHub pre-fight rewards', () => {
  it('lists 💷 alongside the other first-clear rewards on the frontier', () => {
    render(
      <WeekHub
        childId="c1"
        week={week}
        sections={sections}
        frontier
        keys={{ earned: 2, total: 10 }}
        piggyPence={100}
      />,
    );
    expect(screen.getByTestId('piggy-prefight')).toHaveTextContent('£1.00');
  });

  it('omits the £ line entirely when the piggy bank is off', () => {
    render(
      <WeekHub
        childId="c1"
        week={week}
        sections={sections}
        frontier
        keys={{ earned: 2, total: 10 }}
      />,
    );
    expect(screen.queryByTestId('piggy-prefight')).not.toBeInTheDocument();
  });

  it('still shows the other three rewards, unchanged', () => {
    render(
      <WeekHub
        childId="c1"
        week={week}
        sections={sections}
        frontier
        keys={{ earned: 2, total: 10 }}
        piggyPence={100}
      />,
    );
    expect(screen.getByText('解锁下一座岛')).toBeInTheDocument();
    expect(screen.getByText(/金币 ×2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `pnpm vitest run tests/unit/piggy-entry-points.test.tsx`
Expected: FAIL — `PiggyBankCard` not found.

- [ ] **Step 3: Write the home card**

Create `src/components/play/PiggyBankCard.tsx`:

```tsx
import Link from 'next/link';
import { PiggyJar } from '@/components/piggy/PiggyJar';

interface Props {
  childId: string;
  balancePence: number;
}

/**
 * The home entry point. Rendered only when the piggy bank is enabled — hidden
 * entirely otherwise, never greyed out or teasing, because a child whose parent
 * has not opted in should not see a reward she cannot have.
 */
export function PiggyBankCard({ childId, balancePence }: Props) {
  return (
    <Link
      href={`/play/${childId}/piggy-bank`}
      data-testid="piggy-home-card"
      className="flex items-center justify-between rounded-2xl border-2 border-pink-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-pink-300"
    >
      <PiggyJar balancePence={balancePence} compact />
      <span className="text-xs text-stone-500" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Mount it on the home page**

In `src/app/play/[childId]/page.tsx`, add the imports:

```ts
import { PiggyBankCard } from '@/components/play/PiggyBankCard';
import { getPiggyBalance, isPiggyEnabled } from '@/lib/db/piggy';
```

fetch alongside the other home reads:

```ts
  const piggyEnabled = await isPiggyEnabled(childId);
  const piggyBalance = piggyEnabled ? await getPiggyBalance(childId) : 0;
```

and render immediately after `<WantedPosters … />`:

```tsx
      {piggyEnabled && (
        <PiggyBankCard childId={childId} balancePence={piggyBalance} />
      )}
```

- [ ] **Step 5: Add the pre-fight line**

In `src/components/play/WeekHub.tsx`, add to `Props`:

```ts
  /** 存钱罐: pence a first clear pays. Omitted when the piggy bank is off. */
  piggyPence?: number;
```

destructure it in the component signature, and add a fourth `<li>` to the
frontier reward list, after the 🗝️ item and before the 🏝️ item:

```tsx
            {piggyPence ? (
              <li data-testid="piggy-prefight" className="flex items-center gap-1.5">
                <span aria-hidden="true">💷</span>
                <span className="font-hanzi">零花钱 {formatPence(piggyPence)}</span>
                <span className="font-normal text-amber-800/80">
                  / {formatPence(piggyPence)} pocket money
                </span>
              </li>
            ) : null}
```

with `import { formatPence } from '@/lib/piggy/money';` at the top.

Then thread the prop from the week-hub route (`src/app/play/[childId]/week/[weekId]/page.tsx`):

```ts
  const piggyPence = (await isPiggyEnabled(child.id))
    ? PIGGY_BOSS_CLEAR_PENCE
    : undefined;
```

and pass `piggyPence={piggyPence}` to `<WeekHub …/>`.

T3 established that naming rewards before the fight is what gets a reluctant
child to attempt it. Real money is the strongest instance, aimed at exactly the
battles she was avoiding.

- [ ] **Step 6: Extend the isolation guard**

In `tests/unit/distribution-isolation-guard.test.ts`, add:

```ts
describe('存钱罐 never reaches a social surface', () => {
  it('crew.ts does not import the piggy modules', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/crew.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/piggy/i);
  });

  it('no crew or gift component renders a money value', () => {
    for (const file of [
      'src/components/play/GiftInbox.tsx',
      'src/lib/actions/crew.ts',
    ]) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src).not.toMatch(/formatPence|piggy|pence/i);
    }
  });
});
```

A money balance is the most comparative number this app could hold, and the crew
rule already forbids ranks and gifts-received tallies. Extend the file list if
crew gains new surfaces.

- [ ] **Step 7: Verify and commit**

```bash
pnpm vitest run tests/unit/piggy-entry-points.test.tsx tests/unit/distribution-isolation-guard.test.ts
pnpm test && pnpm typecheck && pnpm lint && npx next build
git add src/components/play/PiggyBankCard.tsx src/components/play/WeekHub.tsx "src/app/play/[childId]" tests/unit/piggy-entry-points.test.tsx tests/unit/distribution-isolation-guard.test.ts
git commit -m "feat(piggy): home card, pre-fight £ line, crew isolation guard

The 💷 line joins WeekHub's frontier reward list — T3 showed that naming
rewards before the fight is what gets a reluctant child to attempt it.

The isolation guard pins that £ can never reach a crew surface: a balance is the
most comparative number this app could hold, and the no-leaderboard rule exists
because the child was avoiding boss fights out of 畏难情绪."
```

---

## Task 10: Documentation

Not optional. `CLAUDE.md` is auto-loaded into every session and is how the next
agent avoids re-learning what this PR cost to discover.

**Files:**
- Modify: `CLAUDE.md` (snapshot, recent-changes window, two new landmines)
- Modify: `PLAN.md` (§1 shipped table)
- Modify: `docs/CHANGELOG.md` (full narrative entry)

- [ ] **Step 1: Add the landmines**

In `CLAUDE.md`, under **Rewards & economy**:

> **Landmine:** *存钱罐 £ is REAL money — off by default, first-clear only, and the balance is derived.* Auto-credits are gated on `child_profiles.piggy_bank_enabled` (per-child, set by that child's OWN parent) because auto-crediting every child would commit other families to a payout schedule they never agreed to. The balance is `SUM(piggy_entries.delta_pence)` and is NEVER stored — it has to match a jar the child can physically count, and a denormalised total drifts (same rule as derived 🗝️ keys and season XP). Weekly-boss £ pays inside `bossCleared && !alreadyAwarded` ONLY: bosses are replayable (`refId = sessionId`) and a LOSS pays `boss_courage`, so a repeatable £ would let her farm real money. Idempotency is `.onConflictDoNothing()` against the PARTIAL unique index `piggy_entries_auto_uq`, **not** a caught 23505 — `creditPiggyInTx` runs inside `claimSeasonTierInTx`'s transaction, and Postgres aborts a whole transaction on any error without a savepoint, so catching the violation would poison the enclosing claim. Enabling the flag backfills past progress in the same transaction (no script); it reads bossability from `listBossWeekIds`, never a week's character count.

Under **Bilingual UI** or a new **Social** grouping, alongside the existing crew rule:

> **Landmine:** *£ must never appear on any social surface, and £0 is never rendered as failure.* A money balance is the most comparative number this app could hold; the existing no-leaderboard / no-gifts-tally rule covers it and `tests/unit/distribution-isolation-guard.test.ts` pins it. Separately, an empty piggy bank says 攒钱中… / Saving up — never "£0 earned", never a streak or since-last-earned counter. `boss_courage` pays on a FAILED boss, `BossScene.reset()` keeps progress on retry, and T3 names rewards before the fight, all to soften 畏难情绪; attaching real money to winning pushes the other way, and the copy is where that gets pulled back.

Under **Rewards & economy**, extend the season landmine:

> Also: *`seed-season-summer.ts` ends in `onConflictDoNothing()`* — deliberately, so a re-run cannot re-window a live season. Editing `summerVoyage.ts` therefore does NOT update an existing season's `tier_config`; run `scripts/sync-season-tier-config.ts` (updates `tier_config` only) or the change never reaches the row `getActiveSeason` reads.

- [ ] **Step 2: Update the subsystem snapshot**

Add a **存钱罐 Piggy bank** paragraph after "Currencies & retention", refresh the
"last refreshed" date, and roll the 3-PR recent-changes window (add this PR, drop
the oldest).

- [ ] **Step 3: `PLAN.md` and `docs/CHANGELOG.md`**

One row in `PLAN.md` §1's shipped table. The full narrative in
`docs/CHANGELOG.md`, including both traps found while planning (the
`onConflictDoNothing` season seed, and the transaction-poisoning hazard that
moved idempotency off a caught 23505).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md PLAN.md docs/CHANGELOG.md
git commit -m "docs(piggy): snapshot, landmines, changelog"
```

---

## Post-merge operations

In order. Steps 1 and 2 are **required** — the feature is inert without them.

1. **Migration 0041** applies automatically on the Vercel production build. Confirm the deploy is READY before continuing.
2. **`pnpm tsx scripts/sync-season-tier-config.ts` against PROD** (swap `DATABASE_URL` to the commented `# PROD_DATABASE_URL=` line in `.env.local`, then swap back). Without this the season £ never reaches the live season row.
3. **`pnpm tsx scripts/verify-integrity.ts` against PROD** — the standing rule after any PR whose post-merge ops include a script.
4. **Enable the flag for Yinuo** at `/parent/children/<id>/piggy-bank`, and check the quoted backfill figure before accepting it. Expected ≈ £14.00 if Map 1 is fully cleared.
5. No recompile, no seed script, no art generation, **no Blob operations**.
