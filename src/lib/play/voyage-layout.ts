export interface VoyagePoint {
  /** Center X as % of board width. */
  xPct: number;
  /** Center Y as % of board height. */
  yPct: number;
}

const PER_ROW = 5;
const X_MIN = 12;
const X_MAX = 88;

/**
 * Lays `total` stops in a serpentine (boustrophedon) inside a 16:9 board:
 * up to 5 per row, row 0 left→right, row 1 right→left, … Single row is
 * vertically centered; two rows sit at ~33% / ~70%.
 */
export function voyageLayout(total: number): VoyagePoint[] {
  if (total <= 0) return [];
  const rows = Math.ceil(total / PER_ROW);
  const rowY =
    rows === 1 ? [50] : Array.from({ length: rows }, (_, r) => 28 + (r * 46) / (rows - 1));

  const out: VoyagePoint[] = [];
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / PER_ROW);
    const countInRow = Math.min(PER_ROW, total - row * PER_ROW);
    let col = i - row * PER_ROW;
    if (row % 2 === 1) col = countInRow - 1 - col; // serpentine reverse
    const xPct =
      countInRow === 1 ? (X_MIN + X_MAX) / 2 : X_MIN + (col * (X_MAX - X_MIN)) / (countInRow - 1);
    out.push({ xPct, yPct: rowY[row] });
  }
  return out;
}
