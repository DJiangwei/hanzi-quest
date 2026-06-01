import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwapDialog } from '@/components/play/SwapDialog';

describe('SwapDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    itemNameZh: '法国',
    itemNameEn: 'France',
    shardCost: 3,
    shardBalance: 5,
    onConfirm: vi.fn(),
  };

  it('shows cost and remaining shards', () => {
    render(<SwapDialog {...baseProps} />);
    expect(screen.getByText(/3/)).toBeInTheDocument(); // cost
    expect(screen.getByText(/5/)).toBeInTheDocument(); // balance
  });

  it('renders the item name in both languages', () => {
    render(<SwapDialog {...baseProps} />);
    expect(screen.getByText(/法国/)).toBeInTheDocument();
    expect(screen.getByText(/France/)).toBeInTheDocument();
  });

  it('confirm button calls onConfirm when sufficient shards', async () => {
    const onConfirm = vi.fn();
    render(<SwapDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm|换/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirm button is disabled when insufficient shards', () => {
    render(<SwapDialog {...baseProps} shardBalance={2} />);
    const confirm = screen.getByRole('button', { name: /confirm|换/i });
    expect(confirm).toBeDisabled();
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    render(<SwapDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel|取消/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when open=false', () => {
    const { container } = render(<SwapDialog {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });
});
