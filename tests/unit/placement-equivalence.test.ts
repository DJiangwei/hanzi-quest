import { describe, it, expect, vi } from 'vitest';
vi.mock('@/db', () => ({ db: {} }));
import { canPlaceAt } from '@/lib/home/placement-rules';

/**
 * The 3D room paints a cell green from `canPlaceAt`; the server accepts or
 * rejects it in `placeFurnitureInTx`. If those ever disagree the room promises
 * a drop the action bounces. This table is the contract.
 */
const CASES: { name: string; slug: string; x: number; y: number; ok: boolean }[] = [
  { name: 'floor item in floor zone', slug: 'rug-round', x: 2, y: 3, ok: true },
  { name: 'floor item in wall zone', slug: 'rug-round', x: 2, y: 0, ok: false },
  { name: 'off the right edge', slug: 'bed-cozy', x: 7, y: 3, ok: false },
  // y=5 with h=1 is 5+1=6, NOT > rows=6 — that cell is LEGAL. Verified against
  // the catalog rather than assumed; an off-by-one here would have had the
  // implementer debugging a correct implementation against a wrong expectation.
  { name: 'last floor row is legal', slug: 'bed-cozy', x: 2, y: 5, ok: true },
  { name: 'off the bottom edge', slug: 'bed-cozy', x: 2, y: 6, ok: false },
];

describe('canPlaceAt agrees with the server rules it was extracted from', () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(canPlaceAt('bedroom', c.slug, c.x, c.y, []).ok).toBe(c.ok);
    });
  }

  it('placeFurnitureInTx imports the shared validator rather than re-deriving', async () => {
    // A behavioural test cannot see this: a hand-rolled copy of the rules would
    // pass every case above and still drift the moment one side is edited.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/lib/db/home.ts', 'utf8'),
    );
    expect(src).toContain("from '@/lib/home/placement-rules'");
    expect(src).toContain('canPlaceAt(');
  });
});
