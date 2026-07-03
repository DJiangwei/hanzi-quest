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
      });
    });
  }
});
