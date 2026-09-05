# Map 2 (里海 / Caspian Sea) — authoring runbook

**Status:** prepped & waiting on David's 10 weeks of characters. Map 2 plays with
**identical game-design logic to Map 1** — the compile (`compileWeekIntoLevels`)
and AI scene-gen (`generateWeekContent`) code is **pack-agnostic**, so nothing
about the gameplay differs; only the pack + the character list differ.

## What's already ready (no work needed)

- **Pack exists:** `pirate-class-level-2` (里海 / Caspian Sea) is seeded as a
  real row; it currently shows as a **locked** card on `/maps` because it has 0
  weeks. `isLocked = weekCount === 0` — so it **auto-unlocks** the moment its
  first week is published. No code change to unlock.
- **Keys present** in `.env.local`: `DEEPSEEK_API_KEY` (AI content-gen),
  `CF_ACCOUNT_ID` / `CF_API_TOKEN` (images), `BLOB_READ_WRITE_TOKEN` (upload).
- **Seed script ready:** `scripts/seed-pirate-class-2.ts` — a 1:1 clone of the
  Map 1 seeder scoped to `pirate-class-level-2`, with an empty `LESSONS` array +
  a guard that refuses to run until it's filled.
- **Image script ready:** `scripts/backfill-word-images-cloudflare.ts` — fills
  word pictures via Cloudflare flux (reliable; the in-authoring Pollinations path
  is flaky, which is why new weeks otherwise land with NULL `image_url`).

## The only input needed from David

The **10 weeks of characters** — same shape as Map 1: one entry per week, each a
list of hanzi (8–10 per week). Example (Map 1, Lesson 1):

```
{ label: 'Lesson 1', characters: ['人', '口', '大', '中', '小', '哭', '笑', '一', '上', '下'] },
```

Everything else (per-character pinyin, meanings, example words, example
sentences, image descriptions) is **AI-generated** from the characters, exactly
as Map 1 was.

## Run sequence (once the characters are provided)

1. Paste the 10 weeks into the `LESSONS` array in `scripts/seed-pirate-class-2.ts`.
2. `pnpm tsx scripts/seed-pirate-class-2.ts`
   — per week: create → AI-gen content → compile → publish. ~30 min serial,
   ~$0.05 DeepSeek. Idempotent (re-runnable; skips already-published weeks).
3. `pnpm tsx scripts/backfill-word-images-cloudflare.ts`
   — generates a picture for every new word (CF flux → Blob → `words.image_url`).
4. Verify: `/maps` now shows 里海 **unlocked**; tap a week → review/practice/
   boss play identically to Map 1, with pictures in 看图找字 / 看图选词.

## Notes

- Map 2 weeks are **shared-pack** rows (`parent_user_id = NULL`, `child_id =
  NULL`) like Map 1 — any child whose current map is 里海 can play them.
- A child switches to Map 2 from the in-app `/maps` gateway (`switchMapAction`).
- Recompile is automatic inside the seeder; no separate `recompile-all-weeks`
  needed for the new pack.


---

## Authoring log — 里海 content (2026-09-05)

Ran end to end; recording what the runbook did not predict.

**Two-phase publish.** `seed-pirate-class-2.ts` now stops at `awaiting_review`
unless `PUBLISH=1`. Publishing is what makes a week live AND unlocks the map,
so unreviewed AI output must not reach it by default. The script's own resume
logic makes the second phase free — a week already at `awaiting_review` skips
AI generation, so the publish pass ran with **0** regenerations.

**The AI SDK will not retry a dropped connection.** The first run died on week 1:
DeepSeek returned HTTP 200, then the body terminated with `ECONNRESET`, and the
error carried `isRetryable: false` — a 200 that fails afterwards is not a status
the SDK classifies as retryable, so its own retry never fired. deepseek-v4-pro
is a reasoning model (measured: 116 reasoning tokens against 26 of visible text),
which makes each week one long call and long calls the ones that get dropped.
`withRetry` in the seed script covers it. The admin authoring path
(`/admin/week/new`) calls the same `generateWeekContent` and is still unguarded.

**Review caught four things worth fixing, one of them a real error:** 教 was
labelled `jiāo` while two of its three words (教室, 教师) read `jiào` — she would
have read the words in the wrong tone. Also a degenerate word (他 → "他"), an
over-long one (公共汽车) and two obscure ones (哈密瓜, 哈哈镜). **Editing words
requires recompiling those weeks** — `image_pick` freezes its `wordId` into
`scene_config` at compile time (PR #158), so an un-recompiled week still points
at the unlinked word.

**Cloudflare's daily neuron cap is the real limit on art, not Blob.** 125 images
exhausted the day's 10,000 free neurons; 115 failed with 429. Budget ~125
images/day and expect a 10-week pass to span two days.
