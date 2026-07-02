# Map Final Boss — 海域霸主 / Map Overlord — Design

**Date:** 2026-06-30
**Status:** Approved design (pending David's spec review → implementation plan)

## Overview

Every *week* in a map ends in a boss (a gauntlet vs. one of 10 sea creatures). But finishing a whole *map* (10 weeks) currently just… ends. This phase adds a **map final boss** — a culminating multi-phase battle against a map **overlord** (海域霸主) that turns each voyage into a real journey with a destination, and gates progression to the next map.

**The next-phase focus is "finish the voyage":** the map final boss is the centerpiece; Map 2 (印度洋) authoring is the parallel track (it just needs David's 10 weeks of hanzi, then it inherits the final boss for free). The feature is **generic** — any pack with N published weeks gets an overlord when all N are cleared.

## Decisions (locked with David)

1. **Battle = multi-phase boss.** One overlord, **3 phases × ~6 questions ≈ 18**, sampled across ALL the map's week-characters, reusing the existing boss question types. 3 ⚓ lives.
2. **Loss = full restart** (back to Phase 1, lives refilled). David chose the higher-stakes classic over a per-phase checkpoint.
3. **Rewards** (all three; idempotent, once): a **champion trophy**, an **exclusive champion card** (reward-only, one per map), and a **champion crown cosmetic + a derived title chip**.
4. **Gates the next map.** Maps are linear (加勒比海 → 印度洋 → …); a later map stays locked until the previous map's overlord is beaten. Map 1 is always open. Mitigation for a stuck 6yo: the final boss is **free + unlimited retries**.

## Architecture

### A. "Map fully cleared" + "final boss cleared" state

- **Unlock the final boss** = every *published* week in the pack has `progress.bossCleared = true` for this child. New read `isMapFullyCleared(childId, packId)` (and a count for the UI "9/10"): join the pack's published weeks against `progress`. No new table for this — derived.
- **Final boss cleared** (drives map gating + reward idempotency) = a new table **`final_boss_clears`** (PK `(childId, packId)`, `clearedAt`). Migration: 1 table. The single source of truth for "map beaten."

### B. Map ordering + gating

- Maps need a linear order. `curriculum_packs` is ordered by `createdAt` today in `listMapsForChild`; we make the order explicit and stable via the existing slug convention `pirate-class-level-N` → parse `N` (fallback to `createdAt` for non-conforming slugs like `school-custom`, which sort last and are never gated). Encapsulate in a pure `mapOrderIndex(slug)` helper.
- `listMapsForChild` extends each `MapForChild` with `isLocked` now = `weekCount === 0` **OR** (`orderIndex > 0` **AND** the immediately-previous map's final boss is NOT in `final_boss_clears`). Map 1 (`orderIndex 0`) is never gated.
- `switchMapAction` already throws `MapLockedError` for 0-week packs; extend it to also reject switching INTO a gated map (prev overlord not beaten) — same error, new bilingual message variant.

### C. The battle — `FinalBossScene`

New client component `src/components/scenes/FinalBossScene.tsx`, adapted from `BossScene` (read it — it already has the intro/fight/defeat phase machine, lives, creature animation, and delegates each question to the existing sub-scenes `AudioPickScene` / `ImagePickScene` / `TranslatePickScene` / `SentenceClozeScene` / `VisualPickScene`).

- **Props:** `packSlug`, `mapNameZh/En`, `creatureKey`, `questions: FinalBossQuestion[][]` (an array of 3 phase-groups), `onComplete(won)`.
- **Phase machine:** `intro → phase(0) → enrage → phase(1) → enrage → phase(2) → defeating → defeated/onComplete`. A phase = ~6 questions. Clearing a phase plays a brief **enrage** beat (reuse the creature's `damage` state + a color/scale pulse + a bilingual "第二阶段 / Phase 2" banner) then advances. Clearing the LAST phase → `defeat` animation (`DEFEAT_MS`) → `onComplete(true)`.
- **Lives:** 3 ⚓ shared across all phases. Wrong answer → lose a life + advance (keep gauntlet pace, same as `BossScene`). Lives hit 0 → `defeated` screen with a **free 再战 / Fight again** button that resets to **Phase 1** (full restart) with lives refilled.
- **Progress UI:** a phase pip row (`● ● ○`) + the `n/total` counter + the ⚓ lives row. Reduced-motion: static per-phase poses (the creature components already honor `useReducedMotion`).
- **Victory is delayed** by the defeat timer (same `onComplete` pattern as `BossScene` — never synchronous on the final answer).

### D. The overlord creature

- A new, **bigger** procedural-SVG creature **per map** — NOT from the 10-week roster. New registry `src/lib/scenes/final-boss-roster.ts`: `getFinalBoss(packSlug): FinalBossEntry` (client-only, holds the React component — same RSC hazard as `boss-roster.ts`; `FinalBossScene` resolves it itself).
- Caribbean overlord (v1): **幽灵旗舰 / Ghost Galleon** — a giant haunted pirate ship (thematically distinct from the sea-animal week bosses, unmistakably a "final boss"). Implements the same `BossCreatureProps` (states `intro/idle/damage/defeat`, reduced-motion static poses) at a larger default `size`. 印度洋 gets its own later (e.g. 利维坦巨鲸 / Leviathan) — one component per map, registered by slug.

### E. Question building (runtime, no compile)

- Server-side `buildFinalBossPhases(childId, packId, rng)` in `src/lib/play/final-boss.ts` (pure given the character pool): gather ALL `CharacterDetail`s across the map's published weeks (reuse `getCharactersWithDetailsForWeek` per week, or a new map-level aggregate query), sample ~18 distinct-ish targets, assign boss question types round-robin, split into 3 phase-groups of ~6. Returns `FinalBossQuestion[][]`. Built fresh each visit (like Study Mode) — no `week_levels`, no migration for questions.

### F. Rewards (festival/continent reward pattern, idempotent)

`finishFinalBossAction(childId, packSlug)` (`'use server'`, `requireChild`):
1. **Anti-cheat:** re-verify `isMapFullyCleared`; else throw.
2. **Idempotency:** `INSERT final_boss_clears` (23505 → already cleared → return `{ alreadyCleared: true }`, no double rewards). This insert is also what **unlocks the next map**.
3. On first clear, grant the bundle (each guarded):
   - **Champion card** — a SPECIFIC reward-only card for this map. New reward-only pack `champions-v1` (`gacha_eligible=false`), one card per map (`champion-caribbean`, `champion-indian-ocean`, …). Granted via the existing **`grantSpecificCardInTx`** (already used by the admin console) — NOT a random pull. Added to `SHARD_SWAP_EXCLUSIVE_PACKS` (parallel to festivals/season).
   - **Champion trophy** — per map, new trophy category `'champion'`, slug `champion-<map>`. Seeded via `seed-trophies.ts`; new `checkAndGrantTrophies` case `{ kind: 'map-champion', packSlug }`.
   - **Champion crown cosmetic** — a reward-only avatar item per map (`theme: 'champion'`, `rewardOnly: true`, slot `hat`), procedural SVG in `itemCatalog.tsx`. Granted + **auto-equipped** (mirrors `grantFestivalCosmeticInTx` / `grantContinentRewards`). `'champion'` added to `AVATAR_THEMES` + `REWARD_THEMES` + `REWARD_WARDROBE_THEMES`.
4. Returns `{ card: RevealCard, trophies, cosmetic, title }` for the UI reveal (reuse `CardChestReveal` + `TrophyToast`).

### G. UI surfaces

- **Voyage board:** a final **👑 lair node** appended after the last week stop. `VoyageBoard` gains a `finalBoss: { unlocked: boolean; cleared: boolean }` prop → renders the lair as 🔒 (locked, "击败所有海怪后开启 / Defeat all sea beasts first"), ⚔️ (ready, pulsing, → final-boss route), or 👑 (cleared). `voyageLayout`/`voyageLayoutHorizontal` extend to place `total + 1` nodes (the lair last).
- **Route:** `src/app/play/[childId]/final-boss/[packSlug]/page.tsx` — `requireChild`; pack exists; `isMapFullyCleared` else `redirect` to `/maps`; builds phases server-side; renders `FinalBossScene`; wires `onComplete` → `finishFinalBossAction` → reveal.
- **Map gating UI:** `MapCard` renders the gated state (🔒 + "先击败上一片海域的霸主 / Defeat the previous overlord first") distinct from the 0-week locked state.
- **Home title chip:** a 👑 **加勒比海霸主 / Lord of the Caribbean** chip on the home avatar header, **derived** from `final_boss_clears` (shows the latest map beaten; bilingual title from a per-map `CHAMPION_TITLES` map). Hidden if no map beaten. No new equip system.

## New code / files

```
Create:
  src/db/schema/…                         final_boss_clears table (migration 00NN)
  src/lib/play/final-boss.ts              buildFinalBossPhases + types (pure-ish)
  src/lib/scenes/final-boss-roster.ts     getFinalBoss(packSlug) (client-only)
  src/components/scenes/fx/bosses/GhostGalleon.tsx   Caribbean overlord (BossCreatureProps)
  src/components/scenes/FinalBossScene.tsx
  src/lib/actions/final-boss.ts           finishFinalBossAction
  src/app/play/[childId]/final-boss/[packSlug]/page.tsx
  src/lib/collections/championsData.ts    1 card per map + CHAMPION_TITLES
  src/components/play/items/ChampionCard.tsx (or makeVocabCard reuse)
  scripts/seed-champions-pack.ts          reward-only champions-v1 pack
  src/components/play/ChampionTitleChip.tsx
Modify:
  src/lib/db/maps.ts (listMapsForChild)   gating + isMapFullyCleared + final-boss state
  src/lib/actions/maps.ts (switchMapAction) reject gated switch
  src/lib/play/voyage-layout.ts           +1 node for the lair
  src/components/play/VoyageBoard.tsx      lair node
  src/app/play/[childId]/page.tsx          ChampionTitleChip + finalBoss prop
  src/lib/db/trophies.ts / trophies-evaluators.ts  'map-champion' case
  scripts/seed-trophies.ts                champion trophies
  src/lib/avatar/itemCatalog.tsx + themes.ts  champion crowns + 'champion' theme
  src/lib/economy/shards.ts               champions-v1 in SHARD_SWAP_EXCLUSIVE_PACKS
  src/lib/collections/packRegistry.ts     champions-v1 entry
```

## Reuse map

| Need | Reuse |
|---|---|
| Phase machine / lives / question delegation | `BossScene.tsx` (adapt) |
| Question sub-scenes | `AudioPickScene` / `ImagePickScene` / `TranslatePickScene` / `SentenceClozeScene` / `VisualPickScene` |
| Creature contract + reduced-motion | `BossCreatureProps`, the `bosses/*` pattern |
| Specific (non-random) card grant | `grantSpecificCardInTx` (admin-grants) |
| Reward-only card pack | festival/season pattern (`gacha_eligible=false`, shard-exclusive) |
| Cosmetic grant + auto-equip | `grantFestivalCosmeticInTx` / `grantContinentRewards` |
| Trophy grant | `checkAndGrantTrophies` + `seed-trophies.ts` |
| Reveal UI | `CardChestReveal` + `TrophyToast` |
| Map list / switch / lock | `listMapsForChild`, `switchMapAction`, `MapLockedError` |
| Voyage board / layout | `VoyageBoard`, `voyageLayout`(+Horizontal) |
| Bilingual chrome | `bi()` |

## Testing (mock `@/db`, Clerk, `next/*`, `ai`)

- `isMapFullyCleared`: true only when every published week is `bossCleared`.
- Gating: map N locked until map N-1 in `final_boss_clears`; Map 1 never gated; 0-week packs still locked.
- `mapOrderIndex`: parses `pirate-class-level-N`; non-conforming slugs sort last.
- `buildFinalBossPhases`: 3 groups, ~6 each, targets drawn from the map pool, valid question types, deterministic under injected rng.
- `FinalBossScene`: phase advance on a cleared phase; full restart to Phase 1 on life-out; victory delayed by defeat timer; reduced-motion path.
- `finishFinalBossAction`: grants bundle on first clear; idempotent (no double grant / second call returns alreadyCleared); anti-cheat (rejects if not fully cleared); is `requireChild`-gated (distribution-isolation guard).
- Champions pack: `gacha_eligible=false`, in `SHARD_SWAP_EXCLUSIVE_PACKS`; champion cosmetics reward-only + excluded from shop chips.

## Out of scope (explicit deferrals)

- Per-phase checkpoint retry (David chose full restart).
- A title *equip/switch* UI (the chip is derived from the latest map beaten; a wardrobe of titles can come later).
- Co-op / timed / leaderboard boss modes.
- A bespoke final-boss music track (reuse the current sound theme).
- 印度洋's overlord component (added with its authoring; the registry + gating support it now).

## PR breakdown (for the plan)

1. **Core final boss + rewards:** migration (`final_boss_clears`), `buildFinalBossPhases`, `GhostGalleon` + roster, `FinalBossScene`, `final-boss` route, `champions-v1` pack + champion cosmetic + trophy, `finishFinalBossAction`, reveal wiring. (Reachable via a temporary direct link / once a test child has all weeks cleared.)
2. **Map gating + voyage lair node + home title chip:** `listMapsForChild` gating, `switchMapAction` guard, `MapCard` gated state, `VoyageBoard` lair node + layout, `ChampionTitleChip`. Post-merge: `seed-champions-pack.ts`, `seed-trophies.ts`, champion card CF-flux art (~1-2 images), seed champion avatar items.

## Open questions (non-blocking)

1. **Overlord identity** — Caribbean = 幽灵旗舰 / Ghost Galleon (proposed). Rename freely.
2. **Phase size** — fixed ~6/phase, or scale with map size? Default fixed 6 (18 total); small maps (<18 chars) sample with repeats, like Study Mode.
3. **Champion card rarity weight** — moot (reward-only, never pulled); set `dropWeight` to a neutral 1.
