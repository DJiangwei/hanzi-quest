# PR #31 — Sound / FX themes

> **Author:** brainstormed with David, 2026-05-22.
> **Sibling:** picks up after PR #30 (4-segment weekly structure shipped 2026-05-22).
> **Status:** spec ready for implementation plan.

## Why

The game ships exactly three procedural Web-Audio sounds: a ding (correct), buzz (wrong), fanfare (level/boss clear). Every child hears the same three forever. The shop has Avatar live; the Sounds / Pet / Decor / Powerups tabs are placeholder "即将上线" with no content yet — first agreed Shop expansion content (per `docs/superpowers/specs/2026-05-18-pr21-shop-expansion-design.md` roadmap §3) is sound themes. PR #30 just shipped a denser week (~17 levels), so sensory variety is the next biggest sensory-UX upgrade per coin spent.

This PR delivers:

1. **Four new procedural sound themes** in addition to the existing `default`: `music-box`, `retro-arcade`, `nautical`, `fanfare-plus`. Each theme is a triplet `{ ding, buzz, fanfare }` of Web-Audio handler functions.
2. **A new `child_settings` table** holding per-child preferences. First column: `soundThemeSlug`. Future columns (reduced-motion, pinyin default, etc.) accumulate here.
3. **Shop integration**: Sounds tab in `/play/[childId]/shop` becomes live. Cards play a 1-second preview on tap. Purchase + equip flow mirrors Avatar (tap owned card → equips; tap unowned → confirm → purchase → auto-equip).
4. **Runtime swap**: `playSound(name)` reads the current theme's handler from a registry. `setAudioTheme(slug)` updates the registry at runtime so an equip takes effect immediately without page reload.

## Locked decisions

- **Procedural only.** Each theme is a TS file in `src/lib/audio/themes/<slug>.ts` exporting `{ ding, buzz, fanfare }` functions of `(ctx: AudioContext) => void`. Zero asset bundle, consistent with default. Limits real-instrument fidelity (foghorn approximation rather than recording) — accepted.
- **New `child_settings` table.** Single row per child PK = `childId`. First column `sound_theme_slug TEXT NULL` (NULL = default theme). Future preferences go here. Avoids polluting `child_profiles`.
- **One `shop_items.kind = 'sound_theme'` enum value.** Drizzle migration appends.
- **Theme equip is optimistic + immediate** (matches avatar pattern). No confirm dialog for equip. Purchase still has confirm.
- **Default theme is not a shop item.** Always free and the implicit fallback when `soundThemeSlug` is NULL. Cannot be "owned" or "unowned".
- **Preview = one-sample tap.** Card has a 🔊 button that calls the theme's `ding()` once. No auto-play, no "play all three" — keep it terse.
- **Theme handler is per-event, not per-character.** A theme can't override individual scenes' audio (e.g., the TTS `speechSynthesis` calls in `AudioPickScene` / `SentenceClozeScene` stay untouched; only `playSound('ding'|'buzz'|'fanfare')` calls route through the registry).

## Scope

### In scope

- Drizzle migration (append-only) for: `shop_items.kind` enum +1 value (`sound_theme`); new `child_settings` table; backfill nothing (existing children get NULL = default behaviour).
- `src/lib/audio/themes/` directory:
  - `index.ts` exports `THEME_REGISTRY: Record<slug, { ding, buzz, fanfare }>` and `getTheme(slug?: string)` with default fallback.
  - One file per theme: `default.ts` (re-exports existing `playDing/playBuzz/playFanfare`), `music-box.ts`, `retro-arcade.ts`, `nautical.ts`, `fanfare-plus.ts`.
- `src/lib/audio/play.ts` refactored: handlers map is no longer a const; `setAudioTheme(slug)` updates an internal `currentThemeSlug` and the `handlers` map. `playSound()` reads the current theme.
- `src/lib/db/settings.ts` (new): `getChildSettings(childId)`, `setSoundTheme(childId, slug | null)`. Pure DB layer.
- `src/lib/actions/settings.ts` (new) — `'use server'` file with `equipSoundThemeAction(childId, slug)`. Validates ownership (must have purchased the shop item) unless slug is `'default'` (always allowed).
- `src/lib/db/shop.ts` extended: `listOwnedSoundThemes(childId)`, returns the slugs of sound-theme shop items the child owns.
- Shop UI:
  - `ShopCategoryTabs`: Sounds tab loses "即将上线" placeholder.
  - New `SoundsTabBody.tsx` mirrors the Avatar tab — grid of `ShopItemCard`s with sound-theme-specific preview button.
  - `ShopItemCard` gains an optional `previewAction?: () => void` prop. Avatar cards leave it undefined; sound cards pass a closure that calls the theme's `ding()`.
- Seed script `scripts/seed-sound-themes.ts` (idempotent): inserts 4 `shop_items` rows. Pattern matches `scripts/seed-shop-avatar-items.ts`.
- Play surface plumbing: on layout mount, read the child's `soundThemeSlug` and call `setAudioTheme(slug)`. When the equip action returns, optimistically call `setAudioTheme(newSlug)` so the next sound uses the new theme.
- Tests:
  - One unit test per new theme file: assert the function runs without throwing on a mock `AudioContext`.
  - `setAudioTheme` swaps the handler map.
  - `equipSoundThemeAction` rejects non-owned slugs (except `default`).
  - `SoundsTabBody` renders all 4 themes + the default placeholder card.
- `CLAUDE.md` "last refreshed" bump + new bullet for PR #31.

### Out of scope (explicit deferrals)

- Theme-aware TTS (replacing `speechSynthesis` calls). Out of scope — the kid-facing voice stays the browser default.
- Background music / ambient loop while playing. Sound themes are event-triggered only.
- Volume control / per-event volume. The existing `setAudioMuted(boolean)` global is the only volume knob.
- Powerups / pet / decor — still queued.
- A `tracing` scene template — pre-existing inactive enum value, untouched here.
- `child_settings` UI for non-sound preferences. The table is introduced, but only the sound-theme column is wired. Other prefs come later when each feature lands.

## Theme designs (for the implementer)

Each theme is `(ctx: AudioContext) => void` per event. Concrete oscillator/envelope sketches:

### `default` — re-exported existing
Already implemented in `src/lib/audio/sounds.ts`. Move/re-export, do not rewrite.

### `music-box` — mellow chimes
- `ding`: 2 stacked sine oscillators at 1200 Hz + 1800 Hz (perfect fifth), 50 ms attack, 800 ms exponential decay. Soft, bell-like.
- `buzz`: a 200 Hz triangle with a downward pitch slide to 150 Hz over 200 ms. Gentle "off-note" rather than a harsh buzz.
- `fanfare`: ascending arpeggio 800 → 1200 → 1600 Hz, three sines, 150 ms each, mild reverb-tail via short delayed echo.

### `retro-arcade` — 8-bit blips
- `ding`: square wave 1320 Hz for 60 ms, then 1760 Hz for 60 ms. Coin-pickup vibe.
- `buzz`: square 200 Hz for 200 ms with steep envelope — short raspy beep.
- `fanfare`: square arpeggio 660 → 880 → 1110 → 1320 Hz, 100 ms each, with a final sustained 1760 Hz for 300 ms.

### `nautical` — sea-bell + foghorn
- `ding`: two sine oscillators at 880 Hz and 1320 Hz (octave + fifth), longer 1.2 s decay — bell-buoy.
- `buzz`: low foghorn approximation — sawtooth at 110 Hz with slow ramp-up amplitude (40 ms) and 400 ms decay. Mournful.
- `fanfare`: bell triad (660, 990, 1320 Hz) layered, 600 ms each, with a foghorn (110 Hz sawtooth) thump at start.

### `fanfare-plus` — extended victory horn
- `ding`: same as default (light, quick). Equal-cost in this theme; only fanfare changes meaningfully.
- `buzz`: same as default.
- `fanfare`: longer sequence — 4-note arpeggio (660 → 880 → 1100 → 1320 Hz, 200 ms each) followed by a sustained chord (660 + 880 + 1100 Hz held 800 ms). Total ~1.6 s. Used after boss clear / week complete.

## Database

### Migration: `drizzle/0007_*.sql`

Two changes:

1. `ALTER TYPE shop_item_kind ADD VALUE 'sound_theme';` (must come first; see PR #30 landmine — runs in its own committed transaction inside `scripts/migrate.ts`).
2. Create `child_settings` table:

```sql
CREATE TABLE child_settings (
  child_id UUID PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  sound_theme_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`sound_theme_slug` is `NULL` by default → renderer treats as `default`. Plain text, no FK, because themes are catalog-defined in TS, not in a DB table.

### Idempotent seed in `scripts/seed-sound-themes.ts`

Inserts 4 `shop_items` rows (`kind='sound_theme'`, prices below). `WHERE NOT EXISTS` guard on slug.

| Slug | Emoji | Name (zh / en) | Price | Description |
|---|---|---|---|---|
| `theme-music-box` | 🎼 | 音乐盒 / Music Box | 200 | Mellow chimes for every right answer. |
| `theme-retro-arcade` | 🕹️ | 复古街机 / Retro Arcade | 200 | 8-bit blips like a coin-op. |
| `theme-nautical` | ⚓ | 海上钟 / Nautical | 250 | Sea bells and a foghorn for misses. |
| `theme-fanfare-plus` | 🎺 | 加长号角 / Fanfare Plus | 300 | Extended victory horn after boss + perfect week. |

Emoji is the visual on `ShopItemCard` (sound items don't ship procedural-SVG previews, just a single chunky emoji). Stored in `shop_items.image_url` as the literal emoji string (existing convention — flags + zodiac all use emoji strings here).

## Code shape

### New files
- `src/db/schema/settings.ts` — Drizzle table.
- `src/lib/audio/themes/index.ts` — registry + `getTheme()`.
- `src/lib/audio/themes/default.ts` — re-exports from `sounds.ts`.
- `src/lib/audio/themes/music-box.ts`
- `src/lib/audio/themes/retro-arcade.ts`
- `src/lib/audio/themes/nautical.ts`
- `src/lib/audio/themes/fanfare-plus.ts`
- `src/lib/db/settings.ts` — `getChildSettings`, `setSoundTheme`.
- `src/lib/actions/settings.ts` — `equipSoundThemeAction`.
- `src/components/shop/SoundsTabBody.tsx` — Sounds tab content.
- `scripts/seed-sound-themes.ts` — idempotent seed.
- Tests: `tests/unit/audio-themes.test.ts`, `tests/unit/settings-action.test.ts`, `tests/unit/sounds-tab-body.test.tsx`.

### Modified
- `src/lib/audio/play.ts` — handlers map becomes mutable; add `setAudioTheme(slug)`.
- `src/db/schema/economy.ts` — append `'sound_theme'` to `shopItemKind` enum.
- `src/db/schema/index.ts` — export `childSettings`.
- `src/app/play/[childId]/layout.tsx` — fetch child settings on mount, call `setAudioTheme(settings.soundThemeSlug)` once.
- `src/components/shop/ShopCategoryTabs.tsx` + `src/app/play/[childId]/shop/ShopBody.tsx` — Sounds tab routes to `SoundsTabBody` instead of placeholder.
- `src/components/shop/ShopItemCard.tsx` — accept optional `previewAction` prop.
- `src/lib/db/shop.ts` — extend `listShopItems` filter / add `listSoundThemes(childId)`.
- `CLAUDE.md` — bump + new PR #31 bullet.

## Auth + ownership

- A child can only equip a theme they own (i.e., a `shop_purchases` row exists for that `shop_items.id`).
- `'default'` is always allowed (effectively "unequip back to default").
- `equipSoundThemeAction` validates this server-side; the action throws `UnownedItemError` (already exists in `src/lib/errors/shop-errors.ts`).

## Verification

Before opening PR:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev` → buy a theme from Sounds tab → answer a level → confirm new ding plays.
3. Re-equip default → confirm old ding returns.
4. Try to call `equipSoundThemeAction(childId, 'theme-nautical')` for an unowned slug — confirm it throws.
5. With `prefers-reduced-motion` set, theme equip still works (audio is independent of motion). Confirm `setAudioMuted(true)` still silences all themes.
6. After merge: no recompile needed (themes are runtime-only, no week_levels mutations).

## Open follow-ups (not blocking)

- A volume slider in settings (separate `audioVolume` column on `child_settings`).
- Per-theme `cardPreviewSnippet` that plays all three sounds in sequence (currently just ding).
- A "Surprise theme" item that rotates among the 4 randomly per session — would be a fun easter egg.
- TTS voice selection — if Yinuo finds the default browser voice grating, a theme-tagged voice could pair with each sound theme.
