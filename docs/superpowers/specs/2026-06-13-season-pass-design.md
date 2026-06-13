# Season Pass — Design Spec

> **Status:** Approved-for-planning draft (2026-06-13). Supersedes §5 of
> `2026-05-25-daily-quests-and-season-pass-design.md`, which predates the XP
> foundation shipping, the card-economy redesign, and the reward-only-theme
> cosmetic pattern. The XP + Daily Quests half of that older spec is **already
> shipped**; this document covers only the Season Pass.

**Goal:** A themed, limited-time 30-tier reward track that turns the
already-shipped XP currency into a season-long goal, with zero changes to any
existing earn loop.

**Architecture:** Season progress is **derived** from the existing `xp_events`
ledger (sum of XP earned within the season's date window) — no new XP column, no
"reset." A date-driven `seasons` row holds a JSONB tier config; per-child claim
state is an `int[]` of claimed tiers. Rewards dispatch by type, reusing the
existing coin / powerup / shard / collectible-card / reward-only-avatar-theme
mechanics.

---

## 1. Decisions locked with David (2026-06-13)

| Decision | Choice |
|---|---|
| **Season clock** | **Calendar-fixed, shared.** Real Gregorian window; every account shares the same countdown. |
| **"Gacha token" tiers** | **Season-exclusive collectible cards** — a reward-only pack `season-summer-v1` (like festival cards: `gacha_eligible=false`, shown in Backpack, never dropped by gacha/大礼包). |
| **Season end** | **Auto-bank everything reached, nothing lost.** No FOMO. |
| **v1 scope** | **Full 30 tiers** + ~8 season-exclusive avatar cosmetics. |

**Defaults taken (not separately confirmed — flag if you disagree):**

1. **Season 1 goes live ~immediately** (seed `starts_at` ≈ deploy date, `ends_at` = +8 weeks) so Yinuo can play it now, rather than honoring a future 07/01 start + a "coming soon" countdown. The engine is fully date-driven, so changing the window later is a one-row edit.
2. **The 1.5× final-week multiplier is dropped for v1.** It fights the clean "derive season XP from the ledger" model (a retroactive multiplier would need per-event weighting). Deferred as a later enhancement (would be implemented by emitting a separate `season_bonus` XP event in the final week).
3. **Season cosmetics grant to inventory only — NOT auto-equipped** (unlike festival/continent cosmetics, which auto-equip). A 30-tier track grants many cosmetics; auto-equipping each on claim would thrash the kid's chosen look. They surface in the existing **奖励衣橱 / Rewards Wardrobe**. The **Tier-30 grand set is the one exception** — it auto-equips as a celebratory moment.
4. **The Tier-30 "animated 夏季航海大师 badge" becomes a trophy** (`season-summer-master`, reusing the trophy system + trophies hall) rather than a bespoke animated profile-badge widget.

---

## 2. Season engine

### 2.1 Schema (migration 0029)

```sql
-- New table: seasons (one active at a time; date-driven)
CREATE TABLE seasons (
  id          TEXT PRIMARY KEY,            -- slug: 'summer-voyage-2026'
  name_zh     TEXT NOT NULL,               -- '夏季航海'
  name_en     TEXT NOT NULL,               -- 'Summer Voyage'
  theme_emoji TEXT NOT NULL,               -- '⛵'
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  tier_config JSONB NOT NULL,              -- SeasonTier[] (see §3)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New table: child_season_progress (claim state only — XP is derived)
CREATE TABLE child_season_progress (
  child_id      UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  season_id     TEXT NOT NULL REFERENCES seasons(id),
  tiers_claimed INTEGER[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, season_id)
);

-- Enum additions (append-only):
ALTER TYPE coin_reason     ADD VALUE 'season_reward';
ALTER TYPE trophy_category ADD VALUE 'season';
```

Source of truth is `src/db/schema/*.ts`; the SQL above is what the generated
migration must produce. `tiers_claimed` as a Postgres `int[]` mirrors the
existing `child_season_progress` sketch and the `int[]`-style state used
elsewhere; membership checks happen in JS after a single read.

### 2.2 Derived season XP (the core correction)

```ts
// src/lib/db/season.ts
export async function getSeasonXp(childId: string, season: SeasonRow): Promise<number> {
  // SUM(xp_events.amount) WHERE child_id = childId
  //   AND created_at >= season.startsAt AND created_at <= season.endsAt
  // After season end the sum is naturally frozen (no events past ends_at count).
}
```

`child_xp.totalXp` and the cosmetic player level are **never touched** by the
season — they remain a permanent lifetime total. "Season XP reset" from the old
spec disappears entirely: a new season simply has a later `starts_at`, so its
window sums different ledger rows. (Plan note: verify `xp_events.created_at`
exists with a `defaultNow()` — `awardXp` inserts without setting it, so it must
default.)

`tierForSeasonXp(xp, tierConfig)` → highest tier whose cumulative `xpRequired ≤
xp` (0 if below tier 1). Pure function, unit-tested independently.

### 2.3 Claim model

- **During the season:** a reached-but-unclaimed tier is **claimable**. The kid taps 领取 / Claim on the season page (instant, no cost) → reward is granted + a chest reveal plays for card/cosmetic tiers (coins/shards/powerups just animate). A **一键领取 / Claim all** button claims every currently-claimable tier in sequence.
- **Idempotency:** claiming appends the tier to `tiers_claimed` inside the grant transaction; a tier already in the array is a no-op. Re-tapping or concurrent calls can't double-grant.
- **Season end (auto-bank, nothing lost):** `syncSeasonProgress(childId)` runs on home + season page render; if `now > ends_at`, it sweeps every reached-but-unclaimed tier and grants it silently (no reveal needed — surfaced in a recap). This satisfies the "nothing lost" choice while keeping per-tap reveals during the active season.

---

## 3. Tier config — "夏季航海 / Summer Voyage" (30 tiers)

`SeasonReward` union (drives the dispatch switch):

```ts
type SeasonReward =
  | { type: 'coins';       amount: number }
  | { type: 'powerup';     kind: 'skip' | 'streak_freeze'; count: number }
  | { type: 'shards';      amount: number }
  | { type: 'card';        cardSlug: string }          // within season-summer-v1
  | { type: 'cosmetic';    unlockRef: string }         // avatar_items.unlock_ref
  | { type: 'cosmetic_set'; unlockRefs: string[]; trophySlug: string }; // T30 grand

interface SeasonTier { tier: number; xpRequired: number; reward: SeasonReward; }
```

| Tier | Cumulative XP | Reward |
|---|---|---|
| 1 | 50 | 🪙 100 coins |
| 2 | 100 | 🎀 cosmetic — 水手帽 / Sailor Hat (`season-sailor-hat`) |
| 3 | 175 | 🪙 50 coins |
| 4 | 250 | 🧊 1× Streak Freeze |
| 5 | 350 | 🎀 cosmetic — 船锚挂饰 / Anchor Charm (`season-anchor-decor`) |
| 6 | 450 | 🪙 100 coins |
| 7 | 550 | ⏭️ 2× Skip |
| 8 | 675 | 🔹×5 shards |
| 9 | 800 | 🎀 cosmetic — 鹦鹉肩饰 / Parrot Pauldron (`season-parrot-decor`) |
| 10 | 950 | 🎴 season card — 海龟船长 / Captain Tortoise (`season-tortoise`) |
| 11 | 1,100 | 🪙 150 coins |
| 12 | 1,250 | ⏭️ 2× Skip |
| 13 | 1,400 | 🎀 cosmetic — 望远镜 / Spyglass (`season-spyglass-decor`) |
| 14 | 1,575 | 🪙 200 coins |
| 15 | 1,750 | 🎀 cosmetic — 船舵挂饰 / Ship Wheel (`season-wheel-decor`) |
| 16 | 1,950 | 🧊 1× Streak Freeze |
| 17 | 2,150 | 🪙 250 coins |
| 18 | 2,350 | 🎀 cosmetic — 夕阳海湾背景 / Sunset Bay (`season-sunset-bg`) |
| 19 | 2,575 | 🎴 season card — 飞鱼信使 / Flying-Fish Courier (`season-flyingfish`) |
| 20 | 2,800 | 🎴 season card — 海豚伙伴 / Dolphin Friend (`season-dolphin`) |
| 21 | 3,050 | 🪙 300 coins |
| 22 | 3,200 | 🔹×8 shards |
| 23 | 3,300 | 🪙 300 coins |
| 24 | 3,400 | 🔹×8 shards |
| 25 | 3,500 | 🎴 epic season card — 黄金海怪 / Golden Kraken (`season-kraken`) |
| 26 | 3,650 | 🪙 400 coins |
| 27 | 3,800 | 🪙 400 coins |
| 28 | 3,900 | 🔹×10 shards |
| 29 | 3,950 | 🪙 400 coins |
| 30 | 4,100 | 🏆 **Grand prize** — cosmetic_set: 船长大衣 (`season-captain-coat`, top) + 船长帽 (`season-captain-hat`, hat) + trophy `season-summer-master` (夏季航海大师), **auto-equipped** |

- **8 cosmetics** (slots: hat ×2, top ×1, decor ×4, background ×1) — `theme='season'`, `rewardOnly`.
- **4 season cards** in pack `season-summer-v1`.
- Remaining tiers: coins / powerups / shards (all reuse shipped mechanics).

---

## 4. Reward dispatch

`claimSeasonTierInTx(tx, childId, tierConfig, tier)` — switch on `reward.type`,
mirroring `purchaseShopItemInTx`'s dispatch and the festival/continent grant
helpers:

| `type` | Action |
|---|---|
| `coins` | insert a `coin_transactions` row (reason `season_reward`) + bump balance — reuse the in-tx coin grant. |
| `powerup` | upsert `powerup_inventory(childId, kind)` `+count`. |
| `shards` | upsert `child_shards(childId)` `+amount` (universal wallet). |
| `card` | resolve `collectible_items` by `(pack season-summer-v1, slug=cardSlug)` → grant into `child_collections` (dupe → ×N bump) → return `RevealCard`. Mirrors `claimFestivalReward` steps 2–3. |
| `cosmetic` | grant to `child_avatar_inventory` only (`onConflictDoNothing`), **no equip**. |
| `cosmetic_set` | grant each `unlockRef` to inventory, **auto-equip** all (celebratory), grant trophy via `checkAndGrantTrophies(childId, { kind: 'season-master' })`. |

All grants happen inside the same transaction that appends `tier` to
`tiers_claimed`, so claim + reward are atomic. Card/cosmetic results bubble up as
`RevealCard[]` / cosmetic refs for the reveal UI.

---

## 5. Season-exclusive cards (`season-summer-v1` pack)

- New `collection_packs` row, `is_active=true`, **`gacha_eligible=false`** (the festival flag — never dropped by boss/perfect/story/大礼包). Shown in Backpack as a normal pack.
- New `src/lib/collections/seasonCardsData.ts` (4 cards, bilingual name + lore, emoji glyph fallback) + `SeasonCard` component **wired through `CardArt`** (img when `image_url` set, else emoji — same as SeaCreature/Dinosaur/Solar/Landmark cards) + a `PACK_REGISTRY['season-summer-v1']` entry (`paidPullCost: 0`, `resolveRevealEmoji`).
- `scripts/seed-season-cards.ts` seeds the pack `gacha_eligible=false` + 4 `collectible_items` (idempotent insert-missing, mirrors `seed-festivals-pack.ts`). **Required before any card tier can be claimed** (claim throws if a referenced card isn't seeded — same contract as `claimFestivalReward`).
- **Real card art via Cloudflare flux (free tier):** extend `scripts/generate-collectible-art-cloudflare.ts` with a `season-summer-v1` prompt recipe (nautical cartoon, per-card subject: tortoise captain / flying-fish courier / dolphin friend / golden kraken) → generates 4 `@cf/black-forest-labs/flux-1-schnell` 1024² JPEGs, uploads to Blob `collectibles/{itemId}.jpg`, writes `collectible_items.image_url`. Idempotent; 4 images is trivially within the free daily Neuron allowance. Cosmetics do **not** use flux (see §6).

## 6. Season cosmetics (avatar theme `'season'`)

- Add `'season'` to `AVATAR_THEMES`, `THEME_DISPLAY_NAMES` (夏季航海 / Summer Voyage), and `REWARD_THEMES` (so it's excluded from the shop chip filter), in `src/lib/avatar/themes.ts`. Broaden the Rewards-Wardrobe theme list (`REWARD_WARDROBE_THEMES` in `shop.ts`) to include `'season'` so claimed cosmetics are re-equippable there.
- 8 procedural-SVG items in `src/lib/avatar/itemCatalog.tsx`, `theme: 'season'`, `rewardOnly: true`, `unlock_via: 'achievement'`, each with the `unlock_ref` used in the tier table.
- `scripts/seed-season-avatar-items.ts` (or extend `seed-festival-avatar-items.ts`'s `rewardItems()` sweep) seeds the 8 `avatar_items` rows. **Required before cosmetic tiers grant** (grant is best-effort: a missing item no-ops, like festival/continent).

---

## 7. UI

**Home page** (`/play/[childId]/page.tsx`) — a compact **赛季 banner** below the
Daily Quests panel:

> ⛵ 夏季航海 · Tier 12/30 · 距下个奖励 还需 320 XP   `[N 个奖励可领]`

Links to `/play/[childId]/season`. Shows a "🎁 N 可领" chip when
reached > claimed. Hidden when no season is active.

**Season route** `/play/[childId]/season` — vertical 30-tier track:

- Top: season name + emoji, XP bar (`当前 1,430 / 下一档 1,575 XP`), countdown (`距赛季结束 23 天`).
- Each tier row: number, reward icon + bilingual name, state — 🔒 locked (grey) / 🎁 可领 (teal glow, 领取 button) / ✅ 已领 (gold check). `一键领取 / Claim all` button when any are claimable.
- Claiming a card/cosmetic tier plays the existing `CardChestReveal`; coins/shards/powerups animate inline.
- `lg:` landscape layout per the shell convention (two-column or wider track on ≥1024px). **Bilingual chrome throughout** (`bi()` / paired spans) — the bilingual-chrome test guards nav.
- `KidNavBar`: the season is reachable from the home banner (no new nav tab in v1; revisit if David wants a dedicated tab).

---

## 8. Integration points

**Zero changes to earn loops.** Season XP is purely derived from the XP that
`finishAttemptAction` / quests / `finishLevelAction` / homework already emit. The
only new call sites:

| Surface | New call |
|---|---|
| Home page render | `syncSeasonProgress(childId)` (banks tiers if season ended) + `getSeasonBannerState(childId)` for the banner. |
| Season page render | `getSeasonView(childId)` (tiers + states + XP + countdown). |
| `claimSeasonTierAction` / `claimAllSeasonTiersAction` | user-tappable server actions (`requireChild`) → `claimSeasonTierInTx`. |

No existing action is modified. (Optional, deferred: tick a future `season_tier`
quest — not in v1.)

## 9. Seeds & post-merge ops

- Migration 0029 auto-applies on the Vercel build (`scripts/migrate.ts`).
- `scripts/seed-season-summer.ts` — inserts the `seasons` row + `tier_config` (the §3 table) with `starts_at`/`ends_at`. **The tier config lives in code** (`src/lib/season/summerVoyage.ts`) and the seed writes it to JSONB, so the table and the typed config can't drift.
- `scripts/seed-season-cards.ts` — the `season-summer-v1` pack + 4 cards.
- `scripts/seed-season-avatar-items.ts` — the 8 cosmetics.
- `scripts/seed-trophies.ts` — add `season-summer-master` (category `season`).

All idempotent. Run order post-deploy: migrate (automatic) → seed-season-cards →
seed-season-avatar-items → seed-trophies → seed-season-summer (last, since claims
reference the cards/cosmetics).

## 10. Testing

- `season/levels` pure: `tierForSeasonXp`, next-tier XP-to-go, claimable-set derivation.
- `getSeasonXp` window sum (mock `@/db`): events inside vs outside `[starts_at, ends_at]`.
- `claimSeasonTierInTx` per reward type: coins/powerup/shards/card/cosmetic/cosmetic_set; idempotency (already in `tiers_claimed` → no-op); card-not-seeded throws.
- `syncSeasonProgress`: end-of-season auto-bank sweep; mid-season no auto-bank.
- Actions: `claimSeasonTierAction` rejects an unreached tier; `requireChild` gate.
- UI: season banner states (locked / claimable / none-active); season track row states; bilingual-chrome regression for new nav-ish labels.
- Mock `@/lib/db/season` (and any new `@/lib/db/*`) wherever an action under test imports it (the standard DATABASE_URL-in-tests hazard).

## 11. Out of scope / deferred

- 1.5× final-week multiplier (default #2).
- Off-season state / Season 2 authoring (after end, the pass shows a recap, then "敬请期待下一季" until a new season is seeded).
- Season sound-theme / pet rewards (kept to coins/powerup/shards/card/cosmetic — 5 dispatch types).
- A dedicated 赛季 nav tab (reached via home banner in v1).
- Paid tier (never — free product).
- Cosmetic art stays procedural SVG (avatar layers can't be raster flux images). The 4 season **cards** DO get flux art in this PR (§5).
- **Adjacent CF-flux art upgrades (separate follow-ups, not this PR):** (a) the 2 home **voyage-map backdrops** — generator `scripts/generate-voyage-map-art.ts` is ready and only needs a fresh `CF_API_TOKEN` run + pasting 2 URLs into `map-boards.ts` (already a queued post-merge op); (b) the **12 festival cards** are still emoji-only — wiring `CardArt` into `FestivalCard` + a flux backfill would bring them up to the same bar as the other packs. Both fit comfortably in the free daily allowance and are good "art polish" PRs to batch one-per-day.

## 12. Open questions

1. **Live-now vs 07/01 start** (default #1: live now). Confirm.
2. **Banner placement** — below Daily Quests panel on home (assumed). OK, or do you want it higher/more prominent?
3. **Season length** — 8 weeks assumed. Shorter (6) makes Tier 30 harder to reach for casual play; longer (10) dilutes urgency. 8 is the recommended default.
