/**
 * Shared treasure-map textures for the voyage board (phone + landscape boards
 * and the procedural backdrop all reference these). Pure CSS background strings
 * — no React, safe to import anywhere.
 */

/** Aged-parchment paper texture (subtle speckles) as a CSS background. */
export const PARCHMENT_BG =
  'radial-gradient(circle at 20% 30%, rgba(120,80,30,0.05) 0 2px, transparent 2px),' +
  'radial-gradient(circle at 70% 60%, rgba(120,80,30,0.05) 0 2px, transparent 2px),' +
  'radial-gradient(circle at 45% 85%, rgba(120,80,30,0.04) 0 2px, transparent 2px),' +
  'linear-gradient(160deg, #f3e4c0 0%, #e9d3a3 100%)';

/** Faint white wave linework over the sea (treasure-chart style). */
export const SEA_WAVES =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Cpath d='M0 30 Q30 12 60 30 T120 30' fill='none' stroke='%23ffffff' stroke-width='2' opacity='0.12'/%3E%3Cpath d='M0 48 Q30 32 60 48 T120 48' fill='none' stroke='%23ffffff' stroke-width='2' opacity='0.10'/%3E%3C/svg%3E\")";

/** The deep-sea gradient under the wave linework. */
export const SEA_GRADIENT =
  'linear-gradient(180deg,#5cb3bb 0%,#2f8e96 50%,#1f6e76 100%)';

/** Teal scalloped wave band — the signature treasure-map border (repeats along an edge). */
export const WAVE_BAND_H =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='26'%3E%3Crect width='48' height='26' fill='%232f8e96'/%3E%3Cpath d='M0 13 Q12 3 24 13 T48 13' fill='none' stroke='%23f3e4c0' stroke-width='3.5'/%3E%3Cpath d='M0 21 Q12 12 24 21 T48 21' fill='none' stroke='%23bfe3e6' stroke-width='2' opacity='0.7'/%3E%3C/svg%3E\")";
export const WAVE_BAND_V =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='48'%3E%3Crect width='26' height='48' fill='%232f8e96'/%3E%3Cpath d='M13 0 Q3 12 13 24 T13 48' fill='none' stroke='%23f3e4c0' stroke-width='3.5'/%3E%3Cpath d='M21 0 Q12 12 21 24 T21 48' fill='none' stroke='%23bfe3e6' stroke-width='2' opacity='0.7'/%3E%3C/svg%3E\")";
