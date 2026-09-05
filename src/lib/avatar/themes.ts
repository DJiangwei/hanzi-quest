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
  'continent',
  'season',
  'champion',
] as const;
export type AvatarTheme = (typeof AVATAR_THEMES)[number];

export const THEME_DISPLAY_NAMES: Record<AvatarTheme, { zh: string; en: string }> = {
  pirate: { zh: '海盗', en: 'Pirate' },
  caribbean: { zh: '加勒比', en: 'Caribbean' },
  space: { zh: '太空', en: 'Space' },
  unicorn: { zh: '独角兽彩虹', en: 'Unicorn' },
  festival: { zh: '节日', en: 'Festival' },
  continent: { zh: '大洲', en: 'Continent' },
  // Season-NEUTRAL on purpose. The avatar theme is the generic `'season'`, so
  // naming it after one season means every future season's cosmetics arrive in
  // the 奖励衣橱 labelled with the previous season's name. Adding a per-season
  // theme instead would mean an AVATAR_THEMES + REWARD_THEMES edit (and keeping
  // it out of SHOP_FILTER_THEMES) every single season, forever.
  season: { zh: '赛季奖励', en: 'Season Rewards' },
  champion: { zh: '霸主', en: 'Champion' },
};

/** Reward-only themes — earned, never sold; excluded from the shop chip filter. */
const REWARD_THEMES: readonly AvatarTheme[] = ['festival', 'continent', 'season', 'champion'];

/**
 * Themes shown as shop filter chips. Reward-only themes (festival, continent)
 * are excluded — those items are earned (monthly challenge / continent
 * completion), never sold; they surface via the rewards wardrobe instead.
 */
export const SHOP_FILTER_THEMES: readonly AvatarTheme[] = AVATAR_THEMES.filter(
  (t) => !REWARD_THEMES.includes(t),
);

export function isAvatarTheme(value: unknown): value is AvatarTheme {
  return typeof value === 'string' && (AVATAR_THEMES as readonly string[]).includes(value);
}
