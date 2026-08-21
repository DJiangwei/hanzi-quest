# Collection Packs v2 — Olympics + two unlockable IP packs

**Date:** 2026-08-21
**Status:** approved (David, 2026-08-21)
**Owner:** David / Claude

---

## 1. Goal

Add three collectible packs to the Backpack, and introduce the project's first
**per-child pack gate**:

| Pack | Slug | Cards | Visibility |
|---|---|---|---|
| 奥运会 Olympics | `olympics-v1` | 20 | always |
| 凯蒂猫与朋友 Hello Kitty & Friends | `hello-kitty-v1` | 16 | 🔒 until Map 1's final boss falls |
| 汪汪队立大功 Paw Patrol | `paw-patrol-v1` | 12 | 🔒 until Map 1's final boss falls |

The two gated packs exist to give the Caribbean final boss a reward with real
pull for a 6-year-old: *beat the map, and two whole new collections open up.*
Today the final boss pays a champion card + trophy + crown, all of which the
child has never seen and cannot anticipate. Two named, familiar collections are
legible **before** the fight — same reasoning as T3's "first-clear rewards
written on the island" (PR #149).

### Non-goals

- Pack-completion trophies for the new packs. Five existing packs
  (`landmarks-v1`, `transport-v1`, `minibeasts-v1`, `instruments-v1`,
  `animals-v1`) also lack them; adding trophies should be one uniform PR, not a
  side effect of this one.
- Map 2 (印度洋) content. Unrelated and still waiting on David's hanzi.
- A generic admin-editable unlock-rules system. Two rules in a TS config is the
  right size; a rules engine is not.
- Any change to the daily card cap, shard costs, or drop weights.

---

## 2. Design decisions (settled 2026-08-21)

1. **Sports list = Summer Olympic disciplines.** David's original phrasing was
   "最近一次多哈奥运会的项目". There is no Doha Olympics on record (the most
   recent Games was Milan-Cortina, winter 2026; Doha hosts the 2030 Asian
   Games), so the pack is built from the recognisable summer disciplines rather
   than any one host city's programme. The vocabulary — 游泳 / 跑步 / 足球 /
   体操 — is what carries the learning value; the host city carries none.
2. **The IP packs use the real characters and names.** Claude flagged that
   Hello Kitty (Sanrio) and Paw Patrol (Spin Master) are trademarked and that
   generating their likenesses with flux and hosting them on a public URL is a
   real, if modest, civil risk — and that flux renders licensed characters
   off-model. David reaffirmed the choice. Proceeding as asked; the risk is
   recorded in §8 and in the CHANGELOG entry, and will not be re-litigated.
3. **Unlock = the pack joins that child's normal drop pool.** Not reward-only,
   not a one-off grant burst. Before the unlock the pack is invisible and
   undroppable; after, it behaves exactly like every other gacha pack.

---

## 3. Pack content

Each pack follows the established recipe (see the "Adding a collectible pack"
landmine in CLAUDE.md): a data file, a `makeVocabCard` wrapper, a
`PACK_REGISTRY` entry, a seed script, and a `buildPrompt` case. **No
migration** — packs are rows, not schema.

`emoji` is written into `collectible_items.image_url` at seed time as the
`CardArt` text fallback and is overwritten by the flux generator later.

### 3.1 `olympics-v1` — 20 cards, grouped

Grouped like `transport-v1` (`PackGrouping` with `resolveGroup` / `order` /
`labels`). Four sections:

| Group key | Label | Slugs |
|---|---|---|
| `water` | 🌊 水上 / Water | `swimming` `diving` `kayaking` |
| `ball` | ⚽ 球类 / Ball | `football` `basketball` `table-tennis` `badminton` `volleyball` `tennis` |
| `combat` | 🥋 力量格斗 / Strength & Combat | `fencing` `judo` `boxing` `weightlifting` |
| `skill` | 🏃 竞速技巧 / Speed & Skill | `running` `gymnastics` `archery` `cycling` `equestrian` `skateboarding` `climbing` |

Full data (`src/lib/collections/olympicsData.ts`):

| slug | nameZh | nameEn | emoji | group | loreZh | loreEn |
|---|---|---|---|---|---|---|
| swimming | 游泳 | Swimming | 🏊 | water | 在水里划呀划，游得最快的赢。 | Race through the water — the fastest swimmer wins. |
| diving | 跳水 | Diving | 🤿 | water | 从高台跳下去，水花越小越好。 | Leap from the high board — the smaller the splash, the better. |
| kayaking | 皮划艇 | Kayaking | 🛶 | water | 用桨划开水面，一路向前。 | Paddle hard and cut through the water. |
| football | 足球 | Football | ⚽ | ball | 用脚把球踢进球门。 | Kick the ball into the goal. |
| basketball | 篮球 | Basketball | 🏀 | ball | 把球投进高高的篮筐。 | Throw the ball through the high hoop. |
| table-tennis | 乒乓球 | Table tennis | 🏓 | ball | 小小的球，飞得特别快。 | A tiny ball that flies very fast. |
| badminton | 羽毛球 | Badminton | 🏸 | ball | 羽毛球轻轻的，会在空中飘。 | The shuttlecock floats through the air. |
| volleyball | 排球 | Volleyball | 🏐 | ball | 球不能落地，大家一起托。 | Keep the ball off the floor — together. |
| tennis | 网球 | Tennis | 🎾 | ball | 隔着球网你来我往。 | Back and forth across the net. |
| fencing | 击剑 | Fencing | 🤺 | combat | 穿上白衣服，用剑轻轻一点。 | In white armour, a quick touch of the blade. |
| judo | 柔道 | Judo | 🥋 | combat | 借力打力，把对手轻轻放倒。 | Use their own strength to take them down. |
| boxing | 拳击 | Boxing | 🥊 | combat | 戴上大手套，出拳又快又准。 | Big gloves, fast and accurate punches. |
| weightlifting | 举重 | Weightlifting | 🏋️ | combat | 把很重很重的杠铃举过头顶。 | Lift the heavy bar right over your head. |
| running | 跑步 | Running | 🏃 | skill | 谁先冲过终点线谁就赢。 | First across the line wins. |
| gymnastics | 体操 | Gymnastics | 🤸 | skill | 翻跟头、转圈圈，稳稳落地。 | Flip, spin, and land steady. |
| archery | 射箭 | Archery | 🏹 | skill | 拉满弓，瞄准红心。 | Draw the bow and aim for the bullseye. |
| cycling | 自行车 | Cycling | 🚴 | skill | 蹬得越快，车跑得越远。 | The harder you pedal, the further you fly. |
| equestrian | 马术 | Equestrian | 🏇 | skill | 和马儿一起跳过栏杆。 | Jump the fences together with your horse. |
| skateboarding | 滑板 | Skateboarding | 🛹 | skill | 踩着滑板飞起来。 | Fly into the air on your board. |
| climbing | 攀岩 | Climbing | 🧗 | skill | 手脚并用，爬到最高的地方。 | Hands and feet — climb right to the top. |

`olympics-v1` reuses the existing `cycling`-vs-`bicycle` distinction cleanly:
`collectible_items.slug` is unique per pack (indexed on `pack_id`), not
globally, so `transport-v1/bicycle` and `olympics-v1/cycling` coexist.

### 3.2 `hello-kitty-v1` — 16 cards, flat (no grouping)

| slug | nameZh | nameEn | emoji | loreZh | loreEn |
|---|---|---|---|---|---|
| hello-kitty | 凯蒂猫 | Hello Kitty | 🎀 | 头上永远戴着红蝴蝶结的小白猫。 | The little white cat with the red bow. |
| mimmy | 咪咪 | Mimmy | 💛 | 凯蒂猫的双胞胎妹妹，蝴蝶结在右边。 | Hello Kitty's twin — her bow sits on the right. |
| dear-daniel | 丹尼尔 | Dear Daniel | 🧢 | 凯蒂猫最好的朋友。 | Hello Kitty's dearest friend. |
| my-melody | 美乐蒂 | My Melody | 🌸 | 戴粉色兜帽的小白兔。 | A little white rabbit in a pink hood. |
| kuromi | 库洛米 | Kuromi | 💜 | 戴黑帽子的小恶魔，其实很善良。 | A black-hooded imp with a kind heart. |
| cinnamoroll | 大耳狗 | Cinnamoroll | ☁️ | 耳朵大得能飞起来。 | Ears so big he can fly. |
| pompompurin | 布丁狗 | Pompompurin | 🍮 | 戴贝雷帽的黄色小狗，最爱布丁。 | A golden pup in a beret who loves pudding. |
| pochacco | 帕恰狗 | Pochacco | ⚽ | 爱运动的黑白小狗。 | A sporty black-and-white puppy. |
| chococat | 巧克力猫 | Chococat | 🐈‍⬛ | 全身黑黑的，消息最灵通。 | All black — and always first with the news. |
| gudetama | 蛋黄哥 | Gudetama | 🥚 | 懒洋洋的蛋黄，什么都不想做。 | A lazy egg yolk who'd rather not. |
| little-twin-stars | 双子星 | Little Twin Stars | ⭐ | 从星星上来的一对兄妹。 | A brother and sister from the stars. |
| keroppi | 大眼蛙 | Keroppi | 🐸 | 住在池塘边的绿青蛙。 | A green frog who lives by the pond. |
| badtz-maru | 酷企鹅 | Badtz-Maru | 🐧 | 一撮尖头发的黑企鹅。 | A black penguin with a spiky tuft. |
| tuxedo-sam | 山姆企鹅 | Tuxedo Sam | 🎩 | 打领结、戴帽子的绅士企鹅。 | A gentleman penguin in a bow tie. |
| hangyodon | 人鱼汉顿 | Hangyodon | 🐟 | 想当英雄的鱼人。 | A fish-man who dreams of being a hero. |
| charmmy-kitty | 查米凯蒂 | Charmmy Kitty | 🐱 | 凯蒂猫养的小白猫，脖子上挂着钥匙。 | Hello Kitty's own pet cat, with a key on her collar. |

### 3.3 `paw-patrol-v1` — 12 cards, flat

| slug | nameZh | nameEn | emoji | loreZh | loreEn |
|---|---|---|---|---|---|
| ryder | 莱德 | Ryder | 🧑‍✈️ | 汪汪队的小队长。 | The boy who leads the pups. |
| chase | 阿奇 | Chase | 🚓 | 德牧警犬，最爱喊"汪汪队，出动！" | The police pup — "Paw Patrol, ready for action!" |
| marshall | 毛毛 | Marshall | 🚒 | 斑点狗消防员，有点冒失。 | The clumsy Dalmatian firefighter. |
| skye | 天天 | Skye | 🚁 | 开直升机的可卡犬。 | The cockapoo who flies the helicopter. |
| rubble | 小砾 | Rubble | 🚜 | 开推土机的斗牛犬。 | The bulldog with the bulldozer. |
| rocky | 灰灰 | Rocky | ♻️ | 什么都能修好的回收犬。 | The recycling pup who can fix anything. |
| zuma | 路马 | Zuma | 🛥️ | 水上救援的拉布拉多。 | The water-rescue Labrador. |
| everest | 珠珠 | Everest | 🏔️ | 雪山上的哈士奇。 | The husky of the snowy mountains. |
| tracker | 追风 | Tracker | 🌴 | 丛林里耳朵最灵的吉娃娃。 | The jungle chihuahua with the sharpest ears. |
| liberty | 莉波提 | Liberty | 🛴 | 大都市来的腊肠犬。 | The dachshund from the big city. |
| lookout-tower | 瞭望塔 | The Lookout | 🗼 | 汪汪队的家，站得高看得远。 | The pups' home — tall enough to see everything. |
| paw-patroller | 巡逻车 | Paw Patroller | 🚚 | 装得下全队的大卡车。 | The big rig that carries the whole team. |

> **Open item for David (content only, not a blocker):** the Chinese names above
> follow the mainland dub, but some vary by region (大耳狗 is 玉桂狗 in
> HK/TW; 大眼蛙 is also sold as 青蛙王子). David watches these with Yinuo and
> should correct any that read wrong before the seed runs. Editing the data
> file and re-running the (idempotent) seed is a one-line change.

---

## 4. The unlock gate

### 4.1 Source of truth

`final_boss_clears` already **is** the single truth for "this child beat this
map" — it gates the next map, and it is the idempotency row for the champion
rewards. The gate reuses it. **No new table, no new column, no migration.**
This mirrors the derived-🗝️-keys decision in T3: a stored "unlocked packs"
table would drift from progress and could double-fire.

### 4.2 Two new modules

**`src/lib/collections/packUnlocks.ts`** — pure, client-safe (no db imports, so
UI and scenes may import it):

```ts
/** collectible pack slug → curriculum pack slug whose FINAL BOSS unlocks it. */
export const PACK_UNLOCK_REQUIREMENTS: Record<string, string> = {
  'hello-kitty-v1': 'pirate-class-level-1',
  'paw-patrol-v1': 'pirate-class-level-1',
};

export function isGatedPack(packSlug: string): boolean;

/** Gated packs still locked, given the maps this child has finished. */
export function lockedPackSlugsFrom(
  beatenCurriculumSlugs: ReadonlySet<string>,
): string[];
```

**`src/lib/db/pack-unlocks.ts`** — server-only, one query:

```ts
type DbLike = typeof db | Tx;   // same union shape as characters.ts

export async function listLockedPackSlugs(
  childId: string,
  tx: DbLike = db,
): Promise<string[]>;
```

It selects `curriculum_packs.slug` joined through `final_boss_clears` for the
child, then delegates to the pure `lockedPackSlugsFrom`. The `tx` parameter
exists so the two grant paths can call it **inside** their transaction.

### 4.3 Six enforcement points

Each is the same one-line shape: add
`...(locked.length ? [notInArray(collectionPacks.slug, locked)] : [])` to an
`and(...)` that already filters `isActive` + `gachaEligible`.

| # | Site | Change |
|---|---|---|
| 1 | `src/app/play/[childId]/collection/page.tsx` | drop locked packs from `halls` before render |
| 2 | `src/app/play/[childId]/collection/[packSlug]/page.tsx` | `notFound()` when the slug is locked for this child |
| 3 | `pullCardInTx` catalog (`src/lib/db/grants.ts` ~line 152) | exclude — computed inside the tx, so **no caller changes** |
| 4 | `grantGiftPackInTx` pack loop (`src/lib/db/grants.ts` ~line 254) | exclude — weekly 大礼包 must not hand out locked cards |
| 5 | `getMerchantOffer` pool (`src/lib/db/merchant.ts` ~line 66) | exclude — the daily offer must be buyable |
| 6 | `swapShardsInTx` (`src/lib/db/grants.ts` ~line 386) | return the existing `{ ok: false, reason: 'item_not_found' }` |

For #6, reuse `'item_not_found'` rather than adding a `'pack_locked'` reason: the
result type is already a discriminated union with three reasons wired to UI copy,
and for a child who has not beaten Map 1 the item genuinely does not exist. No
type widening, no new bilingual string.

**Why #6 matters even though the UI hides it:** every exported async function in
a `'use server'` file is a public RPC (PR #112 landmine). `swapShardsForItem`
looks an item up by raw id with no pack filter at all today. A UUID is not a
security boundary; the check belongs at the SQL boundary.

**Why #3 computes inside the tx:** `pullCardForChild` is called from
`finishLevelAction`, `finishAttemptAction`, `finishHomeworkAction`,
`finishFinalBossAction`, `claimBountyAction` and study mode. Threading a
`lockedPacks` argument through all of them would be six chances to forget one.
One query inside `pullCardInTx` — the same place the catalog is already
built — keeps the rule in exactly one place.

### 4.4 Study mode

`src/lib/actions/study.ts` gates its reward on `pack.gachaEligible`, and the
study lesson is launched from the per-pack page, which #2 already 404s. No
change needed; a test asserts the route guard covers it.

### 4.5 `is_active` stays a global kill switch

The gated packs are seeded `is_active = true`, `gacha_eligible = true`. The gate
is strictly per-child and lives in application code. Consequence:
`verify-integrity.ts` check #1 ("active packs ⊆ PACK_REGISTRY") and check #5
("`SHARD_SWAP_EXCLUSIVE_PACKS` ⟺ `gacha_eligible=false`") both keep passing
unmodified — the new packs are gacha-eligible and absent from the exclusive set,
which is consistent.

---

## 5. Unlock celebration

`finishFinalBossAction` gains a return field:

```ts
unlockedPackSlugs: string[]   // gated packs whose requirement this clear satisfied
```

It is computed from `PACK_UNLOCK_REQUIREMENTS` against the just-cleared
curriculum slug — plain strings only, so nothing function-bearing crosses the
RSC boundary (the `PackUiMeta` hazard). `FinalBossRunner` (already
`'use client'`) resolves each slug through `getPackMeta(slug)` itself and
renders a bilingual banner after `CardChestReveal` finishes, before the
`router.push` home:

> 🎁 **解锁新收藏！** 凯蒂猫与朋友 · 汪汪队立大功
> *New collections unlocked!*

The banner is returned on **every** clear where the packs are gated-and-now-open,
not only the first — a repeat clear currently bounces home after 1.5 s with
nothing shown, and re-announcing costs nothing. It is presentational only: no
grant, no idempotency concern.

**Anticipation copy (the actual behaviour-change goal):** the final-boss lair
node on the voyage board and the final-boss route's intro name the two packs
*before* the fight, the same way T3 spelled out the first-clear rewards.

Both children are currently short of the gate (Yinuo 6/10 bosses, 小板 8/10), so
this ships as a live goal for both — not as a retroactive unlock.

---

## 6. Art generation

Same pipeline as every existing card (`scripts/generate-collectible-art-cloudflare.ts`):
Cloudflare Workers AI `@cf/black-forest-labs/flux-1-schnell`, `steps: 6`,
`CONCURRENCY=3`, prompt = `UNIFIED_ART_STYLE` + a subject line → Vercel Blob at
`collectibles/{itemId}.jpg` → URL into `collectible_items.image_url`.

Changes:

1. Append the three slugs to `TARGET_PACK_SLUGS`.
2. Add three `buildPrompt` cases. Olympics is generic-with-overrides; the two IP
   packs need a per-slug `SUBJECT` map (a bare character name renders poorly —
   flux needs the silhouette described):

```ts
case 'olympics-v1':
  return `${STYLE_PREAMBLE}${OLYMPIC_SUBJECT[slug] ??
    `a cute cartoon child athlete doing ${nameEn}, full body, centered, plain light background`}`;
case 'hello-kitty-v1':
  return `${STYLE_PREAMBLE}${SANRIO_SUBJECT[slug]}`;
case 'paw-patrol-v1':
  return `${STYLE_PREAMBLE}${PAW_PATROL_SUBJECT[slug]}`;
```

3. Run non-`FORCE` so only the 48 new rows (whose `image_url` still holds an
   emoji, not `http…`) are generated. Existing art is untouched.
4. Follow with `scripts/zoom-collectible-art.ts` (`ONLY_PACK` scoped) to reach
   88 % subject fill, then `verify-collectible-images.ts`.

**Budget:** 48 `put()` = 48 Vercel Blob Advanced Operations ≈ **2.4 % of the
2,000/month free tier**. Cloudflare's ~300 images/day cap is not a factor.
Retries for individual bad cards use `FORCE=1 SKIP_UPLOADED_AFTER=<ISO>` so a
re-run costs only the cards actually redone.

**Expected quality caveat:** flux-1-schnell has no licensed-character training
target, so Hello Kitty and Paw Patrol cards will be *approximations*. Plan for a
review pass and per-card prompt tuning. Watch for the NSFW false-positive
landmine (it has fired on "Uranus" and "gong"); `boxing` is the likely candidate
here and has a `SUBJECT_OVERRIDE` slot ready.

---

## 7. Economy impact (accepted, monitor after ship)

The weekly 5-check-in **大礼包 grants one card per active gacha-eligible pack**
and deliberately bypasses the 10/day cap. Pack count today is 10, so the gift is
10 cards.

| Milestone | Gacha-eligible packs | Gift size |
|---|---|---|
| today | 10 | 10 |
| after this PR | 11 | 11 |
| after a child beats Map 1 | 13 | 13 |

Accepted as-is: it is once per week, it is the payoff for five check-ins, and a
larger burst is motivating rather than harmful for this audience. **Follow-up
signal:** watch the card-source split and cards-vs-cap chart on
`/admin/economy`; if the weekly spike distorts the curve, cap the gift in a
separate PR rather than shrinking the packs.

Second-order effect: 48 more cards in the pool means fewer duplicates in the
near term, which means fewer shards, which slows the shard-swap loop slightly.
This is the intended direction (more novelty, less grinding) and needs no
counter-measure.

---

## 8. Risks

| Risk | Assessment | Mitigation |
|---|---|---|
| **Trademark/copyright** on Hello Kitty (Sanrio) and Paw Patrol (Spin Master) — AI-generated likenesses served from a public URL | Real but modest for a ~4-account hobby deployment with no commercial use. Raised with David; he decided to proceed. Recorded here and in the CHANGELOG, not re-litigated. | Packs are gated behind Map 1, so they are not on any public landing surface. If a takedown ever arrives, `is_active=false` on the pack row hides both packs instantly with no code change. |
| flux renders licensed characters off-model | Likely | Per-slug descriptive prompts; review pass; single-card retries are cheap. Worst case a card keeps its emoji fallback, which `CardArt` already handles. |
| A sixth enforcement point gets missed later | Medium — this is the first per-child pack gate, so future card sources will not "know" about it | Guard test asserts every query that filters `gachaEligible` also filters locked packs; a new landmine entry in CLAUDE.md. |
| Regional Chinese names wrong | Low, cosmetic | Flagged for David in §3.3; data-file edit + idempotent re-seed. |

---

## 9. File manifest

**New**

```
src/lib/collections/olympicsData.ts
src/lib/collections/helloKittyData.ts
src/lib/collections/pawPatrolData.ts
src/lib/collections/packUnlocks.ts          (pure, client-safe)
src/lib/db/pack-unlocks.ts                  (server-only)
src/components/play/items/OlympicCard.tsx   (makeVocabCard, grouped)
src/components/play/items/HelloKittyCard.tsx
src/components/play/items/PawPatrolCard.tsx
scripts/seed-olympics-pack.ts
scripts/seed-ip-packs.ts
tests/unit/pack-unlocks.test.ts
tests/unit/pack-unlocks-db.test.ts
tests/unit/collection-packs-v2-data.test.ts
tests/unit/gacha-locked-packs.test.ts
```

**Modified**

```
src/lib/collections/packRegistry.ts               +3 entries
src/lib/db/grants.ts                               3 sites (catalog, gift, swap)
src/lib/db/merchant.ts                             1 site (offer pool)
src/lib/actions/final-boss.ts                      + unlockedPackSlugs
src/components/scenes/FinalBossRunner.tsx          + unlock banner
src/app/play/[childId]/collection/page.tsx         filter halls
src/app/play/[childId]/collection/[packSlug]/page.tsx  notFound when locked
src/app/play/[childId]/final-boss/[packSlug]/page.tsx  pre-fight reward copy
src/components/play/VoyageBoard.tsx (👑 lair node) pre-fight reward copy
scripts/generate-collectible-art-cloudflare.ts     +3 packs, +3 prompt cases
CLAUDE.md / docs/CHANGELOG.md / PLAN.md
```

---

## 10. Testing

All external boundaries mocked (`@/db`, Clerk, `next/cache`, `next/navigation`).

**Pure**
- `lockedPackSlugsFrom`: nothing beaten → both gated packs locked; Map 1 beaten
  → neither locked; an unrelated map beaten → both still locked; an ungated pack
  is never returned.
- Data files: slugs unique within pack; every row has non-empty `nameZh`,
  `nameEn`, `loreZh`, `loreEn`, `emoji`; olympics `group` ∈ the four keys and
  every group key appears in `order` + `labels` (the flags/transport grouping
  test shape).

**DB / integration (mocked db)**
- `listLockedPackSlugs` maps `final_boss_clears` rows → curriculum slugs → locked
  set; empty clears → both locked.
- `pullCardInTx` never returns a card from a locked pack, and does return one
  once the map is beaten.
- `grantGiftPackInTx` card count equals gacha-eligible packs **minus** locked.
- `getMerchantOffer` never offers a locked card.
- `swapShardsInTx` rejects a locked item and does not debit shards.

**Component / route**
- Backpack hall list omits locked packs and includes them post-unlock.
- Per-pack page `notFound()`s for a locked slug.
- `FinalBossRunner` renders the bilingual unlock banner when
  `unlockedPackSlugs` is non-empty and nothing when empty.

**Guard**
- Extend the existing registry/bilingual guards; add a test asserting each of
  the four `gachaEligible`-filtered queries also excludes locked packs (greps
  the source, in the spirit of `distribution-isolation-guard.test.ts`).

**Automatic coverage**: `verify-integrity.ts` checks #1/#2/#5 cover the new
packs once seeded; the bilingual-chrome test covers the new banner copy.

---

## 11. Post-merge ops (required — the PR is inert without them)

Against **PROD** (swap `DATABASE_URL` to the commented `# PROD_DATABASE_URL=`
line in `.env.local`, swap back after):

```bash
pnpm tsx scripts/backup-db.ts                     # first, always
pnpm tsx scripts/seed-olympics-pack.ts
pnpm tsx scripts/seed-ip-packs.ts
CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts
ONLY_PACK=olympics-v1 pnpm tsx scripts/zoom-collectible-art.ts   # then the other two
pnpm tsx scripts/verify-collectible-images.ts
pnpm tsx scripts/verify-integrity.ts              # expect 7/7
```

No migration, no `recompile-all-weeks.ts` — this PR touches no `week_levels`.

---

## 12. Success criteria

1. Backpack shows **17** packs for a child who has beaten Map 1 and **15** for
   one who has not (14 today + olympics), and the two IP packs are unreachable
   by URL for the latter.
2. A locked pack's cards never appear from a boss clear, practice card, weekly
   大礼包, merchant offer, or shard swap.
3. Beating the Caribbean final boss surfaces the bilingual unlock banner, and
   the two packs start dropping on the very next card grant.
4. All 48 new cards carry real flux art at ~88 % subject fill.
5. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green;
   `verify-integrity.ts` 7/7 against prod after the seeds.

---

## 13. Suggested PR sequencing

Two PRs, in this order. They are independently shippable and the first is a
pure-additive warm-up that de-risks the second.

**PR A — `olympics-v1` (data + card + registry + seed + art).** Touches no
shared logic. Follows the `landmarks-v1` recipe exactly. Ships the Olympics pack
to both children immediately, and proves the seed → flux → zoom → verify loop
still works before the gating PR depends on it.

**PR B — the pack gate + the two IP packs.** Contains all six enforcement
points, the `finishFinalBossAction` return field, the unlock banner, and the
pre-fight anticipation copy. This is where the review attention belongs.

A single combined PR is acceptable if David prefers one round of post-merge prod
ops instead of two — the seeds and the art run are the only serialised cost, and
they can be batched by merging A and B back to back before running either.

---

## 14. Incidental fix noticed while writing this spec

`CLAUDE.md`'s subsystem snapshot says "**15** collectible packs in the Backpack"
but `PACK_REGISTRY` holds 14 (zodiac, flags, sea-creatures, dinosaurs,
solar-system, landmarks, transport, minibeasts, instruments, animals + the four
reward-only: festivals, season-summer, champions, key-vault). Correct the count
in the same PR that updates the snapshot for this work.
