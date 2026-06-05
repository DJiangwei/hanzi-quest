# Per-Week Boss Animations — Design Spec

**Date:** 2026-06-05
**Status:** approved (design)
**Context:** hanzi-quest's boss fight (`BossScene`) renders a single shared procedural-SVG kraken (`BossKraken.tsx`) for every one of the 10 Map-1 weeks, with only two idle states (fighting tentacle-wiggle, winning color-shift). David's playtest ask: each week should feel visually distinct AND have more animation juice (a dramatic entrance and defeat, not just idle). This spec adds a roster of 10 bespoke procedural-SVG sea creatures — one per week — each with intro / idle / damage / defeat animations.

First of three sequential PRs David requested (the others: post-reveal card polish, daily quests + season pass).

---

## 1. North Star

> Every week's boss is a different sea creature that rises dramatically at the start, flinches each time Yinuo answers correctly, and is defeated with a satisfying animation — so the boss fight feels alive and fresh week to week, never "the same octopus again."

---

## 2. Locked decisions

- **10 bespoke creatures** (not procedural recolor, not 1 shared). One per week.
- **Animation scope = intro + idle + damage + defeat.** No health bar, no attack-on-wrong-answer (deliberately not stressful for a 6yo).
- **Mapping derives from `weeks.weekNumber`** (already exists, unique 1–10 per pack). **Zero DB change.**
- **Procedural SVG + framer-motion only** (locked art direction; framer-motion already a dep). Every animation respects `useReducedMotion()`.
- **Checkpoint after creature #0**: build the framework + the first creature, then David eyeballs the animation feel before the other 9 are mass-produced.

---

## 3. Architecture

### 3.1 Shared creature interface

```ts
// src/components/scenes/fx/bosses/types.ts
export type BossAnimState = 'intro' | 'idle' | 'damage' | 'defeat';

export interface BossCreatureProps {
  state: BossAnimState;
  /** Render size in px (square). Default 200. */
  size?: number;
}
```

Every creature is a `'use client'` component `(props: BossCreatureProps) => JSX.Element` that:
- renders its procedural SVG in a `<div data-testid="boss-creature" data-creature="<key>" data-state={state} data-reduced={reduced}>`,
- owns its framer-motion variants for the 4 states,
- when `useReducedMotion()` is true, renders a **static representative pose per state** (no looping, no transition) — intro/defeat collapse to an instant state.

### 3.2 Roster registry

```ts
// src/lib/scenes/boss-roster.ts  (pure, client-safe — no db imports)
import type { ComponentType } from 'react';
import type { BossCreatureProps } from '@/components/scenes/fx/bosses/types';

export interface BossRosterEntry {
  key: string;        // stable slug, e.g. 'kraken'
  nameZh: string;
  nameEn: string;
  Component: ComponentType<BossCreatureProps>;
}

export const BOSS_ROSTER: BossRosterEntry[] = [ /* 10 entries */ ];

/** Deterministic week → creature. weekNumber is 1-based; wraps past the roster. */
export function getBossCreature(weekNumber: number): BossRosterEntry {
  const i = ((weekNumber - 1) % BOSS_ROSTER.length + BOSS_ROSTER.length) % BOSS_ROSTER.length;
  return BOSS_ROSTER[i];
}
```

> The registry holds React components. It is imported only by client components (`BossScene`), never passed across an RSC boundary — same discipline as `packRegistry` (see the PackUiMeta landmine). `BossScene` calls `getBossCreature(weekNumber)` itself.

### 3.3 Creature lineup (10)

| # | key | 中文 | English |
|---|---|---|---|
| 0 | `kraken` | 海怪 | Kraken |
| 1 | `giant-crab` | 巨蟹 | Giant Crab |
| 2 | `anglerfish` | 灯笼鱼 | Anglerfish |
| 3 | `sea-serpent` | 海蛇 | Sea Serpent |
| 4 | `shark` | 鲨鱼 | Shark |
| 5 | `jelly-swarm` | 水母群 | Jellyfish Swarm |
| 6 | `electric-eel` | 电鳗 | Electric Eel |
| 7 | `giant-clam` | 巨蚌 | Giant Clam |
| 8 | `sea-dragon` | 海龙 | Sea Dragon |
| 9 | `whirlpool` | 漩涡精灵 | Whirlpool Spirit |

Creature #0 (`kraken`) is the existing `BossKraken.tsx` refactored to the new interface. The lineup is not load-bearing — keys/names can be tweaked during build without design impact.

### 3.4 Animation states (every creature)

- **intro** (~1.2s, on mount): emerges — rises from below / fade-scale-in — then settles into idle. One-shot.
- **idle** (the fight, looping): gentle per-creature motion (the kraken tentacle-wave is the template). This is the default "fighting" look.
- **damage** (transient ~400ms, fires on each correct answer): a quick flinch/recoil + brief color flash, then back to idle. The boss visibly "takes a hit."
- **defeat** (~1.2s, one-shot): the creature sinks / bursts / deflates, then the victory screen shows.

### 3.5 BossScene phase machine

`BossScene` currently has `Phase = 'fighting' | 'defeated' | 'victory'`. Extend to drive the creature's `BossAnimState`:

- On mount → creature `state='intro'` for `INTRO_MS` (≈1200), then → `idle`.
- During the fight, the creature is `idle`. On each **correct** answer, set a transient `damage` state for `DAMAGE_MS` (≈400) then revert to `idle` (use a timer; guard against overlap by resetting the timer).
- When the final question is answered and the boss is beaten → creature `state='defeat'` for `DEFEAT_MS` (≈1200), then the existing victory UI (`onComplete` flow unchanged).
- Reduced-motion: timings still elapse (so the phase sequence is identical and `onComplete` timing is stable), but creatures render static poses — OR collapse intro/defeat durations toward 0 for reduced-motion users. **Decision:** keep the same timers (predictable flow) but render static poses; this keeps tests and the victory hand-off timing identical for all users.

The existing question/answer logic, scoring, and `onComplete` contract are **unchanged** — we only add the `BossAnimState` derivation and the creature swap.

### 3.6 Threading weekNumber (no DB change)

- The boss section page (`src/app/play/[childId]/level/[weekId]/[section]/page.tsx`) already loads `week` via `getPlayableWeekForChild`, which has `weekNumber`. Pass `weekNumber={week.weekNumber}` into `<SceneRunner>`.
- `SceneRunner` adds a `weekNumber: number` prop and forwards it to `BossScene` (only the boss case needs it).
- `BossScene` adds `weekNumber: number` prop; calls `getBossCreature(weekNumber)` to pick the component.

---

## 4. Build sequence (checkpoint baked in)

1. **Framework**: `types.ts`, `boss-roster.ts` (with only creature #0 registered), refactor `BossKraken` → `bosses/Kraken.tsx` implementing the 4-state interface, extend `BossScene` phase machine + `BossAnimState` derivation, thread `weekNumber` through the section page + `SceneRunner`. Tests for the roster + phase machine + Kraken smoke.
2. **CHECKPOINT**: David runs it and eyeballs creature #0's intro/damage/defeat feel + timing. Adjust `INTRO_MS`/`DAMAGE_MS`/`DEFEAT_MS` and the animation style if needed.
3. **Creatures #1–#9**: one component each, registered in the roster, each with a smoke test. Mechanical once the framework + first creature are validated.
4. **Docs + four-green gate + PR.**

> The checkpoint is a real stop: do not mass-produce creatures #1–#9 until David has approved creature #0's feel.

---

## 5. Out of scope

- Health bar, hit-points UI, attack-on-wrong-answer, screen shake (the "full cinematic" option, deliberately declined).
- Per-week boss *music*/sound themes (audio is a separate system; not this PR).
- Any DB/schema change. Boss↔week mapping is pure-derived from `weekNumber`.
- Boss difficulty / question-type changes (`BossConfig` untouched).
- Map 2 creatures beyond wraparound (weeks 11+ reuse the roster by `% 10` until a future PR extends it).

---

## 6. Testing

- **`boss-roster.test.ts`**: 10 entries; `getBossCreature(1)`→index 0, `getBossCreature(10)`→index 9, `getBossCreature(11)`→index 0 (wraparound), `getBossCreature(0)` and negatives clamp safely; every entry has non-empty `key/nameZh/nameEn` and a `Component`.
- **`boss-creatures.test.tsx`** (parametrized over `BOSS_ROSTER`): each creature renders in all 4 states without throwing; renders the `data-state` attribute; with `useReducedMotion` mocked true, renders `data-reduced="true"` and no crash.
- **`boss-scene-phases.test.tsx`**: mount → creature gets `state='intro'`, then `idle` after the intro timer (fake timers); a correct answer sets `damage` then reverts to `idle`; final defeat sets `state='defeat'` then victory + `onComplete` fires. Mock framer-motion if needed (or rely on jsdom + `data-state`).
- Existing BossScene tests must still pass (extend rather than break).

---

## 7. Files

**New**
- `src/components/scenes/fx/bosses/types.ts`
- `src/components/scenes/fx/bosses/Kraken.tsx` (+ 9 more creature files)
- `src/lib/scenes/boss-roster.ts`
- test files per §6

**Modified**
- `src/components/scenes/BossScene.tsx` — `weekNumber` prop, `BossAnimState` derivation, render `getBossCreature(weekNumber).Component`, intro/damage/defeat timers.
- `src/components/scenes/SceneRunner.tsx` — `weekNumber` prop, forward to BossScene.
- `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` — pass `weekNumber={week.weekNumber}`.
- `src/components/scenes/fx/BossKraken.tsx` — removed/migrated into `bosses/Kraken.tsx` (keep a re-export only if something else imports it; grep first).
- `CLAUDE.md` — PR entry + landmine (roster registry is client-only; mapping derives from weekNumber).

---

## 8. Done criteria

- Each of the 10 weeks shows a distinct creature (verified by `getBossCreature` mapping); boss rises on entry, flinches on correct answers, and plays a defeat animation before victory.
- Reduced-motion users get static per-state poses with identical phase timing.
- `pnpm typecheck && lint && test && build` green. No recompile, no migration.
