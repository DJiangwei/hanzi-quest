/**
 * Deterministic bilingual pirate nickname for a child.
 *
 * PURE + CLIENT-SAFE by contract: no `@/db`, no `@/lib/db/*` imports — client
 * components render this directly.
 *
 * Derived from the child id and never stored. A six-year-old typing a public
 * handle would mean an input, a moderation policy and a PII surface; generating
 * the name removes all three. Identity to a crewmate is this name plus the
 * child's avatar, never their real `displayName`.
 */

const QUALITIES: { zh: string; en: string }[] = [
  { zh: '红帆', en: 'Redsail' },
  { zh: '蓝浪', en: 'Bluewave' },
  { zh: '金锚', en: 'Goldanchor' },
  { zh: '银钩', en: 'Silverhook' },
  { zh: '黑珍珠', en: 'Blackpearl' },
  { zh: '白鲸', en: 'Whitewhale' },
  { zh: '海风', en: 'Seabreeze' },
  { zh: '浪花', en: 'Seafoam' },
  { zh: '星光', en: 'Starlight' },
  { zh: '雷云', en: 'Thundercloud' },
  { zh: '碧波', en: 'Jadewater' },
  { zh: '暖阳', en: 'Sunbright' },
];

const ROLES: { zh: string; en: string }[] = [
  { zh: '船长', en: 'Captain' },
  { zh: '大副', en: 'Firstmate' },
  { zh: '舵手', en: 'Helmsman' },
  { zh: '瞭望员', en: 'Lookout' },
  { zh: '航海家', en: 'Navigator' },
  { zh: '探险家', en: 'Explorer' },
  { zh: '寻宝人', en: 'Treasureseeker' },
  { zh: '水手', en: 'Sailor' },
  { zh: '领航员', en: 'Pilot' },
  { zh: '鼓手', en: 'Drummer' },
  { zh: '厨师', en: 'Cook' },
  { zh: '木匠', en: 'Carpenter' },
];

/** FNV-1a, 32-bit. Stable across runtimes — no Math.random, no crypto. */
function hash(input: string, seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * murmur3 fmix32 — a final avalanche.
 *
 * FNV-1a's low bits are weak: its last step is a multiply, and a product's low
 * bits depend only on its inputs' low bits. `% 12` reads exactly those bits, and
 * since both axes hash the same string with only the seed differing, their low
 * bits stayed correlated — only 36 of the 144 possible names were reachable.
 * Avalanching first makes the two axes genuinely independent.
 */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function nicknameFor(childId: string): { zh: string; en: string } {
  const q = QUALITIES[fmix32(hash(childId, 0)) % QUALITIES.length]!;
  const r = ROLES[fmix32(hash(childId, 0x9e3779b9)) % ROLES.length]!;
  // 红帆船长 / Captain Redsail — ZH is quality+role, EN reads role-first.
  return { zh: `${q.zh}${r.zh}`, en: `${r.en} ${q.en}` };
}
