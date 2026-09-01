// The 存钱罐 toast payload. Client-safe — NO db imports.
//
// Lives here rather than in `src/lib/actions/play.ts` because that is a
// `'use server'` file, and those may only export ASYNC functions: exporting a
// sync helper from one turns it into a public RPC endpoint (or fails the
// build). Two actions need this shape — finishLevelAction and
// finishFinalBossAction — so it has to be somewhere both can import.
//
// The `EconomyBonus` import is type-only and fully erased, so the apparent
// cycle with play.ts does not exist at runtime. `BonusToast` imports the same
// type the same way.
import type { EconomyBonus } from '@/lib/actions/play';

/**
 * One bonus shape for every piggy payout, so the toast reads identically
 * whether the £ came from a weekly boss, the vault, or the final overlord.
 * `unit: 'pence'` is what makes BonusToast render £3.00 rather than "+300".
 */
export function piggyBonus(pence: number): EconomyBonus {
  return {
    reason: 'piggy',
    delta: pence,
    unit: 'pence',
    labelZh: '存钱罐',
    labelEn: 'Piggy bank',
  };
}
