# PR #33 — Static pet companion

> **Author:** brainstormed with David, 2026-05-23.
> **Sibling:** picks up after PR #32 (trophies, shipped 2026-05-23).
> **Status:** spec ready for implementation plan.

## Why

After PR #32 Yinuo has 8 trophies on her account and a way to chase 12 more. The Atlas Hub now has 6 halls. The Shop has Avatar live + Sounds live, with Pet/Decor/Powerup tabs still "即将上线". The original shop roadmap (`docs/superpowers/specs/2026-05-18-pr21-shop-expansion-design.md` §PR #25) calls for a static pet companion next.

A pet adds **emotional companionship** without adding any new gameplay friction. Tapping it produces a random bilingual cheer ("加油！/ Keep going!") in a speech bubble — bilingual reinforcement that fits Yinuo's heritage-learner profile.

## Locked decisions (settled in brainstorm)

- **Pet renders on the island map only.** Beside the avatar in the play HUD. Not visible inside scenes (avatar isn't either; consistent).
- **Tap behaviour: random bilingual sentence bubble.** Shows zh + en for ~2.5s above the pet, then fades. Each pet has its own ~6-phrase catalog. No audio cue beyond the existing 🔊 click feedback in the rest of the app.
- **8 pets at launch**, mostly pirate / ocean themed: parrot 🦜, monkey 🐒, ship cat 🐈, dolphin 🐬, sea turtle 🐢, crab 🦀, bat 🦇, glow-jellyfish 🪼. (Plus 🐙 already reserved for the boss kraken — don't reuse.)
- **Emoji-only at launch.** Same approach as avatar items + sound themes. Procedural SVG can come later if a pet idea outgrows emoji.
- **Prices 300–1200 coins** in 3 rarity tiers (common/rare/epic) — mirrors avatar pricing.
- **One pet equipped at a time.** Single-slot equip pattern.
- **Bilingual rule** per `yinuo_english_native.md` — name, lore, and speech bubbles all zh + en.
- **Shop Pet tab goes live**, "即将上线" placeholder removed for the Pet tab only (Decor/Powerup stay queued).

## Schema

### New tables (drizzle migration `0009_*.sql`)

```sql
ALTER TYPE shop_item_kind ADD VALUE 'pet';

CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description_zh TEXT,
  description_en TEXT,
  speech_zh TEXT[] NOT NULL,
  speech_en TEXT[] NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE child_pet_equipped (
  child_id UUID PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Ownership is derived from `shop_purchases`**, not stored in a separate inventory table. A child "owns" a pet iff there's a `shop_purchases` row for the matching `shop_items` row (joined via slug). Avoids redundant state.

`speech_zh[i]` and `speech_en[i]` are parallel — element `i` of each is the bilingual pair shown together in one bubble. The pet's `speech_zh` and `speech_en` arrays must be the same length; seeded with 6 phrases per pet.

### `shop_items` rows (seeded by `scripts/seed-pets.ts`)

8 entries with `kind='pet'`, `slug` matching the corresponding `pets.slug`. Prices:

| Slug | Emoji | Name (zh / en) | Rarity | Price |
|---|---|---|---|---|
| `pet-parrot` | 🦜 | 鹦鹉 / Parrot | common | 300 |
| `pet-crab` | 🦀 | 螃蟹 / Crab | common | 300 |
| `pet-ship-cat` | 🐈 | 船猫 / Ship Cat | common | 350 |
| `pet-monkey` | 🐒 | 猴子 / Monkey | rare | 500 |
| `pet-sea-turtle` | 🐢 | 海龟 / Sea Turtle | rare | 500 |
| `pet-dolphin` | 🐬 | 海豚 / Dolphin | rare | 600 |
| `pet-bat` | 🦇 | 蝙蝠 / Bat | epic | 900 |
| `pet-glow-jelly` | 🪼 | 发光水母 / Glow Jellyfish | epic | 1200 |

(Rarity not stored in `pets` itself — it's `shop_items.metadata.rarity` if needed by the UI, or just inferred from price. Same approach as avatar items.)

### Sample speech catalogs

Each pet's `speech_zh[]` + `speech_en[]` (6 each, paired by index):

**Parrot** — `加油！ / Keep going!`, `你真棒！ / You're amazing!`, `再来一关！ / One more level!`, `海盗船长好！ / Hello, captain!`, `我喜欢你！ / I like you!`, `继续冒险！ / Onward!`

**Crab** — `咔哒咔哒 / Click click`, `我在沙滩上 / I'm on the beach`, `小心我的钳子 / Watch the claws`, `加油哦 / Hang in there`, `海水真凉 / The water's cool`, `我们是好朋友 / We're friends`

**Ship Cat** — `喵 / Meow`, `想吃鱼 / I want fish`, `今天好困 / So sleepy today`, `让我打个盹 / Time for a nap`, `你好 / Hi there`, `捉只老鼠去 / Off to catch mice`

**Monkey** — `嘻嘻嘻 / Hee hee`, `给我一根香蕉 / Banana please`, `我会爬桅杆 / I climb the mast`, `跳起来 / Let's jump`, `好玩好玩 / Fun fun fun`, `我们一起玩 / Play with me`

**Sea Turtle** — `慢慢来 / Take it slow`, `我活了 100 岁 / I'm 100 years old`, `游到深海 / Off to the deep sea`, `海洋很大 / The ocean is vast`, `你做得很好 / You're doing great`, `保护海龟 / Protect the turtles`

**Dolphin** — `咯咯咯 / Click click click`, `跳起来！ / Jumping!`, `我会唱歌 / I can sing`, `跟我游 / Swim with me`, `海里好玩 / The sea is fun`, `你笑了 / You're smiling`

**Bat** — `晚上好 / Good evening`, `我用耳朵看 / I see with my ears`, `飞起来 / Up I go`, `月亮真亮 / The moon is bright`, `寻找虫子 / Hunting bugs`, `静悄悄 / Quietly`

**Glow Jellyfish** — `闪闪发光 / Shimmer shimmer`, `我会发光 / I glow`, `飘啊飘 / Drift drift`, `深海里好凉 / Cool in the deep`, `星星一样 / Like a star`, `安静的伙伴 / Quiet friend`

## Auto-grant (Trophies linkage)

NO new trophy added in this PR. A future "first-pet-equip" trophy (parallel to PR #31's `equip-sound-theme`) is a natural follow-up, but it's noted as out of scope to keep PR #33 focused.

## UI

### Pet render component

`<PetCompanion />` — client component, mounted inside `src/app/play/[childId]/page.tsx` beside `<AvatarRender />`.

Props:
- `pet: { emoji, nameZh, nameEn, speechZh: string[], speechEn: string[] } | null`

Behaviour:
- If `pet === null`, renders nothing (no default pet — sphere is empty until purchased).
- If `pet` is present: renders the emoji at ~64px, with a small idle animation (a gentle bob, ~2s loop, scale 0.95→1).
- On tap: picks a random index `i` from `speech_zh`, shows a bilingual speech bubble (zh on top, en on bottom) anchored above the pet for 2500ms, then fades. Respects `useReducedMotion()` (no idle bob; tap still works but no fade).

### Shop integration

`PetsTabBody.tsx` — mirrors `SoundsTabBody.tsx` but for pets. Cards show emoji + name + description + price + state (owned/equipped/affordable/unaffordable). Tap an unowned + affordable card → confirm → purchase → auto-equip. Tap an owned-but-not-equipped card → equip immediately. The currently equipped pet shows "已装备 / Equipped".

`ShopCategoryTabs.tsx` — flip `pet` tab `disabled: true → false`.

`ShopBody.tsx` — add `activeTab === 'pet'` branch routing to `PetsTabBody`. Decor/Powerup stay placeholder.

### Server-side data

`/play/[childId]/shop/page.tsx` adds parallel fetches:
- `listPetShopListings()` — joins `shop_items` (kind='pet') + `pets` (by slug) → returns array of `PetShopListing { shopItem, pet }`.
- `getEquippedPet(childId)` → reads `child_pet_equipped` joined to `pets` → returns the equipped pet row or null.

`/play/[childId]/page.tsx` (island map) adds:
- `getEquippedPet(childId)` → passes to `<PetCompanion pet={...} />`.

## Actions

`src/lib/actions/pet.ts` (new, `'use server'`):

```ts
export async function equipPetAction(
  childId: string,
  slug: string | null,
): Promise<{ petSlug: string | null }>;
```

- Validates ownership via `listChildOwnedShopItemIds(childId)` matched against the pet's `shop_items.id`.
- `slug = null` is "unequip" — always allowed.
- On equip, upserts `child_pet_equipped(child_id, pet_id)` with `ON CONFLICT DO UPDATE`.
- `revalidatePath` for `/play/[childId]` and `/play/[childId]/shop`.

## Code map

### New files
- `src/db/schema/pets.ts` — `pets` + `childPetEquipped` tables.
- `drizzle/0009_<auto-name>.sql` — migration.
- `src/lib/db/pets.ts` — `listPetShopListings`, `getEquippedPet`, `setEquippedPet`, `listPetBySlug`.
- `src/lib/actions/pet.ts` — `'use server'`, `equipPetAction`.
- `src/components/play/PetCompanion.tsx` — client; bob idle + speech bubble on tap.
- `src/components/shop/PetsTabBody.tsx` — pet tab UI.
- `scripts/seed-pets.ts` — seeds 8 `pets` rows + 8 corresponding `shop_items` rows (idempotent).
- Tests: `tests/unit/pets-db.test.ts`, `tests/unit/equip-pet-action.test.ts`, `tests/unit/pet-companion.test.tsx`, `tests/unit/pets-tab-body.test.tsx`.

### Modified
- `src/db/schema/index.ts` — export pets module.
- `src/db/schema/economy.ts` — append `'pet'` to `shopItemKind`.
- `src/components/shop/ShopCategoryTabs.tsx` — flip pet `disabled: false`.
- `src/app/play/[childId]/shop/page.tsx` — fetch pet data, pass into ShopBody.
- `src/app/play/[childId]/shop/ShopBody.tsx` — add `activeTab === 'pet'` route to `PetsTabBody`.
- `src/app/play/[childId]/page.tsx` (island map) — fetch equipped pet, render `<PetCompanion>` beside avatar.
- `CLAUDE.md` — bump + PR #33 bullet + note that Shop now has 3 live tabs (Avatar, Sounds, Pet).

### Untouched
- Avatar item code (PR #21).
- Sound theme code (PR #31).
- Trophy code (PR #32). A first-pet-equip trophy is a follow-up.

## Scope

### In scope
- 2 new tables + enum value (drizzle 0009).
- Per-pet seeding (8 pets, ~6 phrases each).
- `equipPetAction` with ownership validation.
- `PetCompanion` client component with bob + bubble.
- `PetsTabBody` shop component with purchase + equip flow.
- Tests for db / action / both new components.

### Out of scope (explicit deferrals)
- New trophy for first pet equip — defer to a small follow-up if Yinuo cares.
- Pet visible inside scenes — locked decision, only on island map.
- Per-pet idle animations beyond a single bob (e.g., parrot wing flap, dolphin tail flick). Defer.
- Speech-bubble TTS (read the phrase aloud). Defer.
- Multiple pets equipped at once. Defer.
- Pet-related coin rewards or achievement-style milestones. Defer.

## Verification

Before opening PR:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev` walkthrough:
   - Open Shop → Pet tab is now live, shows 8 cards.
   - Buy a pet (e.g., 鹦鹉 / Parrot 300 coins) → auto-equipped → back to island map → see parrot beside avatar.
   - Tap parrot → speech bubble appears for ~2.5s with bilingual cheer.
   - Re-open shop → equip a different pet → return → see new pet.
   - Toggle `prefers-reduced-motion` → idle bob disappears; tap still shows bubble.
3. After merge: run `pnpm tsx scripts/seed-pets.ts` against prod (idempotent; safe to re-run).

## Open follow-ups
- "First pet equip" trophy.
- Per-pet richer animations.
- Pet visible inside scenes (mini sprite in HUD bar).
- Pet-themed speech reactions to in-game events (e.g., on boss clear, the pet says something celebratory).
- Mood / hunger system. **EXPLICITLY ruled out** for now (per original brainstorm: static, no Tamagotchi mechanics).
