import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  equipSoundThemeAction: vi.fn(),
  purchaseShopItemAction: vi.fn(),
  playSound: vi.fn(),
  setAudioTheme: vi.fn(),
  getTheme: vi.fn(),
}));

vi.mock('@/lib/actions/settings', () => ({
  equipSoundThemeAction: mocks.equipSoundThemeAction,
}));
vi.mock('@/lib/actions/shop', () => ({
  purchaseShopItemAction: mocks.purchaseShopItemAction,
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: mocks.playSound,
  setAudioTheme: mocks.setAudioTheme,
}));
vi.mock('@/lib/audio/themes', () => ({
  getTheme: mocks.getTheme,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { SoundsTabBody } from '@/components/shop/SoundsTabBody';

const listings = [
  {
    shopItem: {
      id: 'item-1',
      slug: 'theme-music-box',
      kind: 'sound_theme',
      name: '音乐盒 / Music Box',
      description: 'Mellow chimes',
      imageUrl: '🎼',
      priceCoins: 200,
    },
  },
  {
    shopItem: {
      id: 'item-2',
      slug: 'theme-nautical',
      kind: 'sound_theme',
      name: '海上钟 / Nautical',
      description: 'Bells and foghorn',
      imageUrl: '⚓',
      priceCoins: 250,
    },
  },
] as unknown as import('@/lib/db/shop').SoundThemeListing[];

afterEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe('SoundsTabBody', () => {
  it('renders a default card plus one card per listing', () => {
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );
    expect(screen.getByText(/Music Box/i)).toBeInTheDocument();
    expect(screen.getByText(/Nautical/i)).toBeInTheDocument();
    expect(screen.getByText(/默认|Default/i)).toBeInTheDocument();
  });

  it('marks the equipped theme as 已装备', () => {
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['item-2'])}
        coinBalance={500}
        equippedThemeSlug="theme-nautical"
      />,
    );
    const nauticalCard = screen.getByText(/Nautical/i).closest('article')!;
    expect(nauticalCard).toHaveTextContent(/已装备|Equipped/);
  });

  it('preview button looks up the theme via getTheme', () => {
    mocks.getTheme.mockReturnValue({ ding: vi.fn(), buzz: vi.fn(), fanfare: vi.fn() });
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );
    const previewButtons = screen.getAllByRole('button', { name: /preview|试听/i });
    fireEvent.click(previewButtons[0]);
    expect(mocks.getTheme).toHaveBeenCalled();
  });

  it('clicking an owned (but not equipped) card calls equipSoundThemeAction', async () => {
    mocks.equipSoundThemeAction.mockResolvedValue({ themeSlug: 'theme-nautical', trophies: [] });
    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['item-2'])}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );
    // The Nautical card should have an Equip button (not Buy, not Equipped).
    const equipButton = screen.getByRole('button', { name: /装备 \/ Equip/i });
    fireEvent.click(equipButton);
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.equipSoundThemeAction).toHaveBeenCalledWith('c1', 'theme-nautical');
  });
});

describe('SoundsTabBody preview await (PR #51)', () => {
  it('awaits ctx.resume() before calling theme.ding(ctx)', async () => {
    let resumeResolve!: () => void;
    const resumePromise = new Promise<void>((res) => {
      resumeResolve = res;
    });
    const resume = vi.fn().mockReturnValue(resumePromise);
    const ding = vi.fn();

    mocks.getTheme.mockReturnValue({ ding, buzz: vi.fn(), fanfare: vi.fn() });

    // Must be a real constructor (not arrow fn) so `new FakeCtx()` works
    function FakeCtx(this: { state: string; resume: typeof resume }) {
      this.state = 'suspended';
      this.resume = resume;
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeCtx,
    });

    render(
      <SoundsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );

    const previewButtons = screen.getAllByRole('button', { name: /preview|试听/i });
    await userEvent.click(previewButtons[0]);

    // Before resume resolves: resume called, ding NOT yet called
    expect(resume).toHaveBeenCalledTimes(1);
    expect(ding).toHaveBeenCalledTimes(0);

    // Resolve the resume promise and flush microtasks
    resumeResolve();
    await new Promise((r) => setTimeout(r, 0));

    // After resume resolves: ding called exactly once
    expect(ding).toHaveBeenCalledTimes(1);

    // resume must have been called before ding in invocation order
    expect(resume.mock.invocationCallOrder[0]).toBeLessThan(
      ding.mock.invocationCallOrder[0],
    );
  });
});
