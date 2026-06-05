# Per-Week Boss Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every week a distinct procedural-SVG sea creature as its boss, each with intro/idle/damage/defeat animations, derived deterministically from `weeks.weekNumber` (no DB change).

**Architecture:** A shared `BossCreatureProps` interface + a `boss-roster.ts` registry mapping `weekNumber → 1 of 10` creature components. `BossScene` resolves the creature and drives a phase machine (intro on mount → idle → transient damage on each correct answer → defeat before victory). Framework + creature #0 ship first, then a human checkpoint, then creatures #1–#9.

**Tech Stack:** React 19, framer-motion (`LazyMotion`/`domAnimation`/`m`), Tailwind, Vitest + RTL + jsdom. Procedural SVG only. Every animation respects `useReducedMotion()`.

**Spec:** `docs/superpowers/specs/2026-06-05-per-week-boss-animations-design.md`
**Branch:** `feat/boss-animations` (spec already committed).

---

## Key existing shapes (read before starting)

- `src/components/scenes/fx/BossKraken.tsx` — current single boss: `'use client'`, `LazyMotion features={domAnimation}`, props `{ state: 'fighting' | 'winning'; size? }`, renders an octopus SVG with `data-testid="boss-kraken"`. **Becomes creature #0.**
- `src/components/scenes/BossScene.tsx` — props `{ characterIds, questionTypes, pool, onComplete }`. Internal `Phase = 'fighting' | 'defeated' | 'victory'` + a 3-lives system. Renders `<BossKraken state="fighting" size={150} />` during the fight and `state="winning"` on the kid-lost ("defeated") screen. On the final correct answer it calls `onComplete(true)` **synchronously**. `data-testid="boss-lives"` exists.
- `src/components/scenes/SceneRunner.tsx` — `Props` interface around line 83 (childId, weekId, weekLabel, levels, charactersById, pool, exitHref?, initialPowerupCounts?, showStarterToast?). Boss case at line 332 renders `<BossScene characterIds questionTypes pool onComplete={advance} />`.
- `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` — loads `week` via `getPlayableWeekForChild` (returns the full `weeks` row, so `week.weekNumber` IS available) and renders `<SceneRunner childId weekId={week.id} weekLabel={week.label} ... />` around line 93.
- `src/lib/hooks/use-reduced-motion.ts` — `useReducedMotion(): boolean`.

---

## File structure

**New**
- `src/components/scenes/fx/bosses/types.ts` — `BossAnimState`, `BossCreatureProps`.
- `src/components/scenes/fx/bosses/Kraken.tsx` … `Whirlpool.tsx` — 10 creature components.
- `src/lib/scenes/boss-roster.ts` — `BOSS_ROSTER` + `getBossCreature(weekNumber)`.
- Tests: `boss-roster.test.ts`, `boss-creatures.test.tsx` (parametrized), `boss-scene-phases.test.tsx`.

**Modified**
- `src/components/scenes/BossScene.tsx`, `src/components/scenes/SceneRunner.tsx`, the boss section page, `CLAUDE.md`.
- `src/components/scenes/fx/BossKraken.tsx` — migrated into `bosses/Kraken.tsx` (re-export shim only if other files import it — grep first).

---

## Task 1: Creature interface + Kraken (creature #0)

**Files:**
- Create: `src/components/scenes/fx/bosses/types.ts`
- Create: `src/components/scenes/fx/bosses/Kraken.tsx`
- Test: `tests/unit/boss-creatures.test.tsx`

- [ ] **Step 1: Write the interface.** Create `src/components/scenes/fx/bosses/types.ts`:

```ts
export type BossAnimState = 'intro' | 'idle' | 'damage' | 'defeat';

export interface BossCreatureProps {
  /** Which animation the creature is currently playing. */
  state: BossAnimState;
  /** Square render size in px. Default 200. */
  size?: number;
}
```

- [ ] **Step 2: Write the failing test.** Create `tests/unit/boss-creatures.test.tsx`. It will become the parametrized roster smoke test; start it against the Kraken directly so Task 1 is self-contained, then Task 2 switches it to iterate the roster.

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Kraken } from '@/components/scenes/fx/bosses/Kraken';
import type { BossAnimState } from '@/components/scenes/fx/bosses/types';

const STATES: BossAnimState[] = ['intro', 'idle', 'damage', 'defeat'];

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

describe('Kraken creature', () => {
  it('renders every state without crashing and exposes data-state', () => {
    for (const state of STATES) {
      const { getByTestId, unmount } = render(<Kraken state={state} />);
      const el = getByTestId('boss-creature');
      expect(el).toHaveAttribute('data-state', state);
      expect(el).toHaveAttribute('data-creature', 'kraken');
      unmount();
    }
  });
});
```

- [ ] **Step 3: Run red.** `pnpm vitest run tests/unit/boss-creatures.test.tsx` → FAIL (Kraken missing).

- [ ] **Step 4: Implement Kraken.** Create `src/components/scenes/fx/bosses/Kraken.tsx` by porting `BossKraken.tsx` to the 4-state interface. Requirements:
  - `'use client'`; `LazyMotion features={domAnimation}` wrapper.
  - Root: `<div data-testid="boss-creature" data-creature="kraken" data-state={state} data-reduced={reduced ? 'true' : 'false'} style={{ width: size, height: size }}>`.
  - `const reduced = useReducedMotion();`
  - Map the octopus SVG from `BossKraken.tsx` (body, eyes, 5 tentacles).
  - **State → motion** (framer-motion variants on the body/tentacle `m.*` elements):
    - `idle`: tentacle wave loop (the existing `{ rotate: [-6,6,-6] }`, 1.8s infinite) + gentle body bob.
    - `intro`: one-shot rise+scale-in (`initial={{ y: 40, scale: 0.6, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}` ~1.1s ease-out), then idle motion can run.
    - `damage`: quick recoil + red flash (`animate={{ x: [-6, 6, 0], filter: ['brightness(1)','brightness(1.8)','brightness(1)'] }}` ~0.4s).
    - `defeat`: sink + fade + spin-down (`animate={{ y: 60, rotate: 25, opacity: 0, scale: 0.7 }}` ~1.1s ease-in).
  - **Reduced motion:** when `reduced`, render a single static representative pose per state (no `animate` loops, no transitions): idle = neutral, intro = neutral (full opacity), damage = neutral, defeat = low-opacity sunk pose. No `repeat: Infinity`.
  - Use the existing color treatment (fighting greens; for `defeat`/`damage` you may darken). Keep it kid-friendly.

- [ ] **Step 5: Run green.** `pnpm vitest run tests/unit/boss-creatures.test.tsx` → PASS. `pnpm typecheck` → clean.

- [ ] **Step 6: Commit.**

```bash
git add src/components/scenes/fx/bosses/types.ts src/components/scenes/fx/bosses/Kraken.tsx tests/unit/boss-creatures.test.tsx
git commit -m "feat(boss-animations): BossCreatureProps interface + Kraken (creature #0)"
```

---

## Task 2: Roster registry + parametrized smoke test

**Files:**
- Create: `src/lib/scenes/boss-roster.ts`
- Test: `tests/unit/boss-roster.test.ts`
- Modify: `tests/unit/boss-creatures.test.tsx` (switch to iterate the roster)

- [ ] **Step 1: Write the roster test (red).** Create `tests/unit/boss-roster.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BOSS_ROSTER, getBossCreature } from '@/lib/scenes/boss-roster';

describe('boss roster', () => {
  it('has a non-empty roster, each entry well-formed', () => {
    expect(BOSS_ROSTER.length).toBeGreaterThan(0);
    for (const e of BOSS_ROSTER) {
      expect(e.key).toBeTruthy();
      expect(e.nameZh).toBeTruthy();
      expect(e.nameEn).toBeTruthy();
      expect(typeof e.Component).toBe('function');
    }
  });

  it('maps weekNumber to a creature, 1-based, with wraparound', () => {
    const n = BOSS_ROSTER.length;
    expect(getBossCreature(1)).toBe(BOSS_ROSTER[0]);
    expect(getBossCreature(n)).toBe(BOSS_ROSTER[n - 1]);
    expect(getBossCreature(n + 1)).toBe(BOSS_ROSTER[0]); // wraps
  });

  it('clamps non-positive weekNumber safely (no throw, valid entry)', () => {
    expect(BOSS_ROSTER).toContain(getBossCreature(0));
    expect(BOSS_ROSTER).toContain(getBossCreature(-3));
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/boss-roster.test.ts` → FAIL.

- [ ] **Step 3: Implement the roster.** Create `src/lib/scenes/boss-roster.ts`:

```ts
import type { ComponentType } from 'react';
import type { BossCreatureProps } from '@/components/scenes/fx/bosses/types';
import { Kraken } from '@/components/scenes/fx/bosses/Kraken';

export interface BossRosterEntry {
  key: string;
  nameZh: string;
  nameEn: string;
  Component: ComponentType<BossCreatureProps>;
}

/** One creature per week. Index 0 = week 1. Grows to 10; wraps past the end. */
export const BOSS_ROSTER: BossRosterEntry[] = [
  { key: 'kraken', nameZh: '海怪', nameEn: 'Kraken', Component: Kraken },
];

/** Deterministic week → creature. `weekNumber` is 1-based; wraps + clamps. */
export function getBossCreature(weekNumber: number): BossRosterEntry {
  const n = BOSS_ROSTER.length;
  const i = (((weekNumber - 1) % n) + n) % n;
  return BOSS_ROSTER[i];
}
```

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/boss-roster.test.ts` → PASS.

- [ ] **Step 5: Switch the smoke test to iterate the roster.** Edit `tests/unit/boss-creatures.test.tsx` so it parametrizes over `BOSS_ROSTER` (this auto-covers every creature added later):

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BOSS_ROSTER } from '@/lib/scenes/boss-roster';
import type { BossAnimState } from '@/components/scenes/fx/bosses/types';

const STATES: BossAnimState[] = ['intro', 'idle', 'damage', 'defeat'];

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

describe('boss creatures (roster smoke)', () => {
  for (const entry of BOSS_ROSTER) {
    for (const state of STATES) {
      it(`${entry.key} renders state="${state}"`, () => {
        const { getByTestId } = render(<entry.Component state={state} />);
        const el = getByTestId('boss-creature');
        expect(el).toHaveAttribute('data-state', state);
        expect(el).toHaveAttribute('data-creature', entry.key);
      });
    }
  }
});

describe('boss creatures honor reduced motion', () => {
  it('renders data-reduced="true" when reduced motion is on', async () => {
    const mod = await import('@/lib/hooks/use-reduced-motion');
    vi.mocked(mod.useReducedMotion).mockReturnValue(true);
    const { Component, key } = BOSS_ROSTER[0];
    const { getByTestId } = render(<Component state="idle" />);
    expect(getByTestId('boss-creature')).toHaveAttribute('data-reduced', 'true');
    expect(getByTestId('boss-creature')).toHaveAttribute('data-creature', key);
  });
});
```

- [ ] **Step 6: Run green.** `pnpm vitest run tests/unit/boss-creatures.test.tsx tests/unit/boss-roster.test.ts` → PASS. `pnpm typecheck` → clean.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/scenes/boss-roster.ts tests/unit/boss-roster.test.ts tests/unit/boss-creatures.test.tsx
git commit -m "feat(boss-animations): boss-roster registry + parametrized creature smoke test"
```

---

## Task 3: BossScene phase machine + creature rendering

**Files:**
- Modify: `src/components/scenes/BossScene.tsx`
- Test: `tests/unit/boss-scene-phases.test.tsx`

The new flow: on mount the creature plays `intro` for `INTRO_MS`, then `idle`. Each **correct** answer (that is NOT the final one) triggers a transient `damage` for `DAMAGE_MS` then back to `idle`. The **final correct answer** (kid wins) enters a new `defeating` phase: render the creature `defeat` full-screen for `DEFEAT_MS`, THEN call `onComplete(true)`. The kid-lost screen renders the creature in `idle`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/boss-scene-phases.test.tsx`. Use fake timers and a single-question config so one correct answer wins. Mock the child scene components so we can fire `onComplete(true)` deterministically, and mock `getBossCreature` to a stub creature that renders `data-testid="boss-creature" data-state`.

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('@/lib/scenes/boss-roster', () => ({
  getBossCreature: () => ({
    key: 'stub', nameZh: 'x', nameEn: 'x',
    Component: ({ state }: { state: string }) => (
      <div data-testid="boss-creature" data-state={state} />
    ),
  }),
}));

// Render each boss question scene as a button that wins on click.
vi.mock('@/components/scenes/AudioPickScene', () => ({
  AudioPickScene: ({ onComplete }: { onComplete: (c: boolean) => void }) => (
    <button data-testid="answer" onClick={() => onComplete(true)}>answer</button>
  ),
}));

import { BossScene } from '@/components/scenes/BossScene';

const target = {
  characterId: 'c1', hanzi: '山', pinyinArray: ['shan1'], meaningEn: 'mountain',
  meaningZh: '山', imageHook: null, firstWord: null, sentence: null,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BossScene phase machine', () => {
  it('plays intro then idle, then defeat before onComplete', () => {
    const onComplete = vi.fn();
    render(
      <BossScene
        weekNumber={1}
        characterIds={['c1']}
        questionTypes={['audio_pick']}
        pool={[target]}
        onComplete={onComplete}
      />,
    );
    // intro on mount
    expect(screen.getByTestId('boss-creature')).toHaveAttribute('data-state', 'intro');
    // after intro timer → idle
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByTestId('boss-creature')).toHaveAttribute('data-state', 'idle');
    // win the only question → defeat, onComplete NOT yet called
    act(() => { fireEvent.click(screen.getByTestId('answer')); });
    expect(screen.getByTestId('boss-creature')).toHaveAttribute('data-state', 'defeat');
    expect(onComplete).not.toHaveBeenCalled();
    // after defeat timer → onComplete(true)
    act(() => { vi.advanceTimersByTime(1300); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/boss-scene-phases.test.tsx` → FAIL (`weekNumber` prop / phase machine absent).

- [ ] **Step 3: Implement.** Edit `src/components/scenes/BossScene.tsx`:
  1. Add `weekNumber: number` to `Props`.
  2. Import `useEffect, useRef` (alongside `useMemo, useState`), `getBossCreature` from `@/lib/scenes/boss-roster`, and `BossAnimState` from `./fx/bosses/types`. Remove the `BossKraken` import.
  3. Add timing constants at module scope: `const INTRO_MS = 1200; const DAMAGE_MS = 400; const DEFEAT_MS = 1200;`.
  4. Resolve the creature: `const creature = useMemo(() => getBossCreature(weekNumber), [weekNumber]); const Creature = creature.Component;`.
  5. Extend the phase type: `type Phase = 'intro' | 'fighting' | 'defeating' | 'defeated' | 'victory';` Start state `useState<Phase>('intro')`.
  6. Add `const [anim, setAnim] = useState<BossAnimState>('intro');` and a `const damageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`.
  7. On mount, a `useEffect` sets a timer: after `INTRO_MS`, if still in intro, `setPhase('fighting'); setAnim('idle');`. Clear on unmount.
  8. In `handleAnswer`, on a correct answer that is NOT the final one: `setAnim('damage');` then `damageTimer.current = setTimeout(() => setAnim('idle'), DAMAGE_MS);` (clear any prior). On the **final** correct answer (kid wins): `setPhase('defeating'); setAnim('defeat');` and schedule `setTimeout(() => onComplete(true), DEFEAT_MS)` — do NOT call `onComplete` synchronously anymore. (Apply the same "final → win" logic to the existing wrong-but-alive branch that reaches the end.)
  9. On lives reaching 0: `setPhase('defeated'); setAnim('idle');` (unchanged except anim).
  10. **Rendering:**
     - `phase === 'defeating'`: render a centered full-screen `<Creature state="defeat" size={220} />` + a "胜利! / Victory!" heading (no question UI). (`onComplete` fires from the timer.)
     - `phase === 'defeated'` (kid lost): replace `<BossKraken state="winning" .../>` with `<Creature state="idle" size={200} />`. Keep the retry button; `reset()` must also `setPhase('intro'); setAnim('intro')` and restart the intro effect (e.g. key the effect on a `runId` state bumped in `reset`, or simply set phase to 'intro' and let a `useEffect` depending on phase==='intro' re-arm the intro timer).
     - During `intro` and `fighting`: render the question UI block; replace `<BossKraken state="fighting" size={150} />` with `<Creature state={anim} size={150} />`.
  11. Keep `data-testid="boss-lives"`, the lives logic, the question rendering, and `onComplete`'s `won` argument semantics intact.

  > Re-arming intro on `reset`: simplest robust approach — a `useEffect(() => { if (phase !== 'intro') return; const t = setTimeout(() => { setPhase('fighting'); setAnim('idle'); }, INTRO_MS); return () => clearTimeout(t); }, [phase]);`. Since `reset()` sets `phase='intro'`, the effect re-fires. Guard the defeat timer similarly so a unmount clears it.

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/boss-scene-phases.test.tsx` → PASS. Run existing boss tests: `pnpm vitest run tests/unit/$(grep -rl "BossScene" tests/unit | xargs -n1 basename | tr '\n' ' ')` → all PASS (update any existing BossScene test that now needs the `weekNumber` prop — add `weekNumber={1}`). `pnpm typecheck` → clean.

- [ ] **Step 5: Commit.**

```bash
git add src/components/scenes/BossScene.tsx tests/unit/boss-scene-phases.test.tsx
git commit -m "feat(boss-animations): BossScene phase machine (intro/damage/defeat) + creature render"
```

---

## Task 4: Thread `weekNumber` (section page → SceneRunner → BossScene)

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx`
- Modify: `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`

- [ ] **Step 1: Add the prop to SceneRunner.** In `src/components/scenes/SceneRunner.tsx`:
  - Add `weekNumber: number;` to the `Props` interface (after `weekId`).
  - Add `weekNumber,` to the destructured params of `export function SceneRunner({ ... })`.
  - In the boss case (around line 336), pass it: `<BossScene key={currentLevel.id} weekNumber={weekNumber} characterIds={characterIds} questionTypes={questionTypes} pool={pool} onComplete={advance} />`.

- [ ] **Step 2: Pass it from the section page.** In `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`, add `weekNumber={week.weekNumber}` to the `<SceneRunner ... />` props (next to `weekId={week.id}`).

- [ ] **Step 3: Fix any other SceneRunner callers.** Run `grep -rln "<SceneRunner" src` — if any OTHER call site exists, add `weekNumber={...}` there too (use the relevant week's `weekNumber`, or `1` if it's a context with no real week). Then update any SceneRunner test that constructs the component to pass `weekNumber={1}` (grep `tests/unit` for `SceneRunner`).

- [ ] **Step 4: Verify.** `pnpm typecheck` → clean. `pnpm vitest run tests/unit/$(grep -rl "SceneRunner" tests/unit | xargs -n1 basename | tr '\n' ' ')` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/scenes/SceneRunner.tsx "src/app/play/[childId]/level/[weekId]/[section]/page.tsx" tests/unit
git commit -m "feat(boss-animations): thread weekNumber section page → SceneRunner → BossScene"
```

---

## Task 5: 🛑 CHECKPOINT — David reviews creature #0

**This is a human gate, not a code task. Do NOT proceed to Task 6 until David approves.**

- [ ] **Step 1:** Run the four-green gate so the framework is shippable on its own: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] **Step 2:** Tell David the framework + Kraken are ready to eyeball, and that he should playtest the boss on any week to judge: intro rise timing (`INTRO_MS`), the per-correct-answer damage flinch (`DAMAGE_MS`), and the defeat animation (`DEFEAT_MS`) — plus the overall creature feel.
- [ ] **Step 3:** Apply any timing/style adjustments David requests to `Kraken.tsx` / the `*_MS` constants, commit, and re-confirm. **Only when David says the feel is right** do you continue to Task 6.

> The remaining creatures (#1–#9) copy Kraken's structure exactly, so locking the feel here prevents redoing 9 components.

---

## Tasks 6–14: Creatures #1–#9

**Each creature task has the SAME shape** — only the art brief differs. For each:

**Files:** Create `src/components/scenes/fx/bosses/<Name>.tsx`; Modify `src/lib/scenes/boss-roster.ts` (append the entry); Test: the existing `tests/unit/boss-creatures.test.tsx` auto-covers it once registered.

**Per-creature checklist (repeat for each):**

- [ ] **Step 1:** Create `src/components/scenes/fx/bosses/<Name>.tsx` following **the exact structure of `bosses/Kraken.tsx`** (read it first): `'use client'`, `LazyMotion features={domAnimation}`, `const reduced = useReducedMotion();`, root `<div data-testid="boss-creature" data-creature="<key>" data-state={state} data-reduced={...} style={{width:size,height:size}}>`, an SVG `viewBox="0 0 100 100"`, and framer-motion variants for the four `BossAnimState`s (intro rise-in / idle loop / damage recoil+flash / defeat sink-fade). When `reduced`, render static per-state poses (no infinite loops/transitions). Implement the creature's distinctive silhouette + the motion flavor in the art brief below.
- [ ] **Step 2:** Append the entry to `BOSS_ROSTER` in `src/lib/scenes/boss-roster.ts` (import the component at top): `{ key: '<key>', nameZh: '<zh>', nameEn: '<en>', Component: <Name> }`.
- [ ] **Step 3:** Run `pnpm vitest run tests/unit/boss-creatures.test.tsx tests/unit/boss-roster.test.ts` → PASS (the parametrized smoke now covers the new creature; roster length grew). `pnpm typecheck` → clean.
- [ ] **Step 4:** Commit: `git commit -m "feat(boss-animations): <key> boss creature (#N)"`.

**Art briefs:**

- [ ] **Task 6 — Giant Crab** (`giant-crab` / 巨蟹 / Giant Crab): wide red/orange carapace, two big claws, stalked eyes. idle = claws snap open/closed + slight side sway; damage = both claws jerk back + flash; defeat = flips onto back, legs curl, sinks. intro = scuttles up from below.
- [ ] **Task 7 — Anglerfish** (`anglerfish` / 灯笼鱼 / Anglerfish): dark round body, huge toothy grin, a glowing lure on a stalk. idle = lure bobs + pulsing glow; damage = lure flickers out briefly + recoil; defeat = mouth gapes, light dies, sinks. intro = emerges from dark with the lure lighting up.
- [ ] **Task 8 — Sea Serpent** (`sea-serpent` / 海蛇 / Sea Serpent): long S-curved body of 3–4 segments, finned head. idle = sinuous wave along the body; damage = whole body snaps taut + flash; defeat = body goes limp and coils downward. intro = rises coiling from the bottom.
- [ ] **Task 9 — Shark** (`shark` / 鲨鱼 / Shark): grey torpedo body, dorsal fin, toothy mouth. idle = slow tail sweep + forward bob; damage = sharp veer + flash; defeat = rolls belly-up and drifts down. intro = darts in from the side.
- [ ] **Task 10 — Jellyfish Swarm** (`jelly-swarm` / 水母群 / Jellyfish Swarm): 3 translucent bells with trailing tentacles at different depths. idle = bells pulse (scaleY) + tentacles drift, staggered; damage = all bells contract + flash; defeat = bells deflate and tentacles fall. intro = float up together.
- [ ] **Task 11 — Electric Eel** (`electric-eel` / 电鳗 / Electric Eel): long ribbon body with small arcing spark glyphs. idle = body undulates + occasional spark flicker; damage = big spark burst + recoil; defeat = sparks fizzle, body sinks. intro = zaps in with a flash.
- [ ] **Task 12 — Giant Clam** (`giant-clam` / 巨蚌 / Giant Clam): big ridged shell that opens to show a glowing pearl + eyes. idle = shell breathes open/closed slightly + pearl shimmer; damage = shell snaps shut + flash; defeat = shell cracks open and pearl dims. intro = shell rises closed then opens.
- [ ] **Task 13 — Sea Dragon** (`sea-dragon` / 海龙 / Sea Dragon): leafy seadragon silhouette, long snout, leaf-like fins. idle = fins flutter + gentle drift; damage = curls + flash; defeat = fins droop, sinks slowly. intro = unfurls upward.
- [ ] **Task 14 — Whirlpool Spirit** (`whirlpool` / 漩涡精灵 / Whirlpool Spirit): a swirling water vortex with two eyes in the center (abstract). idle = continuous slow rotation of the spiral; damage = vortex wobbles + flash; defeat = spiral unwinds and disperses. intro = spins up from a flat ripple.

---

## Task 15: Docs + four-green gate + PR

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Update CLAUDE.md.** Add a "Current state" PR entry (per-week boss animations: 10 procedural creatures via `boss-roster.ts`, mapped from `weekNumber`, intro/idle/damage/defeat states, `BossScene` phase machine, no DB change). Add landmines:
  - *Boss roster is client-only.* `boss-roster.ts` holds React components; `BossScene` calls `getBossCreature(weekNumber)` itself — never pass a roster entry across an RSC boundary (same hazard as `packRegistry`).
  - *Boss↔week mapping derives from `weeks.weekNumber`* (`(weekNumber-1) % BOSS_ROSTER.length`). Adding an 11th creature changes which week shows which boss for weekNumber>10 — fine, but be aware. No DB column.
  - *`BossScene` victory is now delayed by `DEFEAT_MS`* — `onComplete(true)` fires from a timer after the defeat animation, not synchronously. Don't restore the synchronous call.
  - *`BossKraken.tsx` retired into `bosses/Kraken.tsx`* — note whether a re-export shim was kept.
  Update the "last refreshed" date.

- [ ] **Step 2: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → all green.

- [ ] **Step 3: Commit, push, PR.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record per-week boss animations + landmines"
git push -u origin feat/boss-animations
gh pr create --title "feat(boss-animations): per-week boss creatures with intro/damage/defeat" --base main
```

PR body: 10 procedural-SVG sea creatures (one per week via `weekNumber`), each with intro/idle/damage/defeat; `BossScene` phase machine; reduced-motion static poses; no DB change, no recompile.

---

## Self-review notes (addressed)

- **Spec coverage:** interface+roster → Tasks 1–2; phase machine (intro/damage/defeat, delayed victory) → Task 3; threading → Task 4; checkpoint → Task 5; creatures #1–9 → Tasks 6–14; tests (roster/parametrized/phase) → Tasks 1–3; docs+gate → Task 15. ✓
- **Type consistency:** `BossAnimState`/`BossCreatureProps` defined Task 1, used everywhere; `BossRosterEntry`/`getBossCreature` defined Task 2; `weekNumber: number` added in Task 3 (BossScene) and Task 4 (SceneRunner) consistently. ✓
- **`BossKraken` removal:** Task 3 removes its import from BossScene; Task 15 step notes the re-export-shim grep. If any non-test file still imports `BossKraken` after Task 3, keep a one-line re-export in `BossKraken.tsx` (`export { Kraken as BossKraken } from './bosses/Kraken';`) — but that requires the old 2-state signature; simplest is to delete `BossKraken.tsx` once Task 3 drops its only importer (BossScene). Grep in Task 3 Step 3 before deleting.
- **No DB / no recompile:** mapping is pure-derived; nothing touches `week_levels` or schema. ✓
