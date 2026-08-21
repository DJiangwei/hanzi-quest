# Per-Child Pack Gate + Two Unlockable Packs (PR B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `hello-kitty-v1` (16 cards) and `paw-patrol-v1` (12 cards), invisible and undroppable until the child beats Map 1's final boss, and announce the unlock when it happens.

**Architecture:** The project's first **per-child pack gate**. `final_boss_clears` stays the single source of truth for "this child beat this map" — no new table, no new column, no migration, mirroring the derived-🗝️-keys decision in T3. A pure client-safe config maps a collectible pack slug → the curriculum pack slug whose final boss unlocks it; one server helper turns that into "packs still locked for this child"; six call sites enforce it. The rule is computed **inside** `pullCardInTx` so its six callers stay unchanged.

**Tech Stack:** Next.js 16 App Router (RSC, server actions), TypeScript, Drizzle/Neon Postgres, Vitest + React Testing Library, Cloudflare Workers AI (flux-1-schnell), Vercel Blob.

**Spec:** `docs/superpowers/specs/2026-08-21-collection-packs-v2-design.md` §3.2, §3.3, §4, §5, §6.

**Depends on:** Task 0 below (a separate hotfix PR) must be merged first. PR A (`olympics-v1`) is independent and can land in either order.

## Global Constraints

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must ALL be green before any PR is opened. Run the FULL suite (`pnpm test`), never just the new files.
- **Never push to `main`.** Branch protection is enforced (PR + CI required). **Use SSH for git push.**
- Tests mock all external boundaries (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`).
- **A test importing any `@/lib/db/*` module (or a `@/lib/actions/*` that transitively loads one) MUST `vi.mock('@/db', () => ({ db: {} }))`,** or it throws `DATABASE_URL is not set` — and *only on CI*, because local `.env.local` has the variable. Every task below that adds a new `@/lib/db/*` import into an existing module must also add that module to the `vi.mock` list of every suite already importing it, or CI goes red on files you never opened.
- **Bilingual rule (locked):** every new kid-facing label is `中文 / English`, ZH first. Use `bi(zh, en)` from `@/lib/i18n/bilingual` for single strings, or a ZH-span + EN-span pair in JSX.
- **Every exported `async function` in a `'use server'` file is a PUBLIC RPC endpoint.** A gate that only hides UI is not a gate. This is why Task 8 also patches the shard swap.
- **Never pass `PackUiMeta` (or any function-bearing object) from a server component into a `'use client'` component.** Pass `packSlug: string`; call `getPackMeta(slug)` inside the client component. Local tests and `pnpm build` will NOT catch a violation — only prod does.
- Drizzle migrations are append-only — this PR adds **none**.
- **Vercel Blob free tier = 2,000 Advanced Operations/month.** 28 `put()`s here ≈ 1.4%. Never run the art generator with `FORCE=1`.
- **PR numbers in the doc snippets below are provisional.** The last merged PR was #152. Open the PR, read the number GitHub assigns, then correct it in CLAUDE.md / CHANGELOG / PLAN.md before requesting review.

---

## Task 0: PREREQUISITE HOTFIX — the final boss is unreachable

> **Ship this as its own PR, merged before PR B.** It is a live production bug, independent of the pack work, and it deserves its own reviewable diff. PR B's entire gate hinges on a final-boss clear that today can never happen.

**The bug.** `src/app/play/[childId]/final-boss/[packSlug]/page.tsx` and
`src/lib/actions/final-boss.ts` both resolve the map slug with
`getPackBySlug` from `@/lib/db/collections` — which queries **`collection_packs`**.
The slug they are given is a **`curriculum_packs`** slug. Verified against
production on 2026-08-21:

```
collection_packs : animals-v1, champions-v1, dinosaurs-v1, festivals-v1, flags-v1,
                   instruments-v1, key-vault-v1, landmarks-v1, minibeasts-v1,
                   sea-creatures-v1, season-summer-v1, solar-system-v1,
                   transport-v1, zodiac-v1
curriculum_packs : pirate-class-level-1 | pirate-class-level-2 | school-custom | school-custom
collection_packs matching 'pirate%': NONE
final_boss_clears rows: 0
```

So the lookup returns `null` → the route `notFound()`s (a 404 on the 👑 lair
node) and `finishFinalBossAction` throws `'Map not found'`. The Caribbean final
boss has never been beatable. PR #151 fixed the *gating* that kept the lair node
from appearing; this is the layer underneath it.

**Why no test caught it.** `tests/unit/app/final-boss-route.test.tsx` mocks
`getPackBySlug` to resolve a fake pack whose slug is `'pirate-class-level-1'` —
the mock asserts the very thing that is false in reality. Same family as the
"tests mock `@/db`, so a missing seed only surfaces in prod" landmine.

**Careful:** `curriculum_packs.slug` is **not unique** — `school-custom` has one
row per family, distinguished by `owner_user_id`. The new lookup must restrict to
shared packs (`owner_user_id IS NULL`), exactly like the existing
`getDefaultSharedPackId`. Maps are shared packs, and the restriction also
prevents one family's custom pack from being addressable by another.

**Files:**
- Modify: `src/lib/db/curriculum.ts` (add `getSharedCurriculumPackBySlug`)
- Modify: `src/lib/actions/final-boss.ts:6,31`
- Modify: `src/app/play/[childId]/final-boss/[packSlug]/page.tsx:3,19`
- Test: `tests/unit/app/final-boss-route.test.tsx`, `tests/unit/curriculum-pack-lookup.test.ts` (new)

**Interfaces:**
- Produces: `getSharedCurriculumPackBySlug(slug: string): Promise<{ id: string; slug: string; name: string } | null>` exported from `@/lib/db/curriculum`.

- [ ] **Step 1: Write the failing test for the new helper**

Create `tests/unit/curriculum-pack-lookup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as { id: string; slug: string; name: string }[],
  whereArgs: [] as unknown[],
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (arg: unknown) => {
          mocks.whereArgs.push(arg);
          return { limit: async () => mocks.rows };
        },
      }),
    }),
  },
}));

import { getSharedCurriculumPackBySlug } from '@/lib/db/curriculum';

beforeEach(() => {
  mocks.rows = [];
  mocks.whereArgs = [];
});

describe('getSharedCurriculumPackBySlug', () => {
  it('returns the shared curriculum pack row for a map slug', async () => {
    mocks.rows = [{ id: 'pk1', slug: 'pirate-class-level-1', name: '海盗班 Level 1' }];
    const pack = await getSharedCurriculumPackBySlug('pirate-class-level-1');
    expect(pack).toEqual({ id: 'pk1', slug: 'pirate-class-level-1', name: '海盗班 Level 1' });
  });

  it('returns null when no shared pack has that slug', async () => {
    mocks.rows = [];
    expect(await getSharedCurriculumPackBySlug('nope')).toBeNull();
  });

  it('filters on owner_user_id IS NULL (school-custom repeats per family)', async () => {
    mocks.rows = [];
    await getSharedCurriculumPackBySlug('school-custom');
    // The where() clause must be a composite (and(...)), not a bare eq on slug.
    expect(mocks.whereArgs).toHaveLength(1);
    expect(JSON.stringify(mocks.whereArgs[0])).toContain('owner_user_id');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/curriculum-pack-lookup.test.ts`
Expected: FAIL — `getSharedCurriculumPackBySlug` is not exported from `@/lib/db/curriculum`.

- [ ] **Step 3: Add the helper**

In `src/lib/db/curriculum.ts`, after `getDefaultSharedPackId`:

```ts
/**
 * Look up a SHARED curriculum pack (a "map") by slug.
 *
 * `curriculum_packs.slug` is NOT unique on its own — `school-custom` has one row
 * per family, keyed by `owner_user_id` — so this restricts to shared rows
 * (`owner_user_id IS NULL`), which is what every map is. Without the
 * restriction, one family's custom pack would be addressable by slug alone.
 *
 * Use this, NOT `getPackBySlug` from `@/lib/db/collections`: that one queries
 * `collection_packs` (the COLLECTIBLE packs, `*-v1`), a completely separate
 * slug namespace. The final-boss route and action used it for months, so the
 * lookup always returned null and the final boss 404'd.
 */
export async function getSharedCurriculumPackBySlug(
  slug: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const [row] = await db
    .select({
      id: curriculumPacks.id,
      slug: curriculumPacks.slug,
      name: curriculumPacks.name,
    })
    .from(curriculumPacks)
    .where(and(eq(curriculumPacks.slug, slug), isNull(curriculumPacks.ownerUserId)))
    .limit(1);
  return row ?? null;
}
```

`and`, `eq`, `isNull` are already imported at the top of that file.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/curriculum-pack-lookup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Swap the two callers**

In `src/lib/actions/final-boss.ts`, replace the import

```ts
import { getPackBySlug } from '@/lib/db/collections';
```

with

```ts
import { getSharedCurriculumPackBySlug } from '@/lib/db/curriculum';
```

and the call site

```ts
  const pack = await getPackBySlug(parsed.packSlug);
```

with

```ts
  // A map slug lives in curriculum_packs, NOT collection_packs — see the helper's
  // docstring. Using the collectible lookup here made every final boss throw.
  const pack = await getSharedCurriculumPackBySlug(parsed.packSlug);
```

Apply the identical two edits in
`src/app/play/[childId]/final-boss/[packSlug]/page.tsx` (import on line 3, call
on line 19). Leave the `if (!pack) notFound();` guard as-is.

- [ ] **Step 6: Fix the route test's mock so it can never hide this again**

In `tests/unit/app/final-boss-route.test.tsx`, replace the
`@/lib/db/collections` mock block:

```tsx
const getPackBySlug = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  id: 'pk',
  slug: 'pirate-class-level-1',
  name: 'Caribbean',
}));
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
}));
```

with:

```tsx
const getSharedCurriculumPackBySlug = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  id: 'pk',
  slug: 'pirate-class-level-1',
  name: '海盗班 Level 1',
}));
vi.mock('@/lib/db/curriculum', () => ({
  getSharedCurriculumPackBySlug: (...a: unknown[]) =>
    getSharedCurriculumPackBySlug(...a),
}));
```

Update the `beforeEach` block in the same file, which currently re-primes
`getPackBySlug.mockResolvedValue(...)`, to prime
`getSharedCurriculumPackBySlug` instead with the same object. Then append this
test inside the existing `describe('final-boss route', ...)`:

```tsx
  it('looks the map up in curriculum_packs, not collection_packs', async () => {
    isMapFullyCleared.mockResolvedValue(true);
    await FinalBossPage({
      params: Promise.resolve({ childId: 'c1', packSlug: 'pirate-class-level-1' }),
    });
    // Regression guard: `pirate-class-level-1` has no row in collection_packs,
    // so resolving it there returned null and the route 404'd in production.
    expect(getSharedCurriculumPackBySlug).toHaveBeenCalledWith('pirate-class-level-1');
  });
```

- [ ] **Step 7: Run the full suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. Any other suite mocking `@/lib/db/collections` for the
final-boss action will now need `@/lib/db/curriculum` mocked instead — grep with
`grep -rln "actions/final-boss" tests/` and fix each.

- [ ] **Step 8: Commit, push, PR**

```bash
git checkout main && git pull && git checkout -b fix/final-boss-pack-lookup
git add src/lib/db/curriculum.ts src/lib/actions/final-boss.ts \
        "src/app/play/[childId]/final-boss/[packSlug]/page.tsx" \
        tests/unit/curriculum-pack-lookup.test.ts tests/unit/app/final-boss-route.test.tsx
git commit -m "fix(final-boss): resolve the map slug in curriculum_packs, not collection_packs

The 👑 lair node linked to a route that looked `pirate-class-level-1` up in
collection_packs (the *-v1 collectible packs) — a different slug namespace with
no such row. The lookup returned null, so the route 404'd and
finishFinalBossAction threw 'Map not found'. Verified against prod:
final_boss_clears has 0 rows and no collection_packs slug matches 'pirate%'.

The route test had mocked getPackBySlug to resolve a fake pack with the
curriculum slug, asserting the exact thing that was false in reality."
git push -u origin fix/final-boss-pack-lookup
gh pr create --title "fix(final-boss): map slug lookup hit the wrong table — final boss was 404" --body "$(cat <<'EOF'
The 👑 lair node links to `/play/<id>/final-boss/pirate-class-level-1`. That
route — and `finishFinalBossAction` — resolved the slug with `getPackBySlug`
from `@/lib/db/collections`, which queries **`collection_packs`**. The slug is a
**`curriculum_packs`** slug. Two disjoint namespaces.

Verified against production 2026-08-21:

```
collection_packs slugs matching 'pirate%': NONE
curriculum_packs: pirate-class-level-1 | pirate-class-level-2 | school-custom | school-custom
final_boss_clears rows: 0
```

So the lookup returned null, the route 404'd, and the action threw
'Map not found'. The Caribbean final boss has never been beatable. PR #151 fixed
the gating that kept the lair node from appearing; this is the layer underneath.

**Fix:** a new `getSharedCurriculumPackBySlug(slug)` in `@/lib/db/curriculum`,
restricted to `owner_user_id IS NULL` because `curriculum_packs.slug` is not
unique (`school-custom` has one row per family). Both callers swapped over.

**Why no test caught it:** `tests/unit/app/final-boss-route.test.tsx` mocked
`getPackBySlug` to resolve a fake pack whose slug was `'pirate-class-level-1'` —
asserting the exact thing that was false in reality. The mock is replaced and a
regression test pins the lookup to the right module.

## Verify after deploy

Visit `/play/<childId>/final-boss/pirate-class-level-1` while the map is
incomplete: the correct behaviour is now a **redirect to `/maps`**. A 404 means
the fix did not take.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_013EsxqpdcngBeh1pNDvZQWz
EOF
)"
```

Report to David; **do not merge without his go-ahead.**

- [ ] **Step 9: Verify in prod after merge**

Once deployed, confirm `/play/<childId>/final-boss/pirate-class-level-1` renders
the gauntlet instead of a 404. Neither child can reach it through the UI yet
(the lair node needs all 10 weeks cleared; 小板 is at 8/10), so check it by
visiting the URL directly while the map is incomplete — the correct behaviour is
now a **redirect to `/maps`**, not a 404. A 404 means the fix did not take.

---

## PR B proper

Everything below is one PR on branch `feat/collection-packs-v2` (which already
holds the spec and, if PR A shipped from it, the olympics work; if PR A was
merged first, branch fresh from `main`).

---

### Task 1: Pure unlock config

**Files:**
- Create: `src/lib/collections/packUnlocks.ts`
- Test: `tests/unit/pack-unlocks.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PACK_UNLOCK_REQUIREMENTS: Record<string, string>` — collectible pack slug → curriculum pack slug
  - `isGatedPack(packSlug: string): boolean`
  - `lockedPackSlugsFrom(beatenCurriculumSlugs: ReadonlySet<string>): string[]`
  - `unlockedByClearing(curriculumSlug: string): string[]`

This module must stay **pure and client-safe** — no `@/db` import, no
`@/lib/db/*` import. `FinalBossRunner` (a `'use client'` component) imports it in
Task 9; a postgres import would pull `fs`/`net`/`tls` into the client bundle.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pack-unlocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PACK_UNLOCK_REQUIREMENTS,
  isGatedPack,
  lockedPackSlugsFrom,
  unlockedByClearing,
} from '@/lib/collections/packUnlocks';

describe('pack unlock config', () => {
  it('gates exactly the two Map-1 packs', () => {
    expect(Object.keys(PACK_UNLOCK_REQUIREMENTS).sort()).toEqual([
      'hello-kitty-v1',
      'paw-patrol-v1',
    ]);
    expect(PACK_UNLOCK_REQUIREMENTS['hello-kitty-v1']).toBe('pirate-class-level-1');
    expect(PACK_UNLOCK_REQUIREMENTS['paw-patrol-v1']).toBe('pirate-class-level-1');
  });

  it('isGatedPack is true only for gated packs', () => {
    expect(isGatedPack('hello-kitty-v1')).toBe(true);
    expect(isGatedPack('paw-patrol-v1')).toBe(true);
    expect(isGatedPack('zodiac-v1')).toBe(false);
    expect(isGatedPack('olympics-v1')).toBe(false);
  });
});

describe('lockedPackSlugsFrom', () => {
  it('locks both packs when no map is beaten', () => {
    expect(lockedPackSlugsFrom(new Set()).sort()).toEqual([
      'hello-kitty-v1',
      'paw-patrol-v1',
    ]);
  });

  it('unlocks both once Map 1 is beaten', () => {
    expect(lockedPackSlugsFrom(new Set(['pirate-class-level-1']))).toEqual([]);
  });

  it('still locks both when only an unrelated map is beaten', () => {
    expect(lockedPackSlugsFrom(new Set(['pirate-class-level-2'])).sort()).toEqual([
      'hello-kitty-v1',
      'paw-patrol-v1',
    ]);
  });

  it('never returns an ungated pack', () => {
    for (const slug of lockedPackSlugsFrom(new Set())) {
      expect(isGatedPack(slug)).toBe(true);
    }
  });
});

describe('unlockedByClearing', () => {
  it('names the packs a given map clear opens', () => {
    expect(unlockedByClearing('pirate-class-level-1').sort()).toEqual([
      'hello-kitty-v1',
      'paw-patrol-v1',
    ]);
  });

  it('returns empty for a map that gates nothing', () => {
    expect(unlockedByClearing('pirate-class-level-2')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/pack-unlocks.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/collections/packUnlocks"`.

- [ ] **Step 3: Write the module**

Create `src/lib/collections/packUnlocks.ts`:

```ts
/**
 * Per-child collectible-pack gating (packs-v2, 2026-08-21).
 *
 * PURE + CLIENT-SAFE by contract: no `@/db`, no `@/lib/db/*` imports. Client
 * components (FinalBossRunner) import this directly; a postgres import would
 * drag `fs`/`net`/`tls` into the client bundle.
 *
 * The source of truth for "this child beat this map" is `final_boss_clears`
 * (the same row that gates the next map and guards the champion rewards). There
 * is deliberately NO stored "unlocked packs" table: a stored set drifts from
 * progress, exactly as a stored 🗝️ key count would have.
 */

/** Collectible pack slug → curriculum pack slug whose FINAL BOSS unlocks it. */
export const PACK_UNLOCK_REQUIREMENTS: Record<string, string> = {
  'hello-kitty-v1': 'pirate-class-level-1',
  'paw-patrol-v1': 'pirate-class-level-1',
};

/** Whether this pack is hidden until some map is beaten. */
export function isGatedPack(packSlug: string): boolean {
  return packSlug in PACK_UNLOCK_REQUIREMENTS;
}

/** Gated packs still locked, given the maps this child has finished. */
export function lockedPackSlugsFrom(
  beatenCurriculumSlugs: ReadonlySet<string>,
): string[] {
  return Object.entries(PACK_UNLOCK_REQUIREMENTS)
    .filter(([, required]) => !beatenCurriculumSlugs.has(required))
    .map(([packSlug]) => packSlug);
}

/** Packs that beating this one map opens (for the victory announcement). */
export function unlockedByClearing(curriculumSlug: string): string[] {
  return Object.entries(PACK_UNLOCK_REQUIREMENTS)
    .filter(([, required]) => required === curriculumSlug)
    .map(([packSlug]) => packSlug);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/pack-unlocks.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/packUnlocks.ts tests/unit/pack-unlocks.test.ts
git commit -m "feat(packs): pure per-child pack-unlock config"
```

---

### Task 2: Server-side locked-pack query

**Files:**
- Create: `src/lib/db/pack-unlocks.ts`
- Test: `tests/unit/pack-unlocks-db.test.ts`

**Interfaces:**
- Consumes: `lockedPackSlugsFrom` from Task 1.
- Produces: `listLockedPackSlugs(childId: string, tx?: DbLike): Promise<string[]>`, where `DbLike = typeof db | Tx`.

The `tx` parameter exists so Tasks 7 and 8 can call it **inside** their
transaction. Default it to `db` so the page-level callers (Task 6) stay simple.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pack-unlocks-db.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as { slug: string }[],
  selectCalls: 0,
}));

const chain = () => ({
  from: () => ({
    innerJoin: () => ({
      where: async () => mocks.rows,
    }),
  }),
});

vi.mock('@/db', () => ({
  db: {
    select: () => {
      mocks.selectCalls += 1;
      return chain();
    },
  },
}));

import { listLockedPackSlugs } from '@/lib/db/pack-unlocks';

beforeEach(() => {
  mocks.rows = [];
  mocks.selectCalls = 0;
});

describe('listLockedPackSlugs', () => {
  it('locks both gated packs for a child with no final-boss clears', async () => {
    mocks.rows = [];
    expect((await listLockedPackSlugs('c1')).sort()).toEqual([
      'hello-kitty-v1',
      'paw-patrol-v1',
    ]);
  });

  it('unlocks both once the Map 1 clear row exists', async () => {
    mocks.rows = [{ slug: 'pirate-class-level-1' }];
    expect(await listLockedPackSlugs('c1')).toEqual([]);
  });

  it('ignores clears of maps that gate nothing', async () => {
    mocks.rows = [{ slug: 'pirate-class-level-2' }];
    expect((await listLockedPackSlugs('c1')).sort()).toEqual([
      'hello-kitty-v1',
      'paw-patrol-v1',
    ]);
  });

  it('runs its query on the supplied tx instead of the module db', async () => {
    mocks.rows = [];
    let txSelects = 0;
    const tx = {
      select: () => {
        txSelects += 1;
        return chain();
      },
    } as unknown as Parameters<typeof listLockedPackSlugs>[1];
    await listLockedPackSlugs('c1', tx);
    expect(txSelects).toBe(1);
    expect(mocks.selectCalls).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/pack-unlocks-db.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/db/pack-unlocks"`.

- [ ] **Step 3: Write the module**

Create `src/lib/db/pack-unlocks.ts`:

```ts
// NEVER import this file from client code — it pulls in postgres.
// The pure half lives in `@/lib/collections/packUnlocks` and IS client-safe.
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { curriculumPacks, finalBossClears } from '@/db/schema';
import { lockedPackSlugsFrom } from '@/lib/collections/packUnlocks';

type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Collectible packs this child cannot see or receive yet.
 *
 * Derived on every call from `final_boss_clears` — never stored. Pass `tx` to
 * run inside an open transaction (the gacha + gift paths do; see grants.ts).
 */
export async function listLockedPackSlugs(
  childId: string,
  tx: DbLike = db,
): Promise<string[]> {
  const rows = await tx
    .select({ slug: curriculumPacks.slug })
    .from(finalBossClears)
    .innerJoin(curriculumPacks, eq(curriculumPacks.id, finalBossClears.packId))
    .where(eq(finalBossClears.childId, childId));
  return lockedPackSlugsFrom(new Set(rows.map((r) => r.slug)));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/pack-unlocks-db.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/pack-unlocks.ts tests/unit/pack-unlocks-db.test.ts
git commit -m "feat(packs): listLockedPackSlugs derived from final_boss_clears"
```

---

### Task 3: Data files for the two gated packs

**Files:**
- Create: `src/lib/collections/helloKittyData.ts`
- Create: `src/lib/collections/pawPatrolData.ts`
- Test: `tests/unit/unlockable-packs-data.test.ts`

**Interfaces:**
- Produces:
  - `HelloKittyItem` / `HELLO_KITTY: HelloKittyItem[]` (16) / `HELLO_KITTY_BY_SLUG`
  - `PawPatrolItem` / `PAW_PATROL: PawPatrolItem[]` (12) / `PAW_PATROL_BY_SLUG`

Both are flat (no grouping), same shape as `minibeastsData.ts`. Chinese names are
the **mainland dub**, confirmed by David 2026-08-21 — do not substitute regional
variants (玉桂狗, 青蛙王子).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/unlockable-packs-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HELLO_KITTY, HELLO_KITTY_BY_SLUG } from '@/lib/collections/helloKittyData';
import { PAW_PATROL, PAW_PATROL_BY_SLUG } from '@/lib/collections/pawPatrolData';

describe('hello kitty data', () => {
  it('has 16 bilingual items with emoji + lore + unique slugs', () => {
    expect(HELLO_KITTY).toHaveLength(16);
    const slugs = new Set<string>();
    for (const i of HELLO_KITTY) {
      expect(i.nameZh && i.nameEn && i.emoji && i.loreZh && i.loreEn, i.slug).toBeTruthy();
      expect(slugs.has(i.slug), i.slug).toBe(false);
      slugs.add(i.slug);
    }
    expect(HELLO_KITTY_BY_SLUG['kuromi']?.nameZh).toBe('库洛米');
  });
});

describe('paw patrol data', () => {
  it('has 12 bilingual items with emoji + lore + unique slugs', () => {
    expect(PAW_PATROL).toHaveLength(12);
    const slugs = new Set<string>();
    for (const i of PAW_PATROL) {
      expect(i.nameZh && i.nameEn && i.emoji && i.loreZh && i.loreEn, i.slug).toBeTruthy();
      expect(slugs.has(i.slug), i.slug).toBe(false);
      slugs.add(i.slug);
    }
    expect(PAW_PATROL_BY_SLUG['chase']?.nameZh).toBe('阿奇');
    expect(PAW_PATROL_BY_SLUG['marshall']?.nameZh).toBe('毛毛');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/unlockable-packs-data.test.ts`
Expected: FAIL — both imports unresolved.

- [ ] **Step 3: Write `helloKittyData.ts`**

```ts
/** 凯蒂猫与朋友 / Hello Kitty & Friends collectible pack (`hello-kitty-v1`).
 *  Flat. GATED — see `packUnlocks.ts`: hidden until Map 1's final boss falls.
 *  Chinese names are the mainland dub (David, 2026-08-21). */
export interface HelloKittyItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const HELLO_KITTY: HelloKittyItem[] = [
  { slug: 'hello-kitty', nameZh: '凯蒂猫', nameEn: 'Hello Kitty', emoji: '🎀', loreZh: '头上永远戴着红蝴蝶结的小白猫。', loreEn: 'The little white cat with the red bow.' },
  { slug: 'mimmy', nameZh: '咪咪', nameEn: 'Mimmy', emoji: '💛', loreZh: '凯蒂猫的双胞胎妹妹，蝴蝶结在右边。', loreEn: "Hello Kitty's twin — her bow sits on the right." },
  { slug: 'dear-daniel', nameZh: '丹尼尔', nameEn: 'Dear Daniel', emoji: '🧢', loreZh: '凯蒂猫最好的朋友。', loreEn: "Hello Kitty's dearest friend." },
  { slug: 'my-melody', nameZh: '美乐蒂', nameEn: 'My Melody', emoji: '🌸', loreZh: '戴粉色兜帽的小白兔。', loreEn: 'A little white rabbit in a pink hood.' },
  { slug: 'kuromi', nameZh: '库洛米', nameEn: 'Kuromi', emoji: '💜', loreZh: '戴黑帽子的小恶魔，其实很善良。', loreEn: 'A black-hooded imp with a kind heart.' },
  { slug: 'cinnamoroll', nameZh: '大耳狗', nameEn: 'Cinnamoroll', emoji: '☁️', loreZh: '耳朵大得能飞起来。', loreEn: 'Ears so big he can fly.' },
  { slug: 'pompompurin', nameZh: '布丁狗', nameEn: 'Pompompurin', emoji: '🍮', loreZh: '戴贝雷帽的黄色小狗，最爱布丁。', loreEn: 'A golden pup in a beret who loves pudding.' },
  { slug: 'pochacco', nameZh: '帕恰狗', nameEn: 'Pochacco', emoji: '⚽', loreZh: '爱运动的黑白小狗。', loreEn: 'A sporty black-and-white puppy.' },
  { slug: 'chococat', nameZh: '巧克力猫', nameEn: 'Chococat', emoji: '🐈‍⬛', loreZh: '全身黑黑的，消息最灵通。', loreEn: 'All black — and always first with the news.' },
  { slug: 'gudetama', nameZh: '蛋黄哥', nameEn: 'Gudetama', emoji: '🥚', loreZh: '懒洋洋的蛋黄，什么都不想做。', loreEn: "A lazy egg yolk who'd rather not." },
  { slug: 'little-twin-stars', nameZh: '双子星', nameEn: 'Little Twin Stars', emoji: '⭐', loreZh: '从星星上来的一对兄妹。', loreEn: 'A brother and sister from the stars.' },
  { slug: 'keroppi', nameZh: '大眼蛙', nameEn: 'Keroppi', emoji: '🐸', loreZh: '住在池塘边的绿青蛙。', loreEn: 'A green frog who lives by the pond.' },
  { slug: 'badtz-maru', nameZh: '酷企鹅', nameEn: 'Badtz-Maru', emoji: '🐧', loreZh: '一撮尖头发的黑企鹅。', loreEn: 'A black penguin with a spiky tuft.' },
  { slug: 'tuxedo-sam', nameZh: '山姆企鹅', nameEn: 'Tuxedo Sam', emoji: '🎩', loreZh: '打领结、戴帽子的绅士企鹅。', loreEn: 'A gentleman penguin in a bow tie.' },
  { slug: 'hangyodon', nameZh: '人鱼汉顿', nameEn: 'Hangyodon', emoji: '🐟', loreZh: '想当英雄的鱼人。', loreEn: 'A fish-man who dreams of being a hero.' },
  { slug: 'charmmy-kitty', nameZh: '查米凯蒂', nameEn: 'Charmmy Kitty', emoji: '🐱', loreZh: '凯蒂猫养的小白猫，脖子上挂着钥匙。', loreEn: "Hello Kitty's own pet cat, with a key on her collar." },
];

export const HELLO_KITTY_BY_SLUG: Record<string, HelloKittyItem> = Object.fromEntries(
  HELLO_KITTY.map((i) => [i.slug, i]),
);
```

- [ ] **Step 4: Write `pawPatrolData.ts`**

```ts
/** 汪汪队立大功 / Paw Patrol collectible pack (`paw-patrol-v1`). Flat.
 *  GATED — see `packUnlocks.ts`: hidden until Map 1's final boss falls.
 *  Chinese names are the mainland dub (David, 2026-08-21). */
export interface PawPatrolItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const PAW_PATROL: PawPatrolItem[] = [
  { slug: 'ryder', nameZh: '莱德', nameEn: 'Ryder', emoji: '🧑‍✈️', loreZh: '汪汪队的小队长。', loreEn: 'The boy who leads the pups.' },
  { slug: 'chase', nameZh: '阿奇', nameEn: 'Chase', emoji: '🚓', loreZh: '德牧警犬，最爱喊"汪汪队，出动！"', loreEn: 'The police pup — "Paw Patrol, ready for action!"' },
  { slug: 'marshall', nameZh: '毛毛', nameEn: 'Marshall', emoji: '🚒', loreZh: '斑点狗消防员，有点冒失。', loreEn: 'The clumsy Dalmatian firefighter.' },
  { slug: 'skye', nameZh: '天天', nameEn: 'Skye', emoji: '🚁', loreZh: '开直升机的可卡犬。', loreEn: 'The cockapoo who flies the helicopter.' },
  { slug: 'rubble', nameZh: '小砾', nameEn: 'Rubble', emoji: '🚜', loreZh: '开推土机的斗牛犬。', loreEn: 'The bulldog with the bulldozer.' },
  { slug: 'rocky', nameZh: '灰灰', nameEn: 'Rocky', emoji: '♻️', loreZh: '什么都能修好的回收犬。', loreEn: 'The recycling pup who can fix anything.' },
  { slug: 'zuma', nameZh: '路马', nameEn: 'Zuma', emoji: '🛥️', loreZh: '水上救援的拉布拉多。', loreEn: 'The water-rescue Labrador.' },
  { slug: 'everest', nameZh: '珠珠', nameEn: 'Everest', emoji: '🏔️', loreZh: '雪山上的哈士奇。', loreEn: 'The husky of the snowy mountains.' },
  { slug: 'tracker', nameZh: '追风', nameEn: 'Tracker', emoji: '🌴', loreZh: '丛林里耳朵最灵的吉娃娃。', loreEn: 'The jungle chihuahua with the sharpest ears.' },
  { slug: 'liberty', nameZh: '莉波提', nameEn: 'Liberty', emoji: '🛴', loreZh: '大都市来的腊肠犬。', loreEn: 'The dachshund from the big city.' },
  { slug: 'lookout-tower', nameZh: '瞭望塔', nameEn: 'The Lookout', emoji: '🗼', loreZh: '汪汪队的家，站得高看得远。', loreEn: "The pups' home — tall enough to see everything." },
  { slug: 'paw-patroller', nameZh: '巡逻车', nameEn: 'Paw Patroller', emoji: '🚚', loreZh: '装得下全队的大卡车。', loreEn: 'The big rig that carries the whole team.' },
];

export const PAW_PATROL_BY_SLUG: Record<string, PawPatrolItem> = Object.fromEntries(
  PAW_PATROL.map((i) => [i.slug, i]),
);
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/unlockable-packs-data.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/collections/helloKittyData.ts src/lib/collections/pawPatrolData.ts tests/unit/unlockable-packs-data.test.ts
git commit -m "feat(packs): hello-kitty-v1 (16) + paw-patrol-v1 (12) data"
```

---

### Task 4: Card components + registry entries

**Files:**
- Create: `src/components/play/items/HelloKittyCard.tsx`
- Create: `src/components/play/items/PawPatrolCard.tsx`
- Modify: `src/lib/collections/packRegistry.ts`
- Test: `tests/unit/pack-registry.test.ts`

**Interfaces:**
- Consumes: `HELLO_KITTY_BY_SLUG`, `PAW_PATROL_BY_SLUG` from Task 3.
- Produces: `getPackMeta('hello-kitty-v1')` and `getPackMeta('paw-patrol-v1')` returning `PackUiMeta` with no `grouping`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/pack-registry.test.ts`:

```ts
describe('gated pack registry entries', () => {
  it.each(['hello-kitty-v1', 'paw-patrol-v1'])(
    '%s has bilingual names + an ItemCard + reveal emoji, and is flat',
    (slug) => {
      const meta = getPackMeta(slug);
      expect(meta).toBeTruthy();
      expect(meta!.displayNameZh && meta!.displayNameEn).toBeTruthy();
      expect(meta!.sloganZh && meta!.sloganEn).toBeTruthy();
      expect(meta!.ItemCard).toBeTypeOf('function');
      expect(meta!.resolveRevealEmoji).toBeTypeOf('function');
      expect(meta!.grouping).toBeUndefined();
    },
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/pack-registry.test.ts`
Expected: FAIL — `getPackMeta` returns `null` for both slugs.

- [ ] **Step 3: Write the card components**

`src/components/play/items/HelloKittyCard.tsx`:

```tsx
import { makeVocabCard } from './VocabCard';
import { HELLO_KITTY_BY_SLUG } from '@/lib/collections/helloKittyData';
export const HelloKittyCard = makeVocabCard({ bySlug: HELLO_KITTY_BY_SLUG, fallbackEmoji: '🎀', testId: 'hello-kitty-card' });
```

`src/components/play/items/PawPatrolCard.tsx`:

```tsx
import { makeVocabCard } from './VocabCard';
import { PAW_PATROL_BY_SLUG } from '@/lib/collections/pawPatrolData';
export const PawPatrolCard = makeVocabCard({ bySlug: PAW_PATROL_BY_SLUG, fallbackEmoji: '🐾', testId: 'paw-patrol-card' });
```

- [ ] **Step 4: Add the registry entries**

Imports in `src/lib/collections/packRegistry.ts`:

```ts
import { HelloKittyCard } from '@/components/play/items/HelloKittyCard';
import { PawPatrolCard } from '@/components/play/items/PawPatrolCard';
import { HELLO_KITTY_BY_SLUG } from '@/lib/collections/helloKittyData';
import { PAW_PATROL_BY_SLUG } from '@/lib/collections/pawPatrolData';
```

Entries appended to `PACK_REGISTRY`:

```ts
  'hello-kitty-v1': {
    displayNameZh: '凯蒂猫与朋友',
    displayNameEn: 'Hello Kitty & Friends',
    sloganZh: '打通加勒比海之后解锁的收藏。',
    sloganEn: 'Unlocked by conquering the Caribbean.',
    themeEmoji: '🎀',
    themeBannerClass: 'bg-gradient-to-br from-pink-200 via-rose-300 to-fuchsia-400',
    themeAccentClass: 'text-rose-900',
    gridColumns: 3,
    ItemCard: HelloKittyCard,
    resolveRevealEmoji: (slug) => HELLO_KITTY_BY_SLUG[slug]?.emoji ?? null,
  },
  'paw-patrol-v1': {
    displayNameZh: '汪汪队立大功',
    displayNameEn: 'Paw Patrol',
    sloganZh: '打通加勒比海之后解锁的收藏。',
    sloganEn: 'Unlocked by conquering the Caribbean.',
    themeEmoji: '🐾',
    themeBannerClass: 'bg-gradient-to-br from-sky-200 via-red-200 to-blue-400',
    themeAccentClass: 'text-blue-900',
    gridColumns: 3,
    ItemCard: PawPatrolCard,
    resolveRevealEmoji: (slug) => PAW_PATROL_BY_SLUG[slug]?.emoji ?? null,
  },
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/pack-registry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/items/HelloKittyCard.tsx src/components/play/items/PawPatrolCard.tsx src/lib/collections/packRegistry.ts tests/unit/pack-registry.test.ts
git commit -m "feat(packs): HelloKittyCard + PawPatrolCard + registry entries"
```

---

### Task 5: Seed script

**Files:**
- Create: `scripts/seed-unlockable-packs.ts`

No unit test — seed scripts are ops code and the repo does not unit-test them
(`seed-vocab-packs.ts`, `seed-landmarks-pack.ts`, … all have none). Verification
is `verify-integrity.ts` after the prod run.

- [ ] **Step 1: Write the script**

Create `scripts/seed-unlockable-packs.ts`:

```ts
/**
 * Seed the two Map-1-gated packs (hello-kitty-v1 / paw-patrol-v1).
 *
 * Both are seeded is_active=true, gacha_eligible=true: the gate is PER-CHILD and
 * lives in application code (`src/lib/collections/packUnlocks.ts` +
 * `src/lib/db/pack-unlocks.ts`), not in these columns. `is_active` stays a
 * global kill switch — flipping it false hides both packs for everyone with no
 * code change.
 *
 * Idempotent: upserts each pack by slug and inserts only missing items. Emoji is
 * stored verbatim in image_url as the CardArt text fallback (overwritten later
 * by the CF art generator).
 *
 * Usage: pnpm tsx scripts/seed-unlockable-packs.ts
 * CAUTION: shared DATABASE_URL on Neon — confirm the target before running.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

interface SeedItem { slug: string; nameZh: string; nameEn: string; emoji: string; loreZh: string; loreEn: string; }
interface SeedPack { slug: string; name: string; description: string; themeColor: string; items: SeedItem[]; }

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');

  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { HELLO_KITTY } = await import('../src/lib/collections/helloKittyData');
  const { PAW_PATROL } = await import('../src/lib/collections/pawPatrolData');

  const packs: SeedPack[] = [
    { slug: 'hello-kitty-v1', name: '凯蒂猫与朋友', description: 'Hello Kitty and her Sanrio friends.', themeColor: '#e8548b', items: HELLO_KITTY },
    { slug: 'paw-patrol-v1', name: '汪汪队立大功', description: 'The rescue pups of Adventure Bay.', themeColor: '#2f6fd0', items: PAW_PATROL },
  ];

  for (const p of packs) {
    const [inserted] = await db
      .insert(collectionPacks)
      .values({ slug: p.slug, name: p.name, description: p.description, themeColor: p.themeColor, isActive: true, gachaEligible: true })
      .onConflictDoNothing()
      .returning();
    const packRow = inserted ?? (await db.select().from(collectionPacks).where(eq(collectionPacks.slug, p.slug)).limit(1))[0];
    if (!packRow) throw new Error(`Failed to upsert pack ${p.slug}`);

    const existing = await db.select({ slug: collectibleItems.slug }).from(collectibleItems).where(eq(collectibleItems.packId, packRow.id));
    const existingSlugs = new Set(existing.map((e) => e.slug));
    const toInsert = p.items.filter((i) => !existingSlugs.has(i.slug));
    if (toInsert.length > 0) {
      await db.insert(collectibleItems).values(
        toInsert.map((i) => ({
          packId: packRow.id,
          slug: i.slug,
          nameZh: i.nameZh,
          nameEn: i.nameEn,
          loreZh: i.loreZh,
          loreEn: i.loreEn,
          imageUrl: i.emoji,
        })),
      );
    }
    console.log(`seeded ${p.slug}: ${p.items.length} items, ${toInsert.length} new`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

Note the dynamic `await import` calls inside `main()` — mandatory for any script
touching `process.env.DATABASE_URL` so `loadEnv()` runs before the db client is
constructed. Do not hoist them.

- [ ] **Step 2: Verify it typechecks and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-unlockable-packs.ts
git commit -m "feat(packs): seed script for the two gated packs"
```

---

### Task 6: Gate the Backpack list + the per-pack route

**Files:**
- Modify: `src/app/play/[childId]/collection/page.tsx`
- Modify: `src/app/play/[childId]/collection/[packSlug]/page.tsx`
- Test: `tests/unit/app/collection-gating.test.tsx` (new)

**Interfaces:**
- Consumes: `listLockedPackSlugs` from Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app/collection-gating.test.tsx`. It follows the mocking shape
of `tests/unit/app/final-boss-route.test.tsx` — read that file first.

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async () => ({ parent: { id: 'p' }, child: { id: 'c1' } })),
}));
const notFound = vi.fn(() => {
  throw new Error('notFound');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const listLockedPackSlugs = vi.fn<(...a: unknown[]) => Promise<string[]>>(async () => []);
vi.mock('@/lib/db/pack-unlocks', () => ({
  listLockedPackSlugs: (...a: unknown[]) => listLockedPackSlugs(...a),
}));

vi.mock('@/lib/db/collections', () => ({
  listActivePacks: vi.fn(async () => [
    { id: 'p-zod', slug: 'zodiac-v1' },
    { id: 'p-hk', slug: 'hello-kitty-v1' },
    { id: 'p-pp', slug: 'paw-patrol-v1' },
  ]),
  listChildCollection: vi.fn(async () => []),
  listPackItems: vi.fn(async () => [{ id: 'i1' }]),
  getPackBySlug: vi.fn(async (slug: string) => ({ id: `p-${slug}`, slug })),
}));
vi.mock('@/lib/db/trophies', () => ({
  listAllTrophies: vi.fn(async () => []),
  listEarnedTrophies: vi.fn(async () => []),
}));
vi.mock('@/lib/db/recent-obtained', () => ({
  getRecentlyObtainedForChild: vi.fn(async () => []),
}));
vi.mock('@/lib/db/grants', () => ({ getGlobalShards: vi.fn(async () => 0) }));
vi.mock('@/lib/db/coins', () => ({ getCoinBalance: vi.fn(async () => ({ balance: 0 })) }));

const hallSlugs: string[][] = [];
vi.mock('@/components/play/AtlasHub', () => ({
  AtlasHub: ({ halls }: { halls: { packSlug: string }[] }) => {
    hallSlugs.push(halls.map((h) => h.packSlug));
    return <div data-testid="atlas-hub" />;
  },
}));
vi.mock('@/components/play/TrophiesHallCard', () => ({ TrophiesHallCard: () => <div /> }));
vi.mock('@/components/play/PackPageBody', () => ({ PackPageBody: () => <div data-testid="pack-body" /> }));

import CollectionAtlasPage from '@/app/play/[childId]/collection/page';
import PackPage from '@/app/play/[childId]/collection/[packSlug]/page';

beforeEach(() => {
  vi.clearAllMocks();
  hallSlugs.length = 0;
  listLockedPackSlugs.mockResolvedValue([]);
});

describe('Backpack list gating', () => {
  it('hides locked packs from the hall list', async () => {
    listLockedPackSlugs.mockResolvedValue(['hello-kitty-v1', 'paw-patrol-v1']);
    await CollectionAtlasPage({ params: Promise.resolve({ childId: 'c1' }) });
    expect(hallSlugs[0]).toEqual(['zodiac-v1']);
  });

  it('shows them once the map is beaten', async () => {
    listLockedPackSlugs.mockResolvedValue([]);
    await CollectionAtlasPage({ params: Promise.resolve({ childId: 'c1' }) });
    expect(hallSlugs[0]).toEqual(['zodiac-v1', 'hello-kitty-v1', 'paw-patrol-v1']);
  });
});

describe('per-pack route gating', () => {
  it('404s a locked pack even when the URL is typed directly', async () => {
    listLockedPackSlugs.mockResolvedValue(['hello-kitty-v1', 'paw-patrol-v1']);
    await expect(
      PackPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'hello-kitty-v1' }) }),
    ).rejects.toThrow('notFound');
    expect(notFound).toHaveBeenCalled();
  });

  it('renders an unlocked pack', async () => {
    listLockedPackSlugs.mockResolvedValue([]);
    await PackPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'hello-kitty-v1' }) });
    expect(notFound).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/app/collection-gating.test.tsx`
Expected: FAIL — the hall list still contains all three packs, and the locked
pack page renders instead of calling `notFound`.

- [ ] **Step 3: Gate the Backpack list**

In `src/app/play/[childId]/collection/page.tsx`, add the import:

```ts
import { listLockedPackSlugs } from '@/lib/db/pack-unlocks';
```

Add `listLockedPackSlugs(childId)` to the existing `Promise.all` destructure:

```ts
  const [packs, allTrophies, earnedTrophies, recentItems, shards, lockedSlugs] =
    await Promise.all([
      listActivePacks(),
      listAllTrophies(),
      listEarnedTrophies(childId),
      getRecentlyObtainedForChild(childId, 3),
      getGlobalShards(childId),
      listLockedPackSlugs(childId),
    ]);
  const locked = new Set(lockedSlugs);
```

and add the filter as the first line of the `packs.map` callback body, right
above the existing `const meta = getPackMeta(pack.slug);`:

```ts
        // Gated packs (packUnlocks.ts) stay invisible until their map falls.
        if (locked.has(pack.slug)) return null;
```

The existing `.filter((h): h is AtlasHallSummary => h !== null)` already drops
the nulls — no other change is needed.

- [ ] **Step 4: Gate the per-pack route**

In `src/app/play/[childId]/collection/[packSlug]/page.tsx`, add the import:

```ts
import { listLockedPackSlugs } from '@/lib/db/pack-unlocks';
```

and insert this immediately after `await requireChild(childId);`:

```ts
  // A gated pack must 404 on a typed URL too, not just be hidden in the list.
  const locked = await listLockedPackSlugs(childId);
  if (locked.includes(packSlug)) notFound();
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/app/collection-gating.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Gate the STUDY route — it is a separate route, not a sub-page**

`/collection/[packSlug]/study` has its own `page.tsx` with its own
`getPackBySlug`. Step 4's guard does **not** cover it, and a typed URL reaches it.

In `src/app/play/[childId]/collection/[packSlug]/study/page.tsx`, add the import:

```ts
import { listLockedPackSlugs } from '@/lib/db/pack-unlocks';
```

and insert immediately after `await requireChild(childId);`:

```ts
  // Study is its OWN route — the pack page's guard does not cover it.
  const locked = await listLockedPackSlugs(childId);
  if (locked.includes(packSlug)) notFound();
```

Then append this test to the `per-pack route gating` describe in
`tests/unit/app/collection-gating.test.tsx`, adding the two mocks it needs at the
top of the file next to the others:

```tsx
vi.mock('@/lib/play/study', () => ({
  buildStudyLesson: vi.fn(() => []),
  STUDY_MIN_OWNED: 3,
}));
vi.mock('@/components/play/StudyRunner', () => ({ StudyRunner: () => <div /> }));
```

```tsx
  it('404s the study route for a locked pack', async () => {
    listLockedPackSlugs.mockResolvedValue(['hello-kitty-v1', 'paw-patrol-v1']);
    const StudyPage = (await import('@/app/play/[childId]/collection/[packSlug]/study/page')).default;
    await expect(
      StudyPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'hello-kitty-v1' }) }),
    ).rejects.toThrow('notFound');
  });
```

Run: `pnpm vitest run tests/unit/app/collection-gating.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Gate `finishStudyAction`**

`finishStudyAction` is an exported `'use server'` function that grants a
pack-scoped card. Without this, a locked-pack finish reaches `pullCardInTx` with
a catalog that Task 7 has just emptied, and `weightedRandomPick` **throws** on a
zero-weight catalog. The tx rolls back so nothing is granted, but a thrown action
is the wrong shape for an expected case — fold it into the existing `eligible`
boolean instead, exactly as the `pack.gachaEligible` check beside it does.

In `src/lib/actions/study.ts`, add the import:

```ts
import { listLockedPackSlugs } from '@/lib/db/pack-unlocks';
```

and change line ~57 from:

```ts
  const eligible = parsed.score >= STUDY_PASS_SCORE && owned.length >= STUDY_MIN_OWNED && pack.gachaEligible;
```

to:

```ts
  const lockedPacks = await listLockedPackSlugs(child.id);
  const eligible =
    parsed.score >= STUDY_PASS_SCORE &&
    owned.length >= STUDY_MIN_OWNED &&
    pack.gachaEligible &&
    !lockedPacks.includes(parsed.packSlug);
```

Read the surrounding lines first to confirm the child id variable's real name
(`child.id` vs `childId`) and match it.

Add to `tests/unit/grants-study-source.test.ts` (or whichever suite covers
`finishStudyAction` — `grep -rln "finishStudyAction" tests/`) a
`vi.mock('@/lib/db/pack-unlocks', () => ({ listLockedPackSlugs: vi.fn(async () => []) }))`,
plus one test setting it to `['hello-kitty-v1']` and asserting no card is granted
for that pack.

- [ ] **Step 8: Commit**

```bash
git add "src/app/play/[childId]/collection/page.tsx" \
        "src/app/play/[childId]/collection/[packSlug]/page.tsx" \
        "src/app/play/[childId]/collection/[packSlug]/study/page.tsx" \
        src/lib/actions/study.ts \
        tests/unit/app/collection-gating.test.tsx tests/unit/grants-study-source.test.ts
git commit -m "feat(packs): hide + 404 locked packs in the Backpack and study route"
```

---

### Task 7: Gate the gacha catalog and the weekly 大礼包

**Files:**
- Modify: `src/lib/db/grants.ts` (the `pullCardInTx` catalog query ~line 152; the `grantGiftPackInTx` pack query ~line 254)
- Test: `tests/unit/gacha-locked-packs.test.ts` (new)

**Interfaces:**
- Consumes: `listLockedPackSlugs(childId, tx)` from Task 2.

Computing the locked set **inside** `pullCardInTx` is deliberate: its six callers
(`finishLevelAction`, `finishAttemptAction`, `finishHomeworkAction`,
`finishFinalBossAction`, `claimBountyAction`, study mode) stay untouched, so
there is no chance of forgetting one.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gacha-locked-packs.test.ts`. Rather than rebuilding a full
drizzle fake, assert on the **filter arguments** the query receives — the
`fakeTable` + routed-`selectResults` harness in `tests/unit/merchant-db.test.ts`
is the reference; read it before writing this.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  locked: [] as string[],
  notInArrayCalls: [] as unknown[][],
}));

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));
vi.mock('@/lib/db/pack-unlocks', () => ({
  listLockedPackSlugs: vi.fn(async () => mocks.locked),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    notInArray: (col: unknown, vals: unknown) => {
      mocks.notInArrayCalls.push([col, vals]);
      return actual.notInArray(col as never, vals as never);
    },
  };
});

import { buildLockedPackFilters } from '@/lib/db/grants';

beforeEach(() => {
  mocks.locked = [];
  mocks.notInArrayCalls = [];
});

describe('buildLockedPackFilters', () => {
  it('returns no filter when nothing is locked', async () => {
    mocks.locked = [];
    const filters = await buildLockedPackFilters('c1', undefined);
    expect(filters).toEqual([]);
    expect(mocks.notInArrayCalls).toHaveLength(0);
  });

  it('excludes every locked pack slug', async () => {
    mocks.locked = ['hello-kitty-v1', 'paw-patrol-v1'];
    const filters = await buildLockedPackFilters('c1', undefined);
    expect(filters).toHaveLength(1);
    expect(mocks.notInArrayCalls[0][1]).toEqual(['hello-kitty-v1', 'paw-patrol-v1']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/gacha-locked-packs.test.ts`
Expected: FAIL — `buildLockedPackFilters` is not exported from `@/lib/db/grants`.

- [ ] **Step 3: Add the shared filter helper**

In `src/lib/db/grants.ts`, add `notInArray` and the `SQL` type to the existing
`drizzle-orm` import, add
`import { listLockedPackSlugs } from '@/lib/db/pack-unlocks';`, and add:

```ts
/**
 * Drizzle filters excluding packs this child has not unlocked yet.
 *
 * Returned as an array so callers can spread it into an existing `and(...)`;
 * an empty array adds nothing. Exported for the gating regression test — every
 * query that filters `gacha_eligible` must ALSO spread this, or a locked pack
 * leaks through that path.
 */
export async function buildLockedPackFilters(
  childId: string,
  tx?: Tx,
): Promise<SQL[]> {
  const locked = await listLockedPackSlugs(childId, tx);
  return locked.length > 0 ? [notInArray(collectionPacks.slug, locked)] : [];
}
```

`SQL` is a type-only import: `import { and, eq, notInArray, type SQL } from 'drizzle-orm';`
(merge with whatever that import line already holds). Do NOT write
`ReturnType<typeof notInArray>` — `notInArray` is generic and that shape does not
resolve cleanly.

- [ ] **Step 4: Apply it to `pullCardInTx`**

In `pullCardInTx`, immediately before the catalog `select`, add:

```ts
  const lockedFilters = await buildLockedPackFilters(childId, tx);
```

and spread it into the catalog's `and(...)`, which becomes:

```ts
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
        packSlug ? eq(collectionPacks.slug, packSlug) : undefined,
        ...lockedFilters,
      ),
    );
```

- [ ] **Step 5: Apply it to `grantGiftPackInTx`**

In `grantGiftPackInTx`, before the pack `select`, add the same line, then spread
into that `and(...)`:

```ts
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
        ...lockedFilters,
      ),
    );
```

The weekly gift's size is derived from this query's row count, so a locked child
correctly receives one fewer card per locked pack.

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run tests/unit/gacha-locked-packs.test.ts tests/unit/grants-db.test.ts tests/unit/grant-gift-pack.test.ts`
Expected: PASS. If `grant-gift-pack.test.ts` fails with `DATABASE_URL is not set`,
add `vi.mock('@/lib/db/pack-unlocks', () => ({ listLockedPackSlugs: vi.fn(async () => []) }))`
to it — `grants.ts` now imports a new `@/lib/db/*` module (the mock-`@/db`
landmine).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/grants.ts tests/unit/gacha-locked-packs.test.ts tests/unit/grant-gift-pack.test.ts
git commit -m "feat(packs): exclude locked packs from gacha + weekly gift"
```

---

### Task 8: Gate the merchant offer and the shard swap

**Files:**
- Modify: `src/lib/db/merchant.ts` (the offer pool query ~line 66)
- Modify: `src/lib/db/grants.ts` (`swapShardsInTx` ~line 386)
- Test: `tests/unit/merchant-db.test.ts`, `tests/unit/gacha-locked-packs.test.ts`

**Interfaces:**
- Consumes: `buildLockedPackFilters` (Task 7) for the merchant; `listLockedPackSlugs` (Task 2) for the swap.

`swapShardsInTx` looks an item up by raw id with **no pack filter at all** today.
`swapShardsForItem` is an exported `'use server'` function — a public RPC. Hiding
the pack in the UI is not a gate.

- [ ] **Step 1: Write the failing swap test**

Append to `tests/unit/gacha-locked-packs.test.ts`. It builds a minimal `tx` stub
rather than reusing the merchant harness, because `swapShardsInTx` only needs two
selects before it should bail:

```ts
import { swapShardsInTx } from '@/lib/db/grants';

function makeTx(packSlug: string) {
  const updates: string[] = [];
  const tx = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ id: 'i1', packSlug }],
        }),
        where: async () => [],
      }),
    }),
    update: () => {
      updates.push('update');
      return { set: () => ({ where: async () => undefined }) };
    },
  } as unknown as Parameters<typeof swapShardsInTx>[0];
  return { tx, updates };
}

describe('swapShardsInTx pack gate', () => {
  it('refuses a locked pack card and debits nothing', async () => {
    mocks.locked = ['hello-kitty-v1'];
    const { tx, updates } = makeTx('hello-kitty-v1');
    const res = await swapShardsInTx(tx, 'c1', 'i1');
    // Reuses the existing reason: for this child the item really does not exist,
    // so the result union and its bilingual UI copy stay unchanged.
    expect(res).toEqual({ ok: false, reason: 'item_not_found' });
    expect(updates).toHaveLength(0);
  });

  it('lets an unlocked pack card through the gate', async () => {
    mocks.locked = [];
    const { tx } = makeTx('zodiac-v1');
    const res = await swapShardsInTx(tx, 'c1', 'i1');
    // Not item_not_found: the gate passed and the swap proceeded to its own
    // shard-balance / already-owned checks.
    expect(res).not.toEqual({ ok: false, reason: 'item_not_found' });
  });
});
```

If the `tx` stub's select chain does not match what `swapShardsInTx` actually
calls after the gate, extend `makeTx` until the second test reaches a *different*
failure reason — the assertion is deliberately `not.toEqual` so it does not
depend on which one.

- [ ] **Step 2: Write the failing merchant test**

In `tests/unit/merchant-db.test.ts`, add `lockedPackSlugs: [] as string[]` to the
`vi.hoisted` object, and add this mock next to the existing `@/lib/db/coins` one:

```ts
vi.mock('@/lib/db/pack-unlocks', () => ({
  listLockedPackSlugs: vi.fn(async () => mocks.lockedPackSlugs),
}));
```

Then append a test in the offer-derivation describe, following the file's
existing routed-`selectResults` style (read the neighbouring offer tests and copy
their setup verbatim, changing only the pool rows):

```ts
  it('never offers a card from a pack this child has not unlocked', async () => {
    mocks.lockedPackSlugs = ['hello-kitty-v1'];
    // Pool: the query itself excludes locked packs, so the routed result holds
    // only the zodiac row — the assertion is that the offer is derived from a
    // pool the gate has already narrowed, and the day's pick still resolves.
    mocks.selectResults = [
      [], // owned
      [{ id: 'z1', slug: 'rat', packSlug: 'zodiac-v1', nameZh: '鼠', nameEn: 'Rat', loreZh: null, loreEn: null, rarity: 'common', imageUrl: '🐀' }],
    ];
    const offer = await getMerchantOffer('c1', '2026-08-21');
    expect(offer?.packSlug).toBe('zodiac-v1');
  });
```

Match `getMerchantOffer`'s real import name and argument order from the top of
that file — do not guess.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run tests/unit/gacha-locked-packs.test.ts tests/unit/merchant-db.test.ts`
Expected: FAIL — `swapShardsInTx` does not consult the gate; `merchant.ts` does
not import `buildLockedPackFilters`.

- [ ] **Step 4: Gate the merchant offer**

In `src/lib/db/merchant.ts`, import the helper and spread it into the pool query:

```ts
import { buildLockedPackFilters } from '@/lib/db/grants';
```

```ts
  const lockedFilters = await buildLockedPackFilters(childId);
```

```ts
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
        ...(ownedIds.length > 0 ? [notInArray(collectibleItems.id, ownedIds)] : []),
        ...lockedFilters,
      ),
    )
```

The offer is derived deterministically from the pool's stable ordering, so
removing rows shifts the day's pick — that is correct and matches the existing
`offer_changed` handling for a pool that moves mid-day.

- [ ] **Step 5: Gate the shard swap**

In `swapShardsInTx` (`src/lib/db/grants.ts`), immediately after the item lookup's
`if (items.length === 0) return { ok: false, reason: 'item_not_found' };`:

```ts
  // A gated pack's cards must not be reachable by id either — swapShardsForItem
  // is an exported server action, i.e. a public RPC (PR #112). A UUID is not a
  // security boundary. Reusing 'item_not_found' keeps the result union and its
  // bilingual copy unchanged: for this child the item really does not exist.
  const locked = await listLockedPackSlugs(childId, tx);
  if (locked.includes(items[0].packSlug)) {
    return { ok: false, reason: 'item_not_found' };
  }
```

`listLockedPackSlugs` is already imported in this file from Task 7.

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run tests/unit/merchant-db.test.ts tests/unit/gacha-locked-packs.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/merchant.ts src/lib/db/grants.ts tests/unit/merchant-db.test.ts tests/unit/gacha-locked-packs.test.ts
git commit -m "feat(packs): gate the merchant offer + shard swap on pack unlock"
```

---

### Task 9: Announce the unlock on the victory screen

**Files:**
- Modify: `src/lib/actions/final-boss.ts`
- Modify: `src/components/scenes/FinalBossRunner.tsx`
- Test: `tests/unit/final-boss-unlock-banner.test.tsx` (new)

**Interfaces:**
- Consumes: `unlockedByClearing` from Task 1.
- Produces: `finishFinalBossAction` returns `{ ok: true; cardGrants: RevealCard[]; trophies: GrantedTrophy[]; unlockedPackSlugs: string[] }`.

Plain strings only — `PackUiMeta` carries React components and callbacks and must
never cross the RSC boundary. `FinalBossRunner` is already `'use client'` and
resolves names itself via `getPackMeta(slug)`.

The field is returned on **every** clear, not only the first: a repeat clear
currently bounces home after 1.5 s showing nothing, and re-announcing costs
nothing. It is presentational — no grant, no idempotency concern.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/final-boss-unlock-banner.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const finishFinalBossAction = vi.fn();
vi.mock('@/lib/actions/final-boss', () => ({
  finishFinalBossAction: (...a: unknown[]) => finishFinalBossAction(...a),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/scenes/FinalBossScene', () => ({
  FinalBossScene: ({ onComplete }: { onComplete: (won: boolean) => void }) => (
    <button onClick={() => onComplete(true)}>win</button>
  ),
}));
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: ({ onDone }: { onDone: () => void }) => (
    <button onClick={onDone}>chest</button>
  ),
}));
vi.mock('@/components/play/TrophyToast', () => ({ TrophyToast: () => null }));

import { FinalBossRunner } from '@/components/scenes/FinalBossRunner';

const props = {
  childId: 'c1',
  packSlug: 'pirate-class-level-1',
  mapNameZh: '加勒比海',
  mapNameEn: 'Caribbean',
  phases: [],
};

beforeEach(() => vi.clearAllMocks());

describe('FinalBossRunner unlock banner', () => {
  it('names both unlocked packs bilingually after a win', async () => {
    finishFinalBossAction.mockResolvedValue({
      ok: true,
      cardGrants: [],
      trophies: [],
      unlockedPackSlugs: ['hello-kitty-v1', 'paw-patrol-v1'],
    });
    render(<FinalBossRunner {...props} />);
    screen.getByText('win').click();
    const banner = await screen.findByTestId('pack-unlock-banner');
    expect(banner).toHaveTextContent('凯蒂猫与朋友');
    expect(banner).toHaveTextContent('汪汪队立大功');
    expect(banner).toHaveTextContent('New collections unlocked!');
  });

  it('renders no banner when nothing unlocked', async () => {
    finishFinalBossAction.mockResolvedValue({
      ok: true,
      cardGrants: [],
      trophies: [],
      unlockedPackSlugs: [],
    });
    render(<FinalBossRunner {...props} />);
    screen.getByText('win').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('pack-unlock-banner')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/final-boss-unlock-banner.test.tsx`
Expected: FAIL — no element with testid `pack-unlock-banner`.

- [ ] **Step 3: Return the field from the action**

In `src/lib/actions/final-boss.ts`, add the import:

```ts
import { unlockedByClearing } from '@/lib/collections/packUnlocks';
```

Widen the return type to:

```ts
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  trophies: GrantedTrophy[];
  unlockedPackSlugs: string[];
}> {
```

Compute it once after the pack is resolved:

```ts
  // Presentational only — announced on EVERY clear, including repeats (a repeat
  // clear otherwise shows nothing at all). No grant, so no idempotency concern.
  const unlockedPackSlugs = unlockedByClearing(parsed.packSlug);
```

and add `unlockedPackSlugs` to BOTH return statements (the `!firstClear` early
return and the final one).

- [ ] **Step 4: Render the banner**

In `src/components/scenes/FinalBossRunner.tsx`, add the imports:

```ts
import { getPackMeta } from '@/lib/collections/packRegistry';
```

Add state and set it in `onComplete`:

```ts
  const [unlockedPacks, setUnlockedPacks] = useState<string[]>([]);
```

```ts
      setUnlockedPacks(res.unlockedPackSlugs);
```

Change the repeat-clear bounce effect so it does not fire while the banner is
up — its guard becomes:

```ts
    if (!done || cards.length > 0 || unlockedPacks.length > 0) return;
```

with `unlockedPacks.length` added to its dependency array.

Render the banner after `CardChestReveal`:

```tsx
      {unlockedPacks.length > 0 ? (
        <div
          data-testid="pack-unlock-banner"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 bg-gradient-to-t from-amber-900/95 to-amber-800/90 p-5 text-center text-amber-50"
        >
          <p className="font-hanzi text-lg font-extrabold">
            🎁 解锁新收藏！
          </p>
          <p className="text-sm font-semibold opacity-90">New collections unlocked!</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {unlockedPacks.map((slug) => {
              const meta = getPackMeta(slug);
              if (!meta) return null;
              return (
                <li
                  key={slug}
                  className="rounded-full bg-amber-50/15 px-3 py-1 text-sm"
                >
                  <span aria-hidden="true">{meta.themeEmoji} </span>
                  <span className="font-hanzi font-bold">{meta.displayNameZh}</span>
                  <span className="opacity-80"> · {meta.displayNameEn}</span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setUnlockedPacks([]);
              router.push(`/play/${childId}`);
            }}
            className="mt-1 rounded-full bg-amber-50 px-6 py-2 font-hanzi text-base font-extrabold text-amber-900"
          >
            去背包看看
            <span className="ml-2 text-xs font-medium opacity-80">Open the Backpack</span>
          </button>
        </div>
      ) : null}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/final-boss-unlock-banner.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Fix any suite that asserts the action's return shape**

Run: `pnpm vitest run tests/unit` and fix every failure caused by the widened
return type (a suite constructing a fake `finishFinalBossAction` result now needs
`unlockedPackSlugs: []`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/final-boss.ts src/components/scenes/FinalBossRunner.tsx tests/unit/final-boss-unlock-banner.test.tsx
git commit -m "feat(packs): announce unlocked collections on the final-boss victory"
```

---

### Task 10: Anticipation copy on the lair node

**Files:**
- Modify: `src/components/play/VoyageBoard.tsx` (the `FinalBossNode` label, ~line 306)
- Test: `tests/unit/voyage-board-final-boss-node.test.tsx` (new, or append to the existing VoyageBoard suite if one covers this node — check `ls tests/unit | grep -i voyage` first)

The final-boss route jumps straight into the gauntlet — there is no pre-fight
screen — so the 👑 lair node's label is the only place the reward can be named
BEFORE the fight. This is the behaviour-change half of the feature: T3 showed
that spelling rewards out in advance is what moves a reluctant child.

- [ ] **Step 1: Write the failing test**

The exact prop shape (from `VoyageBoard.tsx`, verified 2026-08-21) is
`VoyageBoardIsland = { weekId: string; completionPercent: number; bossCleared: boolean; locked?: boolean }`
and `finalBoss?: { unlocked: boolean; cleared: boolean }`. No casts needed.

`VoyageBoard` returns `null` when `getVoyageMap(packSlug)` finds no config, and
it calls `useIsWide()`, which needs `matchMedia` (absent in jsdom) — mock both.

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/hooks/use-is-wide', () => ({ useIsWide: () => false }));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/play/map-boards', () => ({
  getVoyageMap: () => ({
    nameZh: '加勒比海',
    nameEn: 'Caribbean',
    stops: [{ emoji: '🏝️', nameZh: '岛', nameEn: 'Isle' }],
  }),
}));

import { VoyageBoard, type VoyageBoardIsland } from '@/components/play/VoyageBoard';

const islands: VoyageBoardIsland[] = [
  { weekId: 'w1', completionPercent: 100, bossCleared: true },
];

describe('final-boss lair node', () => {
  it('names the two unlockable collections before the fight', () => {
    render(
      <VoyageBoard
        childId="c1"
        packSlug="pirate-class-level-1"
        islands={islands}
        finalBoss={{ unlocked: true, cleared: false }}
      />,
    );
    const node = screen.getByTestId('final-boss-node');
    expect(node).toHaveTextContent('凯蒂猫');
    expect(node).toHaveTextContent('汪汪队');
  });

  it('drops the teaser once the boss is beaten', () => {
    render(
      <VoyageBoard
        childId="c1"
        packSlug="pirate-class-level-1"
        islands={islands}
        finalBoss={{ unlocked: true, cleared: true }}
      />,
    );
    expect(screen.getByTestId('final-boss-node')).not.toHaveTextContent('凯蒂猫');
  });
});
```

If `getVoyageMap`'s real `VoyageStop` shape differs from the stub above, read
`src/lib/play/map-boards.ts` and match it — the stub only needs enough for
`voyageLayout(stops.length)` to produce one point.

`VoyageBoardIsland` is already exported from `VoyageBoard.tsx`; if the mocked
`map-boards` module breaks other exports the file needs, add them to the mock
rather than dropping it.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/voyage-board-final-boss-node.test.tsx`
Expected: FAIL — the node has no such text.

- [ ] **Step 3: Add the teaser to the label**

In `VoyageBoard.tsx`'s `FinalBossNode`, extend the `label` element. Import the
config at the top of the file (it is pure and client-safe):

```ts
import { unlockedByClearing } from '@/lib/collections/packUnlocks';
import { getPackMeta } from '@/lib/collections/packRegistry';
```

and replace the `label` constant with:

```tsx
  // Reward named BEFORE the fight (same reasoning as T3's first-clear rewards on
  // the island). Dropped once cleared — the prize is already in the Backpack.
  const teaser = finalBoss.cleared
    ? []
    : unlockedByClearing(packSlug)
        .map((s) => getPackMeta(s)?.displayNameZh)
        .filter((n): n is string => Boolean(n));
  const label = (
    <span className="mt-1 rounded-md bg-black/45 px-2 py-0.5 text-center text-[11px] font-bold leading-tight text-white">
      终极霸主
      <span className="block text-[9px] font-medium opacity-85">Final Overlord</span>
      {teaser.length > 0 && (
        <span className="mt-0.5 block text-[9px] font-medium leading-snug text-amber-200">
          🎁 解锁 {teaser.join(' · ')}
          <span className="block opacity-85">Unlocks new collections</span>
        </span>
      )}
    </span>
  );
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run tests/unit/voyage-board-final-boss-node.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/play/VoyageBoard.tsx tests/unit/voyage-board-final-boss-node.test.tsx
git commit -m "feat(packs): name the unlockable collections on the lair node"
```

---

### Task 11: Cloudflare art generator wiring

**Files:**
- Modify: `scripts/generate-collectible-art-cloudflare.ts`

Ops script — no unit test, same rationale as Task 5.

- [ ] **Step 1: Add both packs to the target list**

```ts
  'hello-kitty-v1',
  'paw-patrol-v1',
```

- [ ] **Step 2: Add the per-slug subject maps**

flux-1-schnell has no licensed-character training target, so a bare name renders
poorly. Describe the silhouette:

```ts
/** Per-slug subject prompts for the 凯蒂猫与朋友 pack. A bare character name
 *  renders as a generic blob — the silhouette has to be described. Expect
 *  approximations; review and retry individual cards with
 *  FORCE=1 SKIP_UPLOADED_AFTER=<ISO> so a retry costs one `put`, not 16. */
const SANRIO_SUBJECT: Record<string, string> = {
  'hello-kitty': 'Hello Kitty, a small round white cartoon cat with a big red bow on her left ear, black dot eyes, yellow nose and no mouth, full body, centered, plain light pink background',
  mimmy: 'a small round white cartoon cat with a yellow bow on her right ear, black dot eyes, yellow nose and no mouth, full body, centered, plain light background',
  'dear-daniel': 'a small round white cartoon cat boy wearing a blue cap and a striped shirt, black dot eyes and no mouth, full body, centered, plain light background',
  'my-melody': 'My Melody, a small white cartoon rabbit wearing a pink hood with long ears sticking out, full body, centered, plain light background',
  kuromi: 'Kuromi, a small white cartoon character wearing a black jester hood with a pink skull on the front, full body, centered, plain light background',
  cinnamoroll: 'Cinnamoroll, a chubby white cartoon puppy with very long floppy ears and a curled tail, blue eyes, full body, centered, plain light blue background',
  pompompurin: 'Pompompurin, a round golden-yellow cartoon dog wearing a brown beret, full body, centered, plain light background',
  pochacco: 'a white cartoon puppy with black floppy ears and black oval eyes, sporty, full body, centered, plain light background',
  chococat: 'a small all-black cartoon cat with big round eyes and pointed ears, full body, centered, plain light background',
  gudetama: 'Gudetama, a lazy cartoon egg yolk lying on its egg white with a sleepy face, centered, plain light background',
  'little-twin-stars': 'a pair of cute cartoon twin star children, a boy in blue and a girl in pink, sitting on a cloud among stars, centered, plain light background',
  keroppi: 'a cheerful green cartoon frog with big round eyes on the sides of its head and a wide smile, full body, centered, plain light background',
  'badtz-maru': 'a small black-and-white cartoon penguin with one spiky tuft of hair and a mischievous face, full body, centered, plain light background',
  'tuxedo-sam': 'a plump blue-and-white cartoon penguin wearing a red bow tie and a small hat, full body, centered, plain light background',
  hangyodon: 'a friendly blue cartoon fish-man character with big eyes and small fins, standing upright, full body, centered, plain light background',
  'charmmy-kitty': 'a small fluffy white cartoon kitten with a pink collar and a tiny gold key charm, full body, centered, plain light background',
};

/** Per-slug subject prompts for the 汪汪队立大功 pack. */
const PAW_PATROL_SUBJECT: Record<string, string> = {
  ryder: 'a friendly cartoon boy in a red and blue jacket standing beside a small quad bike, full body, centered, plain light background',
  chase: 'a cartoon german shepherd puppy wearing a blue police cap and a blue rescue vest, full body, centered, plain light background',
  marshall: 'a cartoon dalmatian puppy wearing a red firefighter helmet and a red rescue vest, full body, centered, plain light background',
  skye: 'a cartoon cockapoo puppy with golden fur wearing pink aviator goggles and a pink flight vest, full body, centered, plain light background',
  rubble: 'a cartoon english bulldog puppy wearing a yellow hard hat and a yellow construction vest, full body, centered, plain light background',
  rocky: 'a cartoon grey and white mixed-breed puppy wearing a green cap and a green recycling vest, full body, centered, plain light background',
  zuma: 'a cartoon chocolate labrador puppy wearing an orange life jacket and orange goggles, full body, centered, plain light background',
  everest: 'a cartoon husky puppy with white and grey fur wearing a teal snow jacket and goggles, full body, centered, plain light background',
  tracker: 'a cartoon chihuahua puppy wearing a green safari hat and large green headphones, full body, centered, plain light background',
  liberty: 'a cartoon dachshund puppy with brown fur wearing a purple scooter helmet and vest, full body, centered, plain light background',
  'lookout-tower': 'a tall white and silver cartoon rescue lookout tower with a red roof and a large round window, centered, plain light background',
  'paw-patroller': 'a big blue and white cartoon rescue truck with a paw print on the side, side view, centered, plain light background',
};
```

- [ ] **Step 3: Add the `buildPrompt` cases**

```ts
    case 'hello-kitty-v1':
      return `${STYLE_PREAMBLE}${SANRIO_SUBJECT[slug] ?? `${nameEn}, a cute cartoon character, full body, centered, plain light background`}`;
    case 'paw-patrol-v1':
      return `${STYLE_PREAMBLE}${PAW_PATROL_SUBJECT[slug] ?? `${nameEn}, a cute cartoon rescue puppy in a coloured uniform, full body, centered, plain light background`}`;
```

- [ ] **Step 4: Verify it typechecks and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-collectible-art-cloudflare.ts
git commit -m "feat(packs): flux prompts for the two gated packs"
```

---

### Task 12: Enforcement guard test + docs + four-green + PR

**Files:**
- Create: `tests/unit/pack-gate-enforcement-guard.test.ts`
- Modify: `CLAUDE.md`, `docs/CHANGELOG.md`, `PLAN.md`

The guard test exists because this is the project's **first** per-child pack
gate: a future card source will not know it must ask. It greps the source the way
`tests/unit/distribution-isolation-guard.test.ts` does.

- [ ] **Step 1: Write the guard test**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/**
 * Every query that narrows to gacha-eligible packs is a card-delivery path, and
 * every card-delivery path must also exclude packs this child has not unlocked.
 * If you add a new one, spread `buildLockedPackFilters` into its and(...) — or a
 * gated pack leaks through that path only, which nothing else would catch.
 */
describe('pack gate enforcement', () => {
  it.each(['src/lib/db/grants.ts', 'src/lib/db/merchant.ts'])(
    '%s filters locked packs wherever it filters gachaEligible',
    (file) => {
      const src = read(file);
      const gachaFilters = src.split('collectionPacks.gachaEligible').length - 1;
      const lockedFilters = src.split('lockedFilters').length - 1;
      expect(gachaFilters).toBeGreaterThan(0);
      // one `...lockedFilters` spread per gachaEligible filter, plus its `const`
      expect(lockedFilters).toBeGreaterThanOrEqual(gachaFilters);
    },
  );

  it.each([
    'src/lib/db/grants.ts',
    'src/lib/actions/study.ts',
    'src/app/play/[childId]/collection/page.tsx',
    'src/app/play/[childId]/collection/[packSlug]/page.tsx',
    'src/app/play/[childId]/collection/[packSlug]/study/page.tsx',
  ])('%s consults the gate', (file) => {
    expect(read(file)).toContain('listLockedPackSlugs');
  });

  it('the pure unlock config imports nothing from the db layer', () => {
    const src = read('src/lib/collections/packUnlocks.ts');
    expect(src).not.toContain("from '@/db'");
    expect(src).not.toContain("from '@/lib/db/");
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run tests/unit/pack-gate-enforcement-guard.test.ts`
Expected: PASS (9 tests). If the counting assertion in the first block is brittle
against the actual file, tighten it to assert `...lockedFilters` appears in each
`and(` block you edited rather than a raw count — the intent, not the
arithmetic, is what matters.

- [ ] **Step 3: Update CLAUDE.md**

Snapshot "Cards & collection": change the count to **17** and append to the pack
list: `, plus the Map-1-gated hello-kitty (16) + paw-patrol (12)`. Update "last
refreshed" to `2026-08-21`.

Add a bullet to the "Recent changes" window (dropping the oldest):

```
- **PR #155 (2026-08-21)** — first PER-CHILD pack gate: `hello-kitty-v1` (16) + `paw-patrol-v1` (12) are invisible and undroppable until the child beats Map 1's final boss. `final_boss_clears` stays the only source of truth (no table, no migration); pure `packUnlocks.ts` + `listLockedPackSlugs` are enforced at 8 sites (Backpack list, pack route, gacha catalog, weekly 大礼包, merchant offer, shard swap, study route, `finishStudyAction`), with the rule computed INSIDE `pullCardInTx` so its six callers are untouched. Victory screen names the unlocked packs; the 👑 lair node names them before the fight. **Post-merge (required):** `seed-unlockable-packs.ts` + the CF art run.
```

Add this landmine to the "Rewards & economy" group:

```
**Landmine:** *A pack can be invisible to ONE child — `gacha_eligible` is not the whole story (packs-v2, 2026-08-21).* `hello-kitty-v1` / `paw-patrol-v1` are `is_active=true, gacha_eligible=true` in the DB and still must not reach a child who hasn't beaten Map 1. The gate is per-child application code: pure `src/lib/collections/packUnlocks.ts` (client-safe — `FinalBossRunner` and `VoyageBoard` import it) + `src/lib/db/pack-unlocks.ts`'s `listLockedPackSlugs(childId, tx?)`, derived from `final_boss_clears` and NEVER stored. **Any new card-delivery path must spread `buildLockedPackFilters` into its `and(...)`** — `tests/unit/pack-gate-enforcement-guard.test.ts` enforces this, but only for files it knows about. `pullCardInTx` computes the set INSIDE the tx precisely so its six callers can't forget. The shard swap is gated too: `swapShardsForItem` is an exported server action, i.e. a public RPC (PR #112) — a UUID is not a security boundary — and it reuses `'item_not_found'` rather than widening the result union. `is_active` remains the global kill switch, which is also the takedown lever for the two licensed-IP packs.
```

- [ ] **Step 4: Update docs/CHANGELOG.md and PLAN.md**

Add this entry at the top of `docs/CHANGELOG.md`, matching the surrounding
entries' heading style:

```markdown
## PR #155 — per-child pack gate + Hello Kitty / Paw Patrol (2026-08-21)

Two new collectible packs — `hello-kitty-v1` (16 cards) and `paw-patrol-v1`
(12) — that a child cannot see or receive until they beat Map 1's final boss.
This is the project's first PER-CHILD pack gate.

**The gate.** `final_boss_clears` stays the single source of truth for "this
child beat this map" — the same row that gates the next map and guards the
champion rewards. No new table, no new column, no migration, mirroring the
derived-🗝️-keys decision in T3: a stored "unlocked packs" set would drift from
progress. The pure, client-safe `src/lib/collections/packUnlocks.ts` maps a
collectible pack slug to the curriculum pack slug that opens it;
`src/lib/db/pack-unlocks.ts`'s `listLockedPackSlugs(childId, tx?)` derives the
locked set on every call.

**Eight enforcement points:** the Backpack hall list, the per-pack route, the
gacha catalog (`pullCardInTx`), the weekly 大礼包, the merchant's daily offer,
the shard swap, the study route, and `finishStudyAction`. `pullCardInTx`
computes the locked set INSIDE its own transaction rather than taking it as an
argument — its six callers (`finishLevelAction`, `finishAttemptAction`,
`finishHomeworkAction`, `finishFinalBossAction`, `claimBountyAction`, study
mode) are therefore untouched and cannot forget it. The shard swap is gated
because `swapShardsForItem` is an exported server action, i.e. a public RPC
(PR #112) — a UUID is not a security boundary; it reuses the existing
`'item_not_found'` reason rather than widening the result union.

`is_active` and `gacha_eligible` stay `true` on both packs: the gate is
per-child application code, so `verify-integrity.ts`'s registry⟷DB and
`SHARD_SWAP_EXCLUSIVE_PACKS ⟺ gacha_eligible=false` checks keep passing
unmodified.

**The payoff is announced twice.** The 👑 lair node on the voyage board names
both collections BEFORE the fight (the T3 lesson: spelling rewards out in
advance is what moves a reluctant child), and the victory screen shows a
bilingual unlock banner with a 去背包看看 button. The banner fires on every
clear, not only the first — a repeat clear previously bounced home showing
nothing.

**Licensed IP.** Hello Kitty (Sanrio) and Paw Patrol (Spin Master) are
trademarked. Generating their likenesses with flux and serving them from a
public URL is a real, if modest, civil risk for a ~4-account hobby deployment
with no commercial use; flux also renders licensed characters off-model. Both
points were raised before implementation and David decided to proceed. Recorded
here rather than re-litigated. Mitigations: the packs sit behind the Map 1 gate
so they are on no public surface, and `is_active=false` on the pack row hides
both instantly with no code change if a takedown ever arrives.

**Weekly 大礼包 growth (accepted).** The gift grants one card per active
gacha-eligible pack. 10 packs → 11 after PR #153's olympics → 13 for a child who
has beaten Map 1. Accepted as-is; watch the card-source split on
`/admin/economy` and cap the gift in a separate PR if the curve distorts.

**Post-merge ops (required):** `seed-unlockable-packs.ts` → CF art generator
(non-FORCE, 28 `put`s ≈ 1.4% of the monthly Blob budget) →
`zoom-collectible-art.ts` per pack → `verify-collectible-images.ts` →
`verify-integrity.ts`.
```

Add one row to `PLAN.md` §1's shipped table, matching the column count and
wording style of the two rows above it:

```
| #155 | 2026-08-21 | 按孩子解锁的卡包门禁 + 凯蒂猫(16)/汪汪队(12) |
```

- [ ] **Step 5: Four-green gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all four green. Do not narrow the test run to the files you touched.

- [ ] **Step 6: Push and open the PR**

```bash
git add -A && git commit -m "docs: packs-v2 gate — snapshot, landmine, changelog, plan row"
git push -u origin feat/collection-packs-v2
gh pr create --title "feat(packs): per-child pack gate + Hello Kitty & Paw Patrol collections" --body "$(cat <<'EOF'
PR B of the two-PR packs-v2 plan. Adds `hello-kitty-v1` (16) and `paw-patrol-v1`
(12), invisible and undroppable until the child beats Map 1's final boss.

**The gate.** `final_boss_clears` stays the single source of truth — no new
table, no column, no migration (same reasoning as T3's derived 🗝️ keys). Pure
client-safe `packUnlocks.ts` + `listLockedPackSlugs(childId, tx?)`.

**Eight enforcement points:** Backpack hall list · per-pack route · gacha
catalog · weekly 大礼包 · merchant daily offer · shard swap · study route ·
`finishStudyAction`. `pullCardInTx` computes the locked set INSIDE its own
transaction, so its six callers are untouched and cannot forget it. The shard
swap is gated because `swapShardsForItem` is a public RPC — a UUID is not a
security boundary.

**Announced twice:** the 👑 lair node names both collections before the fight;
the victory screen shows a bilingual unlock banner.

`is_active`/`gacha_eligible` stay true on both packs — the gate is per-child
application code, so `verify-integrity.ts` passes unmodified. `is_active=false`
remains the instant global kill switch.

Depends on #154 (`fix/final-boss-pack-lookup`), without which the unlock
condition can never be met.

Spec: `docs/superpowers/specs/2026-08-21-collection-packs-v2-design.md` §4.

## Post-merge ops (required — the PR is inert without them)

Against PROD (swap `DATABASE_URL` to the commented `# PROD_DATABASE_URL=` line in `.env.local`, swap back after):

```
pnpm tsx scripts/backup-db.ts
pnpm tsx scripts/seed-unlockable-packs.ts
CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts
ONLY_PACK=hello-kitty-v1 pnpm tsx scripts/zoom-collectible-art.ts
ONLY_PACK=paw-patrol-v1 pnpm tsx scripts/zoom-collectible-art.ts
pnpm tsx scripts/verify-collectible-images.ts
pnpm tsx scripts/verify-integrity.ts
```

28 `put()` ≈ 1.4% of the 2,000/month Vercel Blob budget. Run the art generator **non-FORCE**.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_013EsxqpdcngBeh1pNDvZQWz
EOF
)"
```

- [ ] **Step 7: Post-merge prod ops**

```bash
pnpm tsx scripts/backup-db.ts
pnpm tsx scripts/seed-unlockable-packs.ts
CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts
ONLY_PACK=hello-kitty-v1 pnpm tsx scripts/zoom-collectible-art.ts
ONLY_PACK=paw-patrol-v1 pnpm tsx scripts/zoom-collectible-art.ts
pnpm tsx scripts/verify-collectible-images.ts
pnpm tsx scripts/verify-integrity.ts   # expect 7/7
```

Two cautions, both load-bearing:

1. **`DATABASE_URL` is split per environment.** Local `.env.local` points at the
   Neon **dev** branch. A prod seed needs the commented `# PROD_DATABASE_URL=`
   line, or `DATABASE_URL=…` supplied as a shell env var for the one command.
2. **One Vercel Blob store sits behind both prod and dev.** Any `put()` is live
   in production regardless of `DATABASE_URL`. Run the art generator
   **non-`FORCE`**; 28 `put()`s ≈ 1.4% of the monthly budget.

Then sanity-check in the app: as a child who has NOT beaten Map 1, the Backpack
must show 15 packs and `/play/<id>/collection/hello-kitty-v1` must 404.
