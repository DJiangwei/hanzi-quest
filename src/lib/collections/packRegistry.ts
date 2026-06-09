import type { ComponentType } from 'react';
import type { CollectibleItem } from '@/lib/db/collections';
import { DinosaurCard } from '@/components/play/items/DinosaurCard';
import { FlagCard } from '@/components/play/items/FlagCard';
import { LandmarkCard } from '@/components/play/items/LandmarkCard';
import { SeaCreatureCard } from '@/components/play/items/SeaCreatureCard';
import { SolarBodyCard } from '@/components/play/items/SolarBodyCard';
import { ZodiacGridItem } from '@/components/play/items/ZodiacGridItem';
import { DINOSAURS_BY_SLUG } from '@/lib/collections/dinosaursData';
import {
  FLAGS_BY_SLUG,
  CONTINENT_LABELS,
  CONTINENT_ORDER,
} from '@/lib/collections/flagsData';
import { LANDMARKS_BY_SLUG } from '@/lib/collections/landmarksData';
import { SEA_CREATURES_BY_SLUG } from '@/lib/collections/seaCreaturesData';
import {
  SOLAR_BODIES_BY_SLUG,
  SOLAR_TYPE_ORDER,
  TYPE_LABELS,
  TYPE_EMOJI,
} from '@/lib/collections/solarSystemData';

export interface ItemCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

export interface PackGrouping {
  /** item slug → group key (null = ungrouped; rendered in a trailing bucket). */
  resolveGroup: (slug: string) => string | null;
  /** Fixed section order, top → bottom. */
  order: string[];
  /** Bilingual + emoji header label per group key. */
  labels: Record<string, { zh: string; en: string; emoji: string }>;
}

export interface PackUiMeta {
  /** Bilingual display names — both rendered side-by-side. */
  displayNameZh: string;
  displayNameEn: string;
  /** Short kid-friendly slogan, both languages. */
  sloganZh: string;
  sloganEn: string;
  /** Emoji used as a thumbnail when no theme art exists. */
  themeEmoji: string;
  /** Tailwind classes for the hall card banner background + accent. */
  themeBannerClass: string;
  themeAccentClass: string;
  /** 300 for cheap packs, 500 for the prestige zodiac. */
  paidPullCost: number;
  /** Grid columns on the per-pack page (mobile default). */
  gridColumns: number;
  /** Per-item renderer. */
  ItemCard: ComponentType<ItemCardProps>;
  /**
   * Optional emoji resolver for the chest-reveal centerpiece. Packs that
   * don't render via ZodiacIcon (everything except zodiac) provide one of
   * these so the reveal animation has a visual to show.
   */
  resolveRevealEmoji?: (slug: string) => string | null;
  /** When present, the pack page renders section headers per group. */
  grouping?: PackGrouping;
}

export const PACK_REGISTRY: Record<string, PackUiMeta> = {
  'zodiac-v1': {
    displayNameZh: '十二生肖',
    displayNameEn: 'Twelve Zodiac',
    sloganZh: '十二只动物，每一只都有故事。',
    sloganEn: 'Twelve animals, each with a story.',
    themeEmoji: '🐲',
    themeBannerClass:
      'bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500',
    themeAccentClass: 'text-amber-900',
    paidPullCost: 500,
    gridColumns: 3,
    ItemCard: ZodiacGridItem,
  },
  'flags-v1': {
    displayNameZh: '世界国旗',
    displayNameEn: 'World Flags',
    sloganZh: '收集世界各地的国旗和首都。',
    sloganEn: 'Collect flags and capitals from around the world.',
    themeEmoji: '🏳️',
    themeBannerClass:
      'bg-gradient-to-br from-sky-200 via-sky-300 to-indigo-500',
    themeAccentClass: 'text-sky-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: FlagCard,
    resolveRevealEmoji: (slug) => FLAGS_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => FLAGS_BY_SLUG[slug]?.continent ?? null,
      order: CONTINENT_ORDER,
      labels: CONTINENT_LABELS,
    },
  },
  'sea-creatures-v1': {
    displayNameZh: '海洋生物',
    displayNameEn: 'Sea Creatures',
    sloganZh: '航海路上遇到的所有伙伴。',
    sloganEn: 'Every friend you meet on the high seas.',
    themeEmoji: '🐠',
    themeBannerClass:
      'bg-gradient-to-br from-cyan-200 via-teal-300 to-sky-500',
    themeAccentClass: 'text-teal-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: SeaCreatureCard,
    resolveRevealEmoji: (slug) => SEA_CREATURES_BY_SLUG[slug]?.emoji ?? null,
  },
  'dinosaurs-v1': {
    displayNameZh: '恐龙世界',
    displayNameEn: 'Dinosaurs',
    sloganZh: '亿万年前的远古巨兽。',
    sloganEn: 'Giant beasts from millions of years ago.',
    themeEmoji: '🦖',
    themeBannerClass:
      'bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400',
    themeAccentClass: 'text-amber-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: DinosaurCard,
    resolveRevealEmoji: (slug) => DINOSAURS_BY_SLUG[slug]?.emoji ?? null,
  },
  'solar-system-v1': {
    displayNameZh: '太阳系',
    displayNameEn: 'Solar System',
    sloganZh: '太阳和它身边的行星家族。',
    sloganEn: 'The Sun and its family of worlds.',
    themeEmoji: '🪐',
    themeBannerClass:
      'bg-gradient-to-br from-indigo-300 via-purple-400 to-fuchsia-500',
    themeAccentClass: 'text-indigo-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: SolarBodyCard,
    resolveRevealEmoji: (slug) => SOLAR_BODIES_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => SOLAR_BODIES_BY_SLUG[slug]?.type ?? null,
      order: SOLAR_TYPE_ORDER,
      labels: Object.fromEntries(
        SOLAR_TYPE_ORDER.map((t) => [
          t,
          { zh: TYPE_LABELS[t].zh, en: TYPE_LABELS[t].en, emoji: TYPE_EMOJI[t] },
        ]),
      ),
    },
  },
  'landmarks-v1': {
    displayNameZh: '世界地标',
    displayNameEn: 'World Landmarks',
    sloganZh: '世界各地的著名地标。',
    sloganEn: 'Famous landmarks from around the world.',
    themeEmoji: '🗽',
    themeBannerClass:
      'bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400',
    themeAccentClass: 'text-amber-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: LandmarkCard,
    resolveRevealEmoji: (slug) => LANDMARKS_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => LANDMARKS_BY_SLUG[slug]?.continent ?? null,
      order: CONTINENT_ORDER,
      labels: CONTINENT_LABELS,
    },
  },
};

export function getPackMeta(slug: string): PackUiMeta | null {
  return PACK_REGISTRY[slug] ?? null;
}

export function listKnownPackSlugs(): string[] {
  return Object.keys(PACK_REGISTRY);
}
