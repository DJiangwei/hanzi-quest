import type { ComponentType } from 'react';
import type { CollectibleItem } from '@/lib/db/collections';
import { DinosaurCard } from '@/components/play/items/DinosaurCard';
import { FlagCard } from '@/components/play/items/FlagCard';
import { SeaCreatureCard } from '@/components/play/items/SeaCreatureCard';
import { ZodiacGridItem } from '@/components/play/items/ZodiacGridItem';
import { DINOSAURS_BY_SLUG } from '@/lib/collections/dinosaursData';
import { FLAGS_BY_SLUG } from '@/lib/collections/flagsData';
import { SEA_CREATURES_BY_SLUG } from '@/lib/collections/seaCreaturesData';

export interface ItemCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
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
};

export function getPackMeta(slug: string): PackUiMeta | null {
  return PACK_REGISTRY[slug] ?? null;
}

export function listKnownPackSlugs(): string[] {
  return Object.keys(PACK_REGISTRY);
}
