import { describe, expect, it, vi } from 'vitest';

// Mock @/db to avoid requiring DATABASE_URL at test-import time.
// Only weightedRandomPick (pure) is exercised here; no db calls are made.
vi.mock('@/db', () => ({
  db: { transaction: vi.fn() },
}));

import { weightedRandomPick, type WeightedItem } from '@/lib/db/grants';

describe('weightedRandomPick', () => {
  const items: WeightedItem[] = [
    { id: 'a', packId: 'p1', dropWeight: 1 },
    { id: 'b', packId: 'p1', dropWeight: 1 },
    { id: 'c', packId: 'p2', dropWeight: 1 },
  ];

  it('picks an item from the catalog', () => {
    const ownedSet = new Set<string>();
    const picked = weightedRandomPick(items, ownedSet, () => 0.1);
    expect(['a', 'b', 'c']).toContain(picked.id);
  });

  it('biases toward packs with more unowned items', () => {
    // p1 has 2 unowned, p2 has 1 unowned → p1 items get weight=3 each (1*(1+2)), p2 gets weight=2 (1*(1+1))
    // Total weight: 3 + 3 + 2 = 8. p1 items take 0..6/8 of the roll space; p2 takes 6..8/8.
    const ownedSet = new Set<string>();
    const pickedAtZero = weightedRandomPick(items, ownedSet, () => 0);
    expect(pickedAtZero.packId).toBe('p1');
    const pickedAtNearEnd = weightedRandomPick(items, ownedSet, () => 0.95);
    expect(pickedAtNearEnd.packId).toBe('p2');
  });

  it('still picks an owned item when all items are owned (degenerate case)', () => {
    const ownedSet = new Set(['a', 'b', 'c']);
    const picked = weightedRandomPick(items, ownedSet, () => 0.5);
    expect(['a', 'b', 'c']).toContain(picked.id);
  });
});
