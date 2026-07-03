import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StudyQuestion } from '@/lib/play/study';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/study', () => ({ finishStudyLessonAction: vi.fn(async () => ({ ok: true, cardGrants: [], cardMessage: null, xp: { gained: 0, level: 1, leveledUp: false } })) }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({ useCoinHud: () => ({ coinHudRef: { current: null } }) }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn(), usableAudioUrl: (u: string | null) => u }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { StudyRunner } from '@/components/play/StudyRunner';
import { finishStudyLessonAction } from '@/lib/actions/study';

const q: StudyQuestion[] = [
  { id: 'picture_to_word:a:0', type: 'picture_to_word', target: { id: 'a', slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', imageUrl: null }, choices: [
    { id: 'a', slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', imageUrl: null },
    { id: 'b', slug: 'owl', nameZh: '猫头鹰', nameEn: 'Owl', imageUrl: null },
  ] },
];

describe('StudyRunner', () => {
  it('renders the first question prompt + choices', () => {
    render(<StudyRunner childId="c1" packSlug="animals-v1" packNameZh="动物" packNameEn="Animals" questions={q} />);
    expect(screen.getByText(/看图选词/)).toBeInTheDocument();
    expect(screen.getByText('狐狸')).toBeInTheDocument();
    expect(screen.getByText('猫头鹰')).toBeInTheDocument();
  });

  it('sends one answer event per question with correctness + target slug', async () => {
    render(<StudyRunner childId="c1" packSlug="animals-v1" packNameZh="动物" packNameEn="Animals" questions={q} />);
    // Pick the WRONG choice (猫头鹰) — the event must record correct: false.
    fireEvent.click(screen.getByText('猫头鹰'));
    await waitFor(() =>
      expect(finishStudyLessonAction).toHaveBeenCalledWith(
        expect.objectContaining({
          events: [{ sceneType: 'study_picture_to_word', itemKey: 'fox', correct: false }],
        }),
      ),
    );
  });
});
