// The parent PIN gate must never dead-end a child: the unlock page renders
// direct kid-entry buttons, and the secured layout header offers 进入游戏.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('@/lib/auth/bootstrap', () => ({ ensureUserBootstrapped: vi.fn() }));
vi.mock('@/lib/db/parent-settings', () => ({ getParentSettings: vi.fn() }));
vi.mock('@/lib/db/children', () => ({ listChildrenForUser: vi.fn() }));
vi.mock('@/lib/actions/entry', () => ({
  chooseKidEntryAction: vi.fn(),
  chooseParentEntryAction: vi.fn(),
}));
vi.mock('@/app/parent/unlock/ParentUnlockForm', () => ({
  ParentUnlockForm: () => null,
}));

import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import { listChildrenForUser } from '@/lib/db/children';
import ParentUnlockPage from '@/app/parent/unlock/page';

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(ensureUserBootstrapped).mockResolvedValue({ id: 'user_abc' });
  asMock(getParentSettings).mockResolvedValue({ parentPinHash: 'x' });
});

async function renderPage() {
  const ui = await ParentUnlockPage({ searchParams: Promise.resolve({}) });
  render(ui);
}

describe('ParentUnlockPage kid escape hatch', () => {
  it('renders a bilingual 开始游戏 button for the child on the PIN screen', async () => {
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
    ]);
    await renderPage();
    const section = screen.getByTestId('unlock-kid-entry');
    expect(section.textContent).toContain('开始游戏');
    expect(section.textContent).toContain('Play');
    expect(section.textContent).toContain('不用 PIN');
  });

  it('lists one button per child on multi-child accounts', async () => {
    asMock(listChildrenForUser).mockResolvedValue([
      { id: 'child_1', displayName: 'Yinuo' },
      { id: 'child_2', displayName: 'E2E测试' },
    ]);
    await renderPage();
    expect(screen.getAllByRole('button', { name: /开始游戏/ })).toHaveLength(2);
    expect(screen.getByTestId('unlock-kid-entry').textContent).toContain('Yinuo');
  });

  it('hides the section when the account has no children yet', async () => {
    asMock(listChildrenForUser).mockResolvedValue([]);
    await renderPage();
    expect(screen.queryByTestId('unlock-kid-entry')).toBeNull();
  });
});
