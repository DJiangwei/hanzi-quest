# Juice Pass (H1: S1+S2+A1+A4) — Design

**Date:** 2026-07-06 · **Status:** approved by David · **Roadmap ref:** `docs/IMPROVEMENT-ROADMAP.md` §P2-H / H1 (recommended bundle)

## Scope

Four game-feel upgrades, all procedural (WebAudio/CSS only), no deps, no DB, no migration, reduced-motion safe:

### S1 — Streak pitch-ramp
- `src/lib/audio/play.ts` keeps a module-level `streak` counter: `playSound('ding')` increments it AND derives `pitchMult = 2 ** ((2 * Math.min(streak - 1, 4)) / 12)` (up 2 semitones per consecutive correct, capped at +8 semitones); `'buzz'` and `'fanfare'` reset it to 0. No call-site changes anywhere.
- `SoundTheme.ding` signature widens to `(ctx, pitchMult?: number)` (default 1). All 5 themes (`default`, `music-box`, `retro-arcade`, `nautical`, `fanfare-plus`) multiply their ding note frequencies by it. `buzz`/`fanfare` unchanged.
- Streak persists across scenes within the tab (a session-feel feature); resets naturally on any wrong answer or level fanfare. Pure helper `streakPitchMult(streak: number): number` exported for tests.

### S2 — Boss signature sounds
- New `src/lib/audio/boss.ts`: `playBossCue(creatureKey: string, kind: 'intro' | 'damage' | 'defeat')`.
- 4 procedural sound families, mapped over the 10 roster keys (`boss-roster.ts` keys): **growl** (kraken, sea-serpent, sea-dragon) · **bubble** (jelly-swarm, giant-clam, whirlpool) · **zap** (electric-eel, anglerfish) · **snap** (crab, shark). Unknown key → growl (future creatures degrade gracefully). Pure `familyForCreature(key)` exported for tests.
- Each family implements the 3 kinds with WebAudio primitives (oscillator sweeps, filtered noise bursts) at modest gain (≤0.15 peak, ≤1.2s).
- `play.ts` exports `getSharedAudio(): { ctx: AudioContext | null; muted: boolean }` (internal accessors) so boss cues share the same context + mute state (reduced-motion already mutes via `setAudioMuted`).
- Wired in `BossScene`: intro effect fires `intro`; `flinch()` fires `damage`; `win()` fires `defeat`; entering the `defeated` (loss) phase fires nothing new (the existing buzz already played).

### A1 — Holo shimmer on limited cards
- New `src/components/play/items/HoloShimmer.tsx`: client wrapper `<HoloShimmer active>` rendering children plus, when `active`, an absolutely-positioned overflow-hidden overlay with a rotated translucent rainbow gradient band animated across on a ~3s loop (`globals.css` keyframes `holo-sweep`); `prefers-reduced-motion` → animation disabled, static subtle iridescent tint remains (pure CSS media query — no JS probe).
- `active` gate at call sites: `owned && SHARD_SWAP_EXCLUSIVE_PACKS.has(packSlug)` (client-safe set from `src/lib/economy/shards.ts` — festivals-v1, season-summer-v1, champions-v1).
- Surfaces: `PackTile` (in `PackPageBody.tsx`), `CardChestReveal` (revealed card face), `CardDetailDialog` (owned view). Unowned cards never shimmer.

### A4 — Avatar idle (home HUD only)
- `globals.css` keyframes `avatar-idle`: gentle breathing bob (translateY ±2px + scaleY 0.995) on a 3s ease-in-out loop with a subtle 1.5° tilt phase every other cycle (single keyframe track); `prefers-reduced-motion` → none.
- Applied via a wrapper class at the HOME page HUD avatar usage site only (`src/app/play/[childId]/page.tsx` header). `AvatarRender` itself untouched — shop previews, wardrobe minis, reveals stay static. No eyelid blink (fragile across 7 head variants; deliberately dropped).

## Testing (~10 unit tests)
- `streakPitchMult` ramp + cap; play.ts streak reset semantics (ding/ding/buzz/ding sequencing via a mocked theme).
- `familyForCreature` mapping incl. unknown-key fallback.
- `HoloShimmer` renders overlay when active, nothing extra when not; call-site gating (limited pack shimmer, regular pack none) via a `PackTile`-level test.
- Home HUD wrapper class presence.

## Out of scope
S3 reveal stingers, S4 sea ambience, A2 voyage life, A3 boss hit-flash, A5 mastery sparkle (remain on the H1 menu); any sound-theme shop changes.
