# Lunar calendar + festival Monthly Challenge — design

> **Status:** approved scope. PR-3 of the 3-PR arc (16:9 shell #77 ✓ → home map art #78 →
> **lunar calendar + Monthly Challenge**). Phased: **Phase A** (this PR) = lunar calendar +
> challenge engine + festival **card** reward; **Phase B** (PR-3b, fast-follow) = festival
> **avatar cosmetics** reward.

## Why

David wants the `/calendar` page to show the **农历 (lunar) calendar** — mainly the normal
Gregorian month, but marking traditional Chinese festivals + 24 节气 — and a **Chinese-culture
Monthly Challenge** layered on top: complete an **active-days** goal each month → win a
**festival collectible card** (Phase A) and **festival avatar cosmetics** (Phase B). Reward +
goal shape locked with David.

## Decisions (locked)

- **Lunar data:** `lunar-typescript` (6tail) — pure, deterministic, no network. Wrapped in
  `src/lib/calendar/lunar.ts`.
- **Two-track festival logic** (avoids the 农历-drift trap):
  - **Calendar grid** shows the *accurate* per-day 农历 day + real festival/节气 badges from
    the lib (春节 lands on its true day).
  - **Monthly challenge** uses a *fixed* Gregorian-month → festival-theme map (predictable for
    a 6yo; our activity data is Gregorian-keyed).
- **Festival cards are reward-only** — a new `festivals-v1` collectible pack shown in the
  Backpack but **excluded from gacha + the weekly 大礼包** via a new additive
  `collection_packs.gacha_eligible` flag (festivals=false; all existing packs=true).
- **Emoji-glyph cards** (🧧🏮🐲🌕🥟…) — no image-gen (mirrors dinosaurs/landmarks packs).
- **Active-days tracking** reuses `getActivityForRange` (distinct played days in the month).

## Phase A — components & responsibilities

### 1. Lunar wrapper — `src/lib/calendar/lunar.ts`
`lunarInfo(iso: string): { dayZh: string; monthZh: string; festival?: string; solarTerm?:
string; isFestival: boolean }`. Uses `Solar.fromYmd` → `.getLunar()` → `getDayInChinese()`,
`getMonthInChinese()`, `getJieQi()`, `getFestivals()`/`getOtherFestivals()` (pick the first
kid-relevant one). Pure; unit-tested against a few known dates (春节, 中秋, a 节气, an ordinary
day). New dep: `lunar-typescript`.

### 2. Festival theme map — `src/lib/calendar/festivals.ts`
`FESTIVAL_THEMES: Record<1..12, FestivalTheme>` where `FestivalTheme = { id, nameZh, nameEn,
emoji, cardSlug, blurbZh, blurbEn, thresholdDays }`. `festivalThemeForMonth(yyyymm)` returns the
theme. 12 kid-friendly themes (one per Gregorian month), e.g. Feb→春节🧧, Apr→清明🌿, Jun→端午🐲,
Sep→中秋🌕, Dec→冬至🥟, plus 节气/seasonal fillers (二月二🐉, 夏至🪷, 重阳🌼, 立冬⛄…). `cardSlug`
points at the matching `festivals-v1` collectible. `thresholdDays` default **12** active days.
Pure data + unit test (all 12 months resolve; slugs unique; thresholds 1–28).

### 3. `festivals-v1` collectible pack
- Data: `src/lib/collections/festivalsData.ts` — 12 `FestivalItem { slug, nameZh, nameEn, emoji,
  loreZh, loreEn }` (one per theme), `FESTIVALS_BY_SLUG`.
- Card component: `src/components/play/items/FestivalCard.tsx` (mirrors `LandmarkCard`: emoji via
  `CardArt`, bilingual name, lore at `lg`). `ItemCardProps`.
- Registry: add a `festivals-v1` entry to `packRegistry.ts` (`themeEmoji: '🎏'`, bilingual names,
  `paidPullCost` unused — reward-only; `ItemCard: FestivalCard`).
- Seed: `scripts/seed-festivals-pack.ts` (insert-missing the pack row with
  `gacha_eligible=false` + 12 `collectible_items`). Idempotent, `loadEnv` + dynamic import.

### 4. Schema — migration `0025`
- `collection_packs.gacha_eligible boolean NOT NULL DEFAULT true` (additive; existing rows →
  true via default).
- New `festival_challenge_claims` table: `child_id text`, `month_key text` (`yyyy-mm`),
  `card_slug text`, `claimed_at timestamptz default now()`, **PK (child_id, month_key)**
  (idempotency).
- Drizzle: edit `src/db/schema/*.ts` (source of truth) → `pnpm drizzle-kit generate` → new
  `drizzle/0025_*.sql`. Append-only.

### 5. Gacha exclusion
- `pullCardInTx` (weighted catalog) and `grantGiftPackInTx` (one card per active pack) filter to
  packs with `gacha_eligible = true`. The festivals pack therefore never drops from gacha/gift.
  Add a regression test that a `gacha_eligible=false` pack is excluded from the gift loop.

### 6. Challenge engine — `src/lib/db/festival-challenge.ts`
- `getMonthlyChallengeState(childId, yyyymm)`: `theme = festivalThemeForMonth(yyyymm)`;
  `activeDays = ` distinct played days in `getActivityForRange(child, monthStart, monthEnd)`;
  `claimed = ` row exists in `festival_challenge_claims`; `eligible = activeDays >= threshold &&
  !claimed`. Returns `{ theme, activeDays, threshold, claimed, eligible }`.
- `claimFestivalRewardInTx(childId, yyyymm)`: re-checks eligibility inside a tx; inserts the
  claim row (23505 → already-claimed); grants the theme's festival card into the child's
  collection (reuse the collectible-grant insert: `child_collections` upsert, count++ if dupe);
  returns a `RevealCard` for the reveal.

### 7. Server action — `src/lib/actions/festival.ts`
`claimFestivalReward(childId, yyyymm)` (`'use server'`, `requireChild`) → calls the tx helper,
`revalidatePath('/play/[childId]/calendar')`, returns `{ granted, card? }`. Async-export-only.

### 8. Calendar UI — `MonthCalendar.tsx` + page
- Page (`calendar/page.tsx`) additionally computes `getMonthlyChallengeState(child, yyyymm)` and
  passes it down.
- Grid cells: add the **农历 day** (small, under the Gregorian number) and a **festival/节气
  badge** (emoji) from `lunarInfo`. Keep the existing activity icons (⭐🪙❄️●).
- New **`FestivalChallengePanel`** (`src/components/play/FestivalChallengePanel.tsx`, client):
  festival emoji + bilingual name + blurb, an **active-days progress bar** (`activeDays /
  threshold`), and a **claim button** (enabled when `eligible`) → `claimFestivalReward` →
  `CardChestReveal` of the festival card. Claimed state shows "已领取 / Claimed ✓". Bilingual
  per the chrome rule.

### 9. Tests (mock `@/db`, clerk, next/cache, next/navigation)
- `lunar.ts`: known dates.
- `festivals.ts`: 12 months resolve, unique slugs.
- `festival-challenge`: eligible at threshold, not before; claimed blocks re-grant; idempotent.
- gacha exclusion: `gacha_eligible=false` pack skipped in gift loop.
- `FestivalChallengePanel`: progress bar width, claim disabled below threshold, claimed state.
- `MonthCalendar`: a cell shows a 农历 day; a festival day shows its badge.
- Four-green gate is the bar.

## Phase B — festival avatar cosmetics (PR-3b, fast-follow, NOT this PR)

Register a `festival` avatar theme (`AVATAR_THEMES`), add ~12 festival avatar items (SVG
components + `avatar_items` seed, reward-only — not in shop). Extend `claimFestivalRewardInTx`
to also grant the month's festival avatar item into `child_avatar_inventory`. Surfaced via a
toast alongside the card reveal. Kept separate because it's ~12 hand-rolled SVGs + the
avatar-theme seed surface — a clean unit on its own. (David asked for both rewards; Phase B
delivers the second.)

## Risks / landmines

- **农历 drift:** never map a fixed Gregorian month to an *exact* festival date — only to a
  festival *theme*. The grid badges use the lib for real dates.
- **Gacha entanglement:** the festivals pack MUST be `gacha_eligible=false`, and both grant
  paths MUST filter on it, or festival cards leak into normal gacha + the 大礼包 count (which is
  "one per active pack" — a 7th active pack would silently change the gift size).
- **`lunar-typescript` bundle:** client `MonthCalendar` needs lunar data; prefer computing
  `lunarInfo` **server-side** in the page and passing plain `{dayZh, badge}[]` to the client
  grid, so the lib doesn't ship to the client bundle. (Keeps the client light + SSR-safe.)
- **Idempotency:** claim is once-per-(child,month) via the PK; the action re-checks in-tx.
- **Bilingual chrome** rule applies to the panel + any new labels.
- **Migration auto-applies on Vercel build** (and local `pnpm build` hits prod) — additive only,
  safe.

## Verification (manual)

1. `/calendar` shows 农历 day in each cell + festival/节气 badges on the right days.
2. The challenge panel shows the month's festival theme + active-days progress.
3. At ≥ threshold active days, the claim button enables → tap → festival card reveal → card
   appears in Backpack; panel flips to Claimed. Re-tap is a no-op.
4. The festival card never appears from a boss-clear / 大礼包 gacha pull.
