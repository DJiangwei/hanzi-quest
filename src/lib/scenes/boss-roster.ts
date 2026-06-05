import type { ComponentType } from 'react';
import type { BossCreatureProps } from '@/components/scenes/fx/bosses/types';
import { Kraken } from '@/components/scenes/fx/bosses/Kraken';

export interface BossRosterEntry {
  key: string;
  nameZh: string;
  nameEn: string;
  Component: ComponentType<BossCreatureProps>;
}

/** One creature per week. Index 0 = week 1. Grows to 10; wraps past the end. */
export const BOSS_ROSTER: BossRosterEntry[] = [
  { key: 'kraken', nameZh: '海怪', nameEn: 'Kraken', Component: Kraken },
];

/** Deterministic week → creature. `weekNumber` is 1-based; wraps + clamps. */
export function getBossCreature(weekNumber: number): BossRosterEntry {
  const n = BOSS_ROSTER.length;
  const i = (((weekNumber - 1) % n) + n) % n;
  return BOSS_ROSTER[i];
}
