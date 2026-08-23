// compileWeekIntoLevels — 看图找字 (image_pick) stimulus-word compilation.
//
// Root cause (docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md):
// image_pick used to store only characterId and grab "the first word with a
// URL" at RENDER time — no selection, no validation. That let two bugs ship
// for months: a picture whose only sensible word is linked to ANOTHER
// character taught the same week (no correct answer), and a counting
// character (一...十) whose words hinge on an exact count diffusion can't
// render. This file locks down the fix: compile-week now picks a specific
// `wordId` per target using validStimulusWords (stimulus-validity.ts) and
// freezes it into scene_config, using the REAL ambiguous-word cases from the
// design doc's measured table (唱歌→唱/歌, 多少→多/少, 大人→人/大), not
// invented ones.
//
// `shuffle` is mocked to the identity function so which characters are
// picked as image_pick targets is deterministic (array order), and every
// target fixture below is built so at most ONE valid word remains after
// ambiguity filtering — that makes `pickRandom`'s choice deterministic too
// (Math.random() * 1 always floors to index 0), with no need to stub
// Math.random itself.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });
  const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });
  const txMock = { insert: insertMock, delete: deleteMock };
  const transactionMock = vi.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock),
  );
  const selectWhereMock = vi.fn();
  const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
  const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });
  const getCharactersWithDetailsForWeekMock = vi.fn();

  return {
    insertValuesMock,
    onConflictDoUpdate,
    deleteMock,
    transactionMock,
    selectWhereMock,
    selectMock,
    getCharactersWithDetailsForWeekMock,
  };
});

vi.mock('@/db', () => ({
  db: {
    transaction: mocks.transactionMock,
    select: mocks.selectMock,
  },
}));

vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: (weekId: string) =>
    mocks.getCharactersWithDetailsForWeekMock(weekId),
}));

// Identity shuffle: makes target selection = array order, deterministic.
vi.mock('@/lib/scenes/sample', () => ({
  shuffle: <T>(arr: readonly T[]): T[] => [...arr],
}));

import { compileWeekIntoLevels } from '@/lib/scenes/compile-week';

const MINIMAL_TEMPLATES = [
  { id: 'tmpl_flashcard', type: 'flashcard' },
  { id: 'tmpl_image', type: 'image_pick' },
];

interface WordFixture {
  id: string;
  text: string;
  imageUrl: string | null;
}

function makeChar(id: string, hanzi: string, words: WordFixture[] = []) {
  return {
    id,
    hanzi,
    pinyinArray: ['x'],
    meaningEn: 'meaning',
    meaningZh: null,
    imageHook: null,
    words,
    sentence: null,
  };
}

interface CapturedRow {
  sceneTemplateId: string;
  levelKey: string;
  sceneConfig: { characterId?: string; wordId?: string; segment?: string };
}

beforeEach(() => {
  mocks.onConflictDoUpdate.mockClear();
  mocks.insertValuesMock.mockClear();
  mocks.deleteMock.mockClear();
  mocks.transactionMock.mockClear();
  mocks.selectWhereMock.mockReset();
  mocks.getCharactersWithDetailsForWeekMock.mockReset();
  mocks.selectWhereMock.mockResolvedValue(MINIMAL_TEMPLATES);
});

async function compileAndCaptureImagePickRows(chars: unknown[]): Promise<CapturedRow[]> {
  mocks.getCharactersWithDetailsForWeekMock.mockResolvedValue(chars);
  await compileWeekIntoLevels('w-test');
  // Several tests in this file call this twice (forward + reversed owner
  // order) within a single `it` — grab the MOST RECENT call, not calls[0],
  // or a reversed-order second compile silently re-reads the first one's rows.
  const calls = mocks.insertValuesMock.mock.calls;
  const [rows] = calls[calls.length - 1] as [CapturedRow[]];
  return rows.filter((r) => r.sceneTemplateId === 'tmpl_image');
}

describe('compileWeekIntoLevels — image_pick stimulus word', () => {
  // ── Real corpus case: 唱歌 (week 7) — owned by BOTH 唱 and 歌 ─────────────
  it('a week with 唱 and 歌 never emits 唱歌 as the stimulus for either', async () => {
    const changgeWord: WordFixture = {
      id: 'w-changge',
      text: '唱歌',
      imageUrl: 'https://blob.example/changge.png',
    };
    const chang = makeChar('c-chang', '唱', [
      changgeWord,
      { id: 'w-changgeqi', text: '唱歌曲', imageUrl: 'https://blob.example/qu.png' },
    ]);
    const ge = makeChar('c-ge', '歌', [
      changgeWord,
      { id: 'w-geshou', text: '歌手', imageUrl: 'https://blob.example/geshou.png' },
    ]);

    // 唱 first in array order → identity shuffle + imagePick sizing 1 (N=2)
    // picks 唱 as the sole target.
    const asChangFirst = await compileAndCaptureImagePickRows([chang, ge]);
    expect(asChangFirst).toHaveLength(1);
    expect(asChangFirst[0].sceneConfig.characterId).toBe('c-chang');
    expect(asChangFirst[0].sceneConfig.wordId).toBe('w-changgeqi');
    expect(asChangFirst[0].sceneConfig.wordId).not.toBe('w-changge');

    // Reversed order → 歌 is picked instead. Ambiguity is symmetric: 唱歌
    // must never be chosen no matter which of the two owners is asking.
    const asGeFirst = await compileAndCaptureImagePickRows([ge, chang]);
    expect(asGeFirst).toHaveLength(1);
    expect(asGeFirst[0].sceneConfig.characterId).toBe('c-ge');
    expect(asGeFirst[0].sceneConfig.wordId).toBe('w-geshou');
    expect(asGeFirst[0].sceneConfig.wordId).not.toBe('w-changge');
  });

  // ── Real corpus case: 多少 (week 7) — owned by BOTH 多 and 少 ─────────────
  it('a week with 多 and 少 never emits 多少 as the stimulus for either', async () => {
    const duoshaoWord: WordFixture = {
      id: 'w-duoshao',
      text: '多少',
      imageUrl: 'https://blob.example/duoshao.png',
    };
    const duo = makeChar('c-duo', '多', [
      duoshaoWord,
      { id: 'w-duoyu', text: '多余', imageUrl: 'https://blob.example/duoyu.png' },
    ]);
    const shao = makeChar('c-shao', '少', [
      duoshaoWord,
      { id: 'w-shaonian', text: '少年', imageUrl: 'https://blob.example/shaonian.png' },
    ]);

    const asDuoFirst = await compileAndCaptureImagePickRows([duo, shao]);
    expect(asDuoFirst).toHaveLength(1);
    expect(asDuoFirst[0].sceneConfig.wordId).toBe('w-duoyu');
    expect(asDuoFirst[0].sceneConfig.wordId).not.toBe('w-duoshao');

    const asShaoFirst = await compileAndCaptureImagePickRows([shao, duo]);
    expect(asShaoFirst).toHaveLength(1);
    expect(asShaoFirst[0].sceneConfig.wordId).toBe('w-shaonian');
    expect(asShaoFirst[0].sceneConfig.wordId).not.toBe('w-duoshao');
  });

  // ── Real corpus case: 大人 (week 1) — owned by BOTH 人 and 大 ─────────────
  it('a week with 人 and 大 never emits 大人 as the stimulus for either', async () => {
    const darenWord: WordFixture = {
      id: 'w-daren',
      text: '大人',
      imageUrl: 'https://blob.example/daren.png',
    };
    const ren = makeChar('c-ren', '人', [
      darenWord,
      { id: 'w-renmen', text: '人们', imageUrl: 'https://blob.example/renmen.png' },
    ]);
    const da = makeChar('c-da', '大', [
      darenWord,
      { id: 'w-daxiang', text: '大象', imageUrl: 'https://blob.example/daxiang.png' },
    ]);

    const asRenFirst = await compileAndCaptureImagePickRows([ren, da]);
    expect(asRenFirst).toHaveLength(1);
    expect(asRenFirst[0].sceneConfig.wordId).toBe('w-renmen');
    expect(asRenFirst[0].sceneConfig.wordId).not.toBe('w-daren');

    const asDaFirst = await compileAndCaptureImagePickRows([da, ren]);
    expect(asDaFirst).toHaveLength(1);
    expect(asDaFirst[0].sceneConfig.wordId).toBe('w-daxiang');
    expect(asDaFirst[0].sceneConfig.wordId).not.toBe('w-daren');
  });

  it('a counting character emits a config with NO wordId, even with an imaged word', async () => {
    // 七's own word has a perfectly clean imageUrl — the exclusion is about
    // what the character MEANS (a count diffusion can't render exactly),
    // not about missing art.
    const qi = makeChar('c-qi', '七', [
      { id: 'w-qige', text: '七个气球', imageUrl: 'https://blob.example/qige.png' },
    ]);
    const other = makeChar('c-other', '朋', [
      { id: 'w-pengyou', text: '朋友', imageUrl: 'https://blob.example/pengyou.png' },
    ]);

    const rows = await compileAndCaptureImagePickRows([qi, other]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sceneConfig.characterId).toBe('c-qi');
    expect(rows[0].sceneConfig.wordId).toBeUndefined();
    expect('wordId' in rows[0].sceneConfig).toBe(false);
  });

  it('a counting character still gets an image_pick slot (eligible via the counting bypass, not a valid word)', async () => {
    // No words at all — a counting character must never be excluded from
    // the slot merely for lacking a picturable word; Task 3 renders it
    // procedurally instead. A second, unrelated char pads N to 2 (sizing
    // gives imagePick=0 slots below N=2) and sits after 十 in array order so
    // identity-shuffle picks 十 deterministically.
    const shi = makeChar('c-shi', '十', []);
    const other = makeChar('c-other', '朋', [
      { id: 'w-pengyou', text: '朋友', imageUrl: 'https://blob.example/pengyou.png' },
    ]);
    const rows = await compileAndCaptureImagePickRows([shi, other]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sceneConfig.characterId).toBe('c-shi');
    expect(rows[0].sceneConfig.wordId).toBeUndefined();
  });

  it('the emitted wordId always belongs to the target character’s own words', async () => {
    // 10 unrelated, unambiguous characters — each with exactly one clean
    // word — so every one of them is eligible and every wordId is easy to
    // trace back to its owner.
    const chars = Array.from({ length: 10 }, (_, i) =>
      makeChar(`c${i}`, `字${i}`, [
        { id: `w${i}`, text: `词${i}`, imageUrl: `https://blob.example/${i}.png` },
      ]),
    );
    const rows = await compileAndCaptureImagePickRows(chars);
    // N=10 → imagePick sizing = 3; identity shuffle picks the first 3.
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const target = chars.find((c) => c.id === row.sceneConfig.characterId);
      expect(target).toBeDefined();
      const ownWordIds = target!.words.map((w) => w.id);
      expect(ownWordIds).toContain(row.sceneConfig.wordId);
    }
  });

  it('a character whose only word has no imageUrl still compiles (no wordId), via the no-eligible-candidates fallback', async () => {
    // Both characters here are imageless — nothing in the week qualifies —
    // which exercises the same graceful fallback the pre-fix code always
    // had for "no word data at all": compile with characterId alone and let
    // pickStimulusImage/ImagePickScene degrade to the imageHook text card at
    // render time. Per the design doc's corpus measurement this never
    // triggers for a real week (all 86 non-number characters keep a valid
    // word); it's tested here for missing-data resilience, not as the norm.
    const noImage1 = makeChar('c-noimg1', '?', [
      { id: 'w-noimg1', text: '没有图1', imageUrl: null },
    ]);
    const noImage2 = makeChar('c-noimg2', '？', [
      { id: 'w-noimg2', text: '没有图2', imageUrl: null },
    ]);
    const rows = await compileAndCaptureImagePickRows([noImage1, noImage2]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sceneConfig.characterId).toBe('c-noimg1');
    expect(rows[0].sceneConfig.wordId).toBeUndefined();
  });
});
