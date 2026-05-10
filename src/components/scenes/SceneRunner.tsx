'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  finishAttemptAction,
  finishLevelAction,
  startSessionAction,
} from '@/lib/actions/play';
import { AudioPickScene } from './AudioPickScene';
import { FlashcardScene } from './FlashcardScene';
import { ImagePickScene } from './ImagePickScene';
import { VisualPickScene } from './VisualPickScene';
import { WordMatchScene } from './WordMatchScene';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
}

export type SceneType =
  | 'flashcard'
  | 'audio_pick'
  | 'visual_pick'
  | 'image_pick'
  | 'word_match'
  | 'tracing'
  | 'boss';

interface CompiledLevel {
  id: string;
  position: number;
  sceneType: SceneType;
  config: Record<string, unknown>;
}

interface Props {
  childId: string;
  weekId: string;
  weekLabel: string;
  levels: CompiledLevel[];
  charactersById: Record<string, CharacterDetail>;
  pool: CharacterDetail[]; // ordered character list for the week
}

export function SceneRunner({
  childId,
  weekId,
  weekLabel,
  levels,
  charactersById,
  pool,
}: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [coinsThisSession, setCoinsThisSession] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    startSessionAction(childId).then((r) => {
      if (!cancelled) {
        setSessionId(r.sessionId);
        startedAtRef.current = Date.now();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  if (!sessionId) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  const currentLevel = levels[index];
  const totalLevels = levels.length;

  if (done || !currentLevel) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-5xl font-bold">🎉</h1>
        <h2 className="text-3xl font-bold">Level complete!</h2>
        <p className="text-lg text-zinc-600">
          {weekLabel} · +{coinsThisSession} coins
        </p>
        <button
          type="button"
          onClick={() => router.push(`/play/${childId}`)}
          className="rounded-full bg-zinc-900 px-8 py-3 text-base font-bold text-white hover:bg-zinc-700"
        >
          Back to map
        </button>
      </main>
    );
  }

  const advance = (correct: boolean) => {
    if (pending) return;
    startTransition(async () => {
      const result = await finishAttemptAction({
        sessionId,
        weekLevelId: currentLevel.id,
        weekId,
        childId,
        correctCount: correct ? 1 : 0,
        totalCount: 1,
        hintsUsed: 0,
      });
      setCoinsThisSession((c) => c + result.coinsAwarded);

      const nextIndex = index + 1;
      if (nextIndex >= totalLevels) {
        const elapsedSeconds = Math.round(
          (Date.now() - startedAtRef.current) / 1000,
        );
        await finishLevelAction({
          sessionId,
          childId,
          weekId,
          totalScenesPassed: totalLevels,
          totalScenesInWeek: totalLevels,
          durationSeconds: elapsedSeconds,
        });
        setDone(true);
      } else {
        setIndex(nextIndex);
      }
    });
  };

  let body: React.ReactNode;
  switch (currentLevel.sceneType) {
    case 'flashcard': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <FlashcardScene
          key={currentLevel.id}
          data={{
            hanzi: c.hanzi,
            pinyin: c.pinyinArray,
            meaningEn: c.meaningEn,
            meaningZh: c.meaningZh,
            imageHook: c.imageHook,
          }}
          onComplete={() => advance(true)}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'audio_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <AudioPickScene
          key={currentLevel.id}
          target={c}
          pool={pool}
          onComplete={advance}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'visual_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <VisualPickScene
          key={currentLevel.id}
          target={c}
          pool={pool}
          onComplete={advance}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'image_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <ImagePickScene
          key={currentLevel.id}
          target={c}
          pool={pool}
          onComplete={advance}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'word_match': {
      const ids = (currentLevel.config.characterIds as string[] | undefined) ?? [];
      const pairs = ids
        .map((id) => {
          const c = charactersById[id];
          return c && c.firstWord
            ? { characterId: id, hanzi: c.hanzi, word: c.firstWord }
            : null;
        })
        .filter((p): p is { characterId: string; hanzi: string; word: string } =>
          Boolean(p),
        );
      body = pairs.length >= 2 ? (
        <WordMatchScene
          key={currentLevel.id}
          pairs={pairs}
          onComplete={advance}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    default:
      body = <MissingData />;
  }

  return (
    <main className="flex min-h-[80vh] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-3 text-sm text-zinc-600">
        <span>{weekLabel}</span>
        <span>
          {index + 1} / {totalLevels} · 🪙 {coinsThisSession}
        </span>
      </div>
      {body}
    </main>
  );
}

function MissingData() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center text-red-600">
      Missing data for this scene — re-publish the week from /parent.
    </main>
  );
}
