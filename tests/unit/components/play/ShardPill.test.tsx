import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShardPill } from '@/components/play/ShardPill';

describe('ShardPill', () => {
  it('renders the shard count with emoji', () => {
    render(<ShardPill count={5} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/🔹/)).toBeInTheDocument();
  });

  it('renders 0 when count is 0', () => {
    render(<ShardPill count={0} />);
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  it('has an accessible label', () => {
    render(<ShardPill count={12} />);
    expect(screen.getByLabelText(/12 shards/i)).toBeInTheDocument();
  });
});
