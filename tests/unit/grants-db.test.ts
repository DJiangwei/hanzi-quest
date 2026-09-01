import { describe, expect, it, vi } from 'vitest';

// Mock @/db to avoid requiring DATABASE_URL at test-import time.
// Only weightedRandomPick (pure) is exercised here; no db calls are made.
vi.mock('@/db', () => ({
  db: { transaction: vi.fn() },
}));

import {
  packPickWeights,
  weightedRandomPick,
  type WeightedItem,
} from '@/lib/db/grants';

/** Deterministic LCG so distribution assertions are exact, not flaky. */
function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

describe('packPickWeights', () => {
  const mk = (packId: string, n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${packId}-${i + from}`,
      packId,
      dropWeight: 1,
    }));

  it('does NOT scale with pack size — a 193-card pack weighs the same as a 12-card one when both are untouched', () => {
    // THE regression. Before this fix each item's weight was multiplied by its
    // pack's unowned COUNT, so a pack of N contributed ~N² and flags-v1 (193
    // cards) took 93.7% of every chest pull in production.
    const items = [...mk('flags', 193), ...mk('zodiac', 12)];
    const w = packPickWeights(items, new Set());
    expect(w.get('flags')).toBeCloseTo(w.get('zodiac')!, 10);
  });

  it('weighs by completion FRACTION, so a less-complete pack is favoured', () => {
    const items = [...mk('fresh', 10), ...mk('half', 10)];
    const owned = new Set(mk('half', 5).map((i) => i.id)); // half is 50% done
    const w = packPickWeights(items, owned);
    expect(w.get('fresh')).toBeCloseTo(2.0, 10); // 1 + 10/10
    expect(w.get('half')).toBeCloseTo(1.5, 10); // 1 + 5/10
  });

  it('keeps the bias gentle — at most 2x between untouched and nearly-done', () => {
    const items = [...mk('fresh', 12), ...mk('nearly', 12)];
    const owned = new Set(mk('nearly', 11).map((i) => i.id));
    const w = packPickWeights(items, owned);
    // A nearly-finished pack must stay reachable: hunting the last card of a
    // set should not become hopeless.
    expect(w.get('fresh')! / w.get('nearly')!).toBeLessThanOrEqual(2);
  });

  it('drops a fully-collected pack while any other pack still has unowned cards', () => {
    const items = [...mk('done', 5), ...mk('todo', 5)];
    const owned = new Set(mk('done', 5).map((i) => i.id));
    const w = packPickWeights(items, owned);
    expect(w.get('done')).toBe(0);
    expect(w.get('todo')).toBeGreaterThan(0);
  });

  it('falls back to every pack when the child has collected literally everything', () => {
    const items = [...mk('a', 3), ...mk('b', 3)];
    const owned = new Set(items.map((i) => i.id));
    const w = packPickWeights(items, owned);
    // Otherwise there is nothing to pick and the pull throws — a duplicate
    // (which converts to a shard) is the correct outcome here.
    expect(w.get('a')).toBeGreaterThan(0);
    expect(w.get('b')).toBeGreaterThan(0);
  });
});

describe('weightedRandomPick', () => {
  const items: WeightedItem[] = [
    { id: 'a', packId: 'p1', dropWeight: 1 },
    { id: 'b', packId: 'p1', dropWeight: 1 },
    { id: 'c', packId: 'p2', dropWeight: 1 },
  ];

  it('picks an item from the catalog', () => {
    const picked = weightedRandomPick(items, new Set(), lcg(1));
    expect(['a', 'b', 'c']).toContain(picked.id);
  });

  it('gives a 193-card pack no more than ~2x a 12-card pack over many pulls', () => {
    // End-to-end proof of the composition, at production pack sizes.
    const big = Array.from({ length: 193 }, (_, i) => ({
      id: `f${i}`, packId: 'flags', dropWeight: 1,
    }));
    const small = Array.from({ length: 12 }, (_, i) => ({
      id: `z${i}`, packId: 'zodiac', dropWeight: 1,
    }));
    const rng = lcg(42);
    const counts: Record<string, number> = { flags: 0, zodiac: 0 };
    for (let i = 0; i < 4000; i++) {
      counts[weightedRandomPick([...big, ...small], new Set(), rng).packId] += 1;
    }
    const ratio = counts.flags / counts.zodiac;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });

  it('still picks an item when all items are owned (all-complete scenario)', () => {
    const picked = weightedRandomPick(items, new Set(['a', 'b', 'c']), lcg(7));
    expect(['a', 'b', 'c']).toContain(picked.id);
  });

  it('throws when catalog has no items with positive dropWeight (all retired)', () => {
    const allZero: WeightedItem[] = [
      { id: 'a', packId: 'p1', dropWeight: 0 },
      { id: 'b', packId: 'p1', dropWeight: 0 },
    ];
    expect(() => weightedRandomPick(allZero, new Set(), () => 0.5)).toThrow(
      /no items with positive dropWeight/i,
    );
  });
});
