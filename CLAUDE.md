# Fast-start for Claude (and other agents)

This file is auto-loaded into every session. Read it once, decide whether you need any of the deeper docs (PLAN / ARCHITECTURE / GAME-DESIGN), then go. **Do not read the deep docs unless the triage table below tells you to.**

For Codex / other tooling that follows the `AGENTS.md` convention: see `AGENTS.md` (kept as a thin shim).

---

## What this is

**hanzi-quest** (deployed as `hanzi-adventure.vercel.app`) — a personal Chinese-character learning game for the maintainer's 6-year-old daughter Yinuo. Pirate-adventure art direction. Parent (David) authors weekly character lists in an admin panel; AI generates kid-friendly scenes; child plays a 12-15-level "island" of mini-games per week, with a boss kraken + treasure-chest gacha on weeks with ≥10 characters.

It is **not** a multi-tenant SaaS. Optimize for Yinuo's daily fun, not for theoretical other users.

---

## Current state (last refreshed 2026-05-24)

**Shipped:** PR #1 → #36. The product is end-to-end playable in production: weekly authoring, AI scene generation (DeepSeek V4 Pro, **V2 schema with per-word imageHook**), shared `pirate-class-level-1` curriculum pack with 10 weeks published, **island map → week hub → 3 separately-enterable sections** (回顾 / 练习 / Boss战), **9 active scene types + boss** (pinyin_pick retired; image_word added), coins (with daily-login / streak-milestone / perfect-week bonuses + a `BonusToast` HUD layer), **5 collection packs** in the Collector's Atlas (`/play/[childId]/collection` → museum of packs, per-pack `/collection/[packSlug]` pages): zodiac (12), flags (30), sea creatures (20), dinosaurs (15), solar system (10). **Shop hub** (`/play/[childId]/shop` → tabbed UI, **4 of 5 tabs live**: Avatar, Sounds, Pet, Decor — only Powerups remains queued). Layered SVG avatar in play HUD, animations + audio + treasure-map cards, PWA manifest.

**PR #21–#27 (just shipped, 2026-05-19):**
- PR #21 (spec doc) + #22 (impl) — Shop hub + Avatar cosmetics. `/play/[childId]/shop`, `ShopHudButton` mounted in play layout, `AvatarRender` in island-map header, ~20 seeded items. New: `src/lib/db/shop.ts`, `src/lib/actions/shop.ts`, `src/lib/errors/shop-errors.ts`, `src/lib/avatar/{defaultLook,itemCatalog}.tsx`.
- PR #23 (spec doc) + #24 (impl) — Collector's Atlas hub + Flags pack. `/collection` is now `AtlasHub` (multi-pack lobby); `/collection/[packSlug]` is generic. New: `src/lib/collections/{packRegistry,flagsData}.ts`, `src/components/play/{AtlasHub,AtlasHallCard,PackGrid,PackPageBody}.tsx`, `src/components/play/items/{FlagCard,ZodiacGridItem}.tsx`. 30 country flags seeded into prod via `scripts/seed-flags-pack.ts`. Per-pack gacha cost from `getPackMeta(slug).paidPullCost` (zodiac=500, flags=300).
- PR #25 — Sea Creatures pack (20 bilingual ocean creatures, pirate-themed). `src/lib/collections/seaCreaturesData.ts` + `src/components/play/items/SeaCreatureCard.tsx`. Habitat instead of capital. cost=300.
- PR #26 — Dinosaurs pack (15 dinosaurs across Triassic/Jurassic/Cretaceous eras). Only 2 emojis exist (🦖/🦕), so `DinosaurCard` color-codes the card by era + renders a bilingual era badge for differentiation. cost=300.
- PR #27 — Solar System pack (8 planets + Sun + Moon = 10). Mostly coloured-disc emojis (🔴/🟠/🟡/🔵/🟣/⚪) plus the only real ones (🪐/☀️/🌝/🌍). `SolarBodyCard` colour-codes by body type (rocky/gas/ice/star/moon) + bilingual type badge. cost=300.
- PR #28 — Coin economy expansion. 3 new enum values on `coin_reason` (drizzle 0005): `daily_login` (+20, idempotent per UTC date), `streak_milestone` (+100 every 7 days, hooks the previously-empty `streaks` table via `tickStreak`), `perfect_week` (+200 when every scene of a week has at least one score=100 attempt; idempotent per week). New: `src/lib/db/streaks.ts` (tickStreak + todayUtcIso), `src/lib/db/play.ts isPerfectWeekForChild`, `src/components/play/BonusToast.tsx`. Actions return `bonuses: EconomyBonus[]` that the SceneRunner pipes into the toast layer.
- **PR #30 (just shipped, 2026-05-22)** — 4-segment weekly structure + 3 new scene types. `compileWeekIntoLevels` rewritten to emit `review → sound → sight → meaning → boss` blocks; new `pinyin_pick`, `translate_pick` (bidirectional CN↔EN), `sentence_cloze` scenes (all delegate to `MultipleChoiceQuiz`); boss question rotation widened from 3 → 6 types (word_match still excluded — it's a multi-character round); bilingual segment chip rendered in `SceneRunner` from each level's `sceneConfig.segment`. One-off `scripts/recompile-all-weeks.ts` recompiled all 10 published weeks in prod. Now **9 scene types + boss**.
- **PR #31 (just shipped, 2026-05-23)** — Sound / FX themes. 4 procedural Web-Audio themes (`music-box`, `retro-arcade`, `nautical`, `fanfare-plus`) live in the Sounds shop tab. New `child_settings` table (PK childId) stores `sound_theme_slug`; `setAudioTheme(slug)` swaps the runtime handler registry; `SoundThemeBootstrap` in the play layout hydrates it on mount. Shop card has 🔊 preview button. `scripts/seed-sound-themes.ts` seeds 4 `shop_items` rows. Equip is optimistic + immediate (no page reload).
- **PR #32 (just shipped, 2026-05-23)** — Achievements / Trophies. 20 trophies in 5 categories (mastery/streak/collection/coins/practice). New `trophies` + `child_trophies` tables (migration 0008) + `trophy_category` enum. `checkAndGrantTrophies(childId, context)` is the single grant API, wired into `finishAttemptAction`, `finishLevelAction`, `pullPaid`, `equipSoundThemeAction`. New `/play/[childId]/trophies` route reached via a 6th hall card on the Atlas Hub. `TrophyToast` (gold accent, animate-bonus-pop) renders alongside `BonusToast` in `SceneRunner`. One-off `scripts/backfill-trophies.ts` retroactively grants trophies — already ran for Yinuo (8 trophies inherited from existing play history).
- **PR #33 (shipped 2026-05-23)** — Static pet companion. 8 pets (parrot/crab/ship cat/monkey/sea turtle/dolphin/bat/glow jellyfish) in the new Pet shop tab, 300–1200 coins. Equipped pet renders beside the avatar on the island map only; tap → random bilingual speech bubble for ~2.5s. New tables `pets` + `child_pet_equipped`; pets seeded into `shop_items` via slug join; ownership derives from `shop_purchases`. `equipPetAction` validates ownership.
- **PR #34 (shipped 2026-05-24)** — Island decorations + shop purchase-dispatch fix. 10 hand-rolled SVG decorations (sailboat / seagull pair / hibiscus / fish school / compass rose / rainbow / pirate flag / whale tail / lighthouse / treasure chest, 200–1200 coins, total set ≈ 5,100) auto-appear at fixed anchors on the island map once owned (no equip UI; purchase = visibility). New `decorations` table + `'decor'` enum value (migration 0010). Anchors live in TS (`src/lib/decor/anchors.ts`), DB stores only the anchor slug. New `DecorTabBody` shop tab (now 4 of 5 live; Powerups remains queued). 2 new trophies: `decor-starter` + `decor-completionist`. **Also a regression fix**: `purchaseShopItemInTx` previously hardcoded `kind === 'avatar'` and silently blocked pet/sound-theme purchases at the SQL boundary — refactored to a `switch (kind)` dispatch. All 4 live shop tabs are now actually purchasable.

**Most recent regressions fixed:**
- PR #18 — `finishLevelAction` / `listWeekChars` used `getWeekOwnedBy` which fails for shared-pack weeks (parent_user_id NULL). Fixed by switching to `getPlayableWeekForChild`.
- PR #20 — flashcard hanzi was 14rem fixed → now `clamp(11rem, 55vw, 22rem)`; `ZodiacIconDefs` (SVG `<symbol>` defs) only mounted on `/collection`, broke chest reveal — now mounted in the play layout.
- PR #34 — `purchaseShopItemInTx` was avatar-only since PR #21; PRs #31 (sounds) and #33 (pets) shipped UI that called the action but it threw at the SQL boundary. Fixed via switch-kind dispatch — see the new "shop purchase dispatch" landmine below.

- **PR #35 (shipped 2026-05-24)** — Week hub restructure. Each week now splits into 3 separately-enterable sections via a new hub at `/play/[childId]/week/[weekId]` (sections: 回顾 / 练习 / Boss战, served at `/play/[childId]/level/[weekId]/[section]`). Old `/level/[weekId]` URL redirects to the hub. Boss locked until ≥6/12 practice scenes cleared. Practice quantity ~2× (5 → 12 scenes per 10-char week: 3 audio_pick + 3 sight + 6 meaning). `pinyin_pick` retired from compile + boss rotation (template flipped to is_active=false; component file retained for backwards compat). New `week_levels.level_key` column + unique constraint enables stable upserts — future compile changes preserve `scene_attempts.week_level_id` linkage. One-time progress reset accepted at ship time. All 10 prod weeks recompiled.

- **PR #36 (just shipped, 2026-05-24)** — Image-prompted word formation (text-stimulus, image-ready). New `image_word` scene type woven into the sight segment: shows a DeepSeek-generated kid-friendly description card + base 字 chip + 4 candidate 词. AI scene-gen pipeline extended to V2 (per-word `imageHook` added to `WeekContent`; persisted on new `words.image_hook` column, migration 0012). Practice grows 12 → 14 scenes per full week (2 image_word slots); boss unlock threshold bumps 6 → 7. Backfill script populated `image_hook` for all 238 existing prod words (~$0.10 DeepSeek). All 10 prod weeks recompiled (8 × 25 levels, 2 × 19 levels). **Real image generation is deferred to PR #37** — current stimulus is a stylized text "description card" that will swap to `<img>` once Vercel Blob + AI Gateway are provisioned (~5-line scene change).

**Next up:** **PR #37 — Flux image swap** (Vercel Blob + AI Gateway provisioning + `words.image_url` column + image-gen pipeline + 5-line stimulus swap). Plus the still-queued **consumable powerups** (hint / skip / streak-freeze). ALWAYS confirm with David before starting a new PR.

---

## Hard rules (non-negotiable)

1. **Never re-litigate locked decisions** without strong reason. Locked: pirate-adventure art direction; DeepSeek V4 Pro as AI provider; shared-pack model (rows in `weeks` table with nullable `parent_user_id`); pinyin hidden by default; age-appropriate vocab. If you want to change one, say so explicitly and explain why.
2. **`pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all be green** at PR open.
3. **Drizzle migrations are append-only.** Never edit a committed `drizzle/*.sql`. Generate a new one. Schema source of truth is `src/db/schema/*.ts` — SQL is generated from it, not vice versa.
4. **Tests mock external boundaries** (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). No test hits a real DB or network.
5. **Scripts that touch `process.env.DATABASE_URL`** must `loadEnv()` first, then dynamic-import the db client *inside* `main()` — see `scripts/seed-pirate-class.ts` and `scripts/recompile-pirate-class.ts`.
6. **Branch protection on `main`** is enforced (PR + CI required, admin bypass). Always work on a feature branch + PR. Never push to main.
7. **Use SSH for git push** (HTTPS will fail — David's setup).
8. **This is NOT the Next.js you know** — Next.js 16 App Router with renamed primitives. Read `node_modules/next/dist/docs/` before non-trivial work, and heed deprecation notices.

---

## Triage — when do I need a deeper doc?

| Task | Read this BEFORE coding |
|---|---|
| Add a new column / table / Drizzle migration | `ARCHITECTURE.md` §5 (schema) + §11 (cookbook) |
| Add a new scene type | `ARCHITECTURE.md` §8 (scene system) |
| Change AI prompt / scene-generation schema | `ARCHITECTURE.md` §7 + `GAME-DESIGN.md` §4 |
| Visual polish, palette, fonts | `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/art_direction.md` + `GAME-DESIGN.md` §5 |
| Reward formulas, coins, gacha rules | `GAME-DESIGN.md` §6 |
| "Is this in scope?" | `GAME-DESIGN.md` §9 (non-goals) + `PLAN.md` §4 (decisions log) |
| Picking the next chunk of work | `PLAN.md` §1 (status) — and **ask David first** |
| Bug fix in existing code | Skip the deep docs. Read the relevant `src/**` files. |

For most bug fixes and small features, you don't need any of the deep docs.

---

## Codebase map (where things live)

```
src/
  app/                  Next.js App Router pages
    play/[childId]/       Kid-facing surfaces (layout mounts ZodiacIconDefs + ShopHudButton)
      page.tsx              Island map + AvatarRender + coin pill + collection HUD
      level/[weekId]/       Scene runner (the 12-15 level sequence)
      collection/           Collector's Atlas hub (AtlasHub) — multi-pack lobby
      collection/[packSlug] Per-pack page (PackPageBody + paid pull)
      shop/                 Shop hub (tabbed: Avatar live; Sounds/Pet/Decor/Powerups WIP)
    parent/               David-facing admin (week authoring, child mgmt)
  components/
    scenes/               9 scene types + BossScene + SceneRunner + fx/*
    play/                 Kid-facing UI primitives (IslandMap, Zodiac*, HUD, AtlasHub, AvatarRender)
      items/                Per-pack card components (FlagCard, ZodiacGridItem) — ItemCardProps
    shop/                 Shop UI (ShopGrid, ShopItemCard, ShopCategoryTabs, PurchaseConfirmDialog)
    ui/                   Shared primitives (WoodSignButton, TreasureMapBackdrop)
    parent/               Admin forms + cards
  db/schema/            Drizzle source-of-truth tables — DO NOT edit drizzle/*.sql by hand
  lib/
    actions/              Server actions ('use server') — only async exports allowed
    db/                   Postgres queries (NEVER imported in client bundles)
    errors/               Pure error classes (client-safe — no postgres imports)
    scenes/               Scene compilation (compileWeekIntoLevels) + configs
    collections/          Per-pack data (flagsData) + pack registry (packRegistry) keyed by slug
    avatar/               defaultLook + itemCatalog.tsx (slot → SVG component map)
    audio/                Procedural Web Audio (ding/buzz/fanfare)
    hooks/                Client hooks (useReducedMotion, useCoinHud)
    auth/                 Clerk wrappers (requireChild, etc.)
drizzle/                Committed migrations (append-only)
scripts/                One-off ops scripts (seed, recompile, etc.)
tests/unit/             Vitest + RTL + jsdom — mocks all external boundaries
docs/superpowers/       Spec + plan docs from brainstorming/writing-plans skills
```

## Landmines (things that have bitten us)

- **Shared-pack week access**: rows in `weeks` with `parent_user_id IS NULL` belong to the curriculum pack, not a parent. Use `getPlayableWeekForChild(childId, weekId)` for any access check — NOT `getWeekOwnedBy(weekId, parentId)`. The latter silently 404s for pack weeks.
- **`'use server'` files** (anything in `src/lib/actions/`) can only export async functions. If you need to export an error class or sync helper, put it in `src/lib/errors/` (pure, client-safe) — do NOT import from `@/lib/db/*` in client code, postgres pulls in `fs`/`net`/`tls`.
- **`ZodiacIconDefs`** must be mounted in an ancestor of any `<ZodiacIcon>` use. Currently mounted in `src/app/play/[childId]/layout.tsx`.
- **React 19 strict mode** double-renders. Any `onComplete?.()` in a render body double-fires — wrap in `useEffect`.
- **`prefers-reduced-motion`** — every fx component must respect `useReducedMotion()` and fall back gracefully.
- **`DATABASE_URL` shared across Vercel envs** (Neon free tier) — production scripts can write to prod inadvertently. Confirm before running anything that mutates.
- **Bilingual rule for collectibles** (locked): Yinuo is English-native. All pack items render both `nameZh` AND `nameEn` side-by-side. Lore is also dual `loreZh`/`loreEn`. No language toggle. New packs must seed both columns.
- **Per-pack gacha cost lives in `packRegistry.ts`** (`getPackMeta(slug).paidPullCost`), NOT a DB column. Adding a new pack? Add an entry to `PACK_REGISTRY` with `paidPullCost`, `ItemCard` component, `themeEmoji`, bilingual display names + slogan, else `pullPaid` throws "no UI meta" and the per-pack page can't render.
- **`AvatarRender` uses `useId()` for clipPath IDs** — multiple instances on the same page collide otherwise. If you build a similar SVG component, use `useId()` not a hardcoded ID.
- **Never pass `PackUiMeta` (or any function-bearing object) from a server component into a `'use client'` component**: `meta.ItemCard` is a React component and `meta.resolveRevealEmoji` is a callback. RSC silently serialises everything else fine, then crashes at request time with `"Functions cannot be passed directly to Client Components"`. Local tests + `pnpm build` will NOT catch this — only prod / `pnpm dev` exercises the boundary. Fix pattern: take `packSlug: string` instead, and `getPackMeta(slug)` inside the client component. See `PackPageBody.tsx`.
- **`currentThemeSlug` in `src/lib/audio/play.ts` is a module-level singleton** — safe today because there is only one child session per browser tab, and `SoundThemeBootstrap` re-hydrates it on every play-layout mount. If multi-child switching is ever added (e.g. a parent previewing both children's islands in the same tab), the singleton will carry over the previous child's theme until the next mount. Fix at that time by moving state into a React context.
- **Shop purchase dispatch must include all purchasable kinds.** `purchaseShopItemInTx` was avatar-only from PR #21 through PR #33 — pets and sound themes shipped UI that called the action but it threw `ItemNotPurchasableError` at the SQL boundary, silently breaking those tabs in prod. PR #34 added a `switch (kind)` dispatch (`avatar` → inventory side-effect; `sound_theme | pet | decor` → coin debit + `shop_purchases` row only). When adding a new shop kind, extend the switch — don't add a parallel purchase action, or you'll fragment coin-debit and trophy-grant logic. Avatar regression coverage lives in `tests/unit/shop-db.test.ts`.
- **Decor anchors live in TS, not DB.** `src/lib/decor/anchors.ts` is the source of truth for positions; the DB stores only the anchor slug, and `src/lib/decor/catalog.tsx` resolves slug → coords + SVG component. To move a decoration, edit `anchors.ts` and redeploy — no migration needed. To add a new decoration: add an entry to `DECOR_CATALOG` + `ANCHORS`, create the SVG component under `src/components/play/decorations/`, extend `seed-decorations.ts`. The catalog test (`tests/unit/decor-catalog.test.ts`) enforces that every catalog entry has a known anchor and that anchors are distinct.
- **`pinyin_pick` is retired, not deleted.** The React component (`src/components/scenes/PinyinPickScene.tsx`), config schema (`PinyinPickConfigSchema`), and `scene_templates` row all still exist; the template row has `is_active=false`. Old `scene_attempts` rows reference the template via foreign key — don't delete it. Boss `questionTypes` array no longer includes `'pinyin_pick'` (PR #35 narrowed 6 → 5 types). If you ever re-add pinyin practice, you also need to flip `is_active=true` and update `compile-week.ts`.
- **Stable level keys on `week_levels`.** `compileWeekIntoLevels` upserts by `(week_id, level_key)` instead of delete-then-insert. The key shape lives in `compile-week.ts`: `review:flashcard:<characterId>` for per-char review scenes; `practice:<sceneType>:<slotIndex>` for slot-based practice scenes (e.g. `practice:audio_pick:0`); `boss:boss:0` for the boss. When changing the key shape you'll regress all of Yinuo's existing `scene_attempts.week_level_id` linkages unless you write a one-off attempt-migration script. Don't change keys casually.
- **Week routing is hub-first.** Tapping an island navigates to `/play/[childId]/week/[weekId]` (hub) — NOT `/play/[childId]/level/[weekId]` (which now redirects). Section sessions live at `/play/[childId]/level/[weekId]/[section]` where section ∈ `review | practice | boss`. The boss section page has a server-side route guard that redirects to the hub when `practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD` (currently 7 since PR #36 grew practice to 14). When linking to play surfaces, use the hub URL unless you specifically want to land in a section.
- **`image_word` stimulus is text today; swap-ready for images.** `ImageWordScene` renders a stylized description card from `words.image_hook`. PR #37 will add `words.image_url` and swap the stimulus to `<img>` when set (falling back to the description card). **Don't** assume the scene needs an image to function — it doesn't, and the V2 AI pipeline already populates imageHook per word. **Do** preserve `words.image_hook` after PR #37 lands — it stays useful as accessibility alt-text. **Practice has 14 slots now** (was 12 in PR #35): 3 audio + 3 sight (image_pick/visual_pick/word_match) + 2 image_word + 6 meaning. Compile-week falls back to extra `visual_pick` when no eligible imageHook words exist.

---

## Workflows

- **Building a feature**: brainstorm spec → write plan → dispatch implementer subagents per task → review → merge. (Superpowers skill chain: `brainstorming` → `writing-plans` → `subagent-driven-development`.)
- **Hotfix**: branch + edit + test + PR + merge. Don't go through the full plan ritual for a 5-line bug fix.
- **Confirmations**: David prefers `AskUserQuestion` option mode (mark recommended option first) for any non-trivial choice. He answers in Chinese or English.

---

## Pointers

- Per-user memory: `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/` — has David's collaboration norms, locked art direction, project overview. Read `MEMORY.md` index first.
- Deep design docs: `PLAN.md`, `ARCHITECTURE.md`, `GAME-DESIGN.md` — only when triage table says so.
- Vercel project: `hanzi-adventure` under `daviddaijw-6886s-projects`.
- GitHub repo: `DJiangwei/hanzi-quest`.

---

**Keep this file curated.** When you ship a meaningful change (regression fix, new landmine, locked decision flip, scope change), update the relevant section here so the next session doesn't re-derive what you just learned. Update the "last refreshed" date.
