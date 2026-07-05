// Read-only aggregation queries for the /admin/economy dashboard (F1).
// Thin fetchers + PURE exported shapers (unit tests hit the shapers with
// plain fixtures). SELECTs only — this module must never write.
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  cardGrantsLog,
  childCardGrantsDaily,
  childCollections,
  childProfiles,
  childShards,
  coinBalances,
  coinTransactions,
  collectibleItems,
  collectionPacks,
  shopItems,
  shopPurchases,
  xpEvents,
} from '@/db/schema';

export interface ReasonTotal {
  key: string;
  total: number;
}

export interface CoinStats {
  balance: number;
  lifetime: { earned: number; spent: number; byReason: ReasonTotal[] };
  last30: { earned: number; spent: number; byReason: ReasonTotal[] };
  /** 8 ISO weeks (Monday start, UTC), oldest first, zero weeks included. */
  weeklyNet: { weekStartIso: string; net: number }[];
}

export interface XpStats {
  lifetime: ReasonTotal[];
  last30: ReasonTotal[];
}

export interface CardStats {
  /** Last 14 UTC days incl. zero days, oldest first. */
  daily: { dayUtc: string; count: number }[];
  bySource: ReasonTotal[];
  packCompletion: { slug: string; name: string; owned: number; total: number }[];
  shards: number;
}

export interface ShopExhaustion {
  byKind: { kind: string; owned: number; total: number; remainingCost: number }[];
  totalRemainingCost: number;
  balance: number;
}

export interface ChildTotals {
  childId: string;
  displayName: string;
  balance: number;
  coins30d: number;
  cards14d: number;
}

const DAY_MS = 86_400_000;

function byReasonTotals(rows: { key: string; amount: number }[]): ReasonTotal[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.amount);
  return [...m.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function sums(rows: { delta: number }[]): { earned: number; spent: number } {
  let earned = 0;
  let spent = 0;
  for (const r of rows) {
    if (r.delta >= 0) earned += r.delta;
    else spent += -r.delta;
  }
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
    lifetime: {
      ...sums(rows),
      byReason: byReasonTotals(rows.map((r) => ({ key: r.reason, amount: r.delta }))),
    },
    last30: {
      ...sums(recent),
      byReason: byReasonTotals(recent.map((r) => ({ key: r.reason, amount: r.delta }))),
    },
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
    if (ownedIds.has(it.id)) {
      k.owned += 1;
    } else {
      k.remainingCost += it.priceCoins;
      totalRemainingCost += it.priceCoins;
    }
    kinds.set(it.kind, k);
  }
  return {
    byKind: [...kinds.entries()].map(([kind, v]) => ({ kind, ...v })),
    totalRemainingCost,
    balance,
  };
}

export async function coinStats(childId: string): Promise<CoinStats> {
  const [rows, bal] = await Promise.all([
    db
      .select({
        delta: coinTransactions.delta,
        reason: coinTransactions.reason,
        createdAt: coinTransactions.createdAt,
      })
      .from(coinTransactions)
      .where(eq(coinTransactions.childId, childId)),
    db
      .select({ balance: coinBalances.balance })
      .from(coinBalances)
      .where(eq(coinBalances.childId, childId)),
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

export async function cardStats(childId: string): Promise<CardStats> {
  const [daily, log, packs, ownedByPack, shards] = await Promise.all([
    db
      .select({ dayUtc: childCardGrantsDaily.dayUtc, count: childCardGrantsDaily.count })
      .from(childCardGrantsDaily)
      .where(eq(childCardGrantsDaily.childId, childId)),
    db
      .select({ source: cardGrantsLog.source })
      .from(cardGrantsLog)
      .where(eq(cardGrantsLog.childId, childId)),
    db
      .select({ id: collectionPacks.id, slug: collectionPacks.slug, name: collectionPacks.name })
      .from(collectionPacks)
      .where(eq(collectionPacks.isActive, true)),
    db
      .select({
        packId: collectibleItems.packId,
        itemId: collectibleItems.id,
        childId: childCollections.childId,
      })
      .from(collectibleItems)
      .leftJoin(
        childCollections,
        and(
          eq(childCollections.itemId, collectibleItems.id),
          eq(childCollections.childId, childId),
        ),
      ),
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
      slug: p.slug,
      name: p.name ?? p.slug,
      ...(perPack.get(p.id) ?? { owned: 0, total: 0 }),
    })),
    shards: shards[0]?.shards ?? 0,
  };
}

export async function shopExhaustion(childId: string): Promise<ShopExhaustion> {
  const [items, purchases, bal] = await Promise.all([
    db
      .select({ id: shopItems.id, kind: shopItems.kind, priceCoins: shopItems.priceCoins })
      .from(shopItems)
      .where(eq(shopItems.isActive, true)),
    db
      .select({ shopItemId: shopPurchases.shopItemId })
      .from(shopPurchases)
      .where(eq(shopPurchases.childId, childId)),
    db
      .select({ balance: coinBalances.balance })
      .from(coinBalances)
      .where(eq(coinBalances.childId, childId)),
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
