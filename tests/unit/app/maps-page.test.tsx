import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'child_1' } }),
}));
vi.mock('@/lib/db/maps', () => ({
  listMapsForChild: vi.fn().mockResolvedValue([]),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/actions/maps', () => ({
  switchMapAction: vi.fn().mockResolvedValue(undefined),
}));

import MapsPage from '@/app/play/[childId]/maps/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MapsPage', () => {
  it('renders for a valid child', async () => {
    const result = await MapsPage({
      params: Promise.resolve({ childId: 'child_1' }),
    });
    expect(result).toBeDefined();
  });
});
