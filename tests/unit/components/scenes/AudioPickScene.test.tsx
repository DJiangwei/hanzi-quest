import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioPickScene } from '@/components/scenes/AudioPickScene';

describe('AudioPickScene', () => {
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

  const target = { characterId: 't', hanzi: '妈', pinyinArray: ['mā'] };
  const pool = [
    target,
    { characterId: 'd1', hanzi: '马', pinyinArray: ['mǎ'] },
    { characterId: 'd2', hanzi: '麻', pinyinArray: ['má'] },
    { characterId: 'd3', hanzi: '骂', pinyinArray: ['mà'] },
  ];

  it('tapping the play button speaks the target hanzi', async () => {
    render(<AudioPickScene target={target} pool={pool} onComplete={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /play audio/i }));
    expect(speak).toHaveBeenCalledTimes(1);
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('妈');
    expect(utt.lang).toBe('zh-CN');
  });
});
