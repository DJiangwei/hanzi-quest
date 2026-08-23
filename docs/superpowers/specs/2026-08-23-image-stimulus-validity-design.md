# 看图找字 stimulus validity — design

**Date:** 2026-08-23
**Status:** approved in outline (David, 2026-08-23)
**Trigger:** David played week 7 and hit a 看图找字 showing balloons, answer 七, with the wrong number of balloons in the picture.

---

## 1. Root cause

**The pipeline has never had a notion of whether a picture *can* identify a character.**

`image_pick` stores only `characterId` in `week_levels.scene_config`, and resolves the picture at render time with:

```ts
const word = words?.find((w) => w.imageUrl) ?? null;   // src/lib/scenes/stimulus.ts
```

The first word that happens to have an image wins. There is no selection and no validation. Meanwhile `sampleDistractors(pool, target, n)` draws the wrong answers from the same week's characters.

Note the contrast: `image_word` already compiles its chosen `wordId` into `scene_config`. `image_pick` does not — which is precisely why nothing could ever check it.

## 2. Two failure modes, both live, both measured

### A. Count-dependent stimuli — diffusion cannot render an exact quantity

The curriculum teaches exactly **one number per week, weeks 1–10** (一 二 三 四 五 六 七 八 九 十). All 30 of their words hinge on a cardinality:

- 七个 → *"seven colorful balloons floating in a bright blue sky"*
- 三个 → *"three colorful balloons floating in the air"*
- 六个 → *"six bright red apples arranged in a row"*

flux/Pollinations render *some* balloons. A six-year-old counts them, and the count disagrees with the answer — which teaches the wrong thing, worse than a vague picture.

The starkest case is **一起**, whose hook is *"**two** happy children holding hands"* — for the character **一**. The child sees two; the answer is one.

**So every week of Map 1 has at least one broken 看图找字.**

### B. Ambiguous stimuli — one picture, two valid answers

Ten words are linked to **two characters taught in the same week**:

| Week | Word | Characters |
|---|---|---|
| 1 | 大人 | 人 / 大 |
| 2 | 二月 · 太阳 · 月亮 · 爸妈 | 二/月 · 太/阳 · 亮/月 · 妈/爸 |
| 3 | 火山 | 山 / 火 |
| 7 | 唱歌 · 多少 | 唱/歌 · 多/少 |
| 8 | 朋友 · 小朋友 | 友 / 朋 |

Because distractors come from the same week's pool, a scene can show the 唱歌 picture, mark 唱 correct, and offer 歌 as a choice. **There is no correct answer.** This is worse than a miscounted picture: it is unanswerable rather than merely inaccurate.

This affects `image_pick` only. `image_word` (看图选词) is unaffected — its answer is a *word*, and 唱歌 is unambiguous as a word.

## 3. Design

### Layer 1 — stimulus validity becomes a computed property, enforced at compile time

Two disqualifiers, both mechanically decidable, no judgement:

1. **Ambiguous** — the word is linked to ≥2 characters taught in the same week.
2. **Count-dependent** — the target character is a number, or the hook's meaning hinges on a cardinality.

`compile-week` then:
- picks `image_pick` targets only from characters with ≥1 valid stimulus word, and
- **compiles the chosen `wordId` into `scene_config`**, so the selection is frozen and auditable.

`pickStimulusImage` resolves the *compiled* word rather than "the first with a URL".

**This does not violate the runtime-image landmine.** `words.image_url` still resolves at render time, so backfilling or regenerating art still needs no recompile. What gets frozen is *which word*, not *where its picture lives*.

**Measured cost: zero.** All 86 non-number characters retain at least one unambiguous word that already has an image. No character loses 看图找字 eligibility.

### Layer 2 — numbers get procedural counting cards instead of exclusion

Excluding numbers would cost them the exercise. But a number is the one case where a picture can be **perfectly** correct: draw exactly N identical objects.

- Deterministic, correct by construction, and **counting them is exactly the learning**.
- The repo is already full of procedural SVG (zodiac icons, boss creatures, home furniture, avatar slots) — this is an established pattern, not a new one.
- **Balloons**, reusing the imagery the existing hooks already lean on (三个/五个/七个 are all balloons), so the child meets something familiar. Distinct colours, arranged in a countable formation, legible from 1 to 10.

A number character's `image_pick` renders the counting card and never a diffusion image.

### Layer 3 — a verification script closes the loop for future authoring

`scripts/verify-stimulus-integrity.ts`, in the style of `verify-integrity.ts`: read-only, exits non-zero if any compiled `image_pick` level would render an ambiguous or count-dependent stimulus.

The DeepSeek authoring prompt also gains a line forbidding count-dependent hooks — but that is best-effort only. CLAUDE.md already records that DeepSeek does not reliably obey such constraints, so **the script is the actual guard**; the prompt just reduces how often it fires.

## 4. Non-goals

- Re-generating any existing art. The fix is selection and rendering, not new images. Zero Blob spend.
- Validating images with a vision model. Expensive, and unnecessary once the two mechanical disqualifiers are enforced.
- Touching `image_word`, which is unaffected.
- Re-keying `characters` or any schema change. This needs no migration.

## 5. Post-merge

**`scripts/recompile-all-weeks.ts` is required** — `image_pick`'s `scene_config` shape changes (it gains `wordId`). Stable level keys preserve `scene_attempts.week_level_id`, verified on this exact path earlier today when weeks 9 and 10 gained bosses.

## 6. Success criteria

1. No `image_pick` anywhere shows a picture whose word maps to another character in the same week.
2. Every number character's 看图找字 shows exactly N balloons, N matching the character.
3. All 96 characters keep 看图找字 eligibility.
4. `verify-stimulus-integrity.ts` passes against prod and fails if a bad stimulus is reintroduced.
5. Four-green; `scene_attempts` count unchanged across the recompile.
