import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireChild = vi.fn(async (childId: string) => ({ parent: { id: 'p' }, child: { id: childId } }));
vi.mock('@/lib/auth/guards', () => ({ requireChild: (childId: string) => requireChild(childId) }));
const redirect = vi.fn();
const notFound = vi.fn(() => { throw new Error('notFound'); });
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a), notFound: () => notFound() }));
const getPackBySlug = vi.fn();
const listChildCollection = vi.fn();
const listPackItems = vi.fn();
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
  listChildCollection: (...a: unknown[]) => listChildCollection(...a),
  listPackItems: (...a: unknown[]) => listPackItems(...a),
}));
vi.mock('@/components/play/StudyRunner', () => ({ StudyRunner: () => <div data-testid="study-runner" /> }));

import StudyPage from '@/app/play/[childId]/collection/[packSlug]/study/page';

beforeEach(() => {
  vi.clearAllMocks();
  getPackBySlug.mockResolvedValue({ id: 'pk', slug: 'animals-v1', name: '动物' });
});

describe('study route', () => {
  it('redirects back to the pack page when the child owns fewer than 3', async () => {
    listChildCollection.mockResolvedValue([{ id: 'a', slug: 'fox', nameZh: '狐狸', nameEn: 'Fox', imageUrl: null }]);
    listPackItems.mockResolvedValue([]);
    await StudyPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'animals-v1' }) });
    expect(redirect).toHaveBeenCalledWith('/play/c1/collection/animals-v1');
  });
  it('renders the runner when the child owns 3+', async () => {
    const owned = ['a', 'b', 'c'].map((id) => ({ id, slug: id, nameZh: id, nameEn: id, imageUrl: null }));
    listChildCollection.mockResolvedValue(owned);
    listPackItems.mockResolvedValue(owned);
    const ui = await StudyPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'animals-v1' }) });
    const { render, screen } = await import('@testing-library/react');
    render(ui);
    expect(screen.getByTestId('study-runner')).toBeInTheDocument();
  });
});
