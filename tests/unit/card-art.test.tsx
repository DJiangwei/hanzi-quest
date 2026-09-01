import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardArt } from '@/components/play/items/CardArt';

describe('CardArt', () => {
  it('renders an <img> when imageUrl is a real http(s) URL', () => {
    render(
      <CardArt
        imageUrl="https://blob.example.com/collectibles/abc.png"
        emoji="🦖"
        owned
        size="md"
        alt="Tyrannosaurus Rex"
      />,
    );
    const img = screen.getByAltText('Tyrannosaurus Rex');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute(
      'src',
      'https://blob.example.com/collectibles/abc.png',
    );
    // The emoji glyph must NOT be rendered when a real image is present.
    expect(screen.queryByText('🦖')).not.toBeInTheDocument();
  });

  it('falls back to the emoji glyph when imageUrl is null', () => {
    render(<CardArt imageUrl={null} emoji="🦖" owned size="md" alt="Rex" />);
    expect(screen.getByText('🦖')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('falls back to the emoji glyph when imageUrl is a non-http string (emoji)', () => {
    render(<CardArt imageUrl="🗽" emoji="🗽" owned size="md" alt="Statue" />);
    // No <img>; the glyph renders as text.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🗽')).toBeInTheDocument();
  });

  it('desaturates the image when not owned', () => {
    const { container } = render(
      <CardArt
        imageUrl="https://blob.example.com/x.png"
        emoji="🦖"
        owned={false}
        size="sm"
        alt="locked"
      />,
    );
    const wrapper = container.querySelector('div');
    expect(wrapper?.className).toContain('grayscale');
    expect(wrapper?.className).toContain('opacity-40');
  });
});

// ── Zodiac ──────────────────────────────────────────────────────────────────
// zodiac-v1 is the only pack whose art is a procedural SVG rather than a photo
// or an emoji: all 12 cards have image_url = NULL, and it is the only one of 15
// packs with no `resolveRevealEmoji`. CardArt therefore fell through to the
// pack's single themeEmoji and drew the SAME 🐲 for every animal — which made
// the zodiac study lesson unanswerable (four identical picture choices) and
// showed a generic dragon in every zodiac chest reveal.
describe('CardArt — zodiac', () => {
  it('draws the per-animal ZodiacIcon, not the pack emoji', () => {
    const { container } = render(
      <CardArt
        packSlug="zodiac-v1"
        slug="rat"
        imageUrl={null}
        emoji="🐲"
        owned
        size="md"
        alt="Rat"
      />,
    );
    expect(container.querySelector('use')).toHaveAttribute('href', '#z-rat');
    expect(container.textContent).not.toContain('🐲');
  });

  it('draws TWELVE DISTINCT glyphs for the twelve animals', () => {
    // The regression in one assertion: before the fix this collapsed to a
    // single 🐲 repeated twelve times.
    const slugs = ['rat','ox','tiger','rabbit','dragon','snake','horse','sheep','monkey','rooster','dog','pig'];
    const hrefs = slugs.map((slug) => {
      const { container, unmount } = render(
        <CardArt packSlug="zodiac-v1" slug={slug} imageUrl={null} emoji="🐲" owned size="md" alt={slug} />,
      );
      const href = container.querySelector('use')?.getAttribute('href');
      unmount();
      return href;
    });
    expect(new Set(hrefs).size).toBe(12);
  });

  it('still prefers real art when a zodiac card ever gets an image', () => {
    const { container } = render(
      <CardArt
        packSlug="zodiac-v1"
        slug="rat"
        imageUrl="https://example.com/rat.png"
        emoji="🐲"
        owned
        size="md"
        alt="Rat"
      />,
    );
    expect(container.querySelector('img')).toBeInTheDocument();
    expect(container.querySelector('use')).toBeNull();
  });

  it('leaves every other pack on the emoji path', () => {
    const { container } = render(
      <CardArt packSlug="flags-v1" slug="gb" imageUrl={null} emoji="🇬🇧" owned size="md" alt="UK" />,
    );
    expect(container.querySelector('use')).toBeNull();
    expect(container.textContent).toContain('🇬🇧');
  });

  it('falls back to the emoji for an unknown zodiac slug rather than a broken <use>', () => {
    const { container } = render(
      <CardArt packSlug="zodiac-v1" slug="unicorn" imageUrl={null} emoji="🐲" owned size="md" alt="?" />,
    );
    expect(container.querySelector('use')).toBeNull();
    expect(container.textContent).toContain('🐲');
  });
});
