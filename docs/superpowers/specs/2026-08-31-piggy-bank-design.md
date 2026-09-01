# 存钱罐 Piggy Bank — design

> New subsystem. Real pocket money, tracked in-app: the parent keeps the books,
> the child sees her balance and where her money went, and beating bosses pays £.
> Scope agreed with David 2026-08-31 (11 decisions, recorded below).

---

## Problem

Every currency in this game is imaginary. Coins buy hats, XP buys a title, cards
buy nothing at all. None of it teaches what money is, because none of it is
scarce outside the app.

Yinuo is six and starting to encounter real money. The game already has the two
things a pocket-money tool needs and usually lacks: a **reason to earn**, and a
**parent who is already in the loop daily**. Beating a weekly boss is real,
effortful work with an unambiguous completion signal — the same signal that
already pays coins, a card, and a key. Paying £1 alongside them costs one more
write.

The feature is therefore two halves that must not be confused:

1. **A ledger of real money** — authoritative, auditable, correctable, and
   answerable to a physical jar the child can count.
2. **An earning surface inside the game** — small, bounded, and never the reason
   she plays.

---

## Decisions (locked)

| # | Decision | Chosen |
|---|---|---|
| 1 | Past progress | **Backfill everything** — up to £14, as dated entries |
| 2 | Season link | **Tiers pay £** *and* a **season summary panel** |
| 3 | Savings goal | **None** — ledger only |
| 4 | Recurring allowance | **None** — earned-only, no cron |
| 5 | Kid entry point | **Home-page card → own page** |
| 6 | Ledger meaning | **Balance mirrors her real jar** — handing over cash is not a transaction; only purchases debit |
| 7 | Spend detail | **Category + note + breakdown chart** |
| 8 | Pre-fight display | **Yes** — 💷£1 joins the T3 reward preview |
| 9 | Who accrues £ | **Off by default, per-child opt-in** by that child's own parent |
| 10 | Season budget | **£3 per season** — tiers 10 / 20 / 30 pay 50p / £1 / £1.50 |
| 11 | Categories | 🧸玩具 🍬零食 📚书 🎁礼物 🎨手工 🎢玩乐 ✨其他 |

Two rules taken as given rather than asked:

- **£ pays on FIRST clear only.** Boss clears are deliberately repeatable
  (`refId = sessionId`, and a *loss* pays `boss_courage`). A repeatable £ would
  let her farm real money indefinitely. Coins already gate on `!alreadyAwarded`;
  £ follows exactly.
- **Integer pence, £ hardcoded.** Never a float — `1.15` has no exact binary
  representation and a money column that drifts by a rounding error is the
  oldest bug in the trade. Multi-currency is YAGNI for this deployment.

---

## Rate card

Per map: **£14**.

| Event | Amount | Fires at |
|---|---|---|
| Weekly boss, first clear | £1 × 10 weeks | `finishLevelAction`, `bossCleared && !alreadyAwarded` |
| All keys → vault opens (通关整个 map) | £1 | `finishLevelAction`, the `claimKeyVaultPrize` branch |
| Final overlord beaten | £3 | `finishFinalBossAction`, `firstClear` |
| Season tiers 10 / 20 / 30 | 50p / £1 / £1.50 | `claimSeasonTierInTx` |

These are three genuinely distinct moments, not one event seen three ways: the
key ring completes when the tenth weekly boss falls, which is what *unlocks* the
👑 lair node; the final boss is fought afterwards.

Season £ is deliberately an order of magnitude below a map. Season XP accrues
from time in the app; boss clears cost effort. Paying them comparably would
teach the wrong lesson.

---

## Approaches considered

**Chosen — ledger only, balance derived.** One `piggy_entries` table; the
balance is `SUM(delta_pence)`. Nothing stores a running total.

This is the house pattern for state that must not drift, and both existing
instances say so in their landmines: 🗝️ keys are derived from `week_progress`
("a stored count drifts from progress and can double-grant"), and season XP is
derived from `xp_events` ("never stored — don't add a season-XP column"). Real
money against a countable jar is the strongest version of that requirement. The
cost is a `SUM` per read over ~100 lifetime rows per child — free.

**Rejected — derive the earnings too.** Weekly-boss £ is inferable from
`week_progress.bossCleared`, the vault from `card_grants_log`, the final boss
from `final_boss_clears`. Tempting, because the backfill would vanish entirely.
Two things kill it:

1. **Retroactive revaluation.** If Map 2's bosses ever pay £2, Map 1 silently
   becomes £28. A ledger freezes the rate in force at the moment it was earned,
   which is what a ledger is *for*.
2. **Half the history could not be dated.** `child_season_progress.tiersClaimed`
   is an `integer[]` with no per-tier timestamp, so season earnings have no
   date to render at all.

**Rejected — `piggy_balances` + `piggy_entries`, mirroring the coin tables.**
Two sources of truth for a real-money number. `coin_balances` gets away with the
denormalisation because nobody ever audits coins against anything; this number
has to match a jar.

---

## Data model — migration 0041

```sql
ALTER TABLE child_profiles
  ADD COLUMN piggy_bank_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE piggy_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  delta_pence integer NOT NULL,
  source      text    NOT NULL,
  category    text,
  note        text,
  ref_id      text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX piggy_entries_child_idx
  ON piggy_entries (child_id, occurred_at DESC);

CREATE UNIQUE INDEX piggy_entries_auto_uq
  ON piggy_entries (child_id, source, ref_id) WHERE ref_id IS NOT NULL;
```

`delta_pence` is signed: credits positive, debits negative. The balance is
`SUM(delta_pence)`, so a debit is an ordinary row and there is exactly one
code path for "change the balance".

`source` is **text, not a pgEnum**, following `card_grants_log.source` — a
future source then needs no migration. The TS union is the source of truth:

```ts
export type PiggySource =
  | 'boss_clear' | 'key_vault' | 'final_boss' | 'season_tier'  // auto, ref_id set
  | 'parent_credit' | 'purchase' | 'reconcile';                // manual, ref_id null
```

`occurred_at` is separate from `created_at` so the parent can log yesterday's
purchase, and so backfilled entries carry the date they were actually earned.
Every list and chart orders by `occurred_at`; `created_at` exists only for audit.

The **partial** unique index is the entire idempotency story for auto-credits.
It is partial because manual entries legitimately repeat — two 🍬 purchases on
one day are two rows, not a conflict.

### Idempotency without an exception

Auto-credits insert with **`.onConflictDoNothing().returning({ id })`** and read
`rows.length > 0` as "did this credit happen". No exception is raised, so no
23505 guard is needed at all.

This is deliberately *not* the pattern the six guards audited in PR #159 use, and
the difference matters here. `creditPiggyInTx` is called from **inside**
`claimSeasonTierInTx`'s transaction. Postgres aborts an entire transaction on any
error unless it is wrapped in a savepoint, so a caught unique violation would
leave the enclosing season-claim transaction poisoned — every later statement
failing with `current transaction is aborted`. Catching the error would plant
that bug; not raising it avoids the question.

`ON CONFLICT DO NOTHING` is precise here because `piggy_entries` has exactly one
unique index besides its random-uuid primary key, so nothing else can be
swallowed by it.

The residual risk moves to the index itself: tests mock `@/db`, so a unit test
proves only that the code branches correctly on an empty vs. non-empty
`returning()`. **Whether the partial unique index actually exists and matches
must be checked against the dev branch by hand** after `pnpm db:generate` — the
same class of gap as a missing seed script run.

---

## Modules

**`src/lib/piggy/money.ts`** — pure, client-safe. `formatPence(150) → "£1.50"`.
Formatting lives in one place so a rounding rule can never diverge between the
parent table, the kid's jar, and the chart.

**`src/lib/piggy/categories.ts`** — pure, client-safe. The seven categories with
emoji and bilingual labels:

| slug | emoji | 中文 | English |
|---|---|---|---|
| `toys` | 🧸 | 玩具 | Toys |
| `snacks` | 🍬 | 零食 | Snacks |
| `books` | 📚 | 书 | Books |
| `gifts` | 🎁 | 礼物 | Gifts |
| `crafts` | 🎨 | 手工 | Crafts |
| `outings` | 🎢 | 玩乐 | Fun |
| `other` | ✨ | 其他 | Other |

🎁礼物 is in the set deliberately: spending on someone else is the one spending
category worth encouraging, and it needs to be nameable before it can be praised.

**`src/lib/piggy/rates.ts`** — pure, client-safe (the pre-fight preview is a
client component and imports it):

```ts
export const PIGGY_BOSS_CLEAR_PENCE = 100;
export const PIGGY_KEY_VAULT_PENCE  = 100;
export const PIGGY_FINAL_BOSS_PENCE = 300;
```

**`src/lib/db/piggy.ts`** — server-only, **NOT** under `src/lib/actions/`. Every
exported async function in a `'use server'` file is a public RPC endpoint, so a
trust-caller helper taking a raw `childId` must not live there (PR #112).

```ts
creditPiggy(childId, source, refId, pence, occurredAt?) → { credited: boolean }
getPiggyBalance(childId)        → number          // SUM(delta_pence)
listPiggyEntries(childId, opts) → PiggyEntry[]
getSpendByCategory(childId)     → Record<PiggyCategory, number>
getSeasonPiggySummary(childId, season) → { earnedPence, spentPence }
```

`creditPiggy` reads `piggy_bank_enabled` first and returns
`{ credited: false }` when off, so no call site has to remember the check.

It has a `creditPiggyInTx(tx, …)` sibling that **skips that check**, for the one
caller that cannot use it: `creditPastProgress` runs inside the same transaction
that sets the flag, so a fresh read would either see the pre-update value or
depend on transaction visibility rules to see the new one. The enable action has
already established the flag; the in-tx variant trusts it. Every other caller
uses `creditPiggy` and gets the check for free.

---

## Where £ fires

All four sites go through `creditPiggy`.

| Site | Guard | `ref_id` |
|---|---|---|
| `finishLevelAction` boss branch | `bossCleared && !alreadyAwarded` | `weekId` |
| `finishLevelAction` vault branch | beside `prize.coins` | `packId` |
| `finishFinalBossAction` | `firstClear` | `packId` |
| `claimSeasonTierInTx` | `tier.bonusMoneyPence` set | `${seasonId}:${tier}` |

The first three are **try/catch-guarded and outside any transaction**. £ is a
bonus riding on those actions; a piggy failure must never fail a boss clear.
This follows `safeClaimKeyVault` / `safeClaimWeeklyGift` — and note *why* that
rule exists: `SceneRunner.advance` awaits `finishAttemptAction` inside
`startTransition` with no catch, so an unguarded throw freezes the child's
screen mid-question (PR #159).

The season claim is the exception: it goes **inside** `claimSeasonTierInTx`. If
the tier claim rolls back, the money must roll back with it. Putting it in the
shared `…InTx` helper also means `claimSeasonTierAction` and
`claimAllSeasonTiersAction` both get it with no second implementation.

### Surfacing the award

`EconomyBonus` gains `unit?: 'coins' | 'pence'`, defaulting to coins when
absent. That reuses the entire existing pipeline — SceneRunner's bonus queue,
`BonusToast`'s render, the fanfare — for roughly three lines, with only the
amount formatter branching. A parallel money-toast surface would duplicate all
of it.

---

## Enabling, and the backfill

**There is no backfill script.** Enabling the toggle credits past progress in the
same transaction, idempotent through `piggy_entries_auto_uq`.

The parent dashboard computes the amount and shows it before committing:

> Enabling will credit **£14.00** of past progress
> (10 boss clears · 1 vault · 1 final boss). Continue?

This beats a script on every axis that matters: the cost is visible before it is
incurred, it works for every family rather than only David's, re-running is a
no-op, and a child enabled a year from now gets the same treatment with nothing
to remember.

`creditPastProgress(childId)` reads:

- **Weekly bosses** — `week_progress.bossCleared = true`, intersected with
  `listBossWeekIds`. **A week below `BOSS_MIN_CHARS` has no boss and must not
  pay**; reading bossability from `weekCharacters.length` instead of the
  compiled `boss:boss:0` row is the exact mistake that made week 10 unreachable
  in production (PR #151).
- **Vault** — `card_grants_log` where `source = 'key_vault'`.
- **Final boss** — `final_boss_clears`.

**Already-claimed season tiers are NOT backfilled.** The season £ attaches to the
*act of claiming*, and those claims already happened under a config that paid
nothing; there is also no per-tier timestamp to date them by. Claims from the
merge onward pay. This is the one place "backfill everything" is read narrowly,
and it is called out here so the preview figure is not mistaken for a bug.

Dating: the vault (`granted_at`) and final boss (`cleared_at`) are exact.
`week_progress` has **no `boss_cleared_at` column**, so weekly entries fall back
to `last_played_at` — the right week, occasionally the wrong session. Do not add
a timestamp column to fix this: the clear times were never recorded, so a new
column could only be populated with the same approximation, dressed up as
precision. The history simply shows a date, with no accuracy claim attached.

**Disabled means nothing accrues.** Not "accrues but hidden". A hidden balance
would surface at enable time as a number that bypassed the confirmation screen,
which is the one thing the confirmation exists to prevent.

---

## Season integration

`SeasonTier` gains an optional field **alongside** its existing reward:

```ts
export interface SeasonTier {
  tier: number;
  xpRequired: number;
  reward: SeasonReward;
  bonusMoneyPence?: number;   // new
}
```

Deliberately **not** a `{ type: 'money' }` variant of `SeasonReward`: that union
is one-reward-per-tier, so a money variant would *replace* tiers 10/20/30's
current cards and cosmetics. An optional bonus enriches them instead, needs no
JSONB migration, and reads as "the season also pays pocket money" rather than
"three tiers were converted to cash".

`src/lib/season/summerVoyage.ts` gains `bonusMoneyPence` on tiers 10 / 20 / 30.

### The trap that would have made this inert

`scripts/seed-season-summer.ts` ends in **`onConflictDoNothing()`** — on purpose,
so a re-run cannot silently re-window a live season. Consequence: editing
`summerVoyage.ts` and re-running the seed **will not update the live season's
`tier_config`**, because the row already exists. The money would sit in TS and
never reach the DB that `getActiveSeason` actually reads.

This needs a dedicated post-merge script, **`scripts/sync-season-tier-config.ts`**,
which `UPDATE`s `tier_config` only — never `starts_at`, `ends_at`, or
`is_active`. Same class of failure as a missing `seed-trophies.ts` run: tests
mock `@/db`, so nothing local would have caught it.

### Season summary panel

Derived, never stored — the same rule season XP already follows. Sum
`piggy_entries` where `occurred_at` falls inside `[starts_at, ends_at]`, split
into credits and debits. A new season is just a later window.

---

## Parent surface

`/parent/(secured)/children/[id]/piggy-bank` — inside the PIN-gated `(secured)`
group, **English-only** per the parent-surface rule (the bilingual requirement
covers kid-facing chrome).

- **Enable toggle** with the cost confirmation above.
- **Balance**, large, plus lifetime earned / lifetime spent.
- **Add money** — amount, note, date → `parent_credit`.
- **Record purchase** — amount, category, note, date → `purchase`.
- **Reconcile** — the parent types what is *actually* in the jar; the difference
  is written as one `reconcile` entry. Real jars and databases drift, and a jar
  the child can count is the whole point of decision 6, so the design has to
  admit disagreement rather than pretend it away. Zero difference writes nothing.
- **No "gave her cash" action, deliberately.** Under decision 6 the balance
  mirrors the physical jar, so handing over a £5 note moves the same money from
  virtual to physical and is *not* a transaction. The page says so in one line,
  because its absence is otherwise read as a missing feature.
- **History**, newest first, with delete on `parent_credit` / `purchase` /
  `reconcile` only. Auto-earned entries are immutable — they double as the
  idempotency guard, and deleting one would let it re-credit.

Deleting rather than reversing is deliberate: a "-£45 correction" row is
unreadable to a six-year-old scanning her own history. The parent is the sole
writer and the audit trail has an audience of one.

Actions live in `src/lib/actions/piggy.ts`, each opening with
`requireChild(childId)` — which proves *this parent owns this child*, the
correct gate for money. `assertParent()` would be wrong: it means only "is
signed in" (PR #155).

---

## Kid surface

`/play/[childId]/piggy-bank`, **bilingual throughout** — `bi(zh, en)` or paired
spans for every label, per the bilingual-chrome rule.

- **The jar** — illustration plus the balance in £. Procedural SVG, not
  generated art: the Blob free tier is 2,000 advanced ops/month and a jar that
  has to re-render at several fill levels is exactly the wrong thing to spend
  them on.
- **Breakdown** — horizontal bars, one per category that has spend, each labelled
  with its emoji. Not a pie: a six-year-old reads "🍬 is the longest bar"
  instantly and cannot read a pie's angles. The implementer must load the
  `dataviz` skill before writing it.
- **History** — newest first: emoji, amount, note, date.
- **Season panel** — 本季 / This season · 赚了 £X · 花了 £Y.

**Home card** near the 通缉令 posters: jar, balance, links through. Hidden
entirely when `piggy_bank_enabled` is false — not greyed, not teasing.

**Pre-fight preview**: 💷£1 joins `🪙×2 · 🎴+1 · 🗝️+1 · 解锁下一座岛` in
`WeekHub`'s frontier reward list, conditional on the flag. Correction to the
brief: the frontier *island* on the voyage board carries only a compact `✨2×`
badge, not a list, so there is nothing there for a fourth line to join. The hub
is the surface the child reads before tapping into the fight. T3 established that
naming rewards *before* the fight is what gets a reluctant child to attempt it;
real money is the strongest instance of that, aimed at the exact battles she was
avoiding.

---

## Two rules to add as landmines

**£ never appears on any social surface — no exceptions, ever.** The crew
landmine already forbids ranks, gifts-received tallies, and any comparative
figure between children, because this product exists partly because the child was
avoiding boss fights out of 畏难情绪. A money balance is the most comparative
number this app could hold. `src/lib/db/crew.ts` selects `id` only and derives a
nickname; `tests/unit/distribution-isolation-guard.test.ts` will pin that
`piggy_entries` cannot be read from any crew path.

**A zero balance is never rendered as failure.** £0 shows an empty jar and
攒钱中… / Saving up. Never "£0 earned", never "you didn't earn anything this
week", never a streak or a since-last-earned counter. Three shipped features
soften 畏难情绪 — `boss_courage` pays out on a *failed* attempt,
`BossScene.reset()` keeps question progress on retry, and T3 names rewards before
the fight. Attaching real money to winning pushes against all three; the copy is
where that gets pulled back.

---

## Non-goals

- **No savings goal / target jar.** Decision 3. A goal is additive later and
  needs no schema rewrite.
- **No allowance, no cron.** Decision 4. All income is earned.
- **No kid-initiated spending, withdrawal requests, or wish lists.** The child's
  side is read-only by design.
- **No £ in `/admin/economy`.** That dashboard is for tuning the *game* economy;
  real money is not a balancing lever.
- **No multi-currency.**
- **No £ on any crew surface.**
- **No reversal/void entries.** Deleting a manual entry is the correction path
  for a mistyped row. `reconcile` is not a reversal and must not be used as one:
  it records a genuine disagreement between the jar and the ledger, which is a
  real event worth keeping, whereas a typo is not.

---

## Tests

Pure engines first — they hold the arithmetic that must not be wrong:

- `formatPence` — whole pounds, pence, zero, negative. £0.05 renders `£0.05`,
  not `£0.5`.
- Balance summation from a mixed credit/debit entry list, including all-debits
  and empty.
- `getSpendByCategory` — ignores credits; a category with no spend is absent
  from the chart, not a zero-length bar.
- Season summary windowing — an entry one second outside `ends_at` is excluded.

Guards and behaviour:

- **`creditPiggy` idempotency** — second call with the same `(child, source,
  ref_id)` returns `{ credited: false }`, using `wrappedUniqueViolation()`.
  Per the PR #159 lesson, **run this test against an unguarded `creditPiggy`
  once and watch it fail** before adding the guard.
- **Disabled child accrues nothing** — a boss clear on a child with
  `piggy_bank_enabled = false` writes no row.
- **`creditPastProgress` is exactly-once** — running it twice leaves the balance
  unchanged.
- **`creditPastProgress` skips bossless weeks** — a week below `BOSS_MIN_CHARS`
  pays nothing even with a `week_progress` row.
- **`finishLevelAction` survives a piggy failure** — `creditPiggy` throwing still
  returns `ok: true` with the boss cleared.
- **Season claim rolls money back** — a `claimSeasonTierInTx` failure leaves no
  `piggy_entries` row.
- **Manual-only deletion** — deleting an auto entry is refused.
- **Reconcile** — writes the difference, and writes nothing when it is zero.
- Bilingual chrome on the kid page, the home card, and the pre-fight preview.
- `distribution-isolation-guard` extended for the crew rule.

Any suite importing the finish actions must mock `@/lib/db/piggy` alongside the
existing `@/lib/db/key-vault`, `@/lib/db/final-boss`, `@/lib/db/maps` mocks — the
mock-`@/db` landmine, which bit six suites in one PR the last time a new
`@/lib/db/*` import reached these actions.

---

## Post-merge ops

1. **Migration 0041** applies automatically on the Vercel production build
   (`tsx scripts/migrate.ts && next build`). Note this claims 0041 ahead of the
   unmerged A2 review-loop spec, which must renumber to 0042.
2. **`scripts/sync-season-tier-config.ts`** against **prod** — required, or the
   season £ never reaches the live season row. See the trap above.
3. **Enable the flag for Yinuo** in the parent dashboard, and confirm the
   backfill figure matches expectations before accepting it.
4. No recompile, no art generation, no Blob operations.
