// E2 — tone practice, built from her OWN characters.
//
// Tones are this project's known weak point: the child is UK-based, and the
// pre-generated MeloTTS clips were scrapped precisely because their tones were
// wrong. The game therefore plays a HANZI through device TTS — the device is
// given the character, not a pinyin string, so its tone is correct by
// construction, which is the whole reason this can be built at all.
//
// Choices are hanzi, never pinyin. Pinyin is hidden by default in this app (a
// locked decision), and asking "which tone number" would test a metalinguistic
// label a six-year-old does not need. Asking her to pick 妈 when she hears mā,
// with 马 and 吗 beside it, tests exactly the discrimination and nothing else.
import { describe, expect, it } from 'vitest';
import {
  toneOf,
  toneless,
  groupMinimalPairs,
  buildToneQuestions,
  TONE_CHOICE_COUNT,
} from '@/lib/tones/minimal-pairs';

const c = (hanzi: string, py: string) => ({ characterId: hanzi, hanzi, pinyin: [py] });

describe('toneOf', () => {
  it('reads the tone from the mark, wherever it sits in the syllable', () => {
    expect(toneOf('mā')).toBe(1);
    expect(toneOf('má')).toBe(2);
    expect(toneOf('mǎ')).toBe(3);
    expect(toneOf('mà')).toBe(4);
    expect(toneOf('ma')).toBe(5); // neutral
    expect(toneOf('jiào')).toBe(4);
    expect(toneOf('xiǎo')).toBe(3);
  });
});

describe('toneless', () => {
  it('strips the mark so two tones of one syllable collide', () => {
    expect(toneless('mā')).toBe('ma');
    expect(toneless('mǎ')).toBe('ma');
    expect(toneless('jiào')).toBe('jiao');
    expect(toneless('lǜ')).toBe('lv');
  });
});

describe('groupMinimalPairs', () => {
  it('groups characters that differ ONLY by tone', () => {
    const groups = groupMinimalPairs([
      c('妈', 'mā'), c('马', 'mǎ'), c('吗', 'ma'), c('鱼', 'yú'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.hanzi).sort()).toEqual(['吗', '妈', '马']);
  });

  it('does NOT group true homophones — there is no tone to hear', () => {
    // 十 and 石 are both shí. Asking her to pick between them by ear is a
    // question with two correct answers, which is worse than no question.
    const groups = groupMinimalPairs([c('十', 'shí'), c('石', 'shí')]);
    expect(groups).toHaveLength(0);
  });

  it('keeps a group that contains a homophone pair AND a real tone contrast', () => {
    // shi has 十/石 (both shí) plus 是 (shì). The group is usable; the builder
    // must just never put 十 and 石 in the same question.
    const groups = groupMinimalPairs([c('十', 'shí'), c('石', 'shí'), c('是', 'shì')]);
    expect(groups).toHaveLength(1);
  });

  it('ignores characters with no pinyin rather than crashing on them', () => {
    const groups = groupMinimalPairs([
      { characterId: 'x', hanzi: '?', pinyin: [] }, c('妈', 'mā'), c('马', 'mǎ'),
    ]);
    expect(groups).toHaveLength(1);
  });
});

describe('buildToneQuestions', () => {
  const pool = [
    c('妈', 'mā'), c('马', 'mǎ'), c('吗', 'ma'),
    c('鱼', 'yú'), c('雨', 'yǔ'),
    c('鸡', 'jī'), c('急', 'jí'), c('季', 'jì'),
    c('大', 'dà'), c('打', 'dǎ'),
  ];

  it('never offers two choices that sound identical', () => {
    // The failure this whole design exists to avoid: a question where two of
    // the options are the same sound, so listening cannot separate them.
    const qs = buildToneQuestions([...pool, c('十', 'shí'), c('石', 'shí'), c('是', 'shì')], 30);
    for (const q of qs) {
      const sounds = q.choices.map((ch) => ch.pinyin);
      expect(new Set(sounds).size).toBe(sounds.length);
    }
  });

  it('puts the answer among the choices, exactly once', () => {
    for (const q of buildToneQuestions(pool, 20)) {
      const hits = q.choices.filter((ch) => ch.hanzi === q.answer.hanzi);
      expect(hits).toHaveLength(1);
    }
  });

  it('fills every question to the full choice count', () => {
    for (const q of buildToneQuestions(pool, 20)) {
      expect(q.choices).toHaveLength(TONE_CHOICE_COUNT);
    }
  });

  it('draws at least one distractor from the answer\'s OWN minimal-pair group', () => {
    // Topping up from elsewhere is allowed, but a question whose distractors
    // are all unrelated syllables tests reading, not tone.
    for (const q of buildToneQuestions(pool, 20)) {
      const same = q.choices.filter(
        (ch) => ch.hanzi !== q.answer.hanzi && toneless(ch.pinyin) === toneless(q.answer.pinyin),
      );
      expect(same.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns nothing when she has no minimal pairs yet', () => {
    // A brand-new child. An empty list lets the page hide the entry rather
    // than offer a game with no questions.
    expect(buildToneQuestions([c('鱼', 'yú'), c('大', 'dà')], 10)).toEqual([]);
  });

  it('never repeats the same answer within one session', () => {
    const qs = buildToneQuestions(pool, 30);
    const answers = qs.map((q) => q.answer.hanzi);
    expect(new Set(answers).size).toBe(answers.length);
  });
});
