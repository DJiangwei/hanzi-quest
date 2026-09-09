/**
 * Pure decision for the 3D room's "buy & place" confirm bar. PURE — no React.
 *
 * **Illegal always wins over unaffordable.** A cell that fails `canPlaceAt`
 * is disabled for `'illegal'` even when she could otherwise afford the
 * piece — she should never be told she is poor when the real problem is
 * where she is pointing. Checked FIRST, before ownership or price, so a
 * bad cell can never be shadowed by a price problem underneath it.
 */

export type ConfirmState =
  | { kind: 'place' } // owned copy, legal cell
  | { kind: 'buy'; priceCoins: number } // legal cell, affordable
  | { kind: 'disabled'; why: 'illegal' | 'poor' };

export function confirmState(args: {
  legal: boolean;
  owned: boolean;
  priceCoins: number;
  coins: number;
}): ConfirmState {
  if (!args.legal) return { kind: 'disabled', why: 'illegal' };
  if (args.owned) return { kind: 'place' };
  if (args.coins < args.priceCoins) return { kind: 'disabled', why: 'poor' };
  return { kind: 'buy', priceCoins: args.priceCoins };
}

/**
 * Bilingual confirm-bar copy, ZH first per the app-wide chrome rule.
 * Pure constants so a component test that cannot mount the Canvas (see
 * `HomeRoom3D`/`Room3DPanel`) can still assert the exact kid-facing label.
 */
export const PLACE_LABEL = '放这里 / Place here';
export const BUY_LABEL_SUFFIX = '买下并放这里 / Buy & place here';

/** e.g. "🪙680  买下并放这里 / Buy & place here" */
export function buyLabel(priceCoins: number): string {
  return `🪙${priceCoins}  ${BUY_LABEL_SUFFIX}`;
}

/**
 * Quiet, non-scolding copy for the disabled chip. Never "you can't afford
 * this" / "you can't place here" — the shop's `tooExpensive` rule, applied
 * here to a cell instead of a price. `'poor'` intentionally omits words
 * about money at all; the price chip elsewhere on the card already shows
 * the number, same as `FurnitureCard`'s muted `tooExpensive` state.
 */
export const DISABLED_LABEL: Record<'illegal' | 'poor', string> = {
  illegal: '📍 换个地方 / Try another spot',
  poor: '再攒攒 / Almost there',
};
