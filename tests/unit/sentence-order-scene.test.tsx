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
});
