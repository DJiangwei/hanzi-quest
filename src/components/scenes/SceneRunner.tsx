'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { FlashcardScene } from './FlashcardScene';
import {
  finishAttemptAction,
  finishLevelAction,
  startSessionAction,
} from '@/lib/actions/play';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
}

interface CompiledLevel {
  id: string;
  position: number;
  sceneType: 'flashcard' | string;
  characterId: string;
}

interface Props {
  childId: string;
  weekId: string;
  weekLabel: string;
  levels: CompiledLevel[];
  charactersById: Record<string, CharacterDetail>;
}

export function SceneRunner({
  childId,
  weekId,
  weekLabel,
  levels,
  charactersById,
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

  const character = charactersById[currentLevel.characterId];
  if (!character) {
    return (
      <main className="flex flex-1 items-center justify-center text-red-600">
        Missing character data for this card.
      </main>
    );
  }

  const handleSceneComplete = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await finishAttemptAction({
        sessionId,
        weekLevelId: currentLevel.id,
        weekId,
        childId,
        correctCount: 1,
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

  return (
    <main className="flex min-h-[80vh] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-3 text-sm text-zinc-600">
        <span>{weekLabel}</span>
        <span>
          {index + 1} / {totalLevels} · 🪙 {coinsThisSession}
        </span>
      </div>
      <FlashcardScene
        key={currentLevel.id}
        data={{
          hanzi: character.hanzi,
          pinyin: character.pinyinArray,
          meaningEn: character.meaningEn,
          meaningZh: character.meaningZh,
          imageHook: null,
        }}
        onComplete={handleSceneComplete}
      />
    </main>
  );
}
