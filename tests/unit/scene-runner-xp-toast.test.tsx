// tests/unit/scene-runner-xp-toast.test.tsx
// Verifies XpGainToast renders when finishAttemptAction returns xp.gained > 0
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('@/components/scenes/fx/LevelFanfare', () => ({
  LevelFanfare: () => <div data-testid="fanfare" />,
}));
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: () => <div data-testid="card-chest-reveal" />,
}));

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess-xp-1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({
    ok: true,
    coinsAwarded: 50,
    perfect: false,
    bonuses: [],
    trophies: [],
    giftPack: null,
    xp: { gained: 15, level: 2, leveledUp: false },
  }),
  finishLevelAction: vi.fn().mockResolvedValue({
    ok: true,
    bossCleared: false,
    freePullClaimed: false,
    cardGrants: [],
    bonuses: [],
    trophies: [],
    xp: { gained: 0, level: 2, leveledUp: false },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
  setAudioMuted: vi.fn(),
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie" />,
}));
vi.mock('@/components/scenes/BossScene', () => ({
  BossScene: ({ onComplete }: { onComplete: (correct: boolean) => void }) => (
    <button data-testid="boss-complete" onClick={() => onComplete(true)}>Complete boss</button>
  ),
}));
vi.mock('@/lib/actions/gacha', () => ({
  AlreadyClaimedError: class extends Error {},
}));
vi.mock('@/components/scenes/fx/TreasureChestReveal', () => ({
  TreasureChestReveal: () => <div data-testid="treasure-chest-reveal" />,
}));
vi.mock('@/lib/actions/powerups', () => ({
  useHintAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
  useSkipAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
}));
vi.mock('@/components/scenes/FlashcardScene', () => ({
  FlashcardScene: ({ onComplete }: { onComplete: () => void }) => (
    <button data-testid="flash-complete" onClick={() => onComplete()}>
      Complete flashcard
    </button>
  ),
}));

import { SceneRunner } from '@/components/scenes/SceneRunner';

const charactersById = {
  c1: {
    characterId: 'c1',
    hanzi: '海',
    pinyinArray: ['hǎi'],
    meaningEn: 'sea',
    meaningZh: '海洋',
    imageHook: null,
    firstWord: null,
    words: [],
    sentence: null,
  },
};

const levels = [
  { id: 'l0', position: 0, sceneType: 'flashcard' as const, config: { characterId: 'c1', segment: 'review' } },
  { id: 'l1', position: 1, sceneType: 'flashcard' as const, config: { characterId: 'c1', segment: 'review' } },
];

describe('SceneRunner XpGainToast', () => {
  it('shows xp-gain-toast after scene complete when xp.gained > 0', async () => {
    render(
      <SceneRunner
        childId="child-1"
        weekId="w1"
        weekLabel="Test Week"
        levels={levels}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    // Wait for session to start
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const btn = screen.getByTestId('flash-complete');
    await act(async () => {
      btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('xp-gain-toast')).toBeInTheDocument();
    expect(screen.getByTestId('xp-gained-label')).toHaveTextContent('+15 XP');
  });

  it('does NOT show xp-gain-toast when xp.gained=0 and leveledUp=false', async () => {
    const { finishAttemptAction } = await import('@/lib/actions/play');
    vi.mocked(finishAttemptAction).mockResolvedValueOnce({
      coinsAwarded: 5,
      perfect: false,
      bonuses: [],
      trophies: [],
      giftPack: null,
      xp: { gained: 0, level: 1, leveledUp: false },
    });

    render(
      <SceneRunner
        childId="child-2"
        weekId="w2"
        weekLabel="Test Week 2"
        levels={levels}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const btn = screen.getByTestId('flash-complete');
    await act(async () => {
      btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByTestId('xp-gain-toast')).not.toBeInTheDocument();
  });

  it('shows level-up label when xp.leveledUp=true', async () => {
    const { finishAttemptAction } = await import('@/lib/actions/play');
    vi.mocked(finishAttemptAction).mockResolvedValueOnce({
      coinsAwarded: 50,
      perfect: false,
      bonuses: [],
      trophies: [],
      giftPack: null,
      xp: { gained: 10, level: 3, leveledUp: true },
    });

    render(
      <SceneRunner
        childId="child-3"
        weekId="w3"
        weekLabel="Test Week 3"
        levels={levels}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const btn = screen.getByTestId('flash-complete');
    await act(async () => {
      btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('xp-level-up-label')).toBeInTheDocument();
    expect(screen.getByTestId('xp-level-up-label')).toHaveTextContent('Lv 3');
  });
});
