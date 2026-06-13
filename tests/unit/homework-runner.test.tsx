import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/homework', () => ({
  finishHomeworkAction: vi.fn().mockResolvedValue({ ok: true, cardGrants: [], cardMessage: null, xp: { gained: 0, level: 1, leveledUp: false } }),
}));
// Mocks required by MultipleChoiceQuiz
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return { CoinHudContext: ctx, useCoinHud: () => useContext(ctx) };
});
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn() }));
// Mocks required by LevelFanfare
vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => null }));

import { HomeworkRunner } from '@/components/homework/HomeworkRunner';
import { finishHomeworkAction } from '@/lib/actions/homework';

const items = [
  { id: 'h1', type: 'char_quiz' as const, config: { type: 'char_quiz' as const, questionZh: '「水」是？', options: [{ textZh: '水', textEn: 'water' }, { textZh: '火', textEn: 'fire' }], correctIndex: 0 } },
];

describe('HomeworkRunner', () => {
  it('runs the single item and calls finishHomeworkAction on completion', async () => {
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={items} />);
    expect(screen.getByText('「水」是？', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/water/i));
    await waitFor(() => expect(finishHomeworkAction).toHaveBeenCalledWith({ childId: 'c1', weekId: 'w1' }));
  });

  it('shows the fanfare screen after completing all items', async () => {
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={items} />);
    fireEvent.click(screen.getByText(/water/i));
    await waitFor(() => expect(screen.getByText(/Week 1/)).toBeInTheDocument());
    // fanfare heading visible
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('shows CardChestReveal when cardGrants are returned', async () => {
    const { finishHomeworkAction: mockFn } = await import('@/lib/actions/homework');
    (mockFn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      cardGrants: [{
        id: 'i1', slug: 'cn', packSlug: 'flags',
        nameZh: '中国', nameEn: 'China', loreZh: null, loreEn: null,
        isDupe: false, shardsAfter: 0,
      }],
      cardMessage: null,
      xp: { gained: 30, level: 1, leveledUp: false },
    });
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={items} />);
    fireEvent.click(screen.getByText(/water/i));
    await waitFor(() => expect(screen.getByTestId('card-chest-reveal')).toBeInTheDocument());
  });

  it('shows homework_done_today cardMessage on fanfare', async () => {
    const { finishHomeworkAction: mockFn } = await import('@/lib/actions/homework');
    (mockFn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      cardGrants: [],
      cardMessage: 'homework_done_today',
      xp: { gained: 0, level: 1, leveledUp: false },
    });
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={items} />);
    fireEvent.click(screen.getByText(/water/i));
    await waitFor(() => expect(screen.getByTestId('card-message')).toBeInTheDocument());
    expect(screen.getByTestId('card-message')).toHaveTextContent(/今日作业已完成/);
  });

  it('renders sentence_order item', () => {
    const sentenceItems = [
      { id: 's1', type: 'sentence_order' as const, config: { type: 'sentence_order' as const, tokens: ['我', '爱', '你'], translationEn: 'I love you' } },
    ];
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={sentenceItems} />);
    expect(screen.getByText(/连词成句/)).toBeInTheDocument();
  });

  it('renders word_building item', () => {
    const wordItems = [
      { id: 'w1', type: 'word_building' as const, config: { type: 'word_building' as const, baseChar: '水', correctWord: '水果', distractors: ['水平', '水星'] } },
    ];
    render(<HomeworkRunner childId="c1" weekId="w1" weekLabel="Week 1" items={wordItems} />);
    expect(screen.getByText(/组词/)).toBeInTheDocument();
  });
});
