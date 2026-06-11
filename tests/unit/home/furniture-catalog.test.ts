import { describe, expect, it } from 'vitest';
import {
  FURNITURE_CATALOG,
  FURNITURE_BY_SLUG,
  getFurniture,
  type FurnitureCategory,
  type Surface,
} from '@/lib/home/furniture-catalog';

const VALID_CATEGORIES: FurnitureCategory[] = [
  'wall_art',
  'window_light',
  'furniture',
  'rug',
  'plant_toy',
];
const VALID_SURFACES: Surface[] = ['wall', 'floor'];
const VALID_RARITIES = ['common', 'rare', 'epic'];

describe('FURNITURE_CATALOG invariants', () => {
  it('has at least 18 items', () => {
    expect(FURNITURE_CATALOG.length).toBeGreaterThanOrEqual(18);
  });

  it('slugs are unique', () => {
    const slugs = FURNITURE_CATALOG.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(FURNITURE_CATALOG)('$slug has all required string fields', (def) => {
    expect(typeof def.slug).toBe('string');
    expect(def.slug.length).toBeGreaterThan(0);
    expect(typeof def.nameZh).toBe('string');
    expect(def.nameZh.length).toBeGreaterThan(0);
    expect(typeof def.nameEn).toBe('string');
    expect(def.nameEn.length).toBeGreaterThan(0);
  });

  it.each(FURNITURE_CATALOG)('$slug has valid category', (def) => {
    expect(VALID_CATEGORIES).toContain(def.category);
  });

  it.each(FURNITURE_CATALOG)('$slug has valid surface', (def) => {
    expect(VALID_SURFACES).toContain(def.surface);
  });

  it.each(FURNITURE_CATALOG)('$slug has valid rarity', (def) => {
    expect(VALID_RARITIES).toContain(def.rarity);
  });

  it.each(FURNITURE_CATALOG)('$slug has positive priceCoins', (def) => {
    expect(def.priceCoins).toBeGreaterThan(0);
  });

  it.each(FURNITURE_CATALOG)('$slug has valid footprint (w,h ≥ 1)', (def) => {
    expect(def.footprint.w).toBeGreaterThanOrEqual(1);
    expect(def.footprint.h).toBeGreaterThanOrEqual(1);
  });

  it.each(FURNITURE_CATALOG)('$slug has a Component function', (def) => {
    expect(typeof def.Component).toBe('function');
  });

  it.each(FURNITURE_CATALOG)('$slug Component returns a truthy ReactElement', (def) => {
    const element = def.Component();
    expect(element).toBeTruthy();
    // Should be a React element (has type and props)
    expect(element).toHaveProperty('type');
    expect(element).toHaveProperty('props');
  });
});

describe('all 5 categories are covered', () => {
  it.each(VALID_CATEGORIES)('has at least one item with category=%s', (cat) => {
    expect(FURNITURE_CATALOG.some((f) => f.category === cat)).toBe(true);
  });
});

describe('both surfaces are used', () => {
  it('has wall items', () => {
    expect(FURNITURE_CATALOG.some((f) => f.surface === 'wall')).toBe(true);
  });

  it('has floor items', () => {
    expect(FURNITURE_CATALOG.some((f) => f.surface === 'floor')).toBe(true);
  });
});

describe('FURNITURE_BY_SLUG', () => {
  it('is a Map with the same count as FURNITURE_CATALOG', () => {
    expect(FURNITURE_BY_SLUG.size).toBe(FURNITURE_CATALOG.length);
  });

  it('every slug resolves to the correct def', () => {
    for (const def of FURNITURE_CATALOG) {
      expect(FURNITURE_BY_SLUG.get(def.slug)).toBe(def);
    }
  });
});

describe('getFurniture', () => {
  it('returns a def for a known slug', () => {
    const slug = FURNITURE_CATALOG[0]!.slug;
    const result = getFurniture(slug);
    expect(result).toBeDefined();
    expect(result!.slug).toBe(slug);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getFurniture('nonexistent-slug')).toBeUndefined();
  });
});

describe('plan slugs are present', () => {
  // Every slug from the plan's table should exist
  const planSlugs = [
    'poster-stars',
    'framed-fish',
    'clock-round',
    'window-sunny',
    'lamp-string',
    'bed-cozy',
    'sofa-teal',
    'chair-wood',
    'table-round',
    'bookshelf',
    'toy-chest',
    'desk-study',
    'rug-round',
    'rug-stripe',
    'plant-fern',
    'plant-cactus',
    'teddy-bear',
    'ball-beach',
    'rocket-lamp',
    'floor-lamp',
  ];

  it.each(planSlugs)('slug %s is in catalog', (slug) => {
    expect(FURNITURE_BY_SLUG.has(slug)).toBe(true);
  });
});

describe('outdoor (yard) furniture', () => {
  const yardSlugs = [
    'yard-swing',
    'yard-sandbox',
    'yard-picnic-table',
    'yard-tree',
    'yard-flower-bed',
  ];

  it.each(yardSlugs)('%s exists and sits on the floor (ground) zone', (slug) => {
    const def = getFurniture(slug);
    expect(def).toBeDefined();
    // surface='floor' → validCells restricts it to the ground zone, keeping the sky clear
    expect(def!.surface).toBe('floor');
  });
});
