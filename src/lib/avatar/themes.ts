/**
 * Avatar themes — purely categorization for the shop chip filter (PR #58).
 *
 * Theme is stored as TEXT in `avatar_items.theme` (no pgEnum) so future
 * themes can be added by code-only changes. Validate at the action layer
 * by checking against `AVATAR_THEMES`.
 */

export const AVATAR_THEMES = [
  'pirate',
  'caribbean',
  'space',
  'unicorn',
  'festival',
] as const;
export type AvatarTheme = (typeof AVATAR_THEMES)[number];

export const THEME_DISPLAY_NAMES: Record<AvatarTheme, { zh: string; en: string }> = {
  pirate: { zh: '海盗', en: 'Pirate' },
  caribbean: { zh: '加勒比', en: 'Caribbean' },
  space: { zh: '太空', en: 'Space' },
  unicorn: { zh: '独角兽彩虹', en: 'Unicorn' },
  festival: { zh: '节日', en: 'Festival' },
};

/**
 * Themes shown as shop filter chips. `festival` is excluded — festival items
 * are reward-only (earned via the monthly challenge, never sold), so they never
 * appear in the shop grid; they surface via the festival wardrobe instead.
 */
export const SHOP_FILTER_THEMES: readonly AvatarTheme[] = AVATAR_THEMES.filter(
  (t) => t !== 'festival',
);

export function isAvatarTheme(value: unknown): value is AvatarTheme {
  return typeof value === 'string' && (AVATAR_THEMES as readonly string[]).includes(value);
}
