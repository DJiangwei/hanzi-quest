/** 钥匙宝库 / The Key Vault (`key-vault-v1`) — reward-only treasures, one per
 *  map, opened ONLY by collecting every 🗝️ key shard on that map (i.e. beating
 *  all of its weekly bosses). Distinct from `champions-v1`, which is earned by
 *  the map's FINAL boss afterwards: the vault is the reward for the long grind
 *  across every island, the champion crown for the last fight.
 *
 *  Pack is gacha_eligible=false (never dropped, never in the weekly 大礼包) and
 *  shard-swap-exclusive. Bilingual per the locked collectibles rule. */
export interface VaultTreasure {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const VAULT_TREASURES: VaultTreasure[] = [
  {
    slug: 'vault-caribbean',
    nameZh: '加勒比宝藏',
    nameEn: 'The Caribbean Hoard',
    emoji: '💎',
    loreZh: '十把钥匙，十座岛屿。你打开了加勒比海最深处的宝库。',
    loreEn: 'Ten keys, ten islands. You opened the deepest vault in the Caribbean.',
  },
  {
    slug: 'vault-caspian',
    nameZh: '里海宝藏',
    nameEn: 'The Caspian Hoard',
    emoji: '🔥',
    loreZh: '十把钥匙点亮了火焰山。世界上最大的湖，把它的宝库交给了你。',
    loreEn: "Ten keys lit the Burning Mountain. The world's largest lake gave up its hoard.",
  },
  {
    slug: 'vault-indian-ocean',
    nameZh: '印度洋宝藏',
    nameEn: 'The Indian Ocean Hoard',
    emoji: '🏆',
    loreZh: '季风为你让路，印度洋的宝库向你敞开。',
    loreEn: 'The monsoon parted for you, and the Indian Ocean vault swung open.',
  },
];

export const VAULT_TREASURES_BY_SLUG: Record<string, VaultTreasure> =
  Object.fromEntries(VAULT_TREASURES.map((t) => [t.slug, t]));

/** Map pack slug → the vault treasure earned by collecting all its keys. */
export const MAP_TO_VAULT_CARD: Record<string, string> = {
  'pirate-class-level-1': 'vault-caribbean',
  'pirate-class-level-2': 'vault-caspian',
  // Reserve alongside the map-boards entry — see map-boards.ts.
  'pirate-class-level-3': 'vault-indian-ocean',
};

export const KEY_VAULT_PACK_SLUG = 'key-vault-v1';

/** Coins paid alongside the treasure card when the last key lands. */
export const KEY_VAULT_COIN_PRIZE = 1000;
