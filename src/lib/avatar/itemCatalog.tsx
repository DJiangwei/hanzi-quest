import type { ReactElement } from 'react';
import type { AvatarSlotId } from './defaultLook';
import type { AvatarTheme } from './themes';

export type ItemRarity = 'common' | 'rare' | 'epic';

export interface ItemDef {
  /** Stable id. Mirrors avatar_items.unlock_ref AND shop_items.slug. */
  unlockRef: string;
  slot: AvatarSlotId;
  displayName: string;
  description?: string;
  /** Undefined for default items (never sold). */
  rarity?: ItemRarity;
  /** Undefined for default items. */
  priceCoins?: number;
  /**
   * Short English noun phrase the story-mode AI can fold into the hero's
   * appearance line, e.g. `'a red bandana'`, `'a navy captain's coat'`. For
   * background slots, phrase as a contextual modifier (e.g.
   * `'with wave-blue surroundings'`). Used by `resolveNarrativeHint`.
   */
  narrativeHint: string;
  /** PR #58: cosmetic categorization. Required on every item. */
  theme: AvatarTheme;
  /**
   * Inner SVG content for this item; rendered inside the AvatarRender's outer
   * `<svg viewBox="0 0 100 100">`. Must use only flat colours (no `<defs>` /
   * gradients) so multiple slots can share one `<svg>` without id collisions.
   */
  renderSvg: () => ReactElement;
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────

const defaultHead: ItemDef = {
  unlockRef: 'default-kid-warm',
  slot: 'head',
  displayName: '小水手',
  narrativeHint: 'a sun-tanned young pirate',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-kid-warm">
      <circle
        cx="50"
        cy="46"
        r="22"
        fill="#f5c79a"
        stroke="#7a4a2a"
        strokeWidth="1.5"
      />
      <circle cx="42" cy="44" r="1.8" fill="#2a1a14" />
      <circle cx="58" cy="44" r="1.8" fill="#2a1a14" />
      <path
        d="M 43 53 Q 50 57 57 53"
        stroke="#7a4a2a"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="36" cy="50" r="2.5" fill="#f0a07a" opacity="0.6" />
      <circle cx="64" cy="50" r="2.5" fill="#f0a07a" opacity="0.6" />
    </g>
  ),
};

const defaultBandana: ItemDef = {
  unlockRef: 'default-bandana-red',
  slot: 'hat',
  displayName: '红头巾',
  narrativeHint: 'a red bandana with white polka dots',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-bandana-red">
      <path
        d="M 28 32 Q 50 19 72 32 L 73 39 Q 50 33 27 39 Z"
        fill="#d63a2f"
        stroke="#7a1f1f"
        strokeWidth="1.2"
      />
      <circle cx="38" cy="35" r="1.2" fill="#fff" />
      <circle cx="50" cy="33" r="1.2" fill="#fff" />
      <circle cx="62" cy="35" r="1.2" fill="#fff" />
      <path
        d="M 72 32 L 80 38 L 76 44 L 70 38 Z"
        fill="#d63a2f"
        stroke="#7a1f1f"
        strokeWidth="1"
      />
    </g>
  ),
};

const defaultTee: ItemDef = {
  unlockRef: 'default-tee-stripes',
  slot: 'top',
  displayName: '条纹衫',
  narrativeHint: 'a striped sailor shirt',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-tee-stripes">
      <path
        d="M 26 72 L 28 95 L 72 95 L 74 72 Q 60 64 50 64 Q 40 64 26 72 Z"
        fill="#ffffff"
        stroke="#1a4b7a"
        strokeWidth="1.4"
      />
      <rect x="27" y="74" width="46" height="3" fill="#1a4b7a" />
      <rect x="27" y="81" width="46" height="3" fill="#1a4b7a" />
      <rect x="27" y="88" width="46" height="3" fill="#1a4b7a" />
    </g>
  ),
};

const defaultOcean: ItemDef = {
  unlockRef: 'default-ocean',
  slot: 'background',
  displayName: '海洋',
  narrativeHint: 'with wave-blue ocean surroundings',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-ocean">
      <circle cx="50" cy="50" r="50" fill="#5fb1d3" />
      <path
        d="M 0 65 Q 25 60 50 65 T 100 65 L 100 75 Q 75 70 50 75 T 0 75 Z"
        fill="#3a8ab2"
        opacity="0.6"
      />
      <path
        d="M 0 80 Q 25 75 50 80 T 100 80 L 100 90 Q 75 85 50 90 T 0 90 Z"
        fill="#2c6d8e"
        opacity="0.7"
      />
    </g>
  ),
};

const defaultHair: ItemDef = {
  unlockRef: 'default-hair-brown',
  slot: 'hair',
  displayName: '棕色短发',
  narrativeHint: 'with short brown hair',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-hair-brown">
      {/* Simple brown hair — drawn over the head, under the hat */}
      <path
        d="M 28 38 Q 28 22 50 22 Q 72 22 72 38 Q 68 30 50 30 Q 32 30 28 38 Z"
        fill="#5a3214"
      />
      <path
        d="M 28 38 Q 26 44 28 50 Q 26 40 28 38 Z"
        fill="#4a2a10"
      />
      <path
        d="M 72 38 Q 74 44 72 50 Q 74 40 72 38 Z"
        fill="#4a2a10"
      />
    </g>
  ),
};

const defaultPants: ItemDef = {
  unlockRef: 'default-pants-blue',
  slot: 'pants',
  displayName: '蓝色长裤',
  narrativeHint: 'wearing navy blue trousers',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-pants-blue">
      {/* Simple blue pants — drawn below the torso line */}
      <path
        d="M 30 78 L 28 100 L 48 100 L 50 88 L 52 100 L 72 100 L 70 78 Z"
        fill="#1a3a6a"
        stroke="#0a1a3a"
        strokeWidth="1"
      />
    </g>
  ),
};

// ─── HATS (7 shop items) ─────────────────────────────────────────────────────

const hatTricorn: ItemDef = {
  unlockRef: 'avatar-hat-tricorn',
  slot: 'hat',
  displayName: '海盗三角帽',
  narrativeHint: 'a black tricorn pirate hat',
  rarity: 'common',
  priceCoins: 120,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-tricorn">
      <path
        d="M 22 32 L 50 18 L 78 32 L 70 36 Q 50 30 30 36 Z"
        fill="#2a2a2e"
        stroke="#0a0a0e"
        strokeWidth="1.2"
      />
      <circle cx="50" cy="22" r="2.5" fill="#d4af37" />
      <path d="M 47 22 L 53 22 M 50 19 L 50 25" stroke="#7a6520" strokeWidth="1" />
    </g>
  ),
};

const hatCaptain: ItemDef = {
  unlockRef: 'avatar-hat-captain',
  slot: 'hat',
  displayName: '船长帽',
  narrativeHint: "a navy captain's hat with a gold trim",
  rarity: 'rare',
  priceCoins: 300,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-captain">
      <path
        d="M 20 35 L 22 24 Q 50 14 78 24 L 80 35 Z"
        fill="#1a1a3a"
        stroke="#000"
        strokeWidth="1.2"
      />
      <rect x="20" y="33" width="60" height="4" fill="#d4af37" />
      <path
        d="M 44 24 L 50 19 L 56 24 L 53 26 L 50 22 L 47 26 Z"
        fill="#d4af37"
        stroke="#7a6520"
        strokeWidth="0.8"
      />
    </g>
  ),
};

const hatBandanaBlue: ItemDef = {
  unlockRef: 'avatar-hat-bandana-blue',
  slot: 'hat',
  displayName: '蓝头巾',
  narrativeHint: 'a blue bandana with white waves',
  rarity: 'common',
  priceCoins: 80,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-bandana-blue">
      <path
        d="M 28 32 Q 50 19 72 32 L 73 39 Q 50 33 27 39 Z"
        fill="#2a6db8"
        stroke="#13407a"
        strokeWidth="1.2"
      />
      <path
        d="M 35 33 L 40 37 M 47 31 L 52 36 M 60 33 L 65 37"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M 72 32 L 80 38 L 76 44 L 70 38 Z"
        fill="#2a6db8"
        stroke="#13407a"
        strokeWidth="1"
      />
    </g>
  ),
};

const hatParrotPerch: ItemDef = {
  unlockRef: 'avatar-hat-parrot-perch',
  slot: 'hat',
  displayName: '肩头鹦鹉',
  description: '一只忠诚的航海伙伴',
  narrativeHint: 'a tiny red parrot perched on her shoulder',
  rarity: 'rare',
  priceCoins: 360,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-parrot-perch">
      <path
        d="M 28 32 Q 50 22 72 32 L 73 38 Q 50 32 27 38 Z"
        fill="#8a5a2a"
        stroke="#4a2a14"
        strokeWidth="1"
      />
      <ellipse cx="72" cy="22" rx="10" ry="8" fill="#d63a2f" />
      <circle cx="78" cy="20" r="2" fill="#fff" />
      <circle cx="78" cy="20" r="1" fill="#000" />
      <path d="M 80 22 L 86 22 L 82 24 Z" fill="#f5b942" />
      <path
        d="M 64 22 L 60 18 L 64 16 L 66 19 Z"
        fill="#1a6db8"
      />
      <path d="M 68 28 L 62 32 L 70 30 Z" fill="#1a6db8" />
    </g>
  ),
};

const hatCrownGold: ItemDef = {
  unlockRef: 'avatar-hat-crown-gold',
  slot: 'hat',
  displayName: '黄金王冠',
  description: '海盗之王的标志',
  narrativeHint: 'a sparkling gold crown studded with gems',
  rarity: 'epic',
  priceCoins: 820,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-crown-gold">
      <path
        d="M 25 35 L 28 18 L 38 28 L 50 14 L 62 28 L 72 18 L 75 35 Z"
        fill="#f5c542"
        stroke="#7a5a14"
        strokeWidth="1.4"
      />
      <circle cx="30" cy="32" r="2" fill="#d63a2f" stroke="#7a1f1f" strokeWidth="0.6" />
      <circle cx="50" cy="30" r="2.4" fill="#3a8ab2" stroke="#143a5a" strokeWidth="0.6" />
      <circle cx="70" cy="32" r="2" fill="#5fa83a" stroke="#1f5a14" strokeWidth="0.6" />
      <line x1="25" y1="35" x2="75" y2="35" stroke="#7a5a14" strokeWidth="1.2" />
    </g>
  ),
};

const hatSunhat: ItemDef = {
  unlockRef: 'avatar-hat-sunhat',
  slot: 'hat',
  displayName: '草编帽',
  narrativeHint: 'a wide-brimmed straw sunhat',
  rarity: 'common',
  priceCoins: 100,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-sunhat">
      <ellipse cx="50" cy="35" rx="30" ry="5" fill="#e6c98a" stroke="#7a5a2a" strokeWidth="1" />
      <ellipse cx="50" cy="26" rx="14" ry="9" fill="#f0d29a" stroke="#7a5a2a" strokeWidth="1" />
      <path d="M 38 28 L 62 28" stroke="#7a5a2a" strokeWidth="0.6" />
      <path d="M 36 32 L 64 32" stroke="#7a5a2a" strokeWidth="0.6" />
    </g>
  ),
};

const hatBeanie: ItemDef = {
  unlockRef: 'avatar-hat-beanie',
  slot: 'hat',
  displayName: '针织帽',
  narrativeHint: 'a cozy green knit beanie with a red pom',
  rarity: 'common',
  priceCoins: 90,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-beanie">
      <path
        d="M 30 35 Q 30 17 50 17 Q 70 17 70 35 Z"
        fill="#5f7a3a"
        stroke="#2c3a14"
        strokeWidth="1.2"
      />
      <rect x="30" y="33" width="40" height="5" fill="#7a9554" stroke="#2c3a14" strokeWidth="1" />
      <circle cx="50" cy="14" r="3" fill="#d63a2f" />
    </g>
  ),
};

const hatEyepatchSkull: ItemDef = {
  unlockRef: 'avatar-hat-skull-cap',
  slot: 'hat',
  displayName: '骷髅帽',
  narrativeHint: 'a black skull-and-crossbones cap',
  rarity: 'epic',
  priceCoins: 700,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-hat-skull-cap">
      <path
        d="M 28 35 Q 28 18 50 18 Q 72 18 72 35 Z"
        fill="#1a1a1f"
        stroke="#000"
        strokeWidth="1.2"
      />
      <circle cx="44" cy="27" r="2.2" fill="#fff" />
      <circle cx="56" cy="27" r="2.2" fill="#fff" />
      <path d="M 46 32 L 50 30 L 54 32 L 50 34 Z" fill="#fff" />
      <line x1="40" y1="33" x2="60" y2="33" stroke="#fff" strokeWidth="1.4" />
    </g>
  ),
};

// ─── TOPS (5 shop items) ─────────────────────────────────────────────────────

const topPirateCoat: ItemDef = {
  unlockRef: 'avatar-top-coat-pirate',
  slot: 'top',
  displayName: '海盗大衣',
  narrativeHint: 'a long brown pirate coat with gold buttons',
  rarity: 'rare',
  priceCoins: 320,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-top-coat-pirate">
      <path
        d="M 22 72 L 24 95 L 76 95 L 78 72 Q 60 62 50 62 Q 40 62 22 72 Z"
        fill="#5a3a1a"
        stroke="#2a1a0a"
        strokeWidth="1.4"
      />
      <path d="M 50 64 L 50 95" stroke="#2a1a0a" strokeWidth="1.4" />
      <circle cx="44" cy="76" r="1.8" fill="#f5c542" />
      <circle cx="44" cy="84" r="1.8" fill="#f5c542" />
      <circle cx="44" cy="91" r="1.8" fill="#f5c542" />
      <path
        d="M 22 72 L 32 72 L 28 80 L 24 78 Z"
        fill="#7a4a14"
        stroke="#2a1a0a"
        strokeWidth="1"
      />
      <path
        d="M 78 72 L 68 72 L 72 80 L 76 78 Z"
        fill="#7a4a14"
        stroke="#2a1a0a"
        strokeWidth="1"
      />
    </g>
  ),
};

const topVest: ItemDef = {
  unlockRef: 'avatar-top-vest',
  slot: 'top',
  displayName: '皮背心',
  narrativeHint: 'a tan leather vest',
  rarity: 'common',
  priceCoins: 130,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-top-vest">
      <path
        d="M 30 72 L 28 95 L 72 95 L 70 72 L 60 66 L 50 70 L 40 66 Z"
        fill="#7a4a1a"
        stroke="#3a1a0a"
        strokeWidth="1.2"
      />
      <path d="M 50 70 L 50 95" stroke="#3a1a0a" strokeWidth="1" />
      <rect x="48" y="76" width="4" height="3" fill="#f5c542" rx="0.5" />
      <rect x="48" y="84" width="4" height="3" fill="#f5c542" rx="0.5" />
    </g>
  ),
};

const topLifejacket: ItemDef = {
  unlockRef: 'avatar-top-lifejacket',
  slot: 'top',
  displayName: '救生衣',
  narrativeHint: 'a bright orange lifejacket with reflective stripes',
  rarity: 'common',
  priceCoins: 150,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-top-lifejacket">
      <path
        d="M 26 70 L 28 95 L 44 95 L 44 70 Q 36 66 26 70 Z"
        fill="#f5852a"
        stroke="#7a3a0a"
        strokeWidth="1.2"
      />
      <path
        d="M 74 70 L 72 95 L 56 95 L 56 70 Q 64 66 74 70 Z"
        fill="#f5852a"
        stroke="#7a3a0a"
        strokeWidth="1.2"
      />
      <rect x="44" y="70" width="12" height="25" fill="#f5852a" stroke="#7a3a0a" strokeWidth="1" />
      <rect x="28" y="80" width="44" height="3" fill="#fff" />
      <rect x="28" y="86" width="44" height="3" fill="#fff" />
    </g>
  ),
};

const topApronTreasure: ItemDef = {
  unlockRef: 'avatar-top-apron-treasure',
  slot: 'top',
  displayName: '寻宝围裙',
  narrativeHint: 'a treasure-hunter apron with a gold coin pocket',
  rarity: 'rare',
  priceCoins: 280,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-top-apron-treasure">
      <path
        d="M 26 72 L 28 95 L 72 95 L 74 72 Q 60 64 50 64 Q 40 64 26 72 Z"
        fill="#c98a3a"
        stroke="#5a3a0a"
        strokeWidth="1.2"
      />
      <path d="M 38 64 L 40 95 M 62 64 L 60 95" stroke="#5a3a0a" strokeWidth="1" />
      <circle cx="50" cy="82" r="5" fill="#f5c542" stroke="#7a5a14" strokeWidth="1" />
      <text
        x="50"
        y="85"
        fontSize="6"
        textAnchor="middle"
        fontWeight="bold"
        fill="#7a5a14"
      >
        宝
      </text>
    </g>
  ),
};

const topEpaulettesGold: ItemDef = {
  unlockRef: 'avatar-top-epaulettes-gold',
  slot: 'top',
  displayName: '金肩章礼服',
  description: '舰队司令的盛装',
  narrativeHint: 'a navy admiral coat with gold epaulettes',
  rarity: 'epic',
  priceCoins: 720,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-top-epaulettes-gold">
      <path
        d="M 26 72 L 28 95 L 72 95 L 74 72 Q 60 64 50 64 Q 40 64 26 72 Z"
        fill="#1a1a3a"
        stroke="#000"
        strokeWidth="1.4"
      />
      <path d="M 50 64 L 50 95" stroke="#d4af37" strokeWidth="1.2" />
      <circle cx="44" cy="78" r="1.6" fill="#d4af37" />
      <circle cx="44" cy="86" r="1.6" fill="#d4af37" />
      <ellipse
        cx="28"
        cy="68"
        rx="8"
        ry="3"
        fill="#d4af37"
        stroke="#7a5a14"
        strokeWidth="1"
      />
      <ellipse
        cx="72"
        cy="68"
        rx="8"
        ry="3"
        fill="#d4af37"
        stroke="#7a5a14"
        strokeWidth="1"
      />
      <line x1="22" y1="67" x2="34" y2="69" stroke="#7a5a14" strokeWidth="0.6" />
      <line x1="66" y1="69" x2="78" y2="67" stroke="#7a5a14" strokeWidth="0.6" />
    </g>
  ),
};

const topCapeRed: ItemDef = {
  unlockRef: 'avatar-top-cape-red',
  slot: 'top',
  displayName: '红披风',
  narrativeHint: 'a flowing crimson cape with gold clasps',
  rarity: 'rare',
  priceCoins: 340,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-top-cape-red">
      <path
        d="M 18 70 L 22 95 L 78 95 L 82 70 Q 60 60 50 60 Q 40 60 18 70 Z"
        fill="#a82a1a"
        stroke="#5a1408"
        strokeWidth="1.4"
      />
      <path d="M 30 70 L 32 95 M 50 65 L 50 95 M 68 70 L 70 95" stroke="#5a1408" strokeWidth="0.8" opacity="0.6" />
      <circle cx="42" cy="66" r="2" fill="#d4af37" stroke="#7a5a14" strokeWidth="0.6" />
      <circle cx="58" cy="66" r="2" fill="#d4af37" stroke="#7a5a14" strokeWidth="0.6" />
    </g>
  ),
};

// ─── BACKGROUNDS (3 shop items) ──────────────────────────────────────────────

const bgSunset: ItemDef = {
  unlockRef: 'avatar-bg-sunset',
  slot: 'background',
  displayName: '日落',
  narrativeHint: 'under a glowing orange sunset sky',
  rarity: 'rare',
  priceCoins: 260,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-bg-sunset">
      <circle cx="50" cy="50" r="50" fill="#f5852a" />
      <rect x="0" y="50" width="100" height="50" fill="#7a2a3a" />
      <circle cx="50" cy="52" r="14" fill="#f5c542" opacity="0.95" />
      <path
        d="M 0 60 Q 25 56 50 60 T 100 60 L 100 65 Q 75 62 50 65 T 0 65 Z"
        fill="#a8443a"
        opacity="0.7"
      />
    </g>
  ),
};

const bgPalmIsland: ItemDef = {
  unlockRef: 'avatar-bg-palm-island',
  slot: 'background',
  displayName: '棕榈小岛',
  narrativeHint: 'on a sandy palm-tree island',
  rarity: 'rare',
  priceCoins: 400,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-bg-palm-island">
      <circle cx="50" cy="50" r="50" fill="#7ec8e3" />
      <ellipse cx="50" cy="85" rx="42" ry="12" fill="#f0c97a" />
      <path
        d="M 22 76 Q 18 56 24 50 Q 26 64 22 76 Z"
        fill="#5f7a3a"
        stroke="#2c3a14"
        strokeWidth="0.8"
      />
      <path d="M 18 50 Q 26 48 30 52" fill="#5f7a3a" stroke="#2c3a14" strokeWidth="0.6" />
      <path d="M 12 56 Q 22 54 26 56" fill="#5f7a3a" stroke="#2c3a14" strokeWidth="0.6" />
      <path d="M 18 62 Q 26 60 30 60" fill="#5f7a3a" stroke="#2c3a14" strokeWidth="0.6" />
      <path
        d="M 78 76 Q 82 56 76 50 Q 74 64 78 76 Z"
        fill="#5f7a3a"
        stroke="#2c3a14"
        strokeWidth="0.8"
      />
      <path d="M 82 50 Q 74 48 70 52" fill="#5f7a3a" stroke="#2c3a14" strokeWidth="0.6" />
      <path d="M 88 56 Q 78 54 74 56" fill="#5f7a3a" stroke="#2c3a14" strokeWidth="0.6" />
      <path d="M 82 62 Q 74 60 70 60" fill="#5f7a3a" stroke="#2c3a14" strokeWidth="0.6" />
    </g>
  ),
};

const bgTreasureCave: ItemDef = {
  unlockRef: 'avatar-bg-treasure-cave',
  slot: 'background',
  displayName: '宝藏洞窟',
  description: '金光闪闪的秘密',
  narrativeHint: 'inside a glittering treasure cave',
  rarity: 'epic',
  priceCoins: 640,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-bg-treasure-cave">
      <circle cx="50" cy="50" r="50" fill="#2a1a3a" />
      <circle cx="20" cy="20" r="1.4" fill="#f5c542" />
      <circle cx="80" cy="22" r="1.2" fill="#f5c542" />
      <circle cx="86" cy="60" r="1.6" fill="#f5c542" />
      <circle cx="14" cy="70" r="1.2" fill="#f5c542" />
      <path
        d="M 20 88 Q 50 78 80 88 L 80 100 L 20 100 Z"
        fill="#d4af37"
        stroke="#7a5a14"
        strokeWidth="0.8"
      />
      <circle cx="35" cy="86" r="2.2" fill="#f5c542" />
      <circle cx="50" cy="84" r="2.4" fill="#f5c542" />
      <circle cx="65" cy="86" r="2.2" fill="#f5c542" />
    </g>
  ),
};

const bgStarryNight: ItemDef = {
  unlockRef: 'avatar-bg-starry-night',
  slot: 'background',
  displayName: '星夜',
  narrativeHint: 'beneath a starry midnight sky',
  rarity: 'common',
  priceCoins: 200,
  theme: 'pirate',
  renderSvg: () => (
    <g key="avatar-bg-starry-night">
      <circle cx="50" cy="50" r="50" fill="#13265a" />
      <circle cx="18" cy="22" r="0.8" fill="#fff" />
      <circle cx="32" cy="14" r="1" fill="#fff" />
      <circle cx="48" cy="20" r="0.8" fill="#fff" />
      <circle cx="62" cy="12" r="1" fill="#fff" />
      <circle cx="78" cy="22" r="0.8" fill="#fff" />
      <circle cx="88" cy="40" r="1" fill="#fff" />
      <circle cx="12" cy="46" r="1" fill="#fff" />
      <circle cx="76" cy="58" r="0.8" fill="#fff" />
      <path
        d="M 70 28 L 71 31 L 74 32 L 71 33 L 70 36 L 69 33 L 66 32 L 69 31 Z"
        fill="#f5c542"
      />
      <circle cx="22" cy="72" r="4" fill="#f5e8a0" opacity="0.4" />
      <circle cx="22" cy="72" r="2.5" fill="#fffae0" />
    </g>
  ),
};

// ─── HAIR (2 shop items) ─────────────────────────────────────────────────────

const pirateHairBlackLong: ItemDef = {
  unlockRef: 'pirate-hair-black-long',
  slot: 'hair',
  displayName: '黑色长发',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'long flowing black hair',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-hair-black-long">
      <path
        d="M 28 32 Q 38 22 50 22 Q 62 22 72 32 L 74 60 Q 68 65 64 60 L 64 40 Q 50 35 36 40 L 36 60 Q 32 65 26 60 Z"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="1"
      />
    </g>
  ),
};

const pirateHairDreads: ItemDef = {
  unlockRef: 'pirate-hair-dreads-brown',
  slot: 'hair',
  displayName: '棕色脏辫',
  rarity: 'rare',
  priceCoins: 320,
  narrativeHint: 'brown dreadlocks tied with beads',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-hair-dreads-brown">
      <path
        d="M 30 34 Q 50 20 70 34 L 70 38 Q 50 30 30 38 Z"
        fill="#4a2f1a"
      />
      <rect x="32" y="38" width="3" height="22" fill="#4a2f1a" rx="1.5" />
      <rect x="48" y="38" width="3" height="24" fill="#4a2f1a" rx="1.5" />
      <rect x="65" y="38" width="3" height="22" fill="#4a2f1a" rx="1.5" />
      <circle cx="33.5" cy="62" r="2" fill="#d4a017" />
      <circle cx="49.5" cy="64" r="2" fill="#d4a017" />
      <circle cx="66.5" cy="62" r="2" fill="#d4a017" />
    </g>
  ),
};

// ─── PANTS (2 shop items) ────────────────────────────────────────────────────

const piratePantsRagged: ItemDef = {
  unlockRef: 'pirate-pants-ragged-tan',
  slot: 'pants',
  displayName: '破旧棕裤',
  rarity: 'common',
  priceCoins: 120,
  narrativeHint: 'tattered tan trousers',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-pants-ragged-tan">
      <path
        d="M 38 73 L 36 90 L 44 90 L 46 78 L 50 78 L 52 90 L 60 90 L 62 73 Z"
        fill="#a87844"
        stroke="#7a5530"
        strokeWidth="1"
      />
      <path d="M 36 90 L 38 88 L 40 90 L 42 88 L 44 90" stroke="#7a5530" strokeWidth="0.8" fill="none" />
      <path d="M 52 90 L 54 88 L 56 90 L 58 88 L 60 90" stroke="#7a5530" strokeWidth="0.8" fill="none" />
    </g>
  ),
};

const piratePantsStripeNavy: ItemDef = {
  unlockRef: 'pirate-pants-stripe-navy',
  slot: 'pants',
  displayName: '海军条纹裤',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'navy striped trousers',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-pants-stripe-navy">
      <rect x="38" y="73" width="10" height="17" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1" />
      <rect x="52" y="73" width="10" height="17" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1" />
      <line x1="42" y1="73" x2="42" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
      <line x1="46" y1="73" x2="46" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
      <line x1="56" y1="73" x2="56" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
      <line x1="60" y1="73" x2="60" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
    </g>
  ),
};

// ─── DECOR (2 shop items) ────────────────────────────────────────────────────

const decorPirateFlag: ItemDef = {
  unlockRef: 'decor-pirate-flag',
  slot: 'decor',
  displayName: '海盗旗',
  rarity: 'rare',
  priceCoins: 350,
  narrativeHint: 'with a Jolly Roger flag in the background',
  theme: 'pirate',
  renderSvg: () => (
    <g key="decor-pirate-flag">
      <line x1="82" y1="14" x2="82" y2="40" stroke="#3a2515" strokeWidth="1.5" />
      <rect x="82" y="14" width="14" height="10" fill="#1a1a1a" />
      <circle cx="89" cy="18" r="2" fill="#fff" />
      <rect x="88" y="20" width="2" height="2" fill="#fff" />
    </g>
  ),
};

const decorShipMast: ItemDef = {
  unlockRef: 'decor-ship-mast',
  slot: 'decor',
  displayName: '船桅',
  rarity: 'epic',
  priceCoins: 700,
  narrativeHint: 'with a tall ship mast and sail behind them',
  theme: 'pirate',
  renderSvg: () => (
    <g key="decor-ship-mast">
      <line x1="14" y1="8" x2="14" y2="60" stroke="#5a3a1a" strokeWidth="2" />
      <path d="M 14 12 Q 26 28 14 44 Z" fill="#f5e6c8" stroke="#a08660" strokeWidth="1" />
      <line x1="14" y1="20" x2="22" y2="22" stroke="#a08660" strokeWidth="0.7" />
      <line x1="14" y1="30" x2="22" y2="30" stroke="#a08660" strokeWidth="0.7" />
    </g>
  ),
};

// ─── CARIBBEAN THEME ─────────────────────────────────────────────────────────

const caribKidTan: ItemDef = {
  unlockRef: 'carib-kid-tan',
  slot: 'head',
  displayName: '阳光男孩',
  rarity: 'common',
  priceCoins: 100,
  narrativeHint: 'a sun-kissed island kid',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-kid-tan">
      <circle cx="50" cy="46" r="22" fill="#d4965e" stroke="#7a4a2a" strokeWidth="1.5" />
      <circle cx="42" cy="44" r="1.8" fill="#2a1a14" />
      <circle cx="58" cy="44" r="1.8" fill="#2a1a14" />
      <path d="M 43 53 Q 50 57 57 53" stroke="#7a4a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="50" r="2.5" fill="#c87850" opacity="0.6" />
      <circle cx="64" cy="50" r="2.5" fill="#c87850" opacity="0.6" />
    </g>
  ),
};

const caribStrawhat: ItemDef = {
  unlockRef: 'carib-strawhat',
  slot: 'hat',
  displayName: '草帽',
  rarity: 'common',
  priceCoins: 100,
  narrativeHint: 'a wide-brimmed straw hat',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-strawhat">
      <ellipse cx="50" cy="30" rx="26" ry="5" fill="#e2b366" stroke="#a07a30" strokeWidth="1" />
      <path d="M 36 30 Q 50 18 64 30 L 60 26 Q 50 18 40 26 Z" fill="#d4a04e" stroke="#a07a30" strokeWidth="1" />
      <path d="M 42 24 Q 50 22 58 24" stroke="#a07a30" strokeWidth="0.7" fill="none" />
    </g>
  ),
};

const caribHibiscusBand: ItemDef = {
  unlockRef: 'carib-hibiscus-band',
  slot: 'hat',
  displayName: '芙蓉发带',
  rarity: 'rare',
  priceCoins: 290,
  narrativeHint: 'a hibiscus flower hairband',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-hibiscus-band">
      <path d="M 28 32 Q 50 26 72 32 L 72 36 Q 50 30 28 36 Z" fill="#7c2d12" />
      <circle cx="68" cy="32" r="4" fill="#ec4899" />
      <circle cx="65" cy="30" r="3" fill="#f472b6" />
      <circle cx="70" cy="29" r="3" fill="#f472b6" />
      <circle cx="71" cy="33" r="3" fill="#f472b6" />
      <circle cx="68" cy="32" r="1" fill="#fde047" />
    </g>
  ),
};

const caribHairBraids: ItemDef = {
  unlockRef: 'carib-hair-braids-blonde',
  slot: 'hair',
  displayName: '金色辫子',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'sun-bleached blonde braids',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-hair-braids-blonde">
      <path d="M 30 32 Q 50 24 70 32 L 70 38 Q 50 32 30 38 Z" fill="#fde68a" stroke="#a07a30" strokeWidth="1" />
      <path d="M 30 38 L 26 60 L 30 60 Z" fill="#fde68a" />
      <path d="M 70 38 L 74 60 L 70 60 Z" fill="#fde68a" />
      <circle cx="28" cy="62" r="1.5" fill="#ec4899" />
      <circle cx="72" cy="62" r="1.5" fill="#ec4899" />
    </g>
  ),
};

const caribHairCurls: ItemDef = {
  unlockRef: 'carib-hair-curls-honey',
  slot: 'hair',
  displayName: '蜂蜜色卷发',
  rarity: 'common',
  priceCoins: 140,
  narrativeHint: 'honey-colored curls',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-hair-curls-honey">
      <path
        d="M 28 36 Q 30 26 40 24 Q 50 20 60 24 Q 70 26 72 36 Q 70 40 65 38 Q 60 36 55 38 Q 50 36 45 38 Q 40 36 35 38 Q 30 40 28 36 Z"
        fill="#f59e0b"
        stroke="#92400e"
        strokeWidth="1"
      />
    </g>
  ),
};

const caribShirtHibiscus: ItemDef = {
  unlockRef: 'carib-shirt-hibiscus',
  slot: 'top',
  displayName: '芙蓉花衬衫',
  rarity: 'rare',
  priceCoins: 320,
  narrativeHint: 'a Hawaiian shirt patterned with hibiscus flowers',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-shirt-hibiscus">
      <path d="M 32 65 L 30 78 L 40 80 L 50 78 L 60 80 L 70 78 L 68 65 Q 50 62 32 65 Z" fill="#22d3ee" stroke="#0e7490" strokeWidth="1" />
      <circle cx="38" cy="72" r="1.8" fill="#ec4899" />
      <circle cx="48" cy="74" r="1.8" fill="#ec4899" />
      <circle cx="58" cy="71" r="1.8" fill="#ec4899" />
      <circle cx="44" cy="68" r="1.2" fill="#fde047" />
      <circle cx="54" cy="69" r="1.2" fill="#fde047" />
    </g>
  ),
};

const caribTankCoral: ItemDef = {
  unlockRef: 'carib-tank-coral',
  slot: 'top',
  displayName: '珊瑚色背心',
  rarity: 'common',
  priceCoins: 130,
  narrativeHint: 'a coral-pink tank top',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-tank-coral">
      <path d="M 36 65 L 34 78 L 50 80 L 66 78 L 64 65 Q 50 62 36 65 Z" fill="#fb7185" stroke="#9f1239" strokeWidth="1" />
      <line x1="38" y1="65" x2="40" y2="60" stroke="#9f1239" strokeWidth="1.2" />
      <line x1="62" y1="65" x2="60" y2="60" stroke="#9f1239" strokeWidth="1.2" />
    </g>
  ),
};

const caribShortsAqua: ItemDef = {
  unlockRef: 'carib-shorts-aqua',
  slot: 'pants',
  displayName: '水蓝短裤',
  rarity: 'common',
  priceCoins: 110,
  narrativeHint: 'aqua-blue swim shorts',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-shorts-aqua">
      <rect x="38" y="76" width="10" height="12" rx="2" fill="#06b6d4" stroke="#0e7490" strokeWidth="1" />
      <rect x="52" y="76" width="10" height="12" rx="2" fill="#06b6d4" stroke="#0e7490" strokeWidth="1" />
      <rect x="38" y="74" width="24" height="4" fill="#0e7490" />
      <path d="M 38 80 Q 41 79 44 80" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.5" />
      <path d="M 52 80 Q 55 79 58 80" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.5" />
    </g>
  ),
};

const caribSkirtTropical: ItemDef = {
  unlockRef: 'carib-skirt-tropical',
  slot: 'pants',
  displayName: '热带花裙',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'a tropical-print wrap skirt',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-skirt-tropical">
      <path d="M 34 74 L 30 90 L 70 90 L 66 74 Z" fill="#10b981" stroke="#047857" strokeWidth="1" />
      <circle cx="38" cy="80" r="1.5" fill="#fde047" />
      <circle cx="50" cy="82" r="1.5" fill="#fde047" />
      <circle cx="62" cy="80" r="1.5" fill="#fde047" />
      <circle cx="44" cy="85" r="1.5" fill="#ec4899" />
      <circle cx="56" cy="85" r="1.5" fill="#ec4899" />
    </g>
  ),
};

const decorCaribPalm: ItemDef = {
  unlockRef: 'carib-palmtree',
  slot: 'decor',
  displayName: '棕榈树',
  rarity: 'rare',
  priceCoins: 330,
  narrativeHint: 'with a palm tree swaying in the breeze',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-palmtree">
      <path d="M 84 12 Q 82 40 80 56" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 84 12 Q 70 8 64 14 Q 72 14 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
      <path d="M 84 12 Q 98 8 96 18 Q 90 14 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
      <path d="M 84 12 Q 76 4 82 4 Q 84 8 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
      <path d="M 84 12 Q 92 4 90 4 Q 86 6 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
    </g>
  ),
};

const bgCaribSunset: ItemDef = {
  unlockRef: 'carib-beach-sunset',
  slot: 'background',
  displayName: '加勒比日落',
  rarity: 'epic',
  priceCoins: 800,
  narrativeHint: 'against a Caribbean sunset over a sandy beach',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-beach-sunset">
      <rect x="0" y="0" width="100" height="60" fill="#fb923c" />
      <rect x="0" y="40" width="100" height="20" fill="#fbbf24" opacity="0.7" />
      <circle cx="50" cy="38" r="9" fill="#fde047" />
      <rect x="0" y="60" width="100" height="6" fill="#06b6d4" />
      <rect x="0" y="66" width="100" height="34" fill="#fef3c7" />
      <path d="M 10 64 Q 14 62 18 64" stroke="#0e7490" strokeWidth="0.8" fill="none" />
      <path d="M 30 64 Q 34 62 38 64" stroke="#0e7490" strokeWidth="0.8" fill="none" />
      <path d="M 60 64 Q 64 62 68 64" stroke="#0e7490" strokeWidth="0.8" fill="none" />
    </g>
  ),
};

// ─── CATALOG ─────────────────────────────────────────────────────────────────

const ALL_ITEMS: ItemDef[] = [
  defaultHead,
  defaultBandana,
  defaultTee,
  defaultOcean,
  defaultHair,
  defaultPants,
  hatTricorn,
  hatCaptain,
  hatBandanaBlue,
  hatParrotPerch,
  hatCrownGold,
  hatSunhat,
  hatBeanie,
  hatEyepatchSkull,
  topPirateCoat,
  topVest,
  topLifejacket,
  topApronTreasure,
  topEpaulettesGold,
  topCapeRed,
  bgSunset,
  bgPalmIsland,
  bgTreasureCave,
  bgStarryNight,
  pirateHairBlackLong,
  pirateHairDreads,
  piratePantsRagged,
  piratePantsStripeNavy,
  decorPirateFlag,
  decorShipMast,
  caribKidTan,
  caribStrawhat,
  caribHibiscusBand,
  caribHairBraids,
  caribHairCurls,
  caribShirtHibiscus,
  caribTankCoral,
  caribShortsAqua,
  caribSkirtTropical,
  decorCaribPalm,
  bgCaribSunset,
];

export const ITEM_CATALOG: Record<string, ItemDef> = Object.fromEntries(
  ALL_ITEMS.map((item) => [item.unlockRef, item]),
);

/** All catalog entries — used by the seed script and for shop hydration. */
export function allItems(): ItemDef[] {
  return ALL_ITEMS;
}

/** Items that should be auto-granted (unlock_via='default') on seed. */
export function defaultItems(): ItemDef[] {
  return ALL_ITEMS.filter((i) => i.priceCoins === undefined);
}

/** Items that should appear in shop_items (unlock_via='shop'). */
export function shopItemsCatalog(): ItemDef[] {
  return ALL_ITEMS.filter((i) => i.priceCoins !== undefined);
}

export function lookupItem(unlockRef: string | null | undefined): ItemDef | undefined {
  if (!unlockRef) return undefined;
  return ITEM_CATALOG[unlockRef];
}

/**
 * Default placeholder returned by `resolveNarrativeHint` when the id is
 * unknown, null, or undefined. Story-mode AI uses this as a safe fallback so
 * the appearance line never breaks on legacy or deleted items.
 */
export const DEFAULT_NARRATIVE_HINT = 'a pirate kid';

/**
 * Returns a short English noun phrase describing how `unlockRef` looks on the
 * hero, suitable for inclusion in a story-mode appearance line. Falls back to
 * {@link DEFAULT_NARRATIVE_HINT} for unknown / null / undefined ids.
 */
export function resolveNarrativeHint(
  unlockRef: string | null | undefined,
): string {
  if (!unlockRef) return DEFAULT_NARRATIVE_HINT;
  const item = ITEM_CATALOG[unlockRef];
  return item?.narrativeHint ?? DEFAULT_NARRATIVE_HINT;
}
