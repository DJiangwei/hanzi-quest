import { describe, expect, it } from 'vitest';
import { TRANSPORT, TRANSPORT_BY_SLUG, TRANSPORT_GROUP_ORDER } from '@/lib/collections/transportData';
import { MINIBEASTS, MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';
import { INSTRUMENTS, INSTRUMENTS_BY_SLUG, INSTRUMENT_GROUP_ORDER } from '@/lib/collections/instrumentsData';

describe('transport data', () => {
  it('has 14 items, all bilingual + emoji + valid group, unique slugs', () => {
    expect(TRANSPORT).toHaveLength(14);
    const slugs = new Set<string>();
    for (const t of TRANSPORT) {
      expect(t.nameZh).toBeTruthy();
      expect(t.nameEn).toBeTruthy();
      expect(t.emoji).toBeTruthy();
      expect(TRANSPORT_GROUP_ORDER).toContain(t.group);
      expect(slugs.has(t.slug)).toBe(false);
      slugs.add(t.slug);
    }
  });
  it('BY_SLUG resolves', () => {
    expect(TRANSPORT_BY_SLUG['fire-engine']?.nameZh).toBe('消防车');
  });
});

describe('minibeasts data', () => {
  it('has 12 bilingual items with emoji + unique slugs', () => {
    expect(MINIBEASTS).toHaveLength(12);
    const slugs = new Set<string>();
    for (const m of MINIBEASTS) {
      expect(m.nameZh && m.nameEn && m.emoji).toBeTruthy();
      expect(slugs.has(m.slug)).toBe(false);
      slugs.add(m.slug);
    }
    expect(MINIBEASTS_BY_SLUG['ladybird']?.nameZh).toBe('瓢虫');
  });
});

describe('instruments data', () => {
  it('has 13 bilingual items with valid group + unique slugs', () => {
    expect(INSTRUMENTS).toHaveLength(13);
    const slugs = new Set<string>();
    for (const i of INSTRUMENTS) {
      expect(i.nameZh && i.nameEn && i.emoji).toBeTruthy();
      expect(INSTRUMENT_GROUP_ORDER).toContain(i.group);
      expect(slugs.has(i.slug)).toBe(false);
      slugs.add(i.slug);
    }
    expect(INSTRUMENTS_BY_SLUG['erhu']?.group).toBe('chinese');
  });
});
