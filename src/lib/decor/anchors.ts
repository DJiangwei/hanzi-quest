/**
 * Anchor positions for island-map decorations, in IslandMap's SVG viewBox
 * coordinates (0..360 horizontally, 0..svgHeight vertically).
 *
 * IslandMap uses TOP_PADDING=80, VERTICAL_SPACING=150, BOTTOM_PADDING=80.
 * Island y values for 10 weeks: 80, 230, 380, 530, 680, 830, 980, 1130, 1280, 1430.
 * svgHeight = 80 + 9*150 + 80 = 1590.
 * "between-N-N" anchors place a decoration at the midpoint of two adjacent
 * islands' y values (e.g. between-2-3 = (230+380)/2 = 305).
 */

export type AnchorSlug =
  | 'top-left'
  | 'top-right'
  | 'left-margin-mid'
  | 'right-margin-mid'
  | 'between-2-3'
  | 'between-4-5'
  | 'between-6-7'
  | 'between-8-9'
  | 'left-margin-low'
  | 'bottom-center';

export interface AnchorPos {
  x: number;
  y: number;
  scale?: number;
}

export const ANCHORS: Record<AnchorSlug, AnchorPos> = {
  'top-left':         { x: 60,  y: 60 },
  'top-right':        { x: 300, y: 90 },
  'left-margin-mid':  { x: 40,  y: 380 },
  'right-margin-mid': { x: 320, y: 530 },
  'between-2-3':      { x: 180, y: 305, scale: 0.9 },
  'between-4-5':      { x: 180, y: 605 },
  'between-6-7':      { x: 180, y: 905 },
  'between-8-9':      { x: 180, y: 1205 },
  'left-margin-low':  { x: 50,  y: 1080 },
  'bottom-center':    { x: 180, y: 1550 },
};
