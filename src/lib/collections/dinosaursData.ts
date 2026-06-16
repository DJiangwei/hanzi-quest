/**
 * Source of truth for the 恐龙世界 / Dinosaurs collection pack.
 *
 * Kids are English-native (UK heritage learner) — every field that the kid
 * sees is bilingual. Era is rendered alongside the dinosaur name; lore is one
 * short kid-friendly fact per species. Emoji glyphs are stored in
 * `collectible_items.image_url` at seed time; the renderer uses them as plain
 * text glyphs (no `<img>`).
 *
 * Visual differentiation note: only two dinosaur emojis exist (🦖 / 🦕), so
 * `DinosaurCard` color-codes the card by `era` and renders a small era badge.
 * That gives kids a quick way to tell cards apart at a glance.
 */

export type DinosaurRarity = 'common' | 'rare' | 'epic';

export type DinosaurEra = 'triassic' | 'jurassic' | 'cretaceous';

export const ERA_LABELS: Record<DinosaurEra, { zh: string; en: string }> = {
  triassic: { zh: '三叠纪', en: 'Triassic' },
  jurassic: { zh: '侏罗纪', en: 'Jurassic' },
  cretaceous: { zh: '白垩纪', en: 'Cretaceous' },
};

export interface DinosaurItem {
  slug: string;
  emoji: '🦖' | '🦕';
  nameZh: string;
  nameEn: string;
  era: DinosaurEra;
  loreZh: string;
  loreEn: string;
  rarity: DinosaurRarity;
  dropWeight: number;
}

export const DINOSAURS: DinosaurItem[] = [
  {
    slug: 't-rex',
    emoji: '🦖',
    nameZh: '霸王龙',
    nameEn: 'T-Rex',
    era: 'cretaceous',
    loreZh: '巨大的牙齿，小小的前爪。',
    loreEn: 'Massive teeth and tiny little arms.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'triceratops',
    emoji: '🦕',
    nameZh: '三角龙',
    nameEn: 'Triceratops',
    era: 'cretaceous',
    loreZh: '脸上长着三只角的草食恐龙。',
    loreEn: 'Three horns and a giant frilled head.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'stegosaurus',
    emoji: '🦕',
    nameZh: '剑龙',
    nameEn: 'Stegosaurus',
    era: 'jurassic',
    loreZh: '背上排着一排骨板。',
    loreEn: 'A row of bony plates down its back.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'brachiosaurus',
    emoji: '🦕',
    nameZh: '腕龙',
    nameEn: 'Brachiosaurus',
    era: 'jurassic',
    loreZh: '脖子像长颈鹿一样长。',
    loreEn: 'Neck as tall as a four-story building.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'velociraptor',
    emoji: '🦖',
    nameZh: '迅猛龙',
    nameEn: 'Velociraptor',
    era: 'cretaceous',
    loreZh: '跑得超快的小猎手。',
    loreEn: 'A speedy hunter the size of a turkey.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'pterodactyl',
    emoji: '🦖',
    nameZh: '翼龙',
    nameEn: 'Pterodactyl',
    era: 'jurassic',
    loreZh: '能飞的翅膀爬虫。',
    loreEn: 'A flying reptile with leathery wings.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'diplodocus',
    emoji: '🦕',
    nameZh: '梁龙',
    nameEn: 'Diplodocus',
    era: 'jurassic',
    loreZh: '尾巴可以像鞭子一样甩。',
    loreEn: 'Tail it could crack like a giant whip.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'ankylosaurus',
    emoji: '🦕',
    nameZh: '甲龙',
    nameEn: 'Ankylosaurus',
    era: 'cretaceous',
    loreZh: '全身有铠甲，尾巴像锤子。',
    loreEn: 'Armoured body with a club-tail.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'spinosaurus',
    emoji: '🦖',
    nameZh: '棘龙',
    nameEn: 'Spinosaurus',
    era: 'cretaceous',
    loreZh: '背上有像帆一样的鳍。',
    loreEn: 'A sail of spines along its back.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'allosaurus',
    emoji: '🦖',
    nameZh: '异特龙',
    nameEn: 'Allosaurus',
    era: 'jurassic',
    loreZh: '侏罗纪最厉害的猎人。',
    loreEn: 'Top hunter of the Jurassic world.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'parasaurolophus',
    emoji: '🦕',
    nameZh: '副栉龙',
    nameEn: 'Parasaurolophus',
    era: 'cretaceous',
    loreZh: '头顶有一根能发声的管子。',
    loreEn: 'A head-crest that could trumpet calls.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'iguanodon',
    emoji: '🦕',
    nameZh: '禽龙',
    nameEn: 'Iguanodon',
    era: 'cretaceous',
    loreZh: '大拇指上有尖刺。',
    loreEn: 'Had a spiky thumb for defence.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'plesiosaurus',
    emoji: '🦕',
    nameZh: '蛇颈龙',
    nameEn: 'Plesiosaurus',
    era: 'jurassic',
    loreZh: '海里游泳的长脖子爬虫。',
    loreEn: 'A long-necked swimmer in the seas.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'argentinosaurus',
    emoji: '🦕',
    nameZh: '阿根廷龙',
    nameEn: 'Argentinosaurus',
    era: 'cretaceous',
    loreZh: '可能是有史以来最大的恐龙。',
    loreEn: 'Maybe the biggest dinosaur ever to walk.',
    rarity: 'epic',
    dropWeight: 1,
  },
  {
    slug: 'giganotosaurus',
    emoji: '🦖',
    nameZh: '南方巨兽龙',
    nameEn: 'Giganotosaurus',
    era: 'cretaceous',
    loreZh: '比霸王龙还要大的超级猎手。',
    loreEn: 'A super-predator even bigger than T-Rex.',
    rarity: 'epic',
    dropWeight: 1,
  },
];

export const DINOSAURS_BY_SLUG: Record<string, DinosaurItem> =
  Object.fromEntries(DINOSAURS.map((d) => [d.slug, d]));
