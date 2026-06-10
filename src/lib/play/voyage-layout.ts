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

/** Horizontal margin (% from each edge) for the landscape snake. */
const H_MARGIN = 12;
/** Y centres for the 1-row / 2-row landscape layouts. */
const ROW_Y_SINGLE = 50;
const ROW_Y_TWO = [32, 70] as const;

/**
 * Lays `total` stops in a wide HORIZONTAL snake (boustrophedon) that fits a
 * landscape board with NO scroll: one row for ≤5 stops, otherwise two rows —
 * the top row runs left→right, the bottom row runs right→left, so the dotted
 * route reads as one continuous winding voyage across the sea-chart.
 *
 * Used on `lg:` (landscape iPad); phones keep the tall `voyageLayout` above.
 */
export function voyageLayoutHorizontal(total: number): VoyagePoint[] {
  if (total <= 0) return [];
  const rows = total <= 5 ? 1 : 2;
  const perRow = Math.ceil(total / rows);
  return Array.from({ length: total }, (_, i) => {
    const row = Math.floor(i / perRow);
    const countInRow = Math.min(perRow, total - row * perRow);
    const j = i % perRow;
    // Snake: even rows go left→right, odd rows right→left.
    const eff = row % 2 === 0 ? j : countInRow - 1 - j;
    const xPct =
      countInRow === 1
        ? 50
        : H_MARGIN + (eff / (countInRow - 1)) * (100 - 2 * H_MARGIN);
    const yPct = rows === 1 ? ROW_Y_SINGLE : ROW_Y_TWO[row];
    return { xPct, yPct };
  });
}
