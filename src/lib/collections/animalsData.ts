/** 动物 / Animals collectible pack (`animals-v1`). Flat. DELIBERATELY excludes
 *  the 12 zodiac animals (those live in zodiac-v1); pet + woodland + zoo. */
export interface AnimalItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const ANIMALS: AnimalItem[] = [
  { slug: 'cat', nameZh: '猫', nameEn: 'Cat', emoji: '🐱', loreZh: '喵喵叫，爱睡觉。', loreEn: 'Goes meow and loves to nap.' },
  { slug: 'duck', nameZh: '鸭子', nameEn: 'Duck', emoji: '🦆', loreZh: '嘎嘎叫，会游泳。', loreEn: 'Quacks and loves to swim.' },
  { slug: 'goose', nameZh: '鹅', nameEn: 'Goose', emoji: '🪿', loreZh: '脖子长长的大白鸟。', loreEn: 'A big white bird with a long neck.' },
  { slug: 'hamster', nameZh: '仓鼠', nameEn: 'Hamster', emoji: '🐹', loreZh: '把食物塞进腮帮子。', loreEn: 'Stuffs food into its cheeks.' },
  { slug: 'goldfish', nameZh: '金鱼', nameEn: 'Goldfish', emoji: '🐠', loreZh: '在鱼缸里游来游去。', loreEn: 'Swims round the fish tank.' },
  { slug: 'tortoise', nameZh: '乌龟', nameEn: 'Tortoise', emoji: '🐢', loreZh: '慢吞吞，背着硬壳。', loreEn: 'Slow and steady with a hard shell.' },
  { slug: 'parrot', nameZh: '鹦鹉', nameEn: 'Parrot', emoji: '🦜', loreZh: '会学人说话。', loreEn: 'Can copy what people say.' },
  { slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', emoji: '🦊', loreZh: '尾巴大大的，很机灵。', loreEn: 'Bushy tail and very clever.' },
  { slug: 'squirrel', nameZh: '松鼠', nameEn: 'Squirrel', emoji: '🐿️', loreZh: '爱吃坚果，会爬树。', loreEn: 'Loves nuts and climbs trees.' },
  { slug: 'hedgehog', nameZh: '刺猬', nameEn: 'Hedgehog', emoji: '🦔', loreZh: '身上长满小刺。', loreEn: 'Covered in little spikes.' },
  { slug: 'owl', nameZh: '猫头鹰', nameEn: 'Owl', emoji: '🦉', loreZh: '晚上睁大眼睛。', loreEn: 'Big eyes wide open at night.' },
  { slug: 'bear', nameZh: '熊', nameEn: 'Bear', emoji: '🐻', loreZh: '大大的，爱吃蜂蜜。', loreEn: 'Big and loves honey.' },
  { slug: 'panda', nameZh: '熊猫', nameEn: 'Panda', emoji: '🐼', loreZh: '黑白相间，爱吃竹子。', loreEn: 'Black and white, eats bamboo.' },
  { slug: 'elephant', nameZh: '大象', nameEn: 'Elephant', emoji: '🐘', loreZh: '长鼻子像水管。', loreEn: 'A long trunk like a hose.' },
  { slug: 'lion', nameZh: '狮子', nameEn: 'Lion', emoji: '🦁', loreZh: '草原上的大王。', loreEn: 'King of the grassland.' },
  { slug: 'giraffe', nameZh: '长颈鹿', nameEn: 'Giraffe', emoji: '🦒', loreZh: '脖子最长，吃高高的树叶。', loreEn: 'Longest neck — eats high leaves.' },
  { slug: 'penguin', nameZh: '企鹅', nameEn: 'Penguin', emoji: '🐧', loreZh: '走路摇摇摆摆。', loreEn: 'Waddles when it walks.' },
];

export const ANIMALS_BY_SLUG: Record<string, AnimalItem> = Object.fromEntries(
  ANIMALS.map((a) => [a.slug, a]),
);
