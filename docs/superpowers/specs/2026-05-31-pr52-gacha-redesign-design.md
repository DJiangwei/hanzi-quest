# PR #52 — Gacha Economy Redesign — Design

**Status:** approved (David, 2026-05-31)
**Branch:** `feat/pr52-gacha-redesign`
**Owner:** Claude + David

---

## 1. Goal

Replace the existing "spend 300-500 coins to gacha a card" shop economy with a play-to-earn flow where cards arrive organically from boss clears, weekly perfection, and story chapters. Duplicates become useful via a per-pack shard-and-swap mechanic so kids never feel a pull was wasted.

## 2. Why

David's playtest revealed the coin-purchased gacha felt disconnected from gameplay — Yinuo wasn't sure why she was spending coins or what she was getting. Cards should be a direct reward for doing the learning loop. Surplus dupes were also frustrating; the swap mechanic gives every pull a forward-moving value, even when it lands on something she already has.

## 3. Scope

### Locked decisions

| Decision | Choice |
|---|---|
| Card sources | Boss clear (incl. repeats), perfect_week, story chapter — 3 channels |
| Weekly cap | 10 cards/wk (boss=up-to-8, perfect=1, story=1), resets UTC Monday |
| Pack selection per pull | Random across all 5 active packs, weighted by remaining unowned items |
| Duplicate handling | `child_collections.count` increments; UI shows `×N` badge |
| Swap currency | Per-pack shards (reuse existing `shard_balances` table); 1 dupe → 1 shard |
| Swap cost | **3 shards = 1 chosen card** of the same pack |
| Coin gacha | Removed entirely from shop; no coin refund |
| PR #51 `freePullClaimed` | Reverted — chest shows on every boss clear (when under cap) |
| Schema migration | None — reuse existing `childCollections.count` + `shardBalances.shards` + 1 new table for weekly cap |

### Non-goals

- Cross-pack swap (shards from flags can't buy zodiac).
- Coin → shard direct trade.
- Rarity-weighted swap costs (epic same as common).
- Backlog grant for past boss clears prior to PR #52 ship — Yinuo's existing collection stays as-is; new earnings start from merge.
- Pack-add UX in admin (still requires `packRegistry.ts` edit + seed script, as today).

## 4. Architecture

### 4.1 New table — `child_card_grants_weekly`

```ts
export const childCardGrantsWeekly = pgTable(
  'child_card_grants_weekly',
  {
    childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekStartUtc: text('week_start_utc').notNull(), // ISO date string YYYY-MM-DD of UTC Monday
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.weekStartUtc] })],
);
```

PK is `(childId, weekStartUtc)`. The `weekStartUtc` is computed by `mondayOfIsoWeek(todayUtcIso())` — same helper already in `src/app/play/[childId]/page.tsx`. Move that helper to `src/lib/db/streaks.ts` next to `todayUtcIso` so the action can import it.

Migration: `drizzle/0018_<name>.sql` — append-only per CLAUDE.md hard rule.

### 4.2 New action — `pullCardForChild(childId, source, refId)`

Lives in `src/lib/actions/gacha.ts` alongside existing `pullFreeFromBoss` + `pullPaid`.

```ts
type CardGrantSource = 'boss_clear' | 'perfect_week' | 'story_chapter';

export async function pullCardForChild(
  childId: string,
  source: CardGrantSource,
  refId: string,           // weekId for boss/perfect; chapterId for story
): Promise<
  | { granted: true; itemId: string; packSlug: string; isDupe: boolean; shardsAfter: number; cardsThisWeek: number }
  | { granted: false; reason: 'weekly_cap_reached'; cardsThisWeek: number }
>;
```

Transaction body:

1. Compute current `weekStartUtc`. SELECT-FOR-UPDATE `child_card_grants_weekly` row, default 0.
2. If `count >= 10` → return `{granted: false, reason: 'weekly_cap_reached', cardsThisWeek: count}`.
3. Idempotency check: SELECT `coin_transactions` (or a dedicated `card_grants` log — TBD see §6) where `refType + refId + childId + source` already exists → if so, return short-circuit `{granted: false, reason: 'weekly_cap_reached'}` style or just don't re-grant. **Resolution:** add a new table `card_grants_log` (childId, source, refId) PK → idempotency. Insert into it before incrementing count.
4. Select a random item across all active packs weighted by remaining unowned items for this child. Algorithm: enumerate all `collectible_items` joined with `child_collections` LEFT JOIN; weight = max(1, unowned_remaining_in_pack); roll random; pick. Falls back to flat random if all packs are 100% owned (in which case every pull is a dupe by definition).
5. Upsert `child_collections (childId, itemId)` with `count = count + 1`. Detect dupe by checking if the row pre-existed (or comparing `count` after).
6. If dupe: increment `shard_balances` for that `(childId, packId)` by 1.
7. Increment the weekly counter `count = count + 1`.
8. Commit.

Returns the grant summary for the UI to display ("New card! 🦜 / +1 shard for Flags").

### 4.3 New action — `swapShardsForItem(childId, itemId)`

```ts
export async function swapShardsForItem(
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; shardsRemaining: number }
  | { ok: false; reason: 'insufficient_shards' | 'already_owned' | 'item_not_found' }
>;
```

Transaction:
1. Look up the item's `packId`.
2. Check ownership — if already in `child_collections` → reject `already_owned` (swap is for UNOWNED items only; for dupes the kid just gets shards automatically).
3. SELECT-FOR-UPDATE `shard_balances` for `(childId, packId)`. If shards < 3 → reject `insufficient_shards`.
4. Decrement shards by 3.
5. Insert `child_collections (childId, itemId, count = 1)`.
6. Commit. Returns `{ok: true, shardsRemaining}`.

### 4.4 Wiring — where `pullCardForChild` is called

- **Boss clear:** `src/lib/actions/play.ts finishLevelAction` — boss-cleared branch (already exists). Call `pullCardForChild(childId, 'boss_clear', weekId)` AFTER existing coin + trophy logic. Capture the result in the return shape so the LevelFanfare can show the card animation. **Revert PR #51's `freePullClaimed` gating in `SceneRunner` — chest button shows whenever `lastSceneType === 'boss'`, period.**
- **perfect_week:** Currently `awardPerfectWeekIfDue(child.id, parsed.weekId)` returns `{awarded, delta}`. Extend to also call `pullCardForChild(childId, 'perfect_week', weekId)` when first-awarded. Surface the card via existing bonuses pipeline.
- **Story chapter:** `markChapterReadAction(childId, weekId)` — already marks `story_chapters.read_at`. Extend to call `pullCardForChild(childId, 'story_chapter', chapterId)` on first read (when `read_at` was null before this call).

All three callsites: if `pullCardForChild` returns `{granted: false, reason: 'weekly_cap_reached'}`, just don't show a card toast — coins/trophies/streak still flow as before.

### 4.5 UI surfaces

- **Backpack pack-page (`/play/[childId]/collection/[packSlug]`)**:
  - Owned items: `count` badge on the card (`×3` if count > 1).
  - Pack header: shard balance pill (`🔹 5`) next to existing progress meter.
  - Unowned items: tap → bottom sheet "Trade 3 shards for this card" if shards ≥ 3, else greyed-out "Need {3 - shards} more shards" hint.
- **Per-pack page — remove the existing "Buy a pull" CTA entirely.** Delete the `GachaPullButton` component (or keep file, remove from page). `pullPaid` action becomes dead code (gate behind `// deprecated PR #52` comment for one release in case of rollback). Coin balance pill stays in place (still used for shop).
- **LevelFanfare (boss-clear screen)**:
  - When card was granted: show new card reveal (similar to existing chest animation) below the "Boss defeated!" line.
  - When weekly cap reached: show "+50 coins" but no card; copy: "今天的卡片满了 🎉 / Today's card limit reached".
- **Backpack "Recently Obtained" strip**: show `+1` sticker for dupes (gold), `NEW` sticker for first-time (red). Existing 24h `nowMs` pattern unchanged.

### 4.6 Drop-weight algorithm

The "weighted by remaining unowned" is the only nuanced piece. Pseudocode:

```ts
// Inside pullCardForChild transaction:
const items = await db
  .select({ id: collectibleItems.id, packId: collectibleItems.packId, dropWeight: collectibleItems.dropWeight })
  .from(collectibleItems)
  .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
  .where(eq(collectionPacks.isActive, true));

const owned = await db
  .select({ itemId: childCollections.itemId })
  .from(childCollections)
  .where(eq(childCollections.childId, childId));
const ownedSet = new Set(owned.map((o) => o.itemId));

// Compute per-pack unowned count for weighting bias.
const packUnowned = new Map<string, number>();
for (const item of items) {
  if (!ownedSet.has(item.id)) {
    packUnowned.set(item.packId, (packUnowned.get(item.packId) ?? 0) + 1);
  }
}

// Weight each item: dropWeight × (1 + packUnowned[packId])
// When pack is complete (packUnowned=0): weight degenerates to dropWeight (pull will be a dupe).
const weighted = items.map((item) => ({
  ...item,
  weight: item.dropWeight * (1 + (packUnowned.get(item.packId) ?? 0)),
}));

const totalWeight = weighted.reduce((a, b) => a + b.weight, 0);
let roll = Math.random() * totalWeight;
let picked = weighted[0];
for (const w of weighted) {
  roll -= w.weight;
  if (roll <= 0) { picked = w; break; }
}
```

The `dropWeight` column on `collectible_items` already exists (default 1) and lets us tune rarities later. This algorithm reads ~100 rows max (87 items + room to grow) — fine to do inside the transaction.

## 5. Data flow

```
Yinuo clears boss (or marks story read, or completes perfect week)
    ↓
finishLevelAction / markChapterReadAction (server)
    ↓
pullCardForChild(childId, source, refId)
    ↓ inside tx:
    ├─ check cap (returns early if 10/wk reached)
    ├─ check idempotency (card_grants_log)
    ├─ weighted random pick
    ├─ upsert child_collections (count++)
    ├─ if dupe: shard_balances++ for pack
    └─ child_card_grants_weekly.count++
    ↓
return to client → LevelFanfare / BonusToast renders card or shard reveal
```

```
Yinuo taps unowned card on pack page
    ↓
SwapDialog component → "Trade 3 shards?" → confirm
    ↓
swapShardsForItem(childId, itemId)
    ↓ inside tx:
    ├─ verify shards ≥ 3
    ├─ shards -= 3
    └─ insert child_collections row
    ↓
revalidatePath → pack page re-renders with new owned item
```

## 6. Schema additions (consolidated)

Migration `drizzle/0018_<name>.sql`:

1. New table `child_card_grants_weekly` (per §4.1).
2. New table `card_grants_log`:
   ```ts
   export const cardGrantsLog = pgTable(
     'card_grants_log',
     {
       childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
       source: text('source').notNull(),     // 'boss_clear' | 'perfect_week' | 'story_chapter'
       refId: text('ref_id').notNull(),      // weekId or chapterId
       grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => [primaryKey({ columns: [t.childId, t.source, t.refId] })],
   );
   ```
   PK enforces idempotency. Each `(child, source, refId)` can grant at most once.
   - **`source='boss_clear'`** → `refId = sessionId` (the `play_sessions.id` that completed the boss). Each boss clear runs in its own session, so sessionId is naturally unique per clear. `sessionId` is already passed to `finishLevelAction` as `parsed.sessionId`. Repeats get fresh sessionIds, so they grant fresh cards.
   - **`source='perfect_week'`** → `refId = weekId`. Only one perfect_week award per week.
   - **`source='story_chapter'`** → `refId = chapterId`. Only one read-grant per chapter.

3. No changes to `childCollections` or `shardBalances` — they already support the new semantics.

## 7. Error handling

- `pullCardForChild` weekly cap reached → return `{granted: false}`. UI: no card, no error — quietly skip the card animation. Coin + trophy logic unaffected.
- `pullCardForChild` idempotency hit (refId already granted) → same shape: `{granted: false}`. UI: no toast. (E.g. user double-taps boss clear, only one card.)
- `swapShardsForItem` insufficient shards → button is gated by UI already, but server still validates. Toast: "Need {N} more shards".
- `swapShardsForItem` already_owned → reject, surface toast. UI should hide swap button on owned items anyway.
- `swapShardsForItem` item_not_found → 500-class server error. Should not happen in normal play.

## 8. Tests (Vitest + RTL + jsdom)

**New test files:**
- `tests/unit/pull-card-for-child.test.ts`:
  - Grants card + increments weekly count
  - Returns `granted: false` at cap (10 grants already)
  - Idempotent on same `(child, source, refId)`
  - Dupe pull increments shards + sets `isDupe: true`
  - First-time pull does NOT change shards
  - Weighted random pick favors packs with more unowned items
- `tests/unit/swap-shards-for-item.test.ts`:
  - Spends 3 shards, grants item
  - Rejects when shards < 3
  - Rejects when item already owned
  - Atomic — partial state never persisted
- `tests/unit/components/play/SwapDialog.test.tsx`:
  - Shows correct shard cost (3) vs balance
  - Disables confirm when insufficient
  - Calls action on confirm
- `tests/unit/components/play/LevelFanfare-card-reveal.test.tsx`:
  - Boss clear with card → reveal animation rendered
  - Boss clear at weekly cap → "card limit reached" copy

**Updated test files:**
- `tests/unit/finish-level-boss.test.ts` — assert `pullCardForChild` called, return shape includes grant result.
- `tests/unit/scene-runner-pr51-chest.test.tsx` — **DELETE** or rewrite. PR #51's `freePullClaimed=true → chestAvailable=false` test asserts the old behavior; PR #52 reverts it. The new test asserts chest shows whenever `lastSceneType === 'boss'`.
- `tests/unit/story-actions.test.ts` (or wherever `markChapterReadAction` is tested) — assert `pullCardForChild` called with source='story_chapter'.
- `tests/unit/story-chapters-db.test.ts` (or perfect-week test file) — same for perfect_week.
- `tests/unit/atlas-hub.test.tsx` — assert shard pill renders per pack.
- `tests/unit/pack-page-body.test.tsx` (or similar) — assert "Buy a pull" button is REMOVED; swap button appears on unowned tiles when shards ≥ 3.

**Estimated:** +25-30 new tests. From 571 → ~600.

## 9. Verification

Pre-merge:
1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — four green.
2. `pnpm dev` → log in → clear boss → confirm:
   - Card reveal animation
   - `child_collections.count` increments (check DB or in-game count badge)
   - Re-clear same boss → another card (different/dupe based on random)
   - After 8 boss clears + perfect + story → 11th clear shows "card limit reached"
3. Backpack pack page → confirm shard pill, `×N` dupe badges, swap button on unowned tiles with ≥3 shards.
4. Shop → confirm no "Buy a pull" button anywhere.
5. Old `child_collections` rows from coin-gacha era still render with `count=1` (no data migration needed; existing rows weren't impacted by schema since `count` defaults to 1).

Post-merge ops: none. No recompile, no backfill. Migration `0018` runs automatically via Vercel build (or manual `pnpm drizzle-kit migrate` against prod if not).

## 10. Open questions / v2 candidates

- **Auto-swap when cap reached:** kid pulls a dupe → shard. What if she'd rather just get coins? Defer; current design has no opt-out.
- **Shard visibility in HUD:** shard balance per pack is only visible on the pack page. A global "shard wallet" page in Backpack is a nice add later — not v1.
- **Animated card-reveal sequence:** v1 uses the existing chest-reveal animation (LevelFanfare already has it). A custom "card flip" animation is v2.
- **Rarity-weighted swap costs:** epic = 5 shards, rare = 3, common = 1. Adds tuning depth, but for 87 total slots (none super-rare) the flat 3-cost works.
- **Boss-repeat fatigue:** if Yinuo grinds boss 8× per week purely for cards, the boss content gets stale fast. Mitigation: rotate the boss kraken animation (a future content PR), or cap boss-source cards lower (e.g. 5/wk) — but that's overfitting. Watch and adjust.
- **Pack-completion bonus:** when a pack hits 100% owned, grant a one-shot bonus (trophy? cosmetic?). v2 candidate.
- **Coin sink rebalancing:** without gacha, coin sinks reduce to shop (avatar/pet/decor/sounds/powerups). Watch whether coin balance balloons; if so, add new sinks or reduce earn rates. Defer.

## 11. Landmines / things to preserve

- **`freePullClaimed` column on `week_progress` stays in DB.** PR #51 added it; PR #52 stops reading it for chest gating, but DON'T drop the column (migration-additive rule) and don't delete the existing data. Future PRs may reuse it for "first-ever boss clear celebration" UX. Comment the column as `// deprecated as gating field since PR #52` in the schema.
- **`pullPaid` action stays in code for one release.** Mark deprecated; don't delete. If PR #52 needs to roll back, easy revert path. Drop in PR #53+.
- **Idempotency on boss repeats requires using `sessionId` not `weekId`.** Each boss clear runs in its own `play_sessions` row. If you naively use `weekId` as refId, only the first boss clear ever grants a card. Always pass `sessionId` (already on `finishLevelAction`'s `parsed.sessionId`).
- **Weighted random in a transaction.** The random pick reads ~100 rows; that's fine, but if the catalog grows to 1000+ items, move to an offline-precomputed weight table.
- **Shard balance is per-pack, not global.** Shards from flags can't buy zodiac. UI must show shard counts per pack distinctly; combining them into a wallet would mislead.
- **Story → card grant fires only on FIRST read.** `markChapterReadAction` is idempotent (sets `read_at` if null). The card grant should only fire when `read_at` was previously null. Wire the check.
- **Perfect_week → card grant fires only when newly awarded.** `awardPerfectWeekIfDue` already returns `{awarded: bool}` — gate on that.

## 12. Effort + rollout

- ~12-14 implementation tasks (1 migration, 2 actions, weekly-cap helper, wire 3 callsites, revert PR #51 chest hide, remove shop gacha button, swap UI, shard pill UI, dupe count badges, fanfare card reveal, tests, CLAUDE.md, verify).
- ~15 files touched.
- 1 migration (0018), no seed change.
- One-day single-session work (subagent-driven).
- Prod data risk: low — additive schema, no destructive change to `child_collections` / `shard_balances`. Existing rows unaffected.
- Rollout: PR → four-green gate → merge → migration auto-runs on Vercel build → done.
