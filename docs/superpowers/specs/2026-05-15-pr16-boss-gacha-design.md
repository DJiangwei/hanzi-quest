# PR #16 — Boss Kraken + Treasure-Chest Gacha (Phase 4 + Phase 5 entry)

**Status:** Approved design — 2026-05-15
**Roadmap slot:** PR #16, the last item of the locked art_direction phased sequence
**Source brainstorm:** `.superpowers/brainstorm/99059-*/` (gitignored)
**Predecessor:** PR #15 — pirate polish (animations + audio + treasure-map cards) — merged 2026-05-14

---

## 1. Goals

Close the weekly loop. Each completed week now ends with a 海怪 boss fight; defeating it grants +300 coins and **one free treasure-chest pull** that surfaces a 十二生肖 collectible. The child also has a dedicated `/collection` page to browse their 12-zodiac progress and spend 500 coins on a paid pull whenever they want.

In scope (locked):

1. **Boss scene type** — `BossScene` renders 10 questions, 3 lives, fully reuses `MultipleChoiceQuiz` from PR #15 (inherits coin-shower, shake, ding/buzz). Compile-week emits boss as the 15th level when chars ≥ 10.
2. **Failed boss UX** — kraken-wins state with "再战 (免费)" reset, no server call, no coin penalty.
3. **Free pull from boss clear** — use-it-or-lose-it; LevelFanfare offers "开启宝箱" + "回地图" buttons.
4. **`pullFreeFromBoss` + `pullPaid` server actions** — both delegate to a shared `lib/db/gacha.ts::pull()`.
5. **Gacha pull algorithm** — weighted random over `collectibleItems.dropWeight`, full duplicate→shard handling.
6. **TreasureChestReveal** — chest shake → open → ZodiacCard reveal animation. Reduced-motion path falls back to instant reveal.
7. **/play/[childId]/collection page** — 12-tile grid (owned colour vs locked gray), 顶栏 "抽卡 500 🪙" 木牌 (disabled when balance < 500).
8. **12 zodiac SVG set** — single `zodiac-icons.tsx` with `<symbol>` defs, ~3 KB gzip total, locked colour palette.
9. **`CollectionHudPill` on IslandMap** — "🎒 5/12" pill linking to /collection.

Out of scope (intentionally deferred):

- Shard voucher redemption (100 shards → 1 free pull) — data is written this PR but UI in V1.5.
- Tracing scene (HanziWriter) — independent small PR, not bundled here.
- Multi-pull (10连) discount UI.
- Rarity-tier reveal animations (all 12 zodiac start at `rarity='common'`).
- Pull history page.
- Haptics on chest open.

---

## 2. Frozen visual decisions

| Element | Decision | Notes |
|---|---|---|
| Boss kraken | Hand-drawn SVG silhouette (`BossKraken.tsx`) | Two-state: `fighting` (tentacles wave on framer-motion loop) and `winning` (red-tinted shake on player defeat) |
| Treasure chest reveal | Two-stage framer-motion: 800ms shake → open + scale up → ZodiacCard slides up | Reduced-motion: instant reveal |
| Zodiac card layout | Animal SVG silhouette = 60% card; hanzi 字 = bottom caption 12-13px | See §5 for full colour table |
| /collection page card | Gold border + cream radial center + inner gold glow | Owned: full colour. Locked: gray bg + `filter: grayscale(1) opacity(0.35)` |
| Pull button | Reuse `WoodSignButton` from PR #15 | "抽卡 500 🪙" on /collection; "开启宝箱" + ghost "回地图" on LevelFanfare |
| Lives indicator on boss | 3 anchors `⚓ ⚓ ⚓` at top, turn gray on miss | Reduced-motion: instant gray flip, no animation |

---

## 3. Tech stack & dependencies

No new dependencies. Reuses:
- `framer-motion@^12` (LazyMotion + m subset) — for kraken wave, chest shake, card slide
- `@lottiefiles/dotlottie-react@^0.19` — already loaded by LevelFanfare end-state
- Web Audio `playSound` — `ding`/`buzz`/`fanfare` reused; no new sounds in this PR

**Refactor required (small, in scope):** `src/lib/db/coins.ts::awardCoins` currently opens its own `db.transaction()`. Extract the body into a new `awardCoinsInTx(tx, input)` that runs inside a caller-provided transaction; `awardCoins` becomes a one-line wrapper. This lets `gacha.pull()` deduct coins atomically with the rest of the pull (insert collection row, insert pull row, etc.) — if any step throws, the deduction rolls back too. Without this refactor, a successful deduction followed by a failed pull would silently burn the child's coins.

---

## 4. File layout

### New files

```
src/
├─ components/
│  ├─ scenes/
│  │  ├─ BossScene.tsx                  # 10-question orchestrator + lives + kraken wrapper
│  │  └─ fx/
│  │     ├─ BossKraken.tsx             # SVG kraken silhouette, fighting/winning states
│  │     └─ TreasureChestReveal.tsx    # Chest shake → open → ZodiacCard reveal
│  └─ play/
│     ├─ CollectionGrid.tsx            # 12-tile grid for /collection page
│     ├─ CollectionHudPill.tsx         # "🎒 5/12" pill for IslandMap top bar
│     ├─ GachaPullButton.tsx           # 500-coin paid pull button
│     ├─ ZodiacCard.tsx                # Single card: SVG + hanzi + (optional pinyin + en)
│     └─ zodiac-icons.tsx              # 12 <symbol> SVG defs in one file
├─ lib/
│  ├─ db/
│  │  ├─ gacha.ts                      # pull(childId, packId, opts) — tx-wrapped
│  │  └─ collections.ts                # listChildCollection, getPackBySlug
│  └─ actions/
│     └─ gacha.ts                      # pullFreeFromBoss(weekId), pullPaid(packSlug)

src/app/play/[childId]/collection/page.tsx  # Server component: fetches pack + collection + balance

scripts/
└─ seed-zodiac-pack.ts                 # Seeds: 1 pack row + 12 collectible_items + boss scene_template

drizzle/
└─ NNNN_boss_gacha.sql                 # ALTER TABLE week_progress ADD COLUMN free_pull_claimed
```

### Modified files

```
src/components/scenes/SceneRunner.tsx      # case 'boss': body = <BossScene ... />
src/components/scenes/fx/LevelFanfare.tsx  # new prop chestAvailable: boolean
src/lib/scenes/compile-week.ts             # emit boss as 15th level when chars ≥ 10
src/lib/scenes/configs.ts                  # add BossConfig = { characterIds: string[]; questionTypes: SceneType[] }
src/lib/actions/play.ts                    # finishLevelAction detects boss → +300 coins + bossCleared=true
src/components/play/IslandMap.tsx          # mount <CollectionHudPill> in top bar
src/db/schema/game.ts                      # (no change — boss enum already there from Phase 1)

PLAN.md                                    # add PR #16 row to Shipped table on merge
```

---

## 5. Twelve zodiac SVG colour palette (frozen)

Each animal locked via the visual companion (zodiac-v3-color.html + zodiac-v4-fixes.html + zodiac-v5-horse-cute.html). All on `viewBox="0 0 64 64"`.

| # | Hanzi | English | Body | Accent | Eye | Notes |
|---|---|---|---|---|---|---|
| 1 | 鼠 | Rat | `#6b5b4a` warm gray | `#e8a8a8` pink inner ears | `#0c3d3a` | Long curving tail |
| 2 | 牛 | Ox | `#6b3914` deep brown | `#fef9ef` cream horns + muzzle | `#fef9ef` whites | 3/4 head, horns curve outward+up |
| 3 | 虎 | Tiger | `#ed7536` sunset orange | `#2a1a08` stripes + 王 forehead | `#2a1a08` | Cream face oval, side body stripes |
| 4 | 兔 | Rabbit | `#fef9ef` cream | `#f4a8a8` inner ears | `#0c3d3a` | `#6b5b4a` thin stroke to lift off card |
| 5 | 龙 | Dragon | `#1e7e4a` emerald | `#f5c537` gold scales | `#fef9ef` | Serpentine S-body, horns + whiskers |
| 6 | 蛇 | Snake | `#6a7d2f` olive | `#f5c537` gold pattern dots | `#0c3d3a` | Red forked tongue `#d83d3d` |
| 7 | 马 | Horse | `#8b4513` chestnut | `#2a1a08` mane, `#c89f5e` muzzle | `#fef9ef` big eyes | Chibi: round head, blush `#e8a8a8`, smile |
| 8 | 羊 | Sheep | `#fef9ef` cream | `#6b3914` face + `#2a1a08` horns | `#fef9ef` whites | `#6b5b4a` thin stroke on wool |
| 9 | 猴 | Monkey | `#a05f2e` warm brown | `#f5c89e` face + belly | `#0c3d3a` | Curly tail |
| 10 | 鸡 | Rooster | `#fef9ef` cream body | `#d83d3d` comb + wattle, `#ed7536` tail, `#f5c537` beak | `#0c3d3a` | Most colour-rich tile |
| 11 | 狗 | Dog | `#c89f5e` tan | `#8b4513` ears + spot | `#0c3d3a` | Cream muzzle |
| 12 | 猪 | Pig | `#e8a8a8` pink | `#d99090` darker snout + hooves | `#0c3d3a` | Two triangle ears with pink inner |

**Implementation:** one `zodiac-icons.tsx` file exports `<ZodiacIconDefs />` (an `<svg width="0" height="0">` with all 12 `<symbol>` defs), plus a type `ZodiacSlug = 'rat' | 'ox' | ... | 'pig'`. Consumers render `<svg viewBox="0 0 64 64"><use href={`#z-${slug}`} /></svg>`.

Card frame styling — `radial-gradient(ellipse, #fef9ef → #f5e0a8)` with `3px solid #c89f5e` border + `inset 0 0 0 2px rgba(245,197,55,0.5)` inner gold glow. Locked tiles use `linear-gradient(#ece4d0 → #d8c89a)` background + `filter: grayscale(1) opacity(0.35)` on the SVG.

---

## 6. Schema migration

```sql
-- drizzle/NNNN_boss_gacha.sql
ALTER TABLE week_progress
  ADD COLUMN free_pull_claimed boolean NOT NULL DEFAULT false;
```

Single column, default `false`. Existing rows backfill to `false` so they don't pre-claim. No other tables changed — all other Phase 5 tables (`gacha_pulls`, `collection_packs`, `collectible_items`, `child_collections`, `shard_balances`) shipped in PR #1.

Drizzle schema source: add `freePullClaimed: boolean('free_pull_claimed').notNull().default(false)` to `weekProgress` in `src/db/schema/game.ts`. Then `pnpm db:generate && pnpm db:migrate`.

---

## 7. Boss data flow

```
Compile-week pipeline (chars.length >= 10):
  ├─ 14 existing levels (10 flashcards + 4 quiz)
  └─ 15th: boss level
       sceneConfig = {
         characterIds: shuffle(chars).slice(0, 10).map(c => c.id),
         questionTypes: ['audio_pick', 'visual_pick', 'image_pick']
       }

Child plays /play/[childId]/level/[weekId]:
  SceneRunner walks levels[]
  Reaches index=14 → sceneType='boss'
  → <BossScene
       characterIds={config.characterIds}
       questionTypes={config.questionTypes}
       pool={pool}
       onComplete={advance}
     />

BossScene internal state:
  - questions: Array<{ character, questionType }> generated on mount (random mix)
  - currentIdx: 0..9
  - lives: 3 → 0
  - phase: 'fighting' | 'defeated' | 'victory'

For each question, renders <MultipleChoiceQuiz prompt stimulus choices onComplete={(correct) => ...}>
  on correct: currentIdx++; if currentIdx===10 → phase='victory' → onComplete(true)
  on wrong:   lives--; if lives===0 → phase='defeated'

When phase='defeated':
  - <BossKraken state="winning" /> (red tint shake)
  - "海怪赢了这局！" headline
  - <WoodSignButton onClick={reset}>再战 (免费)</WoodSignButton>
  - reset() => setLives(3); setCurrentIdx(0); setPhase('fighting')

When phase='victory':
  - immediate onComplete(true) — SceneRunner advances to end-state

SceneRunner end-state detects lastSceneType==='boss' && done:
  → passes chestAvailable={true} to LevelFanfare
```

---

## 8. Free pull (boss clear) flow

```
LevelFanfare with chestAvailable=true:
  Renders existing Lottie pirate-fanfare + "Boss defeated!" headline +
  TWO buttons stacked vertically:
    • <WoodSignButton onClick={openChest}>开启宝箱 🎁</WoodSignButton>
    • <WoodSignButton variant="ghost" onClick={onContinue}>回地图</WoodSignButton>

Tap "开启宝箱":
  client calls pullFreeFromBoss(weekId) server action

Server action (lib/actions/gacha.ts):
  Wrapped in db.transaction():
    1. select week_progress where (childId, weekId)
    2. assert progress.bossCleared === true
    3. assert progress.free_pull_claimed === false
       (if true, throw AlreadyClaimedError — UI handles gracefully)
    4. update week_progress set free_pull_claimed = true
       (set BEFORE the pull but inside the outer tx, so if pull throws
       everything rolls back including this flag)
    5. call pullInTx(tx, childId, ZODIAC_PACK_ID, { isFree: true, costCoins: 0 })
       → returns { item, wasDuplicate, shardsAfter, coinsAfter }
    6. return result

Implementation detail: `pull()` and `pullInTx(tx, ...)` are two layers.
`pullInTx` takes a transaction; `pull()` is a thin wrapper that opens its
own tx and calls `pullInTx`. The free-pull server action calls `pullInTx`
within its own outer tx (so the week_progress update and the pull share a
transaction). The paid-pull server action just calls `pull()` (its own tx).

Client receives result:
  Replace LevelFanfare body with <TreasureChestReveal item wasDuplicate />
    - Chest .80s shake animation
    - Chest 'opens' (scale up + fade tan to glowing gold)
    - <ZodiacCard> slides up from chest position to center
    - If wasDuplicate: float-up "+1 卡屑" text near chest, opacity 0→1→0 over 1.2s
    - Bottom: <WoodSignButton onClick={() => router.push(`/play/${childId}`)}>回地图</WoodSignButton>

If pullFreeFromBoss throws (AlreadyClaimed, server error):
  Toast "宝箱已经开过啦" + auto-redirect to /play/${childId} after 2s
```

---

## 9. Paid pull (collection page) flow

```
/play/[childId]/collection (server component):
  loads:
    - currentPack (ZODIAC_PACK_ID via getPackBySlug('zodiac-v1'))
    - collection = listChildCollection(childId, packSlug='zodiac-v1')
        → [{ item, count, firstObtainedAt } for each owned]
    - balance from coinBalances
    - shardBalance from shardBalances

Page layout:
  Top bar: ← back to /play/[childId]
  Title: "十二生肖 · {owned}/12"
  Pull button (top-right): <WoodSignButton disabled={balance < 500} onClick={onPullClick}>
    抽卡 500 🪙
  </WoodSignButton>
  Stats line: "🪙 {balance} · 卡屑 {shardBalance}/100"
  <CollectionGrid items={pack.items} owned={collection} />  // 4×3 grid

onPullClick:
  client calls pullPaid('zodiac-v1') server action

Server action:
  pull(childId, ZODIAC_PACK_ID, { isFree: false, costCoins: 500 })
  → throws InsufficientCoinsError if balance < 500 (caught client-side, toast)
  → otherwise returns same PullResult shape as free pull

Client receives result:
  Mount <TreasureChestReveal item wasDuplicate /> as a modal overlay
  After reveal, dismissing the modal returns to /collection (no nav)
  CollectionGrid + balance/shard refresh via router.refresh() or React state
```

---

## 10. `gacha.pull()` algorithm

```ts
// src/lib/db/gacha.ts
export interface PullResult {
  item: CollectibleItem;
  wasDuplicate: boolean;
  shardsAfter: number | null;  // null for new card, count for duplicate
  coinsAfter: number;
}

export class InsufficientCoinsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient coins: need ${required}, have ${available}`);
    this.name = 'InsufficientCoinsError';
  }
}

export class AlreadyClaimedError extends Error {
  constructor() {
    super('Free pull already claimed for this week');
    this.name = 'AlreadyClaimedError';
  }
}

// Tx is the drizzle transaction handle type (Parameters<DbClient['transaction']>[0]).
// Define an alias type in gacha.ts to avoid the verbose generic.

export async function pull(
  childId: string,
  packId: string,
  opts: { isFree: boolean; costCoins: number },
): Promise<PullResult> {
  return db.transaction((tx) => pullInTx(tx, childId, packId, opts));
}

export async function pullInTx(
  tx: Tx,
  childId: string,
  packId: string,
  opts: { isFree: boolean; costCoins: number },
): Promise<PullResult> {
  // 1. Deduct coins for paid pulls. Atomic with the rest of the pull —
  //    any later throw rolls back the deduction too.
  if (!opts.isFree) {
    const [bal] = await tx.select({ balance: coinBalances.balance })
      .from(coinBalances)
      .where(eq(coinBalances.childId, childId));
    if (!bal || bal.balance < opts.costCoins) {
      throw new InsufficientCoinsError(opts.costCoins, bal?.balance ?? 0);
    }
    await awardCoinsInTx(tx, {
      childId,
      delta: -opts.costCoins,
      reason: 'gacha_pull',
      refType: 'pack',
      refId: packId,
    });
  }

  // 2. Fetch pack items, compute total weight, roll.
  const items = await tx.select().from(collectibleItems)
    .where(eq(collectibleItems.packId, packId));
  if (items.length === 0) throw new Error(`Pack ${packId} is empty`);

  const totalWeight = items.reduce((s, i) => s + i.dropWeight, 0);
  let roll = Math.random() * totalWeight;
  let picked: CollectibleItem | undefined;
  for (const item of items) {
    roll -= item.dropWeight;
    if (roll <= 0) { picked = item; break; }
  }
  picked ??= items[items.length - 1];  // float-edge fallback

  // 3. Check if already owned.
  const [existing] = await tx.select()
    .from(childCollections)
    .where(and(
      eq(childCollections.childId, childId),
      eq(childCollections.itemId, picked.id),
    ))
    .limit(1);
  const wasDuplicate = !!existing;

  // 4. Write collection / shard updates.
  let shardsAfter: number | null = null;
  if (wasDuplicate) {
    await tx.update(childCollections)
      .set({ count: sql`${childCollections.count} + 1` })
      .where(and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, picked.id),
      ));

    const [shardRow] = await tx.insert(shardBalances)
      .values({ childId, packId, shards: 1 })
      .onConflictDoUpdate({
        target: [shardBalances.childId, shardBalances.packId],
        set: { shards: sql`${shardBalances.shards} + 1` },
      })
      .returning();
    shardsAfter = shardRow.shards;
  } else {
    await tx.insert(childCollections).values({
      childId,
      itemId: picked.id,
      count: 1,
      firstObtainedAt: new Date(),
    });
  }

  // 5. Record the pull.
  await tx.insert(gachaPulls).values({
    childId,
    packId,
    costCoins: opts.costCoins,
    isFree: opts.isFree,
    resultItemId: picked.id,
    wasDuplicate,
  });

  // 6. Return current coin balance for UI sync.
  const [bal] = await tx.select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));

  return {
    item: picked,
    wasDuplicate,
    shardsAfter,
    coinsAfter: bal?.balance ?? 0,
  };
}
```

---

## 11. `seed-zodiac-pack.ts` content

```ts
// One pack row
INSERT INTO collection_packs (slug, name, description, theme_color, is_active)
VALUES ('zodiac-v1', '十二生肖', 'Twelve animals of the Chinese zodiac', '#f5c537', true);

// Twelve collectible_items (drop_weight uniformly 1 for V1)
For each of [鼠, 牛, 虎, 兔, 龙, 蛇, 马, 羊, 猴, 鸡, 狗, 猪]:
  INSERT INTO collectible_items (
    pack_id, slug, name_zh, name_en, lore_zh, lore_en, rarity, drop_weight, image_url
  ) VALUES (
    <packId>, '<slug>', '<hanzi>', '<English>',
    '<one-sentence lore in zh>', '<one-sentence lore in en>',
    'common', 1, null  // image is the inline SVG, no URL needed
  );

// Boss scene template (idempotent — ok to re-run)
INSERT INTO scene_templates (type, version, default_config, is_active)
VALUES ('boss', 1, '{}', true)
ON CONFLICT DO NOTHING;
```

Lore examples (age-appropriate, ≤ 12 zh chars per sentence):
- 鼠 zh: "小小的，跑得快。" en: "Tiny but quick."
- 牛 zh: "力气大，耐心好。" en: "Strong and patient."
- 虎 zh: "森林里最有威风。" en: "King of the forest."
- 兔 zh: "毛茸茸，跳得高。" en: "Fluffy and bouncy."
- 龙 zh: "天上飞的神兽。" en: "Mythical sky dragon."
- 蛇 zh: "悄悄地游过草地。" en: "Slithers through grass."
- 马 zh: "草原上跑得快。" en: "Runs across plains."
- 羊 zh: "云一样的羊毛。" en: "Wool like clouds."
- 猴 zh: "顽皮又聪明。" en: "Playful and clever."
- 鸡 zh: "早晨第一个起床。" en: "First up at dawn."
- 狗 zh: "我们的好朋友。" en: "Our best friend."
- 猪 zh: "圆圆的，爱吃。" en: "Round and hungry."

---

## 12. Accessibility — prefers-reduced-motion table

| Surface | Default | reduced-motion ON |
|---|---|---|
| Kraken tentacle wave | framer-motion `[rotate -8 → 8]` 1.8s infinite | Static SVG |
| Kraken winning shake | 4× x-nudge 600ms | Red 1.0 opacity flash 300ms (preserves semantic) |
| Lives indicator decrement | Anchor shake + grayscale 400ms | Instant gray flip |
| BossScene per-question | Inherits PR #15's coin-shower / shake / pulse via reused MultipleChoiceQuiz | Already handled in PR #15 |
| Chest shake (pre-open) | 800ms shake | Skipped, opens instantly |
| Chest open + ZodiacCard reveal | scale 0→1.1→1 + slide-up 600ms | Card appears with `opacity 0→1` over 200ms |
| "+1 卡屑" float-up text | float-up + fade 1.2s | Static "+1 卡屑" displayed 1s then removed |
| LevelFanfare Lottie + sound | Inherits PR #15 behavior | Already handled |

All fx components consume `useReducedMotion()` from `@/lib/hooks/use-reduced-motion` and early-return their degraded form. No new a11y infrastructure.

A11y attributes:
- Kraken `<svg aria-hidden="true">` (decorative)
- Lives `<span role="status" aria-label="3 lives remaining">⚓ ⚓ ⚓</span>` (announces on change)
- Chest reveal `<div role="dialog" aria-labelledby="reveal-title">`
- ZodiacCard hanzi rendered in document flow so screen readers announce "兔 · tù · Rabbit"

---

## 13. Asset budget

| Item | Size (gzip) | Notes |
|---|---|---|
| `zodiac-icons.tsx` (12 inline SVG `<symbol>` defs) | ~3 KB | Total ~150 lines of SVG path data |
| `BossKraken.tsx` | ~1 KB | One component, inline kraken silhouette |
| Boss / chest / collection components | ~4 KB | TS source for runtime client |
| Server-only modules (gacha.ts, collections.ts, server actions) | 0 KB | Not in client bundle |
| Schema migration SQL | 0 KB | Build-time |
| **Total client impact** | **~8 KB gzip** | vs PR #15's ~80 KB |

The /collection route is a separate Next.js route → its bundle is split from /play/[childId]/level/[weekId]. Loading /collection only loads collection-page code; loading a level only loads boss/chest code at boss time.

---

## 14. Testing strategy

| Layer | Coverage |
|---|---|
| Vitest unit (gacha algorithm) | (1) weighted random: mock `Math.random` returning 0/0.5/0.99, assert 3 different items picked; (2) duplicate path: seed `child_collections` already has item → second pull bumps count+1, shardBalances+1; (3) insufficient coins: paid pull when balance < 500 → throws `InsufficientCoinsError`; (4) empty pack: throws meaningful error |
| Vitest unit (idempotency) | (5) `pullFreeFromBoss` second call on same `weekId` → throws `AlreadyClaimedError`; (6) `pullFreeFromBoss` when `bossCleared=false` → throws |
| Vitest unit (compile-week) | (7) chars=10 → 15th level has sceneType='boss', config has 10 characterIds and 3 questionTypes; (8) chars=9 → no boss level emitted |
| Vitest component | (9) `<BossScene>` 10 correct answers → onComplete(true); (10) `<BossScene>` 3 wrong → phase='defeated' + "再战" button; (11) `<BossScene>` reduced-motion → kraken wrapped without framer-motion; (12) `<TreasureChestReveal>` renders item content (svg + hanzi + name); (13) `<TreasureChestReveal>` shardsAfter prop renders "+1 卡屑" only when wasDuplicate=true; (14) `<CollectionGrid>` owned vs locked visual differentiation; (15) `<GachaPullButton>` disabled when balance < 500 |
| Vitest integration (transaction) | (16) full pull flow: mock db.transaction, call `pullFreeFromBoss(weekId)` → assert order of inserts (week_progress update → coin deduction (free=skip) → child_collections insert → gacha_pulls insert) |
| Type / Lint / Build | `pnpm typecheck && pnpm lint && pnpm build` all green |
| Manual on Vercel preview | (a) play one week with chars≥10, reach boss, win → see chest → click open → see zodiac reveal → click back → see /collection updated; (b) toggle macOS reduce-motion, replay: confirm chest shake absent but reveal still arrives; (c) on /collection, click 抽卡 500 → if balance≥500, see reveal; balance < 500, button disabled |

Expected test count: 97 → ~122. New test files:
- `tests/unit/gacha-pull.test.ts`
- `tests/unit/gacha-free-pull.test.ts`
- `tests/unit/compile-week-boss.test.ts`
- `tests/unit/boss-scene.test.tsx`
- `tests/unit/treasure-chest-reveal.test.tsx`
- `tests/unit/collection-grid.test.tsx`
- `tests/unit/gacha-pull-button.test.tsx`

---

## 15. Risks & non-goals

| Risk | Mitigation |
|---|---|
| Boss 10 questions too long for 6-year-old | Yinuo empirical test; if she fatigues mid-fight, follow-up PR tunes to 8 questions / 2 lives. |
| `free_pull_claimed=true` set before pull → pull error loses card | Entire flow wrapped in `db.transaction()`; any throw rolls back including the flag. |
| Zodiac SVG blurs on iPhone SE | 64×64 viewBox + CSS `width:100%` self-scales; tested at 60×60px floor. |
| Kraken tentacle framer-motion drains battery | Animation only runs when `phase === 'fighting'`; pauses in 'defeated' / 'victory'. |
| Multi-child family pulls same pack concurrently | All gacha tx scoped by `childId`; no shared cross-child state. |
| All 12 dropWeights = 1 → no statistical "specialness" | Acceptable for V1. Future packs can differentiate weight per item. |
| Free pull use-it-or-lose-it could feel unfair | Boss reward is the chest moment; if Yinuo regularly skips, follow-up PR adds voucher table. |
| 12 zodiac too small a pack to feel collectible | Acceptable for V1 — Yinuo can complete the collection in <20 boss clears. Future packs (节日, 部首, etc.) expand. |

Non-goals (explicit):

- No commissioned art for any zodiac (hand-authored SVG is the V1 strategy per art_direction).
- No real-time multiplayer collection trading.
- No "Boss skip" purchase option (boss must be played, not bought past).
- No voucher redemption UI (shards are written but unused).
- No tracing scene in this PR — separate small PR.

---

## 16. Handoff to implementation

After approval, the next skill is `superpowers:writing-plans` to convert this spec into a step-by-step TDD implementation plan with per-task commits.
