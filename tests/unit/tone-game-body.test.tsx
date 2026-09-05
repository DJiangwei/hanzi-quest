// E2 — the tone game's two product rules, and the one technical fact the whole
// feature rests on.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const spoken = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('@/lib/hooks/useSpeak', () => ({
  useSpeak: () => (...args: unknown[]) => { spoken.calls.push(args); },
  usableAudioUrl: () => null,
}));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { ToneGameBody } from '@/components/play/ToneGameBody';

const c = (hanzi: string, py: string) => ({ characterId: hanzi, hanzi, pinyin: [py] });
const pool = [
  c('妈', 'mā'), c('马', 'mǎ'), c('吗', 'ma'),
  c('鱼', 'yú'), c('雨', 'yǔ'),
  c('鸡', 'jī'), c('急', 'jí'), c('季', 'jì'),
];

beforeEach(() => { spoken.calls = []; });

describe('ToneGameBody', () => {
  it('speaks the HANZI, never a pinyin string', () => {
    // The device reads a character with its correct tone by construction; a
    // pinyin string would be read as letters. This single fact is why the
    // feature is buildable at all after the MeloTTS clips were scrapped for
    // getting tones wrong.
    render(<ToneGameBody chars={pool} />);
    fireEvent.click(screen.getByTestId('tone-play'));
    expect(spoken.calls).toHaveLength(1);
    const arg = spoken.calls[0][0] as string;
    expect(arg).toMatch(/^[一-鿿]$/);
  });

  it('offers four characters that are all different', () => {
    render(<ToneGameBody chars={pool} />);
    const choices = screen.getAllByTestId(/^tone-choice-/);
    expect(choices).toHaveLength(4);
    const labels = choices.map((b) => b.textContent);
    expect(new Set(labels).size).toBe(4);
  });

  it('marks the right answer without marking the wrong one as failure', () => {
    // Getting a tone wrong is the expected state of learning tones. This game
    // is for a child the product deliberately protects from 畏难情绪, so a wrong
    // pick is dimmed, never reddened or crossed.
    render(<ToneGameBody chars={pool} />);
    const choices = screen.getAllByTestId(/^tone-choice-/);
    fireEvent.click(choices[0]);
    const html = screen.getByTestId('tone-game').innerHTML;
    expect(html).not.toMatch(/red|rose|✗|✘|错|wrong/i);
  });

  it('shows a warm invitation, not an error, when there are no minimal pairs', () => {
    render(<ToneGameBody chars={[c('鱼', 'yú'), c('大', 'dà')]} />);
    const text = screen.getByTestId('tone-empty').textContent ?? '';
    expect(text).toMatch(/再多学几个字/);
    expect(text).not.toMatch(/没有|error|无法|0/i);
  });

  it('never shows a score or a streak', () => {
    // Same rule as 温故's entry card: this surface must not acquire pressure.
    render(<ToneGameBody chars={pool} />);
    const choices = screen.getAllByTestId(/^tone-choice-/);
    fireEvent.click(choices[0]);
    const text = screen.getByTestId('tone-game').textContent ?? '';
    expect(text).not.toMatch(/连续|streak|得分|score|\d+\s*\/\s*\d+\s*正确/i);
  });
});
