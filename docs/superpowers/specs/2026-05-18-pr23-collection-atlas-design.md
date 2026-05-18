# PR #23 — Collector's Atlas hub + Flags pack

**Status:** Approved design — 2026-05-18
**Roadmap slot:** PR #23 (replacing the previously-planned "coin economy expansion" as the next PR after #21/#22). Coin economy slides to PR #27.
**Source brainstorm:** plan-mode session 2026-05-18 continued in this same conversation.
**Predecessors:** PR #21 spec (#21 on GitHub) → PR #22 impl (shop + avatar, in review).
**Successors (sketched, separate specs):** PR #24 Sea Creatures pack, PR #25 Dinosaurs pack, PR #26 Solar System pack, PR #27 Coin economy expansion, PR #28+ remaining shop categories.

---

## 0. Why now

David's daughter Yinuo is an **English-native heritage learner** living in the UK, attending a weekend 海盗班 / 汉字班. The current 12-zodiac gacha + `/collection` page is the only "collect-em-all" loop in the game. He wants richer collection content with bilingual labels for Yinuo's mother tongue, starting with **flag + capital "fridge magnets"**. Brainstorm picks (David selected all four):

1. **World Flags + capitals** (his specific ask) — 30 countries, bilingual country + capital
2. **Sea Creatures** (theme-fit) — ~20 creatures
3. **Dinosaurs** — ~15 species
4. **Solar System** — 8 planets + sun + moon

This PR ships **the framework + Flags** only. The other three packs reuse the framework in follow-up PRs (#24/#25/#26).

Locked decisions from this brainstorm:

- **Bilingual everywhere.** Every collectible renders both `name_zh` and `name_en` side by side. No language toggle. Capital info also shown bilingually. See memory note `yinuo_english_native.md`.
- **Atlas hub at `/collection`.** Migrate the existing zodiac-locked page into a museum-lobby hub listing all packs. Existing `/play/[childId]/collection` URL keeps working but now shows the hub; zodiac lives at `/play/[childId]/collection/zodiac-v1`.
- **Each pack has its own theme + metaphor.** Zodiac = scroll/cards (existing). Flags = passport / world map with flag pins. Sea creatures = pirate's deep-sea log. Dinosaurs = fossil museum. Planets = orrery / star chart.
- **Emoji flags for V1.** Native country flag emojis (🇺🇸 🇬🇧 🇨🇳 …) instead of hand-drawn SVG. Trade-off: slight cross-OS visual variation, but zero dev time and consistent on Yinuo's device. Polished SVG flags are a later polish PR if desired.
- **Boss-free-pull stays on zodiac.** Don't disrupt the existing weekly loop. Flags gets its own 300-coin paid pull (cheaper than zodiac's 500 because the pack is bigger and more vocab-focused).
- **No pack progression-gating.** All packs are visible and pullable from day one. (Locking can be added later.)

---

## 1. Goals

After PR #23 ships:

1. Yinuo opens `/play/<childId>/collection` and sees a museum lobby with **two halls**: 🐲 十二生肖 / Zodiac (12 items, X owned) and 🏳️ 世界国旗 / World Flags (30 items, Y owned). Visual theme color per hall.
2. Tapping a hall opens that pack's dedicated page (`/play/<childId>/collection/[pack-slug]`).
3. The Zodiac hall is the existing zodiac UI, moved to its new URL with no behavioral regression.
4. The Flags hall shows a 5-column grid of 30 country cards. Each card has the **flag emoji**, **country name (CN / EN)**, **capital (CN / EN)**, and a brief fun-fact lore (CN / EN). Locked cards are greyed; owned ones are full colour.
5. Above the grid, a 300-coin paid pull button. Pulling reveals a `TreasureChestReveal` style card animation, then adds the country to the child's collection. Duplicates accrue shards in the existing `shard_balances` (pack-scoped — no overlap with zodiac shards).
6. `prefers-reduced-motion` falls back to instant reveal (existing behaviour, no regression).
7. Tests cover: hub rendering, per-pack grid rendering, Flags catalog completeness (30 entries with both CN and EN populated), the paid-pull action against an arbitrary pack slug.

In scope (locked):

- Generic `CollectionGrid` / `CollectionItemCard` decoupled from `ZodiacSlug`.
- `/collection` page becomes the Atlas hub.
- New `/collection/[packSlug]` route holding the per-pack view.
- Flags pack data: 30 catalog entries with bilingual country, capital, and lore lines. Emoji flag stored in `collectible_items.image_url` as a literal emoji string (the field is text; the renderer treats it as plain text glyph, no `<img>`).
- Capital storage: stored inside the existing `lore_zh` and `lore_en` fields, formatted "首都：X" / "Capital: X" + the rest of the fun-fact. This avoids a schema migration.
- Generic gacha — `pullPaid(packSlug, args)` already accepts any pack slug; only the cost was hard-coded to 500. Drive the cost from `collection_packs` metadata or a new column. Decision: **add a `paid_pull_cost` column to `collection_packs`** (append-only migration). Zodiac defaults to 500, Flags to 300.
- Seed script `scripts/seed-flags-pack.ts` (idempotent, follows existing pattern from `seed-zodiac-pack.ts`).

Out of scope (deferred):

- Sea Creatures / Dinosaurs / Solar System packs → PRs #24/#25/#26 (each its own spec).
- Pack-aware boss-free-pull (kid chooses which pack to free-pull from). Stays on zodiac for now.
- Per-card animations beyond the existing chest reveal.
- Hand-drawn SVG flags (emoji is V1).
- Hard SVG country shapes / world-map drag-to-place UI.
- Coin economy expansion (now PR #27).
- Achievements / trophies (still PR #28+).

---

## 2. Frozen visual decisions

| Element | Decision | Notes |
|---|---|---|
| Atlas hub layout | Vertical stack of large hall cards (one per pack), max-w-md mobile-first | Each card: theme-coloured banner, pack name CN+EN, progress bar + "X / Y", "进入 →" CTA |
| Hall theme colour | Read from `collection_packs.theme_color` | Zodiac stays gold; Flags = sky blue with a passport-stamp aesthetic |
| Per-pack grid | 5-col on mobile (small flag tiles) for Flags; 3-col for Zodiac (existing) | Driven by per-pack config in code; not stored in DB |
| Item card (Flags) | Flag emoji ~36px + country name (CN large, EN small) + capital (smaller, both langs) | Locked: greyscale + 50% opacity + 🔒 corner. Owned: full colour. |
| Item card (Zodiac) | Unchanged from PR #17 | Existing `ZodiacCard` component, just rendered from the new generic grid |
| Pull button | Reuse `WoodSignButton` "抽卡 X 🪙" — but X is per-pack | Disabled when balance < cost, same pattern as zodiac |
| Reveal animation | Reuse `TreasureChestReveal` from PR #17 | The card it reveals is whichever per-pack card component is configured |
| Lore line | One bilingual sentence rendered below the card on reveal + on tap-to-detail in the grid | Format: "首都：北京。中国是大熊猫的故乡。" / "Capital: Beijing. China is the home of giant pandas." |

---

## 3. Tech stack & dependencies

No new dependencies.

**Schema migration (one new column, append-only):**

```sql
ALTER TABLE collection_packs ADD COLUMN paid_pull_cost integer NOT NULL DEFAULT 500;
```

Drizzle: append to `src/db/schema/collections.ts` `collectionPacks` table. Update the zodiac pack seed to set 500 explicitly (idempotent). Flags pack seeds with 300.

**Reuse — don't reinvent:**

- `pull(childId, packId, opts)` and `pullInTx` in `src/lib/db/gacha.ts` — already accept any `packId`.
- `pullPaid(packSlug, args)` in `src/lib/actions/gacha.ts` — drive `costCoins` from `packRow.paidPullCost` rather than the hard-coded `PAID_PULL_COST = 500`.
- `TreasureChestReveal` / `WoodSignButton` / `playDing` / `playFanfare` — unchanged.
- `getPackBySlug`, `listChildCollection`, `shardBalances` — unchanged.

**Generalization of components** (in scope, refactor):

- `CollectionGrid` currently imports `ZodiacSlug`. Refactor to take a pack-config object: `{ items: CollectibleItem[], itemRenderer: (item, owned) => ReactNode, columns: number }`. Move `ZodiacCard` selection into a `ZodiacGridItem.tsx` wrapper.
- `CollectionPageBody` currently hard-codes `PAID_PULL_COST = 500` and `ZodiacSlug` types. Refactor to take a pack config + `packMeta` (cost, theme color, item renderer).

---

## 4. Critical files

**New code**

- `src/app/play/[childId]/collection/[packSlug]/page.tsx` — generic per-pack route. Looks up pack by slug, hydrates child's collection + balance, passes to body.
- `src/components/play/AtlasHub.tsx` — server-renderable component listing pack hall cards. Reads from `collection_packs` + per-child progress.
- `src/components/play/AtlasHallCard.tsx` — one card on the hub.
- `src/components/play/PackPageBody.tsx` — replaces the zodiac-specific `CollectionPageBody`; generic over pack-config.
- `src/components/play/items/FlagCard.tsx` — Flag pack item card renderer.
- `src/components/play/items/ZodiacGridItem.tsx` — thin wrapper around existing `ZodiacCard` so it conforms to the generic itemRenderer signature.
- `src/lib/collections/packConfig.ts` — map of `packSlug → { columns, ItemCardComponent, themeMetadata }`. Single source of truth for per-pack UI choices.
- `src/lib/collections/flagsData.ts` — pure data file listing 30 countries (slug, nameZh, nameEn, emoji, capitalZh, capitalEn, loreZh, loreEn, rarity, dropWeight).
- `scripts/seed-flags-pack.ts` — idempotent seed mirroring `seed-zodiac-pack.ts`.
- `drizzle/NNNN_pack_paid_pull_cost.sql` — generated migration for the new column.

**Existing files modified**

- `src/db/schema/collections.ts` — append `paidPullCost` column to `collectionPacks`.
- `src/app/play/[childId]/collection/page.tsx` — replace zodiac-hardcoded view with the Atlas hub component.
- `src/components/play/CollectionGrid.tsx` — generalize (remove `ZodiacSlug` coupling).
- `src/components/play/CollectionPageBody.tsx` — delete or generalize into `PackPageBody`.
- `src/lib/actions/gacha.ts` — `pullPaid` reads cost from pack row, not the hard-coded const.
- `src/components/play/CollectionHudPill.tsx` (if it exists, per CLAUDE.md) — re-target the link if needed; show aggregate progress across packs (X items across N halls).

**Tests** (Vitest + RTL, jsdom — same mocks as before)

- `tests/unit/atlas-hub.test.tsx` — renders hall cards from a fake pack list; shows owned progress correctly.
- `tests/unit/pack-page-body.test.tsx` — renders grid for a fake pack-config; pull button disabled when balance < cost; calls action with correct slug.
- `tests/unit/flags-data.test.ts` — catalog has exactly 30 entries, every entry has both `nameZh` and `nameEn` and both `capitalZh` and `capitalEn` non-empty, slugs are unique.
- `tests/unit/flag-card.test.tsx` — renders the emoji, country name (both langs), capital, and locked/unlocked states.
- `tests/unit/gacha-pull-cost.test.ts` — `pullPaid` reads cost from pack row (not hard-coded 500).

---

## 5. Flags pack — country list (30)

Spans 6 continents, ~50/50 East/West, prioritizing countries Yinuo has cultural touchpoints to (UK, China, US) + variety. Rarity tuned so kids can collect the well-known ones fast and the harder ones feel earned.

| # | Slug | nameZh | nameEn | capitalZh | capitalEn | Rarity |
|---|---|---|---|---|---|---|
| 1 | china | 中国 | China | 北京 | Beijing | common |
| 2 | uk | 英国 | United Kingdom | 伦敦 | London | common |
| 3 | usa | 美国 | United States | 华盛顿 | Washington, D.C. | common |
| 4 | france | 法国 | France | 巴黎 | Paris | common |
| 5 | germany | 德国 | Germany | 柏林 | Berlin | common |
| 6 | japan | 日本 | Japan | 东京 | Tokyo | common |
| 7 | south-korea | 韩国 | South Korea | 首尔 | Seoul | common |
| 8 | canada | 加拿大 | Canada | 渥太华 | Ottawa | common |
| 9 | australia | 澳大利亚 | Australia | 堪培拉 | Canberra | common |
| 10 | india | 印度 | India | 新德里 | New Delhi | common |
| 11 | brazil | 巴西 | Brazil | 巴西利亚 | Brasília | common |
| 12 | russia | 俄罗斯 | Russia | 莫斯科 | Moscow | common |
| 13 | italy | 意大利 | Italy | 罗马 | Rome | common |
| 14 | spain | 西班牙 | Spain | 马德里 | Madrid | common |
| 15 | mexico | 墨西哥 | Mexico | 墨西哥城 | Mexico City | rare |
| 16 | egypt | 埃及 | Egypt | 开罗 | Cairo | rare |
| 17 | south-africa | 南非 | South Africa | 比勒陀利亚 | Pretoria | rare |
| 18 | argentina | 阿根廷 | Argentina | 布宜诺斯艾利斯 | Buenos Aires | rare |
| 19 | switzerland | 瑞士 | Switzerland | 伯尔尼 | Bern | rare |
| 20 | greece | 希腊 | Greece | 雅典 | Athens | rare |
| 21 | netherlands | 荷兰 | Netherlands | 阿姆斯特丹 | Amsterdam | rare |
| 22 | thailand | 泰国 | Thailand | 曼谷 | Bangkok | rare |
| 23 | singapore | 新加坡 | Singapore | 新加坡 | Singapore | rare |
| 24 | turkey | 土耳其 | Turkey | 安卡拉 | Ankara | rare |
| 25 | saudi-arabia | 沙特阿拉伯 | Saudi Arabia | 利雅得 | Riyadh | rare |
| 26 | uae | 阿联酋 | UAE | 阿布扎比 | Abu Dhabi | epic |
| 27 | vietnam | 越南 | Vietnam | 河内 | Hanoi | rare |
| 28 | indonesia | 印度尼西亚 | Indonesia | 雅加达 | Jakarta | rare |
| 29 | portugal | 葡萄牙 | Portugal | 里斯本 | Lisbon | rare |
| 30 | sweden | 瑞典 | Sweden | 斯德哥尔摩 | Stockholm | epic |

Lore lines are short (~15 chars CN / ~10 words EN), kid-friendly, ideally containing one cultural / geographical / animal hook. Full text in `flagsData.ts`.

---

## 6. UX flow

1. Kid taps the 🎒 HUD pill on the island map (or directly visits `/play/<childId>/collection`).
2. Atlas hub loads. Two hall cards: 🐲 十二生肖 / Zodiac (X/12) and 🏳️ 世界国旗 / World Flags (Y/30). Theme colours differ.
3. Kid taps Flags. `/play/<childId>/collection/flags-v1` loads.
4. Page shows back button → atlas hub, balance pill, paid-pull button "抽卡 300 🪙" (disabled if balance < 300), and the 30-country grid.
5. Owned countries: full colour with flag + bilingual labels. Locked: greyed silhouette + 🔒 corner.
6. Tap a paid pull → `TreasureChestReveal` shake-open animation → reveals a `FlagCard` with country + capital + lore in both languages. Free pull NOT available from this pack (zodiac-only for free pulls in PR #23).
7. Reveal screen has "再看一眼" / "Look again" button → returns to grid with the new card now lit up. Duplicates increment shard balance.
8. Reduced-motion falls back to instant reveal (no shake).

---

## 7. Verification (before opening the PR)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — four-green gate.
2. `pnpm drizzle-kit generate` produces exactly one new migration (`*_pack_paid_pull_cost.sql`); never edit existing committed migrations.
3. `pnpm tsx scripts/seed-flags-pack.ts` runs idempotently. Re-running upserts no new rows after the first run.
4. `pnpm dev`, log in as parent, open `/play/<childId>/collection` — Atlas hub renders with two hall cards.
5. Tap zodiac hall — existing zodiac UI loads with no visual regression vs PR #17.
6. Tap Flags hall — 30 grey cards visible, paid pull "抽卡 300 🪙" enabled if balance ≥ 300.
7. Buy a pull — chest reveal animation, then FlagCard with bilingual country + capital + lore. Coin balance decrements by 300. Card flips to coloured in grid on return.
8. Buy three more pulls including one duplicate — duplicate increments shard balance (visible in some HUD or refresh-able state per existing zodiac behaviour).
9. Refresh the page — owned items persist, balance persists, shards persist.
10. `prefers-reduced-motion` on — instant reveal, no shake.
11. Bilingual rendering smoke check: open the Flags grid, confirm every card shows BOTH 中文 AND English for country + capital. No card renders only one language.

---

## 8. Future PR sketches (informational; each gets its own spec)

### PR #24 — Sea Creatures pack
Reuses Atlas framework. ~20 creatures (whale / dolphin / octopus / shark / jellyfish / starfish / seahorse / sea turtle / clownfish / manta ray / etc.). Each has CN+EN name + a one-liner lore in both languages (e.g., 章鱼 / Octopus — "有八条腿。" / "Has eight arms!"). Visual: hand-drawn flat SVGs in the existing pirate aesthetic (consistent with zodiac/kraken). Theme: pirate's deep-sea log. Cost: 400/pull.

### PR #25 — Dinosaurs pack
~15 species (T-Rex / Triceratops / Stegosaurus / Velociraptor / Pterosaur / Brachiosaurus / Ankylosaurus / Spinosaurus / Diplodocus / Iguanodon / Allosaurus / Pachycephalosaurus / Parasaurolophus / Compsognathus / Archaeopteryx). Bilingual + one fun fact per dino. Theme: fossil museum / dig site. Cost: 400/pull.

### PR #26 — Solar System pack
8 planets + sun + moon + a couple of dwarf planets (Pluto / Eris) for 11–12 items. Each has a bilingual size/distance-from-sun fun fact. Theme: orrery / star chart. Cost: 350/pull (smaller pack).

### PR #27 — Coin economy expansion
Now scheduled AFTER the Atlas detour. Daily login + streak + perfect-week bonuses. Needed before too many packs are on the shelf — otherwise Yinuo's earning will lag.

### PR #28+ — Original shop roadmap continues
Sound themes, pet, decor, achievements.

---

## 9. Open questions for follow-up PRs

Not blocking PR #23:

1. **Free-pull rotation.** Right now boss-free-pull is zodiac-only. Should the kid eventually pick which pack to free-pull from after beating a boss? Decision deferred until at least 2 packs exist (which happens at the end of PR #23).
2. **Atlas museum-lobby aesthetic.** PR #23 ships a clean card-stack hub. A more elaborate "museum room" visual (with paintings, columns, etc.) is a polish PR if Yinuo loves the loop.
3. **Hand-drawn SVG flags.** Emoji works for V1; hand-drawn or imported SVG flags would be more consistent across OSes. Defer until Yinuo plays with emoji version.
4. **Cross-pack achievements.** "Collect 5 capitals" or "Own one from each continent" — interesting but goes into the achievements PR.
5. **Item detail modal.** Currently item details only appear on pull reveal. Tap-on-card to re-read the lore later would be nice. Defer (could ship as a small polish PR).
