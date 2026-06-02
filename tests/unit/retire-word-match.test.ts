import { describe, expect, it, vi } from 'vitest';

describe('retire-word-match script', () => {
  it('updates scene_templates.is_active to false for type=word_match', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 't1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    vi.doMock('@/db', () => ({
      db: { update },
    }));

    const { retireWordMatch } = await import('../../scripts/retire-word-match');
    const result = await retireWordMatch();

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ isActive: false });
    expect(result.updated).toBe(1);
  });
});
