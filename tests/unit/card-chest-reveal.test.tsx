import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import type { RevealCard } from '@/lib/play/reveal-card';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

const card = (over: Partial<RevealCard>): RevealCard => ({
  id: 'i1', slug: 'flag-cn', packSlug: 'flags', nameZh: '中国', nameEn: 'China',
  loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0, ...over,
});

describe('CardChestReveal', () => {
  it('opens a chest on tap and reveals the card', () => {
    render(<CardChestReveal cards={[card({})]} onDone={vi.fn()} />);
    // closed chest → open button
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));
    expect(screen.getByText('中国')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
  });

  it('advances through multiple cards then calls onDone', () => {
    const onDone = vi.fn();
    render(<CardChestReveal cards={[card({ id: 'a', nameEn: 'China' }), card({ id: 'b', nameZh: '美国', nameEn: 'USA' })]} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));      // open card 1
    fireEvent.click(screen.getByRole('button', { name: /下一个|next/i }));     // next
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));      // open card 2
    expect(screen.getByText('美国')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /继续|continue/i }));   // done
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('shows a duplicate→shard note for a duplicate', () => {
    render(<CardChestReveal cards={[card({ isDupe: true, shardsAfter: 3 })]} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));
    expect(screen.getByText(/重复卡/)).toBeInTheDocument();
  });

  it('renders nothing for an empty queue', () => {
    const { container } = render(<CardChestReveal cards={[]} onDone={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ── Zodiac ──────────────────────────────────────────────────────────────────
// emojiFor branched on `card.packSlug === 'zodiac'`, but the real pack slug is
// 'zodiac-v1'. That comparison was never true, so every zodiac card revealed
// the pack's generic 🐲 instead of its own animal — since the feature shipped.
// The fixtures below use the REAL slug on purpose: the previous one in this
// file ('flags') is a value production has never stored.
describe('CardChestReveal — zodiac', () => {
  const zodiacCard = (slug: string, nameZh: string, nameEn: string): RevealCard => ({
    id: `z-${slug}`,
    slug,
    packSlug: 'zodiac-v1',
    nameZh,
    nameEn,
    loreZh: null,
    loreEn: null,
    isDupe: false,
    shardsAfter: 0,
  });

  it('reveals the animal, not the pack emoji', () => {
    const { container } = render(
      <CardChestReveal cards={[zodiacCard('rat', '鼠', 'Rat')]} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));
    expect(container.querySelector('use')).toHaveAttribute('href', '#z-rat');
    expect(container.textContent).not.toContain('🐲');
  });

  it('reveals a DIFFERENT animal for a different card', () => {
    const { container } = render(
      <CardChestReveal cards={[zodiacCard('tiger', '虎', 'Tiger')]} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /开启|open/i }));
    expect(container.querySelector('use')).toHaveAttribute('href', '#z-tiger');
  });
});
