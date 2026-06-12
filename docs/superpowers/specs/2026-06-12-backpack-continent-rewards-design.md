# Backpack continent rewards + nav (PR-A: trophies + nav)

> David's pick from the Backpack follow-up bucket. Completing a whole continent's
> flags should reward the kid, and 193 flags across 6 continents need quick nav.
> Decisions (2026-06-12): reward = **trophy + continent avatar cosmetic**; nav =
> **scroll-jump**; scope = **flags only**.
>
> Split for reviewability: **PR-A (this doc)** = nav + completion **trophies**.
> **PR-B (follow-up)** = the 6 continent avatar cosmetics + wardrobe. Yinuo hasn't
> completed any 193-flag continent yet, so PR-B needs no backfill.

## PR-A scope

### Continent nav (scroll-jump)
`PackPageBody` already groups flags/landmarks/solar via `meta.grouping`. Add a
sticky chip strip (one chip per non-empty group, generic across grouped packs)
above the sections; each section gets `id="pack-section-<key>"` + `scroll-mt-14`,
and a chip calls `getElementById(...).scrollIntoView({behavior:'smooth'})`.

### Completion trophies (6)
- `continentRewards.ts` (pure): `CONTINENT_REWARDS` (continent → `{trophySlug,
  avatarItemRef}`) + reverse `TROPHY_TO_CONTINENT`. The `avatarItemRef` is unused
  in PR-A (PR-B grants the cosmetic).
- 6 trophy rows in `seed-trophies.ts` (`continent-asia`…`continent-oceania`,
  category `collection`, displayOrder 27–32).
- `getCompletedFlagContinents(childId)` in `trophies-evaluators.ts`: groups the
  `flags-v1` catalog by `FLAGS_BY_SLUG[slug].continent`, returns continents whose
  every flag is owned.
- `checkAndGrantTrophies` gains a `{ kind: 'continent-complete' }` case that adds
  each completed continent's `trophySlug` (existing dedup → only newly-earned
  come back).

### Grant wiring (idempotent, guarded)
A flag can complete a continent on any grant path:
- `finishLevelAction` — after `cardGrants`, if any granted card is `flags-v1`,
  push `checkAndGrantTrophies(..., 'continent-complete')` into `collectedTrophies`
  → surfaces via the existing `TrophyToast`.
- `swapShardsForItem` — on a `flags-v1` swap, returns `continentTrophies`;
  `PackPageBody` shows a `TrophyToast` (the deliberate "swap for the last flag"
  completion).
- `pullCardForChild` + `claimWeeklyGiftIfDue` — guarded fire-and-forget grant so
  story/gift completions never miss the trophy (surfaced next render / in the
  trophy hall).

## Tests
- `check-and-grant-trophies`: continent-complete grants per completed continent / [] when none.
- `pack-page-body-grouped`: nav chips per non-empty continent + scroll on tap.
- `continent-rewards`: reward table completeness + `TROPHY_TO_CONTINENT` round-trip.

No migration, no recompile. **Post-merge op:** `pnpm tsx scripts/seed-trophies.ts`
(idempotent — inserts the 6 new continent trophies).

## PR-B (follow-up)
6 reward-only avatar cosmetics (`theme='continent'`), granted + auto-equipped
alongside the continent trophy (mirror `grantFestivalCosmeticInTx`), surfaced in a
generalized reward wardrobe (extend the festival wardrobe to show continent items
too). Seed `scripts/seed-continent-avatar-items.ts`.
