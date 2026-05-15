// tests/unit/wood-sign-button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

describe('WoodSignButton', () => {
  it('renders children and forwards onClick', async () => {
    const onClick = vi.fn();
    render(<WoodSignButton onClick={onClick}>Sail!</WoodSignButton>);
    const btn = screen.getByRole('button', { name: 'Sail!' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies size class for md (default) and lg', () => {
    const { rerender } = render(<WoodSignButton>x</WoodSignButton>);
    let btn = screen.getByRole('button');
    expect(btn.className).toMatch(/py-4|py-3/);
    rerender(<WoodSignButton size="lg">x</WoodSignButton>);
    btn = screen.getByRole('button');
    expect(btn.className).toMatch(/py-5|py-6/);
  });

  it('disabled state blocks onClick', async () => {
    const onClick = vi.fn();
    render(
      <WoodSignButton onClick={onClick} disabled>
        x
      </WoodSignButton>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
