import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeakButton } from '@/components/play/SpeakButton';

describe('SpeakButton', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let speak: ReturnType<typeof vi.fn>;
  let originalSpeech: SpeechSynthesis | undefined;
  let originalUtterance: typeof SpeechSynthesisUtterance | undefined;

  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
    originalUtterance = window.SpeechSynthesisUtterance;
    cancel = vi.fn();
    speak = vi.fn();
    // jsdom does not ship SpeechSynthesisUtterance — provide a minimal stub
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class SpeechSynthesisUtterance {
        text: string;
        lang: string = '';
        rate: number = 1;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });

  afterEach(() => {
    if (originalSpeech !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeech,
      });
    }
    if (originalUtterance !== undefined) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: originalUtterance,
      });
    }
  });

  it('renders null when speechSynthesis is undefined', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });
    const { container } = render(<SpeakButton text="妈" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a button when speechSynthesis is present', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls speak() with the configured text on click', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" />);
    await userEvent.click(screen.getByRole('button'));
    expect(speak).toHaveBeenCalledTimes(1);
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('妈');
  });

  it('applies default aria-label "Read aloud"', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Read aloud');
  });

  it('applies aria-label override when label prop is provided', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" label="Play sound" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play sound');
  });

  it('renders text label only for size="md"', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    const { rerender } = render(<SpeakButton text="妈" size="md" />);
    expect(screen.getByText(/Read aloud/i)).toBeInTheDocument();
    rerender(<SpeakButton text="妈" size="sm" />);
    expect(screen.queryByText(/Read aloud/i)).toBeNull();
  });
});
