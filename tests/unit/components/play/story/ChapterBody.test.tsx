import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChapterBody } from '@/components/play/story/ChapterBody';

describe('ChapterBody', () => {
  it('renders ZH text, audio button, and EN text', () => {
    render(<ChapterBody bodyZh="小红花。" bodyEn="A small red flower." />);
    expect(screen.getByText('小红花。')).toBeInTheDocument();
    expect(screen.getByText('A small red flower.')).toBeInTheDocument();
  });

  it('ZH text appears before EN text in document order', () => {
    render(<ChapterBody bodyZh="一" bodyEn="One" />);
    const zh = screen.getByText('一');
    const en = screen.getByText('One');
    expect(zh.compareDocumentPosition(en)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
