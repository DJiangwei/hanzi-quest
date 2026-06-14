import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const speakMock = vi.fn();
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => speakMock }));
// Browser TTS NOT supported — proves the clip path still renders/plays.
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => false }));

import { SpeakButton } from '@/components/play/SpeakButton';

describe('SpeakButton with a pre-recorded clip', () => {
  it('renders even when TTS is unsupported, and speaks with the clip URL', () => {
    render(<SpeakButton text="大象" audioUrl="https://blob/audio/x.mp3" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(speakMock).toHaveBeenCalledWith('大象', 'https://blob/audio/x.mp3');
  });

  it('renders nothing when TTS unsupported AND no clip', () => {
    const { container } = render(<SpeakButton text="大象" />);
    expect(container.firstChild).toBeNull();
  });
});
