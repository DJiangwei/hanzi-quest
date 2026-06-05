import type { ComponentType } from 'react';
import type { BossCreatureProps } from '@/components/scenes/fx/bosses/types';
import { Kraken } from '@/components/scenes/fx/bosses/Kraken';
import { Crab } from '@/components/scenes/fx/bosses/Crab';
import { Anglerfish } from '@/components/scenes/fx/bosses/Anglerfish';
import { SeaSerpent } from '@/components/scenes/fx/bosses/SeaSerpent';
import { Shark } from '@/components/scenes/fx/bosses/Shark';
import { JellySwarm } from '@/components/scenes/fx/bosses/JellySwarm';
import { ElectricEel } from '@/components/scenes/fx/bosses/ElectricEel';

export interface BossRosterEntry {
  key: string;
  nameZh: string;
  nameEn: string;
  Component: ComponentType<BossCreatureProps>;
}

/** One creature per week. Index 0 = week 1. Grows to 10; wraps past the end. */
export const BOSS_ROSTER: BossRosterEntry[] = [
  { key: 'kraken', nameZh: '海怪', nameEn: 'Kraken', Component: Kraken },
  { key: 'giant-crab', nameZh: '巨蟹', nameEn: 'Giant Crab', Component: Crab },
  { key: 'anglerfish', nameZh: '灯笼鱼', nameEn: 'Anglerfish', Component: Anglerfish },
  { key: 'sea-serpent', nameZh: '海蛇', nameEn: 'Sea Serpent', Component: SeaSerpent },
  { key: 'shark', nameZh: '鲨鱼', nameEn: 'Shark', Component: Shark },
  { key: 'jelly-swarm', nameZh: '水母群', nameEn: 'Jellyfish Swarm', Component: JellySwarm },
  { key: 'electric-eel', nameZh: '电鳗', nameEn: 'Electric Eel', Component: ElectricEel },
];

/** Deterministic week → creature. `weekNumber` is 1-based; wraps + clamps. */
export function getBossCreature(weekNumber: number): BossRosterEntry {
  const n = BOSS_ROSTER.length;
  const i = (((weekNumber - 1) % n) + n) % n;
  return BOSS_ROSTER[i];
}
