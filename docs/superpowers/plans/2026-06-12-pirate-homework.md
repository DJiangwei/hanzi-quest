# Pirate Homework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parent-authored, per-week "homework" section to each island week — 3 structured exercise types (char_quiz / word_building / sentence_order) Yinuo plays for coins + XP + a once-per-week-per-day card.

**Architecture:** A standalone subsystem (NOT compiled into `week_levels`). A new `homework_items` table holds zod-validated JSON config per item. Parent authors via an editor on `/parent/week/[id]/review`; the kid plays via `HomeworkRunner` (reuses `MultipleChoiceQuiz` + a new `SentenceOrderScene`). Rewards flow through a new `finishHomeworkAction` that uses a new `'homework'` card source (review cadence). Surfaced as a conditional section on `WeekHub`.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Postgres/Neon), Zod, Vitest + RTL + jsdom. Spec: `docs/superpowers/specs/2026-06-12-pirate-homework-design.md`.

**Conventions (from CLAUDE.md):** `'use server'` files export only async functions (pure helpers/types go in `src/lib/homework/` or `src/lib/errors/`). Never import `@/lib/db/*` into client code. Tests mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`. Bilingual chrome (`中文 / English`) on every kid-facing label. Four-green gate at PR open: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Append-only migrations (generate, never edit committed SQL).

---

## File Structure

**New**
- `src/db/schema/homework.ts` — `homeworkItemType` pgEnum + `homeworkItems` table.
- `src/lib/homework/schemas.ts` — zod config schemas + `parseHomeworkConfig` + exported TS types (pure, client-safe).
- `src/lib/db/homework.ts` — CRUD + reorder + `listHomeworkItems` + `weekHasHomework` (server-only).
- `src/lib/actions/homework.ts` — parent actions + `finishHomeworkAction` (`'use server'`).
- `src/components/scenes/SentenceOrderScene.tsx` — tap-to-order sentence scene.
- `src/components/homework/HomeworkRunner.tsx` — kid runner.
- `src/components/homework/HomeworkFanfare.tsx` — done screen (thin wrapper over copy; reuses `CardChestReveal`).
- `src/app/play/[childId]/homework/[weekId]/page.tsx` — kid route.
- `src/components/parent/HomeworkEditor.tsx` + `src/components/parent/homework/{CharQuizForm,WordBuildingForm,SentenceOrderForm}.tsx` — parent authoring.

**Modified**
- `src/db/schema/index.ts` — re-export homework schema.
- `src/db/schema/economy.ts` — add `'homework_complete'` to `coinReason` enum.
- `src/lib/db/coins.ts` — add `'homework_complete'` to `AwardCoinReason`.
- `src/lib/db/xp.ts` — add `'homework'` to `XpSource` (text column, no migration).
- `src/lib/db/grants.ts` + `src/lib/actions/gacha.ts` — add `'homework'` to the card-source unions.
- `src/components/play/WeekHub.tsx` + `src/app/play/[childId]/week/[weekId]/page.tsx` — conditional homework section card.
- `src/app/parent/week/[id]/review/page.tsx` — mount `HomeworkEditor`.

---

## Task 1: Schema + migration

**Files:**
- Create: `src/db/schema/homework.ts`
- Modify: `src/db/schema/index.ts`, `src/db/schema/economy.ts:15`
- Test: `tests/unit/homework-schema.test.ts`

- [ ] **Step 1: Write the schema file**

`src/db/schema/homework.ts`:
```ts
import { index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { weeks } from './content';

export const homeworkItemType = pgEnum('homework_item_type', [
  'char_quiz',
  'word_building',
  'sentence_order',
]);

export const homeworkItems = pgTable(
  'homework_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    type: homeworkItemType('type').notNull(),
    config: jsonb('config').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('homework_items_week_idx').on(t.weekId)],
);
```

- [ ] **Step 2: Add `'homework_complete'` to the coin_reason enum**

In `src/db/schema/economy.ts`, append to the `coinReason` pgEnum array (line ~15) a final value `'homework_complete'` (keep all existing values in order, add the new one last):
```ts
export const coinReason = pgEnum('coin_reason', [
  // ...all existing values unchanged...
  'homework_complete',
]);
```

- [ ] **Step 3: Re-export from the schema index**

In `src/db/schema/index.ts` add: `export * from './homework';`

- [ ] **Step 4: Write the schema smoke test**

`tests/unit/homework-schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { homeworkItems, homeworkItemType } from '@/db/schema';

describe('homework schema', () => {
  it('exposes the homework_items table + enum with the 3 types', () => {
    expect(homeworkItems).toBeDefined();
    expect(homeworkItemType.enumValues).toEqual([
      'char_quiz',
      'word_building',
      'sentence_order',
    ]);
  });
});
```

- [ ] **Step 5: Generate the migration**

Run: `pnpm drizzle-kit generate` (the repo's generate script — confirm the exact name in `package.json`'s scripts, e.g. `pnpm db:generate`).
Expected: a new `drizzle/00NN_*.sql` creating `homework_item_type`, `homework_items`, and `ALTER TYPE coin_reason ADD VALUE 'homework_complete'`. Do NOT hand-edit it.

- [ ] **Step 6: Run test + typecheck**

Run: `pnpm test -- homework-schema && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**
```bash
git add src/db/schema/homework.ts src/db/schema/index.ts src/db/schema/economy.ts drizzle/ tests/unit/homework-schema.test.ts
git commit -m "feat(homework): homework_items table + enum + coin reason"
```

---

## Task 2: Config schemas (zod)

**Files:**
- Create: `src/lib/homework/schemas.ts`
- Test: `tests/unit/homework-schemas.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/homework-schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseHomeworkConfig } from '@/lib/homework/schemas';

describe('parseHomeworkConfig', () => {
  it('parses a valid char_quiz', () => {
    const cfg = parseHomeworkConfig('char_quiz', {
      hanzi: '水',
      questionZh: '「水」是什么意思？',
      options: [
        { textZh: '水', textEn: 'water' },
        { textZh: '火', textEn: 'fire' },
      ],
      correctIndex: 0,
    });
    expect(cfg.type).toBe('char_quiz');
  });

  it('rejects a char_quiz whose correctIndex is out of range', () => {
    expect(() =>
      parseHomeworkConfig('char_quiz', {
        questionZh: 'q',
        options: [{ textZh: 'a', textEn: 'a' }],
        correctIndex: 5,
      }),
    ).toThrow();
  });

  it('parses word_building + sentence_order', () => {
    expect(
      parseHomeworkConfig('word_building', {
        baseChar: '水',
        correctWord: '喝水',
        distractors: ['火车', '吃饭'],
      }).type,
    ).toBe('word_building');
    expect(
      parseHomeworkConfig('sentence_order', {
        tokens: ['我', '喝', '水'],
      }).type,
    ).toBe('sentence_order');
  });

  it('rejects sentence_order with fewer than 2 tokens', () => {
    expect(() => parseHomeworkConfig('sentence_order', { tokens: ['我'] })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- homework-schemas`
Expected: FAIL ("parseHomeworkConfig is not a function").

- [ ] **Step 3: Implement**

`src/lib/homework/schemas.ts`:
```ts
import { z } from 'zod';

export const HOMEWORK_TYPES = ['char_quiz', 'word_building', 'sentence_order'] as const;
export type HomeworkType = (typeof HOMEWORK_TYPES)[number];

const charQuizConfig = z
  .object({
    hanzi: z.string().trim().min(1).max(4).optional(),
    questionZh: z.string().trim().min(1),
    options: z
      .array(z.object({ textZh: z.string().trim().min(1), textEn: z.string().trim().min(1) }))
      .min(2)
      .max(4),
    correctIndex: z.number().int().min(0),
  })
  .refine((c) => c.correctIndex < c.options.length, {
    message: 'correctIndex out of range',
    path: ['correctIndex'],
  });

const wordBuildingConfig = z.object({
  baseChar: z.string().trim().min(1).max(2),
  correctWord: z.string().trim().min(1),
  distractors: z.array(z.string().trim().min(1)).min(1).max(5),
  correctMeaningEn: z.string().trim().min(1).optional(),
});

const sentenceOrderConfig = z.object({
  tokens: z.array(z.string().trim().min(1)).min(2).max(12),
  translationEn: z.string().trim().min(1).optional(),
});

export type CharQuizConfig = z.infer<typeof charQuizConfig>;
export type WordBuildingConfig = z.infer<typeof wordBuildingConfig>;
export type SentenceOrderConfig = z.infer<typeof sentenceOrderConfig>;

export type HomeworkItemConfig =
  | ({ type: 'char_quiz' } & CharQuizConfig)
  | ({ type: 'word_building' } & WordBuildingConfig)
  | ({ type: 'sentence_order' } & SentenceOrderConfig);

/** Validate raw config for a type; throws ZodError on bad shape. */
export function parseHomeworkConfig(type: HomeworkType, raw: unknown): HomeworkItemConfig {
  switch (type) {
    case 'char_quiz':
      return { type, ...charQuizConfig.parse(raw) };
    case 'word_building':
      return { type, ...wordBuildingConfig.parse(raw) };
    case 'sentence_order':
      return { type, ...sentenceOrderConfig.parse(raw) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- homework-schemas`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/homework/schemas.ts tests/unit/homework-schemas.test.ts
git commit -m "feat(homework): zod config schemas per exercise type"
```

---

## Task 3: DB layer

**Files:**
- Create: `src/lib/db/homework.ts`
- Test: `tests/unit/homework-db.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/homework-db.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert, update: mocks.update, delete: mocks.delete } }));

import { listHomeworkItems, weekHasHomework } from '@/lib/db/homework';

beforeEach(() => vi.clearAllMocks());

describe('homework db', () => {
  it('listHomeworkItems orders by position', async () => {
    const rows = [{ id: 'h1', weekId: 'w1', position: 0, type: 'char_quiz', config: {} }];
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }),
    });
    const items = await listHomeworkItems('w1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('h1');
  });

  it('weekHasHomework returns true when at least one row exists', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'h1' }]) }) }),
    });
    expect(await weekHasHomework('w1')).toBe(true);
  });

  it('weekHasHomework returns false when none', async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    expect(await weekHasHomework('w1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- homework-db`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/db/homework.ts`:
```ts
// NEVER import this file from client code. It pulls in postgres.
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { homeworkItems } from '@/db/schema';
import type { HomeworkType } from '@/lib/homework/schemas';

export interface HomeworkItemRow {
  id: string;
  weekId: string;
  position: number;
  type: HomeworkType;
  config: unknown;
}

export async function listHomeworkItems(weekId: string): Promise<HomeworkItemRow[]> {
  const rows = await db
    .select({
      id: homeworkItems.id,
      weekId: homeworkItems.weekId,
      position: homeworkItems.position,
      type: homeworkItems.type,
      config: homeworkItems.config,
    })
    .from(homeworkItems)
    .where(eq(homeworkItems.weekId, weekId))
    .orderBy(asc(homeworkItems.position));
  return rows as HomeworkItemRow[];
}

export async function weekHasHomework(weekId: string): Promise<boolean> {
  const rows = await db
    .select({ id: homeworkItems.id })
    .from(homeworkItems)
    .where(eq(homeworkItems.weekId, weekId))
    .limit(1);
  return rows.length > 0;
}

export async function createHomeworkItem(input: {
  weekId: string;
  type: HomeworkType;
  config: unknown;
}): Promise<string> {
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${homeworkItems.position}), -1)`.as('max') })
    .from(homeworkItems)
    .where(eq(homeworkItems.weekId, input.weekId));
  const position = Number(maxRow?.max ?? -1) + 1;
  const [row] = await db
    .insert(homeworkItems)
    .values({ weekId: input.weekId, type: input.type, config: input.config, position })
    .returning({ id: homeworkItems.id });
  return row!.id;
}

export async function updateHomeworkItem(id: string, config: unknown): Promise<void> {
  await db
    .update(homeworkItems)
    .set({ config, updatedAt: new Date() })
    .where(eq(homeworkItems.id, id));
}

export async function deleteHomeworkItem(id: string): Promise<void> {
  await db.delete(homeworkItems).where(eq(homeworkItems.id, id));
}

export async function reorderHomeworkItems(weekId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(homeworkItems)
        .set({ position: i })
        .where(and(eq(homeworkItems.id, orderedIds[i]!), eq(homeworkItems.weekId, weekId)));
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- homework-db`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/db/homework.ts tests/unit/homework-db.test.ts
git commit -m "feat(homework): db layer (CRUD + reorder + weekHasHomework)"
```

---

## Task 4: `'homework'` card source

**Files:**
- Modify: `src/lib/db/grants.ts` (the `pullCardInTx` `source` union), `src/lib/actions/gacha.ts` (`CardGrantSource`), `src/lib/db/xp.ts` (`XpSource`)
- Test: `tests/unit/homework-card-source.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/homework-card-source.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { CardGrantSource } from '@/lib/actions/gacha';

describe('homework card source', () => {
  it("'homework' is an assignable CardGrantSource", () => {
    const s: CardGrantSource = 'homework';
    expect(s).toBe('homework');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm typecheck`
Expected: FAIL ("Type '\"homework\"' is not assignable to type 'CardGrantSource'").

- [ ] **Step 3: Implement (3 one-line union additions)**

In `src/lib/db/grants.ts`, the `pullCardInTx` `source` parameter union — append `| 'homework'`:
```ts
  source: 'boss_clear' | 'perfect_week' | 'story_chapter' | 'review' | 'practice' | 'homework',
```
In `src/lib/actions/gacha.ts`, the `CardGrantSource` union — append `| 'homework'`.
In `src/lib/db/xp.ts`, the `XpSource` union — append `| 'homework'` (the column is `text`, so no migration).

- [ ] **Step 4: Run typecheck + test**

Run: `pnpm typecheck && pnpm test -- homework-card-source`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/db/grants.ts src/lib/actions/gacha.ts src/lib/db/xp.ts tests/unit/homework-card-source.test.ts
git commit -m "feat(homework): add 'homework' card + xp source"
```

---

## Task 5: `finishHomeworkAction` (rewards)

**Files:**
- Modify: `src/lib/actions/homework.ts` (create in this task)
- Test: `tests/unit/finish-homework-action.test.ts`

The action awards coins + XP + a card, all gated on the `granted` path of `pullCardForChild('homework', \`${weekId}:${dayUtc}\`)` (once per week per day). `already_granted` → `homework_done_today`; `daily_cap_reached` → `daily_cap_reached`.

- [ ] **Step 1: Write the failing test**

`tests/unit/finish-homework-action.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'c1' } }),
  getPlayableWeekForChild: vi.fn().mockResolvedValue({ id: 'w1' }),
  pullCardForChild: vi.fn(),
  awardCoins: vi.fn().mockResolvedValue(undefined),
  awardXp: vi.fn().mockResolvedValue({ totalXp: 30, level: 1, leveledUp: false }),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild, assertParent: vi.fn() }));
vi.mock('@/lib/db/weeks', () => ({ getPlayableWeekForChild: mocks.getPlayableWeekForChild }));
vi.mock('@/lib/actions/gacha', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: mocks.awardCoins }));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: mocks.tickQuestProgressSafe }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-06-12' }));
vi.mock('@/lib/db/homework', () => ({ listHomeworkItems: vi.fn(), weekHasHomework: vi.fn(), createHomeworkItem: vi.fn(), updateHomeworkItem: vi.fn(), deleteHomeworkItem: vi.fn(), reorderHomeworkItems: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { finishHomeworkAction } from '@/lib/actions/homework';

const granted = {
  granted: true as const, itemId: 'i1', packId: 'p1', packSlug: 'flags', slug: 'cn',
  nameZh: '中国', nameEn: 'China', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0, cardsToday: 1,
};

beforeEach(() => vi.clearAllMocks());

describe('finishHomeworkAction', () => {
  it('granted → awards coins + XP and returns the card', async () => {
    mocks.pullCardForChild.mockResolvedValue(granted);
    const res = await finishHomeworkAction({ childId: 'c1', weekId: 'w1' });
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'homework', 'w1:2026-06-12');
    expect(mocks.awardCoins).toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(1);
    expect(res.cardMessage).toBeNull();
  });

  it('already_granted → no coins, homework_done_today', async () => {
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const res = await finishHomeworkAction({ childId: 'c1', weekId: 'w1' });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(res.cardGrants).toEqual([]);
    expect(res.cardMessage).toBe('homework_done_today');
  });

  it('daily_cap_reached → no coins, daily_cap_reached', async () => {
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'daily_cap_reached' });
    const res = await finishHomeworkAction({ childId: 'c1', weekId: 'w1' });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(res.cardMessage).toBe('daily_cap_reached');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- finish-homework-action`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement (action file skeleton + finishHomeworkAction)**

`src/lib/actions/homework.ts`:
```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { pullCardForChild } from '@/lib/actions/gacha';
import { awardCoins } from '@/lib/db/coins';
import { awardXp } from '@/lib/db/xp';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import { todayUtcIso } from '@/lib/db/streaks';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { CardSkipReason } from '@/lib/actions/play';

const HOMEWORK_COMPLETE_COINS = 80;
const HOMEWORK_XP = 30;

const FinishHomeworkSchema = z.object({
  childId: z.string().uuid(),
  weekId: z.string().uuid(),
});

export async function finishHomeworkAction(
  input: z.input<typeof FinishHomeworkSchema>,
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  cardMessage: CardSkipReason | 'homework_done_today' | null;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishHomeworkSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  const week = await getPlayableWeekForChild(child.id, parsed.weekId);
  if (!week) throw new Error('Week not playable for this child');

  const refId = `${parsed.weekId}:${todayUtcIso()}`;
  let card: RevealCard | null = null;
  let cardMessage: CardSkipReason | 'homework_done_today' | null = null;
  let xp = { gained: 0, level: 1, leveledUp: false };

  try {
    const res = await pullCardForChild(child.id, 'homework', refId);
    if (res.granted) {
      // First homework completion today → award coins + XP + surface the card.
      await awardCoins({
        childId: child.id,
        delta: HOMEWORK_COMPLETE_COINS,
        reason: 'homework_complete',
        refType: 'week',
        refId,
      });
      const xpRes = await awardXp(child.id, HOMEWORK_XP, 'homework', refId);
      xp = { gained: HOMEWORK_XP, level: xpRes.level, leveledUp: xpRes.leveledUp };
      void tickQuestProgressSafe(child.id, 'earn_card', 1);
      card = {
        id: res.itemId, slug: res.slug, packSlug: res.packSlug,
        nameZh: res.nameZh, nameEn: res.nameEn, loreZh: res.loreZh, loreEn: res.loreEn,
        isDupe: res.isDupe, shardsAfter: res.shardsAfter,
      };
    } else if (res.reason === 'already_granted') {
      cardMessage = 'homework_done_today';
    } else if (res.reason === 'daily_cap_reached') {
      cardMessage = 'daily_cap_reached';
    }
  } catch (err) {
    console.error('[finishHomeworkAction] reward error:', err);
  }

  revalidatePath(`/play/${child.id}/week/${parsed.weekId}`);
  return { ok: true, cardGrants: card ? [card] : [], cardMessage, xp };
}
```

> Note: `CardSkipReason` is exported from `src/lib/actions/play.ts` (card-rebalance PR). `RevealCard` shape per `src/lib/play/reveal-card.ts`. Confirm both before writing the card object.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- finish-homework-action`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/actions/homework.ts tests/unit/finish-homework-action.test.ts
git commit -m "feat(homework): finishHomeworkAction (coins+XP+card once/week/day)"
```

---

## Task 6: Parent authoring actions

**Files:**
- Modify: `src/lib/actions/homework.ts` (add parent actions)
- Test: `tests/unit/homework-actions.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/homework-actions.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertParent: vi.fn().mockResolvedValue({ id: 'p1' }),
  getWeekOwnedBy: vi.fn().mockResolvedValue({ id: 'w1' }),
  createHomeworkItem: vi.fn().mockResolvedValue('h1'),
  updateHomeworkItem: vi.fn().mockResolvedValue(undefined),
  deleteHomeworkItem: vi.fn().mockResolvedValue(undefined),
  reorderHomeworkItems: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth/guards', () => ({ assertParent: mocks.assertParent, requireChild: vi.fn() }));
vi.mock('@/lib/db/weeks', () => ({ getWeekOwnedBy: mocks.getWeekOwnedBy, getPlayableWeekForChild: vi.fn() }));
vi.mock('@/lib/db/homework', () => ({
  createHomeworkItem: mocks.createHomeworkItem,
  updateHomeworkItem: mocks.updateHomeworkItem,
  deleteHomeworkItem: mocks.deleteHomeworkItem,
  reorderHomeworkItems: mocks.reorderHomeworkItems,
  listHomeworkItems: vi.fn(), weekHasHomework: vi.fn(),
}));
vi.mock('@/lib/actions/gacha', () => ({ pullCardForChild: vi.fn() }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: vi.fn() }));
vi.mock('@/lib/db/xp', () => ({ awardXp: vi.fn() }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: vi.fn() }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-06-12' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { addHomeworkItemAction, deleteHomeworkItemAction } from '@/lib/actions/homework';

beforeEach(() => vi.clearAllMocks());

describe('homework parent actions', () => {
  it('addHomeworkItemAction validates config + creates the item', async () => {
    const id = await addHomeworkItemAction('w1', 'sentence_order', { tokens: ['我', '爱', '你'] });
    expect(id).toBe('h1');
    expect(mocks.createHomeworkItem).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'w1', type: 'sentence_order' }),
    );
  });

  it('addHomeworkItemAction rejects an invalid config', async () => {
    await expect(
      addHomeworkItemAction('w1', 'sentence_order', { tokens: ['x'] }),
    ).rejects.toThrow();
    expect(mocks.createHomeworkItem).not.toHaveBeenCalled();
  });

  it('deleteHomeworkItemAction calls the db', async () => {
    await deleteHomeworkItemAction('w1', 'h1');
    expect(mocks.deleteHomeworkItem).toHaveBeenCalledWith('h1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- homework-actions`
Expected: FAIL (exports missing).

- [ ] **Step 3: Implement (append to `src/lib/actions/homework.ts`)**

```ts
import { assertParent } from '@/lib/auth/guards';
import { getWeekOwnedBy } from '@/lib/db/weeks';
import {
  createHomeworkItem,
  updateHomeworkItem,
  deleteHomeworkItem,
  reorderHomeworkItems,
} from '@/lib/db/homework';
import { parseHomeworkConfig, type HomeworkType } from '@/lib/homework/schemas';

async function assertOwnsWeek(weekId: string): Promise<void> {
  const parent = await assertParent();
  const week = await getWeekOwnedBy(weekId, parent.id);
  if (!week) throw new Error('Week not found for this parent');
}

export async function addHomeworkItemAction(
  weekId: string,
  type: HomeworkType,
  rawConfig: unknown,
): Promise<string> {
  await assertOwnsWeek(weekId);
  const config = parseHomeworkConfig(type, rawConfig); // throws on bad shape
  const id = await createHomeworkItem({ weekId, type, config });
  revalidatePath(`/parent/week/${weekId}/review`);
  return id;
}

export async function updateHomeworkItemAction(
  weekId: string,
  id: string,
  type: HomeworkType,
  rawConfig: unknown,
): Promise<void> {
  await assertOwnsWeek(weekId);
  const config = parseHomeworkConfig(type, rawConfig);
  await updateHomeworkItem(id, config);
  revalidatePath(`/parent/week/${weekId}/review`);
}

export async function deleteHomeworkItemAction(weekId: string, id: string): Promise<void> {
  await assertOwnsWeek(weekId);
  await deleteHomeworkItem(id);
  revalidatePath(`/parent/week/${weekId}/review`);
}

export async function reorderHomeworkItemsAction(
  weekId: string,
  orderedIds: string[],
): Promise<void> {
  await assertOwnsWeek(weekId);
  await reorderHomeworkItems(weekId, orderedIds);
  revalidatePath(`/parent/week/${weekId}/review`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- homework-actions`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/actions/homework.ts tests/unit/homework-actions.test.ts
git commit -m "feat(homework): parent authoring actions (add/update/delete/reorder)"
```

---

## Task 7: SentenceOrderScene

**Files:**
- Create: `src/components/scenes/SentenceOrderScene.tsx`
- Test: `tests/unit/sentence-order-scene.test.tsx`

Behavior: shows shuffled token chips + an answer row. Tapping a chip appends it to the answer row (removes from the pool). When the answer row length === tokens.length, compare to the correct order: match → `onComplete(true)`; mismatch → shake the answer row, then clear it back to the pool for a retry. A 重来 / Reset chip clears the answer row anytime. Respects `useReducedMotion`. Bilingual prompt "连词成句 / Put the words in order".

- [ ] **Step 1: Write the failing test**

`tests/unit/sentence-order-scene.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentenceOrderScene } from '@/components/scenes/SentenceOrderScene';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

describe('SentenceOrderScene', () => {
  it('renders one chip per token + bilingual prompt', () => {
    render(<SentenceOrderScene tokens={['我', '爱', '你']} onComplete={() => {}} />);
    expect(screen.getByText('连词成句', { exact: false })).toBeInTheDocument();
    for (const t of ['我', '爱', '你']) {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
    }
  });

  it('calls onComplete(true) when tapped in the correct order', () => {
    const onComplete = vi.fn();
    render(<SentenceOrderScene tokens={['我', '爱', '你']} onComplete={onComplete} />);
    screen.getByRole('button', { name: '我' }).click();
    screen.getByRole('button', { name: '爱' }).click();
    screen.getByRole('button', { name: '你' }).click();
    expect(onComplete).toHaveBeenCalledWith(true);
  });
});
```

> Note on testability: render the pool chips with the token text as their accessible name, and **disable** a chip once placed (so `getByRole('button', { name })` still resolves to the pool chip until placed). Place the chips in DOM order in the pool so the test can tap them deterministically; the *visual* shuffle is applied via CSS order or a shuffled index that does not change accessible names. Keep the assembled-order comparison against the original `tokens`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- sentence-order-scene`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/components/scenes/SentenceOrderScene.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';

interface Props {
  tokens: string[];
  translationEn?: string | null;
  onComplete: (correct: boolean) => void;
}

interface Token {
  id: number;
  text: string;
}

export function SentenceOrderScene({ tokens, translationEn, onComplete }: Props) {
  const reduced = useReducedMotion();
  const pool = useMemo<Token[]>(() => tokens.map((text, id) => ({ id, text })), [tokens]);
  // Deterministic visual order (stable per render; does not change accessible names).
  const visualOrder = useMemo(() => pool.map((_, i) => i).sort((a, b) => ((a * 7 + 3) % pool.length) - ((b * 7 + 3) % pool.length)), [pool]);
  const [placed, setPlaced] = useState<Token[]>([]);
  const [shake, setShake] = useState(false);

  const placedIds = new Set(placed.map((t) => t.id));

  function tapPool(t: Token) {
    if (placedIds.has(t.id)) return;
    const next = [...placed, t];
    setPlaced(next);
    if (next.length === tokens.length) {
      const correct = next.map((x) => x.text).join('') === tokens.join('');
      if (correct) {
        if (!reduced) playSound('ding');
        onComplete(true);
      } else {
        if (!reduced) playSound('buzz');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPlaced([]);
        }, reduced ? 0 : 500);
      }
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <p className="text-center text-lg font-bold text-[var(--color-ocean-900)]">
        连词成句 / Put the words in order
      </p>
      {/* Answer row */}
      <div
        data-testid="answer-row"
        className={`flex min-h-14 w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3 ${shake && !reduced ? 'animate-shake' : ''}`}
      >
        {placed.map((t) => (
          <span key={t.id} className="rounded-xl bg-[var(--color-ocean-600)] px-3 py-2 text-xl font-bold text-white">
            {t.text}
          </span>
        ))}
      </div>
      {/* Pool — DOM order = token order; visual order via inline `order` */}
      <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-2">
        {pool.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={placedIds.has(t.id)}
            style={{ order: visualOrder.indexOf(t.id) }}
            onClick={() => tapPool(t)}
            className="rounded-xl border-2 border-amber-700/40 bg-white px-4 py-2 text-2xl font-bold text-amber-950 disabled:opacity-30"
          >
            {t.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPlaced([])}
        className="rounded-full bg-white/70 px-4 py-1.5 text-sm font-semibold text-amber-900"
      >
        ↩︎ 重来 / Reset
      </button>
      {translationEn ? (
        <p className="text-center text-xs text-[var(--color-sand-600)]">{translationEn}</p>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- sentence-order-scene`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/scenes/SentenceOrderScene.tsx tests/unit/sentence-order-scene.test.tsx
git commit -m "feat(homework): SentenceOrderScene (tap-to-order)"
```

---

## Task 8: HomeworkRunner

**Files:**
- Create: `src/components/homework/HomeworkRunner.tsx`
- Test: `tests/unit/homework-runner.test.tsx`

Steps through items; renders char_quiz + word_building via `MultipleChoiceQuiz`, sentence_order via `SentenceOrderScene`. On the last item's completion, calls `finishHomeworkAction`, then shows a done screen: `LevelFanfare` (reused) with the `cardMessage`, plus `CardChestReveal` for any `cardGrants`. Choices for char_quiz/word_building are **shuffled once per item** (upstream of `MultipleChoiceQuiz`, per the MCQ randomness landmine).

- [ ] **Step 1: Write the failing test**

`tests/unit/homework-runner.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/homework', () => ({
  finishHomeworkAction: vi.fn().mockResolvedValue({ ok: true, cardGrants: [], cardMessage: null, xp: { gained: 0, level: 1, leveledUp: false } }),
}));

import { HomeworkRunner } from '@/components/homework/HomeworkRunner';
import { finishHomeworkAction } from '@/lib/actions/homework';

const items = [
  { id: 'h1', type: 'char_quiz' as const, config: { type: 'char_quiz', questionZh: '「水」是？', options: [{ textZh: '水', textEn: 'water' }, { textZh: '火', textEn: 'fire' }], correctIndex: 0 } },
];

describe('HomeworkRunner', () => {
  it('runs the single item and calls finishHomeworkAction on completion', async () => {
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={items} />);
    expect(screen.getByText('「水」是？', { exact: false })).toBeInTheDocument();
    // pick the correct choice (bilingual label contains 'water')
    fireEvent.click(screen.getByText(/water/i));
    await waitFor(() => expect(finishHomeworkAction).toHaveBeenCalledWith({ childId: 'c1', weekId: 'w1' }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- homework-runner`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/components/homework/HomeworkRunner.tsx`:
```tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';
import { SentenceOrderScene } from '@/components/scenes/SentenceOrderScene';
import { LevelFanfare } from '@/components/scenes/fx/LevelFanfare';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { finishHomeworkAction } from '@/lib/actions/homework';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { HomeworkItemConfig } from '@/lib/homework/schemas';

interface RunnerItem {
  id: string;
  type: HomeworkItemConfig['type'];
  config: HomeworkItemConfig;
}
interface Props {
  childId: string;
  weekId: string;
  weekLabel: string;
  items: RunnerItem[];
}

/** Deterministic shuffle seeded by item id — pure (no Math.random in render). */
function seededOrder(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => ((a * 31 + seed) % n) - ((b * 31 + seed) % n),
  );
}

export function HomeworkRunner({ childId, weekId, weekLabel, items }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [revealCards, setRevealCards] = useState<RevealCard[]>([]);
  const [cardMessage, setCardMessage] = useState<'homework_done_today' | 'daily_cap_reached' | null>(null);
  const [, startTransition] = useTransition();

  const item = items[index];

  const advance = () => {
    const next = index + 1;
    if (next >= items.length) {
      startTransition(async () => {
        const res = await finishHomeworkAction({ childId, weekId });
        if (res.cardGrants.length) setRevealCards(res.cardGrants);
        if (res.cardMessage) setCardMessage(res.cardMessage as typeof cardMessage);
        setDone(true);
      });
    } else {
      setIndex(next);
    }
  };

  if (done || !item) {
    return (
      <>
        <LevelFanfare
          weekLabel={weekLabel}
          coinsThisSession={0}
          childId={childId}
          weekId={weekId}
          chestAvailable={false}
          cardMessage={cardMessage}
          onContinue={() => router.push(`/play/${childId}/week/${weekId}`)}
        />
        {revealCards.length > 0 ? (
          <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} />
        ) : null}
      </>
    );
  }

  if (item.config.type === 'sentence_order') {
    return (
      <SentenceOrderScene
        key={item.id}
        tokens={item.config.tokens}
        translationEn={item.config.translationEn ?? null}
        onComplete={advance}
      />
    );
  }

  if (item.config.type === 'char_quiz') {
    const cfg = item.config;
    const order = seededOrder(cfg.options.length, item.id.charCodeAt(0));
    const choices = order.map((i) => ({
      key: String(i),
      label: (
        <span className="flex flex-col items-center">
          <span className="font-hanzi text-xl">{cfg.options[i]!.textZh}</span>
          <span className="text-xs text-[var(--color-sand-600)]">{cfg.options[i]!.textEn}</span>
        </span>
      ),
      isCorrect: i === cfg.correctIndex,
    }));
    return (
      <MultipleChoiceQuiz
        key={item.id}
        prompt={<span className="font-hanzi text-lg">{cfg.questionZh}</span>}
        stimulus={cfg.hanzi ? <span className="font-hanzi text-7xl">{cfg.hanzi}</span> : null}
        choices={choices}
        onComplete={advance}
      />
    );
  }

  // word_building
  const cfg = item.config;
  const words = [cfg.correctWord, ...cfg.distractors];
  const order = seededOrder(words.length, item.id.charCodeAt(0));
  const choices = order.map((i) => ({
    key: String(i),
    label: <span className="font-hanzi text-2xl">{words[i]}</span>,
    isCorrect: i === 0,
  }));
  return (
    <MultipleChoiceQuiz
      key={item.id}
      prompt={<span className="font-hanzi text-lg">给「{cfg.baseChar}」组词 / Make a word</span>}
      stimulus={<span className="font-hanzi text-7xl">{cfg.baseChar}</span>}
      choices={choices}
      onComplete={advance}
    />
  );
}
```

> Confirm `LevelFanfare`'s `cardMessage` prop type accepts `'homework_done_today'`. It currently accepts `'review_done_today' | 'daily_cap_reached'`. **Add `'homework_done_today'` to `LevelFanfare`'s `cardMessage` union + `CARD_MESSAGES` map** (ZH "今日作业已完成，明日再来" / EN "Today's homework is done — come back tomorrow") as part of this task.

- [ ] **Step 4: Add the homework fanfare copy**

In `src/components/scenes/fx/LevelFanfare.tsx`: extend the `cardMessage` prop union and the `CARD_MESSAGES` record with:
```ts
homework_done_today: {
  zh: '今日作业已完成，明日再来',
  en: "Today's homework is done — come back tomorrow",
},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- homework-runner level-fanfare`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add src/components/homework/HomeworkRunner.tsx src/components/scenes/fx/LevelFanfare.tsx tests/unit/homework-runner.test.tsx
git commit -m "feat(homework): HomeworkRunner + homework fanfare copy"
```

---

## Task 9: Kid route page

**Files:**
- Create: `src/app/play/[childId]/homework/[weekId]/page.tsx`
- Test: none (thin server wrapper; covered by HomeworkRunner + manual verification)

- [ ] **Step 1: Implement**

`src/app/play/[childId]/homework/[weekId]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { listHomeworkItems } from '@/lib/db/homework';
import { parseHomeworkConfig } from '@/lib/homework/schemas';
import { HomeworkRunner } from '@/components/homework/HomeworkRunner';
import { MidSceneFlag } from '@/components/play/MidSceneProvider';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function HomeworkPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  const { child } = await requireChild(childId);
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) notFound();

  const rows = await listHomeworkItems(weekId);
  if (rows.length === 0) notFound();

  // Validate + narrow each config; skip any that fail (defensive).
  const items = rows.flatMap((r) => {
    try {
      return [{ id: r.id, type: r.type, config: parseHomeworkConfig(r.type, r.config) }];
    } catch {
      return [];
    }
  });
  if (items.length === 0) notFound();

  return (
    <>
      <MidSceneFlag />
      <HomeworkRunner childId={child.id} weekId={week.id} weekLabel={week.label} items={items} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck + build the route**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add "src/app/play/[childId]/homework/[weekId]/page.tsx"
git commit -m "feat(homework): kid homework route"
```

---

## Task 10: WeekHub homework section

**Files:**
- Modify: `src/components/play/WeekHub.tsx`, `src/app/play/[childId]/week/[weekId]/page.tsx`
- Test: `tests/unit/week-hub-homework.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/week-hub-homework.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekHub } from '@/components/play/WeekHub';

const base = {
  childId: 'c1',
  week: { id: 'w1', weekNumber: 1, label: 'Week 1' },
  sections: {
    review: { done: 0, total: 3 },
    practice: { done: 0, total: 13 },
    boss: { done: 0, total: 1, locked: true },
  },
};

describe('WeekHub homework section', () => {
  it('shows the homework card when homework is present', () => {
    render(<WeekHub {...base} homework={{ present: true, doneToday: false, count: 4 }} />);
    expect(screen.getByText('作业')).toBeInTheDocument();
  });

  it('hides the homework card when absent', () => {
    render(<WeekHub {...base} homework={{ present: false, doneToday: false, count: 0 }} />);
    expect(screen.queryByText('作业')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- week-hub-homework`
Expected: FAIL (no `homework` prop / no card).

- [ ] **Step 3: Implement — WeekHub**

In `src/components/play/WeekHub.tsx`: add an optional `homework` prop and render a `SectionCard` after the boss card when `homework?.present`:
```ts
// in Props:
  homework?: { present: boolean; doneToday: boolean; count: number };
```
```tsx
// after the boss SectionCard, before </div>:
{homework?.present ? (
  <SectionCard
    href={`/play/${childId}/homework/${week.id}`}
    emoji="📚"
    titleZh="作业"
    titleEn="Homework"
    progressText={`${homework.count} 题 / items`}
    state={homework.doneToday ? 'cleared' : 'idle'}
  />
) : null}
```

- [ ] **Step 4: Implement — week hub page wiring**

In `src/app/play/[childId]/week/[weekId]/page.tsx`: import `weekHasHomework` and `listHomeworkItems` from `@/lib/db/homework`, compute presence + count, pass `homework` prop:
```ts
import { listHomeworkItems } from '@/lib/db/homework';
// ...
const homeworkItems = await listHomeworkItems(weekId);
// ...
<WeekHub
  // ...existing props...
  homework={{ present: homeworkItems.length > 0, doneToday: false, count: homeworkItems.length }}
/>
```
> `doneToday` is `false` in v1 (the card-grant log is the real idempotency; surfacing "done today" on the hub is a deferred polish — keep it `false`).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- week-hub-homework`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add src/components/play/WeekHub.tsx "src/app/play/[childId]/week/[weekId]/page.tsx" tests/unit/week-hub-homework.test.tsx
git commit -m "feat(homework): conditional homework section on the week hub"
```

---

## Task 11: Parent HomeworkEditor + forms

**Files:**
- Create: `src/components/parent/HomeworkEditor.tsx`, `src/components/parent/homework/{CharQuizForm,WordBuildingForm,SentenceOrderForm}.tsx`
- Modify: `src/app/parent/week/[id]/review/page.tsx`
- Test: `tests/unit/homework-editor.test.tsx`

The editor is parent-facing (NOT subject to the bilingual-chrome rule — exempt per CLAUDE.md). It lists existing items (type + a one-line summary) with delete + reorder (↑↓), and an "Add" control per type that opens the matching form. Forms collect the raw config and call `addHomeworkItemAction`.

- [ ] **Step 1: Write the failing test**

`tests/unit/homework-editor.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/homework', () => ({
  addHomeworkItemAction: vi.fn().mockResolvedValue('h2'),
  deleteHomeworkItemAction: vi.fn().mockResolvedValue(undefined),
  reorderHomeworkItemsAction: vi.fn().mockResolvedValue(undefined),
}));

import { HomeworkEditor } from '@/components/parent/HomeworkEditor';
import { deleteHomeworkItemAction } from '@/lib/actions/homework';

describe('HomeworkEditor', () => {
  it('lists existing items and deletes one', async () => {
    render(
      <HomeworkEditor
        weekId="w1"
        items={[{ id: 'h1', type: 'sentence_order', summary: '我 / 爱 / 你' }]}
      />,
    );
    expect(screen.getByText('我 / 爱 / 你')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(deleteHomeworkItemAction).toHaveBeenCalledWith('w1', 'h1'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- homework-editor`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the editor + 3 forms**

`src/components/parent/HomeworkEditor.tsx` — client component; takes `weekId` + `items: { id; type; summary }[]`. Renders the list (each row: type chip, summary, ↑/↓ reorder buttons calling `reorderHomeworkItemsAction`, a `Delete` button calling `deleteHomeworkItemAction(weekId, id)` then `router.refresh()`), and an "Add item" type picker that mounts one of the 3 forms. Each form (`CharQuizForm`, `WordBuildingForm`, `SentenceOrderForm`) is a controlled form that builds the raw config object and calls `addHomeworkItemAction(weekId, type, config)` then `router.refresh()`; surface thrown validation errors inline.

Concrete form contracts (the engineer implements the inputs; these are the exact config objects each must produce):
- `CharQuizForm` → `{ hanzi?, questionZh, options: {textZh,textEn}[], correctIndex }`.
- `WordBuildingForm` → `{ baseChar, correctWord, distractors: string[], correctMeaningEn? }`.
- `SentenceOrderForm` → `{ tokens: string[], translationEn? }`.

The summary string for the list is produced server-side in Task 12's page wiring (e.g. `tokens.join(' / ')` for sentence_order, `questionZh` for char_quiz, `给「baseChar」组词` for word_building).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- homework-editor`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/parent/HomeworkEditor.tsx src/components/parent/homework/ tests/unit/homework-editor.test.tsx
git commit -m "feat(homework): parent homework editor + per-type forms"
```

---

## Task 12: Wire editor into the parent review page + summaries

**Files:**
- Modify: `src/app/parent/week/[id]/review/page.tsx`
- Test: none (server wiring; covered by editor test + manual verification)

- [ ] **Step 1: Implement**

In `src/app/parent/week/[id]/review/page.tsx`: after the existing character cards, fetch `listHomeworkItems(id)`, map each row to `{ id, type, summary }`, and render `<HomeworkEditor weekId={id} items={summaries} />`. Summary builder:
```ts
import { listHomeworkItems } from '@/lib/db/homework';
import { parseHomeworkConfig } from '@/lib/homework/schemas';

function summarize(type: string, config: unknown): string {
  try {
    const c = parseHomeworkConfig(type as never, config);
    if (c.type === 'sentence_order') return c.tokens.join(' / ');
    if (c.type === 'char_quiz') return c.questionZh;
    return `给「${c.baseChar}」组词`;
  } catch {
    return '(invalid item)';
  }
}
// const hw = await listHomeworkItems(id);
// const summaries = hw.map((r) => ({ id: r.id, type: r.type, summary: summarize(r.type, r.config) }));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add "src/app/parent/week/[id]/review/page.tsx"
git commit -m "feat(homework): mount homework editor on the parent week page"
```

---

## Task 13: Four-green gate + final review

- [ ] **Step 1: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all PASS. (Note: `pnpm build` runs `scripts/migrate.ts` against the prod DB first — this APPLIES the homework migration + the `coin_reason` enum value to prod. That is expected and additive; the tables/enum sit unused until the feature deploys. See the CLAUDE.md "local build applies migrations to prod" landmine.)

- [ ] **Step 2: Manual smoke (dev)**

`pnpm dev`, sign in as parent → `/parent/week/<id>/review` → add one of each homework type → save. Then `/play/<childId>/week/<weekId>` → the 📚 作业 card appears → play through → on completion a card reveals + the fanfare shows; replaying the same day shows "今日作业已完成".

- [ ] **Step 3: Bilingual chrome check**

Confirm every NEW kid-facing label is `中文 / English` (HomeworkRunner prompts, SentenceOrderScene, WeekHub card, fanfare copy). The parent editor is exempt. Add any missed labels.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin feat/pirate-homework
gh pr create --title "feat(homework): pirate homework — parent-authored weekly exercises" --base main --body "<summary + spec link + post-merge: none>"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- 3 exercise types → Task 2 (schemas), Task 7 (sentence scene), Task 8 (runner renders all 3). ✓
- Structured manual authoring → Tasks 6, 11, 12. ✓
- Per-week section, conditional → Task 10. ✓
- Reward coins+XP+card once/week/day → Task 5 (gated on `granted`). ✓
- `'homework'` card source → Task 4. ✓
- Sentence tap-to-order → Task 7. ✓
- Storage `homework_items` jsonb → Task 1. ✓
- Doesn't gate boss → not touched (boss reads `practice` only); confirmed by omission. ✓

**Type consistency:** `HomeworkType` (schemas.ts) used by db + actions + runner. `HomeworkItemConfig` discriminated union used by runner + page. `parseHomeworkConfig(type, raw)` signature identical across Tasks 2/6/9/12. `finishHomeworkAction({childId, weekId})` shape identical in Tasks 5/8. `CardSkipReason` / `RevealCard` imported from existing modules — Task 5 notes confirming them first. `LevelFanfare.cardMessage` union extended in Task 8 to include `'homework_done_today'`.

**Placeholders:** none — every code step has complete code; UI form internals in Task 11 are specified by their exact output config contracts (the only reasonable latitude, since input widgets are mechanical).

**Risk notes for the executor:**
- Confirm the drizzle generate script name in `package.json` (Task 1 Step 5).
- `ALTER TYPE coin_reason ADD VALUE` runs outside a txn — Neon/PG17 handles it; if the migrate step errors, split the enum value into its own migration.
- Verify `RevealCard` field names (`id/slug/packSlug/nameZh/nameEn/loreZh/loreEn/isDupe/shardsAfter`) against `src/lib/play/reveal-card.ts` before Task 5 Step 3.
