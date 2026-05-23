import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { PetCompanion } from '@/components/play/PetCompanion';

const parrot = {
  emoji: '🦜',
  nameZh: '鹦鹉',
  nameEn: 'Parrot',
  speechZh: ['加油！', '你真棒！'],
  speechEn: ['Keep going!', "You're amazing!"],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('PetCompanion', () => {
  it('renders the emoji when a pet is provided', () => {
    render(<PetCompanion pet={parrot} />);
    expect(screen.getByText('🦜')).toBeInTheDocument();
  });

  it('renders nothing when pet is null', () => {
    const { container } = render(<PetCompanion pet={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a bilingual speech bubble on tap', () => {
    render(<PetCompanion pet={parrot} />);
    fireEvent.click(screen.getByRole('button', { name: /鹦鹉|Parrot/i }));
    // One of the 2 phrases should appear (random index). Assert both halves of the SAME index.
    const zh = screen.queryByText('加油！') ?? screen.queryByText('你真棒！');
    const en = screen.queryByText('Keep going!') ?? screen.queryByText("You're amazing!");
    expect(zh).toBeInTheDocument();
    expect(en).toBeInTheDocument();
  });

  it('bubble disappears after the timeout', () => {
    render(<PetCompanion pet={parrot} />);
    fireEvent.click(screen.getByRole('button', { name: /鹦鹉|Parrot/i }));
    expect(screen.queryByText(/加油|你真棒/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByText(/加油|你真棒/)).not.toBeInTheDocument();
  });
});
