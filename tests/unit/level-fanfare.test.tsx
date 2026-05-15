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

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';
import { LevelFanfare } from '@/components/scenes/fx/LevelFanfare';

describe('LevelFanfare', () => {
  it('renders Lottie + headline + coins line + Back-to-map when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <LevelFanfare
        weekLabel="Lesson 5"
        coinsThisSession={120}
        onContinue={() => undefined}
      />,
    );
    expect(screen.getByTestId('lottie')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Island cleared/i })).toBeInTheDocument();
    expect(screen.getByText(/Lesson 5/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to map/i })).toBeInTheDocument();
  });

  it('omits Lottie + skips fanfare sound when reduced-motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    vi.mocked(playSound).mockClear();
    render(
      <LevelFanfare weekLabel="Lesson 5" coinsThisSession={120} onContinue={() => undefined} />,
    );
    expect(screen.queryByTestId('lottie')).not.toBeInTheDocument();
    expect(screen.getByText('🎉')).toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('calls playSound("fanfare") on mount when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    vi.mocked(playSound).mockClear();
    render(
      <LevelFanfare weekLabel="x" coinsThisSession={1} onContinue={() => undefined} />,
    );
    expect(playSound).toHaveBeenCalledWith('fanfare');
  });
});
