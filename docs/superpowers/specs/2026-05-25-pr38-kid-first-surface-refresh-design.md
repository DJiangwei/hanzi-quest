# PR #38 — Kid-First Surface Refresh (design spec)

> Date: 2026-05-25
> Status: design approved, plan pending
> Predecessor: PR #37 (consumable powerups + Shop 5-of-5 live)

## 1. Goal

Make Yinuo's first-touch experience kid-native: she opens the iPad, the app lands straight on the island map (no parent dashboard detour), and the four kid-facing surfaces (Map / Backpack / Calendar / Shop) are pinned to a bottom thumb-reach nav bar. Tapping an island morphs smoothly into the week hub instead of route-flashing. A 7-day check-in strip lives above the island map; a full month-grid calendar lives on its own page. Parent dashboard moves behind a discreet gear icon plus 4-digit PIN gate, protecting David's authored content from accidental taps.

Five user-visible deliverables, one cohesive PR:

| # | David's feedback | This PR ships |
|---|---|---|
| 1 | 航海地图点击进入动画不顺 | View Transitions API morph from island circle → hub hero + Suspense skeleton during fetch |
| 2 | 主界面加日历，展示打卡 | 7-day strip on island map (today highlighted, ⭐/❄️ per day) + `/calendar` month grid |
| 3 | 孩子登录直接进游戏，不要 parent dashboard | Root `/` auto-redirects to `/play/[childId]` for signed-in single-child accounts; parent dashboard sits behind PIN |
| 4 | 背包入口更明显 | Bottom 4-tab nav with `🎒 背包` as a top-level destination; Atlas page renamed Backpack + "Recently Obtained" strip |
| 5 | Bottom nav unifies all four | New `KidNavBar` (🏝️ Map / 🎒 背包 / 📅 日历 / 🛒 商店 + ⚙️ gear) |

Item 5 from David's original message (multi-map chapter system, naming the existing 10-week pack as "Map 1" with a placeholder for Map 2) is **out of scope** for this PR — it's PR B in a separate brainstorm.

## 2. Architecture overview

**Five subsystems**, each independently testable, listed in approximate build order:

1. **Routing & redirect** — root page redirects signed-in single-child users to `/play/[childId]`. Parent dashboard layout adds PIN gate.
2. **Parent PIN** — new `parent_settings` table; bcrypt PIN hash; unlock cookie (HttpOnly, 15-min sliding TTL); `/parent/unlock` page.
3. **KidNavBar** — bottom-fixed nav, 4 tabs + gear, mounted in `play/[childId]/layout.tsx`. Active-tab detection via `usePathname()`. Mid-scene tap fires a quit-confirm dialog.
4. **View Transitions** — `viewTransitionName` style on island Links + matching name on hub hero. Browser handles the morph. Reduced-motion fallback. New `loading.tsx` skeleton for hub.
5. **Calendar** — `WeekStrip` (home) + `MonthCalendar` (`/calendar` page) + new `getActivityForRange()` query aggregating from existing `coin_transactions`. No new persistence beyond §6 below.
6. **Backpack rename + Recently Obtained** — `AtlasHub` H1 changes to 背包/Backpack; new `RecentlyObtainedStrip` at top sources from three existing tables (`child_collections`, `child_avatar_inventory`, `shop_purchases`).

Total new files: ~11. Modified: ~8. Migrations: 1 (parent_settings). LOC: ~600-800 net.

## 3. Routing & kid-first redirect

### Root redirect (`src/app/page.tsx`)

Today: signed-in users see a "Open parent dashboard →" CTA. We change this to:

```ts
if (signedIn) {
  const children = await listChildrenForCurrentUser();
  if (children.length === 1) redirect(`/play/${children[0].id}`);
}
// else fall through to existing landing (kids-cards or signed-out view)
```

Multi-child case (future): show child-picker cards rather than redirect. Not built in this PR — the call site just doesn't redirect when `children.length !== 1`, and the existing landing renders unchanged.

### Parent gate (`src/app/parent/layout.tsx`)

Before rendering `{children}`, check the unlock cookie:

```ts
const unlocked = cookies().get('parent_unlocked')?.value === '1';
if (!unlocked) {
  const userId = (await auth()).userId;
  const settings = await getParentSettings(userId);
  if (settings?.parentPinHash) {
    redirect('/parent/unlock');
  } else {
    // first-time parent visit, no PIN set: render a banner via a wrapper
    return <FirstTimeBanner>{children}</FirstTimeBanner>;
  }
}
```

`FirstTimeBanner` shows: "Set a PIN to keep Yinuo from accidentally editing — [Set now →]" pinned to the top of every parent page until a PIN is set.

### PIN setup / unlock flow

- `GET /parent/unlock` — renders a 4-digit pad. On submit:
  - POST to `/api/parent-unlock` with the digits.
  - Server bcrypts + compares against `parent_settings.parent_pin_hash`.
  - On match: set `Set-Cookie: parent_unlocked=1; HttpOnly; SameSite=Strict; Max-Age=900` (15min), redirect to the original `?next=` URL (default `/parent`).
  - On mismatch: increment `parent_settings.failed_attempts`. At 5, set `locked_until=now() + 5min` and reject all attempts until expiry.
- `GET /parent/unlock?reset=1` — if accessed while signed-in (Clerk session present), bypasses PIN and goes directly to the PIN-set form. This is the recovery path.
- PIN set form: 4-digit entry twice (confirm). On submit, bcrypt hash with cost=10, write to `parent_settings`. No old-PIN required for first set; if PIN already exists, the unlock flow gates this page.

### Edge cases

- David clears cookies → next `/parent` visit asks for PIN. Expected.
- Yinuo finds the gear → PIN screen, 5 wrong → 5-min cooldown screen. She gives up.
- David forgets PIN → sign out, sign back in, visit `/parent/unlock?reset=1`. Friction acceptable.
- New Clerk user (no children yet) → root falls through to landing. Existing onboarding (create child profile) intact.
- A second child is added → root no longer redirects (returns to landing with cards). PIN gate continues to work on `/parent`.

## 4. Bottom KidNavBar

### File: `src/components/play/KidNavBar.tsx` (new, client component)

Props: `{ childId: string }`. Reads route via `usePathname()`. Reads "mid-scene" state from a new lightweight context (next subsection).

Visual: a fixed-bottom 64px bar with `backdrop-blur-md bg-white/85 border-t border-[var(--color-sand-200)]`. Safe-area-inset bottom padding for iOS home-indicator. Layout:

```
┌─────────────────────────────────────────────────┐
│  🏝️       🎒        📅        🛒       ⚙️    │
│  Map     背包      日历      商店     gear     │
│   ●                                             │
└─────────────────────────────────────────────────┘
```

- Tabs are 56px-wide buttons; icon 28px above 11px label.
- Active tab: dot indicator (`●`) below the label, color `--color-ocean-700`. Inactive: `--color-sand-600`.
- Gear: smaller (24px icon, no label, sits flush right with a small separator). Visually a "second-class" item.
- Tab buttons use Next.js `<Link prefetch>` for instant feel.
- `aria-current="page"` on active tab.
- 100ms color fade on indicator. Under `prefers-reduced-motion`, color swaps instantly.

### Active-tab detection

```ts
const path = usePathname();
const isMap      = path === `/play/${childId}`
                || path.startsWith(`/play/${childId}/week`)
                || path.startsWith(`/play/${childId}/level`);
const isBackpack = path.startsWith(`/play/${childId}/collection`);
const isCalendar = path.startsWith(`/play/${childId}/calendar`);
const isShop     = path.startsWith(`/play/${childId}/shop`);
```

Hub `/week/...` and section `/level/...` routes count as still-on-Map so the nav doesn't visually relocate Yinuo mid-session.

### Mid-scene quit-confirm

When inside `/play/[childId]/level/[weekId]/[section]/`, the section page sets `<MidSceneFlag value={true} />` — a React Context provider. KidNavBar reads this; if `midScene === true` and the user taps a tab whose target is not the current section, intercept the click:

```ts
e.preventDefault();
showQuitConfirm(targetHref); // opens a confirm dialog
```

Confirm dialog (reuses `PurchaseConfirmDialog` pattern):
- Title: "结束这一关? Quit this level?"
- Body: "进度会保留 / Progress will be saved."
- Buttons: "继续 / Stay" (default) | "结束 / Quit" → navigates to targetHref.

The gear is mid-scene-exempt: even mid-scene, gear→parent goes through PIN gate, no extra confirm. (David shouldn't be playing scenes; if he is, the PIN gate is the only door.)

### Layout integration

`src/app/play/[childId]/layout.tsx`:

```tsx
<div className="flex min-h-full flex-1 flex-col …">
  <header>…</header>
  <ZodiacIconDefs />
  <SoundThemeBootstrap />
  <MidSceneProvider>
    <div className="flex flex-1 flex-col pb-20">{children}</div>
    <KidNavBar childId={childId} />
  </MidSceneProvider>
</div>
```

The `pb-20` ensures content doesn't sit behind the nav.

## 5. Tap-into-island animation (View Transitions)

### Mechanism

Modern browsers expose the View Transitions API: setting `viewTransitionName: foo` on an element in the outgoing page AND an element in the incoming page tells the browser to morph between the two (animating position + size + opacity automatically). Next.js 16 wraps `document.startViewTransition()` around route navigations when `next.config` opts in.

### Wiring

`src/components/play/IslandMap.tsx`: each island `<Link>` gets:

```tsx
<Link
  href={`/play/${childId}/week/${island.weekId}`}
  style={{ viewTransitionName: `island-${island.weekId}` }}
  …
/>
```

`src/app/play/[childId]/week/[weekId]/page.tsx` (hub): wrap the hero card (the big island-name banner at the top) in a div with the same `viewTransitionName: island-${weekId}`. The browser sees the two elements share a name and morphs.

### Suspense skeleton

`src/app/play/[childId]/week/[weekId]/loading.tsx` (new): a structural skeleton in the same palette (uses existing `TreasureMapBackdrop`), showing three gray hub-card placeholders. Rendered automatically by Next.js during server-fetch. The morphed island element remains visible on top during the fetch window — there's no flash of white.

### CSS (`src/app/globals.css`)

```css
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root) { animation: 150ms ease-out both vt-fade-out; }
  ::view-transition-new(root) { animation: 220ms ease-in  both vt-fade-in;  }
  @keyframes vt-fade-out { to { opacity: 0; } }
  @keyframes vt-fade-in  { from { opacity: 0; } to { opacity: 1; } }
}
```

The shared-element transition between `island-${weekId}` named elements is fully handled by the browser — no per-element keyframes needed.

### Reverse direction

Hub's "← Map" back link uses the same `viewTransitionName` on the hero. Browser morphs back into the island circle on the previous page.

### Fallback

Browsers without View Transitions API: `startViewTransition` is undefined, navigation behaves as today (instant swap with skeleton fallback). Tested in jsdom by mocking the API as undefined and asserting no errors.

### Out of scope

- View transitions on Backpack ↔ pack-page or Shop tab swaps. Free-win adjacent, but we ship Map↔Hub only this PR.

## 6. Calendar

### Data source — reuses existing tables

No new persistence. The activity feed derives from `coin_transactions` (which already records every play event because every scene awards coins):

```ts
// src/lib/db/activity.ts
export type ActivityDay = {
  dateIso: string;
  played: boolean;          // any non-bonus tx that day
  dailyLoginBonus: boolean; // reason='daily_login'
  freezeBurned: boolean;    // reason='streak_freeze'
  coinsEarned: number;      // sum of positive deltas
};

export async function getActivityForRange(
  childId: string,
  startIso: string,
  endIso: string,
): Promise<ActivityDay[]>;
```

UTC day buckets, using the same `todayUtcIso()` helper from `src/lib/db/streaks.ts` (PR #28) — keeps "what counts as today" consistent with the streaks system.

### `WeekStrip` (home, between avatar header and IslandMap)

`src/components/play/WeekStrip.tsx` — client component. Receives `activity: ActivityDay[]` (7 days, Mon→Sun in current week, locale=zh-CN). Renders:

```
┌─────────────────────────────────────────────────┐
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun              │
│   ⭐   ⭐    ⭐   ❄️   ⭐   ⭐   ●               │
│   25   26   27   28   29   30   31              │
└─────────────────────────────────────────────────┘
```

Icons (in priority order — first applicable wins):
- `●` if `dateIso === todayUtcIso()` (today marker, gold ring)
- `❄️` if `freezeBurned`
- `🪙` if `dailyLoginBonus && !played` (got bonus but didn't play scenes — rare)
- `⭐` if `played`
- blank if past day with no activity
- dimmed dot if future day

The whole strip is one `<Link href="/play/[childId]/calendar">` so tapping anywhere drills into the month page. Pill heights ~56px, full-width, sits between the avatar-coin header and `<IslandMap>` on home.

### `/play/[childId]/calendar` page

`src/app/play/[childId]/calendar/page.tsx` — server component:

```tsx
export default async function CalendarPage({ params, searchParams }) {
  const { childId } = await params;
  const { yyyymm } = await searchParams; // optional: e.g., '2026-05'
  await requireChild(childId);

  const month = parseMonth(yyyymm) ?? currentUtcMonth();
  const range = monthRange(month);
  const [activity, streak] = await Promise.all([
    getActivityForRange(childId, range.startIso, range.endIso),
    getCurrentStreak(childId),
  ]);

  return <MonthCalendar month={month} activity={activity} streak={streak} />;
}
```

`MonthCalendar` (`src/components/play/MonthCalendar.tsx`, client) — 6×7 grid for the month, same icon vocab as `WeekStrip` plus `🔥` overlay on cells that fall inside the current streak's run. Prev/next-month arrows update via `<Link href="?yyyymm=2026-04">` (search-param-driven navigation, no client routing state).

Top-right of the page: a "🔥 Current streak: N days" stat card. Pulled from `streaks.currentStreak`.

Past days with no activity render as small gray dots — visually present but un-emphasized (don't guilt-trip Yinuo).

Tap a past day: no-op for V1. (Drill-into-day's-attempts is a follow-up.)

## 7. Backpack rename + Recently Obtained

### Rename

`src/components/play/AtlasHub.tsx` — change rendered H1 from "Collector's Atlas / 探险家图鉴" to "背包 / Backpack". Component file name stays `AtlasHub` — internal-only, no import churn.

Route stays `/play/[childId]/collection`. KidNavBar's 🎒 tab Links to this path.

### `RecentlyObtainedStrip` (top of AtlasHub, above pack cards)

`src/components/play/RecentlyObtainedStrip.tsx` (new, client):

```
最近获得 · Recently Obtained
┌──────┐ ┌──────┐ ┌──────┐
│  🦅  │ │  🐢  │ │ 🎩   │     ← horizontally scrollable
│ Eagle│ │Turtle│ │ Hat  │
│ 新   │ │      │ │      │
└──────┘ └──────┘ └──────┘
```

Props: `recentItems: RecentItem[]` (already resolved server-side). Hides entirely when `recentItems.length === 0` (clean first-time UX).

Each tile:
- Emoji or per-pack SVG (delegated via `getPackMeta(slug).ItemCard` for collection items)
- Bilingual name `nameZh / nameEn`
- "新 / NEW" sticker if obtained <24h ago
- Tap → navigates to `item.href` (which differs by kind, see below)

### `getRecentlyObtainedForChild`

`src/lib/db/recent-obtained.ts`:

```ts
export type RecentItem = {
  kind: 'collection' | 'avatar' | 'pet' | 'decor';
  obtainedAt: Date;
  displayEmoji: string;
  nameZh: string;
  nameEn: string;
  href: string;
};

export async function getRecentlyObtainedForChild(
  childId: string,
  limit = 3,
): Promise<RecentItem[]>;
```

Aggregates from three existing tables:
1. **`child_collections`** — Atlas pack pulls (zodiac/flags/sea/dino/solar). Joins `pack_items` for emoji + names; `href = /play/[childId]/collection/[packSlug]`.
2. **`child_avatar_inventory`** — avatar items via `avatar_items` join. Emoji = a slot-derived icon (e.g., 🎩 for hat). `href = /play/[childId]/shop?tab=avatar`.
3. **`shop_purchases`** filtered to `kind in ('pet', 'decor')` — joins `shop_items` for emoji + names. `href = /play/[childId]/shop?tab=pet` or `?tab=decor`.

All three sources are sorted by their `obtainedAt`/`createdAt`/`purchasedAt` DESC, merged in memory, and the top `limit` taken. Implementation: three parallel queries + a simple merge — no DB-side UNION needed.

Powerups are deliberately excluded (consumables, not "stuff you own forever").

### AtlasHub integration

`src/app/play/[childId]/collection/page.tsx`:

```ts
const [recentItems, activePacks /* … */] = await Promise.all([
  getRecentlyObtainedForChild(childId),
  listActivePacks(),
  // …
]);
return <AtlasHub childId={childId} recentItems={recentItems} packs={…} />;
```

`AtlasHub` mounts `<RecentlyObtainedStrip items={recentItems} />` at the top.

## 8. Schema changes

### `parent_settings` (new table — migration 0014)

```ts
// src/db/schema/auth.ts (or wherever parent-scoped settings live)
export const parentSettings = pgTable('parent_settings', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  parentPinHash: text('parent_pin_hash').notNull(),
  pinSetAt: timestamp('pin_set_at', { withTimezone: true }).notNull().defaultNow(),
  failedAttempts: smallint('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});
```

Migration `drizzle/0014_parent_settings.sql` — pure DDL, no seed. Row written on first PIN-set.

### No other schema changes

- Calendar data: reuses `coin_transactions` + `streaks`.
- Recently Obtained: reuses `child_collections` + `child_avatar_inventory` + `shop_purchases`.
- Mid-scene state: ephemeral React context, not persisted.

## 9. Out of scope (deliberate deferrals)

- **Multi-child UX** for root redirect. 1-child case only; multi-child returns to landing.
- **Drill-into-day** on calendar (tap May 12 → see attempts that day). Future iteration.
- **Animated avatars / pet idle**. Static today, separate polish PR.
- **View Transitions on Backpack ↔ pack-page or Shop ↔ tab**. Free wins adjacent, but ship Map↔Hub only this PR to bound risk.
- **Renaming `AtlasHub` component file** to `BackpackHub`. Just rename the user-facing copy.
- **PIN reset via email**. Reset = sign out + back in + `/parent/unlock?reset=1`.
- **Multi-map / chapter system** (item 5 from David's message — naming the existing 10-week pack as "Map 1", placeholder for Map 2). That's PR B, separate brainstorm.

## 10. Testing & verification

### Unit tests (Vitest + RTL + jsdom; mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`)

| File | Asserts |
|---|---|
| `tests/unit/app/page.test.tsx` | root redirects to `/play/[childId]` when signed-in single child; falls back to landing on multi-child or signed-out |
| `tests/unit/components/play/KidNavBar.test.tsx` | active tab highlights based on pathname; mid-scene tab tap fires confirm; gear → `/parent`; safe-area padding present |
| `tests/unit/components/play/WeekStrip.test.tsx` | renders 7 days Mon→Sun; today marker; ⭐ for play days; ❄️ for freeze burns; tap whole strip → /calendar |
| `tests/unit/components/play/MonthCalendar.test.tsx` | renders Mon-start grid; prev/next via search params; future days dimmed; streak overlay |
| `tests/unit/lib/db/activity.test.ts` | aggregates `coin_transactions` into UTC day buckets; reason filtering; cross-month boundary |
| `tests/unit/lib/db/recent-obtained.test.ts` | merges 3 sources, sorts DESC by obtainedAt, caps at 3, resolves href per kind |
| `tests/unit/components/play/RecentlyObtainedStrip.test.tsx` | empty state hides entirely; "新" sticker for <24h items |
| `tests/unit/lib/auth/parent-pin.test.ts` | bcrypt match/mismatch; 5 wrong → cooldown; cookie HttpOnly + SameSite=Strict |
| `tests/unit/app/parent/unlock.test.tsx` | correct PIN sets cookie + redirects to `?next`; wrong PIN re-renders with error |
| `tests/unit/components/play/IslandMap.test.tsx` | island Link emits `viewTransitionName: island-{id}`; degrades when API undefined |

### Manual verification (before opening the PR)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev`, sign in as David — root auto-redirects to `/play/[yinuoId]`. Bottom nav visible. Each of 4 tabs lands on correct page; active dot moves.
3. Tap gear cold → `/parent/unlock` PIN screen. Set PIN. Persists across reload.
4. Sign out + back in → root redirects again. Tap gear → PIN screen (cookie cleared). Enter PIN → `/parent` works.
5. Tap island → smooth morph into hub on Chrome/Safari. Skeleton renders during fetch. "← Map" back morphs back.
6. WeekStrip on home shows current week; tap → `/calendar`, month grid renders, prev/next nav works.
7. Run a zodiac pull → Backpack shows new item in Recently Obtained with "新" sticker.
8. Mid-scene, tap Map tab → confirm dialog appears; "继续 / Stay" keeps scene, "结束 / Quit" goes home.
9. DevTools → `prefers-reduced-motion: reduce` → view-transition completes via color fade only (no scale-morph). Nav indicator color swaps instantly.
10. iPad portrait Mobile Safari (Yinuo's device) — nav doesn't overlap iOS home-indicator; safe-area-inset padding correct.

## 11. File summary

**New (13):**
- `src/components/play/KidNavBar.tsx`
- `src/components/play/MidSceneProvider.tsx`
- `src/components/play/WeekStrip.tsx`
- `src/components/play/MonthCalendar.tsx`
- `src/components/play/RecentlyObtainedStrip.tsx`
- `src/lib/db/activity.ts`
- `src/lib/db/recent-obtained.ts`
- `src/lib/auth/parent-pin.ts`
- `src/app/play/[childId]/calendar/page.tsx`
- `src/app/play/[childId]/week/[weekId]/loading.tsx`
- `src/app/parent/unlock/page.tsx`
- `src/app/api/parent-unlock/route.ts`
- `drizzle/0014_parent_settings.sql`

**Modified (8):**
- `src/app/page.tsx` (root redirect)
- `src/app/play/[childId]/page.tsx` (insert WeekStrip)
- `src/app/play/[childId]/layout.tsx` (mount KidNavBar + MidSceneProvider)
- `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` (set mid-scene flag)
- `src/app/play/[childId]/collection/page.tsx` (pass recentItems)
- `src/app/parent/layout.tsx` (PIN gate)
- `src/components/play/AtlasHub.tsx` (rename H1 + mount strip)
- `src/components/play/IslandMap.tsx` (viewTransitionName on Links)
- `src/db/schema/auth.ts` (parentSettings)
- `src/lib/db/settings.ts` (PIN getters/setters)
- `src/app/globals.css` (view-transition keyframes)
- `src/app/play/[childId]/week/[weekId]/page.tsx` (viewTransitionName on hero)

**Tests (10):** see §10 matrix.

**Net LOC:** ~600-800.

## 12. Dependencies

- **Add `bcryptjs`** (confirmed not currently in `package.json`). Pure-JS, no native build, ~6KB minified. Used only on the server for PIN hash/compare.
- No other new packages.
