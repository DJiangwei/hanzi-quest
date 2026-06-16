# Distribution-Readiness Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hanzi-quest safe to hand to another family — close cross-account write endpoints, remove user-visible family-specific copy, generalize the Story hero name, add a minimal multi-child picker, and lock it all in with regression tests.

**Architecture:** Code-only phase (no DB migration). The core fix relocates three `childId`-accepting functions out of `'use server'` files (where Next.js exposes every exported async function as a public RPC endpoint) into a server-only non-action module, so they stop being callable endpoints while gated actions still import + call them. Everything else is targeted copy/guard edits plus a regression net.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle, Clerk, Vitest + RTL + jsdom. Four-green gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

**Spec:** `docs/superpowers/specs/2026-06-16-distribution-readiness-audit-design.md`

---

## File Structure

**New files:**
- `src/lib/play/card-grants.ts` — server-only (NOT `'use server'`) module holding the relocated `pullCardForChild`, `claimWeeklyGiftIfDue`, their shared helpers (`safePackCompleteTrophy`, `safeContinentTrophies`, `addDaysUtc`), and the `CardGrantSource` type. Imported only by server actions.
- `src/components/ChildPicker.tsx` — minimal server component listing a user's children with Play links (rendered on the landing for >1-child accounts).
- `tests/unit/distribution-isolation-guard.test.ts` — source-level guard tests (no trust-caller exports in action files; no family strings in rendered surfaces).
- `tests/unit/child-picker.test.tsx` — picker renders for multi-child, redirect for single-child.
- `tests/unit/images-action-guard.test.ts` — `generateMissingImagesForWeek` requires a parent.

**Modified files:**
- `src/lib/actions/gacha.ts` — remove relocated functions; import `safePackCompleteTrophy` from the new module for `swapShardsForItem`; drop now-unused imports.
- `src/lib/actions/play.ts` — import `pullCardForChild`/`claimWeeklyGiftIfDue` from the new module; delete dead `triggerEagerStoryGeneration`.
- `src/lib/actions/homework.ts`, `src/lib/actions/story.ts` — update `pullCardForChild` import path.
- `src/lib/actions/images.ts` — gate with `assertParent()`.
- `src/lib/ai/deepseek-story.ts` — generalize `TONE_INSTRUCTIONS`.
- `src/components/play/LatestChapterPill.tsx` — drop the "Yinuo" subline.
- `src/app/page.tsx` — render `ChildPicker` for >1-child accounts; generalize the badge copy.
- `src/app/parent/(secured)/page.tsx` — generalize the dashboard blurb.
- ~12 collection/component files + `src/db/schema/content.ts` — sweep "Yinuo"/"海盗班" doc comments.
- `tests/unit/pull-card-for-child.test.ts`, `tests/unit/gacha-weekly-gift-quest-tick.test.ts`, `tests/unit/homework-card-source.test.ts` — update import paths.
- `tests/unit/lib/actions/play-story-trigger.test.ts` — delete (tests the deleted function).

---

## Task 1: Relocate `pullCardForChild` + `claimWeeklyGiftIfDue` out of `'use server'`

**Files:**
- Create: `src/lib/play/card-grants.ts`
- Modify: `src/lib/actions/gacha.ts`, `src/lib/actions/play.ts:30`, `src/lib/actions/homework.ts:15`, `src/lib/actions/story.ts:23`
- Modify tests: `tests/unit/pull-card-for-child.test.ts:26`, `tests/unit/gacha-weekly-gift-quest-tick.test.ts:63`, `tests/unit/homework-card-source.test.ts:2`

Context: `gacha.ts` is a `'use server'` file, so its exported `pullCardForChild` and `claimWeeklyGiftIfDue` are public RPC endpoints that take a raw `childId` and skip `requireChild`. They are only ever called from already-gated server actions (`finishLevelAction`, `finishAttemptAction`, `finishHomeworkAction`, `generateStoryChapter`). Moving them to a plain server-only module removes the endpoint surface; behavior is unchanged. `swapShardsForItem` STAYS in `gacha.ts` (it calls `requireChild`, it's user-tappable) but uses the private helper `safePackCompleteTrophy`, so that helper must move too and be exported.

- [ ] **Step 1: Create the new module with the relocated code**

Create `src/lib/play/card-grants.ts` (NO `'use server'` directive). Move these verbatim from `gacha.ts`: the `CardGrantSource` type, `pullCardForChild`, `safePackCompleteTrophy`, `safeContinentTrophies`, `claimWeeklyGiftIfDue`, and the private `addDaysUtc`. Export `safePackCompleteTrophy` (gacha.ts needs it). Bring the imports those functions require:

```typescript
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { collectibleItems, collectionPacks } from '@/db/schema/collections';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import { grantContinentRewards } from '@/lib/db/continent-rewards';
import { todayUtcIso } from '@/lib/db/streaks';
import {
  pullCardInTx,
  grantGiftPackInTx,
  type CardGrantResult,
  type CardGrantSkipped,
  type GiftCard,
} from '@/lib/db/grants';
import { getActivityForRange } from '@/lib/db/activity';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';
import { countCheckInDays, WEEKLY_CHECKIN_THRESHOLD } from '@/lib/db/checkins';
import { tickQuestProgressSafe } from '@/lib/db/quests';

export type CardGrantSource =
  | 'boss_clear'
  | 'perfect_week'
  | 'story_chapter'
  | 'review'
  | 'practice'
  | 'homework';

export async function pullCardForChild(
  childId: string,
  source: CardGrantSource,
  refId: string,
): Promise<CardGrantResult | CardGrantSkipped> {
  const dayUtc = todayUtcIso();
  const result = await db.transaction((tx) =>
    pullCardInTx(tx, childId, source, refId, dayUtc, Math.random),
  );
  if (result.granted) {
    revalidatePath(`/play/${childId}/collection/${result.packSlug}`);
    void safePackCompleteTrophy(childId, result.packSlug);
    if (result.packSlug === 'flags-v1') void safeContinentTrophies(childId);
  }
  return result;
}

/** Guarded pack-complete trophy check. Never throws. */
export async function safePackCompleteTrophy(childId: string, packSlug: string): Promise<void> {
  try {
    await checkAndGrantTrophies(childId, { kind: 'pack-complete', packSlug });
  } catch (err) {
    console.error('[card-grants] pack-complete trophy check failed:', err);
  }
}

/** Guarded continent-complete reward grant (trophy + cosmetic). Never throws. */
async function safeContinentTrophies(childId: string): Promise<void> {
  try {
    await grantContinentRewards(childId);
  } catch (err) {
    console.error('[card-grants] continent-complete reward grant failed:', err);
  }
}

export async function claimWeeklyGiftIfDue(
  childId: string,
): Promise<{ cards: GiftCard[] } | null> {
  const today = todayUtcIso();
  const monday = mondayOfIsoWeek(today);
  const sunday = addDaysUtc(monday, 6);
  const activity = await getActivityForRange(childId, monday, sunday);
  if (countCheckInDays(activity) < WEEKLY_CHECKIN_THRESHOLD) return null;

  const result = await db.transaction((tx) => grantGiftPackInTx(tx, childId, monday, Math.random));
  if (!result.granted) return null;

  if (result.cards.length > 0) {
    void tickQuestProgressSafe(childId, 'earn_card', result.cards.length);
  }

  revalidatePath(`/play/${childId}`);
  const giftSlugs = new Set(result.cards.map((c) => c.packSlug));
  for (const slug of giftSlugs) {
    revalidatePath(`/play/${childId}/collection/${slug}`);
    void safePackCompleteTrophy(childId, slug);
  }
  if (giftSlugs.has('flags-v1')) void safeContinentTrophies(childId);
  return { cards: result.cards };
}

function addDaysUtc(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Remove the relocated code from `gacha.ts` and fix its imports**

In `src/lib/actions/gacha.ts`: delete the `CardGrantSource` type (lines 112–118), `pullCardForChild` (120–140), `safePackCompleteTrophy` (142–149), `safeContinentTrophies` (151–158), `claimWeeklyGiftIfDue` (211–243), and `addDaysUtc` (245–249). `swapShardsForItem` still calls `safePackCompleteTrophy` — add an import:

```typescript
import { safePackCompleteTrophy } from '@/lib/play/card-grants';
```

Then run `pnpm lint` and remove every import that is now unused in `gacha.ts` (these become unused once the functions move: `pullCardInTx`, `grantGiftPackInTx`, `CardGrantResult`, `CardGrantSkipped`, `todayUtcIso`, `getActivityForRange`, `mondayOfIsoWeek`, `countCheckInDays`, `WEEKLY_CHECKIN_THRESHOLD`, `tickQuestProgressSafe`). Keep `GiftCard` only if still referenced; keep `collectibleItems`/`collectionPacks`/`eq`/`grantContinentRewards`/`GrantedTrophy` (used by `swapShardsForItem`).

- [ ] **Step 3: Update the action import sites**

- `src/lib/actions/play.ts:30` — change `import { pullCardForChild, claimWeeklyGiftIfDue } from './gacha';` to `import { pullCardForChild, claimWeeklyGiftIfDue } from '@/lib/play/card-grants';`
- `src/lib/actions/homework.ts:15` — change `import { pullCardForChild } from '@/lib/actions/gacha';` to `import { pullCardForChild } from '@/lib/play/card-grants';`
- `src/lib/actions/story.ts:23` — change `import { pullCardForChild } from './gacha';` to `import { pullCardForChild } from '@/lib/play/card-grants';`

- [ ] **Step 4: Update the existing tests' import paths (behavior unchanged)**

- `tests/unit/pull-card-for-child.test.ts:26` — `import { pullCardForChild } from '@/lib/play/card-grants';`
- `tests/unit/gacha-weekly-gift-quest-tick.test.ts:63` — `import { claimWeeklyGiftIfDue } from '@/lib/play/card-grants';`
- `tests/unit/homework-card-source.test.ts:2` — `import type { CardGrantSource } from '@/lib/play/card-grants';`

- [ ] **Step 5: Verify the four-green gate for this task**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. The three relocated-function tests pass with new paths; `gacha-actions.test.ts` (imports `pullFreeFromBoss`, `pullPaid` — both unchanged) still passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/play/card-grants.ts src/lib/actions/gacha.ts src/lib/actions/play.ts src/lib/actions/homework.ts src/lib/actions/story.ts tests/unit/pull-card-for-child.test.ts tests/unit/gacha-weekly-gift-quest-tick.test.ts tests/unit/homework-card-source.test.ts
git commit -m "refactor: relocate card-grant trust-callers out of 'use server'

pullCardForChild + claimWeeklyGiftIfDue were public RPC endpoints
accepting a raw childId with no ownership check. Move them (and their
shared helpers) into src/lib/play/card-grants.ts so they're no longer
callable endpoints; gated actions still import + call them.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Delete dead `triggerEagerStoryGeneration`

**Files:**
- Modify: `src/lib/actions/play.ts:119-139`
- Delete: `tests/unit/lib/actions/play-story-trigger.test.ts`

Context: `triggerEagerStoryGeneration` is exported from `play.ts` (`'use server'` → a public endpoint that fires paid DeepSeek gen for any `childId`/`weekId`), but it has **no caller** — the only `src` reference is a comment at `play.ts:408` noting it was removed when Story was hidden (#93). Deleting it removes the endpoint. Re-enabling Story would call `generateStoryChapter` directly.

- [ ] **Step 1: Delete the function**

In `src/lib/actions/play.ts`, delete the entire `triggerEagerStoryGeneration` block including its doc comment (lines 119–139, from the `/**` above it through the closing `}`). Leave the `play.ts:408` comment as-is (it documents the history).

- [ ] **Step 2: Delete its test**

```bash
git rm tests/unit/lib/actions/play-story-trigger.test.ts
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. No remaining reference to `triggerEagerStoryGeneration` (confirm with `grep -rn triggerEagerStoryGeneration src tests` → only the `play.ts:408` history comment).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: delete dead triggerEagerStoryGeneration endpoint

Unused since Story was hidden (#93); was an open 'use server' endpoint
firing paid gen for any childId/weekId. Re-enable would call
generateStoryChapter directly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Gate `generateMissingImagesForWeek` with `assertParent`

**Files:**
- Modify: `src/lib/actions/images.ts:1-22`
- Test: `tests/unit/images-action-guard.test.ts`

Context: the action checks only `session.userId` (any logged-in user), then generates images for any `weekId`. Callers are the parent authoring actions (`generateWeekContent`, `regenerateCharacter`). Upgrade the guard to `assertParent()` (role check). It stays week-scoped — shared-pack word images are intentionally global.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/images-action-guard.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { assertParentMock } = vi.hoisted(() => ({ assertParentMock: vi.fn() }));

vi.mock('@/lib/auth/guards', () => ({ assertParent: assertParentMock }));
vi.mock('@/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@/lib/ai/pollinations', () => ({ fetchAndUploadImage: vi.fn() }));

import { generateMissingImagesForWeek } from '@/lib/actions/images';

beforeEach(() => vi.clearAllMocks());

describe('generateMissingImagesForWeek auth', () => {
  it('rejects when assertParent throws (non-parent caller)', async () => {
    assertParentMock.mockRejectedValue(new Error('Parent role required'));
    await expect(generateMissingImagesForWeek('w1')).rejects.toThrow('Parent role required');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/unit/images-action-guard.test.ts`
Expected: FAIL (current code mocks `@clerk/nextjs/server` `auth`, not `assertParent`, so the call won't reject).

- [ ] **Step 3: Apply the guard change**

In `src/lib/actions/images.ts`: remove the `import { auth } from '@clerk/nextjs/server';` line, add `import { assertParent } from '@/lib/auth/guards';`, and replace the body's auth block:

```typescript
// was:
//   const session = await auth();
//   if (!session.userId) {
//     throw new Error('generateMissingImagesForWeek: no auth session');
//   }
await assertParent();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/unit/images-action-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/images.ts tests/unit/images-action-guard.test.ts
git commit -m "fix: gate generateMissingImagesForWeek with assertParent

Was logged-in-only; now requires parent role. Stays week-scoped
(shared-pack word images are global by design).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Generalize user-visible family copy

**Files:**
- Modify: `src/app/page.tsx:23`, `src/app/parent/(secured)/page.tsx:111`

Context: the only family strings a stranger reaches. (i18n `title`/`subtitle` are already generic.) The landing badge is pre-auth marketing; the parent blurb is parent-facing chrome.

- [ ] **Step 1: Generalize the landing badge**

In `src/app/page.tsx`, replace the badge text `For the 海盗班 crew` with `Weekly characters, made playable`.

- [ ] **Step 2: Generalize the parent dashboard blurb**

In `src/app/parent/(secured)/page.tsx`, replace the blurb at line ~111:

```
🏴‍☠️ The 海盗班 crew sails through the shared 加勒比海 islands. To add your
own weekly homework, open a child → pick a week → add homework items.
```

with:

```
🏴‍☠️ Your crew sails the shared 加勒比海 / Caribbean islands. To add weekly
homework, open a child → pick a week → add homework items.
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. `grep -rn "海盗班" src/app` → no matches.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx "src/app/parent/(secured)/page.tsx"
git commit -m "copy: remove family-specific 海盗班 strings from landing + parent dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Generalize the Story hero name

**Files:**
- Modify: `src/lib/ai/deepseek-story.ts:36-43`, `src/components/play/LatestChapterPill.tsx:21-23`

Context: Story is hidden behind `STORY_HIDDEN`, so these aren't reachable today; the fix is forward-looking (David's call). The story prompt already receives `heroName: child.displayName ?? 'Captain'` (`story.ts:101`), so only the static `TONE_INSTRUCTIONS` hardcode "Yinuo"/"she" needs fixing. Using "The hero"/"they" also drops a gender assumption (gender is now a child field).

- [ ] **Step 1: Generalize `TONE_INSTRUCTIONS`**

In `src/lib/ai/deepseek-story.ts`, replace the `TONE_INSTRUCTIONS` record:

```typescript
const TONE_INSTRUCTIONS: Record<StoryToneLiteral, string> = {
  triumphant:
    'The hero crushed the boss with no mistakes. Write a victorious scene where they emerge in glory, the crew cheers, the treasure is rich.',
  standard:
    "The hero cleared the boss with a few stumbles. Write a satisfying scene where they find what they're looking for through cleverness.",
  narrow_escape:
    'The hero barely cleared the boss. Write a scene where things went sideways but they scraped through with quick thinking. The treasure is modest but real.',
};
```

(The `SYSTEM_PROMPT` line "The hero is always the same child." is already name-free — leave it.)

- [ ] **Step 2: Generalize the pill subline**

In `src/components/play/LatestChapterPill.tsx`, replace `Captain Yinuo&apos;s latest chapter` with `Your latest chapter` (the main line already reads "你最新的故事 / Your latest story"; no prop threading needed). The component is currently unmounted, so this is a forward-looking correctness fix.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/deepseek-story.ts src/components/play/LatestChapterPill.tsx
git commit -m "copy: generalize Story hero name (prompt + pill) for any child

TONE_INSTRUCTIONS no longer hardcodes 'Yinuo'/'she'; prompt already
threads child.displayName. Forward-looking — Story stays hidden.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Sweep "Yinuo"/"海盗班" doc comments

**Files:**
- Modify (comments only): `src/lib/collections/flagsData.ts`, `seaCreaturesData.ts`, `solarSystemData.ts`, `dinosaursData.ts`, `landmarksData.ts`; `src/components/play/items/FestivalCard.tsx`, `LandmarkCard.tsx`, `DinosaurCard.tsx`, `SeaCreatureCard.tsx`, `SolarBodyCard.tsx`, `FlagCard.tsx`; `src/components/play/BonusToast.tsx`; `src/db/schema/content.ts`

Context: ~12 doc comments say "Yinuo is English-native…"; one schema comment says "海盗班 Level 1". Never rendered. Generalize the wording (David's call) — touch **comments only**, never a rendered string or the bilingual rule itself.

- [ ] **Step 1: Sweep the comments**

In each file, replace comment phrasings:
- "Yinuo is English-native" → "Kids are English-native" (keep the rest of the sentence intact).
- `src/components/play/BonusToast.tsx:26` "Yinuo is English-native — every toast renders…" → "Kids are English-native — every toast renders…".
- `src/db/schema/content.ts:144` comment "e.g. 海盗班 Level 1" → "e.g. the shared curriculum pack".

Do NOT change any `bi(...)`/JSX rendered string, any `nameZh`/`nameEn` data, or the AI-prompt files in `src/lib/ai/prompts/` (those describe the audience generically and are fine).

- [ ] **Step 2: Verify the sweep is complete**

Run: `grep -rn "Yinuo" src` → expect **no matches**. `grep -rn "海盗班" src` → expect **no matches**.
Then: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS (comment-only edits change no behavior).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: sweep family-specific names from doc comments

Yinuo/海盗班 → generic in internal comments (never rendered). No
behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Minimal multi-child picker on the landing

**Files:**
- Create: `src/components/ChildPicker.tsx`
- Modify: `src/app/page.tsx:6-13`
- Test: `tests/unit/child-picker.test.tsx`

Context: `src/app/page.tsx` redirects single-child accounts to `/play/[childId]` but drops >1-child accounts onto the bare landing with no way to pick. Add a minimal picker (name + Play link per child) for the `>1` case. Single-child redirect and zero-child landing are unchanged. Bilingual per chrome rule.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/child-picker.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChildPicker } from '@/components/ChildPicker';

describe('ChildPicker', () => {
  it('renders a Play link per child', () => {
    render(
      <ChildPicker
        children={[
          { id: 'c1', displayName: 'Mei' },
          { id: 'c2', displayName: 'Bao' },
        ]}
      />,
    );
    expect(screen.getByText('Mei')).toBeInTheDocument();
    expect(screen.getByText('Bao')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/play/c1')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/play/c2')).toBe(true);
  });

  it('renders bilingual chrome heading', () => {
    render(<ChildPicker children={[{ id: 'c1', displayName: 'Mei' }]} />);
    // ZH + EN both present (chrome rule)
    expect(screen.getByText(/选择小航海家/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a player/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/unit/child-picker.test.tsx`
Expected: FAIL ("Cannot find module '@/components/ChildPicker'").

- [ ] **Step 3: Create the component**

Create `src/components/ChildPicker.tsx`:

```tsx
import Link from 'next/link';

interface PickerChild {
  id: string;
  displayName: string;
}

export function ChildPicker({ children }: { children: PickerChild[] }) {
  return (
    <section className="flex w-full max-w-md flex-col gap-3">
      <h2 className="text-center text-sm font-semibold text-[var(--color-ocean-900)]">
        <span className="font-hanzi">选择小航海家</span>
        <span className="text-[var(--color-sand-700)]"> / Choose a player</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {children.map((c) => (
          <li key={c.id}>
            <Link
              href={`/play/${c.id}`}
              className="flex items-center justify-between rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-5 py-4 shadow-sm transition-transform hover:bg-[var(--color-ocean-100)] active:scale-[0.98]"
            >
              <span className="text-lg font-bold text-[var(--color-ocean-900)]">
                {c.displayName}
              </span>
              <span className="text-sm font-semibold text-[var(--color-ocean-700)]">
                开始 / Play →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/unit/child-picker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it into the landing**

In `src/app/page.tsx`, update the signed-in branch so multi-child users see the picker. Add the import `import { ChildPicker } from '@/components/ChildPicker';` and change the early logic:

```tsx
  let multiChildren: { id: string; displayName: string }[] = [];
  if (user) {
    const children = await listChildrenForUser(user.id);
    if (children.length === 1) {
      redirect(`/play/${children[0].id}`);
    }
    multiChildren = children.map((c) => ({ id: c.id, displayName: c.displayName }));
  }
```

Then in the JSX, render the picker when there are multiple children — place it above the existing button row:

```tsx
      {user && multiChildren.length > 1 && <ChildPicker children={multiChildren} />}
```

(The existing "Open parent dashboard →" link stays; zero-child and signed-out states are unchanged.)

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChildPicker.tsx src/app/page.tsx tests/unit/child-picker.test.tsx
git commit -m "feat: minimal multi-child picker on landing

>1-child accounts get a player picker instead of the bare landing.
Single-child redirect + zero-child landing unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Regression net — isolation + family-string guards

**Files:**
- Test: `tests/unit/distribution-isolation-guard.test.ts`

Context: lock in the two structural guarantees so a future PR can't silently regress them: (1) the trust-caller functions are no longer exported from `'use server'` action files; (2) no family string is rendered in `src/app`/`src/components`. These are source-level assertions (read the files, assert on content) — no DB/network.

- [ ] **Step 1: Write the guard tests**

Create `tests/unit/distribution-isolation-guard.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('trust-caller endpoints are not exported from use-server action files', () => {
  it('gacha.ts no longer exports pullCardForChild or claimWeeklyGiftIfDue', () => {
    const src = read('src/lib/actions/gacha.ts');
    expect(src).not.toMatch(/export\s+async\s+function\s+pullCardForChild/);
    expect(src).not.toMatch(/export\s+async\s+function\s+claimWeeklyGiftIfDue/);
  });

  it('play.ts no longer exports triggerEagerStoryGeneration', () => {
    const src = read('src/lib/actions/play.ts');
    expect(src).not.toMatch(/export\s+async\s+function\s+triggerEagerStoryGeneration/);
  });

  it('card-grants.ts (the new home) is NOT a use-server module', () => {
    const src = read('src/lib/play/card-grants.ts');
    expect(src.trimStart()).not.toMatch(/^['"]use server['"]/);
  });
});

describe('no family-specific strings in rendered surfaces', () => {
  const files = [...walk(join(ROOT, 'src/app')), ...walk(join(ROOT, 'src/components'))];
  it('contains no "海盗班" or "Yinuo" in src/app or src/components', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.includes('海盗班') || src.includes('Yinuo');
    });
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it passes**

Run: `pnpm test tests/unit/distribution-isolation-guard.test.ts`
Expected: PASS (Tasks 1, 2, 4, 5, 6, 7 made all assertions true). If the family-string test fails, an un-swept rendered string remains — fix it in the offending file.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/distribution-isolation-guard.test.ts
git commit -m "test: regression guards for cross-account endpoints + family strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Read-side enumeration + final gate

**Files:** none (documentation + verification)

Context: the read side is expected safe (the `/play/[childId]/layout.tsx` `requireChild` guard). Formally confirm and record it, then run the full four-green gate.

- [ ] **Step 1: Enumerate child-data read paths**

Confirm every route that reads child-scoped data sits under an ownership guard:
- All `src/app/play/[childId]/**` pages → covered by `layout.tsx` `requireChild(childId)`. Confirm no nested layout overrides/removes it.
- All `src/app/parent/(secured)/**` child reads → use `getChildOwnedBy`/`requireChild`. Spot-check `children/[id]/page.tsx` and `children/[id]/homework/[weekId]/page.tsx`.
- `src/app/api/**` route handlers → confirm none read child-scoped data without a guard (`parent-unlock` and `webhooks/clerk` are not child-scoped).

Record the enumeration (a short bullet list of routes + their guard) in the PR description.

- [ ] **Step 2: Run the full four-green gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green.

> Note: `pnpm build` runs `tsx scripts/migrate.ts && next build` against the prod `DATABASE_URL`. This phase adds **no migration**, so the migrate step is a no-op (idempotent journal) — safe to run.

- [ ] **Step 3: Open the PR**

Push the branch (SSH remote) and open a PR summarizing the audit: the read-side enumeration (clean), the three relocated/deleted write endpoints, the `images` guard, the copy/comment generalizations, the multi-child picker, and the regression net.

---

## Self-Review Notes

- **Spec coverage:** every spec workstream maps to a task — integrity (T1–T3, T9 read-side), hardcodes visible (T4), Story name (T5), comment sweep (T6), multi-child picker (T7), regression net (T8). ✅
- **Type consistency:** `CardGrantSource`, `safePackCompleteTrophy`, `pullCardForChild`, `claimWeeklyGiftIfDue` signatures are preserved verbatim across the move (T1); the only call-site change is the import path. ✅
- **No migration:** confirmed code-only; T9 notes the build's migrate step is a no-op. ✅
- **Import-cleanup risk:** T1 Step 2 relies on `pnpm lint` to surface now-unused imports in `gacha.ts` (the repo lints unused imports) — explicit, not hand-waved. ✅
