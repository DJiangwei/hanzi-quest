import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/play/c1',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/play/MidSceneProvider', () => ({
  useMidScene: () => ({ midScene: false }),
}));

import { KidNavBar } from '@/components/play/KidNavBar';

const hasCJK = (s: string) => /[一-鿿]/.test(s);
const hasLatin = (s: string) => /[A-Za-z]/.test(s);

describe('bilingual chrome', () => {
  it('every bottom-nav tab label is bilingual (CJK + Latin)', () => {
    render(<KidNavBar childId="c1" />);
    const nav = screen.getByLabelText('Kid navigation');
    const labels = Array.from(nav.querySelectorAll('a > span'))
      .map((n) => n.textContent ?? '')
      .filter((t) => hasCJK(t)); // the text label spans (icons are emoji-only)
    expect(labels.length).toBeGreaterThanOrEqual(5);
    for (const t of labels) {
      expect(
        hasCJK(t) && hasLatin(t),
        `single-language nav label: "${t}"`,
      ).toBe(true);
    }
  });
});
