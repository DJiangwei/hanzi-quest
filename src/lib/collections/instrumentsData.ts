/** 乐器 / Instruments collectible pack (`instruments-v1`). Grouped 西洋/民族. */
export type InstrumentGroup = 'western' | 'chinese';

export interface InstrumentItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  group: InstrumentGroup;
  loreZh: string;
  loreEn: string;
}

export const INSTRUMENT_GROUP_ORDER: InstrumentGroup[] = ['western', 'chinese'];
export const INSTRUMENT_GROUP_LABELS: Record<InstrumentGroup, { zh: string; en: string; emoji: string }> = {
  western: { zh: '西洋乐器', en: 'Western', emoji: '🎹' },
  chinese: { zh: '民族乐器', en: 'Chinese', emoji: '🪕' },
};

export const INSTRUMENTS: InstrumentItem[] = [
  { slug: 'piano', nameZh: '钢琴', nameEn: 'Piano', emoji: '🎹', group: 'western', loreZh: '黑白琴键弹出乐曲。', loreEn: 'Black and white keys make a tune.' },
  { slug: 'violin', nameZh: '小提琴', nameEn: 'Violin', emoji: '🎻', group: 'western', loreZh: '用弓拉出优美的声音。', loreEn: 'A bow draws out a lovely sound.' },
  { slug: 'guitar', nameZh: '吉他', nameEn: 'Guitar', emoji: '🎸', group: 'western', loreZh: '拨动琴弦弹歌。', loreEn: 'Pluck the strings to play a song.' },
  { slug: 'drum', nameZh: '鼓', nameEn: 'Drum', emoji: '🥁', group: 'western', loreZh: '咚咚咚地敲。', loreEn: 'Boom, boom, boom!' },
  { slug: 'flute', nameZh: '长笛', nameEn: 'Flute', emoji: '🪈', group: 'western', loreZh: '吹气就有清脆的声音。', loreEn: 'Blow gently for a clear note.' },
  { slug: 'trumpet', nameZh: '小号', nameEn: 'Trumpet', emoji: '🎺', group: 'western', loreZh: '金光闪闪，声音响亮。', loreEn: 'Shiny gold and very loud.' },
  { slug: 'saxophone', nameZh: '萨克斯', nameEn: 'Saxophone', emoji: '🎷', group: 'western', loreZh: '弯弯的，声音温暖。', loreEn: 'Curvy, with a warm sound.' },
  { slug: 'xylophone', nameZh: '木琴', nameEn: 'Xylophone', emoji: '🎼', group: 'western', loreZh: '敲木条发出叮叮声。', loreEn: 'Tap the bars for a ding-ding.' },
  { slug: 'erhu', nameZh: '二胡', nameEn: 'Erhu', emoji: '🎻', group: 'chinese', loreZh: '两根弦的中国乐器。', loreEn: 'A Chinese fiddle with two strings.' },
  { slug: 'pipa', nameZh: '琵琶', nameEn: 'Pipa', emoji: '🪕', group: 'chinese', loreZh: '抱在怀里弹的古乐器。', loreEn: 'An ancient lute held in your arms.' },
  { slug: 'guzheng', nameZh: '古筝', nameEn: 'Guzheng', emoji: '🎵', group: 'chinese', loreZh: '很多弦，声音像流水。', loreEn: 'Many strings that sound like water.' },
  { slug: 'dizi', nameZh: '笛子', nameEn: 'Bamboo flute', emoji: '🪈', group: 'chinese', loreZh: '用竹子做的笛子。', loreEn: 'A flute made of bamboo.' },
  { slug: 'gong', nameZh: '锣', nameEn: 'Gong', emoji: '🥁', group: 'chinese', loreZh: '一敲就当当响。', loreEn: 'One strike rings out loud.' },
];

export const INSTRUMENTS_BY_SLUG: Record<string, InstrumentItem> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.slug, i]),
);
