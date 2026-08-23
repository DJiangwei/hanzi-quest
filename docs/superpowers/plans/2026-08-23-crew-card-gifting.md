# Crew & Card Gifting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a child gift a duplicate collectible card to a crewmate — the first social mechanic — without ever exposing a real name or creating a "you are behind" signal.

**Architecture:** The crew is every `child_profiles` row; there is no membership table. Identity is a deterministic pirate nickname derived from the child id, plus the existing avatar. Gifting consumes a duplicate from the giver and inserts a fresh `child_collections` row for the recipient inside one transaction, logged to a new `card_gifts` table that doubles as the unseen-notification queue. Delivery reuses the existing `CardChestReveal`.

**Tech Stack:** Next.js 16 App Router (RSC, server actions), TypeScript, Drizzle/Neon Postgres, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-23-crew-card-gifting-design.md`

## Global Constraints

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must ALL be green before the PR opens. Run the FULL suite (`pnpm test`, ~309 files / ~1783 tests), never just the new files.
- Work on branch `feat/crew-card-gifting`. **Never push to `main`.** **Use SSH for git push.**
- Tests mock all external boundaries (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). **A test importing any `@/lib/db/*` module — or a `@/lib/actions/*` that transitively loads one — MUST `vi.mock('@/db', () => ({ db: {} }))`,** or it throws `DATABASE_URL is not set` **only on CI**, because local `.env.local` has the variable. A suite can pass locally and fail on CI.
- **Drizzle migrations are append-only.** This plan adds exactly one: `0040`. Generate it with `pnpm db:generate` from the schema change — never hand-write `drizzle/*.sql`. Schema source of truth is `src/db/schema/*.ts`.
- **Bilingual rule (locked):** every kid-facing label carries both 中文 and English, ZH first. Use `bi(zh, en)` from `@/lib/i18n/bilingual` for single strings, or a ZH-span + EN-span pair in JSX.
- **Never pass `PackUiMeta` (or any function-bearing object) from a server component into a `'use client'` component.** Pass `packSlug: string` and call `getPackMeta(slug)` inside the client component. Neither local tests nor `pnpm build` catch a violation — only prod does.
- **Every exported `async function` in a `'use server'` file is a PUBLIC RPC endpoint**, callable with arbitrary arguments regardless of what the UI offers. This plan adds the project's **second deliberate cross-account write path** (after `assertAdmin`) — see Task 5, which is the security-critical task.
- **NEVER surface a rank, a gifts-received count, or any comparative figure between children.** This is the spec's binding negative constraint, not a preference. See spec §1.
- **`displayName` must never leave `src/lib/db/crew.ts`.** Other families' children are involved.
- PR number in doc snippets is provisional — the last merged PR was #156. Read the number GitHub assigns and correct the docs before requesting review.

---

### Task 1: Deterministic pirate nicknames

**Files:**
- Create: `src/lib/crew/nickname.ts`
- Test: `tests/unit/crew-nickname.test.ts`

**Interfaces:**
- Produces: `nicknameFor(childId: string): { zh: string; en: string }`

Pure and client-safe — no `@/db`, no `@/lib/db/*` imports. Client components render it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { nicknameFor } from '@/lib/crew/nickname';

const ID_A = '11111111-2222-3333-4444-555555555555';
const ID_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('nicknameFor', () => {
  it('is deterministic — the same id always gets the same name', () => {
    expect(nicknameFor(ID_A)).toEqual(nicknameFor(ID_A));
  });

  it('gives different ids different names', () => {
    expect(nicknameFor(ID_A)).not.toEqual(nicknameFor(ID_B));
  });

  it('always returns a non-empty bilingual pair', () => {
    for (const id of [ID_A, ID_B, '', 'not-a-uuid', '0']) {
      const n = nicknameFor(id);
      expect(n.zh.length, id).toBeGreaterThan(0);
      expect(n.en.length, id).toBeGreaterThan(0);
    }
  });

  it('never leaks the id into the name', () => {
    const n = nicknameFor(ID_A);
    expect(n.zh).not.toContain('1111');
    expect(n.en).not.toContain('1111');
  });

  it('spreads across the space rather than collapsing onto one name', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(nicknameFor(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).en);
    }
    // Two independent 12-word axes; 200 samples must not collapse to a handful.
    expect(seen.size).toBeGreaterThan(30);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/crew-nickname.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/crew/nickname"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * Deterministic bilingual pirate nickname for a child.
 *
 * PURE + CLIENT-SAFE by contract: no `@/db`, no `@/lib/db/*` imports — client
 * components render this directly.
 *
 * Derived from the child id and never stored. A six-year-old typing a public
 * handle would mean an input, a moderation policy and a PII surface; generating
 * the name removes all three. Identity to a crewmate is this name plus the
 * child's avatar, never their real `displayName`.
 */

const QUALITIES: { zh: string; en: string }[] = [
  { zh: '红帆', en: 'Redsail' },
  { zh: '蓝浪', en: 'Bluewave' },
  { zh: '金锚', en: 'Goldanchor' },
  { zh: '银钩', en: 'Silverhook' },
  { zh: '黑珍珠', en: 'Blackpearl' },
  { zh: '白鲸', en: 'Whitewhale' },
  { zh: '海风', en: 'Seabreeze' },
  { zh: '浪花', en: 'Seafoam' },
  { zh: '星光', en: 'Starlight' },
  { zh: '雷云', en: 'Thundercloud' },
  { zh: '碧波', en: 'Jadewater' },
  { zh: '暖阳', en: 'Sunbright' },
];

const ROLES: { zh: string; en: string }[] = [
  { zh: '船长', en: 'Captain' },
  { zh: '大副', en: 'Firstmate' },
  { zh: '舵手', en: 'Helmsman' },
  { zh: '瞭望员', en: 'Lookout' },
  { zh: '航海家', en: 'Navigator' },
  { zh: '探险家', en: 'Explorer' },
  { zh: '寻宝人', en: 'Treasureseeker' },
  { zh: '水手', en: 'Sailor' },
  { zh: '领航员', en: 'Pilot' },
  { zh: '鼓手', en: 'Drummer' },
  { zh: '厨师', en: 'Cook' },
  { zh: '木匠', en: 'Carpenter' },
];

/** FNV-1a, 32-bit. Stable across runtimes — no Math.random, no crypto. */
function hash(input: string, seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function nicknameFor(childId: string): { zh: string; en: string } {
  const q = QUALITIES[hash(childId, 0) % QUALITIES.length]!;
  const r = ROLES[hash(childId, 0x9e3779b9) % ROLES.length]!;
  // 红帆船长 / Captain Redsail — ZH is quality+role, EN reads role-first.
  return { zh: `${q.zh}${r.zh}`, en: `${r.en} ${q.en}` };
}
```

- [ ] **Step 4: Run it green**

Run: `pnpm vitest run tests/unit/crew-nickname.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crew/nickname.ts tests/unit/crew-nickname.test.ts
git commit -m "feat(crew): deterministic bilingual pirate nicknames"
```

---

### Task 2: `card_gifts` schema + migration 0040

**Files:**
- Modify: `src/db/schema/collections.ts` (append the table)
- Generate: `drizzle/0040_*.sql` via `pnpm db:generate`

**Interfaces:**
- Produces: `cardGifts` Drizzle table export.

- [ ] **Step 1: Add the table to the schema**

Append to `src/db/schema/collections.ts` (it already imports what you need; add `index` and `uuid` to the drizzle imports if missing):

```ts
/**
 * Peer-to-peer card gifts (crew gifting, 2026-08-23). Doubles as the ledger AND
 * the unseen-notification queue: the card transfers immediately inside the
 * gifting tx, and `seen_at` is stamped when the recipient opens the chest.
 *
 * `day_utc` is denormalised rather than derived from `sent_at` so the two daily
 * cap checks are plain index scans — same shape as `child_card_grants_daily`.
 */
export const cardGifts = pgTable(
  'card_gifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromChildId: uuid('from_child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    toChildId: uuid('to_child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectibleItems.id, { onDelete: 'cascade' }),
    dayUtc: text('day_utc').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    seenAt: timestamp('seen_at', { withTimezone: true }),
  },
  (t) => [
    index('card_gifts_to_unseen_idx').on(t.toChildId, t.seenAt),
    index('card_gifts_from_day_idx').on(t.fromChildId, t.dayUtc),
    index('card_gifts_to_day_idx').on(t.toChildId, t.dayUtc),
  ],
);
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `drizzle/0040_*.sql` containing only `CREATE TABLE card_gifts` and its indexes. **Read the generated SQL** and confirm it touches nothing else — if it proposes altering or dropping an existing table, stop and report: that means the schema and the DB have drifted and this plan must not paper over it.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

Do **not** hand-edit the generated SQL, and do not run it against any database — migrations apply automatically on the Vercel build.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/collections.ts drizzle/
git commit -m "feat(crew): card_gifts table (migration 0040)"
```

---

### Task 3: Crew read helper

**Files:**
- Create: `src/lib/db/crew.ts`
- Test: `tests/unit/crew-db.test.ts`

**Interfaces:**
- Consumes: `nicknameFor` (Task 1), `getEquippedAvatar` (`src/lib/db/shop.ts:186`).
- Produces:
  - `interface CrewMate { childId: string; nickname: { zh: string; en: string }; equipped: Partial<Record<AvatarSlotId, string | null | undefined>> }`
  - `listCrewMates(excludeChildId: string): Promise<CrewMate[]>`

**The security-relevant property of this module:** it must never return
`displayName`. Read `getEquippedAvatar`'s signature in `src/lib/db/shop.ts`
before wiring it — match its real return shape rather than assuming.

- [ ] **Step 1: Write the failing test**

Mock `@/db` with a select chain returning child id rows, and mock
`@/lib/db/shop`'s `getEquippedAvatar`. Assert:

```ts
it('never returns a real name', async () => {
  const mates = await listCrewMates('c-self');
  for (const m of mates) {
    expect(Object.keys(m).sort()).toEqual(['childId', 'equipped', 'nickname']);
    expect(JSON.stringify(m)).not.toContain('Yinuo');
  }
});

it('excludes the caller\'s own child', async () => {
  const mates = await listCrewMates('c-self');
  expect(mates.map((m) => m.childId)).not.toContain('c-self');
});

it('gives each mate a bilingual nickname', async () => { /* … */ });
```

Seed the mocked rows so at least one has `displayName: 'Yinuo'` in the raw DB
row — the test is meaningless if the fixture never contained a name to leak.

- [ ] **Step 2: Run it to verify it fails**

- [ ] **Step 3: Write the module**

```ts
// NEVER import this file from client code — it pulls in postgres.
import { ne } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles } from '@/db/schema';
import { nicknameFor } from '@/lib/crew/nickname';
import { getEquippedAvatar } from '@/lib/db/shop';
import type { AvatarSlotId } from '@/lib/avatar/defaultLook';

export interface CrewMate {
  childId: string;
  nickname: { zh: string; en: string };
  equipped: Partial<Record<AvatarSlotId, string | null | undefined>>;
}

/**
 * Everyone else in the deployment. The crew IS the child list — there is no
 * membership table, because four-to-six families who know each other do not
 * need friend requests. If the crew model ever narrows, THIS is the query that
 * narrows, and `giftCardAction`'s recipient check must narrow with it.
 *
 * Selects `id` ONLY. `child_profiles.displayName` belongs to another family's
 * child and must never leave this module — a future field addition here is how
 * a real name would leak into a payload rendered to someone else's kid.
 */
export async function listCrewMates(excludeChildId: string): Promise<CrewMate[]> {
  const rows = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(ne(childProfiles.id, excludeChildId));

  return Promise.all(
    rows.map(async (r) => ({
      childId: r.id,
      nickname: nicknameFor(r.id),
      equipped: await getEquippedAvatar(r.id),
    })),
  );
}
```

Adjust the `equipped` mapping to whatever `getEquippedAvatar` actually returns.

- [ ] **Step 4: Run it green. Step 5: Commit.**

```bash
git commit -m "feat(crew): listCrewMates — nickname + avatar, never a real name"
```

---

### Task 4: The gifting transaction

**Files:**
- Create: `src/lib/db/gifts.ts`
- Create: `src/lib/crew/gift-config.ts` (pure constants, client-safe)
- Test: `tests/unit/gift-tx.test.ts`

**Interfaces:**
- Produces:
  - `GIFTS_SENT_PER_DAY = 2`, `GIFTS_RECEIVED_PER_DAY = 3` (in `gift-config.ts`)
  - `giftCardInTx(tx, fromChildId, toChildId, itemId, dayUtc): Promise<GiftOutcome>`
  - `type GiftOutcome = { ok: true; itemId: string } | { ok: false; reason: 'no_duplicate' | 'already_owned' | 'send_cap_reached' | 'receive_cap_reached' | 'item_not_found' | 'self_gift' }`

**Model it on `convertDuplicateInTx` (`src/lib/db/grants.ts:324`)** — the closest
existing analogue. Read it first; it is the same `SELECT … FOR UPDATE` → check →
decrement shape.

**Never throws for an expected case.** Returns a discriminated result, the
`PurchaseOutcome` pattern the shop already uses.

- [ ] **Step 1: Write the failing tests**

Cover every branch, and specifically:

- `count >= 2` required — a single copy returns `no_duplicate` and writes nothing
- recipient already owns it → `already_owned`, giver's count unchanged
- giver at `GIFTS_SENT_PER_DAY` → `send_cap_reached`
- recipient at `GIFTS_RECEIVED_PER_DAY` → `receive_cap_reached`
- `fromChildId === toChildId` → `self_gift`
- happy path: giver's row decremented by exactly 1, recipient row inserted with
  `count: 1`, one `card_gifts` row written with the right `day_utc`
- **the `FOR UPDATE` is taken on the giver's row before the count check** —
  assert the select chain called `.for('update')`. Two concurrent gifts of the
  same last duplicate must not both pass.

Assert on the queries the mocked `tx` receives, not on thrown errors — a scoped
write that matches nothing does not throw.

- [ ] **Step 2: Run to verify failure. Step 3: Implement.**

Order inside the tx is load-bearing:

1. `self_gift` guard (cheapest, no IO)
2. `SELECT count … WHERE (fromChildId, itemId) FOR UPDATE` → `no_duplicate` if `< 2`
3. recipient ownership → `already_owned`
4. giver sent-today count → `send_cap_reached`
5. recipient received-today count → `receive_cap_reached`
6. giver `count - 1`
7. recipient `INSERT … values({ childId: toChildId, itemId, count: 1 })`
8. `INSERT INTO card_gifts`

Step 2 must precede 3–5 so the lock is held across the whole decision.

Note the recipient insert is **additive only** — never an update, never a
delete. A cross-account write that can only add is far easier to reason about.

- [ ] **Step 4: Run green. Step 5: Commit.**

```bash
git commit -m "feat(crew): giftCardInTx — dupe-only, capped, additive for the recipient"
```

---

### Task 5: The server action — SECURITY CRITICAL

**Files:**
- Create: `src/lib/actions/crew.ts` (`'use server'`)
- Test: `tests/unit/crew-action.test.ts`
- Modify: `tests/unit/distribution-isolation-guard.test.ts`

**Interfaces:**
- Produces: `giftCardAction(input: { fromChildId: string; toChildId: string; itemId: string }): Promise<GiftOutcome>`

**Read this before writing a line.** This is the project's **second deliberate
cross-account write path**. The first is `assertAdmin`, and PR #155 exists
because a gate that merely proved "is signed in" let a stranger reach shared
content. Every exported async function in a `'use server'` file is a public RPC
callable with arbitrary arguments — the picker UI constrains nothing.

Required shape:

```ts
'use server';

export async function giftCardAction(input: {
  fromChildId: string; toChildId: string; itemId: string;
}): Promise<GiftOutcome> {
  const parsed = Schema.parse(input);
  // The GIVER must be the caller's own child. requireChild — never assertParent,
  // which only proves a session exists (see the PR #155 landmine).
  const { child } = await requireChild(parsed.fromChildId);

  // The RECIPIENT is deliberately someone else's child. Today the crew is
  // "everyone", so existence is the whole membership check — if the crew model
  // ever narrows, THIS line narrows with it, in lockstep with listCrewMates.
  const recipient = await getChildById(parsed.toChildId);
  if (!recipient) return { ok: false, reason: 'item_not_found' };

  const outcome = await db.transaction((tx) =>
    giftCardInTx(tx, child.id, recipient.id, parsed.itemId, todayUtcIso()),
  );
  revalidatePath(`/play/${child.id}/collection`);
  return outcome;
}
```

- The item is validated **inside** the tx under `FOR UPDATE` — never by trusting
  the client that the giver owns it.
- **Return nothing about the recipient** beyond what the caller already sent. No
  `displayName`, no progress, no parent identity. Not even their nickname — the
  caller already rendered it from the id.

- [ ] **Step 1: Write the failing tests**

Assert: an ungated call throws (mock `requireChild` to reject); a call whose
`fromChildId` is not the caller's child is rejected **by `requireChild`, not by
the transaction**; the outcome is returned unchanged from the tx; nothing about
the recipient appears in the returned object.

Add to `tests/unit/distribution-isolation-guard.test.ts` a source-text assertion
that `src/lib/actions/crew.ts` contains `requireChild(` and does **not** contain
`assertParent(`. Match the per-function slicing style already used there for
`weeks.ts`.

- [ ] **Step 2–4: Fail → implement → green. Step 5: Commit.**

```bash
git commit -m "feat(crew): giftCardAction — the second cross-account write, gated at the giver"
```

---

### Task 6: Gift UI — button + crewmate picker

**Files:**
- Create: `src/components/play/GiftDialog.tsx` (`'use client'`)
- Modify: `src/components/play/CardDetailDialog.tsx`
- Test: `tests/unit/gift-dialog.test.tsx`

`CardDetailDialog` currently takes `{ packSlug, item, owned, onClose }` and
resolves `getPackMeta(packSlug)` client-side — **keep that pattern**; do not
start passing meta or crew objects with functions on them across RSC.

**Requirements:**

- A 🎁 送给船员 / Gift to a crewmate button, rendered **only** when the child
  owns `count >= 2` of this card. Thread the owned count in as a number prop.
- Tapping opens `GiftDialog`: a list of crewmates, each an `AvatarRender` plus
  their bilingual nickname.
- **A crewmate who already owns the card is greyed and unselectable**, labelled
  已经有了 / already has it. This is the rule that teaches the child what their
  friend lacks — it is the point of the feature, not a validation detail.
- Show remaining send capacity as 今天还能送 N 张 / N gifts left today.
  **Never a total-sent or total-received figure.**
- On success, close and toast 已送出 / Sent.
- All labels bilingual, ZH first.

**Test:** the button is absent at `count === 1` and present at `count >= 2`; a
mate who owns the card renders disabled; the action is called with the right
three ids; **no rendered text contains a rank, a received count, or another
child's real name.**

- [ ] Commit: `feat(crew): gift button + crewmate picker`

---

### Task 7: Receiving a gift

**Files:**
- Modify: `src/app/play/[childId]/page.tsx`
- Modify: `src/components/scenes/fx/CardChestReveal.tsx` (accept an optional giver line)
- Create: `src/lib/db/gifts-inbox.ts` (or extend `gifts.ts`)
- Test: `tests/unit/gift-inbox.test.ts`

**Requirements:**

- `listUnseenGifts(childId)` returns unseen `card_gifts` joined to the item,
  carrying the giver's **nickname only** — derived via `nicknameFor(fromChildId)`,
  never a name lookup.
- The kid's home picks these up alongside the existing idempotent generators
  (`page.tsx:220-223`, the `Promise.all` with `generateDailyQuests` /
  `generateDailyBounties`) and renders them through `CardChestReveal` with
  「来自 红帆船长 的礼物 / A gift from Captain Redsail」 on the chest.
- `seen_at` is stamped when the chest is opened, via a small
  `markGiftsSeenAction` — gated on `requireChild`.
- Reuse `CardChestReveal` rather than building a new reveal. It is the animation
  the child already associates with getting a card, so a gift reads as *the good
  thing* the instant it appears.

**Test:** an unseen gift produces a reveal carrying the giver's nickname; once
`seen_at` is set it does not reappear; the payload contains no `displayName`.

- [ ] Commit: `feat(crew): gifts arrive in the existing chest, stamped on open`

---

### Task 8: Docs + four-green + PR

**Files:** `CLAUDE.md`, `docs/CHANGELOG.md`, `PLAN.md`

- [ ] **Step 1: CLAUDE.md**

Update the snapshot (a new "Crew & gifting" sentence in the Cards & collection
paragraph), refresh the last-refreshed date, and add a bullet to the
"Recent changes" window — **dropping the oldest so it stays at exactly 3**.

Add a landmine to **"Auth, isolation & admin"**:

> **Landmine:** *Gifting is the SECOND deliberate cross-account write path — the first is `assertAdmin`.* `giftCardAction` writes a `child_collections` row for a child belonging to a different family, by design. It is safe only because: the GIVER is gated with `requireChild` (never `assertParent`, which only proves a session — see the PR #155 landmine); the recipient write is **additive only**, never an update or delete; and the item is validated inside the tx under `SELECT … FOR UPDATE`, never by trusting the client that the giver owns it. The recipient "membership" check is currently just existence, because the crew is every child in the deployment — **if the crew model ever narrows, `listCrewMates` and `giftCardAction`'s recipient check must narrow together.** Also: `src/lib/db/crew.ts` selects `id` ONLY and derives a nickname; `child_profiles.displayName` must never leave that module, or another family's child's real name lands in a payload rendered to someone else's kid.

And a second one, in the same group or under Rewards & economy:

> **Landmine:** *No social surface may show a rank, a gifts-received count, or any comparative figure between children.* The product exists because the child was avoiding boss battles out of 畏难情绪, and three shipped features soften exactly that (`boss_courage` paying on a FAILED attempt, `BossScene.reset()` keeping question progress on retry, T3 naming rewards before the fight). A leaderboard would undo all three, and a "gifts received" tally is the same mistake wearing a friendlier face — it hands the child nobody sends to a fresh way to feel behind. Gifts are moments, never scores.

- [ ] **Step 2: `docs/CHANGELOG.md`**

Append a flat bullet at the **bottom** of the file — `- **Title (PR #N, date)** — …` — matching the neighbouring entries' detailed-narrative register. Landmine paragraphs follow the entry, as elsewhere in that file. Do **not** add a `##` heading at the top; that is not this file's convention.

- [ ] **Step 3: `PLAN.md`**

One row in §1's shipped table, matching the `| #N | feat(scope): title | |` shape of the rows above it.

- [ ] **Step 4: Four-green**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Do not narrow the test run to the files you touched.

- [ ] **Step 5: Push + PR**

Controller opens the PR. Report the branch state and stop.

---

## Post-merge

**Migration 0040 applies automatically on the Vercel production build** — no
manual step. No seed script, no art generation, no Blob spend.

After deploy, verify on production: a child with a duplicate sees the 🎁 button;
a crewmate who owns the card is greyed; a sent gift arrives in the recipient's
chest on their next home render.
