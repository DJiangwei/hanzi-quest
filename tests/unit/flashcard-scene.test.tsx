// tests/unit/flashcard-scene.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FlashcardScene } from '@/components/scenes/FlashcardScene';

describe('FlashcardScene', () => {
  const data = { hanzi: '海', pinyin: ['hǎi'], meaningEn: 'sea', meaningZh: '海洋', imageHook: null };

  it('renders the hanzi + Got-it button', () => {
    render(<FlashcardScene data={data} onComplete={() => undefined} />);
    expect(screen.getByText('海')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('renders inside a treasure-map backdrop (compass present)', () => {
    const { container } = render(<FlashcardScene data={data} onComplete={() => undefined} />);
    expect(container.querySelector('[data-testid="map-compass"]')).toBeTruthy();
  });

  it('Got-it button calls onComplete', async () => {
    const onComplete = vi.fn();
    render(<FlashcardScene data={data} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
