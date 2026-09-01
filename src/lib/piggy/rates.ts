// What each game event pays, in pence. Client-safe — the WeekHub pre-fight
// preview is a client component and imports PIGGY_BOSS_CLEAR_PENCE.
//
// A map pays £14: ten weekly bosses (£1 each) + the key vault (£1) + the
// final overlord (£3). Season tiers carry their own amounts in the season's
// tier_config, not here, so a season's payout can change without a deploy.

export const PIGGY_BOSS_CLEAR_PENCE = 100;
export const PIGGY_KEY_VAULT_PENCE = 100;
export const PIGGY_FINAL_BOSS_PENCE = 300;
