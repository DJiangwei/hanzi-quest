// tests/unit/scene-runner-gift.test.tsx
// Card Economy v2: GiftPackReveal surfaces when finishAttemptAction returns giftPack
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock LevelFanfare so it renders something stable when done
vi.mock('@/components/scenes/fx/LevelFanfare', () => ({
  LevelFanfare: () => <div data-testid="fanfare" />,
}));

// Mock GiftPackReveal so we can assert on gift-card-tile without packRegistry deps
vi.mock('@/components/play/GiftPackReveal', () => ({
  GiftPackReveal: ({
    cards,
    onClose,
  }: {
    cards: { itemId: string; packSlug: string; isDupe: boolean; shardsAfter: number }[];
    onClose: () => void;
  }) => (
    <div data-testid="gift-pack-reveal">
      {cards.map((c) => (
        <div key={c.itemId} data-testid="gift-card-tile" data-pack={c.packSlug} />
      ))}
      <button onClick={onClose} data-testid="gift-close">
        Close
      </button>
    </div>
  ),
}));

// finishAttemptAction returns giftPack on the first call (normal scene, NOT final)
vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess-gift-1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({
    ok: true,
    coinsAwarded: 10,
    perfect: false,
    bonuses: [],
    trophies: [],
    giftPack: {
      cards: [
        {
          itemId: 'i1',
          packId: 'p1',
          packSlug: 'zodiac',
          isDupe: false,
          shardsAfter: 0,
        },
      ],
    },
  }),
  finishLevelAction: vi.fn().mockResolvedValue({
    ok: true,
    bossCleared: false,
    freePullClaimed: false,
    cardGrant: null,
    bonuses: [],
    trophies: [],
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
    <button data-testid="boss-scene-complete" onClick={() => onComplete(true)}>
      Complete boss
    </button>
  ),
}));
vi.mock('@/lib/actions/gacha', () => ({
  pullFreeFromBoss: vi.fn(),
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

// Two-level setup: completing level 0 (non-final) triggers finishAttemptAction
// without hitting finishLevelAction, so we can verify giftPack surfacing on a
// normal mid-session attempt.
const flashcardLevel0 = {
  id: 'l-flash-0',
  position: 0,
  sceneType: 'flashcard' as const,
  config: { characterId: 'c1', segment: 'review' },
};
const flashcardLevel1 = {
  id: 'l-flash-1',
  position: 1,
  sceneType: 'flashcard' as const,
  config: { characterId: 'c1', segment: 'review' },
};

describe('SceneRunner GiftPackReveal surfacing (Card Economy v2)', () => {
  it('shows GiftPackReveal with gift-card-tile when finishAttemptAction returns giftPack', async () => {
    render(
      <SceneRunner
        childId="child-1"
        weekId="w1"
        weekLabel="Test Week"
        levels={[flashcardLevel0, flashcardLevel1]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    // Wait for session to start
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Complete the first (non-final) scene
    const btn = screen.getByTestId('flash-complete');
    await act(async () => {
      btn.click();
    });

    // Allow async state updates to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // The GiftPackReveal modal should be visible with the card tile
    expect(screen.getByTestId('gift-card-tile')).toBeInTheDocument();
  });

  it('closes GiftPackReveal when onClose is called', async () => {
    render(
      <SceneRunner
        childId="child-1"
        weekId="w1"
        weekLabel="Test Week"
        levels={[flashcardLevel0, flashcardLevel1]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    // Wait for session
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Complete the first scene → modal appears
    const btn = screen.getByTestId('flash-complete');
    await act(async () => {
      btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('gift-card-tile')).toBeInTheDocument();

    // Close the modal
    const closeBtn = screen.getByTestId('gift-close');
    await act(async () => {
      closeBtn.click();
    });

    expect(screen.queryByTestId('gift-card-tile')).not.toBeInTheDocument();
  });

  it('does NOT show GiftPackReveal when finishAttemptAction returns giftPack=null', async () => {
    const { finishAttemptAction } = await import('@/lib/actions/play');
    vi.mocked(finishAttemptAction).mockResolvedValueOnce({
      coinsAwarded: 10,
      perfect: false,
      bonuses: [],
      trophies: [],
      giftPack: null,
    });

    render(
      <SceneRunner
        childId="child-1"
        weekId="w1"
        weekLabel="Test Week"
        levels={[flashcardLevel0, flashcardLevel1]}
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

    expect(screen.queryByTestId('gift-card-tile')).not.toBeInTheDocument();
  });
});
