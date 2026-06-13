import { describe, expect, it } from 'vitest';
import { homeworkItems, homeworkItemType } from '@/db/schema';

describe('homework schema', () => {
  it('exposes the homework_items table + enum with the 3 types', () => {
    expect(homeworkItems).toBeDefined();
    expect(homeworkItemType.enumValues).toEqual([
      'char_quiz',
      'word_building',
      'sentence_order',
    ]);
  });
});
