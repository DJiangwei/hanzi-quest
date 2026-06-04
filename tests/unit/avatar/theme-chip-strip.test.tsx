import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeChipStrip } from '@/components/shop/ThemeChipStrip';

describe('ThemeChipStrip', () => {
  it('renders All + Pirate + Caribbean chips', () => {
    render(<ThemeChipStrip selected="all" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pirate|海盗/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Caribbean|加勒比/i })).toBeInTheDocument();
  });

  it('highlights the currently-selected chip via aria-pressed', () => {
    render(<ThemeChipStrip selected="pirate" onSelect={() => undefined} />);
    const pirate = screen.getByRole('button', { name: /Pirate|海盗/i });
    expect(pirate.getAttribute('aria-pressed')).toBe('true');
    const all = screen.getByRole('button', { name: /All/i });
    expect(all.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelect with the chip value on click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ThemeChipStrip selected="all" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Caribbean|加勒比/i }));
    expect(onSelect).toHaveBeenCalledWith('caribbean');
  });
});
