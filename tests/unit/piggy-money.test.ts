// Pure money + category modules. No db, no mocks — if this file ever needs
// vi.mock('@/db'), something has leaked a server import into a client module.
import { describe, expect, it } from 'vitest';
import { formatPence, parsePoundsToPence } from '@/lib/piggy/money';
import {
  PIGGY_CATEGORIES,
  getPiggyCategory,
  isPiggyCategory,
} from '@/lib/piggy/categories';

describe('formatPence', () => {
  it('renders whole pounds, pence, and the zero case', () => {
    expect(formatPence(100)).toBe('£1.00');
    expect(formatPence(1400)).toBe('£14.00');
    expect(formatPence(0)).toBe('£0.00');
  });

  it('pads single-digit pence — £0.05 must never render as £0.5', () => {
    expect(formatPence(5)).toBe('£0.05');
    expect(formatPence(150)).toBe('£1.50');
    expect(formatPence(1205)).toBe('£12.05');
  });

  it('renders negatives with the sign outside the symbol', () => {
    expect(formatPence(-250)).toBe('-£2.50');
  });
});

describe('parsePoundsToPence', () => {
  it('accepts the shapes a parent actually types', () => {
    expect(parsePoundsToPence('1.50')).toBe(150);
    expect(parsePoundsToPence('1.5')).toBe(150);
    expect(parsePoundsToPence('2')).toBe(200);
    expect(parsePoundsToPence('0.05')).toBe(5);
    expect(parsePoundsToPence(' £3.25 ')).toBe(325);
  });

  it('rounds rather than truncating — 1.15 * 100 is 114.999… in binary', () => {
    expect(parsePoundsToPence('1.15')).toBe(115);
    expect(parsePoundsToPence('8.29')).toBe(829);
  });

  it('rejects anything that is not a plain non-negative amount', () => {
    expect(parsePoundsToPence('')).toBeNull();
    expect(parsePoundsToPence('.')).toBeNull();
    expect(parsePoundsToPence('abc')).toBeNull();
    expect(parsePoundsToPence('1.234')).toBeNull();
    expect(parsePoundsToPence('-5')).toBeNull();
    expect(parsePoundsToPence('1e3')).toBeNull();
  });
});

describe('piggy categories', () => {
  it('has the seven agreed categories, each bilingual with an emoji', () => {
    expect(PIGGY_CATEGORIES).toHaveLength(7);
    for (const c of PIGGY_CATEGORIES) {
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.zh.length).toBeGreaterThan(0);
      expect(c.en.length).toBeGreaterThan(0);
    }
    expect(PIGGY_CATEGORIES.map((c) => c.slug)).toEqual([
      'toys', 'snacks', 'books', 'gifts', 'crafts', 'outings', 'other',
    ]);
  });

  it('includes gifts — spending on someone else is the one kind worth praising', () => {
    expect(getPiggyCategory('gifts')?.zh).toBe('礼物');
  });

  it('narrows unknown slugs', () => {
    expect(isPiggyCategory('toys')).toBe(true);
    expect(isPiggyCategory('crypto')).toBe(false);
    expect(getPiggyCategory('crypto')).toBeNull();
  });
});
