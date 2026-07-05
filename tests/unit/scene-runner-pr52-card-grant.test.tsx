// tests/unit/scene-runner-pr52-card-grant.test.tsx
// Card reveal polish: cardGrants[] threads through to CardChestReveal
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { RevealCard } from '@/lib/play/reveal-card';

// Mock LevelFanfare with data attributes to verify props
vi.mock('@/components/scenes/fx/LevelFanfare', () => ({
  LevelFanfare: (props: {
    chestAvailable: boolean;
  }) => (
    <div
      data-testid="fanfare"
      data-chest={String(props.chestAvailable)}
    />
  ),
}));

// Mock CardChestReveal to surface the cards
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: ({
    cards,
    onDone,
  }: {
    cards: RevealCard[];
    onDone: () => void;
  }) => (
    <div data-testid="card-chest-reveal">
      {cards.map((c) => (
        <div key={c.id} data-testid="reveal-card-name">{c.nameEn}</div>
      ))}
      <button onClick={onDone} data-testid="reveal-done">Done</button>
    </div>
  ),
}));

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess-1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({
    ok: true,
    coinsAwarded: 50,
    perfect: false,
    bonuses: [],
    trophies: [],
    xp: { gained: 10, level: 1, leveledUp: false },
  }),
  finishLevelAction: vi.fn(),
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
import { finishLevelAction } from '@/lib/actions/play';

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

const bossLevel = {
  id: 'l-boss',
  position: 0,
  sceneType: 'boss' as const,
  config: { characterIds: ['c1'], questionTypes: ['audio_pick'] },
};

const revealCard: RevealCard = {
  id: 'item-x',
  slug: 'flag-cn',
  packSlug: 'flags',
  nameZh: '中国',
  nameEn: 'China',
  loreZh: null,
  loreEn: null,
  isDupe: false,
  shardsAfter: 0,
};

async function driveToFanfare() {
  // Wait for session to start
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  // Click boss complete
  const btn = screen.getByTestId('boss-scene-complete');
  await act(async () => {
    btn.click();
  });

  // Wait for async state updates (finishAttemptAction + finishLevelAction)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('SceneRunner card grant (card-reveal polish)', () => {
  it('shows card-chest-reveal with card name when finishLevelAction returns cardGrants', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true,
      cardGrants: [revealCard],
      bonuses: [],
      trophies: [],
      xp: { gained: 50, level: 1, leveledUp: false },
    });

    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Test"
        levels={[bossLevel]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    await driveToFanfare();

    expect(screen.getByTestId('card-chest-reveal')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
  });

  it('does not show card-chest-reveal when cardGrants is empty (cap reached)', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true,
      cardGrants: [],
      bonuses: [],
      trophies: [],
      xp: { gained: 50, level: 1, leveledUp: false },
    });

    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Test"
        levels={[bossLevel]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    await driveToFanfare();

    // LevelFanfare renders, but no card reveal
    expect(await screen.findByTestId('fanfare')).toBeInTheDocument();
    expect(screen.queryByTestId('card-chest-reveal')).not.toBeInTheDocument();
  });

  it('shows chest=true on fanfare when boss cleared', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true,
      cardGrants: [],
      bonuses: [],
      trophies: [],
      xp: { gained: 50, level: 1, leveledUp: false },
    });

    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Test"
        levels={[bossLevel]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    await driveToFanfare();

    const fanfare = await screen.findByTestId('fanfare');
    expect(fanfare).toHaveAttribute('data-chest', 'true');
  });

  it('does not show card-chest-reveal when cardGrants=[] on non-boss', async () => {
    const flashcardLevel = {
      id: 'l-flash',
      position: 0,
      sceneType: 'flashcard' as const,
      config: { characterId: 'c1', segment: 'review' },
    };

    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: false,
      freePullClaimed: false,
      cardGrants: [],
      bonuses: [],
      trophies: [],
      xp: { gained: 0, level: 1, leveledUp: false },
    });

    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Test"
        levels={[flashcardLevel]}
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

    const fanfare = await screen.findByTestId('fanfare');
    // Non-boss → chest=false
    expect(fanfare).toHaveAttribute('data-chest', 'false');
    expect(screen.queryByTestId('card-chest-reveal')).not.toBeInTheDocument();
  });
});
