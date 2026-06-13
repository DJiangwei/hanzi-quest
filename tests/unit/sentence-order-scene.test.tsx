import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentenceOrderScene } from '@/components/scenes/SentenceOrderScene';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

describe('SentenceOrderScene', () => {
  it('renders one chip per token + bilingual prompt', () => {
    render(<SentenceOrderScene tokens={['我', '爱', '你']} onComplete={() => {}} />);
    expect(screen.getByText('连词成句', { exact: false })).toBeInTheDocument();
    for (const t of ['我', '爱', '你']) {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
    }
  });

  it('calls onComplete(true) when tapped in the correct order', () => {
    const onComplete = vi.fn();
    render(<SentenceOrderScene tokens={['我', '爱', '你']} onComplete={onComplete} />);
    screen.getByRole('button', { name: '我' }).click();
    screen.getByRole('button', { name: '爱' }).click();
    screen.getByRole('button', { name: '你' }).click();
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('shuffles the visual order — n=3 chips are NOT rendered in token order', () => {
    // The pool buttons render in DOM/token order; the visual shuffle is applied
    // via inline `order`. A regression guard: order must NOT be the identity
    // [0,1,2] (which would show the answer already in sequence).
    render(<SentenceOrderScene tokens={['我', '爱', '你']} onComplete={() => {}} />);
    const orders = ['我', '爱', '你'].map(
      (t) => screen.getByRole('button', { name: t }).style.order,
    );
    expect(orders).not.toEqual(['0', '1', '2']);
  });
});
