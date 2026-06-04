/**
 * Avatar themes — purely categorization for the shop chip filter (PR #58).
 *
 * Theme is stored as TEXT in `avatar_items.theme` (no pgEnum) so future
 * themes can be added by code-only changes. Validate at the action layer
 * by checking against `AVATAR_THEMES`.
 */

export const AVATAR_THEMES = ['pirate', 'caribbean'] as const;
export type AvatarTheme = (typeof AVATAR_THEMES)[number];

export const THEME_DISPLAY_NAMES: Record<AvatarTheme, { zh: string; en: string }> = {
  pirate: { zh: '海盗', en: 'Pirate' },
  caribbean: { zh: '加勒比', en: 'Caribbean' },
};

export function isAvatarTheme(value: unknown): value is AvatarTheme {
  return typeof value === 'string' && (AVATAR_THEMES as readonly string[]).includes(value);
}
