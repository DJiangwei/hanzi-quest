# PR #33 — Static Pet Companion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 8 pet companions in the shop's Pet tab — purchasable + equippable. Equipped pet renders beside the avatar on the island map; tapping it shows a random bilingual speech bubble for ~2.5s.

**Architecture:** Two new tables (`pets` catalog + `child_pet_equipped` single-slot equip). Pets live in `shop_items` with `kind='pet'`; ownership derives from `shop_purchases` (no separate inventory table). New `PetCompanion` client component handles idle bob + speech bubble. New `PetsTabBody` mirrors `SoundsTabBody`. Island map page fetches the equipped pet alongside other data.

**Tech Stack:** TypeScript / Next.js 16 App Router / Drizzle ORM / Postgres / Vitest + RTL + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-23-pr33-pet-companion-design.md`

**Branch:** `feat/pr33-pet-companion` (already exists; spec already committed).

---

## File Structure

### Created
- `src/db/schema/pets.ts` — `pets` + `childPetEquipped` tables.
- `drizzle/0009_<auto-name>.sql` — migration.
- `src/lib/db/pets.ts` — `listPetShopListings`, `getEquippedPet`, `setEquippedPet`, `getPetBySlug`.
- `src/lib/actions/pet.ts` — `'use server'`, `equipPetAction`.
- `src/components/play/PetCompanion.tsx` — client component with bob idle + speech bubble.
- `src/components/shop/PetsTabBody.tsx` — pet shop tab UI.
- `scripts/seed-pets.ts` — seeds 8 `pets` + 8 `shop_items` rows.
- Tests: `tests/unit/pets-db.test.ts`, `tests/unit/equip-pet-action.test.ts`, `tests/unit/pet-companion.test.tsx`, `tests/unit/pets-tab-body.test.tsx`.

### Modified
- `src/db/schema/index.ts` — export pets module.
- `src/db/schema/economy.ts` — append `'pet'` to `shopItemKind` pgEnum.
- `src/components/shop/ShopCategoryTabs.tsx` — flip `pet` tab `disabled: false`.
- `src/app/play/[childId]/shop/page.tsx` — fetch pet listings + equipped pet, pass to ShopBody.
- `src/app/play/[childId]/shop/ShopBody.tsx` — route `pet` tab to `PetsTabBody`.
- `src/app/play/[childId]/page.tsx` (island map) — fetch equipped pet, render `<PetCompanion>` beside avatar.
- `src/app/globals.css` — add `@keyframes pet-bob` + `.animate-pet-bob` utility.
- `CLAUDE.md` — bump + PR #33 bullet + note 3 live shop tabs now.

### Untouched
- Avatar code.
- Sound theme code.
- Trophy code (no new trophy in this PR).

---

## Task 1: Schema + seed script

**Files:**
- Create: `src/db/schema/pets.ts`
- Modify: `src/db/schema/economy.ts:30-36` (shopItemKind enum)
- Modify: `src/db/schema/index.ts` (re-export)
- Create: `drizzle/0009_<auto-name>.sql` (generated)
- Create: `scripts/seed-pets.ts`

- [ ] **Step 1: Create `src/db/schema/pets.ts`**

```ts
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const pets = pgTable(
  'pets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    emoji: text('emoji').notNull(),
    descriptionZh: text('description_zh'),
    descriptionEn: text('description_en'),
    speechZh: text('speech_zh').array().notNull(),
    speechEn: text('speech_en').array().notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('pets_display_order_idx').on(t.displayOrder)],
);

export const childPetEquipped = pgTable('child_pet_equipped', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: 'cascade' }),
  petId: uuid('pet_id').references(() => pets.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Append `'pet'` to `shopItemKind`**

Read `src/db/schema/economy.ts`. The enum currently has `'avatar', 'powerup', 'consumable', 'pack_voucher', 'sound_theme'`. Append `'pet'`:

```ts
export const shopItemKind = pgEnum('shop_item_kind', [
  'avatar',
  'powerup',
  'consumable',
  'pack_voucher',
  'sound_theme',
  'pet',
]);
```

- [ ] **Step 3: Re-export from `src/db/schema/index.ts`**

Add `export * from './pets';` alphabetically.

- [ ] **Step 4: Generate migration**

`pnpm db:generate`
Expected: `drizzle/0009_<random>.sql` containing one `ALTER TYPE ... ADD VALUE 'pet'` + 2 `CREATE TABLE` + index + FKs.

- [ ] **Step 5: Apply locally**

`pnpm tsx scripts/migrate.ts`
Expected: clean apply.

- [ ] **Step 6: Create `scripts/seed-pets.ts`**

```ts
/**
 * Seed 8 pets + their corresponding shop_items rows. Idempotent — re-running
 * is safe (skip-by-slug).
 *
 * Usage:
 *   pnpm tsx scripts/seed-pets.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

interface PetSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  speechZh: string[];
  speechEn: string[];
  priceCoins: number;
  displayOrder: number;
}

const PETS: PetSeed[] = [
  {
    slug: 'pet-parrot',
    emoji: '🦜',
    nameZh: '鹦鹉',
    nameEn: 'Parrot',
    descriptionZh: '聪明的甲板伙伴，会模仿船长说话。',
    descriptionEn: 'A clever deckmate who mimics the captain.',
    speechZh: ['加油！', '你真棒！', '再来一关！', '海盗船长好！', '我喜欢你！', '继续冒险！'],
    speechEn: ['Keep going!', "You're amazing!", 'One more level!', 'Hello, captain!', 'I like you!', 'Onward!'],
    priceCoins: 300,
    displayOrder: 1,
  },
  {
    slug: 'pet-crab',
    emoji: '🦀',
    nameZh: '螃蟹',
    nameEn: 'Crab',
    descriptionZh: '在沙滩上横着走的小伙伴。',
    descriptionEn: 'A sideways little buddy from the beach.',
    speechZh: ['咔哒咔哒', '我在沙滩上', '小心我的钳子', '加油哦', '海水真凉', '我们是好朋友'],
    speechEn: ['Click click', "I'm on the beach", 'Watch the claws', 'Hang in there', "The water's cool", "We're friends"],
    priceCoins: 300,
    displayOrder: 2,
  },
  {
    slug: 'pet-ship-cat',
    emoji: '🐈',
    nameZh: '船猫',
    nameEn: 'Ship Cat',
    descriptionZh: '海盗船上的好运猫。',
    descriptionEn: 'The lucky cat of every pirate ship.',
    speechZh: ['喵', '想吃鱼', '今天好困', '让我打个盹', '你好', '捉只老鼠去'],
    speechEn: ['Meow', 'I want fish', 'So sleepy today', 'Time for a nap', 'Hi there', 'Off to catch mice'],
    priceCoins: 350,
    displayOrder: 3,
  },
  {
    slug: 'pet-monkey',
    emoji: '🐒',
    nameZh: '猴子',
    nameEn: 'Monkey',
    descriptionZh: '爬桅杆的小淘气。',
    descriptionEn: 'A mast-climbing little rascal.',
    speechZh: ['嘻嘻嘻', '给我一根香蕉', '我会爬桅杆', '跳起来', '好玩好玩', '我们一起玩'],
    speechEn: ['Hee hee', 'Banana please', 'I climb the mast', "Let's jump", 'Fun fun fun', 'Play with me'],
    priceCoins: 500,
    displayOrder: 4,
  },
  {
    slug: 'pet-sea-turtle',
    emoji: '🐢',
    nameZh: '海龟',
    nameEn: 'Sea Turtle',
    descriptionZh: '慢慢悠悠的百岁老人。',
    descriptionEn: 'A century-old gentle traveler.',
    speechZh: ['慢慢来', '我活了 100 岁', '游到深海', '海洋很大', '你做得很好', '保护海龟'],
    speechEn: ['Take it slow', "I'm 100 years old", 'Off to the deep sea', 'The ocean is vast', "You're doing great", 'Protect the turtles'],
    priceCoins: 500,
    displayOrder: 5,
  },
  {
    slug: 'pet-dolphin',
    emoji: '🐬',
    nameZh: '海豚',
    nameEn: 'Dolphin',
    descriptionZh: '聪明的海上歌手。',
    descriptionEn: 'A clever ocean singer.',
    speechZh: ['咯咯咯', '跳起来！', '我会唱歌', '跟我游', '海里好玩', '你笑了'],
    speechEn: ['Click click click', 'Jumping!', 'I can sing', 'Swim with me', 'The sea is fun', "You're smiling"],
    priceCoins: 600,
    displayOrder: 6,
  },
  {
    slug: 'pet-bat',
    emoji: '🦇',
    nameZh: '蝙蝠',
    nameEn: 'Bat',
    descriptionZh: '夜里的安静朋友。',
    descriptionEn: 'A quiet friend of the night.',
    speechZh: ['晚上好', '我用耳朵看', '飞起来', '月亮真亮', '寻找虫子', '静悄悄'],
    speechEn: ['Good evening', 'I see with my ears', 'Up I go', 'The moon is bright', 'Hunting bugs', 'Quietly'],
    priceCoins: 900,
    displayOrder: 7,
  },
  {
    slug: 'pet-glow-jelly',
    emoji: '🪼',
    nameZh: '发光水母',
    nameEn: 'Glow Jellyfish',
    descriptionZh: '深海里闪闪发光的伙伴。',
    descriptionEn: 'A shimmering friend from the deep.',
    speechZh: ['闪闪发光', '我会发光', '飘啊飘', '深海里好凉', '星星一样', '安静的伙伴'],
    speechEn: ['Shimmer shimmer', 'I glow', 'Drift drift', 'Cool in the deep', 'Like a star', 'Quiet friend'],
    priceCoins: 1200,
    displayOrder: 8,
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { pets, shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let petsInserted = 0;
  let shopInserted = 0;

  for (const p of PETS) {
    // 1) pets row
    const existingPet = await db.select({ id: pets.id }).from(pets).where(eq(pets.slug, p.slug)).limit(1);
    if (existingPet.length === 0) {
      await db.insert(pets).values({
        slug: p.slug,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        emoji: p.emoji,
        descriptionZh: p.descriptionZh,
        descriptionEn: p.descriptionEn,
        speechZh: p.speechZh,
        speechEn: p.speechEn,
        displayOrder: p.displayOrder,
      });
      petsInserted++;
    }

    // 2) matching shop_items row (slug must match for ownership join)
    const existingShop = await db.select({ id: shopItems.id }).from(shopItems).where(eq(shopItems.slug, p.slug)).limit(1);
    if (existingShop.length === 0) {
      await db.insert(shopItems).values({
        slug: p.slug,
        kind: 'pet',
        name: `${p.nameZh} / ${p.nameEn}`,
        description: `${p.descriptionZh}\n${p.descriptionEn}`,
        imageUrl: p.emoji,
        priceCoins: p.priceCoins,
        isActive: true,
      });
      shopInserted++;
    }

    if (existingPet.length === 0 || existingShop.length === 0) {
      console.log(`  + ${p.slug} (${p.priceCoins} coins)`);
    }
  }

  console.log(`Done. Pets +${petsInserted}, shop_items +${shopInserted} (skipped ${PETS.length - petsInserted} pets, ${PETS.length - shopInserted} shop_items).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Smoke-test the seed**

`pnpm tsx scripts/seed-pets.ts`
Expected on first run: 8 pets + 8 shop_items inserted. Second run: 0 inserted.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/pets.ts src/db/schema/economy.ts src/db/schema/index.ts drizzle/0009_*.sql drizzle/meta/ scripts/seed-pets.ts
git commit -m "$(cat <<'EOF'
feat(pets): schema + seed 8 pets + shop_items rows

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pet DB layer

**Files:**
- Create: `src/lib/db/pets.ts`
- Create: `tests/unit/pets-db.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhereLimit = vi.fn();
  const selectInnerJoinWhere = vi.fn();
  const selectFrom = vi.fn().mockReturnValue({
    where: vi.fn(() => ({ limit: selectWhereLimit })),
    innerJoin: vi.fn(() => ({ where: selectInnerJoinWhere })),
  });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const insertOnConflictUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertOnConflictUpdate });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return { select, selectFrom, selectWhereLimit, selectInnerJoinWhere, insert, insertValues, insertOnConflictUpdate };
});

vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert } }));

import { getPetBySlug, getEquippedPet, setEquippedPet, listPetShopListings } from '@/lib/db/pets';

beforeEach(() => {
  mocks.selectWhereLimit.mockReset();
  mocks.selectInnerJoinWhere.mockReset();
  mocks.insertValues.mockClear();
  mocks.insertOnConflictUpdate.mockClear();
});

describe('getPetBySlug', () => {
  it('returns the pet row if it exists', async () => {
    mocks.selectWhereLimit.mockResolvedValue([{ id: 'p1', slug: 'pet-parrot' }]);
    const row = await getPetBySlug('pet-parrot');
    expect(row?.slug).toBe('pet-parrot');
  });
  it('returns null when no row', async () => {
    mocks.selectWhereLimit.mockResolvedValue([]);
    expect(await getPetBySlug('pet-nope')).toBeNull();
  });
});

describe('getEquippedPet', () => {
  it('returns the joined pet row when equipped', async () => {
    mocks.selectInnerJoinWhere.mockResolvedValue([
      { childPetEquipped: { petId: 'p1' }, pet: { id: 'p1', slug: 'pet-parrot', emoji: '🦜', speechZh: ['加油'], speechEn: ['Keep going!'] } },
    ]);
    const result = await getEquippedPet('c1');
    expect(result?.slug).toBe('pet-parrot');
  });
  it('returns null when no equip row', async () => {
    mocks.selectInnerJoinWhere.mockResolvedValue([]);
    expect(await getEquippedPet('c1')).toBeNull();
  });
});

describe('setEquippedPet', () => {
  it('upserts with onConflictDoUpdate', async () => {
    await setEquippedPet('c1', 'p1');
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ childId: 'c1', petId: 'p1' }));
    expect(mocks.insertOnConflictUpdate).toHaveBeenCalledTimes(1);
  });
  it('upserts NULL when petId is null (unequip)', async () => {
    await setEquippedPet('c1', null);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ childId: 'c1', petId: null }));
  });
});

describe('listPetShopListings', () => {
  it('returns array of { shopItem, pet } joined by slug', async () => {
    mocks.selectInnerJoinWhere.mockResolvedValue([
      { shopItem: { id: 's1', slug: 'pet-parrot', priceCoins: 300 }, pet: { id: 'p1', slug: 'pet-parrot', emoji: '🦜' } },
    ]);
    const rows = await listPetShopListings();
    expect(rows).toHaveLength(1);
    expect(rows[0].shopItem.slug).toBe('pet-parrot');
    expect(rows[0].pet.slug).toBe('pet-parrot');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`pnpm test tests/unit/pets-db.test.ts`

- [ ] **Step 3: Implement `src/lib/db/pets.ts`**

```ts
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childPetEquipped, pets, shopItems } from '@/db/schema';

export type PetRow = typeof pets.$inferSelect;
export type ShopItemRow = typeof shopItems.$inferSelect;

export interface PetShopListing {
  shopItem: ShopItemRow;
  pet: PetRow;
}

export async function getPetBySlug(slug: string): Promise<PetRow | null> {
  const rows = await db.select().from(pets).where(eq(pets.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getEquippedPet(childId: string): Promise<PetRow | null> {
  const rows = await db
    .select({ childPetEquipped, pet: pets })
    .from(childPetEquipped)
    .innerJoin(pets, eq(pets.id, childPetEquipped.petId))
    .where(eq(childPetEquipped.childId, childId))
    .limit(1);
  return rows[0]?.pet ?? null;
}

export async function setEquippedPet(
  childId: string,
  petId: string | null,
): Promise<void> {
  await db
    .insert(childPetEquipped)
    .values({ childId, petId })
    .onConflictDoUpdate({
      target: childPetEquipped.childId,
      set: { petId, updatedAt: sql`NOW()` },
    });
}

export async function listPetShopListings(): Promise<PetShopListing[]> {
  return await db
    .select({ shopItem: shopItems, pet: pets })
    .from(shopItems)
    .innerJoin(pets, eq(pets.slug, shopItems.slug))
    .where(and(eq(shopItems.kind, 'pet'), eq(shopItems.isActive, true)));
}
```

- [ ] **Step 4: Run tests — expect PASS**

`pnpm test tests/unit/pets-db.test.ts && pnpm typecheck`
Expected: green.

Note on the test mock: the select mock is shared between `.where().limit()` (returning `selectWhereLimit`) and `.innerJoin().where()` (returning `selectInnerJoinWhere`). Drizzle's chaining will dispatch to whichever the function uses. The 4 functions cover both patterns.

If the test fails because the mock chain doesn't quite match Drizzle's call shape, simplify by mocking each function individually with `vi.mock`'s factory. The goal is to verify the shape of the return values + the calls to `insert.values`, not the SQL.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/pets.ts tests/unit/pets-db.test.ts
git commit -m "$(cat <<'EOF'
feat(pets): DB layer — getPetBySlug, getEquippedPet, setEquippedPet, listPetShopListings

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `equipPetAction` server action

**Files:**
- Create: `src/lib/actions/pet.ts`
- Create: `tests/unit/equip-pet-action.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPetBySlug: vi.fn(),
  setEquippedPet: vi.fn(),
  listChildOwnedShopItemIds: vi.fn(),
  listShopItemsByKind: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/pets', () => ({ getPetBySlug: mocks.getPetBySlug, setEquippedPet: mocks.setEquippedPet }));
vi.mock('@/lib/db/shop', () => ({
  listChildOwnedShopItemIds: mocks.listChildOwnedShopItemIds,
  listShopItemsByKind: mocks.listShopItemsByKind,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { equipPetAction } from '@/lib/actions/pet';

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
});

describe('equipPetAction', () => {
  it('null slug (unequip) — always allowed, sets petId = null', async () => {
    await equipPetAction('c1', null);
    expect(mocks.setEquippedPet).toHaveBeenCalledWith('c1', null);
    expect(mocks.listChildOwnedShopItemIds).not.toHaveBeenCalled();
  });

  it('rejects an unknown pet slug', async () => {
    mocks.getPetBySlug.mockResolvedValue(null);
    await expect(equipPetAction('c1', 'pet-doesnt-exist')).rejects.toThrow(/unknown pet/i);
  });

  it('rejects unowned pet', async () => {
    mocks.getPetBySlug.mockResolvedValue({ id: 'p1', slug: 'pet-parrot' });
    mocks.listShopItemsByKind.mockResolvedValue([{ id: 'shop-p1', slug: 'pet-parrot' }]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue(new Set());
    await expect(equipPetAction('c1', 'pet-parrot')).rejects.toThrow(/not owned/i);
  });

  it('accepts owned pet, calls setEquippedPet with petId', async () => {
    mocks.getPetBySlug.mockResolvedValue({ id: 'p1', slug: 'pet-parrot' });
    mocks.listShopItemsByKind.mockResolvedValue([{ id: 'shop-p1', slug: 'pet-parrot' }]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue(new Set(['shop-p1']));
    const result = await equipPetAction('c1', 'pet-parrot');
    expect(mocks.setEquippedPet).toHaveBeenCalledWith('c1', 'p1');
    expect(result.petSlug).toBe('pet-parrot');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`pnpm test tests/unit/equip-pet-action.test.ts`

- [ ] **Step 3: Implement `src/lib/actions/pet.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPetBySlug, setEquippedPet } from '@/lib/db/pets';
import { listChildOwnedShopItemIds, listShopItemsByKind } from '@/lib/db/shop';

export async function equipPetAction(
  childId: string,
  slug: string | null,
): Promise<{ petSlug: string | null }> {
  await requireChild(childId);

  // Unequip is always allowed.
  if (slug === null) {
    await setEquippedPet(childId, null);
    revalidatePath(`/play/${childId}`);
    revalidatePath(`/play/${childId}/shop`);
    return { petSlug: null };
  }

  // Validate the pet exists in the catalog.
  const pet = await getPetBySlug(slug);
  if (!pet) {
    throw new Error(`Unknown pet slug: ${slug}`);
  }

  // Validate ownership via shop_purchases (matched by slug).
  const petShopItems = await listShopItemsByKind('pet');
  const match = petShopItems.find((s) => s.slug === slug);
  if (!match) {
    throw new Error(`Pet "${slug}" has no shop_items row — seed is out of sync`);
  }
  const owned = await listChildOwnedShopItemIds(childId);
  if (!owned.has(match.id)) {
    throw new Error(`Pet "${slug}" not owned`);
  }

  await setEquippedPet(childId, pet.id);
  revalidatePath(`/play/${childId}`);
  revalidatePath(`/play/${childId}/shop`);
  return { petSlug: slug };
}
```

- [ ] **Step 4: Run + typecheck**

`pnpm test tests/unit/equip-pet-action.test.ts && pnpm typecheck`
Expected: 4 tests green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/pet.ts tests/unit/equip-pet-action.test.ts
git commit -m "$(cat <<'EOF'
feat(pets): equipPetAction with ownership validation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `PetCompanion` component + tests

**Files:**
- Create: `src/components/play/PetCompanion.tsx`
- Modify: `src/app/globals.css` — add `@keyframes pet-bob` + `.animate-pet-bob`
- Create: `tests/unit/pet-companion.test.tsx`

- [ ] **Step 1: Add keyframes to globals.css**

Read `src/app/globals.css`. Find the existing `@keyframes bonus-pop` block (from PR #28). After it, append:

```css
@keyframes pet-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.animate-pet-bob {
  animation: pet-bob 2.4s ease-in-out infinite;
}

@keyframes pet-bubble {
  0% { opacity: 0; transform: translateY(4px) scale(0.96); }
  10%, 90% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-4px) scale(0.96); }
}

.animate-pet-bubble {
  animation: pet-bubble 2.5s ease-in-out forwards;
}
```

- [ ] **Step 2: Write failing tests**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { PetCompanion } from '@/components/play/PetCompanion';

const parrot = {
  emoji: '🦜',
  nameZh: '鹦鹉',
  nameEn: 'Parrot',
  speechZh: ['加油！', '你真棒！'],
  speechEn: ['Keep going!', "You're amazing!"],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('PetCompanion', () => {
  it('renders the emoji when a pet is provided', () => {
    render(<PetCompanion pet={parrot} />);
    expect(screen.getByText('🦜')).toBeInTheDocument();
  });

  it('renders nothing when pet is null', () => {
    const { container } = render(<PetCompanion pet={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a bilingual speech bubble on tap', () => {
    render(<PetCompanion pet={parrot} />);
    fireEvent.click(screen.getByRole('button', { name: /鹦鹉|Parrot/i }));
    // One of the 2 phrases should appear (random index). Assert both halves of the SAME index.
    const zh = screen.queryByText('加油！') ?? screen.queryByText('你真棒！');
    const en = screen.queryByText('Keep going!') ?? screen.queryByText("You're amazing!");
    expect(zh).toBeInTheDocument();
    expect(en).toBeInTheDocument();
  });

  it('bubble disappears after the timeout', () => {
    render(<PetCompanion pet={parrot} />);
    fireEvent.click(screen.getByRole('button', { name: /鹦鹉|Parrot/i }));
    expect(screen.queryByText(/加油|你真棒/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByText(/加油|你真棒/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

`pnpm test tests/unit/pet-companion.test.tsx`

- [ ] **Step 4: Implement `src/components/play/PetCompanion.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Pet {
  emoji: string;
  nameZh: string;
  nameEn: string;
  speechZh: string[];
  speechEn: string[];
}

interface Props {
  pet: Pet | null;
  size?: number;
}

export function PetCompanion({ pet, size = 56 }: Props) {
  const reduced = useReducedMotion();
  const [bubbleIndex, setBubbleIndex] = useState<number | null>(null);

  useEffect(() => {
    if (bubbleIndex === null) return;
    const t = setTimeout(() => setBubbleIndex(null), 2500);
    return () => clearTimeout(t);
  }, [bubbleIndex]);

  if (!pet) return null;

  const onTap = () => {
    if (pet.speechZh.length === 0) return;
    const i = Math.floor(Math.random() * pet.speechZh.length);
    setBubbleIndex(i);
  };

  return (
    <div className="relative">
      {bubbleIndex !== null && (
        <div
          className={`absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border-2 border-amber-300 bg-white px-3 py-2 text-center shadow-lg ${reduced ? '' : 'animate-pet-bubble'}`}
          style={{ minWidth: 120 }}
        >
          <div className="text-sm font-bold text-amber-950">{pet.speechZh[bubbleIndex]}</div>
          <div className="text-xs text-amber-800">{pet.speechEn[bubbleIndex]}</div>
        </div>
      )}
      <button
        type="button"
        onClick={onTap}
        aria-label={`${pet.nameZh} / ${pet.nameEn}`}
        className={`flex items-center justify-center rounded-full bg-amber-100 shadow-sm transition-transform active:scale-95 ${reduced ? '' : 'animate-pet-bob'}`}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        <span aria-hidden>{pet.emoji}</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run — expect PASS**

`pnpm test tests/unit/pet-companion.test.tsx`
Expected: all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/PetCompanion.tsx src/app/globals.css tests/unit/pet-companion.test.tsx
git commit -m "$(cat <<'EOF'
feat(pets): PetCompanion — bob idle + bilingual speech bubble

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `PetsTabBody` component + tests

**Files:**
- Create: `src/components/shop/PetsTabBody.tsx`
- Create: `tests/unit/pets-tab-body.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  equipPetAction: vi.fn(),
  purchaseShopItemAction: vi.fn(),
}));

vi.mock('@/lib/actions/pet', () => ({ equipPetAction: mocks.equipPetAction }));
vi.mock('@/lib/actions/shop', () => ({ purchaseShopItemAction: mocks.purchaseShopItemAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PetsTabBody } from '@/components/shop/PetsTabBody';

const listings = [
  {
    shopItem: { id: 'shop-p1', slug: 'pet-parrot', kind: 'pet', name: '鹦鹉 / Parrot', description: 'desc', imageUrl: '🦜', priceCoins: 300 },
    pet: { id: 'p1', slug: 'pet-parrot', emoji: '🦜', nameZh: '鹦鹉', nameEn: 'Parrot' },
  },
  {
    shopItem: { id: 'shop-p2', slug: 'pet-crab', kind: 'pet', name: '螃蟹 / Crab', description: 'desc', imageUrl: '🦀', priceCoins: 300 },
    pet: { id: 'p2', slug: 'pet-crab', emoji: '🦀', nameZh: '螃蟹', nameEn: 'Crab' },
  },
] as any;

afterEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe('PetsTabBody', () => {
  it('renders one card per listing', () => {
    render(
      <PetsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedPetSlug={null}
      />,
    );
    expect(screen.getByText(/Parrot/)).toBeInTheDocument();
    expect(screen.getByText(/Crab/)).toBeInTheDocument();
  });

  it('marks equipped pet as 已装备', () => {
    render(
      <PetsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['shop-p1'])}
        coinBalance={500}
        equippedPetSlug="pet-parrot"
      />,
    );
    const parrot = screen.getByText(/Parrot/).closest('article')!;
    expect(parrot).toHaveTextContent(/已装备|Equipped/);
  });

  it('clicking an owned-not-equipped card calls equipPetAction', async () => {
    mocks.equipPetAction.mockResolvedValue({ petSlug: 'pet-parrot' });
    render(
      <PetsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['shop-p1'])}
        coinBalance={500}
        equippedPetSlug={null}
      />,
    );
    const equipButton = screen.getByRole('button', { name: /装备/i });
    fireEvent.click(equipButton);
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.equipPetAction).toHaveBeenCalledWith('c1', 'pet-parrot');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`pnpm test tests/unit/pets-tab-body.test.tsx`

- [ ] **Step 3: Implement `src/components/shop/PetsTabBody.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { equipPetAction } from '@/lib/actions/pet';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import type { PetShopListing } from '@/lib/db/pets';

interface Props {
  childId: string;
  listings: PetShopListing[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
  equippedPetSlug: string | null;
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function PetsTabBody({
  childId,
  listings,
  ownedShopItemIds,
  coinBalance,
  equippedPetSlug,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const equip = (slug: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        await equipPetAction(childId, slug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Equip failed');
      }
    });
  };

  const purchase = (shopItemId: string, slug: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await purchaseShopItemAction(shopItemId, { childId });
        await equipPetAction(childId, slug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const isOwned = ownedShopItemIds.has(l.shopItem.id);
        const isEquipped = equippedPetSlug === l.shopItem.slug;
        const affordable = coinBalance >= l.shopItem.priceCoins;

        let actionLabel: string;
        let actionDisabled = false;
        let onAction: () => void;
        if (isEquipped) {
          actionLabel = '已装备';
          actionDisabled = true;
          onAction = () => {};
        } else if (isOwned) {
          actionLabel = '装备 / Equip';
          onAction = () => equip(l.shopItem.slug);
        } else if (!affordable) {
          actionLabel = `🪙 ${l.shopItem.priceCoins}`;
          actionDisabled = true;
          onAction = () => {};
        } else {
          actionLabel = `购买 / Buy 🪙 ${l.shopItem.priceCoins}`;
          onAction = () => purchase(l.shopItem.id, l.shopItem.slug);
        }

        return (
          <article
            key={l.shopItem.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="text-5xl" aria-hidden>
                {l.pet.emoji}
              </div>
              <div className="flex-1">
                <div className="text-base font-extrabold text-amber-950">{zh}</div>
                <div className="text-sm font-semibold text-amber-900">{en}</div>
              </div>
            </div>
            {l.shopItem.description && (
              <p className="text-xs whitespace-pre-line text-amber-900/80">{l.shopItem.description}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-900">🪙 {l.shopItem.priceCoins}</span>
              <button
                type="button"
                disabled={actionDisabled || pending}
                onClick={onAction}
                className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
              >
                {actionLabel}
              </button>
            </div>
            {isEquipped && (
              <span className="self-start rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">
                已装备 / Equipped
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run + typecheck**

`pnpm test tests/unit/pets-tab-body.test.tsx && pnpm typecheck`
Expected: 3 tests green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/shop/PetsTabBody.tsx tests/unit/pets-tab-body.test.tsx
git commit -m "$(cat <<'EOF'
feat(shop): PetsTabBody — pet shop tab UI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire shop tabs + page

**Files:**
- Modify: `src/components/shop/ShopCategoryTabs.tsx` (flip `pet` to enabled)
- Modify: `src/app/play/[childId]/shop/page.tsx` (fetch pet data)
- Modify: `src/app/play/[childId]/shop/ShopBody.tsx` (route `pet` tab)

- [ ] **Step 1: Flip Pet tab in `ShopCategoryTabs.tsx`**

Read the file. Find the `pet` entry and change `disabled: true` to `disabled: false`. No other changes.

- [ ] **Step 2: Update `src/app/play/[childId]/shop/page.tsx`**

Read the file. Add imports + parallel fetches:

```tsx
import { getEquippedPet, listPetShopListings } from '@/lib/db/pets';
```

In the `Promise.all`, add `listPetShopListings()` and `getEquippedPet(childId)`. Pass the results to ShopBody as new props:

```tsx
const [shop, sounds, ownedIds, settings, balance, petListings, equippedPet] = await Promise.all([
  getShopPageData(childId),
  listSoundThemeListings(),
  listChildOwnedShopItemIds(childId),
  getChildSettings(childId),
  getCoinBalance(childId),
  listPetShopListings(),
  getEquippedPet(childId),
]);

return (
  <ShopBody
    childId={childId}
    initialCoinBalance={balance.balance}
    listings={shop.listings}
    initialOwnedShopItemIds={Array.from(ownedIds)}
    initialEquipped={shop.equipped}
    soundListings={sounds}
    initialEquippedSoundThemeSlug={settings?.soundThemeSlug ?? null}
    petListings={petListings}
    initialEquippedPetSlug={equippedPet?.slug ?? null}
  />
);
```

Adapt to the actual existing shape if it differs.

- [ ] **Step 3: Update `src/app/play/[childId]/shop/ShopBody.tsx`**

Add to the `Props` interface:

```tsx
import type { PetShopListing } from '@/lib/db/pets';
import { PetsTabBody } from '@/components/shop/PetsTabBody';

interface Props {
  // ... existing fields ...
  petListings: PetShopListing[];
  initialEquippedPetSlug: string | null;
}
```

Destructure in the function signature.

Replace the existing tab routing block. After the `sound` branch, add:

```tsx
{activeTab === 'pet' && (
  <PetsTabBody
    childId={childId}
    listings={petListings}
    ownedShopItemIds={ownedIds}
    coinBalance={coinBalance}
    equippedPetSlug={initialEquippedPetSlug}
  />
)}
```

Update the placeholder branch to drop `'pet'`:

```tsx
{(activeTab === 'decor' || activeTab === 'powerup') && (
  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center text-amber-900/70">
    <div className="text-5xl">🚧</div>
    <div className="mt-3 text-lg font-bold">即将上线</div>
    <div className="mt-1 text-sm">下次更新见！</div>
  </div>
)}
```

- [ ] **Step 4: Typecheck + full test suite**

`pnpm typecheck && pnpm test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/shop/ShopCategoryTabs.tsx "src/app/play/[childId]/shop/page.tsx" "src/app/play/[childId]/shop/ShopBody.tsx"
git commit -m "$(cat <<'EOF'
feat(shop): wire Pet tab into ShopBody

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Mount PetCompanion on island map

**Files:**
- Modify: `src/app/play/[childId]/page.tsx`

- [ ] **Step 1: Add imports + fetch**

Read the file. Add imports near the top:

```tsx
import { PetCompanion } from '@/components/play/PetCompanion';
import { getEquippedPet } from '@/lib/db/pets';
```

In the `Promise.all` block at the top of `PlayHomePage`, add `getEquippedPet(child.id)` alongside the other fetches:

```tsx
const [playableWeeks, progressRows, balance, activePacks, equipped, pet] =
  await Promise.all([
    listChildPlayableWeeks(child.id),
    listProgressByChild(child.id),
    getCoinBalance(child.id),
    listActivePacks(),
    getEquippedAvatar(child.id),
    getEquippedPet(child.id),
  ]);
```

- [ ] **Step 2: Render `<PetCompanion>` beside avatar**

Find the JSX block (around line 67-75) that wraps `<AvatarRender>`:

```tsx
<div className="flex items-center gap-3">
  <AvatarRender ... />
  <div>
    <h1>...</h1>
    ...
  </div>
</div>
```

Add `<PetCompanion>` as a sibling of `<AvatarRender>` inside that flex container:

```tsx
<div className="flex items-center gap-3">
  <AvatarRender
    equipped={equippedRefs}
    size={64}
    label={`${child.displayName} 的形象`}
    className="shrink-0"
  />
  <PetCompanion
    pet={
      pet
        ? {
            emoji: pet.emoji,
            nameZh: pet.nameZh,
            nameEn: pet.nameEn,
            speechZh: pet.speechZh,
            speechEn: pet.speechEn,
          }
        : null
    }
  />
  <div>
    <h1 className="font-hanzi text-2xl font-bold tracking-tight text-[var(--color-ocean-900)]">
      {child.displayName} 的航海图
    </h1>
    ...
  </div>
</div>
```

(If `child.displayName` text or layout is different, adapt — the spirit is "PetCompanion as sibling between AvatarRender and the title block".)

- [ ] **Step 3: Typecheck + tests**

`pnpm typecheck && pnpm test`
Expected: green.

- [ ] **Step 4: Manual dev walkthrough (optional but recommended)**

`pnpm dev` → log in as a child with a pet equipped (or buy a pet in the shop first) → return to island map → confirm:
- Pet emoji appears beside avatar, gently bobs.
- Tap pet → bilingual speech bubble appears for ~2.5s.
- Reduced motion: idle bob disabled; tap still works.

- [ ] **Step 5: Commit**

```bash
git add "src/app/play/[childId]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(play): mount PetCompanion beside avatar on island map

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final QA + CLAUDE.md + handoff

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Four-green gate**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All exit 0. Fix any breakage inline.

- [ ] **Step 2: Update CLAUDE.md**

Bump "last refreshed" to `2026-05-23`. Update "Shipped" line to `PR #1 → #33`. Append a new bullet after PR #32:

```markdown
- **PR #33 (just shipped, 2026-05-23)** — Static pet companion. 8 pets (parrot/crab/ship cat/monkey/sea turtle/dolphin/bat/glow jellyfish) live in the new Pet shop tab, 300–1200 coins. Equipped pet renders beside the avatar on the island map only; tap → random bilingual speech bubble for ~2.5s. New tables `pets` + `child_pet_equipped`; pets seeded into `shop_items` via slug join; ownership derives from `shop_purchases`. `equipPetAction` validates via `listChildOwnedShopItemIds`. Shop now has 3 live tabs (Avatar / Sounds / Pet); Decor + Powerup still queued.
```

- [ ] **Step 3: Commit + report branch state**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude.md): record PR #33 (pet companion)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git log --oneline main..HEAD
git status
```

- [ ] **Step 4: STOP — do NOT push**

Working tree clean. Controller pushes + opens PR + runs prod seed (`pnpm tsx scripts/seed-pets.ts`) after merge.

## Report
- Status, command exit codes, final commit list, anything unexpected.

---

## Self-Review

**1. Spec coverage:**
- 8 pets in catalog → Task 1 seed.
- `pets` + `child_pet_equipped` tables → Task 1 schema.
- `shop_item_kind` enum +'pet' → Task 1.
- DB layer → Task 2.
- `equipPetAction` → Task 3.
- `PetCompanion` client component (bob idle + speech bubble) → Task 4 + keyframes.
- `PetsTabBody` shop tab → Task 5.
- Wiring (ShopCategoryTabs / ShopBody / shop page) → Task 6.
- Island map mount → Task 7.
- CLAUDE.md + QA → Task 8.
- Tests for db / action / both new components → Tasks 2, 3, 4, 5.

**2. Placeholder scan:** No "TBD", no "similar to". Every code step has actual code. The "adapt to actual existing structure" hedges in Tasks 6+7 are non-blocking — described clearly enough.

**3. Type consistency:**
- `PetRow` / `PetShopListing` / `ShopItemRow` defined in Task 2 (`@/lib/db/pets`), consumed in Tasks 3 (action), 5 (PetsTabBody), 6 (ShopBody), 7 (island map).
- `equipPetAction(childId: string, slug: string | null): Promise<{ petSlug: string | null }>` consistent in Tasks 3, 5.
- `PetCompanion` props `pet: { emoji, nameZh, nameEn, speechZh: string[], speechEn: string[] } | null` consistent in Tasks 4 and 7.

No drift.
