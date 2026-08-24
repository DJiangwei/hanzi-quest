/**
 * CountingBalloons — the 看图找字 (image_pick) stimulus for a counting
 * character (一...十). Draws exactly `count` balloons, 1-10.
 *
 * Why this exists: diffusion art cannot render an exact quantity — a
 * "seven colorful balloons" prompt gets back SOME balloons, and the
 * curriculum teaches exactly one number character per week, so every
 * single week hit this (David played week 7 and saw 七 paired with the
 * wrong number of balloons). A six-year-old counts what's on screen; if
 * the count disagrees with the answer, that teaches the wrong thing. A
 * number is the one case a picture CAN be perfectly right: draw exactly N
 * identical shapes, deterministically, right by construction. See
 * docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md.
 *
 * Layout: a "ten-frame" — rows of up to 5, wrapping to a second row above
 * 5. This is a standard early-math device for exactly this reason: a
 * 5-wide row is subitized (recognized at a glance, without counting one
 * by one) far more reliably than a scatter or an arc, especially near the
 * top of the 1-10 range where a single row would run edge-to-edge and an
 * arc's outer balloons would crowd or overlap. Each row is independently
 * centered, so a partial second row (6-9 balloons) still reads as a
 * clean, evenly-spaced group instead of a ragged line trailing off one
 * side. Do NOT "prettify" this into a looser scatter or a bouquet-style
 * cluster — countability at a glance IS the feature; it's the entire
 * point of this component existing instead of another diffusion image.
 *
 * Deterministic, no randomness: colour is `PALETTE[i % PALETTE.length]`
 * and each string's left/right lean alternates by index parity (i % 2) —
 * no `Math.random()`, no `Date.now()`. The same character draws the exact
 * same picture on every render, which is also what makes counting it a
 * reliable, repeatable exercise rather than a one-off illustration.
 *
 * `role="img"` + a bilingual, deliberately generic `aria-label`: it must
 * NOT name the number (that would hand a screen-reader user the answer
 * the picture is supposed to make her count out for herself), so it never
 * varies with `count` and never mentions any of the ten counting
 * characters — see the aria-label test that checks this for every count
 * 1-10, not just a spot check.
 *
 * Static by design (no animation) — nothing here needs
 * `useReducedMotion()`. If a future change adds motion, wire that hook in
 * then, per every other fx component in this repo.
 */

const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
] as const;

const COLS = 5;
const BALLOON_RX = 22;
const BALLOON_RY = 27;
const COL_GAP = 64;
const ROW_GAP = 100;
const STRING_LEN = 44;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 10;
const VIEWBOX_W = 340;
const CENTER_X = VIEWBOX_W / 2;

interface Props {
  /** How many balloons to draw. Whole numbers 1-10; clamped defensively. */
  count: number;
}

interface BalloonSpec {
  id: number;
  cx: number;
  cy: number;
  color: string;
  /** Deterministic string wiggle direction — alternates by index parity. */
  lean: number;
}

function layoutBalloons(n: number): BalloonSpec[] {
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const rowCount = Math.min(n - row * COLS, COLS);
    const rowWidth = (rowCount - 1) * COL_GAP;
    const cx = CENTER_X - rowWidth / 2 + col * COL_GAP;
    const cy = PADDING_TOP + BALLOON_RY + row * ROW_GAP;
    return {
      id: i,
      cx,
      cy,
      color: PALETTE[i % PALETTE.length],
      lean: i % 2 === 0 ? 7 : -7,
    };
  });
}

export function CountingBalloons({ count }: Props) {
  const n = Math.max(1, Math.min(10, Math.round(count)));
  const numRows = n > COLS ? 2 : 1;
  const viewBoxH =
    PADDING_TOP + BALLOON_RY * 2 + (numRows - 1) * ROW_GAP + STRING_LEN + PADDING_BOTTOM;
  const balloons = layoutBalloons(n);

  return (
    <svg
      role="img"
      aria-label="彩色气球 / colorful balloons"
      viewBox={`0 0 ${VIEWBOX_W} ${viewBoxH}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
    >
      {balloons.map((b) => {
        const bottom = b.cy + BALLOON_RY;
        return (
          <g key={b.id} data-testid="counting-balloon">
            <path
              d={`M ${b.cx} ${bottom} Q ${b.cx + b.lean} ${bottom + STRING_LEN / 2} ${b.cx} ${bottom + STRING_LEN}`}
              fill="none"
              stroke="#78716c"
              strokeWidth={1.5}
            />
            <path
              d={`M ${b.cx - 4} ${bottom - 2} L ${b.cx + 4} ${bottom - 2} L ${b.cx} ${bottom + 6} Z`}
              fill={b.color}
            />
            <ellipse cx={b.cx} cy={b.cy} rx={BALLOON_RX} ry={BALLOON_RY} fill={b.color} />
            <ellipse cx={b.cx - 8} cy={b.cy - 11} rx={6} ry={9} fill="#ffffff" opacity={0.4} />
          </g>
        );
      })}
    </svg>
  );
}
