# Admin Economy Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read-only `/admin/economy` page: per-child coin flow, XP by source, card rate vs the 10/day cap, pack completion, and shop exhaustion — from existing ledgers, zero migration/writes/deps.

**Architecture:** `src/lib/db/economy-stats.ts` holds thin async row-fetchers plus **pure, exported shaping functions** (`shapeCoinStats`, `shapeCardDaily`, …) so unit tests hit the shapers with plain fixtures and only lightly mock the fetch layer. A server-component page feeds plain data into presentational components (`EconomyDashboard`, `StatBar`, `PanelCard`) with CSS-percentage bars.

**Tech Stack:** Next.js 16 server components, Drizzle reads, Tailwind. No chart lib.

**Spec:** `docs/superpowers/specs/2026-07-05-admin-economy-dashboard-design.md`

## Global Constraints

- READ-ONLY: SELECTs only; no actions, no revalidate, no migration, no new deps.
- Route inherits `assertAdmin` via `src/app/admin/layout.tsx` — do NOT add a parallel guard, do NOT move the page outside `src/app/admin/`.
- Zero-data children render cleanly (no NaN/division-by-zero; bars at 0%).
- Tests mock `@/db` where a module imports it (`vi.mock('@/db', () => ({ db: {} }))` at minimum) — CI-only failure otherwise.
- Admin-facing: bilingual kid-chrome rule exempt; follow the existing console's ZH/EN label style.
- All four gates green at PR open. Branch: `feat/admin-economy-dashboard` (created; spec committed).

## Schema facts (verified 2026-07-05)

- `coin_transactions(childId, delta int, reason enum, createdAt tz)`; `coin_balances(childId PK, balance, lifetimeEarned)`.
- `xp_events(childId, amount int, source text, createdAt tz)`.
- `child_card_grants_daily(childId, dayUtc 'YYYY-MM-DD', count)`; `card_grants_log(childId, source, refId, createdAt)`.
- `child_collections(childId, itemId, count…)`; `collectible_items(id, packId, nameZh, nameEn…)`; `collection_packs(id, slug, nameZh, nameEn, isActive)`; `child_shards(childId PK, shards)`.
- `shop_items(id, kind enum, priceCoins, isActive)`; `shop_purchases(childId, shopItemId, coinsSpent)`.
- `DAILY_CARD_CAP = 10` exported from `src/lib/db/grants.ts`.

---

### Task 1: `economy-stats.ts` — pure shapers + fetchers for coins & XP

**Files:**
- Create: `src/lib/db/economy-stats.ts`
- Test: `tests/unit/economy-stats.test.ts`

**Interfaces (produced):**

```ts
export interface ReasonTotal { key: string; total: number }
export interface CoinStats {
  balance: number;
  lifetime: { earned: number; spent: number; byReason: ReasonTotal[] };
  last30: { earned: number; spent: number; byReason: ReasonTotal[] };
  weeklyNet: { weekStartIso: string; net: number }[]; // 8 entries, oldest first
}
export interface XpStats { lifetime: ReasonTotal[]; last30: ReasonTotal[] }
// pure:
export function shapeCoinStats(rows: { delta: number; reason: string; createdAt: Date }[], balance: number, now: Date): CoinStats
export function shapeXpStats(rows: { amount: number; source: string; createdAt: Date }[], now: Date): XpStats
// fetchers:
export async function coinStats(childId: string): Promise<CoinStats>
export async function xpStats(childId: string): Promise<XpStats>
```

Shaping rules: `earned` = Σ positive deltas, `spent` = Σ |negative deltas|; `byReason` merges signed totals per reason sorted by |total| desc; `last30` filters `createdAt >= now-30d`; `weeklyNet` buckets the last 8 ISO weeks (Monday start, UTC) including zero weeks, oldest→newest.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/economy-stats.test.ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/db', () => ({ db: {} }));
import { shapeCoinStats, shapeXpStats } from '@/lib/db/economy-stats';

const NOW = new Date('2026-07-05T12:00:00Z');
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000);

describe('shapeCoinStats', () => {
  it('splits earned/spent and groups by reason', () => {
    const s = shapeCoinStats(
      [
        { delta: 100, reason: 'scene_complete', createdAt: d(1) },
        { delta: 50, reason: 'scene_complete', createdAt: d(2) },
        { delta: -80, reason: 'shop_purchase', createdAt: d(3) },
        { delta: 20, reason: 'daily_login', createdAt: d(40) }, // outside 30d
      ],
      500,
      NOW,
    );
    expect(s.balance).toBe(500);
    expect(s.lifetime).toMatchObject({ earned: 170, spent: 80 });
    expect(s.last30).toMatchObject({ earned: 150, spent: 80 });
    expect(s.lifetime.byReason[0]).toEqual({ key: 'scene_complete', total: 150 });
    expect(s.lifetime.byReason).toContainEqual({ key: 'shop_purchase', total: -80 });
  });

  it('produces 8 weekly buckets including empty weeks, oldest first', () => {
    const s = shapeCoinStats([{ delta: 30, reason: 'scene_complete', createdAt: d(2) }], 0, NOW);
    expect(s.weeklyNet).toHaveLength(8);
    expect(s.weeklyNet.at(-1)!.net).toBe(30);
    expect(s.weeklyNet[0].net).toBe(0);
    // buckets are Mondays, ascending
    expect(s.weeklyNet[0].weekStartIso < s.weeklyNet.at(-1)!.weekStartIso).toBe(true);
  });

  it('handles a zero-history child', () => {
    const s = shapeCoinStats([], 0, NOW);
    expect(s.lifetime).toMatchObject({ earned: 0, spent: 0, byReason: [] });
    expect(s.weeklyNet.every((w) => w.net === 0)).toBe(true);
  });
});

describe('shapeXpStats', () => {
  it('groups by source with a 30d window', () => {
    const s = shapeXpStats(
      [
        { amount: 10, source: 'scene_complete', createdAt: d(1) },
        { amount: 30, source: 'homework', createdAt: d(35) },
      ],
      NOW,
    );
    expect(s.lifetime).toContainEqual({ key: 'homework', total: 30 });
    expect(s.last30).toEqual([{ key: 'scene_complete', total: 10 }]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `pnpm vitest run tests/unit/economy-stats.test.ts` → module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/db/economy-stats.ts
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { coinBalances, coinTransactions, xpEvents } from '@/db/schema';

export interface ReasonTotal { key: string; total: number }
export interface CoinStats {
  balance: number;
  lifetime: { earned: number; spent: number; byReason: ReasonTotal[] };
  last30: { earned: number; spent: number; byReason: ReasonTotal[] };
  weeklyNet: { weekStartIso: string; net: number }[];
}
export interface XpStats { lifetime: ReasonTotal[]; last30: ReasonTotal[] }

const DAY_MS = 86_400_000;

function byReasonTotals(rows: { key: string; amount: number }[]): ReasonTotal[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.amount);
  return [...m.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function sums(rows: { delta: number }[]): { earned: number; spent: number } {
  let earned = 0, spent = 0;
  for (const r of rows) r.delta >= 0 ? (earned += r.delta) : (spent += -r.delta);
  return { earned, spent };
}

/** Monday (UTC) of the ISO week containing `t`, as YYYY-MM-DD. */
function mondayIso(t: Date): string {
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function shapeCoinStats(
  rows: { delta: number; reason: string; createdAt: Date }[],
  balance: number,
  now: Date,
): CoinStats {
  const cutoff30 = new Date(now.getTime() - 30 * DAY_MS);
  const recent = rows.filter((r) => r.createdAt >= cutoff30);

  const weeks: { weekStartIso: string; net: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    weeks.push({ weekStartIso: mondayIso(new Date(now.getTime() - i * 7 * DAY_MS)), net: 0 });
  }
  const idx = new Map(weeks.map((w, i) => [w.weekStartIso, i]));
  for (const r of rows) {
    const i = idx.get(mondayIso(r.createdAt));
    if (i !== undefined) weeks[i].net += r.delta;
  }

  return {
    balance,
    lifetime: { ...sums(rows), byReason: byReasonTotals(rows.map((r) => ({ key: r.reason, amount: r.delta }))) },
    last30: { ...sums(recent), byReason: byReasonTotals(recent.map((r) => ({ key: r.reason, amount: r.delta }))) },
    weeklyNet: weeks,
  };
}

export function shapeXpStats(
  rows: { amount: number; source: string; createdAt: Date }[],
  now: Date,
): XpStats {
  const cutoff30 = new Date(now.getTime() - 30 * DAY_MS);
  return {
    lifetime: byReasonTotals(rows.map((r) => ({ key: r.source, amount: r.amount }))),
    last30: byReasonTotals(
      rows.filter((r) => r.createdAt >= cutoff30).map((r) => ({ key: r.source, amount: r.amount })),
    ),
  };
}

export async function coinStats(childId: string): Promise<CoinStats> {
  const [rows, bal] = await Promise.all([
    db
      .select({ delta: coinTransactions.delta, reason: coinTransactions.reason, createdAt: coinTransactions.createdAt })
      .from(coinTransactions)
      .where(eq(coinTransactions.childId, childId)),
    db.select({ balance: coinBalances.balance }).from(coinBalances).where(eq(coinBalances.childId, childId)),
  ]);
  return shapeCoinStats(rows, bal[0]?.balance ?? 0, new Date());
}

export async function xpStats(childId: string): Promise<XpStats> {
  const rows = await db
    .select({ amount: xpEvents.amount, source: xpEvents.source, createdAt: xpEvents.createdAt })
    .from(xpEvents)
    .where(eq(xpEvents.childId, childId));
  return shapeXpStats(rows, new Date());
}
```

(Unused imports `and/desc/gte` must be dropped at implementation time if the linter flags them.)

- [ ] **Step 4: Run to verify PASS** — `pnpm vitest run tests/unit/economy-stats.test.ts` (6 tests) + `pnpm typecheck`.

- [ ] **Step 5: Commit** — `git add src/lib/db/economy-stats.ts tests/unit/economy-stats.test.ts && git commit -m "feat(admin): economy-stats coins+XP shapers/fetchers"`

---

### Task 2: cards + shop exhaustion + all-children totals

**Files:**
- Modify: `src/lib/db/economy-stats.ts` (append)
- Test: append to `tests/unit/economy-stats.test.ts`

**Interfaces (produced):**

```ts
export interface CardStats {
  daily: { dayUtc: string; count: number }[]; // last 14 days incl zeros, oldest first
  bySource: ReasonTotal[];                    // counts per card_grants_log.source
  packCompletion: { slug: string; nameZh: string; nameEn: string; owned: number; total: number }[];
  shards: number;
}
export interface ShopExhaustion {
  byKind: { kind: string; owned: number; total: number; remainingCost: number }[];
  totalRemainingCost: number;
  balance: number;
}
export interface ChildTotals { childId: string; displayName: string; balance: number; coins30d: number; cards14d: number }
// pure:
export function shapeCardDaily(rows: { dayUtc: string; count: number }[], todayUtcIso: string): { dayUtc: string; count: number }[]
export function shapeShopExhaustion(items: { id: string; kind: string; priceCoins: number }[], ownedIds: Set<string>, balance: number): ShopExhaustion
// fetchers:
export async function cardStats(childId: string): Promise<CardStats>
export async function shopExhaustion(childId: string): Promise<ShopExhaustion>
export async function allChildrenTotals(): Promise<ChildTotals[]>
```

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { shapeCardDaily, shapeShopExhaustion } from '@/lib/db/economy-stats';

describe('shapeCardDaily', () => {
  it('fills 14 days incl zeros, oldest first', () => {
    const out = shapeCardDaily([{ dayUtc: '2026-07-04', count: 3 }], '2026-07-05');
    expect(out).toHaveLength(14);
    expect(out.at(-1)).toEqual({ dayUtc: '2026-07-05', count: 0 });
    expect(out.at(-2)).toEqual({ dayUtc: '2026-07-04', count: 3 });
    expect(out[0].dayUtc).toBe('2026-06-22');
  });
});

describe('shapeShopExhaustion', () => {
  it('computes owned/total/remainingCost per kind + grand total', () => {
    const items = [
      { id: 'a', kind: 'avatar', priceCoins: 100 },
      { id: 'b', kind: 'avatar', priceCoins: 200 },
      { id: 'c', kind: 'pet', priceCoins: 300 },
    ];
    const s = shapeShopExhaustion(items, new Set(['a']), 250);
    expect(s.byKind).toContainEqual({ kind: 'avatar', owned: 1, total: 2, remainingCost: 200 });
    expect(s.byKind).toContainEqual({ kind: 'pet', owned: 0, total: 1, remainingCost: 300 });
    expect(s.totalRemainingCost).toBe(500);
    expect(s.balance).toBe(250);
  });

  it('handles empty catalog', () => {
    const s = shapeShopExhaustion([], new Set(), 0);
    expect(s.byKind).toEqual([]);
    expect(s.totalRemainingCost).toBe(0);
  });
});
```

- [ ] **Step 2: FAIL run**, then **Step 3: Implement** (append to `economy-stats.ts`):

```ts
import {
  cardGrantsLog, childCardGrantsDaily, childCollections, childShards,
  collectibleItems, collectionPacks, childProfiles, shopItems, shopPurchases,
} from '@/db/schema';

export function shapeCardDaily(
  rows: { dayUtc: string; count: number }[],
  todayUtcIso: string,
): { dayUtc: string; count: number }[] {
  const byDay = new Map(rows.map((r) => [r.dayUtc, r.count]));
  const out: { dayUtc: string; count: number }[] = [];
  const today = new Date(`${todayUtcIso}T00:00:00Z`);
  for (let i = 13; i >= 0; i--) {
    const iso = new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    out.push({ dayUtc: iso, count: byDay.get(iso) ?? 0 });
  }
  return out;
}

export function shapeShopExhaustion(
  items: { id: string; kind: string; priceCoins: number }[],
  ownedIds: Set<string>,
  balance: number,
): ShopExhaustion {
  const kinds = new Map<string, { owned: number; total: number; remainingCost: number }>();
  let totalRemainingCost = 0;
  for (const it of items) {
    const k = kinds.get(it.kind) ?? { owned: 0, total: 0, remainingCost: 0 };
    k.total += 1;
    if (ownedIds.has(it.id)) k.owned += 1;
    else { k.remainingCost += it.priceCoins; totalRemainingCost += it.priceCoins; }
    kinds.set(it.kind, k);
  }
  return {
    byKind: [...kinds.entries()].map(([kind, v]) => ({ kind, ...v })),
    totalRemainingCost,
    balance,
  };
}

export async function cardStats(childId: string): Promise<CardStats> {
  const [daily, log, packs, ownedByPack, shards] = await Promise.all([
    db.select({ dayUtc: childCardGrantsDaily.dayUtc, count: childCardGrantsDaily.count })
      .from(childCardGrantsDaily).where(eq(childCardGrantsDaily.childId, childId)),
    db.select({ source: cardGrantsLog.source }).from(cardGrantsLog).where(eq(cardGrantsLog.childId, childId)),
    db.select({ id: collectionPacks.id, slug: collectionPacks.slug, nameZh: collectionPacks.nameZh, nameEn: collectionPacks.nameEn })
      .from(collectionPacks).where(eq(collectionPacks.isActive, true)),
    db.select({ packId: collectibleItems.packId, itemId: collectibleItems.id, childId: childCollections.childId })
      .from(collectibleItems)
      .leftJoin(childCollections, and(eq(childCollections.itemId, collectibleItems.id), eq(childCollections.childId, childId))),
    db.select({ shards: childShards.shards }).from(childShards).where(eq(childShards.childId, childId)),
  ]);

  const perPack = new Map<string, { owned: number; total: number }>();
  for (const r of ownedByPack) {
    const p = perPack.get(r.packId) ?? { owned: 0, total: 0 };
    p.total += 1;
    if (r.childId) p.owned += 1;
    perPack.set(r.packId, p);
  }

  return {
    daily: shapeCardDaily(daily, new Date().toISOString().slice(0, 10)),
    bySource: byReasonTotals(log.map((l) => ({ key: l.source, amount: 1 }))),
    packCompletion: packs.map((p) => ({
      slug: p.slug, nameZh: p.nameZh ?? p.slug, nameEn: p.nameEn ?? p.slug,
      ...(perPack.get(p.id) ?? { owned: 0, total: 0 }),
    })),
    shards: shards[0]?.shards ?? 0,
  };
}

export async function shopExhaustion(childId: string): Promise<ShopExhaustion> {
  const [items, purchases, bal] = await Promise.all([
    db.select({ id: shopItems.id, kind: shopItems.kind, priceCoins: shopItems.priceCoins })
      .from(shopItems).where(eq(shopItems.isActive, true)),
    db.select({ shopItemId: shopPurchases.shopItemId }).from(shopPurchases).where(eq(shopPurchases.childId, childId)),
    db.select({ balance: coinBalances.balance }).from(coinBalances).where(eq(coinBalances.childId, childId)),
  ]);
  return shapeShopExhaustion(items, new Set(purchases.map((p) => p.shopItemId)), bal[0]?.balance ?? 0);
}

export async function allChildrenTotals(): Promise<ChildTotals[]> {
  const children = await db
    .select({ childId: childProfiles.id, displayName: childProfiles.displayName })
    .from(childProfiles);
  return Promise.all(
    children.map(async (c) => {
      const [coins, cards] = await Promise.all([coinStats(c.childId), cardStats(c.childId)]);
      return {
        ...c,
        balance: coins.balance,
        coins30d: coins.last30.earned - coins.last30.spent,
        cards14d: cards.daily.reduce((s, d) => s + d.count, 0),
      };
    }),
  );
}
```

Note: `collectionPacks.nameZh/nameEn` are nullable (bilingual-fallback landmine) — the `?? p.slug` fallback handles the legacy `school-custom` pack. If the pack table's column names differ (check `src/db/schema/collections.ts` line ~17), adjust to the actual `name` column trio.

- [ ] **Step 4: PASS run** — `pnpm vitest run tests/unit/economy-stats.test.ts && pnpm typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): economy-stats cards + shop exhaustion + all-children totals"`

---

### Task 3: UI — page, tab strip, dashboard components

**Files:**
- Create: `src/app/admin/economy/page.tsx`
- Create: `src/components/admin/EconomyDashboard.tsx` (includes local `StatBar` + `PanelCard` helpers — one file, presentational only)
- Modify: `src/app/admin/page.tsx` (add tab strip links: 控制台 Console · 经济 Economy)
- Test: `tests/unit/economy-dashboard.test.tsx`

**Interfaces:**
- Consumes: all Task 1–2 fetchers; `AdminChildPicker` (existing, prop shape per `src/app/admin/page.tsx`); `DAILY_CARD_CAP` from `@/lib/db/grants`.
- Produces: `EconomyDashboard` props = `{ coin: CoinStats; xp: XpStats; cards: CardStats; shop: ShopExhaustion; cap: number }`.

- [ ] **Step 1: Write the failing render test**

```tsx
// tests/unit/economy-dashboard.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/db', () => ({ db: {} }));
import { EconomyDashboard } from '@/components/admin/EconomyDashboard';

const fixture = {
  coin: {
    balance: 750,
    lifetime: { earned: 2000, spent: 1250, byReason: [{ key: 'scene_complete', total: 1200 }, { key: 'shop_purchase', total: -900 }] },
    last30: { earned: 400, spent: 100, byReason: [{ key: 'scene_complete', total: 400 }] },
    weeklyNet: Array.from({ length: 8 }, (_, i) => ({ weekStartIso: `2026-05-${11 + i}`, net: i * 10 })),
  },
  xp: { lifetime: [{ key: 'scene_complete', total: 500 }], last30: [] },
  cards: {
    daily: Array.from({ length: 14 }, (_, i) => ({ dayUtc: `2026-06-${22 + i}`, count: i % 3 })),
    bySource: [{ key: 'boss_clear', total: 12 }],
    packCompletion: [{ slug: 'zodiac-v1', nameZh: '生肖', nameEn: 'Zodiac', owned: 6, total: 12 }],
    shards: 4,
  },
  shop: { byKind: [{ kind: 'avatar', owned: 10, total: 40, remainingCost: 9000 }], totalRemainingCost: 9000, balance: 750 },
  cap: 10,
};

describe('EconomyDashboard', () => {
  it('renders the four panels with headline numbers', () => {
    render(<EconomyDashboard {...fixture} />);
    expect(screen.getByText(/金币|Coin/).closest('section')).toBeTruthy();
    expect(screen.getByText('750', { exact: false })).toBeTruthy();       // balance
    expect(screen.getByText(/scene_complete/).closest('div')).toBeTruthy();
    expect(screen.getByText(/生肖/)).toBeTruthy();                        // pack row
    expect(screen.getByText(/9000|9,000/)).toBeTruthy();                  // remaining cost
  });

  it('renders cleanly with all-zero data', () => {
    render(
      <EconomyDashboard
        coin={{ balance: 0, lifetime: { earned: 0, spent: 0, byReason: [] }, last30: { earned: 0, spent: 0, byReason: [] }, weeklyNet: [] }}
        xp={{ lifetime: [], last30: [] }}
        cards={{ daily: [], bySource: [], packCompletion: [], shards: 0 }}
        shop={{ byKind: [], totalRemainingCost: 0, balance: 0 }}
        cap={10}
      />,
    );
    expect(screen.getAllByText(/0/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: FAIL run**, then **Step 3: Implement.** `EconomyDashboard` layout (presentational; all numbers from props; bars = `style={{ width: pct + '%' }}` with `pct = max === 0 ? 0 : Math.round(100 * v / max)`):

```tsx
// Sketch of the required structure (implementer fleshes out styling to match ChildStatePanel's card look):
export function EconomyDashboard({ coin, xp, cards, shop, cap }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelCard title="金币 Coin flow">…balance, earned/spent lifetime+30d, byReason StatBars (red when total<0), weekly net bars…</PanelCard>
      <PanelCard title="XP">…lifetime + 30d StatBars…</PanelCard>
      <PanelCard title="卡片 Cards">…14 daily bars each scaled vs cap (cap line = full width), bySource list, packCompletion table with owned/total + %, shards…</PanelCard>
      <PanelCard title="商店 Shop exhaustion">…byKind rows owned/total + % bar + remainingCost, headline totalRemainingCost vs balance…</PanelCard>
    </div>
  );
}
```

Page (`src/app/admin/economy/page.tsx`): mirror `src/app/admin/page.tsx`'s child-picker pattern — `searchParams: Promise<{ child?: string }>`, `listAllChildrenForAdminAction()`, `AdminChildPicker`, plus the all-children totals table (each row a `<Link href={{ query: { child: id } }}>`); when a child is selected, `Promise.all([coinStats, xpStats, cardStats, shopExhaustion])` → `<EconomyDashboard …/>`. Add the shared tab strip to both admin pages (plain `<Link>`s, active state by pathname segment).

- [ ] **Step 4: PASS run** — `pnpm vitest run tests/unit/economy-dashboard.test.tsx && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): /admin/economy read-only dashboard page + tab strip"`

---

### Task 4: Gates, manual verify, docs, PR

- [ ] **Step 1: Full gates** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (build runs against the dev DB — safe post-C1).
- [ ] **Step 2: Manual verify vs dev data** — `pnpm dev`, sign in as the admin-role account is NOT possible locally with the e2e user (role=parent); instead verify via the real admin account David uses OR temporarily verify rendering by loading `/admin/economy` and confirming `notFound` for non-admin + rendering with `scripts/set-admin-role.ts` on a dev-DB user if needed. Minimum bar: the page compiles, the e2e preview suite stays green, and unit tests cover the shaping.
- [ ] **Step 3: Docs** — CLAUDE.md: add one sentence to the Auth/admin snapshot paragraph (economy dashboard at `/admin/economy`, read-only) — no new landmine (read-only, no traps). Roadmap: tick F1 with a pointer.
- [ ] **Step 4: PR** — push `feat/admin-economy-dashboard`, `gh pr create` (summary + test plan; note read-only/no-migration), wait for CI (incl. the D1 e2e suite) → merge on green per session pattern.

---

## Self-review notes

- Spec §3 queries → Tasks 1–2 (names match: `coinStats/xpStats/cardStats/shopExhaustion/allChildrenTotals`); §4 panels → Task 3; §5 zero-data → tests in Tasks 1–3; §6 respected. ✔
- `collectionPacks.nameZh/nameEn` nullability handled with slug fallback (flagged in Task 2 note). ✔
- No placeholders except the deliberately-sketched JSX interior in Task 3 (structure + data-binding rules fully specified; styling defers to the existing admin card idiom). ✔
