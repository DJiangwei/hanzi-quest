# Fast-start for Claude (and other agents)

This file is auto-loaded into every session. Read it once, decide whether you need any of the deeper docs (PLAN / ARCHITECTURE / GAME-DESIGN), then go. **Do not read the deep docs unless the triage table below tells you to.**

For Codex / other tooling that follows the `AGENTS.md` convention: see `AGENTS.md` (kept as a thin shim).

---

## What this is

**hanzi-quest** (deployed as `hanzi-adventure.vercel.app`) — a personal Chinese-character learning game for the maintainer's 6-year-old daughter Yinuo. Pirate-adventure art direction. Parent (David) authors weekly character lists in an admin panel; AI generates kid-friendly scenes; child plays a 12-15-level "island" of mini-games per week, with a boss kraken + treasure-chest gacha on weeks with ≥10 characters.

It is **not** a multi-tenant SaaS. Optimize for Yinuo's daily fun, not for theoretical other users.

---

## Current state (last refreshed 2026-05-23)

**Shipped:** PR #1 → #33. The product is end-to-end playable in production: weekly authoring, AI scene generation (DeepSeek V4 Pro), shared `pirate-class-level-1` curriculum pack with 10 weeks published, island map, 9 scene types + boss, coins (with daily-login / streak-milestone / perfect-week bonuses + a `BonusToast` HUD layer), **5 collection packs** in the Collector's Atlas (`/play/[childId]/collection` → museum of packs, per-pack `/collection/[packSlug]` pages): zodiac (12), flags (30), sea creatures (20), dinosaurs (15), solar system (10). **Shop hub** (`/play/[childId]/shop` → tabbed UI, Avatar tab live with ~20 procedural-SVG cosmetics, other tabs "即将上线"). Layered SVG avatar in play HUD, animations + audio + treasure-map cards, PWA manifest.

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
- **PR #33 (just shipped, 2026-05-23)** — Static pet companion. 8 pets (parrot/crab/ship cat/monkey/sea turtle/dolphin/bat/glow jellyfish) in the new Pet shop tab, 300–1200 coins. Equipped pet renders beside the avatar on the island map only; tap → random bilingual speech bubble for ~2.5s. New tables `pets` + `child_pet_equipped`; pets seeded into `shop_items` via slug join; ownership derives from `shop_purchases`. `equipPetAction` validates ownership. Shop now has 3 live tabs (Avatar / Sounds / Pet); Decor + Powerup still queued.

**Most recent regressions fixed:**
- PR #18 — `finishLevelAction` / `listWeekChars` used `getWeekOwnedBy` which fails for shared-pack weeks (parent_user_id NULL). Fixed by switching to `getPlayableWeekForChild`.
- PR #20 — flashcard hanzi was 14rem fixed → now `clamp(11rem, 55vw, 22rem)`; `ZodiacIconDefs` (SVG `<symbol>` defs) only mounted on `/collection`, broke chest reveal — now mounted in the play layout.

**Next up (per `docs/superpowers/specs/2026-05-18-pr21-shop-expansion-design.md` roadmap):** Remaining shop expansion — consumable powerups (hint / skip / streak-freeze), island decorations. ALWAYS confirm with David before starting a new PR.

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
