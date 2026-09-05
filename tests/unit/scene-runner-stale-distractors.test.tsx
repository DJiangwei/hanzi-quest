// A2 slice 1 — the two pieces of SceneRunner wiring that a mutation proved
// nothing was guarding.
//
// Both are invisible to a rendering assertion: they are about WHICH props reach
// ImagePickScene, not about what it draws. So the scene is mocked to capture
// its props — the pattern CLAUDE.md prescribes after a bare-<div> mock let the
// getPackBySlug namespace bug through (PR #153).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

type CapturedProps = Record<string, unknown>;
const captured = vi.hoisted(() => ({ props: null as CapturedProps | null }));

vi.mock('@/components/scenes/ImagePickScene', () => ({
  ImagePickScene: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div data-testid="image-pick" />;
  },
}));

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 's1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({
    ok: true, coinsAwarded: 0, perfect: false, bonuses: [], trophies: [],
    xp: { gained: 0, level: 1, leveledUp: false },
  }),
  finishLevelAction: vi.fn().mockResolvedValue({
    ok: true, bossCleared: false, freePullClaimed: false, cardGrants: [],
    bonuses: [], trophies: [], xp: { gained: 0, level: 1, leveledUp: false },
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => false }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn(), setAudioMuted: vi.fn() }));
vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => <div /> }));
vi.mock('@/lib/actions/gacha', () => ({ AlreadyClaimedError: class extends Error {} }));
vi.mock('@/lib/actions/powerups', () => ({
  useHintAction: vi.fn(), useSkipAction: vi.fn(),
}));

import { SceneRunner } from '@/components/scenes/SceneRunner';

const word = (id: string, text: string, imageUrl: string | null) => ({
  id, text, imageUrl, imageHook: `hook-${text}`, meaningEn: text, audioUrl: null,
});

// 唱 owns 唱歌 and 唱票; 歌 (cleared weeks ago) ALSO owns 唱歌.
const target = {
  characterId: 'c-chang', hanzi: '唱', pinyinArray: ['chàng'], meaningEn: 'to sing',
  meaningZh: null, imageHook: null, audioUrl: null, firstWord: '唱歌', sentence: null,
  words: [word('w-changge', '唱歌', 'u1'), word('w-changpiao', '唱票', 'u2')],
};
const sameWeek = {
  characterId: 'c-yu', hanzi: '鱼', pinyinArray: ['yú'], meaningEn: 'fish',
  meaningZh: null, imageHook: null, audioUrl: null, firstWord: null, sentence: null,
  words: [word('w-xiaoyu', '小鱼', 'u3')],
};
const olderSharing = {
  characterId: 'c-ge', hanzi: '歌', pinyinArray: ['gē'], meaningEn: 'song',
  meaningZh: null, imageHook: null, audioUrl: null, firstWord: null, sentence: null,
  words: [word('w-changge2', '唱歌', 'u1')],
};
const olderSafe = {
  characterId: 'c-ma', hanzi: '马', pinyinArray: ['mǎ'], meaningEn: 'horse',
  meaningZh: null, imageHook: null, audioUrl: null, firstWord: null, sentence: null,
  words: [word('w-xiaoma', '小马', 'u4')],
};

async function renderWith(config: Record<string, unknown>) {
  captured.props = null;
  render(
    <SceneRunner
      childId="child-1"
      weekId="w1"
      weekLabel="Week"
      levels={[{ id: 'l0', position: 0, sceneType: 'image_pick' as const, config }]}
      charactersById={{ 'c-chang': target, 'c-yu': sameWeek }}
      pool={[target, sameWeek]}
      olderPool={[olderSharing, olderSafe]}
    />,
  );
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => { captured.props = null; });

describe('SceneRunner · image_pick stimulus wiring', () => {
  it('honours the wordId compile-week froze into scene_config', async () => {
    // PR #158 freezes the VALIDATED word so the runtime shows that one.
    // pickStimulusImage takes `preferredWordId` to accept it — and SceneRunner
    // was calling it with two arguments, so the freeze was ignored and the
    // scene fell back to "the first word with a picture": exactly the behaviour
    // #158 existed to remove. The fix was inert in practice for months while
    // working correctly in the boss path.
    await renderWith({ characterId: 'c-chang', wordId: 'w-changpiao', segment: 'practice' });
    expect(captured.props?.imageUrl).toBe('u2');
    expect(captured.props?.imageHint).toBe('hook-唱票');
  });

  it('excludes older characters that own the pictured word', async () => {
    // 歌 also owns 唱歌. With the 唱歌 picture on screen, offering 歌 as a wrong
    // option makes BOTH answers correct — PR #158's collision, reappearing
    // across weeks now that the distractor pool spans them.
    await renderWith({ characterId: 'c-chang', wordId: 'w-changge', segment: 'practice' });
    const older = captured.props?.olderPool as { hanzi: string }[];
    expect(older.map((c) => c.hanzi)).toEqual(['马']);
  });

  it('still excludes the owner when an unknown wordId falls back to another word', async () => {
    // A stale or mistyped frozen id does NOT mean "no picture" — pickStimulusImage
    // falls back to the first word that has one, which here is 唱歌 again. The
    // exclusion has to follow the word actually shown, not the one asked for.
    await renderWith({ characterId: 'c-chang', wordId: 'no-such-word', segment: 'practice' });
    expect(captured.props?.imageUrl).toBe('u1');
    expect((captured.props?.olderPool as { hanzi: string }[]).map((c) => c.hanzi)).toEqual(['马']);
  });

  it('keeps the whole older pool when there is no picture at all', async () => {
    // A character whose words have no art renders the text card. Nothing is
    // pictured, so nothing can collide — and shrinking the pool anyway would
    // cost the question an option for no reason.
    const noArt = {
      characterId: 'c-ma2', hanzi: '吗', pinyinArray: ['ma'], meaningEn: 'question word',
      meaningZh: null, imageHook: 'a question mark', audioUrl: null, firstWord: null,
      sentence: null, words: [word('w-hao-ma', '好吗', null)],
    };
    captured.props = null as CapturedProps | null;
    render(
      <SceneRunner
        childId="child-1" weekId="w1" weekLabel="Week"
        levels={[{ id: 'l0', position: 0, sceneType: 'image_pick' as const,
                   config: { characterId: 'c-ma2', wordId: 'w-hao-ma', segment: 'practice' } }]}
        charactersById={{ 'c-ma2': noArt, 'c-yu': sameWeek }}
        pool={[noArt, sameWeek]}
        olderPool={[olderSharing, olderSafe]}
      />,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(captured.props?.imageUrl).toBeNull();
    expect((captured.props?.olderPool as { hanzi: string }[]).map((c) => c.hanzi).sort())
      .toEqual(['歌', '马']);
  });
});
