import type { ComponentType } from 'react';
import type { CollectibleItem } from '@/lib/db/collections';
import { DinosaurCard } from '@/components/play/items/DinosaurCard';
import { FlagCard } from '@/components/play/items/FlagCard';
import { LandmarkCard } from '@/components/play/items/LandmarkCard';
import { SeaCreatureCard } from '@/components/play/items/SeaCreatureCard';
import { SolarBodyCard } from '@/components/play/items/SolarBodyCard';
import { ZodiacGridItem } from '@/components/play/items/ZodiacGridItem';
import { FestivalCard } from '@/components/play/items/FestivalCard';
import { SeasonCard } from '@/components/play/items/SeasonCard';
import { TransportCard } from '@/components/play/items/TransportCard';
import { MinibeastCard } from '@/components/play/items/MinibeastCard';
import { InstrumentCard } from '@/components/play/items/InstrumentCard';
import { AnimalCard } from '@/components/play/items/AnimalCard';
import { ChampionCard } from '@/components/play/items/ChampionCard';
import { CHAMPIONS_BY_SLUG } from '@/lib/collections/championsData';
import {
  TRANSPORT_BY_SLUG,
  TRANSPORT_GROUP_ORDER,
  TRANSPORT_GROUP_LABELS,
} from '@/lib/collections/transportData';
import { MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';
import {
  INSTRUMENTS_BY_SLUG,
  INSTRUMENT_GROUP_ORDER,
  INSTRUMENT_GROUP_LABELS,
} from '@/lib/collections/instrumentsData';
import { ANIMALS_BY_SLUG } from '@/lib/collections/animalsData';
import { FESTIVALS_BY_SLUG } from '@/lib/collections/festivalsData';
import { SEASON_CARDS_BY_SLUG } from '@/lib/collections/seasonCardsData';
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
    gridColumns: 3,
    ItemCard: LandmarkCard,
    resolveRevealEmoji: (slug) => LANDMARKS_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => LANDMARKS_BY_SLUG[slug]?.continent ?? null,
      order: CONTINENT_ORDER,
      labels: CONTINENT_LABELS,
    },
  },
  'festivals-v1': {
    displayNameZh: '节日',
    displayNameEn: 'Festivals',
    sloganZh: '完成每月挑战，集齐中国传统节日！',
    sloganEn: 'Complete the monthly challenge to collect Chinese festivals!',
    themeEmoji: '🎏',
    themeBannerClass:
      'bg-gradient-to-br from-rose-200 via-amber-200 to-red-300',
    themeAccentClass: 'text-rose-900',
    gridColumns: 3,
    ItemCard: FestivalCard,
    resolveRevealEmoji: (slug) => FESTIVALS_BY_SLUG[slug]?.emoji ?? null,
  },
  'season-summer-v1': {
    displayNameZh: '夏季航海',
    displayNameEn: 'Summer Voyage',
    sloganZh: '赛季限定，随航海图一起收集。',
    sloganEn: 'Season-exclusive — earned along the voyage.',
    themeEmoji: '⛵',
    themeBannerClass:
      'bg-gradient-to-br from-cyan-200 via-teal-300 to-sky-500',
    themeAccentClass: 'text-teal-900',
    gridColumns: 3,
    ItemCard: SeasonCard,
    resolveRevealEmoji: (slug) => SEASON_CARDS_BY_SLUG[slug]?.emoji ?? null,
  },
  'champions-v1': {
    displayNameZh: '海域霸主',
    displayNameEn: 'Map Champions',
    sloganZh: '击败每片海域的霸主才能获得。',
    sloganEn: 'Earned only by defeating each sea overlord.',
    themeEmoji: '👑',
    themeBannerClass: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500',
    themeAccentClass: 'text-amber-900',
    gridColumns: 3,
    ItemCard: ChampionCard,
    resolveRevealEmoji: (slug) => CHAMPIONS_BY_SLUG[slug]?.emoji ?? null,
  },
  'transport-v1': {
    displayNameZh: '交通工具',
    displayNameEn: 'Transport',
    sloganZh: '陆地、水上、天空的交通工具。',
    sloganEn: 'Things that go on land, water, and air.',
    themeEmoji: '🚒',
    themeBannerClass: 'bg-gradient-to-br from-red-200 via-orange-300 to-amber-400',
    themeAccentClass: 'text-red-900',
    gridColumns: 3,
    ItemCard: TransportCard,
    resolveRevealEmoji: (slug) => TRANSPORT_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => TRANSPORT_BY_SLUG[slug]?.group ?? null,
      order: TRANSPORT_GROUP_ORDER,
      labels: TRANSPORT_GROUP_LABELS,
    },
  },
  'minibeasts-v1': {
    displayNameZh: '昆虫',
    displayNameEn: 'Minibeasts',
    sloganZh: '花园里的小虫子朋友。',
    sloganEn: 'Little bug friends from the garden.',
    themeEmoji: '🦋',
    themeBannerClass: 'bg-gradient-to-br from-lime-200 via-green-300 to-emerald-400',
    themeAccentClass: 'text-emerald-900',
    gridColumns: 3,
    ItemCard: MinibeastCard,
    resolveRevealEmoji: (slug) => MINIBEASTS_BY_SLUG[slug]?.emoji ?? null,
  },
  'instruments-v1': {
    displayNameZh: '乐器',
    displayNameEn: 'Instruments',
    sloganZh: '西洋和民族的乐器。',
    sloganEn: 'Western and Chinese instruments.',
    themeEmoji: '🎻',
    themeBannerClass: 'bg-gradient-to-br from-violet-200 via-purple-300 to-fuchsia-400',
    themeAccentClass: 'text-purple-900',
    gridColumns: 3,
    ItemCard: InstrumentCard,
    resolveRevealEmoji: (slug) => INSTRUMENTS_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => INSTRUMENTS_BY_SLUG[slug]?.group ?? null,
      order: INSTRUMENT_GROUP_ORDER,
      labels: INSTRUMENT_GROUP_LABELS,
    },
  },
  'animals-v1': {
    displayNameZh: '动物',
    displayNameEn: 'Animals',
    sloganZh: '宠物、森林和动物园的动物。',
    sloganEn: 'Pets, woodland, and zoo animals.',
    themeEmoji: '🦊',
    themeBannerClass: 'bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-300',
    themeAccentClass: 'text-amber-900',
    gridColumns: 3,
    ItemCard: AnimalCard,
    resolveRevealEmoji: (slug) => ANIMALS_BY_SLUG[slug]?.emoji ?? null,
  },
};

export function getPackMeta(slug: string): PackUiMeta | null {
  return PACK_REGISTRY[slug] ?? null;
}

export function listKnownPackSlugs(): string[] {
  return Object.keys(PACK_REGISTRY);
}
