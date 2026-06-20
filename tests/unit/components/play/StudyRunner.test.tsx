import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyQuestion } from '@/lib/play/study';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/study', () => ({ finishStudyLessonAction: vi.fn(async () => ({ ok: true, cardGrants: [], cardMessage: null, xp: { gained: 0, level: 1, leveledUp: false } })) }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({ useCoinHud: () => ({ coinHudRef: { current: null } }) }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn(), usableAudioUrl: (u: string | null) => u }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { StudyRunner } from '@/components/play/StudyRunner';

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
});
