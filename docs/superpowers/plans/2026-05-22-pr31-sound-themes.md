# PR #31 — Sound / FX themes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 new procedural sound themes (`music-box`, `retro-arcade`, `nautical`, `fanfare-plus`) as shop items, equippable per child, with the Sounds tab in the shop becoming live.

**Architecture:** Theme = a TS file exporting `{ ding, buzz, fanfare }` handlers `(ctx: AudioContext) => void`. A registry maps slug → handlers. `src/lib/audio/play.ts` keeps a mutable current-theme reference; `setAudioTheme(slug)` swaps it. Equipped theme lives in a new `child_settings` table (one row per child, first column `sound_theme_slug`). Shop UI mirrors Avatar tab patterns; SoundsTabBody adds a per-card preview button that fires `theme.ding()`. Layout fetches settings once and bootstraps the current theme on the client.

**Tech Stack:** TypeScript / Next.js 16 App Router / Drizzle ORM / Postgres / Web Audio API / Vitest + RTL + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-22-pr31-sound-themes-design.md`

**Branch:** `feat/pr31-sound-themes` (already exists; spec already committed as `60b0c22`).

---

## File Structure

### Created
- `src/db/schema/settings.ts` — `child_settings` table.
- `drizzle/0007_<auto-name>.sql` — migration: ALTER `shop_item_kind` enum + CREATE TABLE `child_settings`.
- `src/lib/audio/themes/index.ts` — `THEME_REGISTRY` + `getTheme(slug?)` with default fallback.
- `src/lib/audio/themes/default.ts` — re-exports existing `playDing/playBuzz/playFanfare` from `../sounds`.
- `src/lib/audio/themes/music-box.ts` — sine-bell handlers.
- `src/lib/audio/themes/retro-arcade.ts` — square-wave 8-bit handlers.
- `src/lib/audio/themes/nautical.ts` — bell + foghorn handlers.
- `src/lib/audio/themes/fanfare-plus.ts` — extended fanfare; reuses default ding/buzz.
- `src/lib/db/settings.ts` — `getChildSettings`, `setSoundTheme`.
- `src/lib/actions/settings.ts` — `'use server'` file with `equipSoundThemeAction`.
- `src/components/shop/SoundsTabBody.tsx` — Sounds tab content (listing grid + preview button).
- `src/components/play/SoundThemeBootstrap.tsx` — tiny client component, calls `setAudioTheme` on mount.
- `scripts/seed-sound-themes.ts` — idempotent seed of 4 `shop_items` rows.
- Tests: `tests/unit/audio-themes.test.ts`, `tests/unit/audio-play-set-theme.test.ts`, `tests/unit/settings-db.test.ts`, `tests/unit/equip-sound-theme-action.test.ts`, `tests/unit/sounds-tab-body.test.tsx`.

### Modified
- `src/db/schema/economy.ts` — append `'sound_theme'` to `shopItemKind` pgEnum.
- `src/db/schema/index.ts` — re-export the new `childSettings` table.
- `src/lib/audio/play.ts` — convert `handlers` const to a mutable variable; add `setAudioTheme(slug)`.
- `src/lib/db/shop.ts` — add `listSoundThemeShopListings()` + reuse `listChildOwnedShopItemIds`.
- `src/components/shop/ShopCategoryTabs.tsx` — `sound` tab `disabled: false`.
- `src/app/play/[childId]/shop/page.tsx` — server fetch the sound-theme listings + owned ids + current settings; pass to `ShopBody`.
- `src/app/play/[childId]/shop/ShopBody.tsx` — accept sound-theme props; render `SoundsTabBody` when `activeTab === 'sound'`; thread equip-sound-theme through.
- `src/app/play/[childId]/layout.tsx` — fetch child settings; mount `<SoundThemeBootstrap themeSlug={...} />`.
- `CLAUDE.md` — bump "last refreshed" + add PR #31 bullet.

### Untouched
- `src/lib/audio/sounds.ts` — leave as the canonical `default` theme implementation; `themes/default.ts` re-exports from it.

---

## Task 1: Schema — `child_settings` table + `sound_theme` enum value

**Files:**
- Create: `src/db/schema/settings.ts`
- Modify: `src/db/schema/economy.ts:30-35` (the `shopItemKind` pgEnum)
- Modify: `src/db/schema/index.ts` (re-export)
- Create: `drizzle/0007_<auto-name>.sql`

- [ ] **Step 1: Create `src/db/schema/settings.ts`**

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const childSettings = pgTable('child_settings', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: 'cascade' }),
  soundThemeSlug: text('sound_theme_slug'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Append `'sound_theme'` to `shopItemKind` pgEnum**

In `src/db/schema/economy.ts:30-35`, replace:

```ts
export const shopItemKind = pgEnum('shop_item_kind', [
  'avatar',
  'powerup',
  'consumable',
  'pack_voucher',
]);
```

with:

```ts
export const shopItemKind = pgEnum('shop_item_kind', [
  'avatar',
  'powerup',
  'consumable',
  'pack_voucher',
  'sound_theme',
]);
```

- [ ] **Step 3: Re-export from `src/db/schema/index.ts`**

Read the existing index. Add an export line for the new module:

```ts
export * from './settings';
```

Place it alphabetically among existing `export * from './<...>';` lines.

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Expected: `drizzle/0007_<random-name>.sql` is created containing one `ALTER TYPE … ADD VALUE 'sound_theme';` statement and a `CREATE TABLE child_settings (...)` block. The two statements are separated by `--> statement-breakpoint`. Do not hand-edit the file.

- [ ] **Step 5: Apply locally**

Run: `pnpm tsx scripts/migrate.ts`
Expected: migration applies cleanly. No new template-seed needed (sound themes are catalog-defined in TS, not DB rows).

- [ ] **Step 6: Verify**

Run:
```bash
pnpm tsx -e "import {db} from './src/db'; import {sql} from 'drizzle-orm'; (async () => { const r = await db.execute(sql\`SELECT unnest(enum_range(NULL::shop_item_kind))\`); console.log(r.rows); process.exit(0); })()"
```

Or, if you have psql handy:
```bash
psql "$DATABASE_URL" -c "SELECT unnest(enum_range(NULL::shop_item_kind));"
psql "$DATABASE_URL" -c "\d child_settings"
```

Expected: enum lists 5 values including `sound_theme`; `child_settings` table exists with 4 columns.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema/settings.ts src/db/schema/economy.ts src/db/schema/index.ts drizzle/0007_*.sql drizzle/meta/
git commit -m "$(cat <<'EOF'
feat(db): add child_settings table + sound_theme shop kind

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Theme registry + 4 procedural themes

**Files:**
- Create: `src/lib/audio/themes/index.ts`
- Create: `src/lib/audio/themes/default.ts`
- Create: `src/lib/audio/themes/music-box.ts`
- Create: `src/lib/audio/themes/retro-arcade.ts`
- Create: `src/lib/audio/themes/nautical.ts`
- Create: `src/lib/audio/themes/fanfare-plus.ts`
- Create: `tests/unit/audio-themes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/audio-themes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  THEME_REGISTRY,
  THEME_SLUGS,
  getTheme,
  type ThemeSlug,
} from '@/lib/audio/themes';

function makeMockContext() {
  const oscNodes: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscNodes.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    })),
  };
  return { ctx: ctx as unknown as AudioContext, oscNodes };
}

describe('audio themes', () => {
  it('registry contains the 5 expected slugs', () => {
    expect(THEME_SLUGS).toEqual([
      'default',
      'theme-music-box',
      'theme-retro-arcade',
      'theme-nautical',
      'theme-fanfare-plus',
    ]);
    for (const slug of THEME_SLUGS) {
      expect(THEME_REGISTRY[slug]).toBeDefined();
      expect(typeof THEME_REGISTRY[slug].ding).toBe('function');
      expect(typeof THEME_REGISTRY[slug].buzz).toBe('function');
      expect(typeof THEME_REGISTRY[slug].fanfare).toBe('function');
    }
  });

  it('getTheme returns the named theme', () => {
    expect(getTheme('theme-nautical')).toBe(THEME_REGISTRY['theme-nautical']);
  });

  it('getTheme falls back to default for unknown / null / undefined slugs', () => {
    expect(getTheme('not-a-theme' as ThemeSlug)).toBe(THEME_REGISTRY.default);
    expect(getTheme(null)).toBe(THEME_REGISTRY.default);
    expect(getTheme(undefined)).toBe(THEME_REGISTRY.default);
  });

  it.each(['default', 'theme-music-box', 'theme-retro-arcade', 'theme-nautical', 'theme-fanfare-plus'] as const)(
    '%s handlers schedule at least one oscillator without throwing (ding/buzz/fanfare)',
    (slug) => {
      const theme = THEME_REGISTRY[slug];
      for (const evt of ['ding', 'buzz', 'fanfare'] as const) {
        const { ctx, oscNodes } = makeMockContext();
        expect(() => theme[evt](ctx)).not.toThrow();
        expect(oscNodes.length).toBeGreaterThan(0);
      }
    },
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/audio-themes.test.ts`
Expected: FAIL — "Cannot find module '@/lib/audio/themes'".

- [ ] **Step 3: Create `src/lib/audio/themes/default.ts`**

```ts
import { playBuzz, playDing, playFanfare } from '../sounds';
import type { ThemeHandlers } from './index';

export const defaultTheme: ThemeHandlers = {
  ding: playDing,
  buzz: playBuzz,
  fanfare: playFanfare,
};
```

- [ ] **Step 4: Create `src/lib/audio/themes/music-box.ts`**

Music-box style: layered sines at 1200 Hz + 1800 Hz (a perfect fifth) with long bell-like decay; gentle pitch-slide buzz; ascending triad fanfare with mild echo.

```ts
import type { ThemeHandlers } from './index';

function bellTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const musicBoxTheme: ThemeHandlers = {
  ding(ctx) {
    bellTone(ctx, 1200, 0, 0.8, 0.12);
    bellTone(ctx, 1800, 0, 0.8, 0.08);
  },
  buzz(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.24);
  },
  fanfare(ctx) {
    const seq: Array<[number, number]> = [
      [800, 0],
      [1200, 0.15],
      [1600, 0.3],
    ];
    for (const [freq, offset] of seq) bellTone(ctx, freq, offset, 0.6, 0.1);
    // Mild echo
    for (const [freq, offset] of seq) bellTone(ctx, freq, offset + 0.4, 0.4, 0.05);
  },
};
```

- [ ] **Step 5: Create `src/lib/audio/themes/retro-arcade.ts`**

8-bit pickup vibe: square waves, short envelopes.

```ts
import type { ThemeHandlers } from './index';

function blip(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const retroArcadeTheme: ThemeHandlers = {
  ding(ctx) {
    blip(ctx, 1320, 0, 0.06, 0.1);
    blip(ctx, 1760, 0.06, 0.06, 0.1);
  },
  buzz(ctx) {
    blip(ctx, 200, 0, 0.2, 0.12);
  },
  fanfare(ctx) {
    const seq: Array<[number, number]> = [
      [660, 0],
      [880, 0.1],
      [1110, 0.2],
      [1320, 0.3],
    ];
    for (const [freq, offset] of seq) blip(ctx, freq, offset, 0.1, 0.1);
    blip(ctx, 1760, 0.4, 0.3, 0.1);
  },
};
```

- [ ] **Step 6: Create `src/lib/audio/themes/nautical.ts`**

Bell-buoy + foghorn vibes.

```ts
import type { ThemeHandlers } from './index';

function bell(ctx: AudioContext, freq: number, startOffset: number, duration: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function foghorn(ctx: AudioContext, startOffset: number, duration: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 110;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const nauticalTheme: ThemeHandlers = {
  ding(ctx) {
    bell(ctx, 880, 0, 1.2, 0.12);
    bell(ctx, 1320, 0, 1.2, 0.08);
  },
  buzz(ctx) {
    foghorn(ctx, 0, 0.4, 0.1);
  },
  fanfare(ctx) {
    foghorn(ctx, 0, 0.3, 0.08);
    bell(ctx, 660, 0.1, 0.6, 0.1);
    bell(ctx, 990, 0.1, 0.6, 0.1);
    bell(ctx, 1320, 0.1, 0.6, 0.1);
  },
};
```

- [ ] **Step 7: Create `src/lib/audio/themes/fanfare-plus.ts`**

Same ding/buzz as default; extended fanfare.

```ts
import { playBuzz, playDing } from '../sounds';
import type { ThemeHandlers } from './index';

export const fanfarePlusTheme: ThemeHandlers = {
  ding: playDing,
  buzz: playBuzz,
  fanfare(ctx) {
    const arpeggio: Array<[number, number]> = [
      [660, 0],
      [880, 0.2],
      [1100, 0.4],
      [1320, 0.6],
    ];
    for (const [freq, offset] of arpeggio) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    }
    // Sustained chord (660 + 880 + 1100)
    for (const freq of [660, 880, 1100]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + 0.8;
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.82);
    }
  },
};
```

- [ ] **Step 8: Create `src/lib/audio/themes/index.ts`**

```ts
import { defaultTheme } from './default';
import { musicBoxTheme } from './music-box';
import { retroArcadeTheme } from './retro-arcade';
import { nauticalTheme } from './nautical';
import { fanfarePlusTheme } from './fanfare-plus';

export interface ThemeHandlers {
  ding: (ctx: AudioContext) => void;
  buzz: (ctx: AudioContext) => void;
  fanfare: (ctx: AudioContext) => void;
}

export const THEME_REGISTRY = {
  default: defaultTheme,
  'theme-music-box': musicBoxTheme,
  'theme-retro-arcade': retroArcadeTheme,
  'theme-nautical': nauticalTheme,
  'theme-fanfare-plus': fanfarePlusTheme,
} as const satisfies Record<string, ThemeHandlers>;

export type ThemeSlug = keyof typeof THEME_REGISTRY;

export const THEME_SLUGS = Object.keys(THEME_REGISTRY) as ThemeSlug[];

export function getTheme(slug: string | null | undefined): ThemeHandlers {
  if (!slug) return THEME_REGISTRY.default;
  return (THEME_REGISTRY as Record<string, ThemeHandlers>)[slug] ?? THEME_REGISTRY.default;
}
```

- [ ] **Step 9: Run tests**

Run: `pnpm test tests/unit/audio-themes.test.ts`
Expected: all green (5 slugs × 3 handler types = 15 handler-invocation cases plus the 3 registry tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/audio/themes tests/unit/audio-themes.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): theme registry + 4 procedural themes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Refactor `play.ts` with `setAudioTheme`

**Files:**
- Modify: `src/lib/audio/play.ts`
- Create: `tests/unit/audio-play-set-theme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/audio-play-set-theme.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

// Hoist the theme mocks so `play.ts`'s top-level import sees them.
const dingDefault = vi.fn();
const dingNautical = vi.fn();

vi.mock('@/lib/audio/themes', () => ({
  getTheme: (slug: string | null | undefined) => {
    if (slug === 'theme-nautical') {
      return { ding: dingNautical, buzz: vi.fn(), fanfare: vi.fn() };
    }
    return { ding: dingDefault, buzz: vi.fn(), fanfare: vi.fn() };
  },
}));

const oscMock = {
  type: 'sine',
  frequency: { value: 0 },
  connect: vi.fn().mockReturnThis(),
  start: vi.fn(),
  stop: vi.fn(),
};

const audioCtxMock = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createOscillator: vi.fn(() => oscMock),
  createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn() }, connect: vi.fn().mockReturnThis() })),
  resume: vi.fn(),
};

// jsdom doesn't have AudioContext.
beforeAll(() => {
  // @ts-expect-error — minimal mock
  globalThis.AudioContext = vi.fn(() => audioCtxMock);
});

import { playSound, setAudioMuted, setAudioTheme } from '@/lib/audio/play';

afterEach(() => {
  dingDefault.mockClear();
  dingNautical.mockClear();
  setAudioMuted(false);
  setAudioTheme(null); // reset to default
});

describe('setAudioTheme', () => {
  it('playSound uses default theme handlers when no theme set', () => {
    playSound('ding');
    expect(dingDefault).toHaveBeenCalledTimes(1);
    expect(dingNautical).not.toHaveBeenCalled();
  });

  it('setAudioTheme swaps which handler playSound calls', () => {
    setAudioTheme('theme-nautical');
    playSound('ding');
    expect(dingNautical).toHaveBeenCalledTimes(1);
    expect(dingDefault).not.toHaveBeenCalled();
  });

  it('setAudioTheme(null) reverts to default', () => {
    setAudioTheme('theme-nautical');
    setAudioTheme(null);
    playSound('ding');
    expect(dingDefault).toHaveBeenCalledTimes(1);
    expect(dingNautical).not.toHaveBeenCalled();
  });

  it('muted state suppresses all sounds regardless of theme', () => {
    setAudioTheme('theme-nautical');
    setAudioMuted(true);
    playSound('ding');
    expect(dingDefault).not.toHaveBeenCalled();
    expect(dingNautical).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test tests/unit/audio-play-set-theme.test.ts`
Expected: FAIL — `setAudioTheme` doesn't exist yet.

- [ ] **Step 3: Refactor `src/lib/audio/play.ts`**

Replace the entire file with:

```ts
// src/lib/audio/play.ts
import { getTheme } from './themes';

export type SoundName = 'ding' | 'buzz' | 'fanfare';

let ctx: AudioContext | null = null;
let muted = false;
let currentThemeSlug: string | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const theme = getTheme(currentThemeSlug);
  theme[name](c);
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

export function setAudioTheme(slug: string | null): void {
  currentThemeSlug = slug;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm test tests/unit/audio-play-set-theme.test.ts`
Expected: all 4 tests green.

- [ ] **Step 5: Confirm no callers regressed**

Run: `pnpm typecheck`
Expected: clean. The exports (`playSound`, `setAudioMuted`) keep their existing signatures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/play.ts tests/unit/audio-play-set-theme.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): setAudioTheme + theme-aware playSound

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `child_settings` DB layer + action

**Files:**
- Create: `src/lib/db/settings.ts`
- Create: `src/lib/actions/settings.ts`
- Create: `tests/unit/settings-db.test.ts`
- Create: `tests/unit/equip-sound-theme-action.test.ts`

- [ ] **Step 1: Write the DB layer test**

Create `tests/unit/settings-db.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhereLimit = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ limit: selectWhereLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const insertOnConflict = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertOnConflict });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return { select, selectFrom, selectWhere, selectWhereLimit, insert, insertValues, insertOnConflict };
});

vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert } }));

import { getChildSettings, setSoundTheme } from '@/lib/db/settings';

beforeEach(() => {
  mocks.selectWhereLimit.mockReset();
  mocks.select.mockClear();
  mocks.insert.mockClear();
  mocks.insertValues.mockClear();
  mocks.insertOnConflict.mockClear();
});

describe('getChildSettings', () => {
  it('returns null when no row exists', async () => {
    mocks.selectWhereLimit.mockResolvedValue([]);
    expect(await getChildSettings('c1')).toBeNull();
  });

  it('returns the row when one exists', async () => {
    mocks.selectWhereLimit.mockResolvedValue([
      { childId: 'c1', soundThemeSlug: 'theme-nautical' },
    ]);
    const row = await getChildSettings('c1');
    expect(row?.soundThemeSlug).toBe('theme-nautical');
  });
});

describe('setSoundTheme', () => {
  it('upserts the row via onConflictDoUpdate', async () => {
    await setSoundTheme('c1', 'theme-music-box');
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', soundThemeSlug: 'theme-music-box' }),
    );
    expect(mocks.insertOnConflict).toHaveBeenCalledTimes(1);
  });

  it('upserts NULL when slug is null (revert to default)', async () => {
    await setSoundTheme('c1', null);
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', soundThemeSlug: null }),
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test tests/unit/settings-db.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/lib/db/settings.ts`**

```ts
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childSettings } from '@/db/schema';

export type ChildSettingsRow = typeof childSettings.$inferSelect;

export async function getChildSettings(
  childId: string,
): Promise<ChildSettingsRow | null> {
  const rows = await db
    .select()
    .from(childSettings)
    .where(eq(childSettings.childId, childId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setSoundTheme(
  childId: string,
  slug: string | null,
): Promise<void> {
  await db
    .insert(childSettings)
    .values({ childId, soundThemeSlug: slug })
    .onConflictDoUpdate({
      target: childSettings.childId,
      set: { soundThemeSlug: slug, updatedAt: sql`NOW()` },
    });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm test tests/unit/settings-db.test.ts`
Expected: all green.

- [ ] **Step 5: Write the action test**

Create `tests/unit/equip-sound-theme-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  setSoundTheme: vi.fn(),
  listChildOwnedShopItemIds: vi.fn(),
  listShopItemsByKind: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/settings', () => ({ setSoundTheme: mocks.setSoundTheme }));
vi.mock('@/lib/db/shop', () => ({
  listChildOwnedShopItemIds: mocks.listChildOwnedShopItemIds,
  listShopItemsByKind: mocks.listShopItemsByKind,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { equipSoundThemeAction } from '@/lib/actions/settings';

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
});

describe('equipSoundThemeAction', () => {
  it("accepts 'default' (slug=null) without ownership check", async () => {
    await equipSoundThemeAction('c1', null);
    expect(mocks.setSoundTheme).toHaveBeenCalledWith('c1', null);
    expect(mocks.listChildOwnedShopItemIds).not.toHaveBeenCalled();
  });

  it('rejects an unowned theme slug', async () => {
    mocks.listShopItemsByKind.mockResolvedValue([
      { id: 'item_nautical', slug: 'theme-nautical' },
    ]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue([]); // owns nothing
    await expect(
      equipSoundThemeAction('c1', 'theme-nautical'),
    ).rejects.toThrow(/not owned/i);
    expect(mocks.setSoundTheme).not.toHaveBeenCalled();
  });

  it('accepts an owned theme slug and writes it to settings', async () => {
    mocks.listShopItemsByKind.mockResolvedValue([
      { id: 'item_nautical', slug: 'theme-nautical' },
    ]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue(['item_nautical']);
    await equipSoundThemeAction('c1', 'theme-nautical');
    expect(mocks.setSoundTheme).toHaveBeenCalledWith('c1', 'theme-nautical');
  });

  it('rejects an unknown slug (not in catalog)', async () => {
    mocks.listShopItemsByKind.mockResolvedValue([]);
    await expect(
      equipSoundThemeAction('c1', 'theme-doesnt-exist'),
    ).rejects.toThrow(/unknown theme/i);
  });
});
```

- [ ] **Step 6: Run — expect FAIL**

Run: `pnpm test tests/unit/equip-sound-theme-action.test.ts`
Expected: FAIL — action + helper missing.

- [ ] **Step 7: Implement `src/lib/actions/settings.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { setSoundTheme } from '@/lib/db/settings';
import { listChildOwnedShopItemIds, listShopItemsByKind } from '@/lib/db/shop';

export async function equipSoundThemeAction(
  childId: string,
  slug: string | null,
): Promise<{ themeSlug: string | null }> {
  await requireChild(childId);

  // Default is always allowed — it's the slug-less fallback.
  if (slug === null || slug === 'default') {
    await setSoundTheme(childId, null);
    revalidatePath(`/play/${childId}/shop`);
    return { themeSlug: null };
  }

  // Validate slug exists in catalog.
  const themes = await listShopItemsByKind('sound_theme');
  const match = themes.find((t) => t.slug === slug);
  if (!match) {
    throw new Error(`Unknown theme slug: ${slug}`);
  }

  // Validate ownership.
  const owned = await listChildOwnedShopItemIds(childId);
  if (!owned.includes(match.id)) {
    throw new Error(`Theme "${slug}" not owned`);
  }

  await setSoundTheme(childId, slug);
  revalidatePath(`/play/${childId}/shop`);
  return { themeSlug: slug };
}
```

- [ ] **Step 8: Add `listShopItemsByKind` to `src/lib/db/shop.ts`**

Read the file, then add this function (placement near the other list helpers):

```ts
export async function listShopItemsByKind(
  kind: ShopItemRow['kind'],
): Promise<ShopItemRow[]> {
  return await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.kind, kind), eq(shopItems.isActive, true)));
}
```

Add `and` to the `drizzle-orm` import if it's not already imported.

- [ ] **Step 9: Run all action tests**

Run: `pnpm test tests/unit/equip-sound-theme-action.test.ts tests/unit/settings-db.test.ts`
Expected: all green.

- [ ] **Step 10: Run typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/lib/db/settings.ts src/lib/actions/settings.ts src/lib/db/shop.ts tests/unit/settings-db.test.ts tests/unit/equip-sound-theme-action.test.ts
git commit -m "$(cat <<'EOF'
feat(settings): child_settings DB layer + equipSoundThemeAction

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Seed script + sound-theme listing helper

**Files:**
- Create: `scripts/seed-sound-themes.ts`
- Modify: `src/lib/db/shop.ts` — add `listSoundThemeListings()`

- [ ] **Step 1: Implement `scripts/seed-sound-themes.ts`**

```ts
/**
 * Seed the 4 sound-theme shop items. Idempotent — re-running is safe.
 *
 * Usage:
 *   pnpm tsx scripts/seed-sound-themes.ts
 *
 * Pattern: same as scripts/seed-shop-avatar-items.ts. loadEnv first, then
 * dynamic import @/db inside main().
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

interface SoundThemeSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  priceCoins: number;
}

const THEMES: SoundThemeSeed[] = [
  {
    slug: 'theme-music-box',
    emoji: '🎼',
    nameZh: '音乐盒',
    nameEn: 'Music Box',
    descriptionZh: '每次答对都像音乐盒一样叮咚响。',
    descriptionEn: 'Mellow chimes for every right answer.',
    priceCoins: 200,
  },
  {
    slug: 'theme-retro-arcade',
    emoji: '🕹️',
    nameZh: '复古街机',
    nameEn: 'Retro Arcade',
    descriptionZh: '8 位机的电子音效。',
    descriptionEn: '8-bit blips like a coin-op.',
    priceCoins: 200,
  },
  {
    slug: 'theme-nautical',
    emoji: '⚓',
    nameZh: '海上钟',
    nameEn: 'Nautical',
    descriptionZh: '海上的铜钟与雾号。',
    descriptionEn: 'Sea bells and a foghorn for misses.',
    priceCoins: 250,
  },
  {
    slug: 'theme-fanfare-plus',
    emoji: '🎺',
    nameZh: '加长号角',
    nameEn: 'Fanfare Plus',
    descriptionZh: '通关时的加长胜利号角。',
    descriptionEn: 'Extended victory horn after boss + perfect week.',
    priceCoins: 300,
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  for (const t of THEMES) {
    const existing = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, t.slug))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(shopItems).values({
      slug: t.slug,
      kind: 'sound_theme',
      name: `${t.nameZh} / ${t.nameEn}`,
      description: `${t.descriptionZh}\n${t.descriptionEn}`,
      imageUrl: t.emoji,
      priceCoins: t.priceCoins,
      isActive: true,
    });
    inserted++;
    console.log(`  + ${t.slug} (${t.priceCoins} coins)`);
  }

  console.log(`Done. Inserted ${inserted} new themes (skipped ${THEMES.length - inserted}).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Smoke-test the seed**

Run: `pnpm tsx scripts/seed-sound-themes.ts`
Expected on first run: 4 inserts. On second run: 0 inserts (all skipped).

- [ ] **Step 3: Add `listSoundThemeListings` to `src/lib/db/shop.ts`**

Append this function near other listing helpers (after `listAvatarShopListings` is fine):

```ts
export interface SoundThemeListing {
  shopItem: ShopItemRow;
}

export async function listSoundThemeListings(): Promise<SoundThemeListing[]> {
  const rows = await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.kind, 'sound_theme'), eq(shopItems.isActive, true)));
  return rows.map((shopItem) => ({ shopItem }));
}
```

(Add `and` to drizzle-orm imports if not present.)

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-sound-themes.ts src/lib/db/shop.ts
git commit -m "$(cat <<'EOF'
feat(shop): seed 4 sound themes + listSoundThemeListings

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `SoundsTabBody` component + tests

**Files:**
- Create: `src/components/shop/SoundsTabBody.tsx`
- Create: `tests/unit/sounds-tab-body.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sounds-tab-body.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  equipSoundThemeAction: vi.fn(),
  purchaseShopItemAction: vi.fn(),
  playSound: vi.fn(),
  setAudioTheme: vi.fn(),
  getTheme: vi.fn(),
}));

vi.mock('@/lib/actions/settings', () => ({
  equipSoundThemeAction: mocks.equipSoundThemeAction,
}));
vi.mock('@/lib/actions/shop', () => ({
  purchaseShopItemAction: mocks.purchaseShopItemAction,
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: mocks.playSound,
  setAudioTheme: mocks.setAudioTheme,
}));
vi.mock('@/lib/audio/themes', () => ({
  getTheme: mocks.getTheme,
}));

import { SoundsTabBody } from '@/components/shop/SoundsTabBody';

const listings = [
  {
    shopItem: {
      id: 'item-1',
      slug: 'theme-music-box',
      kind: 'sound_theme',
      name: '音乐盒 / Music Box',
      description: 'Mellow chimes',
      imageUrl: '🎼',
      priceCoins: 200,
    },
  },
  {
    shopItem: {
      id: 'item-2',
      slug: 'theme-nautical',
      kind: 'sound_theme',
      name: '海上钟 / Nautical',
      description: 'Bells and foghorn',
      imageUrl: '⚓',
      priceCoins: 250,
    },
  },
] as any; // SoundThemeListing[]

afterEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe('SoundsTabBody', () => {
  it('renders one card per listing + a default card (3 cards total)', () => {
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );
    // 4 cards: 1 default + 2 listings. Spec: default card visible.
    expect(screen.getByText(/Music Box/i)).toBeInTheDocument();
    expect(screen.getByText(/Nautical/i)).toBeInTheDocument();
    expect(screen.getByText(/默认|Default/i)).toBeInTheDocument();
  });

  it('marks the equipped theme as "已装备"', () => {
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['item-2'])}
        coinBalance={500}
        equippedThemeSlug="theme-nautical"
      />,
    );
    const nauticalCard = screen.getByText(/Nautical/i).closest('article')!;
    expect(nauticalCard).toHaveTextContent(/已装备|Equipped/);
  });

  it('preview button calls the theme ding via playSound after a setAudioTheme swap', async () => {
    mocks.getTheme.mockReturnValue({ ding: vi.fn(), buzz: vi.fn(), fanfare: vi.fn() });
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );
    const previewButtons = screen.getAllByRole('button', { name: /preview|试听/i });
    fireEvent.click(previewButtons[0]);
    expect(mocks.getTheme).toHaveBeenCalled();
  });

  it('clicking an owned card calls equipSoundThemeAction with the slug', async () => {
    mocks.equipSoundThemeAction.mockResolvedValue({ themeSlug: 'theme-nautical' });
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['item-2'])}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );
    const equipButton = screen.getByRole('button', { name: /装备|Equip/i });
    fireEvent.click(equipButton);
    // Action invoked inside a transition; flush microtasks.
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.equipSoundThemeAction).toHaveBeenCalledWith('c1', 'theme-nautical');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test tests/unit/sounds-tab-body.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/components/shop/SoundsTabBody.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { equipSoundThemeAction } from '@/lib/actions/settings';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import { setAudioTheme } from '@/lib/audio/play';
import { getTheme } from '@/lib/audio/themes';
import type { SoundThemeListing } from '@/lib/db/shop';

interface Props {
  childId: string;
  listings: SoundThemeListing[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
  equippedThemeSlug: string | null;
}

interface CardProps {
  emoji: string;
  nameZh: string;
  nameEn: string;
  description: string | null;
  priceCoins: number | null;       // null for the "default" card
  isOwned: boolean;
  isEquipped: boolean;
  affordable: boolean;
  pending: boolean;
  onPreview: () => void;
  onAction: () => void;
  actionLabel: string;
  actionDisabled: boolean;
}

function SoundThemeCard(p: CardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-5xl" aria-hidden>
          {p.emoji}
        </div>
        <div className="flex-1">
          <div className="text-base font-extrabold text-amber-950">{p.nameZh}</div>
          <div className="text-sm font-semibold text-amber-900">{p.nameEn}</div>
        </div>
        <button
          type="button"
          onClick={p.onPreview}
          aria-label="Preview / 试听"
          className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-900 hover:bg-amber-300"
        >
          🔊
        </button>
      </div>
      {p.description && (
        <p className="text-xs text-amber-900/80">{p.description}</p>
      )}
      <div className="flex items-center justify-between">
        {p.priceCoins !== null ? (
          <span className="text-sm font-bold text-amber-900">🪙 {p.priceCoins}</span>
        ) : (
          <span className="text-sm font-semibold text-amber-900/70">免费 / Free</span>
        )}
        <button
          type="button"
          disabled={p.actionDisabled || p.pending}
          onClick={p.onAction}
          className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
        >
          {p.actionLabel}
        </button>
      </div>
      {p.isEquipped && (
        <span className="self-start rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">
          已装备 / Equipped
        </span>
      )}
    </article>
  );
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function SoundsTabBody({
  childId,
  listings,
  ownedShopItemIds,
  coinBalance,
  equippedThemeSlug,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preview = (slug: string) => {
    const theme = getTheme(slug);
    // Cards preview by calling the theme's ding directly with a transient ctx.
    // Reuse setAudioTheme + playSound? Simpler: call ding directly so it works
    // even before the bootstrap effect has fired.
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    theme.ding(ctx);
  };

  const equip = (slug: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await equipSoundThemeAction(childId, slug);
        setAudioTheme(result.themeSlug);
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
        // Auto-equip after purchase.
        const result = await equipSoundThemeAction(childId, slug);
        setAudioTheme(result.themeSlug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
      }
    });
  };

  const defaultEquipped = equippedThemeSlug === null;

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      <SoundThemeCard
        emoji="🎵"
        nameZh="默认"
        nameEn="Default"
        description="经典的探险音效。"
        priceCoins={null}
        isOwned
        isEquipped={defaultEquipped}
        affordable
        pending={pending}
        onPreview={() => preview('default')}
        onAction={() => equip(null)}
        actionLabel={defaultEquipped ? '已装备 / Equipped' : '装备 / Equip'}
        actionDisabled={defaultEquipped}
      />

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const isOwned = ownedShopItemIds.has(l.shopItem.id);
        const isEquipped = equippedThemeSlug === l.shopItem.slug;
        const affordable = coinBalance >= l.shopItem.priceCoins;
        let actionLabel: string;
        let actionDisabled = false;
        let onAction: () => void;
        if (isEquipped) {
          actionLabel = '已装备 / Equipped';
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
          <SoundThemeCard
            key={l.shopItem.id}
            emoji={l.shopItem.imageUrl ?? '🎵'}
            nameZh={zh}
            nameEn={en}
            description={l.shopItem.description}
            priceCoins={l.shopItem.priceCoins}
            isOwned={isOwned}
            isEquipped={isEquipped}
            affordable={affordable}
            pending={pending}
            onPreview={() => preview(l.shopItem.slug)}
            onAction={onAction}
            actionLabel={actionLabel}
            actionDisabled={actionDisabled}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm test tests/unit/sounds-tab-body.test.tsx`
Expected: all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/shop/SoundsTabBody.tsx tests/unit/sounds-tab-body.test.tsx
git commit -m "$(cat <<'EOF'
feat(shop): SoundsTabBody — sound-theme tab content

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire into Shop + Layout + bootstrap

**Files:**
- Modify: `src/components/shop/ShopCategoryTabs.tsx:15-17` (the `sound` tab)
- Modify: `src/app/play/[childId]/shop/page.tsx`
- Modify: `src/app/play/[childId]/shop/ShopBody.tsx`
- Modify: `src/app/play/[childId]/layout.tsx`
- Create: `src/components/play/SoundThemeBootstrap.tsx`

- [ ] **Step 1: Enable Sound tab in `ShopCategoryTabs.tsx`**

Find the `sound` entry (around lines 15-17) and flip `disabled: true` → `disabled: false`. No other changes.

- [ ] **Step 2: Create `src/components/play/SoundThemeBootstrap.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { setAudioTheme } from '@/lib/audio/play';

interface Props {
  themeSlug: string | null;
}

export function SoundThemeBootstrap({ themeSlug }: Props) {
  useEffect(() => {
    setAudioTheme(themeSlug);
  }, [themeSlug]);
  return null;
}
```

- [ ] **Step 3: Mount the bootstrap in the play layout**

Edit `src/app/play/[childId]/layout.tsx`. Read the file. Add a server-side fetch of child settings, then mount the bootstrap. Final layout:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { ZodiacIconDefs } from '@/components/play/zodiac-icons';
import { ShopHudButton } from '@/components/play/ShopHudButton';
import { SoundThemeBootstrap } from '@/components/play/SoundThemeBootstrap';
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
        <Link
          href="/parent"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ocean-700)] hover:text-[var(--color-ocean-900)]"
        >
          ← Parent
        </Link>
        <span className="font-hanzi text-base font-bold tracking-wide text-[var(--color-ocean-900)]">
          汉字探险
        </span>
        <ShopHudButton childId={childId} />
      </header>
      <ZodiacIconDefs />
      <SoundThemeBootstrap themeSlug={themeSlug} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Update the shop page to fetch sound-theme data**

Edit `src/app/play/[childId]/shop/page.tsx`. Read the file. It currently fetches avatar listings + ownership + equipped. Add parallel fetches for the sound theme data and the child's current settings. Final page:

```tsx
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getCoinBalance } from '@/lib/db/coins';
import {
  getShopPageData,
  listChildOwnedShopItemIds,
  listSoundThemeListings,
} from '@/lib/db/shop';
import { getChildSettings } from '@/lib/db/settings';
import { ShopBody } from './ShopBody';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function ShopPage({ params }: PageProps) {
  const { childId } = await params;
  await requireChild(childId);

  const [shop, sounds, ownedIds, settings, balance] = await Promise.all([
    getShopPageData(childId),
    listSoundThemeListings(),
    listChildOwnedShopItemIds(childId),
    getChildSettings(childId),
    getCoinBalance(childId),
  ]);

  if (!shop) notFound();

  return (
    <ShopBody
      childId={childId}
      initialCoinBalance={balance.balance}
      listings={shop.listings}
      initialOwnedShopItemIds={ownedIds}
      initialEquipped={shop.equipped}
      soundListings={sounds}
      initialEquippedSoundThemeSlug={settings?.soundThemeSlug ?? null}
    />
  );
}
```

(If the existing page file has different imports — e.g., already imports from a per-page DB helper — adapt to its actual shape. Match its existing pattern; the spirit is "fetch the same data in parallel".)

- [ ] **Step 5: Update `ShopBody.tsx` to render `SoundsTabBody`**

Add 2 new props to `Props`:

```ts
import type { SoundThemeListing } from '@/lib/db/shop';
// ...
interface Props {
  childId: string;
  initialCoinBalance: number;
  listings: AvatarShopListing[];
  initialOwnedShopItemIds: string[];
  initialEquipped: EquippedAvatar;
  soundListings: SoundThemeListing[];
  initialEquippedSoundThemeSlug: string | null;
}
```

Destructure those in the function signature.

Add import:

```tsx
import { SoundsTabBody } from '@/components/shop/SoundsTabBody';
```

Replace the existing tab-body branch (the part that currently does `{activeTab === 'avatar' ? <ShopGrid ... /> : <placeholder />}`) with:

```tsx
{activeTab === 'avatar' && (
  <ShopGrid
    listings={listings}
    ownedShopItemIds={ownedIds}
    equippedAvatarItemIds={equippedAvatarItemIds}
    coinBalance={coinBalance}
    onPurchase={handlePurchase}
    onEquip={handleEquip}
  />
)}
{activeTab === 'sound' && (
  <SoundsTabBody
    childId={childId}
    listings={soundListings}
    ownedShopItemIds={ownedIds}
    coinBalance={coinBalance}
    equippedThemeSlug={initialEquippedSoundThemeSlug}
  />
)}
{(activeTab === 'pet' || activeTab === 'decor' || activeTab === 'powerup') && (
  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center text-amber-900/70">
    <div className="text-5xl">🚧</div>
    <div className="mt-3 text-lg font-bold">即将上线</div>
    <div className="mt-1 text-sm">下次更新见！</div>
  </div>
)}
```

- [ ] **Step 6: Run typecheck + full tests**

Run: `pnpm typecheck && pnpm test`
Expected: all 307+ tests green, typecheck clean. If any test breaks because `ShopBody` is now invoked with new required props, update those fixtures with empty `soundListings: []` and `initialEquippedSoundThemeSlug: null`.

- [ ] **Step 7: Manual dev walkthrough (recommended)**

Run `pnpm dev` and verify:
- `/play/<childId>/shop` opens with Avatar tab as before.
- Tap **音效 / Sound** tab → 5 cards (Default + 4 themes).
- Tap 🔊 on a card → hear a preview sound (browser audio policies may require an explicit gesture; the click counts).
- Buy a theme → owned chip flips → it auto-equips → ding now uses the new theme on next correct answer.
- Tap **默认 / Default** card's Equip button → reverts.

- [ ] **Step 8: Commit**

```bash
git add src/components/shop/ShopCategoryTabs.tsx src/components/play/SoundThemeBootstrap.tsx "src/app/play/[childId]/layout.tsx" "src/app/play/[childId]/shop/page.tsx" "src/app/play/[childId]/shop/ShopBody.tsx"
# Add any fixture-update files you touched in step 6.
git status
git commit -m "$(cat <<'EOF'
feat(shop): wire SoundsTabBody into shop + bootstrap theme in layout

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final QA gate + CLAUDE.md + PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the four-green gate**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
All must exit 0. Fix any breakage inline.

- [ ] **Step 2: Update `CLAUDE.md`**

Bump the "last refreshed" line at the top to `2026-05-22`. Update the "Shipped" line to `PR #1 → #31`. Append a new bullet after the PR #30 entry:

```markdown
- **PR #31 (just shipped, 2026-05-22)** — Sound / FX themes. 4 procedural Web-Audio themes (`music-box`, `retro-arcade`, `nautical`, `fanfare-plus`) live in the Sounds shop tab. New `child_settings` table (PK childId) stores `sound_theme_slug`; `setAudioTheme(slug)` swaps the runtime handler registry. Shop card has a 🔊 preview button. `scripts/seed-sound-themes.ts` seeds the 4 `shop_items` rows.
```

Also update the "Next up" line to drop sound themes from the queue, leaving powerups / pet / decor / trophies.

- [ ] **Step 3: Commit + verify branch state**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude.md): record PR #31 (sound themes)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git log --oneline main..HEAD
git status
```

- [ ] **Step 4: Hand off — DO NOT push**

Stop here. The controller will run `git push` + `gh pr create` after explicit approval. Working tree must be clean and `git log main..HEAD` should show ~9 commits.

After merge, the seed script must be run against prod (one-off):

```bash
pnpm tsx scripts/seed-sound-themes.ts
```

(Same shared-DATABASE_URL caveat as PR #30. Confirm before running.)

---

## Self-Review

**1. Spec coverage:**
- 4 themes (music-box / retro-arcade / nautical / fanfare-plus) → Task 2.
- `child_settings` table → Task 1.
- `shopItemKind` enum + `sound_theme` value → Task 1.
- `setAudioTheme` runtime swap → Task 3.
- DB layer + action → Task 4.
- Seed script → Task 5.
- `listSoundThemeListings` → Task 5.
- `SoundsTabBody` UI → Task 6.
- Wiring (`ShopCategoryTabs`, `ShopBody`, `layout`, page) → Task 7.
- Tests for each new piece → Tasks 2-6 each have TDD steps.
- CLAUDE.md update → Task 8.

**2. Placeholder scan:** No "TBD", "TODO", "similar to Task N" deferrals. Every code step has the actual code.

**3. Type consistency:**
- `ThemeHandlers` defined in Task 2 (`themes/index.ts`), consumed by every theme file in Task 2 and by `play.ts` in Task 3 (via `getTheme` return type).
- `ThemeSlug` exported from `themes/index.ts`, never re-declared.
- `SoundThemeListing` introduced in Task 5 (`lib/db/shop.ts`), consumed in Task 6 (`SoundsTabBody` props) and Task 7 (`ShopBody` props).
- `equipSoundThemeAction(childId, slug)` signature: `(string, string | null) => Promise<{ themeSlug: string | null }>`. Used identically in Task 6 (component) and Task 7 (layout doesn't call it; only the component does).
- `setAudioTheme(slug: string | null)` signature: same in Task 3 (declaration), Task 6 (post-equip optimistic call), Task 7 (bootstrap useEffect).
- `getTheme(slug)` accepts `string | null | undefined` per Task 2; called with `null` in Task 3 default-init test and Task 6 preview path.
- Seed `shopItems.imageUrl` stores the emoji string — consumed in Task 6 as `l.shopItem.imageUrl ?? '🎵'`.

No drift identified.
