# Juice Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved H1 bundle — S1 streak pitch-ramp, S2 boss signature sounds, A1 holo shimmer on limited cards, A4 home-avatar idle — all procedural, no deps/DB.

**Architecture:** S1 lives entirely in the audio layer (`play.ts` streak state + a widened optional `ding(ctx, pitchMult?)`). S2 is a new `boss.ts` cue module sharing `play.ts`'s context/mute state, fired from `BossScene`'s phase machine. A1/A4 are CSS keyframes in `globals.css` plus one tiny wrapper component / one wrapper class at call sites.

**Tech Stack:** WebAudio, Tailwind/CSS keyframes, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-07-06-juice-pass-design.md`

## Global Constraints

- Procedural only: no new deps, no DB, no migration, no assets.
- Reduced-motion: audio already muted via `setAudioMuted`; CSS effects disabled via `@media (prefers-reduced-motion: reduce)` — pure CSS, no JS probes.
- `SoundTheme.ding` widening must be backward-compatible (optional param, default 1) — existing tests must stay green.
- Shimmer gate = `owned && SHARD_SWAP_EXCLUSIVE_PACKS.has(packSlug)` (client-safe import from `@/lib/economy/shards`).
- `AvatarRender` itself untouched (A4 is a call-site wrapper class on the home HUD only).
- All four gates green at PR open. Branch `feat/juice-pass` (created; spec committed).

## Verified integration points

- `src/lib/audio/themes/index.ts` `ThemeHandlers { ding/buzz/fanfare: (ctx) => void }`; 5 themes; `getTheme(slug)`.
- `src/lib/audio/play.ts` `playSound(name)` — module-level `ctx`/`muted`.
- Roster keys (`boss-roster.ts`): kraken, giant-crab, anglerfish, sea-serpent, shark, jelly-swarm, electric-eel, giant-clam, sea-dragon, whirlpool. `BossScene` has `creature.key` (line ~71) + `flinch()`/`win()`/intro effect.
- `PackPageBody.tsx` `PackTile` renders `<Card item={item} owned={isOwned} …/>` (~line 112); dialog at ~330. `CardChestReveal` in `src/components/scenes/fx/`.
- Home HUD avatar: `src/app/play/[childId]/page.tsx` ~line 185.

---

### Task 1: S1 — streak pitch-ramp

**Files:** Modify `src/lib/audio/themes/index.ts` (interface), all 5 theme files, `src/lib/audio/play.ts`, `src/lib/audio/sounds.ts` (default ding). Test: `tests/unit/audio-streak.test.ts`.

**Interfaces produced:** `streakPitchMult(streak: number): number` and `resetDingStreak()` exported from `play.ts`; `ThemeHandlers.ding: (ctx, pitchMult?: number) => void`.

- [ ] Write failing tests:

```ts
// tests/unit/audio-streak.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playSound, resetDingStreak, setAudioMuted, streakPitchMult } from '@/lib/audio/play';

const ding = vi.fn();
vi.mock('@/lib/audio/themes', () => ({
  getTheme: () => ({ ding, buzz: vi.fn(), fanfare: vi.fn() }),
}));

class FakeCtx { state = 'running'; resume = vi.fn(); }
vi.stubGlobal('AudioContext', FakeCtx as unknown as typeof AudioContext);

describe('streakPitchMult', () => {
  it('ramps 2 semitones per consecutive correct, capped at +8', () => {
    expect(streakPitchMult(1)).toBeCloseTo(1);
    expect(streakPitchMult(2)).toBeCloseTo(2 ** (2 / 12));
    expect(streakPitchMult(5)).toBeCloseTo(2 ** (8 / 12));
    expect(streakPitchMult(9)).toBeCloseTo(2 ** (8 / 12)); // cap
  });
});

describe('playSound streak state', () => {
  beforeEach(() => { ding.mockClear(); resetDingStreak(); setAudioMuted(false); });
  it('ding pitch rises with consecutive dings and buzz resets it', () => {
    playSound('ding');
    playSound('ding');
    expect(ding.mock.calls[0][1]).toBeCloseTo(1);
    expect(ding.mock.calls[1][1]).toBeCloseTo(2 ** (2 / 12));
    playSound('buzz');
    playSound('ding');
    expect(ding.mock.calls[2][1]).toBeCloseTo(1);
  });
});
```

- [ ] FAIL run → implement: `play.ts` adds `let dingStreak = 0`; in `playSound`: `'ding'` → `dingStreak += 1; theme.ding(c, streakPitchMult(dingStreak))`; `'buzz' | 'fanfare'` → `dingStreak = 0; theme[name](c)`. Export `streakPitchMult = (s) => 2 ** ((2 * Math.min(Math.max(s - 1, 0), 4)) / 12)` and `resetDingStreak()`. Widen `ThemeHandlers.ding` to `(ctx, pitchMult?: number) => void`; in each theme's ding, `const m = pitchMult ?? 1` and multiply every frequency constant by `m` (default theme delegates to `playDing(ctx, m)` in `sounds.ts` — widen it the same way).
- [ ] PASS run + `pnpm vitest run tests/unit --silent` (existing audio/theme tests green) + typecheck.
- [ ] Commit: `feat(audio): streak pitch-ramp — consecutive correct answers raise the ding (S1)`

### Task 2: S2 — boss signature sounds

**Files:** Create `src/lib/audio/boss.ts`; modify `src/lib/audio/play.ts` (export `getSharedAudio`), `src/components/scenes/BossScene.tsx`. Test: `tests/unit/audio-boss.test.ts`.

**Interfaces produced:** `playBossCue(creatureKey: string, kind: 'intro' | 'damage' | 'defeat'): void`; pure `familyForCreature(key: string): 'growl' | 'bubble' | 'zap' | 'snap'`; `getSharedAudio(): { ctx: AudioContext | null; muted: boolean }` from play.ts.

- [ ] Failing tests: `familyForCreature` mapping (kraken→growl, jelly-swarm→bubble, electric-eel→zap, giant-crab→snap, unknown→growl); `playBossCue` no-ops when muted/ctx-null (mock `@/lib/audio/play`'s `getSharedAudio`).
- [ ] Implement `boss.ts`: family map `{growl: [kraken, sea-serpent, sea-dragon], bubble: [jelly-swarm, giant-clam, whirlpool], zap: [electric-eel, anglerfish], snap: [giant-crab, shark]}`; per family × kind, small WebAudio recipes (osc sweeps for growl/zap, filtered-noise bursts for bubble/snap; peak gain ≤0.15, duration ≤1.2s intro / ≤0.4s damage / ≤1.2s defeat). `playBossCue` reads `getSharedAudio()`, returns early on muted/null.
- [ ] Wire `BossScene`: intro effect → `playBossCue(creature.key, 'intro')` (inside the existing `phase === 'intro'` effect); `flinch()` → `'damage'`; `win()` → `'defeat'`.
- [ ] PASS + full suite (BossScene tests must stay green — cues are fire-and-forget, guard with try/catch inside `playBossCue`).
- [ ] Commit: `feat(audio): per-creature boss battle cues (S2)`

### Task 3: A1 — holo shimmer

**Files:** Create `src/components/play/items/HoloShimmer.tsx`; modify `src/app/globals.css` (keyframes `holo-sweep` + `.holo-overlay` + reduced-motion block), `src/components/play/PackPageBody.tsx` (PackTile + detail dialog gate), `src/components/scenes/fx/CardChestReveal.tsx`. Test: `tests/unit/holo-shimmer.test.tsx`.

**Interfaces produced:** `<HoloShimmer active className?>` — when `active`, wraps children in `relative overflow-hidden` div + gradient overlay `data-testid="holo-overlay"`; when not, renders children in a plain passthrough div.

- [ ] Failing tests: renders overlay when `active`, none when not; `isLimitedPack` helper (`packSlug → SHARD_SWAP_EXCLUSIVE_PACKS.has(slug)`) true for `festivals-v1`/`season-summer-v1`/`champions-v1`, false for `flags-v1`.
- [ ] Implement: overlay = absolutely-positioned rotated gradient band (`background: linear-gradient(105deg, transparent 40%, rgba(255,0,255,.13) 45%, rgba(0,255,255,.18) 50%, rgba(255,255,0,.13) 55%, transparent 60%)`, `background-size: 250% 250%`, `animation: holo-sweep 3s linear infinite`; reduced-motion → `animation: none` + static `opacity: .5`). Export `isLimitedPack(slug)` from `HoloShimmer.tsx` (thin client-safe wrapper over the shards set). Gate at the 3 surfaces: PackTile card face, CardChestReveal revealed card, CardDetailDialog owned view — `<HoloShimmer active={owned && isLimitedPack(packSlug)}>`.
- [ ] PASS + full suite; commit: `feat(cards): holo shimmer on owned limited-pack cards (A1)`

### Task 4: A4 — home-avatar idle + docs + PR

**Files:** Modify `src/app/globals.css` (keyframes `avatar-idle` + `.animate-avatar-idle` + reduced-motion), `src/app/play/[childId]/page.tsx` (~line 185 wrapper). Test: `tests/unit/avatar-idle.test.tsx` (a thin render test of a wrapper div with the class is low-value — instead assert the class exists in the page source via a source-level test like the bilingual guard, OR skip a dedicated test and rely on the css being inert; choose the source-level grep test). Docs: CLAUDE.md snapshot line + roadmap H1 partial tick (S1/S2/A1/A4 shipped; S3/S4/A2/A3/A5 remain).

- [ ] Implement keyframes: `@keyframes avatar-idle { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-2px) rotate(0.8deg) scaleY(0.997); } 50% { transform: translateY(0); } 75% { transform: translateY(-1.5px) rotate(-0.8deg); } }`, class `.animate-avatar-idle { animation: avatar-idle 3.2s ease-in-out infinite; }`, reduced-motion → none. Wrap the home HUD `AvatarRender` in `<div className="animate-avatar-idle">`.
- [ ] Source-guard test asserting the home page applies `animate-avatar-idle` and globals.css defines it with a reduced-motion override.
- [ ] Full gates (`typecheck/lint/test/build`), docs updates, push, PR `feat: juice pass — streak pitch, boss cues, holo cards, avatar idle (H1)`, auto-merge on green per session pattern.

## Self-review

Spec S1→T1, S2→T2, A1→T3, A4→T4, testing section distributed, out-of-scope respected. Names consistent (`streakPitchMult`/`resetDingStreak`/`getSharedAudio`/`playBossCue`/`familyForCreature`/`isLimitedPack`). No placeholders (Task 2 recipes specified by family/kind envelope constraints — implementer freedom over exact frequencies is intended).
