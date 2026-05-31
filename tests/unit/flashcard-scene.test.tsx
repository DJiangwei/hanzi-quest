// tests/unit/flashcard-scene.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('renders the hanzi with the PR #51 fontSize clamp', () => {
    render(<FlashcardScene data={data} onComplete={() => undefined} />);
    const btn = screen.getByRole('button', { name: /Play audio for 海/i });
    expect(btn.className).toContain('text-[clamp(8rem,42vw,16rem)]');
  });
});

describe('FlashcardScene speech', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let speak: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cancel = vi.fn();
    speak = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    class StubUtterance {
      text: string;
      lang = '';
      rate = 1;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: StubUtterance,
    });
  });

  const data = { hanzi: '海', pinyin: ['hǎi'], meaningEn: 'sea', meaningZh: '海洋', imageHook: null };

  it('tapping the big hanzi triggers speech with the hanzi text', async () => {
    render(<FlashcardScene data={data} onComplete={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Play audio for 海/i }));
    expect(speak).toHaveBeenCalledTimes(1);
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('海');
    expect(utt.lang).toBe('zh-CN');
  });
});
