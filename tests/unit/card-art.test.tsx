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
