import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/review', () => ({ finishReviewAction: vi.fn() }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

import { ReviewRunner } from '@/components/play/ReviewRunner';
import { MidSceneProvider, useMidScene } from '@/components/play/MidSceneProvider';
import { finishReviewAction } from '@/lib/actions/review';
import type { ReviewPoolChar, ReviewQuestion } from '@/lib/review/session';

const pool: ReviewPoolChar[] = [
  {
    characterId: 'c1',
    hanzi: '猫',
    meaningEn: 'cat',
    pinyin: ['māo'],
    words: [{ wordId: 'w1', text: '小猫', imageUrl: 'http://x/cat.png' }],
  },
  { characterId: 'c2', hanzi: '狗', meaningEn: 'dog', pinyin: ['gǒu'], words: [] },
  { characterId: 'c3', hanzi: '鸟', meaningEn: 'bird', pinyin: ['niǎo'], words: [] },
  { characterId: 'c4', hanzi: '鱼', meaningEn: 'fish', pinyin: ['yú'], words: [] },
];

const question = (over: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  id: 'translate_pick:c1:0',
  type: 'translate_pick',
  targetCharacterId: 'c1',
  stimulusWordId: null,
  choiceCharacterIds: ['c1', 'c2', 'c3', 'c4'],
  ...over,
});

describe('ReviewRunner', () => {
  it('renders the first question with four choices', () => {
    render(<ReviewRunner childId="c1" questions={[question()]} pool={pool} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });

  it('shows a bilingual prompt', () => {
    const { container } = render(
      <ReviewRunner childId="c1" questions={[question()]} pool={pool} />,
    );
    expect(container.textContent).toMatch(/[一-鿿]/);
    expect(container.textContent).toMatch(/[A-Za-z]/);
  });

  it('flips the mid-scene flag so a nav tap asks before abandoning the session', () => {
    // Documented landmine: any long-session route must mount MidSceneFlag, or
    // KidNavBar navigates away mid-session with no quit-confirm.
    //
    // MidSceneFlag renders null by design, so assert the BEHAVIOUR through the
    // real provider rather than adding a marker element to a shared component
    // for a test's convenience.
    function Probe() {
      const { midScene } = useMidScene();
      return <span data-testid="probe">{String(midScene)}</span>;
    }
    render(
      <MidSceneProvider>
        <ReviewRunner childId="c1" questions={[question()]} pool={pool} />
        <Probe />
      </MidSceneProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('renders an audio_pick question without crashing', () => {
    render(
      <ReviewRunner
        childId="c1"
        questions={[question({ id: 'audio_pick:c1:0', type: 'audio_pick' })]}
        pool={pool}
      />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });

  it('renders an image for an image_pick question whose stimulus word has an imageUrl', () => {
    const { container } = render(
      <ReviewRunner
        childId="c1"
        questions={[
          question({ id: 'image_pick:c1:0', type: 'image_pick', stimulusWordId: 'w1' }),
        ]}
        pool={pool}
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('http://x/cat.png');
  });

  it('falls back to the audio question when the frozen stimulusWordId no longer resolves', () => {
    const { container } = render(
      <ReviewRunner
        childId="c1"
        questions={[
          question({
            id: 'image_pick:c1:0',
            type: 'image_pick',
            stimulusWordId: 'no-such-word',
          }),
        ]}
        pool={pool}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toMatch(/听音选字/);
  });

  describe('the runner→action seam (F2/F6)', () => {
    // finishReviewAction was mocked returning undefined before this test
    // existed — a click on this file's suite would have thrown. This pins
    // that the events array actually reaches the action, and that a granted
    // card actually reaches CardChestReveal.
    it('submits per-answer events and shows a granted card in the chest', async () => {
      (finishReviewAction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        cardGrants: [
          {
            id: 'i1',
            slug: 'rat',
            packSlug: 'zodiac-v1',
            nameZh: '鼠',
            nameEn: 'Rat',
            loreZh: null,
            loreEn: null,
            isDupe: false,
            shardsAfter: 0,
          },
        ],
        cardMessage: null,
        coinsAwarded: 40,
        xp: { gained: 15, level: 2, leveledUp: false },
      });

      render(<ReviewRunner childId="c1" questions={[question()]} pool={pool} />);
      // The default question's target is c1 / 猫 ('cat') — pick the correct choice.
      fireEvent.click(screen.getByText('cat'));

      await waitFor(() =>
        expect(finishReviewAction).toHaveBeenCalledWith(
          expect.objectContaining({
            childId: 'c1',
            events: [{ sceneType: 'translate_pick', characterId: 'c1', correct: true }],
          }),
        ),
      );

      await waitFor(() => expect(screen.getByTestId('card-chest-reveal')).toBeInTheDocument());
    });
  });
});
