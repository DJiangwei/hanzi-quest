# PR #57 — Lianliankan replacement for WordMatchScene — Design

**Status:** approved (David, 2026-06-02)
**Branch:** `feat/pr57-lianliankan`
**Owner:** Claude + David

---

## 1. Goal

Replace the confusing `word_match` scene (the "match these N chars to these N words" multi-character round) with a 连连看 (Lianliankan) puzzle that pairs hanzi tiles with their English meanings via a tap-tap-clear mechanic with ≤2-bend path constraint. Reinforces meaning recognition + adds a familiar Chinese-mobile-game puzzle element to the practice loop.

## 2. Why

David's playtest with Yinuo flagged `word_match` as both visually confusing (multiple chars + multiple words on the same screen, lots to parse) and pedagogically misplaced (the kid's word recognition is too limited for the current `word_match` form). The replacement should:

- Reduce visual complexity (one-shape-at-a-time matching beats N-chars-to-N-words)
- Stay safe for her current ability (pairing hanzi with English meanings — she's English-native, can read meanings; no Chinese word/pinyin recognition required)
- Add some intrinsic fun (Lianliankan is a familiar form in Chinese mobile gaming)

## 3. Scope

### Locked decisions

| Decision | Choice |
|---|---|
| Game form | 连连看 (Lianliankan) — tap two matching tiles, clear if path is valid |
| Pair content | Hanzi tile ↔ English meaning tile |
| Path constraint | Classic ≤2 right-angle bends, orthogonal segments only |
| Board size | 6 columns × 4 rows (with 1-cell empty border for routing) |
| Pairs per round | 4 pairs = 8 tiles in the inner 4×2 playable area |
| Char sourcing | 4 distinct chars from the week's pool |
| Deadlock handling | Auto-shuffle remaining tiles when no valid pair-with-path exists |
| Timer | None — kid can take her time |
| Hint integration | 💡 Hint powerup highlights one valid pair (pulse 1.5s) |
| `word_match` retirement | Same pattern as `pinyin_pick`/`visual_pick` — flip template `is_active=false`, retain component + config schema for backwards compat |

### Non-goals

- Difficulty scaling (board size stays fixed in v1)
- Manual shuffle button (auto-shuffle on deadlock is sufficient)
- Timer / time-pressure mode
- Bonus points for chains or fast clears
- Cross-pack tile content (chars come only from the current week's pool)
- Falling-tile gravity after clears (cleared cells stay empty — that's the whole point of the path-routing)

## 4. Architecture

### 4.1 Board representation

A `LianliankanBoard` is a 2D array of cells:

```ts
type CellContent =
  | { kind: 'empty' }
  | { kind: 'tile'; tileId: string; pairId: string; display: TileDisplay };

type TileDisplay =
  | { kind: 'hanzi'; text: string }
  | { kind: 'meaning'; text: string };

type LianliankanBoard = {
  cols: number;        // 6
  rows: number;        // 4
  cells: CellContent[][]; // rows × cols
};
```

The OUTER ring of cells is always `{ kind: 'empty' }`. Inner 4×2 cells (rows 1-2, cols 1-4) start as tiles, get replaced with `{ kind: 'empty' }` when cleared.

`pairId` groups a hanzi tile + its meaning tile (same `pairId` = matching pair).
`tileId` is unique per tile (one hanzi tile has different `tileId` than its meaning tile).

### 4.2 Pure path-finding — `src/lib/scenes/lianliankan.ts`

```ts
/**
 * Returns the path (list of cells) from `from` to `to` if a valid
 * Lianliankan move exists, else null.
 *
 * Rules:
 *  - Path traverses orthogonal segments only
 *  - ≤2 right-angle bends
 *  - All cells along the path (EXCLUDING the two endpoints) must be empty
 *  - from and to must contain tiles with the same pairId
 */
export function findPath(
  board: LianliankanBoard,
  from: { row: number; col: number },
  to: { row: number; col: number },
): { row: number; col: number }[] | null;

/**
 * Returns true if any pair of remaining tiles has a valid match path.
 * Used to detect deadlocks (auto-shuffle trigger).
 */
export function hasValidPair(board: LianliankanBoard): boolean;

/**
 * Returns one valid match pair (for the hint powerup).
 * Picks the first pair found by deterministic scan order.
 */
export function findOneValidPair(board: LianliankanBoard): {
  fromTileId: string;
  toTileId: string;
} | null;

/**
 * Shuffles remaining (non-empty) tiles into new positions on the inner area,
 * preserving the set of tiles. Used to break deadlocks.
 *
 * Guarantee: post-shuffle, hasValidPair() returns true. If random shuffle
 * happens to also deadlock, retries up to 32 times (extremely unlikely).
 */
export function shuffleRemaining(
  board: LianliankanBoard,
  rng: () => number,
): LianliankanBoard;

/**
 * Builds the initial 6×4 board from 4 characters (each providing hanzi +
 * meaning). Random shuffle of placement. Returns board with hasValidPair
 * guaranteed true.
 */
export function buildInitialBoard(
  chars: { id: string; hanzi: string; meaningEn: string }[],
  rng: () => number,
): LianliankanBoard;
```

#### findPath algorithm (BFS with bend budget)

State = `{ row, col, lastDir, bendsUsed }`.
Visited set keyed by `(row, col, lastDir, bendsUsed)`.

Starting state: enumerate the 4 directions from `from`, each with `bendsUsed=0, lastDir=that direction`.

Step: for each current state, try moving 1 cell in `lastDir`:
- If next cell is OUT of bounds → skip
- If next cell is `to` → success (return path)
- If next cell has a tile (not empty) → skip
- Else (empty cell) → push `{nextCell, lastDir, bendsUsed}` to queue

Also, at each cell, try the 3 perpendicular/reverse directions with `bendsUsed+1`:
- If `bendsUsed+1 > 2` → skip
- Else push `{nextCell, newDir, bendsUsed+1}`

End conditions: queue empty (no path) or reached `to` (return path).

Edge: `from` and `to` are not in the "empty along path" check. Endpoints can be tiles — they're the matchees.

### 4.3 Component — `src/components/scenes/LianliankanScene.tsx`

```ts
interface CharacterDetail {
  characterId: string;
  hanzi: string;
  meaningEn: string;
}

interface Props {
  chars: CharacterDetail[];          // 4 chars from week pool
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}
```

State:
- `board: LianliankanBoard`
- `selected: { row, col } | null` — first tap
- `lastPath: { row, col }[] | null` — for the connecting-line draw animation
- `shakeKey: number` — increments on mismatch
- `hintHighlight: { fromTileId, toTileId } | null` — for hint pulse

Tap handler:
```ts
function onTileTap(row, col) {
  if (cell at (row,col) is empty) return;
  if (selected is null) → select this tile;
  if (selected is same cell) → deselect;
  if (selected has different pairId) {
    flash red, shake, deselect;
    playSound('buzz');
    return;
  }
  // selected has same pairId — check path
  const path = findPath(board, selected, {row, col});
  if (path === null) {
    flash red, deselect;
    return;
  }
  // valid match!
  setLastPath(path);
  playSound('ding');
  setTimeout(() => {
    clearTwoTiles(board, selected, {row, col});
    setSelected(null);
    setLastPath(null);
    if (allCleared(board)) onComplete(true);
    else if (!hasValidPair(board)) board = shuffleRemaining(board);
  }, 600);
}
```

Render:
- 6-col grid using CSS grid
- Each cell renders a tile (`button` with hanzi or meaning text) or an empty placeholder (`div` with low opacity)
- The connecting-line draw is an SVG overlay positioned absolutely over the grid, drawing line segments between the path cells
- Selected tile has a sky-blue 4px border
- Hint highlight: pulse animation on the two highlighted tiles for 1.5s, then clear

### 4.4 Scene type + compile-week

New scene template:
- Type: `'lianliankan'`
- Config schema: `{ characterIds: string[] }` (exactly 4)
- Migration 0019 extends `scene_type` enum + seeds the template row

`compile-week.ts` SIGHT block:
- Current sight slot 1: `word_match` (multi-char)
- New: `lianliankan` (multi-char, 4 chars)
- The slot logic mirrors the existing `word_match` logic: select 4 random chars from those with `meaningEn`, push the `lianliankan` template.
- If fewer than 4 chars with meaningEn → fall back to skipping the slot (no `lianliankan` emitted for that week). Acceptable — every week so far has all chars with meaningEn.

### 4.5 SceneRunner + WordMatchScene retirement

- SceneRunner adds a new case for `'lianliankan'`: imports the component, passes `chars` resolved from `config.characterIds`.
- `word_match` template row flipped to `is_active=false` via new ops script `scripts/retire-word-match.ts` (same pattern as `retire-visual-pick.ts`).
- `WordMatchScene.tsx` component + `WordMatchConfigSchema` retained for backwards compat (old `scene_attempts` rows reference the template).
- After PR merges: David runs `pnpm tsx scripts/retire-word-match.ts` against prod (same Neon shared DB) and then `pnpm tsx scripts/recompile-all-weeks.ts` to regenerate level rows with lianliankan in slot 1.

## 5. UX details

- **Tile size**: 64-72px square. 6 cols × 64 + gaps = ~420px wide; works on phone (375-414px) by using viewport-relative sizing `clamp(48px, 14vw, 72px)` per tile.
- **Hanzi tile** styling: cream bg, dark hanzi text 2.5rem, font-hanzi
- **Meaning tile** styling: amber-tinted bg, dark text, smaller (1rem) for longer English words
- **Empty cell**: fully transparent (no chip — cleaner, less visual noise; the grid spacing alone shows the structure)
- **Selected tile**: sky-blue 4px border + slight scale-up
- **Match animation**: connecting line drawn in 300ms, both tiles fade out in next 300ms
- **Mismatch animation**: red border flash 200ms, ShakeWrap, deselect
- **Hint pulse**: gold-yellow ring grows + fades 3 times over 1.5s
- **Reduced motion**: skip the connecting-line draw + fade; replace with instant clear

## 6. Tests

**New test files:**

- `tests/unit/lianliankan-pathfinding.test.ts`:
  - Direct line (0 bends) — vertical and horizontal
  - L-shape (1 bend)
  - Z-shape (2 bends)
  - No path because >2 bends required
  - No path because all routes blocked by other tiles
  - Endpoints can be tiles (not empty), middle cells must be empty
  - Border-row routing (path goes through the 1-cell empty border)
  - Path between same-cell (degenerate; should return null or trivial)
  - hasValidPair() returns true when at least one matchable pair exists with valid path
  - hasValidPair() returns false on a contrived deadlock
  - findOneValidPair() returns a valid pair when one exists
  - shuffleRemaining() preserves tile set and produces non-deadlock board

- `tests/unit/lianliankan-scene.test.tsx`:
  - Renders 8 tiles in the inner 4×2 area
  - Tap first tile → selected highlight visible
  - Tap same tile twice → deselected
  - Tap two non-matching tiles → mismatch animation + deselect
  - Tap two matching tiles with valid path → both clear after 600ms
  - Clear all 8 tiles → onComplete(true) called
  - Hint powerup highlights a valid pair
  - Deadlock triggers auto-shuffle (mock pathfinding to force deadlock)

**Updated test files:**
- `tests/unit/compile-week*.test.ts` (or similar) — assert lianliankan emitted in sight slot 1; word_match no longer emitted; level count remains 13 for n≥10 week.
- `tests/unit/retire-word-match.test.ts` — new file, idempotent test like retire-visual-pick.

**Estimated:** +25-35 tests.

## 7. Verification

Pre-merge:
1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — four green
2. `pnpm dev` → play through a practice section → confirm lianliankan appears in sight slot 1
3. Tap hanzi + meaning of same char → see connecting line + both clear
4. Tap two different-char tiles → mismatch animation
5. Tap two matching tiles but blocked path (engineered scenario) → no clear, deselect
6. Clear all 8 → next level advances
7. Trigger a hint (🎁 hint powerup) → highlighted pair pulses

Post-merge ops:
```bash
pnpm tsx scripts/retire-word-match.ts
pnpm tsx scripts/recompile-all-weeks.ts
```

## 8. Open questions / v2 candidates

- **Difficulty scaling**: 4 pairs → 6 pairs → 8 pairs as weeks progress. v2.
- **Manual shuffle button**: when stuck, kid taps "shuffle" instead of relying on auto. Adds agency. v2 if Yinuo asks.
- **Timer / time bonus**: pressure mode + chain scoring. Out of scope for kid-friendly v1.
- **Animated tile gravity** (cleared tiles fall down): visually fun but defeats the path-routing puzzle. Skip.
- **Cross-week chars**: include 1-2 chars from previous weeks for review. Out of scope; weekly content stays bounded.
- **Sound effects**: just `ding` + `buzz` from existing theme. v2: layered "clear pair" chime.
- **Hint cost**: currently 30 coins. Defer cost-tuning to a separate PR.

## 9. Landmines / things to preserve

- **`word_match` template stays in DB**. Same retirement pattern as `pinyin_pick`/`visual_pick`. Component file (`WordMatchScene.tsx`) + `WordMatchConfigSchema` + `SceneRunner` case all REMAIN for backwards compat with old `scene_attempts` rows.
- **Path-finding endpoints are tiles, not empty.** Common bug: BFS rejecting endpoints because "they have a tile". The first move OUT of `from` and the last move INTO `to` allow tile cells as the start/end; intermediate cells MUST be empty.
- **Deadlock detection runs after every clear.** Without this, kid hits an unwinnable state and gets confused. The auto-shuffle should be visually obvious (brief flash + tile-swap animation, not silent reshuffle).
- **Pollinations image URL is NOT used here.** Meaning tiles show English text only. Future v2 could swap to image when available, but v1 keeps it simple.
- **Hint shows ONE valid pair, not all.** Otherwise the kid just taps through everything. Highlight only the first pair returned by `findOneValidPair()`.
- **`compile-week.ts` SIGHT slot 1 retains 4-char selection logic.** Lianliankan needs exactly 4 chars; if a week has fewer (rare, only for tiny test weeks), skip the slot entirely (lose 1 sight slot, sight count drops to 1). Don't try to fill with 3-pair lianliankan — the 4×2 grid would feel awkward.

## 10. Effort + rollout

- ~12 implementation tasks (board model + path-finding + shuffle + scene component + scene type + migration + compile-week wire + SceneRunner case + retire script + CLAUDE.md update + verify + PR)
- ~15 files touched
- 1 migration (0019)
- Recompile required post-merge (replaces level rows with lianliankan in slot 1; stable level_key upserts preserve scene_attempts linkages for OTHER scene types)
- Rollout: PR → four-green → merge → David runs retire + recompile against prod
