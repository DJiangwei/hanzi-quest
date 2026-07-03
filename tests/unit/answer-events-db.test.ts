import { beforeEach, describe, expect, it, vi } from 'vitest';

const { insertMock, valuesMock } = vi.hoisted(() => {
  const valuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn(() => ({ values: valuesMock }));
  return { insertMock, valuesMock };
});

vi.mock('@/db', () => ({ db: { insert: insertMock } }));

import { logAnswerEventsSafe } from '@/lib/db/answer-events';

const CHILD = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const WEEK = '11111111-2222-4333-8444-555555555555';
const CHAR = '99999999-8888-4777-8666-555555555555';

describe('logAnswerEventsSafe', () => {
  beforeEach(() => {
    insertMock.mockClear();
    valuesMock.mockClear();
    valuesMock.mockResolvedValue(undefined);
  });

  it('inserts one row per valid event with server-derived context', async () => {
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', [
      { sceneType: 'audio_pick', characterId: CHAR, correct: true },
      { sceneType: 'flashcard', characterId: CHAR, selfRating: 'dont_know' },
    ]);
    expect(n).toBe(2);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const rows = valuesMock.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      childId: CHILD,
      weekId: WEEK,
      source: 'practice',
      sceneType: 'audio_pick',
      correct: true,
    });
    expect(rows[1]).toMatchObject({ selfRating: 'dont_know', correct: null });
  });

  it('drops invalid events individually and keeps valid ones', async () => {
    const n = await logAnswerEventsSafe(CHILD, null, 'study', [
      { sceneType: 'study_picture_to_word', itemKey: 'flag-fr', correct: false },
      { sceneType: 'bad', correct: true, selfRating: 'got_it' }, // violates exactly-one-of
      { nonsense: true },
    ]);
    expect(n).toBe(1);
    expect(valuesMock.mock.calls[0][0]).toHaveLength(1);
  });

  it('caps at MAX_EVENTS_PER_CALL', async () => {
    const many = Array.from({ length: 60 }, () => ({
      sceneType: 'audio_pick',
      characterId: CHAR,
      correct: true,
    }));
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', many);
    expect(n).toBe(40);
  });

  it('returns 0 and swallows when the insert throws', async () => {
    valuesMock.mockRejectedValueOnce(new Error('db down'));
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', [
      { sceneType: 'audio_pick', characterId: CHAR, correct: true },
    ]);
    expect(n).toBe(0);
  });

  it('does not insert at all for an empty/fully-invalid batch', async () => {
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', [{ junk: 1 }]);
    expect(n).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
