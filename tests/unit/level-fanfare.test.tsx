// tests/unit/level-fanfare.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie" />,
}));
vi.mock('@/lib/actions/gacha', () => ({
  pullFreeFromBoss: vi.fn(),
  AlreadyClaimedError: class extends Error {},
}));
vi.mock('./TreasureChestReveal', () => ({
  TreasureChestReveal: () => <div data-testid="treasure-chest-reveal" />,
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';
import { LevelFanfare } from '@/components/scenes/fx/LevelFanfare';

describe('LevelFanfare', () => {
  it('renders Lottie + headline + coins line + back button when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <LevelFanfare
        weekLabel="Lesson 5"
        coinsThisSession={120}
        childId="c1"
        weekId="w1"
        chestAvailable={false}
        onContinue={() => undefined}
      />,
    );
    expect(screen.getByTestId('lottie')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Island cleared/i })).toBeInTheDocument();
    expect(screen.getByText(/Lesson 5/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /回地图/ })).toBeInTheDocument();
  });

  it('omits Lottie + skips fanfare sound when reduced-motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    vi.mocked(playSound).mockClear();
    render(
      <LevelFanfare
        weekLabel="Lesson 5"
        coinsThisSession={120}
        childId="c1"
        weekId="w1"
        chestAvailable={false}
        onContinue={() => undefined}
      />,
    );
    expect(screen.queryByTestId('lottie')).not.toBeInTheDocument();
    expect(screen.getByText('🎉')).toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('calls playSound("fanfare") on mount when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    vi.mocked(playSound).mockClear();
    render(
      <LevelFanfare
        weekLabel="x"
        coinsThisSession={1}
        childId="c1"
        weekId="w1"
        chestAvailable={false}
        onContinue={() => undefined}
      />,
    );
    expect(playSound).toHaveBeenCalledWith('fanfare');
  });

  it('renders "开启宝箱" button when chestAvailable=true', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <LevelFanfare
        weekLabel="Lesson 5"
        coinsThisSession={300}
        childId="c1"
        weekId="w1"
        chestAvailable
        onContinue={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /开启宝箱/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /回地图/ })).toBeInTheDocument();
  });

  it('does NOT render chest button when chestAvailable=false', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <LevelFanfare
        weekLabel="Lesson 5"
        coinsThisSession={300}
        childId="c1"
        weekId="w1"
        chestAvailable={false}
        onContinue={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: /开启宝箱/ })).not.toBeInTheDocument();
  });
});
