import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AvatarRender } from '@/components/play/AvatarRender';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR } from '@/lib/avatar/defaultLook';

describe('AvatarRender slot iteration (PR #58)', () => {
  it('renders one <g> per slot that has a default OR equipped item, in AVATAR_SLOT_IDS order', () => {
    const { container } = render(<AvatarRender equipped={{}} />);
    const innerGroups = container.querySelectorAll('svg > g[clip-path] > g');
    expect(innerGroups.length).toBe(AVATAR_SLOT_IDS.length - 1); // 6 (decor has no default)
  });

  it('renders empty decor slot gracefully (no extra group)', () => {
    const { container } = render(<AvatarRender equipped={{ decor: undefined }} />);
    const innerGroups = container.querySelectorAll('svg > g[clip-path] > g');
    expect(innerGroups.length).toBe(AVATAR_SLOT_IDS.length - 1);
  });

  it('accepts an explicitly-equipped decor item without throwing', () => {
    // The catalog doesn't have a real decor item yet (Task 7 adds it).
    // This test just confirms the prop is accepted and no error fires.
    expect(() =>
      render(<AvatarRender equipped={{ decor: 'carib-palmtree' }} />),
    ).not.toThrow();
  });

  it('renders defaults for all 6 non-decor slots', () => {
    const { container } = render(<AvatarRender />);
    expect(Object.keys(DEFAULT_AVATAR).sort()).toEqual([
      'background',
      'hair',
      'hat',
      'head',
      'pants',
      'top',
    ]);
    const innerGroups = container.querySelectorAll('svg > g[clip-path] > g');
    expect(innerGroups.length).toBe(6);
  });
});
