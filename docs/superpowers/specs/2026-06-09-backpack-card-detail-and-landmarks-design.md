# Backpack: Card Detail View + World Landmarks Pack — Design Spec

**Date:** 2026-06-09
**Status:** approved (design locked via David's choices: build both #1 + #3; recommended defaults)
**Context:** Backpack follow-ups. David picked two: **(A)** a tap-to-open **card detail view** (right now lore/capital/type only show at the tiny grid size and tapping a card does nothing), and **(B)** a brand-new **World Landmarks** collection pack (pairs with World Flags, reinforces geography). Defaults locked: **World Landmarks** theme; unowned cards open a **teaser** detail.

These are independent and ship together in one PR.

---

## Feature A — Card detail view (all packs)

### A1. North Star
> Yinuo taps a flag (or any collected card) and a big version pops up: the emoji, the bilingual name, its capital/continent (or type), a fun fact, and a 🔊 **读一读 / Read aloud** button that says the Chinese name. Tapping a card she hasn't collected shows a friendly locked teaser.

### A2. Approach — reuse each pack's `ItemCard` at `size="lg"`
Every per-pack card (`FlagCard`, `SolarBodyCard`, `DinosaurCard`, `SeaCreatureCard`, `ZodiacGridItem`, and the new `LandmarkCard`) already renders its rich detail at `size="lg"` (big emoji, bilingual name, capital/location/type badge, and **lore when `owned`**). So the detail view is a centered overlay that renders `<meta.ItemCard item owned size="lg" />` — no per-pack detail logic needed.

**New component `src/components/play/CardDetailDialog.tsx`** (`'use client'`):
```ts
interface Props {
  packSlug: string;          // resolves meta CLIENT-side (RSC-safe; never pass meta)
  item: CollectibleItem;
  owned: boolean;
  onClose: () => void;
}
```
- Resolves `meta = getPackMeta(packSlug)`; renders a backdrop + a card panel containing:
  - `<meta.ItemCard item={item} owned={owned} size="lg" />`
  - `<SpeakButton text={item.nameZh} size="md" label="读一读 / Read aloud" />` (reads the ZH name; reuse `src/components/play/SpeakButton.tsx`). Shown for both owned + unowned (the name is visible either way — pronouncing it is educational, not a spoiler).
  - **Owned:** the `lg` card already shows the fun-fact lore.
  - **Unowned (teaser):** the `lg` card renders greyed (`owned={false}` → lore hidden by the card itself); add a hint line: `❓ 还没收集 / Not collected yet` + `通关 Boss 或用 🔹 碎片兑换 / Clear a boss or trade 🔹 shards`.
  - A close button (`✕ 关闭 / Close`) + backdrop-click + Esc to dismiss. Reduced-motion safe.

### A3. Wire into `PackPageBody`
- Add `detailItem: CollectibleItem | null` state. The card area of each `PackTile` becomes a tap target (a `<button>` wrapping the `meta.ItemCard`) → `setDetailItem(item)`. The existing **swap chip** (unowned) and **convert chip** (owned dupe) stay as separate overlay buttons with `e.stopPropagation()` so they don't open the detail.
- Render `<CardDetailDialog packSlug={packSlug} item={detailItem} owned={ownedSet.has(detailItem.id)} onClose={() => setDetailItem(null)} />` when `detailItem`.
- Works for ALL packs unchanged (it's generic via `meta.ItemCard`).

### A4. Files (Feature A)
- New: `src/components/play/CardDetailDialog.tsx` + test.
- Modified: `src/components/play/PackPageBody.tsx` (tap target + dialog state).

---

## Feature B — World Landmarks pack (`landmarks-v1`)

### B1. Data — `src/lib/collections/landmarksData.ts`
Mirror `flagsData.ts`. Reuse `Continent` / `CONTINENT_LABELS` / `CONTINENT_ORDER` from `flagsData`.
```ts
export interface LandmarkItem {
  slug: string;
  emoji: string;
  continent: Continent;
  nameZh: string; nameEn: string;
  locationZh: string; locationEn: string;  // e.g. 法国·巴黎 / Paris, France
  loreZh: string; loreEn: string;          // one kid-friendly fun fact each
  rarity: 'common' | 'rare' | 'epic';
  dropWeight: number;                       // 3/2/1 by rarity
}
export const LANDMARKS: LandmarkItem[];      // ~16, grouped across the 6 continents
export const LANDMARKS_BY_SLUG: Record<string, LandmarkItem>;
```
**Roster (~16, controller-authored, apolitical, bilingual):** Asia — 长城/Great Wall, 泰姬陵/Taj Mahal, 富士山/Mount Fuji, 吴哥窟/Angkor Wat, 哈利法塔/Burj Khalifa. Europe — 埃菲尔铁塔/Eiffel Tower, 罗马斗兽场/Colosseum, 大本钟/Big Ben, 圣家堂/Sagrada Família. Africa — 吉萨金字塔/Pyramids of Giza, 乞力马扎罗山/Mount Kilimanjaro. North America — 自由女神像/Statue of Liberty, 金门大桥/Golden Gate Bridge, 奇琴伊察/Chichén Itzá. South America — 救世基督像/Christ the Redeemer, 马丘比丘/Machu Picchu. Oceania — 悉尼歌剧院/Sydney Opera House.

**Emoji** are limited for landmarks (same constraint as dinosaurs/solar): use the closest glyph (🗼 towers, 🗽 Liberty, 🏯 Asian, 🗿 ancient, 🕌 domed, 🏛️ classical, 🌉 bridge, ⛩️/🛕 temple, ⛰️ mountain) — the card differentiates primarily by **name + location + continent**, not the emoji. (Real illustrated images are a future enhancement, like `words.image_url`; emoji glyph is the established pack pattern.)

### B2. Card — `src/components/play/items/LandmarkCard.tsx`
Mirror `FlagCard`: big emoji, bilingual name, a **location** line (`📍 城市·国家 / City, Country`) when `!compact`, a **continent badge** (reuse `CONTINENT_LABELS`), and bilingual lore at `size="lg" && owned`. `ItemCardProps` shape.

### B3. Registry — `packRegistry.ts`
Add `'landmarks-v1'`: `displayNameZh: '世界地标'`, `displayNameEn: 'World Landmarks'`, slogan, `themeEmoji: '🗽'`, banner/accent classes, `paidPullCost: 300` (legacy field; gacha is play-to-earn now), `gridColumns: 3`, `ItemCard: LandmarkCard`, `resolveRevealEmoji: (s) => LANDMARKS_BY_SLUG[s]?.emoji ?? null`, and `grouping` by continent (reuse `CONTINENT_LABELS`/`CONTINENT_ORDER`, `resolveGroup: (s) => LANDMARKS_BY_SLUG[s]?.continent ?? null`).

### B4. Seed — `scripts/seed-landmarks-pack.ts`
Mirror `seed-flags-pack.ts`: upsert the `landmarks-v1` row in `collection_packs` (`isActive: true`) + insert-missing the ~16 `collectible_items` (bilingual name; lore prefixed with location like flags prefix capital; emoji in `image_url`). Idempotent. **Post-merge op** against prod.

**Note — gift pack auto-scales:** `grantGiftPackInTx` grants one card per ACTIVE pack (derived, not hardcoded). A 6th active pack means the weekly check-in 大礼包 now grants 6 cards. This is the intended behavior (CLAUDE.md landmine) — no code change, just more generous.

### B5. Hub
The Backpack hub (`AtlasHub`) lists halls derived from the DB `collection_packs` (+ registry meta). Once seeded, the World Landmarks hall card appears automatically with its progress bar.

### B6. Files (Feature B)
- New: `src/lib/collections/landmarksData.ts`, `src/components/play/items/LandmarkCard.tsx`, `scripts/seed-landmarks-pack.ts` + tests.
- Modified: `src/lib/collections/packRegistry.ts` (+ landmarks entry).

---

## Out of scope
- Real illustrated card images (emoji glyphs, like other packs). Per-continent completion rewards (separate roadmap item David didn't pick now). Search/filter in packs. Editing other packs.

---

## Testing
- **CardDetailDialog:** renders the pack's ItemCard at lg + a read-aloud SpeakButton; owned shows lore, unowned shows the locked-teaser hint; close button + backdrop dismiss call `onClose`; resolves meta from `packSlug` (no `meta` prop).
- **PackPageBody:** tapping a card opens the detail dialog with that item; tapping the swap/convert chip does NOT open it (stopPropagation).
- **landmarksData:** ~16 entries; every entry bilingual name/location/lore + valid `continent` + emoji; slugs unique; dropWeight matches rarity; every continent non-empty (or documented if a continent has 1).
- **packRegistry:** `landmarks-v1` exposes `grouping`; `resolveGroup` returns a valid continent for every landmark; `ItemCard`/`resolveRevealEmoji` present.
- **LandmarkCard:** bilingual name + location + continent badge; lore at lg+owned; placeholder emoji fallback.

---

## Done criteria
- Tapping any collected card opens a big bilingual detail with 🔊 read-aloud; unowned shows a friendly teaser.
- A new **世界地标 / World Landmarks** pack (~16, grouped by continent) is collectible, joins the gacha + gift pool, and shows in the Backpack hub.
- `pnpm typecheck && lint && test && build` green; seed runs clean. **Post-merge:** `pnpm tsx scripts/seed-landmarks-pack.ts`.
