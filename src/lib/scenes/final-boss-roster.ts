import type { ComponentType } from 'react';
import type { BossCreatureProps } from '@/components/scenes/fx/bosses/types';
import { FlameTitan } from '@/components/scenes/fx/bosses/FlameTitan';
import { GhostGalleon } from '@/components/scenes/fx/bosses/GhostGalleon';

/**
 * Per-map final-boss overlord registry. CLIENT-ONLY — it holds React
 * components, so NEVER pass an entry across an RSC boundary (same hazard as
 * `boss-roster.ts` / `packRegistry.ts`). The final-boss scene resolves it
 * itself from the pack slug.
 */
export interface FinalBossEntry {
  key: string;
  nameZh: string;
  nameEn: string;
  Component: ComponentType<BossCreatureProps>;
}

/** Map pack slug → its overlord. Add an entry per map (印度洋 gets its own).
 *  Keep `final-boss-maps.ts` in step — a test pins the two in agreement. */
const FINAL_BOSS_ROSTER: Record<string, FinalBossEntry> = {
  'pirate-class-level-1': {
    key: 'ghost-galleon',
    nameZh: '幽灵旗舰',
    nameEn: 'Ghost Galleon',
    Component: GhostGalleon,
  },
  'pirate-class-level-2': {
    key: 'flame-titan',
    nameZh: '火焰山巨兽',
    nameEn: 'The Flame Titan',
    Component: FlameTitan,
  },
};

export function getFinalBoss(packSlug: string): FinalBossEntry | null {
  return FINAL_BOSS_ROSTER[packSlug] ?? null;
}
