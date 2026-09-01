// The user-reported symptom: 十二生肖 study questions showed options that were
// impossible to tell apart. zodiac-v1 is the only pack with no
// `resolveRevealEmoji` AND image_url NULL on all 12 cards, so every choice fell
// back to the pack's single themeEmoji 🐲 — four identical pictures, and a
// stimulus that gave nothing away. The lesson was not mis-styled; it was
// unanswerable.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/study', () => ({ finishStudyLessonAction: vi.fn() }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/use-speak', () => ({ useSpeak: () => ({ speak: vi.fn(), supported: true }) }));

import { StudyRunner } from '@/components/play/StudyRunner';
import type { StudyCardLite, StudyQuestion } from '@/lib/play/study';

const card = (slug: string, nameZh: string, nameEn: string): StudyCardLite => ({
  id: `z-${slug}`, slug, nameZh, nameEn, imageUrl: null,
});

const RAT = card('rat', '鼠', 'Rat');
const OX = card('ox', '牛', 'Ox');
const TIGER = card('tiger', '虎', 'Tiger');
const RABBIT = card('rabbit', '兔', 'Rabbit');

const question: StudyQuestion = {
  id: 'audio_to_picture:z-rat:0',
  type: 'audio_to_picture',
  target: RAT,
  choices: [RAT, OX, TIGER, RABBIT],
};

describe('StudyRunner — 十二生肖', () => {
  it('renders four DISTINGUISHABLE picture choices', () => {
    const { container } = render(
      <StudyRunner
        childId="c1"
        packSlug="zodiac-v1"
        packNameZh="十二生肖"
        packNameEn="Twelve Zodiac"
        questions={[question]}
      />,
    );
    const hrefs = Array.from(container.querySelectorAll('use')).map((u) =>
      u.getAttribute('href'),
    );
    // Before the fix this was zero <use> elements and four identical 🐲.
    expect(new Set(hrefs)).toEqual(
      new Set(['#z-rat', '#z-ox', '#z-tiger', '#z-rabbit']),
    );
    expect(container.textContent).not.toContain('🐲');
  });
});
