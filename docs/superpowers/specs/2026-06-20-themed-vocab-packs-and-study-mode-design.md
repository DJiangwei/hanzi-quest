# Themed Vocab Packs + Study Mode — Design

**Date:** 2026-06-20
**Status:** Approved design (pending David's spec review → implementation plan)

## Overview

Two linked deliverables that turn the Backpack from a passive sticker album into an active vocabulary-learning surface, anchored to what Yinuo studies at her UK primary school (Key Stage 1):

1. **4 new themed collectible packs** — 🚒 Transport · 🦋 Minibeasts · 🎻 Instruments · 🐶 Animals — each a bilingual card set (~12–18 cards) built so its words double as a vocab lesson.
2. **Study Mode** — a 📖 学习 button on every pack page that runs a short *picture + audio + meaning* lesson from the cards the child already owns, and rewards completion with a card from that pack.

**Build order (David's decision): packs first, then Study Mode.** Study Mode is engine-only and works on *any* pack (the 8 existing packs included), so it can ship last and immediately enriches the whole collection.

**Pedagogical frame.** Pack words (二胡, 瓢虫, 直升机…) use characters *outside* the weekly hanzi curriculum. So Study Mode is a **vocabulary/listening track** — recognition by picture, sound, and English meaning — running *parallel* to the rigorous weekly *character-mastery* track. Hanzi and pinyin are shown for exposure but are **never the thing being tested**.

---

## Part 1 — The 4 new packs

### How a pack is added (existing pattern, reused verbatim)

Each pack follows the established recipe (see `landmarks-v1`, PR #76+):

- **Data file** `src/lib/collections/<name>Data.ts` — array of `{ slug, nameZh, nameEn, emoji, loreZh, loreEn }` (+ optional grouping field), plus a `BY_SLUG` map.
- **Card component** `src/components/play/items/<X>Card.tsx` — mirrors `LandmarkCard`: renders `<CardArt>` (real image when `image_url` is set, else emoji glyph), bilingual name, optional category badge, lore at `size="lg"`. Unowned → `opacity-40 grayscale`.
- **Registry entry** in `src/lib/collections/packRegistry.ts` — `PackUiMeta` with `themeEmoji`, bilingual display name + slogan, `paidPullCost` (legacy field, set to the standard regular-pack value), `ItemCard`, and optional `grouping`.
- **Seed script** `scripts/seed-<name>-pack.ts` — idempotent insert-missing into `collection_packs` (`is_active=true`, `gacha_eligible=true`) + `collectible_items`. Follows `loadEnv()` + dynamic `@/db` import.
- **Art** — appended to `scripts/generate-collectible-art-cloudflare.ts` (per-pack subject recipe using `UNIFIED_ART_STYLE`), uploaded to Blob `collectibles/{itemId}.jpg`, written to `collectible_items.image_url`.

No DB migration is needed — these are data rows in existing tables, rendered via the existing `CardArt` / pack registry machinery. The packs are **gacha-eligible** (`gacha_eligible=true`) so they also flow through boss/perfect/gift card grants like the other regular packs.

### Card lists (David-tunable)

Emoji is the fallback glyph; real CF-flux art is the primary visual.

**🚒 交通工具 / Transport** — grouped by 陆地 / 水上 / 天空 (land / water / air) for a KS1-style sorting feel.

| slug | 中文 | English | emoji | group |
|---|---|---|---|---|
| car | 汽车 | Car | 🚗 | land |
| bus | 公共汽车 | Bus | 🚌 | land |
| train | 火车 | Train | 🚆 | land |
| bicycle | 自行车 | Bicycle | 🚲 | land |
| motorbike | 摩托车 | Motorbike | 🏍️ | land |
| fire-engine | 消防车 | Fire engine | 🚒 | land |
| ambulance | 救护车 | Ambulance | 🚑 | land |
| police-car | 警车 | Police car | 🚓 | land |
| truck | 卡车 | Truck | 🚚 | land |
| ship | 轮船 | Ship | 🚢 | water |
| sailboat | 帆船 | Sailboat | ⛵ | water |
| airplane | 飞机 | Airplane | ✈️ | air |
| helicopter | 直升机 | Helicopter | 🚁 | air |
| hot-air-balloon | 热气球 | Hot-air balloon | 🎈 | air |

**🦋 昆虫 / Minibeasts** — the classic KS1 minibeast-hunt set (kept friendly, no scary ones).

| slug | 中文 | English | emoji |
|---|---|---|---|
| butterfly | 蝴蝶 | Butterfly | 🦋 |
| bee | 蜜蜂 | Bee | 🐝 |
| ladybird | 瓢虫 | Ladybird | 🐞 |
| ant | 蚂蚁 | Ant | 🐜 |
| spider | 蜘蛛 | Spider | 🕷️ |
| snail | 蜗牛 | Snail | 🐌 |
| caterpillar | 毛毛虫 | Caterpillar | 🐛 |
| dragonfly | 蜻蜓 | Dragonfly | 🪰 |
| grasshopper | 蚱蜢 | Grasshopper | 🦗 |
| beetle | 甲虫 | Beetle | 🪲 |
| earthworm | 蚯蚓 | Earthworm | 🪱 |
| woodlouse | 鼠妇 | Woodlouse | 🪨 |

**🎻 乐器 / Instruments** — grouped 西洋乐器 / 民族乐器 (Western / Chinese) as a culture bridge.

| slug | 中文 | English | emoji | group |
|---|---|---|---|---|
| piano | 钢琴 | Piano | 🎹 | western |
| violin | 小提琴 | Violin | 🎻 | western |
| guitar | 吉他 | Guitar | 🎸 | western |
| drum | 鼓 | Drum | 🥁 | western |
| flute | 长笛 | Flute | 🪈 | western |
| trumpet | 小号 | Trumpet | 🎺 | western |
| saxophone | 萨克斯 | Saxophone | 🎷 | western |
| xylophone | 木琴 | Xylophone | 🎼 | western |
| erhu | 二胡 | Erhu | 🎻 | chinese |
| pipa | 琵琶 | Pipa | 🪕 | chinese |
| guzheng | 古筝 | Guzheng | 🎵 | chinese |
| dizi | 笛子 | Bamboo flute | 🪈 | chinese |
| gong | 锣 | Gong | 🥁 | chinese |

**🐶 动物 / Animals** — pet + woodland + zoo. **Deliberately excludes the 12 zodiac animals** (鼠/牛/虎/兔/龙/蛇/马/羊/猴/鸡/狗/猪) so it never duplicates the zodiac pack; filled instead with animals common in the English-speaking world. No overlap with the sea-creatures pack (those are ocean animals).

| slug | 中文 | English | emoji | kind |
|---|---|---|---|---|
| cat | 猫 | Cat | 🐱 | pet |
| duck | 鸭子 | Duck | 🦆 | pet/farm |
| goose | 鹅 | Goose | 🪿 | pet/farm |
| hamster | 仓鼠 | Hamster | 🐹 | pet |
| goldfish | 金鱼 | Goldfish | 🐠 | pet |
| tortoise | 乌龟 | Tortoise | 🐢 | pet |
| parrot | 鹦鹉 | Parrot | 🦜 | pet |
| fox | 狐狸 | Fox | 🦊 | woodland |
| squirrel | 松鼠 | Squirrel | 🐿️ | woodland |
| hedgehog | 刺猬 | Hedgehog | 🦔 | woodland |
| owl | 猫头鹰 | Owl | 🦉 | woodland |
| bear | 熊 | Bear | 🐻 | zoo |
| panda | 熊猫 | Panda | 🐼 | zoo |
| elephant | 大象 | Elephant | 🐘 | zoo |
| lion | 狮子 | Lion | 🦁 | zoo |
| giraffe | 长颈鹿 | Giraffe | 🦒 | zoo |
| penguin | 企鹅 | Penguin | 🐧 | zoo |

Lore (`loreZh` / `loreEn`) is one friendly bilingual sentence per card, authored at implementation time (controller-authored static, like flags/landmarks — not a runtime AI call).

### Art generation + Blob budget

- ~56 cards total (Transport 14 · Minibeasts 12 · Instruments 13 · Animals 17) → ~56 CF-flux gens + ~56 Blob `put`s, **one deliberate run** with the `SKIP_UPLOADED_AFTER` resume flag and explicit `token:` (per PR #99). CF free tier (~300 flux/day) covers it in one sitting; Blob spend is ~55 Advanced Ops against the 2,000/mo cap — acceptable as a single planned run, **never bulk-regenerated**.
- Per-slug NSFW overrides (`SUBJECT_OVERRIDE`) added as needed (flux's filter trips on some animal/insect prompts).
- Cards ship functional immediately with emoji fallback; art populates `image_url` post-generation with no recompile.

---

## Part 2 — Study Mode

### Loop (locked)

```
Own ≥3 cards in a pack  →  📖 学习 unlocks
  →  lesson = ~6 questions built from OWNED cards
  →  finish with a passing score
  →  guaranteed 1 card from that pack (new card, or dupe → shard)
        · max 1 per pack per UTC day (new guard)
        · still counts against the shared 10-cards/day cap
  →  + a little XP, daily-quest hooks fire
  →  new card expands what you can study next time
```

### Entry & route

- A 📖 **学习 / Study** button on the pack page (`PackPageBody`), enabled only when the child owns ≥3 cards in that pack; below that it reads `收集 3 张即可学习 / Collect 3 to study` (bilingual, `bi()` helper).
- New route `src/app/play/[childId]/collection/[packSlug]/study/page.tsx` → renders a `StudyRunner` client component. Server page resolves owned items + builds the question pool (server-side, like the homework/section pages), passing plain data to the client (never the `PackUiMeta` object — RSC hazard).

### Lesson content & activities

- Pool = the child's **owned** `collectible_items` in the pack (resolved via the existing collection ownership query).
- ~6 questions, each randomly one of two types (both reuse the existing scene engine / `MultipleChoiceQuiz`):
  - **看图选词** — card art (`CardArt`) as stimulus → 4 choices of `nameZh`; pick the match.
  - **听音选图** — 🔊 button speaks `nameZh` → 4 card-art choices; pick the match. Audio uses **device zh-CN TTS** via the existing `useSpeak(nameZh)` (no `audioUrl`) — collectibles have no MeloTTS clips and we deliberately avoid generating ~55 audio files (Blob budget); multi-syllable device TTS is good on the iPad.
- Distractors drawn from the rest of the pack (owned or not) so wrong answers are plausibly same-theme. Choices shuffled **upstream** with a stable per-question key (MCQ-randomness landmine).
- If fewer than 4 owned cards, top up choices with non-owned pack cards as distractors; if fewer than 6 owned cards, questions may repeat cards (still ≥3 by the unlock gate).
- Picture + audio + meaning only. Hanzi shown on the card; **pinyin/hanzi reading is never the tested discriminator.**

### Reward, limits, idempotency

- On finishing with a **passing score** (≥ the standard scene pass threshold; partial credit, *not* all-or-nothing), call a new server action `finishStudyLessonAction(childId, packSlug, score)`.
- It awards via a **new `'study'` card-grant source**, reusing `pullCardForChild` / `pullCardInTx`:
  - **Per-pack-per-day guard:** idempotency `refId = ${packSlug}:${todayUtcIso()}` in `card_grants_log` (source `'study'`) → at most **1 study card per pack per UTC day**. A same-day repeat returns "今日本图鉴的学习卡片已领取 / Already earned today's study card for this pack" (no error).
  - **Shared daily cap:** the pull still goes through `pullCardInTx`, which reads/writes `child_card_grants_daily` and enforces `DAILY_CARD_CAP = 10`. Hitting it surfaces the existing "今日卡片已发放完毕" message.
- Plus a small **XP** award (new `'study'` XpSource, `safeAwardXp`, guarded fire-and-forget) and the existing quest ticks (`earn_card` is covered automatically because the grant flows through the card path; add a guarded `tickQuestProgressSafe` for any practice-style quest if applicable).
- **No coin firehose** — Study Mode does not award coins.

### New code

- `src/lib/db/study.ts` — pure helpers: build the owned-card pool for a pack; the per-pack-per-day study-card check (delegates to the card-grant log).
- `src/lib/play/card-grants.ts` — extend `CardGrantSource` with `'study'`; add the per-pack-per-day refId path (the function stays a non-`'use server'` server-only helper — isolation landmine).
- `src/lib/db/grants.ts` — `pullCardInTx` source union gains `'study'`.
- `src/lib/actions/study.ts` — `'use server'` `finishStudyLessonAction` (gated by `requireChild`; validates the child owns ≥3 in the pack before granting).
- `src/components/play/StudyRunner.tsx` — `'use client'` lesson runner (builds questions, drives `MultipleChoiceQuiz`, shows a finish screen + `CardChestReveal` for the granted card via the existing reveal queue pattern).
- `src/app/play/[childId]/collection/[packSlug]/study/page.tsx` — server route.
- `PackPageBody` — the 📖 学习 button + unlock gate.

### XP / source enums

- `XpSource` += `'study'`.
- `CardGrantSource` += `'study'`.
- No new coin reason (no coins awarded).

---

## Reuse map (lean on existing systems)

| Need | Reuse |
|---|---|
| Card visuals | `CardArt`, per-pack `ItemCard`, `packRegistry` |
| Card grant + dupe→shard | `pullCardForChild` / `pullCardInTx` / `card_grants_log` / `child_card_grants_daily` |
| Reveal animation | `CardChestReveal` + `SceneRunner`'s reveal queue pattern |
| MCQ scene | `MultipleChoiceQuiz` (look-and-pick) |
| Audio | `useSpeak` / `useSpeechSupported` device zh-CN TTS |
| XP | `awardXp` / `safeAwardXp` |
| Quests | `tickQuestProgressSafe`, `earn_card` |
| Auth | `requireChild` |
| Art pipeline | `generate-collectible-art-cloudflare.ts` + `UNIFIED_ART_STYLE` |
| Bilingual chrome | `bi()` |

---

## Testing strategy (all mock `@/db`, Clerk, `next/*`, `ai`)

- Pack data: every card has bilingual `nameZh`/`nameEn` + emoji; slugs unique; grouping values valid (Transport/Instruments).
- Seed scripts: idempotent (insert-missing); `gacha_eligible=true`.
- `finishStudyLessonAction`: grants on pass; **no second grant same pack same day** (refId dedup); respects daily cap; rejects when child owns <3 (no grant); requires `requireChild`.
- `StudyRunner`: unlock gate at ≥3; builds ~6 questions; choices shuffled with stable key; 听音选图 hides 🔊 when speech unsupported; picture+audio+meaning only (no hanzi-reading discriminator).
- Distribution-isolation guard: `'study'` card-grant path lives in `card-grants.ts` (not a `'use server'` export).

---

## Out of scope (explicit deferrals)

- Pack-specific MeloTTS audio clips (use device TTS).
- Writing/stroke practice, tone games, speaking (separate enrichment directions — parked).
- Curriculum-aligned weekly-hanzi authoring (a separate, low-tech authoring habit).
- A pack-themed 连连看 study activity (could be added later; v1 ships the two MCQ types).
- Reordering/admin UI for pack contents.

---

## Open questions (non-blocking)

1. **Lesson length** — fixed at ~6, or scale with owned count (e.g. `min(8, owned)`)? Default: fixed 6.
2. **Pass threshold** — reuse the standard scene pass score, or require a gentler bar for a 6yo? Default: standard.

---

## Resulting PRs (for the implementation plan)

1. **PR: 4 themed packs** — data + components + registry + seed scripts + art run (may split into 1–2 PRs if review size warrants).
2. **PR: Study Mode** — DB helpers + `'study'` source + action + `StudyRunner` + route + `PackPageBody` button.
