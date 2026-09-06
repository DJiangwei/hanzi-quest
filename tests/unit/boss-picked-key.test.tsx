// The boss recorded WHETHER she was wrong but never WHICH wrong option she
// took, so A3's confusion pairs were blind to it: 152 boss answers with 7
// wrong contributed nothing. The boss is the highest-pressure surface in the
// product and therefore the most informative place to be wrong.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn(), streakPitchMult: () => 1 }));
vi.mock('@/lib/audio/boss', () => ({ playBossCue: vi.fn() }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => () => {}, usableAudioUrl: () => null }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { BossScene } from '@/components/scenes/BossScene';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

const ch = (id: string, hanzi: string, py: string, en: string) => ({
  characterId: id, hanzi, pinyinArray: [py], meaningEn: en, meaningZh: en,
  imageHook: null, firstWord: null, sentence: null,
});
const pool = [
  ch('t1', '妈', 'mā', 'mother'),
  ch('t2', '马', 'mǎ', 'horse'),
  ch('t3', '鱼', 'yú', 'fish'),
  ch('t4', '大', 'dà', 'big'),
];

beforeEach(() => { vi.useRealTimers(); });

function renderBoss(onAnswerEvent: (e: SceneAnswerEvent) => void) {
  return render(
    <BossScene
      weekNumber={1}
      characterIds={['t1']}
      questionTypes={['audio_pick']}
      pool={pool}
      onComplete={() => {}}
      onAnswerEvent={onAnswerEvent}
    />,
  );
}

describe('BossScene answer telemetry', () => {
  it('records WHICH wrong option was taken, not just that it was wrong', async () => {
    const events: SceneAnswerEvent[] = [];
    renderBoss((e) => events.push(e));

    // Enter the fight, then take a deliberately wrong option.
    const start = screen.queryByText(/开始|Start|战斗/);
    if (start) fireEvent.click(start);

    const choices = await screen.findAllByRole('button');
    const wrong = choices.find(
      (b) => /马|鱼|大/.test(b.textContent ?? '') && !/妈/.test(b.textContent ?? ''),
    );
    expect(wrong, 'a wrong option should be on screen').toBeTruthy();
    fireEvent.click(wrong!);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 900)); // past MCQ's 750ms reveal hold
    });

    const boss = events.filter((e) => e.sceneType === 'boss_question');
    expect(boss.length).toBeGreaterThan(0);
    const answered = boss[0];
    expect(answered.correct).toBe(false);
    expect(answered.pickedKey, 'the boss must carry the picked option').toBeTruthy();
  });

  it('emits ONE event per question, under boss_question — never the inner scene type', async () => {
    // The inner scene's own event is consumed for its pickedKey and goes no
    // further. Forwarding it would log the question twice and lose the boss
    // attribution, which is why BossScene deliberately did not wire
    // onAnswerEvent at all before this change.
    const events: SceneAnswerEvent[] = [];
    renderBoss((e) => events.push(e));
    const start = screen.queryByText(/开始|Start|战斗/);
    if (start) fireEvent.click(start);

    const choices = await screen.findAllByRole('button');
    const any = choices.find((b) => /妈|马|鱼|大/.test(b.textContent ?? ''));
    fireEvent.click(any!);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });

    expect(events).toHaveLength(1);
    expect(events[0].sceneType).toBe('boss_question');
    expect(events.some((e) => e.sceneType === 'audio_pick')).toBe(false);
  });
});
