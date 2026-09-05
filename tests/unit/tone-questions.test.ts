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
  TONE_MAX_CHOICES,
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

  it('offers ONLY characters from the answer\'s own syllable — never a filler', () => {
    // The bug David found by playing it. An option that shares no syllable
    // with the answer can be dropped by reading, so padding a 2-way question
    // out to 4 makes it EASIER than the honest version while teaching her to
    // scan for the familiar shape instead of listening.
    //
    // It is not a rare top-up either: measured against production, not one of
    // the 20 syllables she knows in more than one tone is known in four, so
    // padding fired on essentially every question.
    const padding = [c('鱼', 'yú'), c('大', 'dà'), c('飞', 'fēi'), c('书', 'shū')];
    for (const q of buildToneQuestions([...pool, ...padding], 30)) {
      for (const ch of q.choices) {
        expect(toneless(ch.pinyin)).toBe(toneless(q.answer.pinyin));
      }
    }
  });

  it('keeps a two-option question rather than discarding it', () => {
    // 鱼/雨 is the whole yu group: two characters, one contrast. The old
    // builder threw this away for failing to reach four options — discarding
    // the purest tone contrasts in the corpus. A 50% guess is the accepted
    // shape of a minimal-pair drill, and nothing here pays out on the answer.
    const qs = buildToneQuestions([c('鱼', 'yú'), c('雨', 'yǔ')], 10);
    expect(qs).toHaveLength(2);
    for (const q of qs) expect(q.choices).toHaveLength(2);
  });

  it('uses every tone of a syllable she knows, up to the cap', () => {
    // 妈/马/吗 is a three-way contrast; offering only two would waste it.
    const qs = buildToneQuestions([c('妈', 'mā'), c('马', 'mǎ'), c('吗', 'ma')], 10);
    for (const q of qs) expect(q.choices).toHaveLength(3);
  });

  it('never exceeds the cap', () => {
    const five = [
      c('妈', 'mā'), c('麻', 'má'), c('马', 'mǎ'), c('骂', 'mà'), c('吗', 'ma'),
    ];
    for (const q of buildToneQuestions(five, 20)) {
      expect(q.choices.length).toBeLessThanOrEqual(TONE_MAX_CHOICES);
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not put two questions on the same syllable back to back', () => {
    // Most syllables she knows have exactly two tones, so a group yields two
    // questions with the SAME two tiles and only the answer swapped. Emitting
    // them consecutively reads as a stuck screen, and the second answer is
    // inferable from the first.
    const qs = buildToneQuestions(pool, 20);
    expect(qs.length).toBeGreaterThan(4);
    for (let i = 1; i < qs.length; i++) {
      const prev = toneless(qs[i - 1].answer.pinyin);
      const here = toneless(qs[i].answer.pinyin);
      // Repeats are allowed only once every syllable has had a turn.
      if (prev === here) {
        const seen = new Set(qs.slice(0, i).map((q) => toneless(q.answer.pinyin)));
        expect(seen.size).toBe(1);
      }
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
