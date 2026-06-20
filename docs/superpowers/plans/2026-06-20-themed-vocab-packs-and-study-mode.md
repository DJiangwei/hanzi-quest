# Themed Vocab Packs + Study Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 KS1-aligned collectible packs (Transport / Minibeasts / Instruments / Animals) and a Study Mode that turns any pack's owned cards into a short picture+audio+meaning lesson that rewards 1 card/pack/day.

**Architecture:** Part A reuses the established pack recipe (data file → card component → `PACK_REGISTRY` entry → seed → CF-flux art) with a shared `makeVocabCard` factory and one seed script for all 4 packs. Part B is a standalone lesson runner (no `week_levels` compile) mirroring `HomeworkRunner`/`finishHomeworkAction`: a pure server-side `buildStudyLesson`, a new `'study'` card-grant source with pack-scoped pulls + a per-`(pack,day)` idempotency refId, and a `StudyRunner` driving the existing `MultipleChoiceQuiz`.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle/Neon Postgres, Vitest + RTL + jsdom, Tailwind, Cloudflare flux-1-schnell, Vercel Blob.

**Four-green gate (run before every PR):** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

**Branch:** `feat/themed-vocab-packs` (already exists, spec committed). Part A and Part B are separate PRs off this branch's lineage; Part A merges first.

---

## File Structure

**Part A — Packs**
- Create `src/lib/collections/transportData.ts` — Transport items + `TRANSPORT_BY_SLUG` + group consts.
- Create `src/lib/collections/minibeastsData.ts` — Minibeast items + `MINIBEASTS_BY_SLUG`.
- Create `src/lib/collections/instrumentsData.ts` — Instrument items + `INSTRUMENTS_BY_SLUG` + group consts.
- Create `src/lib/collections/animalsData.ts` — Animal items + `ANIMALS_BY_SLUG`.
- Create `src/components/play/items/VocabCard.tsx` — `makeVocabCard()` factory (generic card; optional group badge), mirrors `LandmarkCard`.
- Create `src/components/play/items/TransportCard.tsx` / `MinibeastCard.tsx` / `InstrumentCard.tsx` / `AnimalCard.tsx` — 3-line factory wrappers.
- Modify `src/lib/collections/packRegistry.ts` — 4 `PACK_REGISTRY` entries.
- Create `scripts/seed-vocab-packs.ts` — idempotent seed of all 4 packs (`gacha_eligible=true`).
- Modify `scripts/generate-collectible-art-cloudflare.ts` — add 4 slugs + `buildPrompt` cases + subject maps.
- Tests: `tests/unit/vocab-packs-data.test.ts`, `tests/unit/components/play/items/VocabCard.test.tsx`, extend `tests/unit/pack-registry.test.ts` (or create if absent).

**Part B — Study Mode**
- Create `src/lib/play/study.ts` — PURE (no db import): `StudyCardLite`/`StudyQuestion` types, `STUDY_*` constants, `buildStudyLesson()`.
- Modify `src/lib/db/grants.ts` — `pullCardInTx` source union `+ 'study'` + optional `packSlug` catalog scoping.
- Modify `src/lib/play/card-grants.ts` — `CardGrantSource + 'study'`; `pullCardForChild` optional `packSlug` passthrough.
- Create `src/lib/actions/study.ts` — `finishStudyLessonAction`.
- Create `src/components/play/StudyRunner.tsx` — lesson runner.
- Create `src/app/play/[childId]/collection/[packSlug]/study/page.tsx` — server route.
- Modify `src/components/play/PackPageBody.tsx` — 📖 学习 button + ≥3 gate.
- Tests: `tests/unit/build-study-lesson.test.ts`, `tests/unit/actions/study.test.ts`, `tests/unit/components/play/StudyRunner.test.tsx`, extend `tests/unit/distribution-isolation-guard.test.ts`.

---

# PART A — The 4 packs (PR 1)

### Task A1: Transport data file

**Files:**
- Create: `src/lib/collections/transportData.ts`
- Test: `tests/unit/vocab-packs-data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/vocab-packs-data.test.ts
import { describe, expect, it } from 'vitest';
import { TRANSPORT, TRANSPORT_BY_SLUG, TRANSPORT_GROUP_ORDER } from '@/lib/collections/transportData';

describe('transport data', () => {
  it('has 14 items, all bilingual + emoji + valid group, unique slugs', () => {
    expect(TRANSPORT).toHaveLength(14);
    const slugs = new Set<string>();
    for (const t of TRANSPORT) {
      expect(t.nameZh).toBeTruthy();
      expect(t.nameEn).toBeTruthy();
      expect(t.emoji).toBeTruthy();
      expect(TRANSPORT_GROUP_ORDER).toContain(t.group);
      expect(slugs.has(t.slug)).toBe(false);
      slugs.add(t.slug);
    }
  });
  it('BY_SLUG resolves', () => {
    expect(TRANSPORT_BY_SLUG['fire-engine']?.nameZh).toBe('消防车');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: FAIL — cannot find module `transportData`.

- [ ] **Step 3: Implement**

```ts
// src/lib/collections/transportData.ts
/** 交通工具 / Transport collectible pack (`transport-v1`). Bilingual; grouped
 *  陆地/水上/天空. Emoji is the CardArt fallback; real flux art lives in image_url. */
export type TransportGroup = 'land' | 'water' | 'air';

export interface TransportItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  group: TransportGroup;
  loreZh: string;
  loreEn: string;
}

export const TRANSPORT_GROUP_ORDER: TransportGroup[] = ['land', 'water', 'air'];
export const TRANSPORT_GROUP_LABELS: Record<TransportGroup, { zh: string; en: string; emoji: string }> = {
  land: { zh: '陆地', en: 'Land', emoji: '🛣️' },
  water: { zh: '水上', en: 'Water', emoji: '🌊' },
  air: { zh: '天空', en: 'Air', emoji: '☁️' },
};

export const TRANSPORT: TransportItem[] = [
  { slug: 'car', nameZh: '汽车', nameEn: 'Car', emoji: '🚗', group: 'land', loreZh: '四个轮子，带我们去任何地方。', loreEn: 'Four wheels that take us anywhere.' },
  { slug: 'bus', nameZh: '公共汽车', nameEn: 'Bus', emoji: '🚌', group: 'land', loreZh: '一次能载很多人。', loreEn: 'Carries lots of people at once.' },
  { slug: 'train', nameZh: '火车', nameEn: 'Train', emoji: '🚆', group: 'land', loreZh: '在铁轨上轰隆隆地跑。', loreEn: 'Rumbles along on rails.' },
  { slug: 'bicycle', nameZh: '自行车', nameEn: 'Bicycle', emoji: '🚲', group: 'land', loreZh: '踩起脚踏板就能前进。', loreEn: 'Pedal and away you go.' },
  { slug: 'motorbike', nameZh: '摩托车', nameEn: 'Motorbike', emoji: '🏍️', group: 'land', loreZh: '两个轮子，跑得飞快。', loreEn: 'Two wheels and very fast.' },
  { slug: 'fire-engine', nameZh: '消防车', nameEn: 'Fire engine', emoji: '🚒', group: 'land', loreZh: '红色的车，去救火！', loreEn: 'The red truck that fights fires!' },
  { slug: 'ambulance', nameZh: '救护车', nameEn: 'Ambulance', emoji: '🚑', group: 'land', loreZh: '快快送病人去医院。', loreEn: 'Rushes people to hospital.' },
  { slug: 'police-car', nameZh: '警车', nameEn: 'Police car', emoji: '🚓', group: 'land', loreZh: '警察叔叔开的车。', loreEn: 'The car the police drive.' },
  { slug: 'truck', nameZh: '卡车', nameEn: 'Truck', emoji: '🚚', group: 'land', loreZh: '运送很重的东西。', loreEn: 'Carries heavy loads.' },
  { slug: 'ship', nameZh: '轮船', nameEn: 'Ship', emoji: '🚢', group: 'water', loreZh: '在大海上航行。', loreEn: 'Sails across the sea.' },
  { slug: 'sailboat', nameZh: '帆船', nameEn: 'Sailboat', emoji: '⛵', group: 'water', loreZh: '靠风吹着帆前进。', loreEn: 'The wind pushes its sail.' },
  { slug: 'airplane', nameZh: '飞机', nameEn: 'Airplane', emoji: '✈️', group: 'air', loreZh: '在云朵上面飞。', loreEn: 'Flies above the clouds.' },
  { slug: 'helicopter', nameZh: '直升机', nameEn: 'Helicopter', emoji: '🚁', group: 'air', loreZh: '头顶的螺旋桨转呀转。', loreEn: 'Its top blades spin round and round.' },
  { slug: 'hot-air-balloon', nameZh: '热气球', nameEn: 'Hot-air balloon', emoji: '🎈', group: 'air', loreZh: '热空气让它飘起来。', loreEn: 'Hot air lifts it into the sky.' },
];

export const TRANSPORT_BY_SLUG: Record<string, TransportItem> = Object.fromEntries(
  TRANSPORT.map((t) => [t.slug, t]),
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: PASS (transport describe block).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/transportData.ts tests/unit/vocab-packs-data.test.ts
git commit -m "feat(packs): transport collectible data"
```

---

### Task A2: Minibeasts data file

**Files:**
- Create: `src/lib/collections/minibeastsData.ts`
- Test: `tests/unit/vocab-packs-data.test.ts` (add a describe block)

- [ ] **Step 1: Add the failing test**

```ts
// append to tests/unit/vocab-packs-data.test.ts
import { MINIBEASTS, MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';

describe('minibeasts data', () => {
  it('has 12 bilingual items with emoji + unique slugs', () => {
    expect(MINIBEASTS).toHaveLength(12);
    const slugs = new Set<string>();
    for (const m of MINIBEASTS) {
      expect(m.nameZh && m.nameEn && m.emoji).toBeTruthy();
      expect(slugs.has(m.slug)).toBe(false);
      slugs.add(m.slug);
    }
    expect(MINIBEASTS_BY_SLUG['ladybird']?.nameZh).toBe('瓢虫');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: FAIL — cannot find module `minibeastsData`.

- [ ] **Step 3: Implement**

```ts
// src/lib/collections/minibeastsData.ts
/** 昆虫 / Minibeasts collectible pack (`minibeasts-v1`). Flat (no grouping). */
export interface MinibeastItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const MINIBEASTS: MinibeastItem[] = [
  { slug: 'butterfly', nameZh: '蝴蝶', nameEn: 'Butterfly', emoji: '🦋', loreZh: '翅膀五颜六色，飞来飞去。', loreEn: 'Colourful wings that flutter about.' },
  { slug: 'bee', nameZh: '蜜蜂', nameEn: 'Bee', emoji: '🐝', loreZh: '采花蜜，会嗡嗡叫。', loreEn: 'Buzzes around collecting nectar.' },
  { slug: 'ladybird', nameZh: '瓢虫', nameEn: 'Ladybird', emoji: '🐞', loreZh: '红背上有黑点点。', loreEn: 'Red back with little black spots.' },
  { slug: 'ant', nameZh: '蚂蚁', nameEn: 'Ant', emoji: '🐜', loreZh: '小小的力气却很大。', loreEn: 'Tiny but very strong.' },
  { slug: 'spider', nameZh: '蜘蛛', nameEn: 'Spider', emoji: '🕷️', loreZh: '会织一张大网。', loreEn: 'Spins a big web.' },
  { slug: 'snail', nameZh: '蜗牛', nameEn: 'Snail', emoji: '🐌', loreZh: '背着小房子慢慢爬。', loreEn: 'Carries its house and moves slowly.' },
  { slug: 'caterpillar', nameZh: '毛毛虫', nameEn: 'Caterpillar', emoji: '🐛', loreZh: '长大后变成蝴蝶。', loreEn: 'Grows up into a butterfly.' },
  { slug: 'dragonfly', nameZh: '蜻蜓', nameEn: 'Dragonfly', emoji: '🪰', loreZh: '在水边飞得很快。', loreEn: 'Zips fast by the water.' },
  { slug: 'grasshopper', nameZh: '蚱蜢', nameEn: 'Grasshopper', emoji: '🦗', loreZh: '后腿一蹬跳得老高。', loreEn: 'Springs high on strong back legs.' },
  { slug: 'beetle', nameZh: '甲虫', nameEn: 'Beetle', emoji: '🪲', loreZh: '硬硬的外壳像盔甲。', loreEn: 'A hard shell like armour.' },
  { slug: 'earthworm', nameZh: '蚯蚓', nameEn: 'Earthworm', emoji: '🪱', loreZh: '在泥土里钻来钻去。', loreEn: 'Wriggles through the soil.' },
  { slug: 'woodlouse', nameZh: '鼠妇', nameEn: 'Woodlouse', emoji: '🪨', loreZh: '一碰就缩成小球。', loreEn: 'Curls into a ball when touched.' },
];

export const MINIBEASTS_BY_SLUG: Record<string, MinibeastItem> = Object.fromEntries(
  MINIBEASTS.map((m) => [m.slug, m]),
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/minibeastsData.ts tests/unit/vocab-packs-data.test.ts
git commit -m "feat(packs): minibeasts collectible data"
```

---

### Task A3: Instruments data file

**Files:**
- Create: `src/lib/collections/instrumentsData.ts`
- Test: `tests/unit/vocab-packs-data.test.ts` (add a describe block)

- [ ] **Step 1: Add the failing test**

```ts
// append to tests/unit/vocab-packs-data.test.ts
import { INSTRUMENTS, INSTRUMENTS_BY_SLUG, INSTRUMENT_GROUP_ORDER } from '@/lib/collections/instrumentsData';

describe('instruments data', () => {
  it('has 13 bilingual items with valid group + unique slugs', () => {
    expect(INSTRUMENTS).toHaveLength(13);
    const slugs = new Set<string>();
    for (const i of INSTRUMENTS) {
      expect(i.nameZh && i.nameEn && i.emoji).toBeTruthy();
      expect(INSTRUMENT_GROUP_ORDER).toContain(i.group);
      expect(slugs.has(i.slug)).toBe(false);
      slugs.add(i.slug);
    }
    expect(INSTRUMENTS_BY_SLUG['erhu']?.group).toBe('chinese');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: FAIL — cannot find module `instrumentsData`.

- [ ] **Step 3: Implement**

```ts
// src/lib/collections/instrumentsData.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/instrumentsData.ts tests/unit/vocab-packs-data.test.ts
git commit -m "feat(packs): instruments collectible data"
```

---

### Task A4: Animals data file

**Files:**
- Create: `src/lib/collections/animalsData.ts`
- Test: `tests/unit/vocab-packs-data.test.ts` (add a describe block)

- [ ] **Step 1: Add the failing test**

```ts
// append to tests/unit/vocab-packs-data.test.ts
import { ANIMALS, ANIMALS_BY_SLUG } from '@/lib/collections/animalsData';

const ZODIAC_ZH = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

describe('animals data', () => {
  it('has 17 bilingual items, unique slugs, and excludes all 12 zodiac animals', () => {
    expect(ANIMALS).toHaveLength(17);
    const slugs = new Set<string>();
    for (const a of ANIMALS) {
      expect(a.nameZh && a.nameEn && a.emoji).toBeTruthy();
      expect(ZODIAC_ZH).not.toContain(a.nameZh); // no 狗/马/牛/猪/兔/鸡/羊/鼠/虎/蛇/龙/猴
      expect(slugs.has(a.slug)).toBe(false);
      slugs.add(a.slug);
    }
    expect(ANIMALS_BY_SLUG['fox']?.nameZh).toBe('狐狸');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: FAIL — cannot find module `animalsData`.

- [ ] **Step 3: Implement**

```ts
// src/lib/collections/animalsData.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: PASS (all 4 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/animalsData.ts tests/unit/vocab-packs-data.test.ts
git commit -m "feat(packs): animals collectible data (zodiac-free)"
```

---

### Task A5: `makeVocabCard` factory + 4 wrappers

**Files:**
- Create: `src/components/play/items/VocabCard.tsx`
- Create: `src/components/play/items/TransportCard.tsx`, `MinibeastCard.tsx`, `InstrumentCard.tsx`, `AnimalCard.tsx`
- Test: `tests/unit/components/play/items/VocabCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/play/items/VocabCard.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransportCard } from '@/components/play/items/TransportCard';
import { AnimalCard } from '@/components/play/items/AnimalCard';
import type { CollectibleItem } from '@/lib/db/collections';

function item(slug: string, nameZh: string, nameEn: string): CollectibleItem {
  return { id: `id-${slug}`, packId: 'p', slug, nameZh, nameEn, loreZh: null, loreEn: null, rarity: 'common', dropWeight: 1, imageUrl: null, createdAt: new Date() };
}

describe('VocabCard factory', () => {
  it('renders bilingual name + a group badge when grouped (transport)', () => {
    render(<TransportCard item={item('car', '汽车', 'Car')} owned size="md" />);
    expect(screen.getByText('汽车')).toBeInTheDocument();
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('陆地')).toBeInTheDocument(); // land group badge
  });
  it('renders no group badge for a flat pack (animals)', () => {
    render(<AnimalCard item={item('fox', '狐狸', 'Fox')} owned size="md" />);
    expect(screen.getByText('狐狸')).toBeInTheDocument();
    expect(screen.queryByText('陆地')).not.toBeInTheDocument();
  });
  it('shows a lock on unowned', () => {
    render(<AnimalCard item={item('fox', '狐狸', 'Fox')} owned={false} size="md" />);
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/components/play/items/VocabCard.test.tsx`
Expected: FAIL — cannot find module `TransportCard`.

- [ ] **Step 3: Implement the factory**

```tsx
// src/components/play/items/VocabCard.tsx
import type { CollectibleItem } from '@/lib/db/collections';
import { CardArt } from './CardArt';

interface VocabMetaEntry {
  nameZh: string;
  nameEn: string;
  emoji: string;
  group?: string;
}

interface GroupLabel {
  zh: string;
  en: string;
  emoji: string;
}

export interface VocabCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<VocabCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};

/**
 * Factory producing a per-pack collectible card. Mirrors LandmarkCard: emoji /
 * real art via CardArt, bilingual name, an optional group badge (陆地/水上/天空,
 * 西洋/民族…), and a bilingual lore line at lg+owned. Keeps all 4 vocab packs
 * DRY — each pack file is a 3-line factory call.
 */
export function makeVocabCard(opts: {
  bySlug: Record<string, VocabMetaEntry>;
  fallbackEmoji: string;
  groupLabels?: Record<string, GroupLabel>;
  testId: string;
}) {
  return function VocabCard({ item, owned, size = 'md', compact = false }: VocabCardProps) {
    const meta = opts.bySlug[item.slug];
    const emoji = meta?.emoji ?? opts.fallbackEmoji;
    const groupLabel = meta?.group && opts.groupLabels ? opts.groupLabels[meta.group] : null;
    return (
      <div
        data-testid={opts.testId}
        data-owned={owned ? 'true' : 'false'}
        data-size={size}
        className={[
          'relative flex flex-col items-center rounded-xl border-2',
          sizeClasses[size],
          owned
            ? 'border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.3),0_2px_4px_rgba(0,0,0,0.08)]'
            : 'border-stone-300 bg-stone-100',
        ].join(' ')}
      >
        <CardArt imageUrl={item.imageUrl} emoji={emoji} owned={owned} size={size} alt={meta?.nameEn ?? item.nameEn} />
        <div className={['mt-0.5 flex flex-col items-center gap-0', owned ? 'text-stone-900' : 'text-stone-500'].join(' ')}>
          <div className={['font-hanzi font-bold leading-tight', size === 'sm' ? 'text-[12px]' : size === 'md' ? 'text-sm' : 'text-xl'].join(' ')}>
            {item.nameZh}
          </div>
          <div className={['leading-tight', size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-[11px]' : 'text-sm'].join(' ')}>
            {item.nameEn}
          </div>
        </div>

        {!compact && groupLabel && (
          <div className={['mt-1 flex items-center gap-1 rounded-full px-2 py-0.5', size === 'lg' ? 'text-xs' : 'text-[9px]', owned ? 'bg-amber-200 text-amber-900' : 'bg-stone-200 text-stone-500'].join(' ')}>
            <span aria-hidden="true">{groupLabel.emoji}</span>
            <span className="font-hanzi">{groupLabel.zh}</span>
            <span aria-hidden="true">·</span>
            <span>{groupLabel.en}</span>
          </div>
        )}

        {size === 'lg' && owned && item.loreZh && (
          <p className="mt-2 max-w-xs px-2 text-center text-sm leading-relaxed text-stone-800">
            <span className="block font-hanzi">{item.loreZh}</span>
            <span className="block text-xs italic text-stone-600">{item.loreEn}</span>
          </p>
        )}

        {!owned && (
          <span className="absolute right-1 top-1 text-sm" aria-hidden="true">🔒</span>
        )}
      </div>
    );
  };
}
```

- [ ] **Step 4: Implement the 4 wrappers**

```tsx
// src/components/play/items/TransportCard.tsx
import { makeVocabCard } from './VocabCard';
import { TRANSPORT_BY_SLUG, TRANSPORT_GROUP_LABELS } from '@/lib/collections/transportData';
export const TransportCard = makeVocabCard({ bySlug: TRANSPORT_BY_SLUG, fallbackEmoji: '🚗', groupLabels: TRANSPORT_GROUP_LABELS, testId: 'transport-card' });
```

```tsx
// src/components/play/items/MinibeastCard.tsx
import { makeVocabCard } from './VocabCard';
import { MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';
export const MinibeastCard = makeVocabCard({ bySlug: MINIBEASTS_BY_SLUG, fallbackEmoji: '🐛', testId: 'minibeast-card' });
```

```tsx
// src/components/play/items/InstrumentCard.tsx
import { makeVocabCard } from './VocabCard';
import { INSTRUMENTS_BY_SLUG, INSTRUMENT_GROUP_LABELS } from '@/lib/collections/instrumentsData';
export const InstrumentCard = makeVocabCard({ bySlug: INSTRUMENTS_BY_SLUG, fallbackEmoji: '🎵', groupLabels: INSTRUMENT_GROUP_LABELS, testId: 'instrument-card' });
```

```tsx
// src/components/play/items/AnimalCard.tsx
import { makeVocabCard } from './VocabCard';
import { ANIMALS_BY_SLUG } from '@/lib/collections/animalsData';
export const AnimalCard = makeVocabCard({ bySlug: ANIMALS_BY_SLUG, fallbackEmoji: '🐾', testId: 'animal-card' });
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run tests/unit/components/play/items/VocabCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/items/VocabCard.tsx src/components/play/items/TransportCard.tsx src/components/play/items/MinibeastCard.tsx src/components/play/items/InstrumentCard.tsx src/components/play/items/AnimalCard.tsx tests/unit/components/play/items/VocabCard.test.tsx
git commit -m "feat(packs): shared makeVocabCard factory + 4 pack cards"
```

---

### Task A6: Register the 4 packs

**Files:**
- Modify: `src/lib/collections/packRegistry.ts`
- Test: `tests/unit/pack-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pack-registry.test.ts  (create if absent)
import { describe, expect, it } from 'vitest';
import { getPackMeta } from '@/lib/collections/packRegistry';

describe('vocab pack registry entries', () => {
  it.each(['transport-v1', 'minibeasts-v1', 'instruments-v1', 'animals-v1'])(
    '%s has bilingual names + an ItemCard + reveal emoji',
    (slug) => {
      const meta = getPackMeta(slug);
      expect(meta).toBeTruthy();
      expect(meta!.displayNameZh && meta!.displayNameEn).toBeTruthy();
      expect(meta!.ItemCard).toBeTypeOf('function');
      expect(meta!.resolveRevealEmoji).toBeTypeOf('function');
    },
  );
  it('transport + instruments are grouped; minibeasts + animals are flat', () => {
    expect(getPackMeta('transport-v1')!.grouping).toBeTruthy();
    expect(getPackMeta('instruments-v1')!.grouping).toBeTruthy();
    expect(getPackMeta('minibeasts-v1')!.grouping).toBeUndefined();
    expect(getPackMeta('animals-v1')!.grouping).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/pack-registry.test.ts`
Expected: FAIL — `getPackMeta('transport-v1')` is null.

- [ ] **Step 3: Implement — add imports + 4 entries**

Add imports near the other card/data imports at the top of `packRegistry.ts`:

```ts
import { TransportCard } from '@/components/play/items/TransportCard';
import { MinibeastCard } from '@/components/play/items/MinibeastCard';
import { InstrumentCard } from '@/components/play/items/InstrumentCard';
import { AnimalCard } from '@/components/play/items/AnimalCard';
import { TRANSPORT_BY_SLUG, TRANSPORT_GROUP_ORDER, TRANSPORT_GROUP_LABELS } from '@/lib/collections/transportData';
import { MINIBEASTS_BY_SLUG } from '@/lib/collections/minibeastsData';
import { INSTRUMENTS_BY_SLUG, INSTRUMENT_GROUP_ORDER, INSTRUMENT_GROUP_LABELS } from '@/lib/collections/instrumentsData';
import { ANIMALS_BY_SLUG } from '@/lib/collections/animalsData';
```

Add these entries inside the `PACK_REGISTRY` object (after `season-summer-v1`):

```ts
  'transport-v1': {
    displayNameZh: '交通工具',
    displayNameEn: 'Transport',
    sloganZh: '陆地、水上、天空的交通工具。',
    sloganEn: 'Things that go on land, water, and air.',
    themeEmoji: '🚒',
    themeBannerClass: 'bg-gradient-to-br from-red-200 via-orange-300 to-amber-400',
    themeAccentClass: 'text-red-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: TransportCard,
    resolveRevealEmoji: (slug) => TRANSPORT_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => TRANSPORT_BY_SLUG[slug]?.group ?? null,
      order: TRANSPORT_GROUP_ORDER,
      labels: TRANSPORT_GROUP_LABELS,
    },
  },
  'minibeasts-v1': {
    displayNameZh: '昆虫',
    displayNameEn: 'Minibeasts',
    sloganZh: '花园里的小虫子朋友。',
    sloganEn: 'Little bug friends from the garden.',
    themeEmoji: '🦋',
    themeBannerClass: 'bg-gradient-to-br from-lime-200 via-green-300 to-emerald-400',
    themeAccentClass: 'text-emerald-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: MinibeastCard,
    resolveRevealEmoji: (slug) => MINIBEASTS_BY_SLUG[slug]?.emoji ?? null,
  },
  'instruments-v1': {
    displayNameZh: '乐器',
    displayNameEn: 'Instruments',
    sloganZh: '西洋和民族的乐器。',
    sloganEn: 'Western and Chinese instruments.',
    themeEmoji: '🎻',
    themeBannerClass: 'bg-gradient-to-br from-violet-200 via-purple-300 to-fuchsia-400',
    themeAccentClass: 'text-purple-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: InstrumentCard,
    resolveRevealEmoji: (slug) => INSTRUMENTS_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => INSTRUMENTS_BY_SLUG[slug]?.group ?? null,
      order: INSTRUMENT_GROUP_ORDER,
      labels: INSTRUMENT_GROUP_LABELS,
    },
  },
  'animals-v1': {
    displayNameZh: '动物',
    displayNameEn: 'Animals',
    sloganZh: '宠物、森林和动物园的动物。',
    sloganEn: 'Pets, woodland, and zoo animals.',
    themeEmoji: '🦊',
    themeBannerClass: 'bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-300',
    themeAccentClass: 'text-amber-900',
    paidPullCost: 300,
    gridColumns: 3,
    ItemCard: AnimalCard,
    resolveRevealEmoji: (slug) => ANIMALS_BY_SLUG[slug]?.emoji ?? null,
  },
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/pack-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/packRegistry.ts tests/unit/pack-registry.test.ts
git commit -m "feat(packs): register 4 vocab packs"
```

---

### Task A7: Seed script for all 4 packs

**Files:**
- Create: `scripts/seed-vocab-packs.ts`
- Test: none (one-off ops script; mirrors `seed-landmarks-pack.ts`, which has no test). Verified by running against prod post-merge.

- [ ] **Step 1: Implement**

```ts
// scripts/seed-vocab-packs.ts
/**
 * Seed the 4 themed vocab packs (transport / minibeasts / instruments / animals).
 * Idempotent: upserts each pack by slug (active, gacha_eligible=true) and inserts
 * only missing collectible_items. Emoji stored verbatim in image_url as the text
 * fallback (overwritten later by the CF art generator).
 *
 * Usage: pnpm tsx scripts/seed-vocab-packs.ts
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

interface SeedItem { slug: string; nameZh: string; nameEn: string; emoji: string; loreZh: string; loreEn: string; }
interface SeedPack { slug: string; name: string; description: string; themeColor: string; items: SeedItem[]; }

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');

  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { TRANSPORT } = await import('../src/lib/collections/transportData');
  const { MINIBEASTS } = await import('../src/lib/collections/minibeastsData');
  const { INSTRUMENTS } = await import('../src/lib/collections/instrumentsData');
  const { ANIMALS } = await import('../src/lib/collections/animalsData');

  const packs: SeedPack[] = [
    { slug: 'transport-v1', name: '交通工具', description: 'Things that go on land, water, and air.', themeColor: '#e8562a', items: TRANSPORT },
    { slug: 'minibeasts-v1', name: '昆虫', description: 'Little bug friends from the garden.', themeColor: '#3fae5a', items: MINIBEASTS },
    { slug: 'instruments-v1', name: '乐器', description: 'Western and Chinese instruments.', themeColor: '#8b5cf6', items: INSTRUMENTS },
    { slug: 'animals-v1', name: '动物', description: 'Pets, woodland, and zoo animals.', themeColor: '#e8893a', items: ANIMALS },
  ];

  for (const p of packs) {
    const [inserted] = await db
      .insert(collectionPacks)
      .values({ slug: p.slug, name: p.name, description: p.description, themeColor: p.themeColor, isActive: true, gachaEligible: true })
      .onConflictDoNothing()
      .returning();
    const packRow = inserted ?? (await db.select().from(collectionPacks).where(eq(collectionPacks.slug, p.slug)).limit(1))[0];
    if (!packRow) throw new Error(`Failed to upsert pack ${p.slug}`);

    const existing = await db.select({ slug: collectibleItems.slug }).from(collectibleItems).where(eq(collectibleItems.packId, packRow.id));
    const existingSlugs = new Set(existing.map((e) => e.slug));
    const toInsert = p.items.filter((i) => !existingSlugs.has(i.slug));
    if (toInsert.length > 0) {
      await db.insert(collectibleItems).values(
        toInsert.map((i) => ({
          packId: packRow.id,
          slug: i.slug,
          nameZh: i.nameZh,
          nameEn: i.nameEn,
          loreZh: i.loreZh,
          loreEn: i.loreEn,
          imageUrl: i.emoji,
        })),
      );
    }
    console.log(`seeded ${p.slug}: ${p.items.length} items, ${toInsert.length} new`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Typecheck only (no DB run during dev)**

Run: `pnpm typecheck`
Expected: PASS — the script compiles.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-vocab-packs.ts
git commit -m "feat(packs): idempotent seed script for 4 vocab packs"
```

> **Post-merge op (run once against prod):** `pnpm tsx scripts/seed-vocab-packs.ts`

---

### Task A8: CF-flux art recipe for the 4 packs

**Files:**
- Modify: `scripts/generate-collectible-art-cloudflare.ts`
- Test: none (generator script — no test, like the existing pack cases).

- [ ] **Step 1: Add the 4 slugs to `TARGET_PACK_SLUGS`**

In the `TARGET_PACK_SLUGS` array (~line 32) append:

```ts
  'transport-v1',
  'minibeasts-v1',
  'instruments-v1',
  'animals-v1',
```

- [ ] **Step 2: Add `buildPrompt` cases**

Inside `buildPrompt`'s `switch (packSlug)` (before `default:`), add:

```ts
    case 'transport-v1':
      return `${STYLE_PREAMBLE}a ${nameEn}, a friendly cartoon vehicle, full body, side view, centered, plain light background`;
    case 'minibeasts-v1':
      return `${STYLE_PREAMBLE}a ${nameEn}, a cute friendly garden minibeast, full body, centered, plain light background`;
    case 'instruments-v1':
      return `${STYLE_PREAMBLE}a ${nameEn}, a musical instrument, full body, centered, plain light background`;
    case 'animals-v1':
      return `${STYLE_PREAMBLE}a ${nameEn}, a cute friendly cartoon animal, full body, centered, plain light background`;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-collectible-art-cloudflare.ts
git commit -m "feat(packs): CF-flux art recipe for 4 vocab packs"
```

> **Post-merge op (run ONCE, after seeding):** `CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts` — generates ~56 images. If interrupted, resume with `SKIP_UPLOADED_AFTER=<ISO>` so already-uploaded assets are skipped via free `head()`. NEVER bulk-regenerate (Blob 2,000 Advanced-Ops/mo cap).

---

### Task A9: Part A four-green gate + open PR

- [ ] **Step 1: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. (Note: `pnpm build` runs `scripts/migrate.ts` against prod `DATABASE_URL` first — Part A adds NO migration, so this is a no-op on schema.)

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/themed-vocab-packs
gh pr create --title "feat(packs): 4 KS1 themed vocab packs (Transport/Minibeasts/Instruments/Animals)" --body "$(cat <<'EOF'
Adds 4 bilingual collectible packs built to double as vocab lessons (spec: docs/superpowers/specs/2026-06-20-themed-vocab-packs-and-study-mode-design.md). gacha-eligible regular packs. Shared makeVocabCard factory. Post-merge ops: seed-vocab-packs.ts then generate-collectible-art-cloudflare.ts (one run, resume-flagged).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PART B — Study Mode (PR 2)

> Branch from updated `main` after Part A merges: `git checkout main && git pull && git checkout -b feat/study-mode`.

### Task B1: Pure `buildStudyLesson`

**Files:**
- Create: `src/lib/play/study.ts`
- Test: `tests/unit/build-study-lesson.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/build-study-lesson.test.ts
import { describe, expect, it } from 'vitest';
import { buildStudyLesson, STUDY_LESSON_SIZE, type StudyCardLite } from '@/lib/play/study';

function card(n: number): StudyCardLite {
  return { id: `id${n}`, slug: `s${n}`, nameZh: `中${n}`, nameEn: `En${n}`, imageUrl: null };
}
// Deterministic RNG for stable assertions.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('buildStudyLesson', () => {
  it('returns [] when fewer than 3 owned', () => {
    expect(buildStudyLesson([card(1), card(2)], [card(1), card(2)], Math.random)).toEqual([]);
  });
  it('builds STUDY_LESSON_SIZE questions, each with the target among its choices', () => {
    const owned = [card(1), card(2), card(3), card(4)];
    const pool = [...owned, card(5), card(6), card(7)];
    const qs = buildStudyLesson(owned, pool, seq([0.1, 0.4, 0.9]));
    expect(qs).toHaveLength(STUDY_LESSON_SIZE);
    for (const q of qs) {
      expect(q.choices).toContainEqual(q.target);
      expect(q.choices.length).toBeLessThanOrEqual(4);
      // target is always an owned card
      expect(owned.map((o) => o.id)).toContain(q.target.id);
      // no duplicate choice ids
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(q.choices.length);
      expect(['picture_to_word', 'audio_to_picture']).toContain(q.type);
    }
  });
  it('gives every question a unique id (stable MCQ keys)', () => {
    const owned = [card(1), card(2), card(3)];
    const qs = buildStudyLesson(owned, owned, seq([0.2, 0.7]));
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/build-study-lesson.test.ts`
Expected: FAIL — cannot find module `study`.

- [ ] **Step 3: Implement**

```ts
// src/lib/play/study.ts
// PURE — no '@/db' import. Safe to import from client components (PackPageBody)
// and server code alike.

export interface StudyCardLite {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  imageUrl: string | null;
}

export type StudyQuestionType = 'picture_to_word' | 'audio_to_picture';

export interface StudyQuestion {
  id: string;
  type: StudyQuestionType;
  target: StudyCardLite;
  /** Includes the target; already shuffled. */
  choices: StudyCardLite[];
}

export const STUDY_MIN_OWNED = 3;
export const STUDY_LESSON_SIZE = 6;
export const STUDY_CHOICE_COUNT = 4;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a study lesson from a child's OWNED cards in a pack. Targets are drawn
 * from `owned` (cycled if fewer than `size`); distractors come from `pool` (all
 * pack items). Pure: inject `rng` for deterministic tests. Returns [] if the
 * child owns fewer than STUDY_MIN_OWNED.
 */
export function buildStudyLesson(
  owned: StudyCardLite[],
  pool: StudyCardLite[],
  rng: () => number = Math.random,
  size = STUDY_LESSON_SIZE,
): StudyQuestion[] {
  if (owned.length < STUDY_MIN_OWNED) return [];

  const shuffledOwned = shuffle(owned, rng);
  const targets: StudyCardLite[] = [];
  for (let i = 0; i < size; i++) targets.push(shuffledOwned[i % shuffledOwned.length]);

  const types: StudyQuestionType[] = ['picture_to_word', 'audio_to_picture'];
  return targets.map((target, i) => {
    const type = types[Math.floor(rng() * types.length)];
    const distractors = shuffle(pool.filter((c) => c.id !== target.id), rng).slice(0, STUDY_CHOICE_COUNT - 1);
    const choices = shuffle([target, ...distractors], rng);
    return { id: `${type}:${target.id}:${i}`, type, target, choices };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/build-study-lesson.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/play/study.ts tests/unit/build-study-lesson.test.ts
git commit -m "feat(study): pure buildStudyLesson"
```

---

### Task B2: `'study'` card source + pack-scoped pull

**Files:**
- Modify: `src/lib/db/grants.ts`
- Modify: `src/lib/play/card-grants.ts`
- Test: `tests/unit/actions/study.test.ts` will cover this transitively (B4). Add a focused grants test here.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/grants-study-source.test.ts
import { describe, expect, it } from 'vitest';
import type { CardGrantSource } from '@/lib/play/card-grants';

// The typed const is the real guard: if 'study' isn't in the union, `pnpm
// typecheck` fails. The runtime expect just keeps vitest happy.
describe("'study' card source", () => {
  it('is a valid CardGrantSource', () => {
    const s: CardGrantSource = 'study';
    expect(s).toBe('study');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm typecheck`
Expected: FAIL — `Type '"study"' is not assignable to type 'CardGrantSource'`.

- [ ] **Step 3: Edit `src/lib/db/grants.ts`**

Extend the `pullCardInTx` source union and add an optional `packSlug` param that scopes the catalog. Change the signature (line ~96-103) and the catalog `.where` (line ~152-157):

```ts
export async function pullCardInTx(
  tx: Tx,
  childId: string,
  source: 'boss_clear' | 'perfect_week' | 'story_chapter' | 'review' | 'practice' | 'homework' | 'study',
  refId: string,
  dayUtc: string,
  rng: () => number = Math.random,
  packSlug?: string,
): Promise<CardGrantResult | CardGrantSkipped> {
```

In the catalog query `.where(...)` (the `and(...)` for the `collectibleItems` innerJoin select), add the optional pack filter (drizzle `and()` ignores `undefined`):

```ts
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
        packSlug ? eq(collectionPacks.slug, packSlug) : undefined,
      ),
    );
```

- [ ] **Step 4: Edit `src/lib/play/card-grants.ts`**

Add `'study'` to `CardGrantSource` and thread `packSlug` through `pullCardForChild`:

```ts
export type CardGrantSource =
  | 'boss_clear'
  | 'perfect_week'
  | 'story_chapter'
  | 'review'
  | 'practice'
  | 'homework'
  | 'study';

export async function pullCardForChild(
  childId: string,
  source: CardGrantSource,
  refId: string,
  packSlug?: string,
): Promise<CardGrantResult | CardGrantSkipped> {
  const dayUtc = todayUtcIso();
  const result = await db.transaction((tx) =>
    pullCardInTx(tx, childId, source, refId, dayUtc, Math.random, packSlug),
  );
  if (result.granted) {
    revalidatePath(`/play/${childId}/collection/${result.packSlug}`);
    void safePackCompleteTrophy(childId, result.packSlug);
    if (result.packSlug === 'flags-v1') void safeContinentTrophies(childId);
  }
  return result;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm typecheck && pnpm vitest run tests/unit/grants-study-source.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/grants.ts src/lib/play/card-grants.ts tests/unit/grants-study-source.test.ts
git commit -m "feat(study): 'study' card source + pack-scoped pull"
```

---

### Task B3: `finishStudyLessonAction`

**Files:**
- Create: `src/lib/actions/study.ts`
- Test: `tests/unit/actions/study.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/actions/study.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (childId: string) => ({ parent: { id: 'p1' }, child: { id: childId } })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const getPackBySlug = vi.fn();
const listChildCollection = vi.fn();
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
  listChildCollection: (...a: unknown[]) => listChildCollection(...a),
}));
const pullCardForChild = vi.fn();
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: (...a: unknown[]) => pullCardForChild(...a) }));
const awardXp = vi.fn(async () => ({ totalXp: 100, level: 2, leveledUp: false }));
vi.mock('@/lib/db/xp', () => ({ awardXp: (...a: unknown[]) => awardXp(...a) }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: vi.fn() }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-06-20' }));

import { finishStudyLessonAction } from '@/lib/actions/study';

const ownedThree = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

beforeEach(() => {
  vi.clearAllMocks();
  getPackBySlug.mockResolvedValue({ id: 'pk', slug: 'animals-v1', gachaEligible: true });
  listChildCollection.mockResolvedValue(ownedThree);
});

describe('finishStudyLessonAction', () => {
  it('grants a card + XP on a passing score, scoped to the pack', async () => {
    pullCardForChild.mockResolvedValue({ granted: true, itemId: 'i1', slug: 'fox', packSlug: 'animals-v1', nameZh: '狐狸', nameEn: 'Fox', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(pullCardForChild).toHaveBeenCalledWith('c1', 'study', 'animals-v1:2026-06-20', 'animals-v1');
    expect(awardXp).toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(1);
    expect(res.xp.gained).toBeGreaterThan(0);
  });
  it('reports study_done_today on a same-day repeat (already_granted)', async () => {
    pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted', cardsToday: 3 });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(res.cardMessage).toBe('study_done_today');
    expect(res.cardGrants).toHaveLength(0);
    expect(awardXp).not.toHaveBeenCalled(); // reward gated on granted (anti-farm)
  });
  it('reports daily_cap_reached when the shared cap is hit', async () => {
    pullCardForChild.mockResolvedValue({ granted: false, reason: 'daily_cap_reached', cardsToday: 10 });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(res.cardMessage).toBe('daily_cap_reached');
  });
  it('grants nothing on a failing score', async () => {
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 40 });
    expect(pullCardForChild).not.toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(0);
  });
  it('grants nothing for a reward-only (non-gacha) pack', async () => {
    getPackBySlug.mockResolvedValue({ id: 'pk', slug: 'festivals-v1', gachaEligible: false });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'festivals-v1', score: 100 });
    expect(pullCardForChild).not.toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(0);
  });
  it('grants nothing when the child owns fewer than 3 cards', async () => {
    listChildCollection.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(pullCardForChild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/actions/study.test.ts`
Expected: FAIL — cannot find module `study`.

- [ ] **Step 3: Implement**

```ts
// src/lib/actions/study.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug, listChildCollection } from '@/lib/db/collections';
import { pullCardForChild } from '@/lib/play/card-grants';
import { awardXp } from '@/lib/db/xp';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import { todayUtcIso } from '@/lib/db/streaks';
import { STUDY_MIN_OWNED } from '@/lib/play/study';
import type { RevealCard } from '@/lib/play/reveal-card';

const STUDY_PASS_SCORE = 60; // gentle bar for a 6yo (≈4/6)
const STUDY_XP = 15;

export type StudyCardMessage = 'study_done_today' | 'daily_cap_reached' | null;

const FinishStudySchema = z.object({
  childId: z.string().uuid(),
  packSlug: z.string(),
  score: z.number().min(0).max(100),
});

/**
 * Finish a study lesson. Mirrors finishHomeworkAction's anti-farm pattern: the
 * WHOLE reward (XP + card) fires ONLY on the pullCardForChild `granted` branch,
 * so re-studying after the daily card is claimed grants nothing. Card is scoped
 * to this pack (`pullCardForChild(..., packSlug)`), once per (pack, UTC day) via
 * the refId, and still consumes the shared daily cap. Reward-only packs
 * (gacha_eligible=false) never grant.
 */
export async function finishStudyLessonAction(
  input: z.input<typeof FinishStudySchema>,
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  cardMessage: StudyCardMessage;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishStudySchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const pack = await getPackBySlug(parsed.packSlug);
  if (!pack) throw new Error('Pack not found');

  const owned = await listChildCollection(child.id, pack.id);

  let card: RevealCard | null = null;
  let cardMessage: StudyCardMessage = null;
  let xp = { gained: 0, level: 1, leveledUp: false };

  const eligible = parsed.score >= STUDY_PASS_SCORE && owned.length >= STUDY_MIN_OWNED && pack.gachaEligible;

  if (eligible) {
    try {
      const refId = `${parsed.packSlug}:${todayUtcIso()}`;
      const res = await pullCardForChild(child.id, 'study', refId, parsed.packSlug);
      if (res.granted) {
        const xpRes = await awardXp(child.id, STUDY_XP, 'study', refId);
        xp = { gained: STUDY_XP, level: xpRes.level, leveledUp: xpRes.leveledUp };
        void tickQuestProgressSafe(child.id, 'earn_card', 1);
        card = {
          id: res.itemId,
          slug: res.slug,
          packSlug: res.packSlug,
          nameZh: res.nameZh,
          nameEn: res.nameEn,
          loreZh: res.loreZh,
          loreEn: res.loreEn,
          isDupe: res.isDupe,
          shardsAfter: res.shardsAfter,
        };
      } else if (res.reason === 'already_granted') {
        cardMessage = 'study_done_today';
      } else if (res.reason === 'daily_cap_reached') {
        cardMessage = 'daily_cap_reached';
      }
    } catch (err) {
      console.error('[finishStudyLessonAction] reward error:', err);
    }
  }

  revalidatePath(`/play/${child.id}/collection/${parsed.packSlug}`);
  return { ok: true, cardGrants: card ? [card] : [], cardMessage, xp };
}
```

Note: `'study'` is already a valid `XpSource` member — verify `src/lib/db/xp.ts`'s `XpSource` union. It is NOT yet; add it.

- [ ] **Step 4: Add `'study'` to `XpSource`**

In `src/lib/db/xp.ts`, extend the union:

```ts
export type XpSource =
  | 'scene_complete'
  | 'scene_perfect'
  | 'boss_clear'
  | 'daily_quest'
  | 'daily_chest'
  | 'streak_milestone'
  | 'homework'
  | 'study'
  | 'admin_grant';
```

(`xp_events.source` is a `text` column — no migration.)

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run tests/unit/actions/study.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/study.ts src/lib/db/xp.ts tests/unit/actions/study.test.ts
git commit -m "feat(study): finishStudyLessonAction (anti-farm, pack-scoped)"
```

---

### Task B4: `StudyRunner` component

**Files:**
- Create: `src/components/play/StudyRunner.tsx`
- Test: `tests/unit/components/play/StudyRunner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/play/StudyRunner.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyQuestion } from '@/lib/play/study';

vi.mock('@/lib/actions/study', () => ({ finishStudyLessonAction: vi.fn(async () => ({ ok: true, cardGrants: [], cardMessage: null, xp: { gained: 0, level: 1, leveledUp: false } })) }));
// MultipleChoiceQuiz + CardChestReveal are exercised elsewhere; render real.
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({ useCoinHud: () => ({ coinHudRef: { current: null } }) }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn(), usableAudioUrl: (u: string | null) => u }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { StudyRunner } from '@/components/play/StudyRunner';

const q: StudyQuestion[] = [
  { id: 'picture_to_word:a:0', type: 'picture_to_word', target: { id: 'a', slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', imageUrl: null }, choices: [
    { id: 'a', slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', imageUrl: null },
    { id: 'b', slug: 'owl', nameZh: '猫头鹰', nameEn: 'Owl', imageUrl: null },
  ] },
];

describe('StudyRunner', () => {
  it('renders the first question prompt + choices', () => {
    render(<StudyRunner childId="c1" packSlug="animals-v1" packNameZh="动物" packNameEn="Animals" questions={q} />);
    // picture_to_word prompt is "看图选词"
    expect(screen.getByText(/看图选词/)).toBeInTheDocument();
    expect(screen.getByText('狐狸')).toBeInTheDocument();
    expect(screen.getByText('猫头鹰')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/components/play/StudyRunner.test.tsx`
Expected: FAIL — cannot find module `StudyRunner`.

- [ ] **Step 3: Implement**

```tsx
// src/components/play/StudyRunner.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { CardArt } from '@/components/play/items/CardArt';
import { SpeakButton } from '@/components/play/SpeakButton';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { finishStudyLessonAction, type StudyCardMessage } from '@/lib/actions/study';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { StudyQuestion, StudyCardLite } from '@/lib/play/study';

interface Props {
  childId: string;
  packSlug: string;
  packNameZh: string;
  packNameEn: string;
  questions: StudyQuestion[];
}

export function StudyRunner({ childId, packSlug, packNameZh, packNameEn, questions }: Props) {
  const router = useRouter();
  const meta = getPackMeta(packSlug);
  const emojiFor = (slug: string) => meta?.resolveRevealEmoji?.(slug) ?? meta?.themeEmoji ?? '⭐';

  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [revealCards, setRevealCards] = useState<RevealCard[]>([]);
  const [cardMessage, setCardMessage] = useState<StudyCardMessage>(null);
  const [, startTransition] = useTransition();

  const q = questions[index];

  const onAnswer = (isCorrect: boolean) => {
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(nextCorrect);
    const next = index + 1;
    if (next >= questions.length) {
      const score = Math.round((nextCorrect / questions.length) * 100);
      startTransition(async () => {
        const res = await finishStudyLessonAction({ childId, packSlug, score });
        if (res.cardGrants.length) setRevealCards(res.cardGrants);
        if (res.cardMessage) setCardMessage(res.cardMessage);
        setDone(true);
      });
    } else {
      setIndex(next);
    }
  };

  if (done || !q) {
    const messageText =
      cardMessage === 'study_done_today'
        ? '今天这本图鉴已经学过啦 / Already studied this collection today'
        : cardMessage === 'daily_cap_reached'
          ? '今天的卡片已经发完啦,明天再来 / All cards earned for today — come back tomorrow'
          : null;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="font-hanzi text-2xl font-extrabold text-[var(--color-ocean-800)]">
          学习完成 <span className="text-lg font-semibold">/ Lesson complete</span>
        </h2>
        <p className="font-hanzi text-base text-[var(--color-ocean-700)]">
          你答对了 {correct} / {questions.length} <span className="text-sm">· {correct}/{questions.length} correct</span>
        </p>
        {messageText && <p className="text-sm text-[var(--color-sand-700)]">{messageText}</p>}
        <WoodSignButton size="lg" onClick={() => router.push(`/play/${childId}/collection/${packSlug}`)}>
          返回 / Back
        </WoodSignButton>
        {revealCards.length > 0 ? (
          <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} />
        ) : null}
      </div>
    );
  }

  if (q.type === 'picture_to_word') {
    return (
      <MultipleChoiceQuiz
        key={q.id}
        prompt={<span className="font-hanzi text-lg">看图选词 / Match the picture to a word</span>}
        stimulus={<CardArt imageUrl={q.target.imageUrl} emoji={emojiFor(q.target.slug)} owned size="lg" alt={q.target.nameEn} />}
        choices={q.choices.map((c: StudyCardLite) => ({
          key: c.id,
          label: (
            <span className="flex flex-col items-center">
              <span className="font-hanzi text-2xl">{c.nameZh}</span>
              <span className="text-xs text-[var(--color-sand-600)]">{c.nameEn}</span>
            </span>
          ),
          isCorrect: c.id === q.target.id,
        }))}
        postRevealAudio={q.target.nameZh}
        onComplete={onAnswer}
      />
    );
  }

  // audio_to_picture
  return (
    <MultipleChoiceQuiz
      key={q.id}
      prompt={<span className="font-hanzi text-lg">听音选图 / Listen and pick the picture</span>}
      stimulus={<SpeakButton text={q.target.nameZh} size="md" label="🔊 听 / Listen" />}
      choices={q.choices.map((c: StudyCardLite) => ({
        key: c.id,
        label: <CardArt imageUrl={c.imageUrl} emoji={emojiFor(c.slug)} owned size="md" alt={c.nameEn} />,
        isCorrect: c.id === q.target.id,
      }))}
      onComplete={onAnswer}
    />
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/components/play/StudyRunner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/StudyRunner.tsx tests/unit/components/play/StudyRunner.test.tsx
git commit -m "feat(study): StudyRunner lesson component"
```

---

### Task B5: Study route page

**Files:**
- Create: `src/app/play/[childId]/collection/[packSlug]/study/page.tsx`
- Test: `tests/unit/app/study-route.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/app/study-route.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireChild = vi.fn(async () => ({ parent: { id: 'p' }, child: { id: 'c1' } }));
vi.mock('@/lib/auth/guards', () => ({ requireChild: (...a: unknown[]) => requireChild(...a) }));
const redirect = vi.fn();
const notFound = vi.fn(() => { throw new Error('notFound'); });
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a), notFound: () => notFound() }));
const getPackBySlug = vi.fn();
const listChildCollection = vi.fn();
const listPackItems = vi.fn();
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
  listChildCollection: (...a: unknown[]) => listChildCollection(...a),
  listPackItems: (...a: unknown[]) => listPackItems(...a),
}));
// Render StudyRunner as a stub so we assert it's reached.
vi.mock('@/components/play/StudyRunner', () => ({ StudyRunner: () => <div data-testid="study-runner" /> }));

import StudyPage from '@/app/play/[childId]/collection/[packSlug]/study/page';

beforeEach(() => {
  vi.clearAllMocks();
  getPackBySlug.mockResolvedValue({ id: 'pk', slug: 'animals-v1', name: '动物' });
});

describe('study route', () => {
  it('redirects back to the pack page when the child owns fewer than 3', async () => {
    listChildCollection.mockResolvedValue([{ id: 'a', slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', imageUrl: null }]);
    listPackItems.mockResolvedValue([]);
    await StudyPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'animals-v1' }) });
    expect(redirect).toHaveBeenCalledWith('/play/c1/collection/animals-v1');
  });
  it('renders the runner when the child owns 3+', async () => {
    const owned = ['a', 'b', 'c'].map((id) => ({ id, slug: id, nameZh: id, nameEn: id, imageUrl: null }));
    listChildCollection.mockResolvedValue(owned);
    listPackItems.mockResolvedValue(owned);
    const ui = await StudyPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'animals-v1' }) });
    const { render, screen } = await import('@testing-library/react');
    render(ui);
    expect(screen.getByTestId('study-runner')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/app/study-route.test.tsx`
Expected: FAIL — cannot find the page module.

- [ ] **Step 3: Implement**

```tsx
// src/app/play/[childId]/collection/[packSlug]/study/page.tsx
import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug, listChildCollection, listPackItems } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { StudyRunner } from '@/components/play/StudyRunner';
import { buildStudyLesson, STUDY_MIN_OWNED, type StudyCardLite } from '@/lib/play/study';

interface PageProps {
  params: Promise<{ childId: string; packSlug: string }>;
}

export default async function StudyPage({ params }: PageProps) {
  const { childId, packSlug } = await params;
  await requireChild(childId);

  const pack = await getPackBySlug(packSlug);
  const meta = getPackMeta(packSlug);
  if (!pack || !meta) notFound();

  const [owned, allItems] = await Promise.all([
    listChildCollection(childId, pack.id),
    listPackItems(pack.id),
  ]);

  if (owned.length < STUDY_MIN_OWNED) {
    redirect(`/play/${childId}/collection/${packSlug}`);
  }

  const toLite = (i: { id: string; slug: string; nameZh: string; nameEn: string; imageUrl: string | null }): StudyCardLite => ({
    id: i.id,
    slug: i.slug,
    nameZh: i.nameZh,
    nameEn: i.nameEn,
    imageUrl: i.imageUrl,
  });

  // Built server-side at request time (fresh lesson each visit). Plain data →
  // safe across the RSC boundary; no client-side shuffle (MCQ-randomness rule).
  const questions = buildStudyLesson(owned.map(toLite), allItems.map(toLite));

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <StudyRunner
        childId={childId}
        packSlug={packSlug}
        packNameZh={meta.displayNameZh}
        packNameEn={meta.displayNameEn}
        questions={questions}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/app/study-route.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/play/[childId]/collection/[packSlug]/study/page.tsx" tests/unit/app/study-route.test.tsx
git commit -m "feat(study): study route page"
```

---

### Task B6: 📖 学习 button on the pack page

**Files:**
- Modify: `src/components/play/PackPageBody.tsx`
- Test: `tests/unit/components/play/PackPageBody.study-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/play/PackPageBody.study-button.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/gacha', () => ({ swapShardsForItem: vi.fn(), convertDuplicateToShard: vi.fn() }));

import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem } from '@/lib/db/collections';

function item(id: string): CollectibleItem {
  return { id, packId: 'p', slug: id, nameZh: id, nameEn: id, loreZh: null, loreEn: null, rarity: 'common', dropWeight: 1, imageUrl: null, createdAt: new Date() };
}
const items = ['a', 'b', 'c', 'd'].map(item);

describe('PackPageBody study button', () => {
  it('shows the 学习 CTA enabled when ≥3 owned', () => {
    render(<PackPageBody childId="c1" packSlug="animals-v1" items={items} ownedItemIds={['a', 'b', 'c']} ownedItems={[]} balance={0} shardCount={0} />);
    const btn = screen.getByTestId('study-cta');
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent(/学习/);
  });
  it('shows the collect-3 hint when fewer than 3 owned', () => {
    render(<PackPageBody childId="c1" packSlug="animals-v1" items={items} ownedItemIds={['a']} ownedItems={[]} balance={0} shardCount={0} />);
    expect(screen.getByTestId('study-cta')).toBeDisabled();
    expect(screen.getByText(/收集 3 张/)).toBeInTheDocument();
  });
});
```

(Note: `animals-v1` must be registered — Part A is merged before Part B, so `getPackMeta('animals-v1')` resolves.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/components/play/PackPageBody.study-button.test.tsx`
Expected: FAIL — no `study-cta` testid.

- [ ] **Step 3: Implement**

In `PackPageBody.tsx`, import the constant near the top:

```ts
import { STUDY_MIN_OWNED } from '@/lib/play/study';
```

Then, inside the returned JSX, immediately AFTER the `<header>…</header>` block (before the shard help text `div`), insert:

```tsx
      {(() => {
        const canStudy = ownedSet.size >= STUDY_MIN_OWNED;
        return (
          <button
            type="button"
            data-testid="study-cta"
            disabled={!canStudy}
            onClick={() => router.push(`/play/${childId}/collection/${packSlug}/study`)}
            className={[
              'flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 font-hanzi text-base font-bold',
              canStudy
                ? 'border-emerald-400 bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                : 'border-stone-300 bg-stone-100 text-stone-500',
            ].join(' ')}
          >
            {canStudy ? (
              <>📖 学习 / Study</>
            ) : (
              <span className="text-sm">📖 收集 3 张即可学习 / Collect 3 to study</span>
            )}
          </button>
        );
      })()}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/components/play/PackPageBody.study-button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/PackPageBody.tsx tests/unit/components/play/PackPageBody.study-button.test.tsx
git commit -m "feat(study): 学习 button on pack page (≥3 gate)"
```

---

### Task B7: Distribution-isolation guard

**Files:**
- Modify: `tests/unit/distribution-isolation-guard.test.ts`

- [ ] **Step 1: Add the assertion**

The new action `finishStudyLessonAction` is a `'use server'` export and MUST call `requireChild`. The existing guard test verifies child-scoped server actions are gated. Add a focused check:

```ts
// append inside tests/unit/distribution-isolation-guard.test.ts
import { readFileSync } from 'node:fs';

it('finishStudyLessonAction is requireChild-gated', () => {
  const src = readFileSync('src/lib/actions/study.ts', 'utf8');
  expect(src).toContain("'use server'");
  expect(src).toMatch(/requireChild\(/);
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm vitest run tests/unit/distribution-isolation-guard.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/distribution-isolation-guard.test.ts
git commit -m "test(study): isolation guard for finishStudyLessonAction"
```

---

### Task B8: Part B four-green gate + open PR

- [ ] **Step 1: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. (No migration in Part B — `card_grants_log.source` + `xp_events.source` are `text`; the daily-cap/idempotency tables already exist.)

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/study-mode
gh pr create --title "feat(study): Study Mode — packs that teach (1 card/pack/day)" --body "$(cat <<'EOF'
A 📖 学习 lesson on each pack page: picture+audio+meaning questions built from owned cards, gifting 1 card/pack/day (new 'study' source, pack-scoped pull, shared 10/day cap, anti-farm gated on grant). Spec: docs/superpowers/specs/2026-06-20-themed-vocab-packs-and-study-mode-design.md. No migration, no recompile.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- 4 packs (data + cards + registry + seed + art) → Tasks A1–A8. ✓
- Animals excludes zodiac → Task A4 test asserts it. ✓
- Study entry button + ≥3 gate → Task B6. ✓
- Lesson content from owned cards, ~6 questions, two MCQ types, picture+audio+meaning → Tasks B1, B4. ✓
- Reward 1 card/pack/day + shared daily cap + anti-farm → Tasks B2, B3. ✓
- `'study'` card-grant + XP sources → B2, B3. ✓
- Reward-only packs never grant → B3 test. ✓
- Device TTS for 听音选图 (SpeakButton, no generated clips) → B4. ✓
- No migration / no recompile → confirmed (text columns, runtime data). ✓

**2. Placeholder scan:** No TBD/TODO; all code is complete; data arrays fully enumerated; tests are runnable.

**3. Type consistency:** `StudyCardLite`/`StudyQuestion` defined in B1 and consumed unchanged in B4/B5. `pullCardForChild(childId, source, refId, packSlug?)` defined in B2 and called with all 4 args in B3. `StudyCardMessage` defined in B3, imported in B4. `finishStudyLessonAction` input `{childId, packSlug, score}` consistent across B3 test, B3 impl, B4 caller. `makeVocabCard` options shape consistent between A5 factory and its 4 wrappers + the registry `ItemCard` type (`ComponentType<ItemCardProps>` — the returned `VocabCard` matches `{item, owned, size?, compact?}`). ✓

**Post-merge ops (in order):** after Part A merges → `pnpm tsx scripts/seed-vocab-packs.ts`, then one art run `pnpm tsx scripts/generate-collectible-art-cloudflare.ts` (resume-flagged). Part B has none.
