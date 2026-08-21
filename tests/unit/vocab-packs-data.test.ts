import { describe, expect, it } from 'vitest';
import { TRANSPORT, TRANSPORT_BY_SLUG, TRANSPORT_GROUP_ORDER } from '@/lib/collections/transportData';
import { MINIBEASTS, MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';
import { INSTRUMENTS, INSTRUMENTS_BY_SLUG, INSTRUMENT_GROUP_ORDER } from '@/lib/collections/instrumentsData';
import { ANIMALS, ANIMALS_BY_SLUG } from '@/lib/collections/animalsData';
import {
  OLYMPIC_SPORTS,
  OLYMPICS_BY_SLUG,
  OLYMPIC_GROUP_ORDER,
  OLYMPIC_GROUP_LABELS,
} from '@/lib/collections/olympicsData';

const ZODIAC_ZH = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

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

describe('animals data', () => {
  it('has 17 bilingual items, unique slugs, and excludes all 12 zodiac animals', () => {
    expect(ANIMALS).toHaveLength(17);
    const slugs = new Set<string>();
    for (const a of ANIMALS) {
      expect(a.nameZh && a.nameEn && a.emoji).toBeTruthy();
      expect(ZODIAC_ZH).not.toContain(a.nameZh);
      expect(slugs.has(a.slug)).toBe(false);
      slugs.add(a.slug);
    }
    expect(ANIMALS_BY_SLUG['fox']?.nameZh).toBe('狐狸');
  });
});

describe('olympics data', () => {
  it('has 20 bilingual items with emoji + valid group + unique slugs', () => {
    expect(OLYMPIC_SPORTS).toHaveLength(20);
    const slugs = new Set<string>();
    for (const s of OLYMPIC_SPORTS) {
      expect(s.nameZh, s.slug).toBeTruthy();
      expect(s.nameEn, s.slug).toBeTruthy();
      expect(s.emoji, s.slug).toBeTruthy();
      expect(s.loreZh, s.slug).toBeTruthy();
      expect(s.loreEn, s.slug).toBeTruthy();
      expect(OLYMPIC_GROUP_ORDER, s.slug).toContain(s.group);
      expect(slugs.has(s.slug), s.slug).toBe(false);
      slugs.add(s.slug);
    }
  });

  it('every group in the order has a bilingual label, and every group is used', () => {
    const used = new Set(OLYMPIC_SPORTS.map((s) => s.group));
    for (const g of OLYMPIC_GROUP_ORDER) {
      expect(OLYMPIC_GROUP_LABELS[g]?.zh, g).toBeTruthy();
      expect(OLYMPIC_GROUP_LABELS[g]?.en, g).toBeTruthy();
      expect(OLYMPIC_GROUP_LABELS[g]?.emoji, g).toBeTruthy();
      expect(used.has(g), `group '${g}' has no sports`).toBe(true);
    }
  });

  it('BY_SLUG resolves', () => {
    expect(OLYMPICS_BY_SLUG['table-tennis']?.nameZh).toBe('乒乓球');
    expect(OLYMPICS_BY_SLUG['climbing']?.group).toBe('skill');
  });
});
