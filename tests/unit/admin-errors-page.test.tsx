// C3 — the read side of the error log.
//
// The point of this page is to be useful at the moment something has already
// broken, so what it must never do is make a quiet period look like a healthy
// one, or a healthy one look quiet.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ groups: vi.fn(), instances: vi.fn() }));
vi.mock('@/lib/db/error-events', () => ({
  listErrorGroups: (...a: unknown[]) => mocks.groups(...a),
  listErrorInstances: (...a: unknown[]) => mocks.instances(...a),
  ERROR_WINDOW_DAYS: 7,
}));

import AdminErrorsPage from '@/app/admin/errors/page';

const group = (over: Partial<Record<string, unknown>> = {}) => ({
  scope: 'finishAttemptAction:practice-card',
  count: 12,
  lastSeen: new Date('2026-09-05T10:00:00Z'),
  lastMessage: 'duplicate key value violates unique constraint',
  ...over,
});

async function renderPage(searchParams: Record<string, string> = {}) {
  const ui = await AdminErrorsPage({ searchParams: Promise.resolve(searchParams) });
  return render(ui);
}

describe('AdminErrorsPage', () => {
  // Without this, a call made by an earlier test leaks into the "must not be
  // called" assertion below and it passes or fails on test ORDER.
  beforeEach(() => vi.clearAllMocks());

  it('lists each failing scope with how often it fired', async () => {
    mocks.groups.mockResolvedValue([group()]);
    mocks.instances.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText('finishAttemptAction:practice-card')).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('says the window out loud when there is nothing to show', async () => {
    // "No errors" and "no errors IN THE LAST 7 DAYS" are different claims, and
    // only one of them is true. A silent empty page would let a fortnight-old
    // outage read as a clean bill of health.
    mocks.groups.mockResolvedValue([]);
    mocks.instances.mockResolvedValue([]);
    await renderPage();
    const body = screen.getByTestId('admin-errors').textContent ?? '';
    expect(body).toMatch(/7/);
  });

  it('shows the stack of a selected scope, so it can actually be diagnosed', async () => {
    mocks.groups.mockResolvedValue([group()]);
    mocks.instances.mockResolvedValue([
      {
        id: 'e1',
        message: 'duplicate key value violates unique constraint',
        stack: 'Error: duplicate key\n    at pullCardInTx (grants.ts:120:5)',
        childId: null,
        createdAt: new Date('2026-09-05T10:00:00Z'),
      },
    ]);
    await renderPage({ scope: 'finishAttemptAction:practice-card' });
    expect(screen.getByTestId('admin-errors').textContent).toContain('pullCardInTx');
  });

  it('does not query instances until a scope is selected', async () => {
    // The list view is the cheap one; pulling every stack for every scope on
    // first paint would make the page slowest exactly when it is needed most.
    mocks.groups.mockResolvedValue([group()]);
    mocks.instances.mockResolvedValue([]);
    await renderPage();
    expect(mocks.instances).not.toHaveBeenCalled();
  });

  it('never renders a child display name', async () => {
    // /admin is the one cross-account surface in the product. An error row can
    // carry a childId; it must not become a name here.
    mocks.groups.mockResolvedValue([group()]);
    mocks.instances.mockResolvedValue([
      {
        id: 'e1',
        message: 'boom',
        stack: null,
        childId: 'aaaaaaaa-0000-4000-a000-000000000001',
        createdAt: new Date('2026-09-05T10:00:00Z'),
      },
    ]);
    await renderPage({ scope: 'finishAttemptAction:practice-card' });
    const body = screen.getByTestId('admin-errors').textContent ?? '';
    expect(body).toContain('aaaaaaaa');
    expect(body).not.toMatch(/displayName|Yinuo/i);
  });
});
