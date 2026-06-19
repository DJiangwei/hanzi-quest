import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// 'use server' actions pull in @/db — mock them to plain fns (used as form actions).
vi.mock('@/lib/actions/entry', () => ({
  chooseKidEntryAction: vi.fn(),
  chooseParentEntryAction: vi.fn(),
}));

import { EntryChooser } from '@/components/EntryChooser';

describe('EntryChooser', () => {
  it('shows a single big Play button (with the child name) and a Parent button', () => {
    render(<EntryChooser players={[{ id: 'c1', displayName: 'Yinuo' }]} />);
    expect(screen.getByText('开始游戏')).toBeInTheDocument();
    expect(screen.getByText(/Play · Yinuo/)).toBeInTheDocument();
    // Parent option is bilingual (中文 + English).
    expect(screen.getByText('家长')).toBeInTheDocument();
    expect(screen.getByText('/ Parent')).toBeInTheDocument();
  });

  it('lists each child for a multi-child account', () => {
    render(
      <EntryChooser
        players={[
          { id: 'c1', displayName: 'Mei' },
          { id: 'c2', displayName: 'Lin' },
        ]}
      />,
    );
    expect(screen.getByText('Mei')).toBeInTheDocument();
    expect(screen.getByText('Lin')).toBeInTheDocument();
    // 3 forms: one per child + the parent option.
    expect(document.querySelectorAll('form')).toHaveLength(3);
  });

  it('shows only the Parent option when there are no children', () => {
    render(<EntryChooser players={[]} />);
    expect(screen.queryByText('开始游戏')).not.toBeInTheDocument();
    expect(screen.getByText('家长')).toBeInTheDocument();
    expect(document.querySelectorAll('form')).toHaveLength(1);
  });
});
