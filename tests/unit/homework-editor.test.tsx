import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/homework', () => ({
  addHomeworkItemAction: vi.fn().mockResolvedValue('h2'),
  deleteHomeworkItemAction: vi.fn().mockResolvedValue(undefined),
  reorderHomeworkItemsAction: vi.fn().mockResolvedValue(undefined),
}));

import { HomeworkEditor } from '@/components/parent/HomeworkEditor';
import { deleteHomeworkItemAction } from '@/lib/actions/homework';

describe('HomeworkEditor', () => {
  it('lists existing items and deletes one', async () => {
    render(
      <HomeworkEditor
        weekId="w1"
        items={[{ id: 'h1', type: 'sentence_order', summary: '我 / 爱 / 你' }]}
      />,
    );
    expect(screen.getByText('我 / 爱 / 你')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(deleteHomeworkItemAction).toHaveBeenCalledWith('w1', 'h1'));
  });
});
