/**
 * `Room3DPanel` mounts a `<Canvas>` (via `Room3DMount` → `next/dynamic` →
 * `HomeRoom3D`), so it cannot be rendered in jsdom — see the Task 6 report
 * and `tests/unit/home3d-pick.test.ts`. The edit-flow DECISIONS it makes are
 * therefore pure functions tested directly here, never through a render.
 */
import { describe, it, expect } from 'vitest';
import {
  confirmState,
  PLACE_LABEL,
  BUY_LABEL_SUFFIX,
  buyLabel,
  DISABLED_LABEL,
} from '@/lib/home3d/confirm-bar';
import { resolvePieceSelection } from '@/lib/home3d/piece-selection';

describe('confirmState', () => {
  it('shows "place" for an owned copy on a legal cell', () => {
    expect(confirmState({ legal: true, owned: true, priceCoins: 300, coins: 0 })).toEqual({
      kind: 'place',
    });
  });

  it('shows "buy" for an unowned piece on a legal cell she can afford', () => {
    expect(confirmState({ legal: true, owned: false, priceCoins: 300, coins: 300 })).toEqual({
      kind: 'buy',
      priceCoins: 300,
    });
  });

  it('is exactly affordable at coins === priceCoins — not "poor"', () => {
    // A strict `<` boundary: equal coins must buy, not block.
    expect(confirmState({ legal: true, owned: false, priceCoins: 300, coins: 300 }).kind).toBe(
      'buy',
    );
  });

  it('disables as "poor" for an unowned piece she cannot afford, on a legal cell', () => {
    expect(confirmState({ legal: true, owned: false, priceCoins: 300, coins: 100 })).toEqual({
      kind: 'disabled',
      why: 'poor',
    });
  });

  it('disables as "illegal" for an owned copy on an illegal cell', () => {
    expect(confirmState({ legal: false, owned: true, priceCoins: 300, coins: 1000 })).toEqual({
      kind: 'disabled',
      why: 'illegal',
    });
  });

  it('THE precedence case: an illegal cell wins over unaffordability', () => {
    // She should be told the cell is wrong, never that she is poor, when
    // BOTH are true — the real problem is where she is pointing.
    expect(confirmState({ legal: false, owned: false, priceCoins: 300, coins: 0 })).toEqual({
      kind: 'disabled',
      why: 'illegal',
    });
  });

  it('is "illegal", not "buy", when the cell is bad even though she could afford it', () => {
    // The other half of the precedence case: legality is checked BEFORE
    // affordability is even asked, not just before the "poor" branch.
    expect(confirmState({ legal: false, owned: false, priceCoins: 300, coins: 999999 })).toEqual({
      kind: 'disabled',
      why: 'illegal',
    });
  });
});

describe('bilingual confirm-bar labels', () => {
  it('has the exact owned-copy label', () => {
    expect(PLACE_LABEL).toBe('放这里 / Place here');
  });

  it('has the exact purchase label suffix', () => {
    expect(BUY_LABEL_SUFFIX).toBe('买下并放这里 / Buy & place here');
  });

  it('prefixes the price and keeps the full bilingual phrase intact', () => {
    const label = buyLabel(680);
    expect(label).toContain('680');
    expect(label).toContain('买下并放这里 / Buy & place here');
  });

  it('never renders a scolding sentence for either disabled reason', () => {
    for (const why of ['illegal', 'poor'] as const) {
      const copy = DISABLED_LABEL[why];
      expect(copy.toLowerCase()).not.toContain("can't");
      expect(copy.toLowerCase()).not.toContain('not enough');
      expect(copy).not.toContain('不能');
      expect(copy).not.toContain('不够');
    }
  });
});

describe('resolvePieceSelection', () => {
  it('hands her an owned spare copy before ever offering a purchase', () => {
    expect(
      resolvePieceSelection({
        ownedCount: 2,
        placedCopyIndices: [0], // copy 1 is spare
        shopItemId: 's1',
        copyCap: 3,
      }),
    ).toEqual({ copyIndex: 1, shopItemId: null });
  });

  it('picks the LOWEST free index, not just any', () => {
    expect(
      resolvePieceSelection({
        ownedCount: 3,
        placedCopyIndices: [1], // 0 and 2 are both spare — 0 wins
        shopItemId: null,
        copyCap: 3,
      }),
    ).toEqual({ copyIndex: 0, shopItemId: null });
  });

  it('offers a fresh purchase at the next index when nothing owned is spare', () => {
    expect(
      resolvePieceSelection({
        ownedCount: 1,
        placedCopyIndices: [0],
        shopItemId: 's1',
        copyCap: 3,
      }),
    ).toEqual({ copyIndex: 1, shopItemId: 's1' });
  });

  it('offers a fresh purchase at index 0 when nothing is owned yet', () => {
    expect(
      resolvePieceSelection({
        ownedCount: 0,
        placedCopyIndices: [],
        shopItemId: 's1',
        copyCap: 3,
      }),
    ).toEqual({ copyIndex: 0, shopItemId: 's1' });
  });

  it('returns null at the copy cap with nothing spare — nothing to hand her', () => {
    expect(
      resolvePieceSelection({
        ownedCount: 3,
        placedCopyIndices: [0, 1, 2],
        shopItemId: 's1',
        copyCap: 3,
      }),
    ).toBeNull();
  });

  it('returns null when unowned and not sold (unseeded shop item)', () => {
    expect(
      resolvePieceSelection({
        ownedCount: 0,
        placedCopyIndices: [],
        shopItemId: null,
        copyCap: 3,
      }),
    ).toBeNull();
  });

  it('still offers the spare even when the piece is no longer sold (shopItemId null)', () => {
    // Owning 2, placing 1 — the second copy is a legitimate spare regardless
    // of whether it could be bought again today.
    expect(
      resolvePieceSelection({
        ownedCount: 2,
        placedCopyIndices: [0],
        shopItemId: null,
        copyCap: 3,
      }),
    ).toEqual({ copyIndex: 1, shopItemId: null });
  });
});
