// 看图找字 (image_pick) for a counting character (一...十) — procedural
// balloon-counting cards instead of a diffusion image. Diffusion art can't
// render an exact quantity (David hit this for real: week 7's 七 showed the
// wrong number of balloons). A number is the one case a picture CAN be
// perfectly right: draw exactly N. See
// docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md and
// docs/superpowers/plans/2026-08-23-image-stimulus-validity.md (Task 3).
//
// ImagePickScene is the single component shared by all THREE hosts
// (SceneRunner, BossScene, FinalBossScene) — see stimulus.ts's doc comment
// for why that sharing matters (the boss silently rendered every 看图找字 as
// the text fallback for months because it never threaded an image at all).
// Putting the counting-character branch inside ImagePickScene itself, keyed
// only on `target.hanzi` (which every host already passes), means fixing it
// once fixes it everywhere — no per-host call to forget. This file's second
// describe block exercises ImagePickScene directly, which the report picks
// as "easiest host to test in isolation": it needs no boss/final-boss
// question-generation scaffolding, just target/pool/imageUrl props.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return { CoinHudContext: ctx, useCoinHud: () => useContext(ctx) };
});
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => false }));

import { CountingBalloons } from '@/components/scenes/fx/CountingBalloons';
import { ImagePickScene } from '@/components/scenes/ImagePickScene';
import { COUNTING_CHARS, COUNTING_CHAR_VALUES } from '@/lib/scenes/stimulus-validity';

describe('CountingBalloons', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('draws exactly %i balloon shapes', (n) => {
    const { container, unmount } = render(<CountingBalloons count={n} />);
    expect(container.querySelectorAll('[data-testid="counting-balloon"]')).toHaveLength(n);
    unmount();
  });

  it('is deterministic: two renders of the same count produce identical markup', () => {
    const a = render(<CountingBalloons count={7} />);
    const markupA = a.container.innerHTML;
    a.unmount();
    const b = render(<CountingBalloons count={7} />);
    const markupB = b.container.innerHTML;
    b.unmount();
    expect(markupA).toBe(markupB);
    expect(markupA.length).toBeGreaterThan(0);
  });

  it('never names the number in its aria-label, for every count 1-10', () => {
    for (let n = 1; n <= 10; n++) {
      const { unmount } = render(<CountingBalloons count={n} />);
      const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/[0-9]/);
      for (const hanzi of COUNTING_CHARS) {
        expect(label).not.toContain(hanzi);
      }
      unmount();
    }
  });
});

describe('ImagePickScene — counting characters render balloons, never an <img>', () => {
  const pool = [
    { characterId: 'c-7', hanzi: '七', pinyinArray: ['qī'], imageHook: null },
    { characterId: 'c-da', hanzi: '大', pinyinArray: ['dà'], imageHook: null },
    { characterId: 'c-xiao', hanzi: '小', pinyinArray: ['xiǎo'], imageHook: null },
    { characterId: 'c-ren', hanzi: '人', pinyinArray: ['rén'], imageHook: null },
  ];

  it('renders CountingBalloons instead of the <img>, even if the host still resolved one', () => {
    render(
      <ImagePickScene
        target={pool[0]}
        // A host's pickStimulusImage() fallback can still resolve SOME word
        // picture for a counting character (it just scans for the first
        // word with a URL, unaware of counting-ness) — the counting branch
        // must win regardless of what's passed here.
        imageUrl="https://blob.example/some-balloons-wrong-count.jpg"
        imageHint="seven colorful balloons floating in a bright blue sky"
        pool={pool}
        onComplete={() => {}}
      />,
    );
    expect(document.querySelector('img')).toBeNull();
    const count = COUNTING_CHAR_VALUES.get('七');
    expect(screen.getAllByTestId('counting-balloon')).toHaveLength(count!);
  });

  it('never shows the 💡 hint bubble for a counting character (its text would name the count)', () => {
    render(
      <ImagePickScene
        target={pool[0]}
        imageHint="seven colorful balloons floating in a bright blue sky"
        pool={pool}
        hintRequested
        onComplete={() => {}}
      />,
    );
    expect(screen.queryByTestId('hint-bubble')).toBeNull();
  });

  it('leaves an ordinary (non-counting) character on the existing <img> path', () => {
    render(
      <ImagePickScene
        target={pool[1]}
        imageUrl="https://blob.example/big-elephant.jpg"
        pool={pool}
        onComplete={() => {}}
      />,
    );
    expect(document.querySelector('img')).not.toBeNull();
    expect(screen.queryAllByTestId('counting-balloon')).toHaveLength(0);
  });
});
