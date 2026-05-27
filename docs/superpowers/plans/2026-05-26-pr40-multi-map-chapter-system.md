# PR #40 — Multi-Map Chapter System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat the existing 10-week curriculum as Map 1 (加勒比海 / Caribbean Sea), introduce a `/maps` gateway page reached from a header pill on home, and seed an always-visible locked Map 2 (印度洋 / Indian Ocean) placeholder. Adds bilingual columns to `curriculum_packs` + a small DB + server-action surface for switching active map.

**Architecture:** 8 tasks. Migration first → seed-script (renames Map 1, inserts Map 2 placeholder) → DB query layer (`listMapsForChild`, `setCurrentPackForChild`) → server action (`switchMapAction` + `MapLockedError`) → three components (`MapCard`, `MapsHub`, `MapHeaderPill`) → `/maps` page + home pill integration → KidNavBar predicate tweak.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle ORM · PostgreSQL (Neon) · Vitest + RTL + jsdom · Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-05-26-pr40-multi-map-chapter-system-design.md](../specs/2026-05-26-pr40-multi-map-chapter-system-design.md)

**Branch:** `feat/pr40-multi-map-chapter-system` (already created, spec committed)

---

## File map

| Path | Resp. | Status |
|---|---|---|
| `src/db/schema/content.ts` | append `nameZh` + `nameEn` to `curriculumPacks` | modify |
| `drizzle/0015_*.sql` | auto-generated | create |
| `scripts/seed-multi-map.ts` | rename Map 1 + insert Map 2 placeholder | create |
| `src/lib/db/maps.ts` | `listMapsForChild` + `setCurrentPackForChild` + `getCurrentMap` | create |
| `src/lib/errors/maps-errors.ts` | `MapLockedError` (pure) | create |
| `src/lib/actions/maps.ts` | `switchMapAction` server action | create |
| `src/components/play/MapCard.tsx` | per-pack tile (current / switchable / locked) | create |
| `src/components/play/MapsHub.tsx` | server component listing MapCards | create |
| `src/components/play/MapHeaderPill.tsx` | "📍 加勒比海 ⬇" pill on home | create |
| `src/app/play/[childId]/maps/page.tsx` | server page → MapsHub | create |
| `src/app/play/[childId]/page.tsx` | mount MapHeaderPill above WeekStrip | modify |
| `src/components/play/KidNavBar.tsx` | extend `isMap` predicate to cover `/maps` | modify |
| `tests/unit/...` | 6 test files | create |

---

## Task 1: parent_packs schema bilingual columns + migration 0015

**Files:**
- Modify: `src/db/schema/content.ts`
- Create: `drizzle/0015_<adj>.sql`

- [ ] **Step 1: Append nameZh + nameEn**

In `src/db/schema/content.ts`, find the `curriculumPacks` declaration. Inside its columns object (preserving existing columns), add:

```ts
nameZh: text('name_zh'),
nameEn: text('name_en'),
```

- [ ] **Step 2: Generate migration**

Run:
```bash
pnpm drizzle-kit generate
```

Expected: `drizzle/0015_<name>.sql` with two `ALTER TABLE curriculum_packs ADD COLUMN name_zh text;` / `ADD COLUMN name_en text;` statements. **No** unrelated table changes. If unrelated changes appear, STOP — schema drift, escalate.

- [ ] **Step 3: Apply migration**

Run:
```bash
pnpm tsx scripts/migrate.ts
```

Expected: applies cleanly. CAUTION: writes to shared prod DB. New columns are nullable so no data risk.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/content.ts drizzle/0015_*.sql drizzle/meta/
git commit -m "feat(pr40): bilingual name_zh + name_en on curriculum_packs (migration 0015)"
```

---

## Task 2: Seed Map 1 rename + Map 2 placeholder row

**Files:**
- Create: `scripts/seed-multi-map.ts`

- [ ] **Step 1: Write the script**

`scripts/seed-multi-map.ts`:

```ts
/**
 * Renames the existing `pirate-class-level-1` pack to bilingual names
 * (Map 1 = 加勒比海 / Caribbean Sea) and inserts the `pirate-class-level-2`
 * placeholder (Map 2 = 印度洋 / Indian Ocean) with zero weeks.
 *
 * Usage: pnpm tsx scripts/seed-multi-map.ts
 *
 * CAUTION: shared DATABASE_URL writes to prod. Idempotent — safe to re-run.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

async function main() {
  const { db } = await import('../src/db');
  const { curriculumPacks } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  console.log('Renaming Map 1 → Caribbean Sea…');
  await db
    .update(curriculumPacks)
    .set({ nameZh: '加勒比海', nameEn: 'Caribbean Sea' })
    .where(eq(curriculumPacks.slug, 'pirate-class-level-1'));

  const existing = await db
    .select({ id: curriculumPacks.id })
    .from(curriculumPacks)
    .where(eq(curriculumPacks.slug, 'pirate-class-level-2'))
    .limit(1);

  if (existing.length === 0) {
    console.log('Inserting Map 2 placeholder → Indian Ocean…');
    await db.insert(curriculumPacks).values({
      slug: 'pirate-class-level-2',
      name: 'Indian Ocean / 印度洋',
      nameZh: '印度洋',
      nameEn: 'Indian Ocean',
      isPublic: true,
      ownerUserId: null,
    });
  } else {
    console.log('Map 2 already exists, skipping insert.');
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Run it**

Run: `pnpm tsx scripts/seed-multi-map.ts`
Expected output:
```
Renaming Map 1 → Caribbean Sea…
Inserting Map 2 placeholder → Indian Ocean…
Done.
```

- [ ] **Step 3: Verify in DB**

Run a quick read-through (you can do this via a one-off script or `psql`):
```bash
pnpm tsx -e "
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const { db } = await import('./src/db');
const { curriculumPacks } = await import('./src/db/schema');
const rows = await db.select({ slug: curriculumPacks.slug, nameZh: curriculumPacks.nameZh, nameEn: curriculumPacks.nameEn }).from(curriculumPacks);
console.log(rows);
process.exit(0);
"
```
Expected: 2 rows for `pirate-class-level-1` (Caribbean) and `pirate-class-level-2` (Indian Ocean).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-multi-map.ts
git commit -m "feat(pr40): seed multi-map (rename Map 1 + insert Map 2 placeholder)"
```

---

## Task 3: maps DB query layer

**Files:**
- Create: `src/lib/db/maps.ts`
- Create: `tests/unit/lib/db/maps.test.ts`

- [ ] **Step 1: Inspect existing helpers**

Run:
```bash
grep -rn "currentCurriculumPackId\|listChildPlayableWeeks\|getProgressByWeek" src/lib/db/ | head -20
```

Confirm the column name (`child_profiles.current_curriculum_pack_id`) and existing patterns for joining weeks + progress.

- [ ] **Step 2: Write failing tests**

`tests/unit/lib/db/maps.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
  };
  return { db: chain };
});

import { listMapsForChild, setCurrentPackForChild } from '@/lib/db/maps';
import { db } from '@/db';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listMapsForChild', () => {
  it('returns maps with weekCount + clearedCount + isCurrent + isLocked', async () => {
    // We're testing the SHAPE of the function — actual rows mocked.
    // (The integration with real Drizzle queries happens in dev/prod.)
    const childRow = { current_pack_id: 'pack_1' };
    const packRows = [
      { packId: 'pack_1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean Sea', weekCount: 10, clearedCount: 3 },
      { packId: 'pack_2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian Ocean', weekCount: 0, clearedCount: 0 },
    ];
    // The implementation may internally do 2 queries; for this unit test we
    // patch the chain's terminal `where().limit()` to return childRow first,
    // and `where().orderBy()` or similar to return packRows second.
    // (Actual mock plumbing must match what listMapsForChild calls.)

    // The simplest contract test: assert the helper returns 2 objects with
    // the expected booleans set correctly when the underlying rows look like
    // the above.

    // Implementation may need adjustment to be testable this way. The test
    // file documents the *behavior* — implementer can refine the impl + mock
    // plumbing as needed.
    expect(true).toBe(true); // placeholder: refine after impl exists
  });

  it('marks all packs with weekCount=0 as isLocked', async () => {
    // Behavior contract: locked iff zero weeks.
    expect(true).toBe(true); // refine after impl
  });

  it('marks the child\'s current_curriculum_pack_id pack as isCurrent', async () => {
    expect(true).toBe(true);
  });
});

describe('setCurrentPackForChild', () => {
  it('updates child_profiles.current_curriculum_pack_id', async () => {
    await setCurrentPackForChild('child_1', 'pack_2');
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ currentCurriculumPackId: 'pack_2' }),
    );
  });
});
```

**Note for implementer:** the test placeholders for `listMapsForChild` are intentionally vague — the exact mock-chain plumbing depends on the final query shape. Replace each placeholder with concrete assertions once the impl exists. The *behavior contracts* in the descriptions are the source of truth: (a) returns one entry per pack, (b) `isLocked` iff zero published weeks, (c) `isCurrent` matches `child_profiles.current_curriculum_pack_id`.

- [ ] **Step 3: Run failing test**

Run: `pnpm test maps -- --run`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/lib/db/maps.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { curriculumPacks, weeks, childProfiles } from '@/db/schema';

export interface MapForChild {
  packId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  weekCount: number;
  clearedCount: number;
  isCurrent: boolean;
  isLocked: boolean;
}

export async function getCurrentPackId(childId: string): Promise<string | null> {
  const rows = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  return rows[0]?.packId ?? null;
}

export async function listMapsForChild(childId: string): Promise<MapForChild[]> {
  const currentPackId = await getCurrentPackId(childId);

  const rows = await db
    .select({
      packId: curriculumPacks.id,
      slug: curriculumPacks.slug,
      nameZh: curriculumPacks.nameZh,
      nameEn: curriculumPacks.nameEn,
      name: curriculumPacks.name,
      weekCount: sql<number>`coalesce(count(${weeks.id}), 0)::int`,
    })
    .from(curriculumPacks)
    .leftJoin(weeks, eq(weeks.curriculumPackId, curriculumPacks.id))
    .where(eq(curriculumPacks.isPublic, true))
    .groupBy(curriculumPacks.id)
    .orderBy(curriculumPacks.createdAt);

  return rows.map((r) => ({
    packId: r.packId,
    slug: r.slug,
    nameZh: r.nameZh ?? r.name,
    nameEn: r.nameEn ?? r.name,
    weekCount: Number(r.weekCount),
    clearedCount: 0, // TODO follow-up: count weeks with progress=100%
    isCurrent: r.packId === currentPackId,
    isLocked: Number(r.weekCount) === 0,
  }));
}

export async function setCurrentPackForChild(
  childId: string,
  packId: string,
): Promise<void> {
  await db
    .update(childProfiles)
    .set({ currentCurriculumPackId: packId })
    .where(eq(childProfiles.id, childId));
}
```

Note: `clearedCount` is wired to 0 for now (deferred per spec §7 — counting cleared weeks per pack needs joining `progress` table; minor follow-up). If you have time, also count cleared weeks via a second LEFT JOIN through the progress table.

- [ ] **Step 5: Refine the test placeholders**

Now that the impl is written, refine the `listMapsForChild` tests:
- Mock `db.select().from(childProfiles).where().limit()` to return `[{ packId: 'pack_1' }]` first.
- Mock `db.select().from(curriculumPacks).leftJoin().where().groupBy().orderBy()` to return the two pack rows.
- Assert `result[0].isCurrent === true`, `result[1].isLocked === true`, etc.

(Pattern reference: see how `tests/unit/lib/db/parent-settings.test.ts` (PR #38) wires `vi.hoisted` for chained mocks.)

- [ ] **Step 6: Run tests**

Run: `pnpm test maps -- --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/maps.ts tests/unit/lib/db/maps.test.ts
git commit -m "feat(pr40): listMapsForChild + setCurrentPackForChild DB queries"
```

---

## Task 4: switchMapAction + MapLockedError

**Files:**
- Create: `src/lib/errors/maps-errors.ts`
- Create: `src/lib/actions/maps.ts`
- Create: `tests/unit/lib/actions/maps.test.ts`

- [ ] **Step 1: Write the error class first**

`src/lib/errors/maps-errors.ts`:

```ts
export class MapLockedError extends Error {
  constructor() {
    super('Map is locked (zero published weeks)');
    this.name = 'MapLockedError';
  }
}
```

(Pure module — no DB or postgres imports, safe to import from client.)

- [ ] **Step 2: Write failing tests for the action**

`tests/unit/lib/actions/maps.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(),
}));
vi.mock('@/lib/db/maps', () => ({
  listMapsForChild: vi.fn(),
  setCurrentPackForChild: vi.fn(),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { requireChild } from '@/lib/auth/guards';
import { listMapsForChild, setCurrentPackForChild } from '@/lib/db/maps';
import { revalidatePath } from 'next/cache';
import { switchMapAction } from '@/lib/actions/maps';
import { MapLockedError } from '@/lib/errors/maps-errors';

beforeEach(() => {
  vi.clearAllMocks();
  (requireChild as any).mockResolvedValue({ child: { id: 'child_1' } });
});

describe('switchMapAction', () => {
  it('switches to an unlocked pack and revalidates home', async () => {
    (listMapsForChild as any).mockResolvedValue([
      { packId: 'pack_1', isLocked: false, isCurrent: true },
      { packId: 'pack_2', isLocked: false, isCurrent: false },
    ]);
    await switchMapAction('child_1', 'pack_2');
    expect(setCurrentPackForChild).toHaveBeenCalledWith('child_1', 'pack_2');
    expect(revalidatePath).toHaveBeenCalledWith('/play/child_1');
  });

  it('throws MapLockedError for a locked pack', async () => {
    (listMapsForChild as any).mockResolvedValue([
      { packId: 'pack_1', isLocked: false, isCurrent: true },
      { packId: 'pack_2', isLocked: true, isCurrent: false },
    ]);
    await expect(switchMapAction('child_1', 'pack_2')).rejects.toBeInstanceOf(MapLockedError);
    expect(setCurrentPackForChild).not.toHaveBeenCalled();
  });

  it('throws when packId is not in the child\'s pack list', async () => {
    (listMapsForChild as any).mockResolvedValue([
      { packId: 'pack_1', isLocked: false, isCurrent: true },
    ]);
    await expect(switchMapAction('child_1', 'pack_999')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run failing test**

Run: `pnpm test maps -- --run`
Expected: action tests FAIL — module not found.

- [ ] **Step 4: Implement the action**

`src/lib/actions/maps.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { listMapsForChild, setCurrentPackForChild } from '@/lib/db/maps';
import { MapLockedError } from '@/lib/errors/maps-errors';

export async function switchMapAction(
  childId: string,
  packId: string,
): Promise<void> {
  const { child } = await requireChild(childId);
  const maps = await listMapsForChild(child.id);
  const target = maps.find((m) => m.packId === packId);
  if (!target) {
    throw new Error('Map not found');
  }
  if (target.isLocked) {
    throw new MapLockedError();
  }
  await setCurrentPackForChild(child.id, packId);
  revalidatePath(`/play/${child.id}`);
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test maps -- --run`
Expected: PASS (action + db tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/errors/maps-errors.ts src/lib/actions/maps.ts tests/unit/lib/actions/maps.test.ts
git commit -m "feat(pr40): switchMapAction + MapLockedError"
```

---

## Task 5: MapCard component

**Files:**
- Create: `src/components/play/MapCard.tsx`
- Create: `tests/unit/components/play/MapCard.test.tsx`

- [ ] **Step 1: Write failing tests**

`tests/unit/components/play/MapCard.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));
vi.mock('@/lib/actions/maps', () => ({
  switchMapAction: vi.fn().mockResolvedValue(undefined),
}));

import { switchMapAction } from '@/lib/actions/maps';
import { MapCard } from '@/components/play/MapCard';
import type { MapForChild } from '@/lib/db/maps';

const routerPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const baseMap: MapForChild = {
  packId: 'pack_1',
  slug: 'pirate-class-level-1',
  nameZh: '加勒比海',
  nameEn: 'Caribbean Sea',
  weekCount: 10,
  clearedCount: 3,
  isCurrent: true,
  isLocked: false,
};

describe('MapCard', () => {
  it('current map: renders "你正在这里 / You\'re here" badge', () => {
    render(<MapCard childId="child_1" map={baseMap} />);
    expect(screen.getByText(/你正在这里|You're here/)).toBeInTheDocument();
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText('Caribbean Sea')).toBeInTheDocument();
  });

  it('locked map: renders lock + "即将开放 / Coming soon", no switch action', () => {
    const locked = { ...baseMap, packId: 'pack_2', nameZh: '印度洋', nameEn: 'Indian Ocean', weekCount: 0, isCurrent: false, isLocked: true };
    render(<MapCard childId="child_1" map={locked} />);
    expect(screen.getByText(/即将开放|Coming soon/)).toBeInTheDocument();
    const card = screen.getByText('印度洋').closest('[data-testid="map-card"]') as HTMLElement;
    fireEvent.click(card);
    expect(switchMapAction).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('switchable map: tap calls switchMapAction then router.push(home)', async () => {
    const switchable = { ...baseMap, packId: 'pack_3', nameZh: '南太平洋', nameEn: 'South Pacific', isCurrent: false, isLocked: false };
    render(<MapCard childId="child_1" map={switchable} />);
    const card = screen.getByText('南太平洋').closest('[data-testid="map-card"]') as HTMLElement;
    fireEvent.click(card);
    await new Promise((r) => setTimeout(r, 0));
    expect(switchMapAction).toHaveBeenCalledWith('child_1', 'pack_3');
    expect(routerPush).toHaveBeenCalledWith('/play/child_1');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test MapCard -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/play/MapCard.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { switchMapAction } from '@/lib/actions/maps';
import type { MapForChild } from '@/lib/db/maps';

interface Props {
  childId: string;
  map: MapForChild;
}

export function MapCard({ childId, map }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (map.isLocked || map.isCurrent || pending) return;
    setPending(true);
    try {
      await switchMapAction(childId, map.packId);
      router.push(`/play/${childId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="map-card"
      onClick={onClick}
      className={
        'relative flex w-full flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-transform ' +
        (map.isCurrent
          ? 'border-[var(--color-treasure-400)] bg-white ring-2 ring-[var(--color-treasure-300)]'
          : map.isLocked
            ? 'border-[var(--color-sand-200)] bg-[var(--color-sand-50)] opacity-60'
            : 'border-[var(--color-ocean-300)] bg-white active:scale-[0.98]')
      }
      disabled={map.isLocked || map.isCurrent || pending}
      aria-label={`${map.nameEn} map${map.isLocked ? ', locked' : map.isCurrent ? ', current' : ''}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-hanzi text-xl font-extrabold text-[var(--color-ocean-900)]">
          {map.nameZh}
        </h2>
        <span className="text-sm font-bold text-[var(--color-sand-700)]">
          {map.nameEn}
        </span>
      </div>
      {map.isCurrent && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-treasure-400)] px-2 py-0.5 text-xs font-bold text-[var(--color-treasure-800)]">
          👉 你正在这里 / You&apos;re here
        </span>
      )}
      {map.isLocked && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-sand-200)] px-2 py-0.5 text-xs font-bold text-[var(--color-sand-700)]">
          🔒 即将开放 / Coming soon
        </span>
      )}
      {!map.isLocked && (
        <p className="text-xs text-[var(--color-sand-700)]">
          {map.weekCount} 周 · {map.weekCount} week{map.weekCount === 1 ? '' : 's'}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test MapCard -- --run`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/components/play/MapCard.tsx tests/unit/components/play/MapCard.test.tsx
git commit -m "feat(pr40): MapCard with current/switchable/locked states"
```

---

## Task 6: MapsHub + /maps server page

**Files:**
- Create: `src/components/play/MapsHub.tsx`
- Create: `src/app/play/[childId]/maps/page.tsx`
- Create: `tests/unit/components/play/MapsHub.test.tsx`
- Create: `tests/unit/app/maps-page.test.tsx`

- [ ] **Step 1: Write failing tests**

`tests/unit/components/play/MapsHub.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapsHub } from '@/components/play/MapsHub';
import type { MapForChild } from '@/lib/db/maps';

describe('MapsHub', () => {
  it('renders one MapCard per map and a title', () => {
    const maps: MapForChild[] = [
      {
        packId: 'pack_1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean Sea',
        weekCount: 10, clearedCount: 3, isCurrent: true, isLocked: false,
      },
      {
        packId: 'pack_2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian Ocean',
        weekCount: 0, clearedCount: 0, isCurrent: false, isLocked: true,
      },
    ];
    render(<MapsHub childId="child_1" maps={maps} />);
    expect(screen.getByText(/航海图|Nautical Charts/)).toBeInTheDocument();
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText('印度洋')).toBeInTheDocument();
  });
});
```

`tests/unit/app/maps-page.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'child_1' } }),
}));
vi.mock('@/lib/db/maps', () => ({
  listMapsForChild: vi.fn().mockResolvedValue([]),
}));

import MapsPage from '@/app/play/[childId]/maps/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MapsPage', () => {
  it('renders for a valid child', async () => {
    const result = await MapsPage({
      params: Promise.resolve({ childId: 'child_1' }),
    });
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `pnpm test MapsHub maps-page -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement MapsHub**

`src/components/play/MapsHub.tsx`:

```tsx
import { MapCard } from './MapCard';
import type { MapForChild } from '@/lib/db/maps';

interface Props {
  childId: string;
  maps: MapForChild[];
}

export function MapsHub({ childId, maps }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="text-center">
        <h1 className="font-hanzi text-2xl font-extrabold text-[var(--color-ocean-900)]">
          航海图 · Nautical Charts
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand-700)]">
          选择你要探险的海域 · Choose your sea
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {maps.map((m) => (
          <li key={m.packId}>
            <MapCard childId={childId} map={m} />
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Implement the server page**

`src/app/play/[childId]/maps/page.tsx`:

```tsx
import { requireChild } from '@/lib/auth/guards';
import { listMapsForChild } from '@/lib/db/maps';
import { MapsHub } from '@/components/play/MapsHub';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function MapsPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const maps = await listMapsForChild(child.id);
  return <MapsHub childId={child.id} maps={maps} />;
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test MapsHub maps-page -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/MapsHub.tsx \
        src/app/play/[childId]/maps/page.tsx \
        tests/unit/components/play/MapsHub.test.tsx \
        tests/unit/app/maps-page.test.tsx
git commit -m "feat(pr40): /maps gateway page + MapsHub component"
```

---

## Task 7: MapHeaderPill + home page integration

**Files:**
- Create: `src/components/play/MapHeaderPill.tsx`
- Modify: `src/app/play/[childId]/page.tsx`
- Create: `tests/unit/components/play/MapHeaderPill.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/components/play/MapHeaderPill.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapHeaderPill } from '@/components/play/MapHeaderPill';

describe('MapHeaderPill', () => {
  it('renders nameZh + nameEn + Links to /maps', () => {
    render(
      <MapHeaderPill
        childId="child_1"
        currentMap={{ nameZh: '加勒比海', nameEn: 'Caribbean Sea' }}
      />,
    );
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText(/Caribbean Sea/)).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/child_1/maps');
  });

  it('renders nothing when currentMap is null', () => {
    const { container } = render(
      <MapHeaderPill childId="child_1" currentMap={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test MapHeaderPill -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/play/MapHeaderPill.tsx`:

```tsx
import Link from 'next/link';

interface Props {
  childId: string;
  currentMap: { nameZh: string; nameEn: string } | null;
}

export function MapHeaderPill({ childId, currentMap }: Props) {
  if (!currentMap) return null;
  return (
    <Link
      href={`/play/${childId}/maps`}
      className="inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-[var(--color-ocean-100)] px-3 py-1 text-sm font-bold text-[var(--color-ocean-700)] shadow-sm transition-colors hover:bg-[var(--color-ocean-200)]"
      aria-label="open nautical charts"
    >
      <span aria-hidden>📍</span>
      <span className="font-hanzi">{currentMap.nameZh}</span>
      <span className="text-xs opacity-70">/ {currentMap.nameEn}</span>
      <span aria-hidden>⬇</span>
    </Link>
  );
}
```

- [ ] **Step 4: Wire into home page**

Edit `src/app/play/[childId]/page.tsx`. Add imports:

```tsx
import { MapHeaderPill } from '@/components/play/MapHeaderPill';
import { listMapsForChild } from '@/lib/db/maps';
```

In the existing `Promise.all`, append fetching maps:

```ts
const [/* …existing… */, weekActivity, maps] = await Promise.all([
  /* …existing fetches…, */
  listMapsForChild(child.id),
]);
const currentMap = maps.find((m) => m.isCurrent) ?? null;
```

In the returned JSX, insert the pill between the avatar header `<section>` and `<WeekStrip>`:

```tsx
{currentMap && (
  <MapHeaderPill
    childId={childId}
    currentMap={{ nameZh: currentMap.nameZh, nameEn: currentMap.nameEn }}
  />
)}
<WeekStrip … />
```

- [ ] **Step 5: Run tests**

Run: `pnpm test MapHeaderPill -- --run`
Then full suite: `pnpm test -- --run`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/MapHeaderPill.tsx \
        src/app/play/[childId]/page.tsx \
        tests/unit/components/play/MapHeaderPill.test.tsx
git commit -m "feat(pr40): MapHeaderPill on home + wire listMapsForChild fetch"
```

---

## Task 8: KidNavBar — extend isMap to cover /maps

**Files:**
- Modify: `src/components/play/KidNavBar.tsx`
- Modify: `tests/unit/components/play/KidNavBar.test.tsx`

- [ ] **Step 1: Add a failing test for the new active-state branch**

In `tests/unit/components/play/KidNavBar.test.tsx`, add:

```tsx
it('marks Map tab active on /play/[childId]/maps', () => {
  pathnameMock.mockReturnValue('/play/child_1/maps');
  render(<KidNavBar childId="child_1" />);
  expect(screen.getByRole('link', { name: /Map/i })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Run test (red)**

Run: `pnpm test KidNavBar -- --run`
Expected: the new test FAILS (current predicate doesn't include `/maps`).

- [ ] **Step 3: Update KidNavBar isMap predicate**

In `src/components/play/KidNavBar.tsx`, find the Map tab's `isActive`:

```ts
{
  key: 'map',
  href: `/play/${childId}`,
  icon: '🏝️',
  label: 'Map',
  isActive: (p) =>
    p === `/play/${childId}` ||
    p.startsWith(`/play/${childId}/week`) ||
    p.startsWith(`/play/${childId}/level`) ||
    p.startsWith(`/play/${childId}/maps`),  // ← add this
},
```

- [ ] **Step 4: Run tests**

Run: `pnpm test KidNavBar -- --run`
Expected: PASS (now 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/play/KidNavBar.tsx tests/unit/components/play/KidNavBar.test.tsx
git commit -m "feat(pr40): KidNavBar isMap predicate covers /maps route"
```

---

## Final verification

- [ ] **Step 1: Four-green gate**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

Expected: 0 errors across all four.

- [ ] **Step 2: Manual smoke (`pnpm dev`)**

1. Sign in as David, root redirects to `/play/[yinuoChildId]` (PR #38 behavior unchanged).
2. Above the WeekStrip, see `📍 加勒比海 / Caribbean Sea ⬇` pill.
3. Tap pill → `/maps` page with 2 cards: Caribbean (current, gold border) + Indian Ocean (dimmed lock).
4. Tap Indian Ocean → button disabled, no nav (or friendly toast if you added one).
5. Tap Caribbean → no-op (already current).
6. (Optional) Manually `UPDATE weeks SET …` to attach a fake week to Map 2 → re-load `/maps` → Indian Ocean un-dims + becomes tappable.
7. Tap unlocked Map → switches `current_curriculum_pack_id` → home reflects on next visit.
8. KidNavBar: while on `/maps`, the Map tab indicator is lit.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/pr40-multi-map-chapter-system
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat: PR #40 — multi-map chapter system (Caribbean / Indian Ocean placeholder)" --body "$(cat <<'EOF'
## Summary
- Bilingual `name_zh` + `name_en` on `curriculum_packs` (migration 0015).
- Existing 10-week pack renamed to "加勒比海 / Caribbean Sea" (Map 1).
- New "印度洋 / Indian Ocean" placeholder pack (Map 2) seeded with zero weeks.
- New `/play/[childId]/maps` gateway page (`MapsHub` + `MapCard`).
- New `MapHeaderPill` ("📍 加勒比海 ⬇") on home links to /maps.
- `switchMapAction` updates `child_profiles.current_curriculum_pack_id`.
- `KidNavBar` Map tab now active on `/maps` as well.

Spec: `docs/superpowers/specs/2026-05-26-pr40-multi-map-chapter-system-design.md`
Plan: `docs/superpowers/plans/2026-05-26-pr40-multi-map-chapter-system.md`

## Test plan
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
- [x] migration 0015 applies cleanly
- [x] seed script renames Map 1 + inserts Map 2 placeholder (idempotent)
- [ ] Manual: header pill renders + taps → /maps
- [ ] Manual: locked Map 2 card doesn't navigate
- [ ] Manual: KidNavBar Map tab lit on /maps

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: After merge — CLAUDE.md update** (separate PR)

Add PR #40 entry to "Current state" + new landmines:
- "Bilingual pack names live in `name_zh`/`name_en` columns (PR #40). The legacy `name` column is preserved as fallback; new code reads bilingual fields with `nameZh ?? name` fallback."
- "`isLocked` on a `MapForChild` = pack has zero published weeks. To 'unlock' a map, just add the first week via parent authoring. No code change needed."
- "Adding a new map = (1) insert a row in `curriculum_packs` with bilingual names; (2) leave `current_curriculum_pack_id` alone for existing children (they stay on their map); (3) when the new pack has its first week published, the lock badge auto-disappears from `/maps`."

---

## Plan self-review

**1. Spec coverage** — spec §3-§9 mapped to tasks 1-8: ✓
- §3 schema → T1 + T2 (migration + seed)
- §4 DB queries → T3
- §5 server action → T4
- §6 UI → T5 (MapCard) + T6 (MapsHub + page) + T7 (HeaderPill + home wire)
- §7-§9 = scope/test/files docs — covered by per-task test instructions

**2. Placeholder scan** — `clearedCount: 0` in T3 is deliberate not a placeholder; spec §7 lists it as deferred. No other TBD/TODO patterns.

**3. Type consistency** — `MapForChild` shape used in T3, T5, T6, T7 matches. `MapLockedError` import path consistent.

**4. Soft spots for implementer:**
- T3 has placeholder tests for `listMapsForChild` — implementer must refine mock plumbing after impl exists.
- T7 uses `Promise.all` extension in the home page; preserve order of existing destructured fetches.
- T8 modifies an existing test file — preserve the existing 6 tests, just add 1 new.

Total tasks: 8 + final verify. Estimated time per task: 8-20 min. Net LOC: ~300-500.
