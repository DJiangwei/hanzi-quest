# Post-Reveal Card Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all card grants (boss clear, perfect week, weekly 大礼包) into one tap-to-open `CardChestReveal` showing each card's name/lore/glyph.

**Architecture:** Thread the granted card's display fields through the grant results; await the perfect-week grant so it surfaces; build a queue-based `CardChestReveal` (reusing `TreasureChestReveal`'s visual) and route all sources into it from `SceneRunner`; retire the tiny banner + `GiftPackReveal`.

**Tech Stack:** Next.js 16, React 19, framer-motion, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-06-card-reveal-polish-design.md`
**Branch:** `feat/card-reveal-polish` (spec committed).

---

## Key existing shapes

- `src/lib/db/grants.ts`:
  - `pullCardInTx` catalog query `.select({ id, packId, packSlug: collectionPacks.slug, dropWeight })` → `picked`; returns `CardGrantResult { granted:true, itemId, packId, packSlug, isDupe, shardsAfter }`.
  - `grantGiftPackInTx` per-pack catalog query similar; pushes `GiftCard { itemId, packId, packSlug, isDupe, shardsAfter }`.
  - `collectibleItems` has `slug, nameZh, nameEn, loreZh, loreEn` (all selectable on the same row as `id`).
- `src/lib/actions/play.ts` `finishLevelAction` returns `{ ok, bossCleared, freePullClaimed, cardGrant: CardGrantResult|CardGrantSkipped|null, bonuses, trophies }`. Boss card awaited; **perfect-week is fire-and-forget**: inside `if (perfectAward.awarded) { … pullCardForChild(child.id,'perfect_week',weekId).catch(...) }`.
- `src/components/scenes/fx/TreasureChestReveal.tsx` — auto-runs `shake→open→reveal` on mount (timers), props `{ item: { id, slug, nameZh, nameEn, loreZh, loreEn, emoji? }, wasDuplicate, shardsAfter }`. Renders `emoji` if set, else `ZodiacIcon` for zodiac slugs, else ✨. Dupe note "+1 卡屑 · N/100".
- `getPackMeta(slug)` (`@/lib/collections/packRegistry`, client-safe) → `{ themeEmoji, resolveRevealEmoji?(slug) }`. The zodiac pack slug is `'zodiac'` (the registry key).
- `SceneRunner` consumes `result.giftPack` (→ `GiftPackReveal`) and `levelResult.cardGrant` (→ `LevelFanfare` banner).
- Tests touching this: `finish-attempt-gift`, `finish-level-boss`, `gift-pack-reveal`, `level-fanfare`, `lib/actions/story`, `scene-runner-fanfare`, `scene-runner-gift`, `scene-runner-pr52-card-grant`, `treasure-chest-reveal`, `grants-db`, `grant-gift-pack`, `pull-card-for-child`.

---

## Task 1: `RevealCard` type + thread card display fields through grants

**Files:** Create `src/lib/play/reveal-card.ts`; Modify `src/lib/db/grants.ts`; Tests: `tests/unit/grants-db.test.ts`, `tests/unit/grant-gift-pack.test.ts`, `tests/unit/pull-card-for-child.test.ts`.

- [ ] **Step 1: Create the shared type.** `src/lib/play/reveal-card.ts` (pure, client-safe):

```ts
/** A granted card with everything the reveal UI needs (emoji resolved client-side). */
export interface RevealCard {
  id: string;
  slug: string;
  packSlug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  isDupe: boolean;
  shardsAfter: number;
}
```

- [ ] **Step 2: Extend the grant tests (red).** In `tests/unit/grant-gift-pack.test.ts`, the `selectYielding` catalog rows and the assertions: add `slug/nameZh/nameEn/loreZh/loreEn` to the stubbed catalog rows, and assert the returned `cards[0]` has `nameZh`. In `tests/unit/grants-db.test.ts` (if it exercises `pullCardInTx` returns — it mainly tests `weightedRandomPick`, so likely no change). Add to whichever test asserts a granted result that it now carries `nameZh`/`slug`. Run them red.

- [ ] **Step 3: Extend `grants.ts`.**
  - In `pullCardInTx`, change the catalog `.select({...})` to also select `slug: collectibleItems.slug, nameZh: collectibleItems.nameZh, nameEn: collectibleItems.nameEn, loreZh: collectibleItems.loreZh, loreEn: collectibleItems.loreEn`. `picked` now carries them.
  - Extend `CardGrantResult` with `slug: string; nameZh: string; nameEn: string; loreZh: string | null; loreEn: string | null;` and include them in the `return { granted:true, ... }`.
  - In `grantGiftPackInTx`, add the same 5 fields to the per-pack catalog `.select({...})`, extend `GiftCard` with them, and include them in the `cards.push({...})`.

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/grant-gift-pack.test.ts tests/unit/grants-db.test.ts` → PASS. `pnpm typecheck` → clean (additive fields; `pullCardForChild`/`claimWeeklyGiftIfDue` return types widen automatically; existing consumers ignore the new fields). Update `tests/unit/pull-card-for-child.test.ts` mock return if it constructs a `CardGrantResult` literal that TS now flags as missing fields — add the 5 fields to that mock.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/play/reveal-card.ts src/lib/db/grants.ts tests/unit/grant-gift-pack.test.ts tests/unit/grants-db.test.ts tests/unit/pull-card-for-child.test.ts
git commit -m "feat(card-reveal): thread card display fields (slug/name/lore) through grant results"
```

---

## Task 2: `finishLevelAction` awaits perfect-week + returns `cardGrants[]`

**Files:** Modify `src/lib/actions/play.ts`; Test: `tests/unit/finish-level-boss.test.ts`.

- [ ] **Step 1: Update the test (red).** In `tests/unit/finish-level-boss.test.ts`, change assertions that read `result.cardGrant` to `result.cardGrants` (now an array). Add a case: when both boss-clear AND perfect-week grant, `result.cardGrants` has length 2; when only boss, length 1; when boss grant is cap-reached/skipped, that entry is omitted. Mirror the existing mock of `pullCardForChild` (make it return a granted `CardGrantResult` with the new display fields). Run red.

- [ ] **Step 2: Implement in `play.ts`.**
  - Add `import type { RevealCard } from '@/lib/play/reveal-card';`.
  - Add a local helper near the top of the module (non-exported):

```ts
function toRevealCard(g: Awaited<ReturnType<typeof pullCardForChild>>): RevealCard | null {
  if (!g.granted) return null;
  return {
    id: g.itemId,
    slug: g.slug,
    packSlug: g.packSlug,
    nameZh: g.nameZh,
    nameEn: g.nameEn,
    loreZh: g.loreZh,
    loreEn: g.loreEn,
    isDupe: g.isDupe,
    shardsAfter: g.shardsAfter,
  };
}
```

  - Change the perfect-week block from fire-and-forget to awaited + captured:

```ts
let perfectCard: RevealCard | null = null;
// inside `if (perfectAward.awarded) { … bonuses.push(...) `:
const pc = await pullCardForChild(child.id, 'perfect_week', parsed.weekId);
perfectCard = toRevealCard(pc);
```
   (Remove the old `pullCardForChild(...).catch(...)` fire-and-forget line.)

  - Replace the boss `cardGrant` handling: after `cardGrant = await pullCardForChild(child.id,'boss_clear',sessionId)` compute `const bossCard = toRevealCard(cardGrant);`.
  - Build the ordered list and return it instead of `cardGrant`:

```ts
const cardGrants: RevealCard[] = [bossCard, perfectCard].filter(
  (c): c is RevealCard => c !== null,
);
```
   Change the return type `cardGrant: … | null` → `cardGrants: RevealCard[]` and the returned object `cardGrant,` → `cardGrants,`.

  > Scope note: `perfectCard` must be declared in an outer scope (before the `if` blocks) so it's in scope at the return.

- [ ] **Step 3: Run green.** `pnpm vitest run tests/unit/finish-level-boss.test.ts` → PASS. `pnpm typecheck` will be RED because `SceneRunner` still reads `levelResult.cardGrant` — EXPECTED, fixed in Task 4. Do not fix here.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/actions/play.ts tests/unit/finish-level-boss.test.ts
git commit -m "feat(card-reveal): finishLevelAction awaits perfect-week, returns cardGrants[]"
```

---

## Task 3: `CardChestReveal` component

**Files:** Create `src/components/scenes/fx/CardChestReveal.tsx`; Test: `tests/unit/card-chest-reveal.test.tsx`.

- [ ] **Step 1: Write the failing test.**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import type { RevealCard } from '@/lib/play/reveal-card';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

const card = (over: Partial<RevealCard>): RevealCard => ({
  id: 'i1', slug: 'flag-cn', packSlug: 'flags', nameZh: '中国', nameEn: 'China',
  loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0, ...over,
});

describe('CardChestReveal', () => {
  it('opens a chest on tap and reveals the card', () => {
    render(<CardChestReveal cards={[card({})]} onDone={vi.fn()} />);
    // closed chest → open button
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));
    expect(screen.getByText('中国')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
  });

  it('advances through multiple cards then calls onDone', () => {
    const onDone = vi.fn();
    render(<CardChestReveal cards={[card({ id: 'a', nameEn: 'China' }), card({ id: 'b', nameZh: '美国', nameEn: 'USA' })]} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));      // open card 1
    fireEvent.click(screen.getByRole('button', { name: /下一个|next/i }));     // next
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));      // open card 2
    expect(screen.getByText('美国')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /继续|continue/i }));   // done
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('shows a shard note for a duplicate', () => {
    render(<CardChestReveal cards={[card({ isDupe: true, shardsAfter: 3 })]} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));
    expect(screen.getByText(/碎片|卡屑|shard/i)).toBeInTheDocument();
  });

  it('renders nothing for an empty queue', () => {
    const { container } = render(<CardChestReveal cards={[]} onDone={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

Run red: `pnpm vitest run tests/unit/card-chest-reveal.test.tsx` → FAIL.

- [ ] **Step 2: Implement.** Create `src/components/scenes/fx/CardChestReveal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { RevealCard } from '@/lib/play/reveal-card';
import { TreasureChestReveal } from './TreasureChestReveal';

interface Props {
  cards: RevealCard[];
  onDone: () => void;
}

/** Resolve the per-card glyph: zodiac pack → null (use ZodiacIcon), else emoji. */
function emojiFor(card: RevealCard): string | null {
  if (card.packSlug === 'zodiac') return null;
  const meta = getPackMeta(card.packSlug);
  return meta?.resolveRevealEmoji?.(card.slug) ?? meta?.themeEmoji ?? '🎴';
}

export function CardChestReveal({ cards, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState(false);

  if (cards.length === 0) return null;
  const card = cards[index];
  const isLast = index >= cards.length - 1;

  return (
    <div
      data-testid="card-chest-reveal"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/55 px-6 text-center"
    >
      {cards.length > 1 && (
        <div className="text-sm font-semibold text-white/90">
          {index + 1} / {cards.length}
        </div>
      )}

      {!opened ? (
        <>
          <div className="text-8xl" aria-hidden="true">🎁</div>
          <WoodSignButton size="lg" onClick={() => setOpened(true)}>
            开启宝箱 / Open
          </WoodSignButton>
        </>
      ) : (
        <>
          <div className="rounded-3xl bg-white/95 px-4 py-2 shadow-xl">
            <TreasureChestReveal
              item={{
                id: card.id,
                slug: card.slug,
                nameZh: card.nameZh,
                nameEn: card.nameEn,
                loreZh: card.loreZh,
                loreEn: card.loreEn,
                emoji: emojiFor(card),
              }}
              wasDuplicate={card.isDupe}
              shardsAfter={card.shardsAfter}
            />
          </div>
          {isLast ? (
            <WoodSignButton size="lg" onClick={onDone}>
              继续 / Continue
            </WoodSignButton>
          ) : (
            <WoodSignButton
              size="lg"
              onClick={() => {
                setIndex((i) => i + 1);
                setOpened(false);
              }}
            >
              下一个 / Next
            </WoodSignButton>
          )}
        </>
      )}
    </div>
  );
}
```

> `TreasureChestReveal` auto-runs its shake→open→reveal on mount (and is immediate under reduced motion), so mounting it when `opened` becomes true gives the chest-burst then the card. The outer 🎁 + Open button is the "tap to open" affordance.

- [ ] **Step 3: Run green.** `pnpm vitest run tests/unit/card-chest-reveal.test.tsx` → PASS. (`pnpm typecheck` still red from Task 2 until Task 4.) Confirm no errors originate from this file.

- [ ] **Step 4: Commit.**

```bash
git add src/components/scenes/fx/CardChestReveal.tsx tests/unit/card-chest-reveal.test.tsx
git commit -m "feat(card-reveal): CardChestReveal tap-to-open queued reveal"
```

---

## Task 4: Route all sources into `CardChestReveal`; retire banner + GiftPackReveal

**Files:** Modify `src/components/scenes/SceneRunner.tsx`, `src/components/scenes/fx/LevelFanfare.tsx`; Delete `src/components/play/GiftPackReveal.tsx` + `tests/unit/gift-pack-reveal.test.tsx`; Tests: `scene-runner-gift.test.tsx`, `scene-runner-pr52-card-grant.test.tsx`, `scene-runner-fanfare.test.tsx`, `level-fanfare.test.tsx`.

- [ ] **Step 1: SceneRunner — reveal queue.** In `src/components/scenes/SceneRunner.tsx`:
  - Add `import type { RevealCard } from '@/lib/play/reveal-card';` and lazy `const CardChestReveal = dynamic(() => import('./fx/CardChestReveal').then((m) => m.CardChestReveal), { ssr: false });`. Remove the `GiftPackReveal` dynamic import + its render + the `giftCards` state, and remove the `cardGrant` state that fed `LevelFanfare`.
  - Add `const [revealCards, setRevealCards] = useState<RevealCard[]>([]);`.
  - After `const result = await finishAttemptAction({...})`: replace `if (result.giftPack) setGiftCards(result.giftPack.cards);` with `if (result.giftPack?.cards?.length) setRevealCards((q) => [...q, ...result.giftPack.cards]);` (giftPack.cards are now `RevealCard[]`-shaped — `GiftCard` carries the same display fields after Task 1; map if the field set differs).
  - After `const levelResult = await finishLevelAction({...})`: replace the `if (levelResult.cardGrant) setCardGrant({...})` block with `if (levelResult.cardGrants.length) setRevealCards((q) => [...q, ...levelResult.cardGrants]);`.
  - Remove `cardGrant` from the `<LevelFanfare ... />` props.
  - Near `<BonusToast/>`, render: `{revealCards.length > 0 ? <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} /> : null}`.

  > `GiftCard` (Task 1) now has `{itemId, packId, packSlug, isDupe, shardsAfter, slug, nameZh, nameEn, loreZh, loreEn}`. `RevealCard` wants `id` (= itemId). Map gift cards: `result.giftPack.cards.map((c) => ({ id: c.itemId, slug: c.slug, packSlug: c.packSlug, nameZh: c.nameZh, nameEn: c.nameEn, loreZh: c.loreZh, loreEn: c.loreEn, isDupe: c.isDupe, shardsAfter: c.shardsAfter }))`. `levelResult.cardGrants` is already `RevealCard[]`.

- [ ] **Step 2: LevelFanfare — drop the card banner.** In `src/components/scenes/fx/LevelFanfare.tsx`, remove the `cardGrant` prop + the entire `{cardGrant?.granted ? … : chestAvailable && cardGrant?.granted === false ? … : null}` banner block + the `CardGrantSummary` interface. Keep the heading (`Boss defeated!`/`Island cleared!`), coins line, and 回地图 button. (`chestAvailable` may become unused — if so, drop it from props + the SceneRunner call.)

- [ ] **Step 3: Delete GiftPackReveal.**

```bash
git rm src/components/play/GiftPackReveal.tsx tests/unit/gift-pack-reveal.test.tsx
```

- [ ] **Step 4: Update the affected tests.**
  - `tests/unit/scene-runner-gift.test.tsx`: the mocked `finishAttemptAction` returns `giftPack.cards` — give those cards the full display fields; assert a `card-chest-reveal` appears after driving the scene (instead of `gift-card-tile`).
  - `tests/unit/scene-runner-pr52-card-grant.test.tsx`: the mocked `finishLevelAction` returns `cardGrants: [RevealCard]` (not `cardGrant`); assert `card-chest-reveal` / the card name appears (instead of `data-card-granted` banner).
  - `tests/unit/scene-runner-fanfare.test.tsx`: if it asserts the `cardGrant` banner / `chestAvailable`, update to the new reality.
  - `tests/unit/level-fanfare.test.tsx`: remove tests asserting the card banner / `cardGrant` prop; keep heading/coins/回地图 tests.

- [ ] **Step 5: Run the four-green gate.** `pnpm typecheck` → clean (now that SceneRunner uses `cardGrants`). `pnpm lint` → clean. `pnpm test` → green. `pnpm build` → succeeds.

- [ ] **Step 6: Commit.**

```bash
git add src/components/scenes/SceneRunner.tsx src/components/scenes/fx/LevelFanfare.tsx src/components/play/GiftPackReveal.tsx tests/unit
git commit -m "feat(card-reveal): route boss/perfect/gift cards into CardChestReveal; retire banner + GiftPackReveal"
```

---

## Task 5: Docs + four-green gate + PR

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Update CLAUDE.md.** "Current state" entry (card-reveal polish: unified tap-to-open `CardChestReveal` for boss/perfect-week/大礼包; grant results now carry card display fields; `GiftPackReveal` + `LevelFanfare` banner retired). Landmines:
  - *`perfect_week` card grant is now AWAITED in `finishLevelAction`* (was fire-and-forget) so it surfaces in the reveal — supersedes the old "perfect_week is fire-and-forget" landmine. `finishLevelAction` returns `cardGrants: RevealCard[]` (boss + perfect-week, filtered to granted), replacing the old single `cardGrant` field.
  - *All card reveals go through `CardChestReveal`* (`SceneRunner` reveal queue). Grant results (`CardGrantResult`/`GiftCard`) carry `slug/nameZh/nameEn/loreZh/loreEn`; the reveal resolves the glyph via `getPackMeta(packSlug)` (zodiac → `ZodiacIcon`, else `resolveRevealEmoji ?? themeEmoji`). Adding a new card source = produce `RevealCard[]` and enqueue it.
  Update the "last refreshed" date.

- [ ] **Step 2: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → all green.

- [ ] **Step 3: Commit, push, PR.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record card-reveal polish + landmine updates"
git push -u origin feat/card-reveal-polish
gh pr create --title "feat(card-reveal): unified tap-to-open chest reveal for all card grants" --base main
```

PR body: unified `CardChestReveal` for boss-clear / perfect-week / weekly 大礼包; card display fields threaded through grants; perfect-week now awaited + surfaced; retired `GiftPackReveal` + `LevelFanfare` banner; no DB change/recompile.

---

## Self-review notes (addressed)

- **Spec coverage:** RevealCard + data threading → Task 1; perfect-week awaited + cardGrants → Task 2; CardChestReveal → Task 3; SceneRunner routing + retire banner/GiftPackReveal → Task 4; docs → Task 5. ✓
- **Type consistency:** `RevealCard` (Task 1) used in Tasks 2/3/4; `CardGrantResult`/`GiftCard` gain the same 5 fields (Task 1); `finishLevelAction.cardGrants: RevealCard[]` (Task 2) consumed in Task 4. ✓
- **Intentional mid-plan red:** Task 2 leaves typecheck red (SceneRunner still reads `cardGrant`) until Task 4 — called out so a subagent doesn't prematurely "fix" it. ✓
- **Zodiac glyph:** `emojiFor` returns null for `packSlug==='zodiac'` so `TreasureChestReveal` uses `ZodiacIcon`. ✓
- **Story-chapter grants** (`story.ts`) get the widened `CardGrantResult` harmlessly (extra fields ignored); not surfaced via the reveal (out of scope). ✓
- **No DB/recompile:** only added SELECT columns + returned fields + UI. ✓
