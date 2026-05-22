import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SentenceClozeScene } from '@/components/scenes/SentenceClozeScene';

const target = {
  characterId: 't1',
  hanzi: '苹',
  pinyinArray: ['píng'],
  meaningEn: 'apple',
  meaningZh: '苹果',
  imageHook: null,
  firstWord: null,
};

const pool = [
  target,
  { ...target, characterId: 'd1', hanzi: '梨', meaningEn: 'pear' },
  { ...target, characterId: 'd2', hanzi: '橙', meaningEn: 'orange' },
  { ...target, characterId: 'd3', hanzi: '桃', meaningEn: 'peach' },
];

const sentenceText = '我喜欢吃苹果。';
const translationEn = 'I love eating apples.';

afterEach(() => vi.clearAllMocks());

describe('SentenceClozeScene', () => {
  it('renders the sentence with the target hanzi blanked out', () => {
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={translationEn}
        onComplete={vi.fn()}
      />,
    );
    // The blanked sentence appears as one node with ____ in place of 苹.
    expect(screen.getByText(/我喜欢吃 ____ 果/)).toBeInTheDocument();
    expect(screen.getByText(translationEn)).toBeInTheDocument();
  });

  it('renders 4 hanzi options', () => {
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={translationEn}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(5); // 4 options + 1 audio button
  });

  it('calls onComplete(true) when the correct hanzi is picked', () => {
    const onComplete = vi.fn();
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={translationEn}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText('苹'));
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('omits the English gloss row when translationEn is null', () => {
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={null}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.queryByText(translationEn)).not.toBeInTheDocument();
  });
});
