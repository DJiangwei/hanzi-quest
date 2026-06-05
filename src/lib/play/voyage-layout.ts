export interface VoyagePoint {
  /** Center X as % of board width. */
  xPct: number;
  /** Center Y as % of board height (board height scales with stop count). */
  yPct: number;
}

/** Horizontal lean of the zigzag, as % from the left edge. */
const X_LEFT = 26;
const X_RIGHT = 74;

/**
 * Lays `total` stops in a tall VERTICAL zigzag (the original island-map snake):
 * stops step straight down the board, alternating left / right of centre.
 * The board height scales with `total` (see STOP_GAP_PX in VoyageBoard), so the
 * map fills the screen and scrolls — big stops, one "voyage leg" at a time.
 *
 * yPct is the stop's centre as a % of the (tall) board height; the component
 * sizes the board so each stop gets generous vertical room.
 */
export function voyageLayout(total: number): VoyagePoint[] {
  if (total <= 0) return [];
  return Array.from({ length: total }, (_, i) => ({
    xPct: i % 2 === 0 ? X_LEFT : X_RIGHT,
    yPct: ((i + 0.5) / total) * 100,
  }));
}
