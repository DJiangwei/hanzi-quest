import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FlashcardScene } from '@/components/scenes/FlashcardScene';

vi.mock('@/lib/hooks/useSpeak', () => ({
  useSpeak: () => vi.fn(),
  usableAudioUrl: () => null,
}));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => false }));

const CHAR = 'aaaaaaaa-0000-4000-a000-000000000009';
const data = {
  characterId: CHAR,
  hanzi: '船',
  hanziAudioUrl: null,
  pinyin: ['chuán'],
  meaningEn: 'boat',
  meaningZh: null,
  imageHook: null,
  firstWord: null,
  firstWordAudioUrl: null,
  firstSentence: null,
};

const CASES = [
  { name: /^认识/, rating: 'got_it' },
  { name: /^不确定/, rating: 'not_sure' },
  { name: /^不认识/, rating: 'dont_know' },
] as const;

describe('FlashcardScene self-assessment', () => {
  it('renders three bilingual rating buttons', () => {
    render(<FlashcardScene data={data} onComplete={vi.fn()} />);
    const gotIt = screen.getByRole('button', { name: /^认识/ });
    const notSure = screen.getByRole('button', { name: /不确定/ });
    const dontKnow = screen.getByRole('button', { name: /不认识/ });
    // Bilingual rule: each button carries BOTH the ZH and EN label.
    expect(gotIt.textContent).toContain('Got it');
    expect(notSure.textContent).toContain('Not sure');
    expect(dontKnow.textContent).toContain("Don't know");
  });

  for (const { name, rating } of CASES) {
    it(`${rating} button advances AND emits the rating`, () => {
      const onComplete = vi.fn();
      const onAnswerEvent = vi.fn();
      render(
        <FlashcardScene data={data} onComplete={onComplete} onAnswerEvent={onAnswerEvent} />,
      );
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onAnswerEvent).toHaveBeenCalledWith({
        sceneType: 'flashcard',
        characterId: CHAR,
        selfRating: rating,
        revealed: false,
      });
    });
  }
});

/**
 * Every one of production's 164 flashcard self-ratings is `got_it` — not one
 * `not_sure`, not one `dont_know`, across two months, while she answered 33
 * scored questions wrong in the same period. The emit path was verified sound
 * (all three buttons emit, the schema accepts all three, the write persists
 * them), so the constant is self-report bias, amplified by a UI that made
 * 认识 the first button AND painted it green while 不认识 was red.
 *
 * `revealed` is the signal that cannot be flattered: tapping to show the
 * pinyin or the meaning is something she DID, not something she claimed.
 */
describe('FlashcardScene reveal signal', () => {
  it('reports revealed:false when she rates without uncovering anything', () => {
    const onAnswerEvent = vi.fn();
    render(<FlashcardScene data={data} onComplete={vi.fn()} onAnswerEvent={onAnswerEvent} />);
    fireEvent.click(screen.getByRole('button', { name: /^认识/ }));
    expect(onAnswerEvent.mock.calls[0][0]).toMatchObject({ revealed: false });
  });

  it('reports revealed:true after she uncovers the meaning', () => {
    const onAnswerEvent = vi.fn();
    render(<FlashcardScene data={data} onComplete={vi.fn()} onAnswerEvent={onAnswerEvent} />);
    fireEvent.click(screen.getByRole('button', { name: /Tap to show meaning/i }));
    fireEvent.click(screen.getByRole('button', { name: /^认识/ }));
    expect(onAnswerEvent.mock.calls[0][0]).toMatchObject({ revealed: true });
  });

  it('reports revealed:true after she uncovers the pinyin', () => {
    const onAnswerEvent = vi.fn();
    render(<FlashcardScene data={data} onComplete={vi.fn()} onAnswerEvent={onAnswerEvent} />);
    fireEvent.click(screen.getByRole('button', { name: /Tap to show pinyin/i }));
    fireEvent.click(screen.getByRole('button', { name: /^认识/ }));
    expect(onAnswerEvent.mock.calls[0][0]).toMatchObject({ revealed: true });
  });

  it('records the reveal even when she then says she does not know it', () => {
    // The two signals are independent by design — one is behaviour, one is a
    // claim. A future analysis compares them; neither overrides the other.
    const onAnswerEvent = vi.fn();
    render(<FlashcardScene data={data} onComplete={vi.fn()} onAnswerEvent={onAnswerEvent} />);
    fireEvent.click(screen.getByRole('button', { name: /Tap to show meaning/i }));
    fireEvent.click(screen.getByRole('button', { name: /^不认识/ }));
    expect(onAnswerEvent.mock.calls[0][0]).toMatchObject({
      selfRating: 'dont_know',
      revealed: true,
    });
  });
});

/**
 * The colours were half the bias. 认识 was emerald and 不认识 was rose, in a
 * game where green means correct and red means wrong everywhere else — so
 * admitting she did not know a character meant pressing a failure button.
 *
 * ALLOWLIST, not denylist: the Logbook shipped a `/red|rose|danger|warn/`
 * check that an amber palette walked straight through (PR #167). Here the
 * three buttons must be styled IDENTICALLY, which makes "no button is
 * visually privileged" the literal assertion rather than a proxy for it.
 */
describe('FlashcardScene reveal prompts follow the bilingual rule', () => {
  it('labels both reveal buttons in 中文 AND English', () => {
    // Their sibling ("Tap to show example word / 例词") was already bilingual;
    // these two shipped English-only, which is the one thing every kid-facing
    // label in this game is not allowed to be.
    render(<FlashcardScene data={data} onComplete={vi.fn()} />);
    const pinyin = screen.getByRole('button', { name: /Tap to show pinyin/i });
    const meaning = screen.getByRole('button', { name: /Tap to show meaning/i });
    expect(pinyin.textContent).toMatch(/拼音/);
    expect(meaning.textContent).toMatch(/意思/);
  });
});

describe('FlashcardScene rating buttons carry no verdict', () => {
  const ratingButtons = () =>
    [/^认识/, /^不确定/, /^不认识/].map((name) =>
      screen.getByRole('button', { name }),
    );

  it('styles all three identically, so none reads as the right answer', () => {
    render(<FlashcardScene data={data} onComplete={vi.fn()} />);
    const [a, b, c] = ratingButtons();
    expect(b.className).toBe(a.className);
    expect(c.className).toBe(a.className);
  });

  it('uses no colour family that codes success or failure', () => {
    render(<FlashcardScene data={data} onComplete={vi.fn()} />);
    for (const btn of ratingButtons()) {
      expect(btn.className).not.toMatch(
        /emerald|green|lime|teal-\d|rose|red|pink|amber|orange|yellow/,
      );
    }
  });
});
