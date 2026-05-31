import { describe, expect, it, vi } from 'vitest';

describe('retire-visual-pick script', () => {
  it('updates scene_templates.is_active to false for type=visual_pick', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 't1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    vi.doMock('@/db', () => ({
      db: { update },
    }));

    const { retireVisualPick } = await import('../../scripts/retire-visual-pick');
    const result = await retireVisualPick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ isActive: false });
    expect(result.updated).toBe(1);
  });
});
