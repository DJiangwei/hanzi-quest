import { defaultTheme } from './default';
import { musicBoxTheme } from './music-box';
import { retroArcadeTheme } from './retro-arcade';
import { nauticalTheme } from './nautical';
import { fanfarePlusTheme } from './fanfare-plus';

export interface ThemeHandlers {
  ding: (ctx: AudioContext) => void;
  buzz: (ctx: AudioContext) => void;
  fanfare: (ctx: AudioContext) => void;
}

export const THEME_REGISTRY = {
  default: defaultTheme,
  'theme-music-box': musicBoxTheme,
  'theme-retro-arcade': retroArcadeTheme,
  'theme-nautical': nauticalTheme,
  'theme-fanfare-plus': fanfarePlusTheme,
} as const satisfies Record<string, ThemeHandlers>;

export type ThemeSlug = keyof typeof THEME_REGISTRY;

export const THEME_SLUGS = Object.keys(THEME_REGISTRY) as ThemeSlug[];

export function getTheme(slug: string | null | undefined): ThemeHandlers {
  if (!slug) return THEME_REGISTRY.default;
  return (THEME_REGISTRY as Record<string, ThemeHandlers>)[slug] ?? THEME_REGISTRY.default;
}
