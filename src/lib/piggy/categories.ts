// The seven spend categories. Client-safe — NO db imports.
//
// Fixed once the child has history: changing a slug orphans past entries.
// Adding one is safe (the column is plain text, not a pgEnum).

export interface PiggyCategoryDef {
  slug: string;
  emoji: string;
  zh: string;
  en: string;
}

/**
 * 礼物 is here deliberately: spending money on someone else is the one
 * spending category worth encouraging, and it has to be nameable before it
 * can be praised.
 */
export const PIGGY_CATEGORIES = [
  { slug: 'toys', emoji: '🧸', zh: '玩具', en: 'Toys' },
  { slug: 'snacks', emoji: '🍬', zh: '零食', en: 'Snacks' },
  { slug: 'books', emoji: '📚', zh: '书', en: 'Books' },
  { slug: 'gifts', emoji: '🎁', zh: '礼物', en: 'Gifts' },
  { slug: 'crafts', emoji: '🎨', zh: '手工', en: 'Crafts' },
  { slug: 'outings', emoji: '🎢', zh: '玩乐', en: 'Fun' },
  { slug: 'other', emoji: '✨', zh: '其他', en: 'Other' },
] as const satisfies readonly PiggyCategoryDef[];

export type PiggyCategory = (typeof PIGGY_CATEGORIES)[number]['slug'];

export function getPiggyCategory(slug: string): PiggyCategoryDef | null {
  return PIGGY_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

export function isPiggyCategory(value: string): value is PiggyCategory {
  return PIGGY_CATEGORIES.some((c) => c.slug === value);
}
