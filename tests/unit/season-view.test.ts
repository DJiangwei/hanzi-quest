import { describe, expect, it } from 'vitest';
import { assembleSeasonView } from '@/lib/season/view';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';
import type { SeasonRow } from '@/lib/season/types';

const season: SeasonRow = {
  id: 's1',
  nameZh: '夏季航海',
  nameEn: 'Summer Voyage',
  themeEmoji: '⛵',
  startsAt: new Date('2026-06-15'),
  endsAt: new Date('2026-08-10'),
  tierConfig: SUMMER_VOYAGE_TIERS,
  isActive: true,
};

describe('assembleSeasonView', () => {
  it('classifies each tier as locked / claimable / claimed', () => {
    const v = assembleSeasonView(season, 980, [10], Date.parse('2026-07-01'));
    expect(v.currentTier).toBe(10);
    expect(v.tiers.find((t) => t.tier === 10)!.state).toBe('claimed');
    expect(v.tiers.find((t) => t.tier === 9)!.state).toBe('claimable');
    expect(v.tiers.find((t) => t.tier === 11)!.state).toBe('locked');
  });

  it('reports XP-to-next and days remaining', () => {
    const v = assembleSeasonView(season, 980, [], Date.parse('2026-07-01'));
    expect(v.xpToNext).toBe(SUMMER_VOYAGE_TIERS[10].xpRequired - 980); // tier 11
    expect(v.daysRemaining).toBe(40); // 07-01 → 08-10 = 40 days
    expect(v.ended).toBe(false);
  });

  it('marks ended after endsAt', () => {
    const v = assembleSeasonView(season, 980, [], Date.parse('2026-08-20'));
    expect(v.ended).toBe(true);
    expect(v.daysRemaining).toBe(0);
  });
});
