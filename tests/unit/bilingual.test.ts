import { describe, expect, it } from 'vitest';
import { bi } from '@/lib/i18n/bilingual';

describe('bi', () => {
  it('joins zh + en as "中文 / English"', () => {
    expect(bi('背包', 'Bag')).toBe('背包 / Bag');
    expect(bi('商店', 'Shop')).toBe('商店 / Shop');
  });
});
