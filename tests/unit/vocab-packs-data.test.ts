import { describe, expect, it } from 'vitest';
import { TRANSPORT, TRANSPORT_BY_SLUG, TRANSPORT_GROUP_ORDER } from '@/lib/collections/transportData';

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
