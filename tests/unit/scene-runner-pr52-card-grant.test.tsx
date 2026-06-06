// tests/unit/scene-runner-pr52-card-grant.test.tsx
// PR #52: chest is unconditional on boss clear; cardGrant threads through to LevelFanfare
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock LevelFanfare with data attributes to verify props
vi.mock('@/components/scenes/fx/LevelFanfare', () => ({
  LevelFanfare: (props: {
    chestAvailable: boolean;
    cardGrant?: { granted: boolean } | null;
  }) => (
    <div
      data-testid="fanfare"
      data-chest={String(props.chestAvailable)}
      data-card-granted={props.cardGrant == null ? '' : String(props.cardGrant.granted)}
    />
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

  return screen.findByTestId('fanfare');
}

describe('SceneRunner card grant (PR #52)', () => {
  it('shows chest unconditionally on boss clear (chest=true regardless of freePullClaimed)', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true, // PR #51 would have hidden chest; PR #52 ignores this
      cardGrant: null,
      bonuses: [],
      trophies: [],
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

    const fanfare = await driveToFanfare();
    expect(fanfare).toHaveAttribute('data-chest', 'true');
    // No cardGrant → data-card-granted should be empty string
    expect(fanfare).toHaveAttribute('data-card-granted', '');
  });

  it('passes cardGrant.granted=true to LevelFanfare when card was granted', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true,
      cardGrant: {
        granted: true,
        itemId: 'item-x',
        packId: 'pack-x',
        packSlug: 'flags',
        slug: 'flag-cn',
        nameZh: '中国',
        nameEn: 'China',
        loreZh: null,
        loreEn: null,
        isDupe: false,
        shardsAfter: 0,
        cardsToday: 1,
      },
      bonuses: [],
      trophies: [],
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

    const fanfare = await driveToFanfare();
    expect(fanfare).toHaveAttribute('data-chest', 'true');
    expect(fanfare).toHaveAttribute('data-card-granted', 'true');
  });

  it('passes cardGrant.granted=false to LevelFanfare when cap is reached', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true,
      cardGrant: {
        granted: false,
        reason: 'daily_cap_reached',
        cardsToday: 3,
      },
      bonuses: [],
      trophies: [],
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

    const fanfare = await driveToFanfare();
    expect(fanfare).toHaveAttribute('data-chest', 'true');
    expect(fanfare).toHaveAttribute('data-card-granted', 'false');
  });

  it('does not set cardGrant when finishLevelAction returns cardGrant=null (non-boss)', async () => {
    // Non-boss level — finishLevelAction returns null cardGrant
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: false,
      freePullClaimed: false,
      cardGrant: null,
      bonuses: [],
      trophies: [],
    });

    const flashcardLevel = {
      id: 'l-flash',
      position: 0,
      sceneType: 'flashcard' as const,
      config: { characterId: 'c1', segment: 'review' },
    };

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
    // Non-boss → chest=false, no cardGrant
    expect(fanfare).toHaveAttribute('data-chest', 'false');
    expect(fanfare).toHaveAttribute('data-card-granted', '');
  });
});
