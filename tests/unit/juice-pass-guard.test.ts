// Source-level guard for the CSS-only juice-pass pieces (A1/A4): the classes
// must exist in globals.css WITH a reduced-motion override, and the home page
// must actually apply the idle class (jsdom can't exercise CSS animations, so
// we assert at the source level — same pattern as distribution-isolation-guard).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8');
const homePage = readFileSync('src/app/play/[childId]/page.tsx', 'utf8');

describe('juice-pass CSS guard', () => {
  it('globals.css defines holo-sweep + avatar-idle keyframes and classes', () => {
    expect(css).toContain('@keyframes holo-sweep');
    expect(css).toContain('.holo-overlay');
    expect(css).toContain('@keyframes avatar-idle');
    expect(css).toContain('.animate-avatar-idle');
  });

  it('both animations are disabled under prefers-reduced-motion', () => {
    const reduced = css.split('@media (prefers-reduced-motion: reduce)').at(-1) ?? '';
    expect(reduced).toContain('.holo-overlay { animation: none');
    expect(reduced).toContain('.animate-avatar-idle { animation: none');
  });

  it('the home HUD avatar is wrapped in the idle animation class', () => {
    expect(homePage).toContain('animate-avatar-idle');
  });
});
