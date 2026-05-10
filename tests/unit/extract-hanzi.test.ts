import { describe, expect, it } from 'vitest';
import { extractHanzi } from '@/lib/hanzi/extract';

describe('extractHanzi', () => {
  it('returns empty list for non-CJK input', () => {
    expect(extractHanzi('hello world 12345')).toEqual([]);
  });

  it('extracts simplified hanzi separated by spaces', () => {
    expect(extractHanzi('一 二 三')).toEqual(['一', '二', '三']);
  });

  it('strips pinyin, whitespace, punctuation, emoji', () => {
    expect(
      extractHanzi('一 yī, 二 èr; 🎉 三 sān!  四 sì'),
    ).toEqual(['一', '二', '三', '四']);
  });

  it('dedupes while preserving first-seen order', () => {
    expect(extractHanzi('一 二 一 三 二')).toEqual(['一', '二', '三']);
  });

  it('handles traditional / extended Han characters too', () => {
    expect(extractHanzi('學 习 學')).toEqual(['學', '习']);
  });

  it('handles multiline / mixed whitespace', () => {
    expect(extractHanzi('一\n二\t三  四')).toEqual([
      '一',
      '二',
      '三',
      '四',
    ]);
  });
});
