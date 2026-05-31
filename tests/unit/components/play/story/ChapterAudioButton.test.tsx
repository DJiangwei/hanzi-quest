import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChapterAudioButton } from '@/components/play/story/ChapterAudioButton';

describe('ChapterAudioButton', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the audio button when speechSynthesis is available', async () => {
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    render(<ChapterAudioButton text="你好" />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /read aloud|读/i }),
      ).toBeInTheDocument(),
    );
  });

  it('renders nothing when speechSynthesis is unavailable', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const { container } = render(<ChapterAudioButton text="你好" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls speechSynthesis.speak with a zh-CN utterance on click', async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        lang = '';
        rate = 1;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    render(<ChapterAudioButton text="你好" />);
    const button = await waitFor(() =>
      screen.getByRole('button', { name: /read aloud/i }),
    );
    fireEvent.click(button);
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledOnce();
    const utt = speak.mock.calls[0][0];
    expect(utt.text).toBe('你好');
    expect(utt.lang).toBe('zh-CN');
    expect(utt.rate).toBeLessThan(1);
  });
});
