# PR #38 — Kid-First Surface Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin Yinuo's four kid-facing surfaces (Map / Backpack / Calendar / Shop) to a bottom thumb-reach nav, auto-redirect signed-in single-child accounts straight to the island map, gate parent dashboard behind a 4-digit PIN, morph island→hub via the View Transitions API, surface a 7-day check-in strip + month calendar, and add a "Recently Obtained" strip to the renamed Backpack page.

**Architecture:** Five independently-shippable subsystems landing in one PR. Routing (root redirect + parent PIN gate) → PIN store & lib → KidNavBar + MidScene context → View Transitions on Map↔Hub → Calendar (WeekStrip + MonthCalendar + activity query) → Backpack rename + RecentlyObtainedStrip. Single new table (`parent_settings`), reuses `coin_transactions` / `streaks` / `child_collections` / `child_avatar_inventory` / `shop_purchases` for derived data.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle ORM · PostgreSQL (Neon) · Clerk · bcryptjs (new) · View Transitions API · Vitest + RTL + jsdom · Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-05-25-pr38-kid-first-surface-refresh-design.md](../specs/2026-05-25-pr38-kid-first-surface-refresh-design.md)

**Branch:** `feat/pr38-kid-first-surface-refresh` (already created, spec committed).

---

## File map (where each piece lives)

| Path | Resp. | Status |
|---|---|---|
| `package.json` | add `bcryptjs` + `@types/bcryptjs` | modify |
| `src/db/schema/auth.ts` | append `parentSettings` table | modify |
| `drizzle/0014_*.sql` | generate via drizzle-kit | create |
| `src/lib/auth/parent-pin.ts` | bcrypt hash/verify, cooldown logic | create |
| `src/lib/db/parent-settings.ts` | `getParentSettings`, `setParentPin`, `incrementFailed`, `clearFailed` | create |
| `src/app/parent/unlock/page.tsx` | PIN entry / setup form | create |
| `src/app/api/parent-unlock/route.ts` | POST endpoint: verify & set cookie | create |
| `src/app/parent/layout.tsx` | PIN gate redirect | modify |
| `src/app/page.tsx` | single-child redirect | modify |
| `src/components/play/MidSceneProvider.tsx` | context for mid-scene flag | create |
| `src/components/play/KidNavBar.tsx` | bottom 4-tab nav + gear | create |
| `src/app/play/[childId]/layout.tsx` | mount MidSceneProvider + KidNavBar | modify |
| `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` | set mid-scene flag | modify |
| `src/components/play/IslandMap.tsx` | viewTransitionName on island Link | modify |
| `src/app/play/[childId]/week/[weekId]/page.tsx` | viewTransitionName on hub hero | modify |
| `src/app/play/[childId]/week/[weekId]/loading.tsx` | suspense skeleton | create |
| `src/app/globals.css` | view-transition keyframes | modify |
| `src/lib/db/activity.ts` | `getActivityForRange` aggregation | create |
| `src/components/play/WeekStrip.tsx` | 7-day pills on home | create |
| `src/app/play/[childId]/page.tsx` | mount WeekStrip | modify |
| `src/components/play/MonthCalendar.tsx` | 6×7 month grid | create |
| `src/app/play/[childId]/calendar/page.tsx` | server component | create |
| `src/lib/db/recent-obtained.ts` | merge 3 sources | create |
| `src/components/play/RecentlyObtainedStrip.tsx` | horizontal scroll row | create |
| `src/components/play/AtlasHub.tsx` | rename H1 + mount strip | modify |
| `src/app/play/[childId]/collection/page.tsx` | fetch + pass recentItems | modify |
| `tests/unit/...` | 10 test files | create |

---

## Task ordering rationale

Tasks 1-7 are foundational (deps, schema, PIN, routing). Tasks 8-10 add the nav + view transitions. Tasks 11-13 add calendar. Tasks 14-15 add backpack. Each task ends with green tests + commit. No task depends on a later task. Within a task, TDD: write failing test → run it red → implement → run it green → commit.

---

## Task 1: Add bcryptjs dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install bcryptjs + types**

Run:
```bash
pnpm add bcryptjs && pnpm add -D @types/bcryptjs
```

Expected: both deps appear in `package.json`. `pnpm-lock.yaml` updates.

- [ ] **Step 2: Sanity check — typecheck + build still green**

Run:
```bash
pnpm typecheck && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps(pr38): add bcryptjs + @types/bcryptjs for parent PIN"
```

---

## Task 2: parent_settings schema + migration

**Files:**
- Modify: `src/db/schema/auth.ts`
- Create: `drizzle/0014_<name>.sql` (auto-generated)

- [ ] **Step 1: Append `parentSettings` to schema**

In `src/db/schema/auth.ts`, after `childProfiles`, append:

```ts
export const parentSettings = pgTable('parent_settings', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  parentPinHash: text('parent_pin_hash').notNull(),
  pinSetAt: timestamp('pin_set_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  failedAttempts: smallint('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});
```

Also ensure `src/db/schema/index.ts` re-exports `parentSettings` (the schema barrel file re-exports everything; verify pattern matches existing tables and add the export).

- [ ] **Step 2: Generate migration**

Run:
```bash
pnpm drizzle-kit generate
```

Expected: a new file `drizzle/0014_<adjective_word>.sql` appears with a `CREATE TABLE "parent_settings" (...)` statement.

- [ ] **Step 3: Inspect the generated SQL**

Read the new `drizzle/0014_*.sql` and confirm:
- `CREATE TABLE "parent_settings"` with the 5 columns.
- `clerk_user_id` is PRIMARY KEY.
- `failed_attempts` defaults to 0.
- No accidental changes to other tables (if there are, abort and ask for guidance).

- [ ] **Step 4: Apply migration**

Run:
```bash
pnpm tsx scripts/migrate.ts
```

Expected: migration applies cleanly to the shared Neon DB. CAUTION: this writes to the prod DB (shared `DATABASE_URL`); the table is empty so there's no data risk.

- [ ] **Step 5: Typecheck**

Run:
```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/auth.ts src/db/schema/index.ts drizzle/0014_*.sql drizzle/meta/
git commit -m "feat(pr38): parent_settings table + migration 0014"
```

---

## Task 3: parent-pin lib (bcrypt + cooldown)

**Files:**
- Create: `src/lib/auth/parent-pin.ts`
- Create: `tests/unit/lib/auth/parent-pin.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/lib/auth/parent-pin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin, isLocked, MAX_FAILED_ATTEMPTS, COOLDOWN_MS } from '@/lib/auth/parent-pin';

describe('parent-pin', () => {
  it('hashPin produces a bcrypt hash that verifies', async () => {
    const hash = await hashPin('1234');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPin('1234', hash)).toBe(true);
    expect(await verifyPin('9999', hash)).toBe(false);
  });

  it('isLocked returns true when lockedUntil is in the future', () => {
    expect(isLocked(new Date(Date.now() + 60_000))).toBe(true);
    expect(isLocked(new Date(Date.now() - 60_000))).toBe(false);
    expect(isLocked(null)).toBe(false);
  });

  it('MAX_FAILED_ATTEMPTS is 5', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
  });

  it('COOLDOWN_MS is 5 minutes', () => {
    expect(COOLDOWN_MS).toBe(5 * 60 * 1000);
  });

  it('rejects PINs that are not 4 digits', async () => {
    await expect(hashPin('12345')).rejects.toThrow();
    await expect(hashPin('abcd')).rejects.toThrow();
    await expect(hashPin('')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test parent-pin -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/auth/parent-pin.ts`:

```ts
import bcrypt from 'bcryptjs';

export const MAX_FAILED_ATTEMPTS = 5;
export const COOLDOWN_MS = 5 * 60 * 1000;
const BCRYPT_COST = 10;

export class InvalidPinFormatError extends Error {}

function assertPinShape(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new InvalidPinFormatError('PIN must be exactly 4 digits');
  }
}

export async function hashPin(pin: string): Promise<string> {
  assertPinShape(pin);
  return bcrypt.hash(pin, BCRYPT_COST);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  return bcrypt.compare(pin, hash);
}

export function isLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false;
  return lockedUntil.getTime() > Date.now();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test parent-pin -- --run`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/parent-pin.ts tests/unit/lib/auth/parent-pin.test.ts
git commit -m "feat(pr38): parent-pin lib (bcrypt hash/verify + lockout helpers)"
```

---

## Task 4: parent-settings DB queries

**Files:**
- Create: `src/lib/db/parent-settings.ts`
- Create: `tests/unit/lib/db/parent-settings.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/lib/db/parent-settings.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => {
  const mockDb: any = {
    select: vi.fn(() => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    limit: vi.fn(async () => []),
    insert: vi.fn(() => mockDb),
    values: vi.fn(() => mockDb),
    onConflictDoUpdate: vi.fn(async () => undefined),
    update: vi.fn(() => mockDb),
    set: vi.fn(() => mockDb),
  };
  return { db: mockDb };
});

import { db } from '@/db';
import {
  getParentSettings,
  setParentPin,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/db/parent-settings';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parent-settings', () => {
  it('getParentSettings returns null when no row', async () => {
    (db.limit as any).mockResolvedValueOnce([]);
    const result = await getParentSettings('user_abc');
    expect(result).toBeNull();
  });

  it('getParentSettings returns row when present', async () => {
    const row = {
      clerkUserId: 'user_abc',
      parentPinHash: '$2b$10$abc',
      pinSetAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    };
    (db.limit as any).mockResolvedValueOnce([row]);
    const result = await getParentSettings('user_abc');
    expect(result).toEqual(row);
  });

  it('setParentPin upserts hashed PIN and resets attempt counters', async () => {
    await setParentPin('user_abc', '$2b$10$newhash');
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: 'user_abc',
        parentPinHash: '$2b$10$newhash',
        failedAttempts: 0,
        lockedUntil: null,
      }),
    );
  });

  it('recordFailedAttempt increments and sets lockedUntil when threshold reached', async () => {
    await recordFailedAttempt('user_abc', /* currentAttempts */ 4);
    expect(db.update).toHaveBeenCalled();
    // The call sets failedAttempts=5 and lockedUntil to ~now+5min.
    const setArg = (db.set as any).mock.calls[0][0];
    expect(setArg.failedAttempts).toBe(5);
    expect(setArg.lockedUntil).toBeInstanceOf(Date);
  });

  it('recordFailedAttempt with attempts<4 only increments, no lock', async () => {
    await recordFailedAttempt('user_abc', /* currentAttempts */ 2);
    const setArg = (db.set as any).mock.calls[0][0];
    expect(setArg.failedAttempts).toBe(3);
    expect(setArg.lockedUntil).toBeUndefined();
  });

  it('clearFailedAttempts resets both', async () => {
    await clearFailedAttempts('user_abc');
    expect(db.update).toHaveBeenCalled();
    const setArg = (db.set as any).mock.calls[0][0];
    expect(setArg.failedAttempts).toBe(0);
    expect(setArg.lockedUntil).toBeNull();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test parent-settings -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/db/parent-settings.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { parentSettings } from '@/db/schema';
import { COOLDOWN_MS, MAX_FAILED_ATTEMPTS } from '@/lib/auth/parent-pin';

export interface ParentSettingsRow {
  clerkUserId: string;
  parentPinHash: string;
  pinSetAt: Date;
  failedAttempts: number;
  lockedUntil: Date | null;
}

export async function getParentSettings(
  clerkUserId: string,
): Promise<ParentSettingsRow | null> {
  const rows = await db
    .select()
    .from(parentSettings)
    .where(eq(parentSettings.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setParentPin(
  clerkUserId: string,
  parentPinHash: string,
): Promise<void> {
  await db
    .insert(parentSettings)
    .values({
      clerkUserId,
      parentPinHash,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .onConflictDoUpdate({
      target: parentSettings.clerkUserId,
      set: {
        parentPinHash,
        pinSetAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
}

export async function recordFailedAttempt(
  clerkUserId: string,
  currentAttempts: number,
): Promise<void> {
  const next = currentAttempts + 1;
  const reachesThreshold = next >= MAX_FAILED_ATTEMPTS;
  const set: { failedAttempts: number; lockedUntil?: Date } = {
    failedAttempts: next,
  };
  if (reachesThreshold) {
    set.lockedUntil = new Date(Date.now() + COOLDOWN_MS);
  }
  await db
    .update(parentSettings)
    .set(set)
    .where(eq(parentSettings.clerkUserId, clerkUserId));
}

export async function clearFailedAttempts(
  clerkUserId: string,
): Promise<void> {
  await db
    .update(parentSettings)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(parentSettings.clerkUserId, clerkUserId));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test parent-settings -- --run`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/parent-settings.ts tests/unit/lib/db/parent-settings.test.ts
git commit -m "feat(pr38): parent-settings DB queries (get/set/increment/clear)"
```

---

## Task 5: /parent/unlock page + /api/parent-unlock route

**Files:**
- Create: `src/app/parent/unlock/page.tsx`
- Create: `src/app/api/parent-unlock/route.ts`
- Create: `tests/unit/app/parent-unlock.test.ts`

The page does both first-time-set AND verify (one shared 4-digit-pad UI; server decides which by inspecting `getParentSettings`). The API route does the actual POST verify/set.

- [ ] **Step 1: Write failing test (API route)**

`tests/unit/app/parent-unlock.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));
vi.mock('@/lib/db/parent-settings', () => ({
  getParentSettings: vi.fn(),
  setParentPin: vi.fn(),
  recordFailedAttempt: vi.fn(),
  clearFailedAttempts: vi.fn(),
}));

import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import {
  getParentSettings,
  setParentPin,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/db/parent-settings';
import { hashPin } from '@/lib/auth/parent-pin';
import { POST } from '@/app/api/parent-unlock/route';

const setCookieMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (cookies as any).mockResolvedValue({ set: setCookieMock });
  (auth as any).mockResolvedValue({ userId: 'user_abc' });
});

function makeReq(body: Record<string, unknown>): Request {
  return new Request('http://test/api/parent-unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/parent-unlock', () => {
  it('returns 401 when signed out', async () => {
    (auth as any).mockResolvedValueOnce({ userId: null });
    const res = await POST(makeReq({ pin: '1234' }));
    expect(res.status).toBe(401);
  });

  it('rejects malformed PIN', async () => {
    const res = await POST(makeReq({ pin: 'abcd' }));
    expect(res.status).toBe(400);
  });

  it('sets PIN on first-time submission (no existing row)', async () => {
    (getParentSettings as any).mockResolvedValueOnce(null);
    const res = await POST(makeReq({ pin: '1234', mode: 'set' }));
    expect(setParentPin).toHaveBeenCalledWith('user_abc', expect.stringMatching(/^\$2/));
    expect(setCookieMock).toHaveBeenCalledWith(
      'parent_unlocked',
      '1',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 900 }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 423 when locked', async () => {
    (getParentSettings as any).mockResolvedValueOnce({
      clerkUserId: 'user_abc',
      parentPinHash: await hashPin('1234'),
      pinSetAt: new Date(),
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    const res = await POST(makeReq({ pin: '1234' }));
    expect(res.status).toBe(423);
  });

  it('verifies correct PIN, sets cookie, clears attempts', async () => {
    const hash = await hashPin('1234');
    (getParentSettings as any).mockResolvedValueOnce({
      clerkUserId: 'user_abc',
      parentPinHash: hash,
      pinSetAt: new Date(),
      failedAttempts: 2,
      lockedUntil: null,
    });
    const res = await POST(makeReq({ pin: '1234' }));
    expect(res.status).toBe(200);
    expect(clearFailedAttempts).toHaveBeenCalledWith('user_abc');
    expect(setCookieMock).toHaveBeenCalled();
  });

  it('records failure on wrong PIN', async () => {
    const hash = await hashPin('1234');
    (getParentSettings as any).mockResolvedValueOnce({
      clerkUserId: 'user_abc',
      parentPinHash: hash,
      pinSetAt: new Date(),
      failedAttempts: 1,
      lockedUntil: null,
    });
    const res = await POST(makeReq({ pin: '9999' }));
    expect(res.status).toBe(401);
    expect(recordFailedAttempt).toHaveBeenCalledWith('user_abc', 1);
    expect(setCookieMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test parent-unlock -- --run`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement API route**

`src/app/api/parent-unlock/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import {
  getParentSettings,
  setParentPin,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/db/parent-settings';
import { hashPin, verifyPin, isLocked } from '@/lib/auth/parent-pin';

const COOKIE_MAX_AGE_SECONDS = 15 * 60;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { pin?: string; mode?: 'set' | 'verify'; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const pin = body.pin ?? '';
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }

  const settings = await getParentSettings(userId);

  // First-time SET: no row, mode=set required (we treat first-ever POST as set).
  if (!settings) {
    const hash = await hashPin(pin);
    await setParentPin(userId, hash);
    await setUnlockCookie();
    return NextResponse.json({ status: 'set', next: body.next ?? '/parent' });
  }

  // Locked?
  if (isLocked(settings.lockedUntil)) {
    return NextResponse.json(
      { error: 'locked', until: settings.lockedUntil },
      { status: 423 },
    );
  }

  // Verify
  const ok = await verifyPin(pin, settings.parentPinHash);
  if (!ok) {
    await recordFailedAttempt(userId, settings.failedAttempts);
    return NextResponse.json({ error: 'wrong_pin' }, { status: 401 });
  }

  await clearFailedAttempts(userId);
  await setUnlockCookie();
  return NextResponse.json({ status: 'ok', next: body.next ?? '/parent' });
}

async function setUnlockCookie(): Promise<void> {
  const jar = await cookies();
  jar.set('parent_unlocked', '1', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}
```

- [ ] **Step 4: Implement page**

`src/app/parent/unlock/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import { ParentUnlockForm } from './ParentUnlockForm';

interface PageProps {
  searchParams: Promise<{ next?: string; reset?: string }>;
}

export default async function ParentUnlockPage({ searchParams }: PageProps) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  const { next, reset } = await searchParams;
  const settings = await getParentSettings(user.id);
  const mode: 'set' | 'verify' = !settings || reset === '1' ? 'set' : 'verify';

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <h1 className="font-hanzi text-2xl font-bold text-[var(--color-ocean-900)]">
        {mode === 'set' ? '设置 PIN / Set parent PIN' : '输入 PIN / Enter parent PIN'}
      </h1>
      <p className="max-w-xs text-sm text-[var(--color-sand-700)]">
        {mode === 'set'
          ? '设置一个 4 位数字 PIN，保护父母工作台不被误点。'
          : '输入 4 位数字 PIN，进入父母工作台。'}
      </p>
      <ParentUnlockForm mode={mode} next={next ?? '/parent'} />
    </main>
  );
}
```

`src/app/parent/unlock/ParentUnlockForm.tsx` (client component):

```tsx
'use client';

import { useState } from 'react';

interface Props {
  mode: 'set' | 'verify';
  next: string;
}

export function ParentUnlockForm({ mode, next }: Props) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be 4 digits.');
      return;
    }
    if (mode === 'set' && pin !== pin2) {
      setError('PINs do not match.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/parent-unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, mode, next }),
    });
    setSubmitting(false);

    if (res.status === 423) {
      setError('Too many wrong tries. Please wait 5 minutes.');
      return;
    }
    if (!res.ok) {
      setError(mode === 'set' ? 'Could not set PIN.' : 'Wrong PIN.');
      return;
    }
    const json = await res.json();
    window.location.href = json.next ?? '/parent';
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-3">
      <input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        className="w-40 rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-[var(--color-ocean-900)] focus:border-[var(--color-ocean-500)] focus:outline-none"
        aria-label="PIN"
      />
      {mode === 'set' && (
        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
          placeholder="确认 / Confirm"
          className="w-40 rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-[var(--color-ocean-900)] focus:border-[var(--color-ocean-500)] focus:outline-none"
          aria-label="Confirm PIN"
        />
      )}
      {error && <p className="text-sm text-[var(--color-rust-600)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[var(--color-ocean-500)] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
      >
        {submitting ? '...' : mode === 'set' ? '设置 / Set' : '解锁 / Unlock'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test parent-unlock -- --run`
Expected: PASS (6/6).

- [ ] **Step 6: Commit**

```bash
git add src/app/parent/unlock/ src/app/api/parent-unlock/ tests/unit/app/parent-unlock.test.ts
git commit -m "feat(pr38): parent PIN unlock page + API route"
```

---

## Task 6: Gate /parent layout behind PIN cookie

**Files:**
- Modify: `src/app/parent/layout.tsx`
- Create: `tests/unit/app/parent-layout.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/app/parent-layout.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('@/lib/auth/bootstrap', () => ({
  ensureUserBootstrapped: vi.fn(),
}));
vi.mock('@/lib/db/parent-settings', () => ({
  getParentSettings: vi.fn(),
}));

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import ParentLayout from '@/app/parent/layout';

const get = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (cookies as any).mockResolvedValue({ get });
  (ensureUserBootstrapped as any).mockResolvedValue({ id: 'user_abc' });
});

describe('ParentLayout PIN gate', () => {
  it('redirects to /parent/unlock when PIN set and cookie missing', async () => {
    get.mockReturnValue(undefined);
    (getParentSettings as any).mockResolvedValue({
      parentPinHash: '$2b$10$abc',
      failedAttempts: 0,
      lockedUntil: null,
    });
    await expect(
      ParentLayout({ children: null as any }),
    ).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/parent/unlock');
  });

  it('passes through when cookie present', async () => {
    get.mockReturnValue({ value: '1' });
    (getParentSettings as any).mockResolvedValue({
      parentPinHash: '$2b$10$abc',
      failedAttempts: 0,
      lockedUntil: null,
    });
    const result = await ParentLayout({ children: 'kids' as any });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('passes through (with FirstTimeBanner) when no PIN set', async () => {
    get.mockReturnValue(undefined);
    (getParentSettings as any).mockResolvedValue(null);
    const result = await ParentLayout({ children: 'kids' as any });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    // we don't assert on JSX shape; just that it didn't redirect
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test parent-layout -- --run`
Expected: FAIL (current layout doesn't gate).

- [ ] **Step 3: Modify layout**

Replace top portion of `src/app/parent/layout.tsx`. After `ensureUserBootstrapped` and the `if (!user) redirect('/sign-in')` line, insert the PIN gate:

```tsx
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  const jar = await cookies();
  const unlocked = jar.get('parent_unlocked')?.value === '1';
  const settings = await getParentSettings(user.id);

  if (settings?.parentPinHash && !unlocked) {
    redirect('/parent/unlock');
  }

  const showFirstTimeBanner = !settings?.parentPinHash;

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-sand-50)]">
      {showFirstTimeBanner && (
        <div className="bg-[var(--color-sunset-100)] px-6 py-2 text-center text-sm text-[var(--color-sunset-700)]">
          <Link href="/parent/unlock" className="font-bold underline">
            Set a parent PIN
          </Link>{' '}
          to keep Yinuo from accidentally editing your work.
        </div>
      )}
      {/* …existing header + nav + children unchanged… */}
    </div>
  );
}
```

(Keep the existing header/nav/children markup intact — only the prelude before the JSX changes, plus the conditional banner.)

- [ ] **Step 4: Run tests**

Run: `pnpm test parent-layout -- --run`
Expected: PASS (3/3).

- [ ] **Step 5: Verify other parent tests still pass**

Run: `pnpm test -- --run`
Expected: All existing tests still green.

- [ ] **Step 6: Commit**

```bash
git add src/app/parent/layout.tsx tests/unit/app/parent-layout.test.tsx
git commit -m "feat(pr38): gate /parent layout behind PIN cookie"
```

---

## Task 7: Root redirect for signed-in single-child accounts

**Files:**
- Modify: `src/app/page.tsx`
- Create: `tests/unit/app/root-page.test.tsx`

The current `src/app/page.tsx` uses `<Show when="signed-in">` (client-side Clerk component). We're converting to a server component for the redirect.

- [ ] **Step 1: Look up Clerk server-side auth pattern**

Read `src/app/parent/layout.tsx` (already modified above) to see how Clerk's `auth()` server function is used. Then check `src/lib/auth/bootstrap.ts` for the `ensureUserBootstrapped` helper which returns `{ id, ... } | null`. The id is the Clerk userId.

For listing children: there's already `listChildrenForUser(userId)` somewhere — search:
```bash
grep -rn 'listChildrenForUser\|children.*parentUserId' src/lib/db/ | head
```
If it doesn't exist, the existing `parent/children/` page already does this — copy that pattern. If still no helper, add to `src/lib/db/children.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles } from '@/db/schema';

export async function listChildrenForUser(userId: string) {
  return db.select().from(childProfiles).where(eq(childProfiles.parentUserId, userId));
}
```

- [ ] **Step 2: Write failing test**

`tests/unit/app/root-page.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('@/lib/auth/bootstrap', () => ({
  ensureUserBootstrapped: vi.fn(),
}));
vi.mock('@/lib/db/children', () => ({
  listChildrenForUser: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { listChildrenForUser } from '@/lib/db/children';
import HomePage from '@/app/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage root redirect', () => {
  it('redirects to /play/[childId] when signed-in single-child', async () => {
    (ensureUserBootstrapped as any).mockResolvedValue({ id: 'user_abc' });
    (listChildrenForUser as any).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    await expect(HomePage()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/play/child_1');
  });

  it('does NOT redirect for signed-out', async () => {
    (ensureUserBootstrapped as any).mockResolvedValue(null);
    const result = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('does NOT redirect when signed-in multi-child', async () => {
    (ensureUserBootstrapped as any).mockResolvedValue({ id: 'user_abc' });
    (listChildrenForUser as any).mockResolvedValue([
      { id: 'c1', displayName: 'A' },
      { id: 'c2', displayName: 'B' },
    ]);
    const result = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('does NOT redirect when signed-in zero-child', async () => {
    (ensureUserBootstrapped as any).mockResolvedValue({ id: 'user_abc' });
    (listChildrenForUser as any).mockResolvedValue([]);
    const result = await HomePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 3: Run failing test**

Run: `pnpm test root-page -- --run`
Expected: FAIL.

- [ ] **Step 4: Rewrite `src/app/page.tsx`**

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { listChildrenForUser } from '@/lib/db/children';

export default async function HomePage() {
  const user = await ensureUserBootstrapped();

  if (user) {
    const children = await listChildrenForUser(user.id);
    if (children.length === 1) {
      redirect(`/play/${children[0].id}`);
    }
  }

  const t = await getTranslations('Home');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[var(--color-sand-50)] px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rounded-full bg-[var(--color-ocean-100)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ocean-700)]">
          For the 海盗班 crew
        </span>
        <h1 className="font-hanzi text-6xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          {t('title')}
        </h1>
        <p className="max-w-md text-base text-[var(--color-sand-700)]">
          {t('subtitle')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!user && (
          <>
            <Link
              href="/sign-up"
              className="rounded-full bg-[var(--color-ocean-500)] px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-95"
            >
              Sign up
            </Link>
            <Link
              href="/sign-in"
              className="rounded-full border-2 border-[var(--color-ocean-300)] bg-white px-6 py-3 text-sm font-semibold text-[var(--color-ocean-700)] transition-transform hover:bg-[var(--color-ocean-100)] active:scale-95"
            >
              Sign in
            </Link>
          </>
        )}
        {user && (
          <Link
            href="/parent"
            className="rounded-full bg-[var(--color-ocean-500)] px-7 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-95"
          >
            Open parent dashboard →
          </Link>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test root-page -- --run`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/lib/db/children.ts tests/unit/app/root-page.test.tsx
git commit -m "feat(pr38): root redirects single-child to /play/[childId]"
```

---

## Task 8: MidSceneProvider context

**Files:**
- Create: `src/components/play/MidSceneProvider.tsx`
- Create: `tests/unit/components/play/MidSceneProvider.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/components/play/MidSceneProvider.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MidSceneProvider,
  useMidScene,
  MidSceneFlag,
} from '@/components/play/MidSceneProvider';

function Probe() {
  const ctx = useMidScene();
  return <div data-testid="probe">{ctx.midScene ? 'YES' : 'NO'}</div>;
}

describe('MidSceneProvider', () => {
  it('defaults to false', () => {
    render(
      <MidSceneProvider>
        <Probe />
      </MidSceneProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('NO');
  });

  it('MidSceneFlag flips to true when mounted', () => {
    render(
      <MidSceneProvider>
        <MidSceneFlag />
        <Probe />
      </MidSceneProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('YES');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test MidSceneProvider -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/play/MidSceneProvider.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface MidSceneCtx {
  midScene: boolean;
  setMidScene: (v: boolean) => void;
}

const Ctx = createContext<MidSceneCtx>({
  midScene: false,
  setMidScene: () => undefined,
});

export function MidSceneProvider({ children }: { children: React.ReactNode }) {
  const [midScene, setMidScene] = useState(false);
  return (
    <Ctx.Provider value={{ midScene, setMidScene }}>{children}</Ctx.Provider>
  );
}

export function useMidScene(): MidSceneCtx {
  return useContext(Ctx);
}

/**
 * Mount this inside a section/scene server-component subtree (as a client
 * child) to flip the provider flag to true while the subtree is alive.
 * Restores to false on unmount.
 */
export function MidSceneFlag(): null {
  const { setMidScene } = useMidScene();
  useEffect(() => {
    setMidScene(true);
    return () => setMidScene(false);
  }, [setMidScene]);
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test MidSceneProvider -- --run`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/components/play/MidSceneProvider.tsx tests/unit/components/play/MidSceneProvider.test.tsx
git commit -m "feat(pr38): MidSceneProvider context for nav quit-confirm"
```

---

## Task 9: KidNavBar component

**Files:**
- Create: `src/components/play/KidNavBar.tsx`
- Create: `tests/unit/components/play/KidNavBar.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/components/play/KidNavBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const pathnameMock = vi.fn(() => '/play/child_1');
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

import { KidNavBar } from '@/components/play/KidNavBar';
import { MidSceneProvider, MidSceneFlag } from '@/components/play/MidSceneProvider';

function MidWrap({ children }: { children: React.ReactNode }) {
  return (
    <MidSceneProvider>
      <MidSceneFlag />
      {children}
    </MidSceneProvider>
  );
}

describe('KidNavBar', () => {
  it('renders 4 tabs + gear', () => {
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /背包/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /日历/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /商店/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /parent/i })).toBeInTheDocument();
  });

  it('marks Map tab active on /play/[childId]', () => {
    pathnameMock.mockReturnValue('/play/child_1');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Map tab active on /play/[childId]/week/[weekId]', () => {
    pathnameMock.mockReturnValue('/play/child_1/week/week_1');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Backpack active on /collection', () => {
    pathnameMock.mockReturnValue('/play/child_1/collection');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /背包/ })).toHaveAttribute('aria-current', 'page');
  });

  it('mid-scene tab tap shows quit-confirm dialog', () => {
    pathnameMock.mockReturnValue('/play/child_1/level/week_1/practice');
    render(
      <MidWrap>
        <KidNavBar childId="child_1" />
      </MidWrap>,
    );
    fireEvent.click(screen.getByRole('link', { name: /日历/ }));
    expect(screen.getByText(/结束这一关|Quit this level/)).toBeInTheDocument();
  });

  it('"Stay" closes dialog without navigating', () => {
    pathnameMock.mockReturnValue('/play/child_1/level/week_1/practice');
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign, href: '' },
      writable: true,
    });
    render(
      <MidWrap>
        <KidNavBar childId="child_1" />
      </MidWrap>,
    );
    fireEvent.click(screen.getByRole('link', { name: /日历/ }));
    fireEvent.click(screen.getByRole('button', { name: /Stay|继续/ }));
    expect(screen.queryByText(/结束这一关|Quit this level/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test KidNavBar -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/play/KidNavBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMidScene } from './MidSceneProvider';

interface Props {
  childId: string;
}

interface TabDef {
  key: string;
  href: string;
  icon: string;
  label: string;
  isActive: (path: string) => boolean;
}

export function KidNavBar({ childId }: Props) {
  const path = usePathname();
  const router = useRouter();
  const { midScene } = useMidScene();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const tabs: TabDef[] = [
    {
      key: 'map',
      href: `/play/${childId}`,
      icon: '🏝️',
      label: 'Map',
      isActive: (p) =>
        p === `/play/${childId}` ||
        p.startsWith(`/play/${childId}/week`) ||
        p.startsWith(`/play/${childId}/level`),
    },
    {
      key: 'backpack',
      href: `/play/${childId}/collection`,
      icon: '🎒',
      label: '背包',
      isActive: (p) => p.startsWith(`/play/${childId}/collection`),
    },
    {
      key: 'calendar',
      href: `/play/${childId}/calendar`,
      icon: '📅',
      label: '日历',
      isActive: (p) => p.startsWith(`/play/${childId}/calendar`),
    },
    {
      key: 'shop',
      href: `/play/${childId}/shop`,
      icon: '🛒',
      label: '商店',
      isActive: (p) => p.startsWith(`/play/${childId}/shop`),
    },
  ];

  function onTabClick(e: React.MouseEvent, href: string, isActive: boolean) {
    if (isActive) return; // no-op when tapping current tab
    if (midScene) {
      e.preventDefault();
      setConfirmTarget(href);
    }
  }

  return (
    <>
      <nav
        className="sticky bottom-0 z-30 flex items-center justify-around border-t border-[var(--color-sand-200)] bg-white/85 px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-2 backdrop-blur-md"
        aria-label="Kid navigation"
      >
        {tabs.map((tab) => {
          const active = tab.isActive(path);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch
              aria-current={active ? 'page' : undefined}
              onClick={(e) => onTabClick(e, tab.href, active)}
              className="flex min-w-14 flex-col items-center gap-0.5 px-2 py-1 transition-colors"
            >
              <span className="text-2xl leading-none">{tab.icon}</span>
              <span
                className={
                  active
                    ? 'text-xs font-bold text-[var(--color-ocean-700)]'
                    : 'text-xs font-medium text-[var(--color-sand-600)]'
                }
              >
                {tab.label}
              </span>
              <span
                className={
                  active
                    ? 'h-1 w-1 rounded-full bg-[var(--color-ocean-700)]'
                    : 'h-1 w-1 rounded-full bg-transparent'
                }
              />
            </Link>
          );
        })}
        <Link
          href="/parent"
          aria-label="parent gear"
          className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-sand-500)] transition-colors hover:text-[var(--color-sand-700)]"
        >
          <span className="text-lg">⚙️</span>
        </Link>
      </nav>
      {confirmTarget && (
        <QuitConfirmDialog
          target={confirmTarget}
          onStay={() => setConfirmTarget(null)}
          onQuit={() => {
            const t = confirmTarget;
            setConfirmTarget(null);
            router.push(t);
          }}
        />
      )}
    </>
  );
}

function QuitConfirmDialog({
  target: _target,
  onStay,
  onQuit,
}: {
  target: string;
  onStay: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="font-hanzi text-xl font-bold text-[var(--color-ocean-900)]">
          结束这一关? Quit this level?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-sand-700)]">
          进度会保留 / Progress will be saved.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onStay}
            className="rounded-full bg-[var(--color-ocean-500)] px-5 py-2 text-sm font-bold text-white shadow-md active:scale-95"
          >
            继续 / Stay
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="rounded-full border-2 border-[var(--color-sand-300)] bg-white px-5 py-2 text-sm font-bold text-[var(--color-sand-700)] active:scale-95"
          >
            结束 / Quit
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test KidNavBar -- --run`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/components/play/KidNavBar.tsx tests/unit/components/play/KidNavBar.test.tsx
git commit -m "feat(pr38): KidNavBar with 4 tabs + gear + mid-scene quit-confirm"
```

---

## Task 10: Mount KidNavBar in play layout + set mid-scene flag in section page

**Files:**
- Modify: `src/app/play/[childId]/layout.tsx`
- Modify: `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`

- [ ] **Step 1: Mount provider + nav in layout**

Edit `src/app/play/[childId]/layout.tsx`, replace the return-statement section:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { ZodiacIconDefs } from '@/components/play/zodiac-icons';
import { ShopHudButton } from '@/components/play/ShopHudButton';
import { SoundThemeBootstrap } from '@/components/play/SoundThemeBootstrap';
import { MidSceneProvider } from '@/components/play/MidSceneProvider';
import { KidNavBar } from '@/components/play/KidNavBar';
import { getChildSettings } from '@/lib/db/settings';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}

export default async function PlayLayout({ children, params }: LayoutProps) {
  const { childId } = await params;
  try {
    await requireChild(childId);
  } catch {
    notFound();
  }

  const settings = await getChildSettings(childId);
  const themeSlug = settings?.soundThemeSlug ?? null;

  return (
    <div
      className="flex min-h-full flex-1 flex-col text-[var(--color-ocean-900)]"
      style={{
        background:
          'linear-gradient(to bottom, var(--color-ocean-100) 0%, var(--color-sand-50) 60%, var(--color-treasure-100) 100%)',
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/60 bg-white/50 px-4 py-2 backdrop-blur">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-transparent" aria-hidden>
          ·
        </span>
        <span className="font-hanzi text-base font-bold tracking-wide text-[var(--color-ocean-900)]">
          汉字探险
        </span>
        <ShopHudButton childId={childId} />
      </header>
      <ZodiacIconDefs />
      <SoundThemeBootstrap themeSlug={themeSlug} />
      <MidSceneProvider>
        <div className="flex flex-1 flex-col pb-20">{children}</div>
        <KidNavBar childId={childId} />
      </MidSceneProvider>
    </div>
  );
}
```

Note: the previous `← Parent` link is now removed from the header — the gear in `KidNavBar` is the only path. A transparent placeholder keeps the header layout balanced. (We could shrink the header further in a follow-up.)

- [ ] **Step 2: Mount mid-scene flag in section page**

Edit `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`. After the existing imports, add:

```tsx
import { MidSceneFlag } from '@/components/play/MidSceneProvider';
```

In the returned JSX, wrap the existing root with `<><MidSceneFlag />{existing}</>` or — preferred — insert `<MidSceneFlag />` as the first child of whatever wraps the SceneRunner. Concretely, find the `return (...)` and prepend `<MidSceneFlag />` immediately inside the outermost JSX element.

- [ ] **Step 3: Manual smoke**

Run:
```bash
pnpm dev
```

In a browser, navigate to `/play/<yinuoChildId>` after signing in. Verify:
- Bottom nav appears with 4 tabs + gear.
- Tabs are clickable; active dot moves.
- Enter a scene; tap a non-Map tab → quit-confirm dialog appears.
- "Stay" closes the dialog; "Quit" navigates away.

- [ ] **Step 4: Run full test suite to catch regressions**

Run:
```bash
pnpm test -- --run
```

Expected: All green.

- [ ] **Step 5: Commit**

```bash
git add src/app/play/[childId]/layout.tsx src/app/play/[childId]/level/[weekId]/[section]/page.tsx
git commit -m "feat(pr38): mount KidNavBar in play layout + mid-scene flag"
```

---

## Task 11: View Transitions wiring (Map → Hub morph)

**Files:**
- Modify: `src/components/play/IslandMap.tsx`
- Modify: `src/app/play/[childId]/week/[weekId]/page.tsx`
- Create: `src/app/play/[childId]/week/[weekId]/loading.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/components/play/IslandMap.test.tsx` (existing file; add a test)

- [ ] **Step 1: Add `viewTransitionName` to island Link**

In `src/components/play/IslandMap.tsx`, locate the `<Link>` per island (around line 174). Update:

```tsx
<Link
  key={island.weekId}
  href={`/play/${childId}/week/${island.weekId}`}
  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sunset-400)]"
  style={{
    left: `${xPct}%`,
    top: `${yPct}%`,
    width: `${(ISLAND_RADIUS * 2 + 16) / SVG_WIDTH * 100}%`,
    aspectRatio: '1 / 1',
    viewTransitionName: `island-${island.weekId}`,
  }}
  aria-label={`Open ${island.label}, ${island.completionPercent}% complete`}
/>
```

- [ ] **Step 2: Add matching name to hub hero**

Open `src/app/play/[childId]/week/[weekId]/page.tsx`. Locate the hero card (the top-most section showing the island number/name). Wrap it (or add to it) `style={{ viewTransitionName: \`island-${weekId}\` }}`. If the hero is currently rendered by a child component, plumb the prop through. Concretely:

```tsx
<div
  style={{ viewTransitionName: `island-${weekId}` }}
  className="… existing classes …"
>
  {/* existing hero JSX */}
</div>
```

- [ ] **Step 3: Add loading.tsx skeleton**

`src/app/play/[childId]/week/[weekId]/loading.tsx`:

```tsx
export default function HubLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
    </main>
  );
}
```

- [ ] **Step 4: Add view-transition CSS**

Append to `src/app/globals.css`:

```css
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root) { animation: 150ms ease-out both vt-fade-out; }
  ::view-transition-new(root) { animation: 220ms ease-in  both vt-fade-in;  }
  @keyframes vt-fade-out { to   { opacity: 0; } }
  @keyframes vt-fade-in  { from { opacity: 0; } to { opacity: 1; } }
}
```

- [ ] **Step 5: Write a test asserting the style is emitted**

Open `tests/unit/components/play/IslandMap.test.tsx` (create if it doesn't exist). Add:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IslandMap } from '@/components/play/IslandMap';

describe('IslandMap view transitions', () => {
  it('island Links receive viewTransitionName style', () => {
    const { container } = render(
      <IslandMap
        childId="child_1"
        islands={[
          { weekId: 'week_a', weekNumber: 1, label: 'Week 1', completionPercent: 0 },
          { weekId: 'week_b', weekNumber: 2, label: 'Week 2', completionPercent: 50 },
        ]}
        ownedCount={0}
        totalCount={10}
      />,
    );
    const links = container.querySelectorAll('a[href^="/play/child_1/week/"]');
    expect(links.length).toBe(2);
    // jsdom serializes view-transition-name as inline style camelCase prop
    expect((links[0] as HTMLElement).style.viewTransitionName).toBe('island-week_a');
    expect((links[1] as HTMLElement).style.viewTransitionName).toBe('island-week_b');
  });
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm test IslandMap -- --run`
Expected: PASS.

- [ ] **Step 7: Manual smoke**

`pnpm dev` → tap an island → on Chrome/Safari iOS the morph plays. On older browsers, instant swap with skeleton fallback. No console errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/play/IslandMap.tsx \
        src/app/play/[childId]/week/[weekId]/page.tsx \
        src/app/play/[childId]/week/[weekId]/loading.tsx \
        src/app/globals.css \
        tests/unit/components/play/IslandMap.test.tsx
git commit -m "feat(pr38): View Transitions morph from island to hub hero"
```

---

## Task 12: Activity & streak DB queries

**Files:**
- Create: `src/lib/db/activity.ts`
- Create: `tests/unit/lib/db/activity.test.ts`

The query reuses `coin_transactions` (already populated by every play event) + `streaks`. No new tables.

- [ ] **Step 1: Write failing tests**

`tests/unit/lib/db/activity.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => {
  const mockDb: any = {
    select: vi.fn(() => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    orderBy: vi.fn(async () => []),
  };
  return { db: mockDb };
});

import { db } from '@/db';
import {
  getActivityForRange,
  bucketByDate,
  type ActivityDay,
} from '@/lib/db/activity';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bucketByDate', () => {
  it('groups transactions by UTC date', () => {
    const txs = [
      { date: '2026-05-01', reason: 'scene_complete', delta: 50 },
      { date: '2026-05-01', reason: 'daily_login', delta: 20 },
      { date: '2026-05-02', reason: 'streak_freeze', delta: 0 },
    ] as const;
    const days = bucketByDate(txs, '2026-05-01', '2026-05-03');
    expect(days).toHaveLength(3);
    expect(days[0].dateIso).toBe('2026-05-01');
    expect(days[0].played).toBe(true);
    expect(days[0].dailyLoginBonus).toBe(true);
    expect(days[0].coinsEarned).toBe(70);
    expect(days[1].freezeBurned).toBe(true);
    expect(days[1].played).toBe(false);
    expect(days[2].played).toBe(false); // no tx on 2026-05-03
  });
});

describe('getActivityForRange', () => {
  it('queries coin_transactions for range and buckets', async () => {
    (db.orderBy as any).mockResolvedValueOnce([
      { date: '2026-05-01', reason: 'scene_complete', delta: 50 },
    ]);
    const days = await getActivityForRange('child_1', '2026-05-01', '2026-05-01');
    expect(days).toHaveLength(1);
    expect(days[0].played).toBe(true);
    expect(days[0].coinsEarned).toBe(50);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test activity -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/db/activity.ts`:

```ts
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { coinTransactions } from '@/db/schema';

export interface ActivityDay {
  dateIso: string;
  played: boolean;
  dailyLoginBonus: boolean;
  freezeBurned: boolean;
  coinsEarned: number;
}

interface DayTx {
  date: string;
  reason: string;
  delta: number;
}

/**
 * Iterates dateIso from startIso to endIso (inclusive), bucketing the input
 * transactions into per-day rollups.
 */
export function bucketByDate(
  txs: readonly DayTx[],
  startIso: string,
  endIso: string,
): ActivityDay[] {
  const byDate = new Map<string, ActivityDay>();
  for (const d of iterateDates(startIso, endIso)) {
    byDate.set(d, {
      dateIso: d,
      played: false,
      dailyLoginBonus: false,
      freezeBurned: false,
      coinsEarned: 0,
    });
  }
  for (const tx of txs) {
    const day = byDate.get(tx.date);
    if (!day) continue;
    if (tx.reason === 'daily_login') day.dailyLoginBonus = true;
    else if (tx.reason === 'streak_freeze') day.freezeBurned = true;
    else if (tx.delta > 0) day.played = true;
    if (tx.delta > 0) day.coinsEarned += tx.delta;
  }
  return Array.from(byDate.values());
}

function iterateDates(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export async function getActivityForRange(
  childId: string,
  startIso: string,
  endIso: string,
): Promise<ActivityDay[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${coinTransactions.createdAt} at time zone 'utc', 'YYYY-MM-DD')`,
      reason: coinTransactions.reason,
      delta: coinTransactions.delta,
    })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.childId, childId),
        gte(
          sql`(${coinTransactions.createdAt} at time zone 'utc')::date`,
          sql`${startIso}::date`,
        ),
        lte(
          sql`(${coinTransactions.createdAt} at time zone 'utc')::date`,
          sql`${endIso}::date`,
        ),
      ),
    )
    .orderBy(coinTransactions.createdAt);

  return bucketByDate(rows, startIso, endIso);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test activity -- --run`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/activity.ts tests/unit/lib/db/activity.test.ts
git commit -m "feat(pr38): getActivityForRange aggregation over coin_transactions"
```

---

## Task 13: WeekStrip component + integrate into home

**Files:**
- Create: `src/components/play/WeekStrip.tsx`
- Modify: `src/app/play/[childId]/page.tsx`
- Create: `tests/unit/components/play/WeekStrip.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/components/play/WeekStrip.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekStrip } from '@/components/play/WeekStrip';
import type { ActivityDay } from '@/lib/db/activity';

function day(dateIso: string, overrides: Partial<ActivityDay> = {}): ActivityDay {
  return {
    dateIso,
    played: false,
    dailyLoginBonus: false,
    freezeBurned: false,
    coinsEarned: 0,
    ...overrides,
  };
}

describe('WeekStrip', () => {
  it('renders 7 day pills', () => {
    const activity: ActivityDay[] = [
      day('2026-05-04'),
      day('2026-05-05'),
      day('2026-05-06'),
      day('2026-05-07'),
      day('2026-05-08'),
      day('2026-05-09'),
      day('2026-05-10'),
    ];
    render(<WeekStrip activity={activity} todayIso="2026-05-07" childId="c1" />);
    expect(screen.getAllByTestId(/^week-strip-pill-/)).toHaveLength(7);
  });

  it('renders ⭐ for played days and ❄️ for freeze burns', () => {
    const activity: ActivityDay[] = [
      day('2026-05-04', { played: true }),
      day('2026-05-05', { freezeBurned: true }),
      day('2026-05-06'),
      day('2026-05-07', { played: true }),
      day('2026-05-08'),
      day('2026-05-09'),
      day('2026-05-10'),
    ];
    render(<WeekStrip activity={activity} todayIso="2026-05-07" childId="c1" />);
    expect(screen.getByText('⭐', { selector: '[data-day-iso="2026-05-04"] *' })).toBeInTheDocument();
    expect(screen.getByText('❄️', { selector: '[data-day-iso="2026-05-05"] *' })).toBeInTheDocument();
  });

  it('whole strip is a Link to /calendar', () => {
    const activity: ActivityDay[] = Array.from({ length: 7 }, (_, i) =>
      day(`2026-05-0${i + 4}`),
    );
    render(<WeekStrip activity={activity} todayIso="2026-05-07" childId="c1" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/c1/calendar');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test WeekStrip -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/play/WeekStrip.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { ActivityDay } from '@/lib/db/activity';

interface Props {
  /** Exactly 7 days, oldest first. */
  activity: ActivityDay[];
  todayIso: string;
  childId: string;
}

const DOW_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iconFor(day: ActivityDay, isToday: boolean, isFuture: boolean): string {
  if (isToday) return '●';
  if (isFuture) return '·';
  if (day.freezeBurned) return '❄️';
  if (day.dailyLoginBonus && !day.played) return '🪙';
  if (day.played) return '⭐';
  return '·';
}

export function WeekStrip({ activity, todayIso, childId }: Props) {
  return (
    <Link
      href={`/play/${childId}/calendar`}
      className="flex items-stretch justify-between gap-1 rounded-2xl border border-[var(--color-sand-200)] bg-white/80 px-2 py-2 shadow-sm transition-colors hover:bg-white"
      aria-label="Open calendar"
    >
      {activity.map((d, idx) => {
        const isToday = d.dateIso === todayIso;
        const isFuture = d.dateIso > todayIso;
        const icon = iconFor(d, isToday, isFuture);
        return (
          <div
            key={d.dateIso}
            data-testid={`week-strip-pill-${idx}`}
            data-day-iso={d.dateIso}
            className={
              isToday
                ? 'flex flex-1 flex-col items-center rounded-xl bg-[var(--color-treasure-100)] py-1 ring-2 ring-[var(--color-treasure-400)]'
                : 'flex flex-1 flex-col items-center py-1'
            }
          >
            <span className="text-[10px] font-semibold uppercase text-[var(--color-sand-600)]">
              {DOW_LABELS_EN[idx]}
            </span>
            <span className="text-lg leading-tight">{icon}</span>
            <span className="text-[10px] text-[var(--color-sand-700)]">
              {d.dateIso.slice(-2)}
            </span>
          </div>
        );
      })}
    </Link>
  );
}
```

- [ ] **Step 4: Wire into home page**

Edit `src/app/play/[childId]/page.tsx`. Add imports:

```tsx
import { WeekStrip } from '@/components/play/WeekStrip';
import { getActivityForRange } from '@/lib/db/activity';
import { todayUtcIso } from '@/lib/db/streaks';
```

In `Promise.all`, append fetching the current-week activity. Compute the Monday-start of the current ISO week:

```tsx
const todayIso = todayUtcIso();
const monday = mondayOfIsoWeek(todayIso);
const sunday = isoDateAddDays(monday, 6);

// inside Promise.all:
const [playableWeeks, progressRows, balance, activePacks, equipped, pet, ownedDecorations, weekActivity] = await Promise.all([
  // …existing fetches…,
  getActivityForRange(child.id, monday, sunday),
]);
```

Add small helpers above the component (or at the bottom of the file):

```tsx
function mondayOfIsoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
function isoDateAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

In the returned JSX, insert `<WeekStrip>` between the avatar header and `<IslandMap>`:

```tsx
<WeekStrip activity={weekActivity} todayIso={todayIso} childId={childId} />
```

- [ ] **Step 5: Run tests**

Run: `pnpm test WeekStrip -- --run`
Expected: PASS (3/3).

Then run full suite to catch regressions in `page.test.tsx` if it exists:

Run: `pnpm test -- --run`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/WeekStrip.tsx src/app/play/[childId]/page.tsx tests/unit/components/play/WeekStrip.test.tsx
git commit -m "feat(pr38): WeekStrip on home + getActivityForRange wiring"
```

---

## Task 14: MonthCalendar + /calendar page

**Files:**
- Create: `src/components/play/MonthCalendar.tsx`
- Create: `src/app/play/[childId]/calendar/page.tsx`
- Create: `tests/unit/components/play/MonthCalendar.test.tsx`
- Create: `tests/unit/app/calendar-page.test.tsx`

- [ ] **Step 1: Write failing test (component)**

`tests/unit/components/play/MonthCalendar.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonthCalendar } from '@/components/play/MonthCalendar';
import type { ActivityDay } from '@/lib/db/activity';

function day(dateIso: string, overrides: Partial<ActivityDay> = {}): ActivityDay {
  return {
    dateIso,
    played: false,
    dailyLoginBonus: false,
    freezeBurned: false,
    coinsEarned: 0,
    ...overrides,
  };
}

describe('MonthCalendar', () => {
  it('renders correct number of day cells for May 2026 (31 days)', () => {
    const activity = Array.from({ length: 31 }, (_, i) =>
      day(`2026-05-${String(i + 1).padStart(2, '0')}`),
    );
    render(
      <MonthCalendar
        yyyymm="2026-05"
        activity={activity}
        todayIso="2026-05-15"
        streakDays={0}
        childId="c1"
      />,
    );
    expect(screen.getAllByTestId(/^cal-cell-/)).toHaveLength(31);
  });

  it('shows ⭐ for played days', () => {
    const activity = [day('2026-05-01', { played: true })];
    render(
      <MonthCalendar
        yyyymm="2026-05"
        activity={activity}
        todayIso="2026-05-15"
        streakDays={0}
        childId="c1"
      />,
    );
    expect(screen.getByTestId('cal-cell-2026-05-01').textContent).toContain('⭐');
  });

  it('renders prev/next month nav', () => {
    render(
      <MonthCalendar
        yyyymm="2026-05"
        activity={[]}
        todayIso="2026-05-15"
        streakDays={0}
        childId="c1"
      />,
    );
    expect(screen.getByRole('link', { name: /prev|前/i })).toHaveAttribute(
      'href',
      '/play/c1/calendar?yyyymm=2026-04',
    );
    expect(screen.getByRole('link', { name: /next|后/i })).toHaveAttribute(
      'href',
      '/play/c1/calendar?yyyymm=2026-06',
    );
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test MonthCalendar -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement component**

`src/components/play/MonthCalendar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { ActivityDay } from '@/lib/db/activity';

interface Props {
  yyyymm: string; // "2026-05"
  activity: ActivityDay[];
  todayIso: string;
  streakDays: number;
  childId: string;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function leadingPad(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  return dow === 0 ? 6 : dow - 1;
}

function prevMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function iconFor(d: ActivityDay | undefined, isToday: boolean, isFuture: boolean): string {
  if (isToday) return '●';
  if (isFuture) return '·';
  if (!d) return '·';
  if (d.freezeBurned) return '❄️';
  if (d.dailyLoginBonus && !d.played) return '🪙';
  if (d.played) return '⭐';
  return '·';
}

export function MonthCalendar({
  yyyymm,
  activity,
  todayIso,
  streakDays,
  childId,
}: Props) {
  const byDate = new Map(activity.map((d) => [d.dateIso, d]));
  const total = daysInMonth(yyyymm);
  const pad = leadingPad(yyyymm);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/play/${childId}/calendar?yyyymm=${prevMonth(yyyymm)}`}
          className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold shadow-sm"
          aria-label="prev / 前"
        >
          ← {prevMonth(yyyymm)}
        </Link>
        <h1 className="font-hanzi text-lg font-bold">{yyyymm}</h1>
        <Link
          href={`/play/${childId}/calendar?yyyymm=${nextMonth(yyyymm)}`}
          className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold shadow-sm"
          aria-label="next / 后"
        >
          {nextMonth(yyyymm)} →
        </Link>
      </div>

      <div className="rounded-2xl bg-[var(--color-treasure-100)] px-4 py-3 text-center text-sm font-bold text-[var(--color-treasure-700)]">
        🔥 Current streak: {streakDays} day{streakDays === 1 ? '' : 's'}
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl bg-white/80 p-3 shadow-sm">
        {DOW.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-bold uppercase text-[var(--color-sand-600)]"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const dom = i + 1;
          const dateIso = `${yyyymm}-${String(dom).padStart(2, '0')}`;
          const d = byDate.get(dateIso);
          const isToday = dateIso === todayIso;
          const isFuture = dateIso > todayIso;
          return (
            <div
              key={dateIso}
              data-testid={`cal-cell-${dateIso}`}
              className={
                isToday
                  ? 'flex aspect-square flex-col items-center justify-center rounded-lg bg-[var(--color-treasure-100)] ring-2 ring-[var(--color-treasure-400)]'
                  : isFuture
                    ? 'flex aspect-square flex-col items-center justify-center text-[var(--color-sand-300)]'
                    : 'flex aspect-square flex-col items-center justify-center'
              }
            >
              <span className="text-[10px] text-[var(--color-sand-700)]">
                {dom}
              </span>
              <span className="text-base leading-tight">
                {iconFor(d, isToday, isFuture)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white/60 px-4 py-2 text-center text-[11px] text-[var(--color-sand-700)]">
        Legend: ⭐ played · 🪙 daily bonus · ❄️ streak saved · ● today
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Write failing test (page)**

`tests/unit/app/calendar-page.test.tsx`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'c1' } }),
}));
vi.mock('@/lib/db/activity', () => ({
  getActivityForRange: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/db/streaks', () => ({
  getStreakState: vi.fn().mockResolvedValue({
    currentStreak: 7,
    longestStreak: 14,
    lastPlayedDate: '2026-05-15',
    freezeTokens: 0,
  }),
  todayUtcIso: vi.fn(() => '2026-05-15'),
}));

import CalendarPage from '@/app/play/[childId]/calendar/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CalendarPage', () => {
  it('renders for current month when no yyyymm param', async () => {
    const result = await CalendarPage({
      params: Promise.resolve({ childId: 'c1' }),
      searchParams: Promise.resolve({}),
    });
    expect(result).toBeDefined();
  });

  it('renders for a specific yyyymm', async () => {
    const result = await CalendarPage({
      params: Promise.resolve({ childId: 'c1' }),
      searchParams: Promise.resolve({ yyyymm: '2026-04' }),
    });
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 5: Run failing test**

Run: `pnpm test calendar-page -- --run`
Expected: FAIL.

- [ ] **Step 6: Implement page**

`src/app/play/[childId]/calendar/page.tsx`:

```tsx
import { requireChild } from '@/lib/auth/guards';
import { getActivityForRange } from '@/lib/db/activity';
import { getStreakState, todayUtcIso } from '@/lib/db/streaks';
import { MonthCalendar } from '@/components/play/MonthCalendar';

interface PageProps {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ yyyymm?: string }>;
}

function currentYyyyMm(): string {
  return todayUtcIso().slice(0, 7);
}

function monthRange(yyyymm: string): { startIso: string; endIso: string } {
  const [y, m] = yyyymm.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    startIso: `${yyyymm}-01`,
    endIso: `${yyyymm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { childId } = await params;
  const { yyyymm: yyyymmParam } = await searchParams;
  const { child } = await requireChild(childId);

  const yyyymm = /^\d{4}-\d{2}$/.test(yyyymmParam ?? '')
    ? (yyyymmParam as string)
    : currentYyyyMm();
  const { startIso, endIso } = monthRange(yyyymm);

  const [activity, streak] = await Promise.all([
    getActivityForRange(child.id, startIso, endIso),
    getStreakState(child.id),
  ]);

  return (
    <MonthCalendar
      yyyymm={yyyymm}
      activity={activity}
      todayIso={todayUtcIso()}
      streakDays={streak.currentStreak}
      childId={child.id}
    />
  );
}
```

- [ ] **Step 7: Run tests**

Run: `pnpm test calendar -- --run`
Expected: PASS (component 3/3 + page 2/2).

- [ ] **Step 8: Commit**

```bash
git add src/components/play/MonthCalendar.tsx \
        src/app/play/[childId]/calendar/page.tsx \
        tests/unit/components/play/MonthCalendar.test.tsx \
        tests/unit/app/calendar-page.test.tsx
git commit -m "feat(pr38): /calendar month view + MonthCalendar component"
```

---

## Task 15: getRecentlyObtainedForChild

**Files:**
- Create: `src/lib/db/recent-obtained.ts`
- Create: `tests/unit/lib/db/recent-obtained.test.ts`

- [ ] **Step 1: Inspect existing tables**

Run:
```bash
grep -rn 'childCollections\|childAvatarInventory\|shopPurchases' src/db/schema/ | head
```

Confirm the column names (typically `obtainedAt`, `createdAt`, or `purchasedAt`). The implementation below assumes `child_collections.obtained_at`, `child_avatar_inventory.obtained_at`, and `shop_purchases.created_at` — adjust to match your schema if different.

- [ ] **Step 2: Write failing tests**

`tests/unit/lib/db/recent-obtained.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => {
  const collQuery = { rows: [] as any[] };
  const avatarQuery = { rows: [] as any[] };
  const purchaseQuery = { rows: [] as any[] };
  const mockDb: any = {
    select: vi.fn(),
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  // chainable; resolves to the query-specific rows based on a stub registry
  let nextRows: any[] = [];
  mockDb.select.mockImplementation(() => mockDb);
  mockDb.from.mockImplementation(() => mockDb);
  mockDb.innerJoin.mockImplementation(() => mockDb);
  mockDb.where.mockImplementation(() => mockDb);
  mockDb.orderBy.mockImplementation(() => mockDb);
  mockDb.limit.mockImplementation(async () => {
    const r = nextRows;
    nextRows = [];
    return r;
  });
  return {
    db: mockDb,
    __setNext: (rows: any[]) => {
      nextRows = rows;
    },
  };
});

import { db } from '@/db';
import { getRecentlyObtainedForChild } from '@/lib/db/recent-obtained';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const __setNext = (require('@/db') as any).__setNext;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRecentlyObtainedForChild', () => {
  it('returns empty array when no items in any source', async () => {
    __setNext([]);
    __setNext([]);
    __setNext([]);
    const result = await getRecentlyObtainedForChild('c1', 3);
    expect(result).toEqual([]);
  });

  it('merges across sources, sorts by obtainedAt DESC, caps at limit', async () => {
    // For brevity, this test stubs each source to return one row.
    // It asserts the merge produces 3 items in correct order.
    __setNext([
      { obtainedAt: new Date('2026-05-10'), packSlug: 'zodiac', emoji: '🐉', nameZh: '龙', nameEn: 'Dragon' },
    ]);
    __setNext([
      { obtainedAt: new Date('2026-05-12'), slot: 'hat', name: 'Tricorn' },
    ]);
    __setNext([
      { obtainedAt: new Date('2026-05-11'), kind: 'pet', emoji: '🦜', name: 'Parrot / 鹦鹉' },
    ]);
    const result = await getRecentlyObtainedForChild('c1', 3);
    expect(result).toHaveLength(3);
    expect(result[0].obtainedAt).toEqual(new Date('2026-05-12')); // avatar
    expect(result[1].obtainedAt).toEqual(new Date('2026-05-11')); // pet
    expect(result[2].obtainedAt).toEqual(new Date('2026-05-10')); // collection
  });
});
```

(Note: the test scaffolding is intentionally simple — the implementer may need to refine the `vi.mock('@/db')` strategy to match how other DB tests in this codebase mock multi-query chains. Look at `tests/unit/lib/db/recent-obtained.test.ts` neighbour files like `tests/unit/lib/db/shop-db.test.ts` for the established pattern. If the simpler pattern works there, keep it here.)

- [ ] **Step 3: Run failing test**

Run: `pnpm test recent-obtained -- --run`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/lib/db/recent-obtained.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  childCollections,
  packItems,
  curriculumPacks,
  childAvatarInventory,
  avatarItems,
  shopPurchases,
  shopItems,
} from '@/db/schema';

export type RecentItemKind = 'collection' | 'avatar' | 'pet' | 'decor';

export interface RecentItem {
  kind: RecentItemKind;
  obtainedAt: Date;
  displayEmoji: string;
  nameZh: string;
  nameEn: string;
  href: string;
}

export async function getRecentlyObtainedForChild(
  childId: string,
  limit = 3,
): Promise<RecentItem[]> {
  const overFetch = limit * 3;

  const [collRows, avatarRows, purchaseRows] = await Promise.all([
    db
      .select({
        obtainedAt: childCollections.obtainedAt,
        packSlug: curriculumPacks.slug,
        emoji: packItems.emoji,
        nameZh: packItems.nameZh,
        nameEn: packItems.nameEn,
      })
      .from(childCollections)
      .innerJoin(packItems, eq(childCollections.packItemId, packItems.id))
      .innerJoin(curriculumPacks, eq(packItems.packId, curriculumPacks.id))
      .where(eq(childCollections.childId, childId))
      .orderBy(desc(childCollections.obtainedAt))
      .limit(overFetch),

    db
      .select({
        obtainedAt: childAvatarInventory.obtainedAt,
        slotId: avatarItems.slotId,
        name: avatarItems.name,
      })
      .from(childAvatarInventory)
      .innerJoin(avatarItems, eq(childAvatarInventory.avatarItemId, avatarItems.id))
      .where(eq(childAvatarInventory.childId, childId))
      .orderBy(desc(childAvatarInventory.obtainedAt))
      .limit(overFetch),

    db
      .select({
        obtainedAt: shopPurchases.createdAt,
        kind: shopItems.kind,
        name: shopItems.name,
        imageUrl: shopItems.imageUrl,
      })
      .from(shopPurchases)
      .innerJoin(shopItems, eq(shopPurchases.shopItemId, shopItems.id))
      .where(eq(shopPurchases.childId, childId))
      .orderBy(desc(shopPurchases.createdAt))
      .limit(overFetch),
  ]);

  const merged: RecentItem[] = [
    ...collRows.map((r) => ({
      kind: 'collection' as const,
      obtainedAt: r.obtainedAt,
      displayEmoji: r.emoji ?? '🎁',
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      href: `/play/REPLACED/collection/${r.packSlug}`,
    })),
    ...avatarRows.map((r) => ({
      kind: 'avatar' as const,
      obtainedAt: r.obtainedAt,
      displayEmoji: slotEmoji(r.slotId),
      nameZh: r.name,
      nameEn: r.name,
      href: `/play/REPLACED/shop?tab=avatar`,
    })),
    ...purchaseRows
      .filter((r) => r.kind === 'pet' || r.kind === 'decor')
      .map((r) => ({
        kind: (r.kind === 'pet' ? 'pet' : 'decor') as RecentItemKind,
        obtainedAt: r.obtainedAt,
        displayEmoji: r.imageUrl ?? '🎁',
        nameZh: r.name,
        nameEn: r.name,
        href: r.kind === 'pet'
          ? `/play/REPLACED/shop?tab=pet`
          : `/play/REPLACED/shop?tab=decor`,
      })),
  ];

  merged.sort((a, b) => b.obtainedAt.getTime() - a.obtainedAt.getTime());

  return merged.slice(0, limit);
}

function slotEmoji(slotId: string): string {
  switch (slotId) {
    case 'hat': return '🎩';
    case 'top': return '👕';
    case 'head': return '🧒';
    case 'background': return '🖼️';
    default: return '✨';
  }
}
```

Note the `REPLACED` placeholder — the function is called from the AtlasHub page which knows `childId`. We'll do the substitution at the caller in Task 16. Alternatively, accept `childId` and substitute here. **Replace `REPLACED` with `${childId}` and pass childId through.** This second approach is cleaner — adjust the function and tests accordingly.

- [ ] **Step 5: Run tests**

Run: `pnpm test recent-obtained -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/recent-obtained.ts tests/unit/lib/db/recent-obtained.test.ts
git commit -m "feat(pr38): getRecentlyObtainedForChild merges 3 sources"
```

---

## Task 16: RecentlyObtainedStrip + AtlasHub rename

**Files:**
- Create: `src/components/play/RecentlyObtainedStrip.tsx`
- Modify: `src/components/play/AtlasHub.tsx`
- Modify: `src/app/play/[childId]/collection/page.tsx`
- Create: `tests/unit/components/play/RecentlyObtainedStrip.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/components/play/RecentlyObtainedStrip.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentlyObtainedStrip } from '@/components/play/RecentlyObtainedStrip';
import type { RecentItem } from '@/lib/db/recent-obtained';

describe('RecentlyObtainedStrip', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<RecentlyObtainedStrip items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders items + NEW sticker for <24h', () => {
    const items: RecentItem[] = [
      {
        kind: 'collection',
        obtainedAt: new Date(),
        displayEmoji: '🐉',
        nameZh: '龙',
        nameEn: 'Dragon',
        href: '/play/c1/collection/zodiac',
      },
      {
        kind: 'pet',
        obtainedAt: new Date(Date.now() - 48 * 3600 * 1000),
        displayEmoji: '🦜',
        nameZh: '鹦鹉',
        nameEn: 'Parrot',
        href: '/play/c1/shop?tab=pet',
      },
    ];
    render(<RecentlyObtainedStrip items={items} />);
    expect(screen.getByText('龙')).toBeInTheDocument();
    expect(screen.getByText('Parrot')).toBeInTheDocument();
    expect(screen.getByText(/新|NEW/i)).toBeInTheDocument();
    expect(screen.getAllByText(/新|NEW/i)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm test RecentlyObtainedStrip -- --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/play/RecentlyObtainedStrip.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { RecentItem } from '@/lib/db/recent-obtained';

interface Props {
  items: RecentItem[];
}

const ONE_DAY_MS = 24 * 3600 * 1000;

export function RecentlyObtainedStrip({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[var(--color-sand-200)] bg-white/80 p-3 shadow-sm">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        最近获得 · Recently Obtained
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const isNew = Date.now() - item.obtainedAt.getTime() < ONE_DAY_MS;
          return (
            <Link
              key={`${item.kind}-${item.obtainedAt.toISOString()}`}
              href={item.href}
              className="relative flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border border-[var(--color-sand-200)] bg-white px-2 py-2 shadow-sm transition-transform active:scale-95"
            >
              {isNew && (
                <span className="absolute -right-1 -top-1 rounded-full bg-[var(--color-sunset-500)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                  新 NEW
                </span>
              )}
              <span className="text-2xl leading-none">{item.displayEmoji}</span>
              <span className="text-center text-[10px] leading-tight text-[var(--color-ocean-900)]">
                {item.nameZh}
              </span>
              <span className="text-center text-[10px] leading-tight text-[var(--color-sand-700)]">
                {item.nameEn}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Modify AtlasHub**

In `src/components/play/AtlasHub.tsx`:
- Change the rendered H1 from "Collector's Atlas / 探险家图鉴" to "背包 / Backpack".
- Add a new prop `recentItems: RecentItem[]` to the component.
- Insert `<RecentlyObtainedStrip items={recentItems} />` above the pack cards grid.

Concrete diff (show the snippet of the new shape):

```tsx
import type { RecentItem } from '@/lib/db/recent-obtained';
import { RecentlyObtainedStrip } from './RecentlyObtainedStrip';

interface AtlasHubProps {
  // …existing props…
  recentItems: RecentItem[];
}

export function AtlasHub({ /* …existing… */ recentItems }: AtlasHubProps) {
  return (
    <main className="…">
      <header className="…">
        <h1 className="font-hanzi …">背包 · Backpack</h1>
        {/* …existing subtitle / coin pill… */}
      </header>
      <RecentlyObtainedStrip items={recentItems} />
      {/* …existing pack grid… */}
    </main>
  );
}
```

- [ ] **Step 5: Wire fetch into collection page**

`src/app/play/[childId]/collection/page.tsx`:

```tsx
import { getRecentlyObtainedForChild } from '@/lib/db/recent-obtained';
// …existing imports

export default async function CollectionPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const [activePacks, /* …existing fetches… */ recentItems] = await Promise.all([
    listActivePacks(),
    // …existing fetches…
    getRecentlyObtainedForChild(child.id, 3),
  ]);

  return (
    <AtlasHub
      // …existing props…
      recentItems={recentItems}
    />
  );
}
```

(Adjust the actual Promise.all to include all current fetches, plus `getRecentlyObtainedForChild`.)

- [ ] **Step 6: Run tests**

Run: `pnpm test RecentlyObtainedStrip -- --run`
Expected: PASS (2/2).

Then full suite:
Run: `pnpm test -- --run`
Expected: All green.

- [ ] **Step 7: Manual smoke**

`pnpm dev`:
- Tap Backpack tab → page shows H1 "背包 · Backpack".
- If Yinuo has recent acquisitions, the strip shows up; otherwise it's hidden.
- Pull a zodiac item → strip shows it with "新 NEW" sticker.

- [ ] **Step 8: Commit**

```bash
git add src/components/play/RecentlyObtainedStrip.tsx \
        src/components/play/AtlasHub.tsx \
        src/app/play/[childId]/collection/page.tsx \
        tests/unit/components/play/RecentlyObtainedStrip.test.tsx
git commit -m "feat(pr38): rename Atlas to Backpack + RecentlyObtainedStrip"
```

---

## Final verification (before opening the PR)

- [ ] **Step 1: Four-green gate**

```bash
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

Expected: 0 errors across all four.

- [ ] **Step 2: Manual matrix (`pnpm dev`)**

Per spec §10:
1. Root auto-redirects single-child to `/play/[childId]`.
2. Bottom nav visible; each of 4 tabs lands correctly; active dot moves.
3. Gear cold → `/parent/unlock` PIN screen; set PIN; persists across reload.
4. Sign out + back in → root redirects again; gear → PIN screen; correct PIN → `/parent` works.
5. Tap island → smooth morph into hub (Chrome/Safari); skeleton during fetch; back morphs back.
6. WeekStrip on home → tap → `/calendar` → month grid; prev/next nav works.
7. Zodiac pull → Backpack shows new item with "新 NEW" sticker.
8. Mid-scene, tap Map tab → confirm dialog; "Stay" stays, "Quit" navigates.
9. DevTools → reduced-motion → view-transition fades only (no scale-morph).
10. iPad portrait Mobile Safari — nav doesn't overlap home-indicator.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/pr38-kid-first-surface-refresh
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat: PR #38 — kid-first surface refresh (bottom nav, PIN gate, view transitions, calendar, backpack)" --body "$(cat <<'EOF'
## Summary
- Auto-redirect signed-in single-child accounts from `/` to `/play/[childId]`.
- Bottom 4-tab nav (Map / 背包 / 日历 / 商店) + parent gear behind 4-digit PIN.
- View Transitions API morph from island → hub hero; Suspense skeleton during fetch.
- 7-day check-in strip on home + full month-grid calendar at `/play/[childId]/calendar`.
- Atlas renamed to 背包/Backpack + "Recently Obtained" strip above pack grid.

Spec: `docs/superpowers/specs/2026-05-25-pr38-kid-first-surface-refresh-design.md`
Plan: `docs/superpowers/plans/2026-05-25-pr38-kid-first-surface-refresh.md`

## Test plan
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
- [ ] root redirect: signed-in single-child → /play/[childId]
- [ ] PIN gate: first-set, verify, 5-attempt lockout, reset path
- [ ] bottom nav active states + mid-scene quit-confirm
- [ ] View Transition morph on Chrome iOS Safari (manual)
- [ ] WeekStrip + month calendar render with real activity
- [ ] Backpack rename + Recently Obtained strip with NEW sticker

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL returned. CI kicks off.

- [ ] **Step 5: Update CLAUDE.md (after merge)**

In the same merge commit or a follow-up: append PR #38 entry to CLAUDE.md "Current state" + add new landmines:
- "Root redirects single-child accounts to `/play/[childId]` automatically — to add a multi-child UI, replace the `if (children.length === 1) redirect()` branch in `src/app/page.tsx`."
- "`/parent` is gated by a 4-digit PIN with bcrypt + 5-attempt cooldown. Reset path is `/parent/unlock?reset=1`. Cookie `parent_unlocked` is HttpOnly + SameSite=Strict + 15-min sliding TTL."
- "KidNavBar mid-scene flag uses `MidSceneProvider` context. Any new scene-running route MUST mount `<MidSceneFlag />` or tab clicks will navigate without the quit-confirm dialog."
- "View Transitions API requires matching `viewTransitionName` strings on both pages. When adding a new island-to-hub-like morph, set the style on BOTH the source link and the destination hero."
- "`getActivityForRange` uses `coin_transactions` for both played-state and bonus detection. Adding a new coin reason (PR #28 pattern) automatically participates in WeekStrip + MonthCalendar."

---

## Plan self-review

**1. Spec coverage** — walked each spec section §3-§10:
- §3 routing & redirect → Tasks 6 (parent layout), 7 (root). ✓
- §4 KidNavBar → Tasks 8 (provider), 9 (component), 10 (mount). ✓
- §5 view transitions → Task 11. ✓
- §6 calendar → Tasks 12 (activity query), 13 (WeekStrip), 14 (MonthCalendar + page). ✓
- §7 backpack rename + recent obtained → Tasks 15, 16. ✓
- §8 schema → Tasks 1 (bcryptjs), 2 (parent_settings), 3 (parent-pin lib), 4 (parent-settings DB), 5 (unlock page + route). ✓
- §10 testing matrix → covered across tasks; spec list lines up with the test files I named. ✓

**2. Placeholder scan** — no TBD / TODO / "implement later". The `REPLACED` placeholder in Task 15 is called out with explicit instructions to substitute `${childId}` and pass it through — not a placeholder, an instruction.

**3. Type consistency** — `RecentItem` shape used in Task 15 and consumed in Task 16 matches. `ActivityDay` shape in Task 12 used in Tasks 13, 14 matches. `MidSceneFlag` exported in Task 8 and consumed in Tasks 9, 10. `getParentSettings` shape returned in Task 4 consumed in Tasks 5, 6.

**4. Known soft spots** — flagging for the implementer:
- Task 15 has a vague `vi.mock('@/db')` example. The implementer should look at a neighbouring DB test file (e.g. `tests/unit/lib/db/shop-db.test.ts`) for the established mock pattern in this codebase and conform.
- Task 11 — the hub's hero JSX shape is unknown; the implementer needs to read `src/app/play/[childId]/week/[weekId]/page.tsx` and decide where to attach `viewTransitionName`.
- Task 16 — `AtlasHub` is an existing component file; the implementer needs to read it first to find the H1 and pack-grid wrapper so the diff is minimal.

Total tasks: 16 implementation + final verify. Each ends with green test + commit. Net commit count: ~16 + 1 PR. Estimated time per task: 10-25 min.
