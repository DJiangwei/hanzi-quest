'use client';

import { useMemo, useState } from 'react';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { BossQuestionType } from '@/lib/scenes/configs';
import { AudioPickScene } from './AudioPickScene';
import { BossKraken } from './fx/BossKraken';
import { ImagePickScene } from './ImagePickScene';
import { VisualPickScene } from './VisualPickScene';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
}

interface Props {
  characterIds: string[];
  questionTypes: BossQuestionType[];
  pool: CharacterDetail[];
  onComplete: (won: boolean) => void;
}

type Phase = 'fighting' | 'defeated' | 'victory';

interface Question {
  type: BossQuestionType;
  target: CharacterDetail;
}

function buildQuestions(
  characterIds: string[],
  questionTypes: BossQuestionType[],
  pool: CharacterDetail[],
): Question[] {
  const byId = new Map(pool.map((c) => [c.characterId, c]));
  return characterIds
    .map((id, idx) => {
      const target = byId.get(id);
      if (!target) return null;
      const type = questionTypes[idx % questionTypes.length];
      return { type, target };
    })
    .filter((q): q is Question => q !== null);
}

export function BossScene({ characterIds, questionTypes, pool, onComplete }: Props) {
  const questions = useMemo(
    () => buildQuestions(characterIds, questionTypes, pool),
    [characterIds, questionTypes, pool],
  );
  const totalQuestions = questions.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<Phase>('fighting');

  const reset = () => {
    setCurrentIdx(0);
    setLives(3);
    setPhase('fighting');
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) {
      const next = currentIdx + 1;
      if (next >= totalQuestions) {
        setPhase('victory');
        onComplete(true);
      } else {
        setCurrentIdx(next);
      }
    } else {
      const remaining = lives - 1;
      setLives(remaining);
      if (remaining === 0) {
        setPhase('defeated');
      } else {
        // Wrong but still alive — advance to next question to keep gauntlet pace.
        const next = currentIdx + 1;
        if (next >= totalQuestions) {
          setPhase('victory');
          onComplete(true);
        } else {
          setCurrentIdx(next);
        }
      }
    }
  };

  if (phase === 'defeated') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <BossKraken state="winning" size={200} />
        <h2 className="font-hanzi text-3xl font-bold text-[var(--color-bad)]">
          海怪赢了这局！
        </h2>
        <p className="text-base text-[var(--color-sand-900)]">
          你的勇气未变，重新再战吧。
        </p>
        <WoodSignButton size="lg" onClick={reset}>
          ⚓ 再战 (免费)
        </WoodSignButton>
      </main>
    );
  }

  const q = questions[currentIdx];
  if (!q) {
    return (
      <main className="flex flex-1 items-center justify-center text-[var(--color-bad)]">
        Boss scene config missing characters — re-publish week.
      </main>
    );
  }

  return (
    <main className="flex min-h-[80vh] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-sand-200)] bg-white/50 px-6 py-3 text-sm backdrop-blur">
        <span data-testid="boss-lives" className="font-bold text-[var(--color-bad)]">
          {'⚓'.repeat(lives)}{'·'.repeat(3 - lives)}
        </span>
        <span className="rounded-full bg-[var(--color-ocean-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-ocean-700)]">
          {currentIdx + 1} / {totalQuestions}
        </span>
      </div>

      <div className="flex justify-center pt-4">
        <BossKraken state="fighting" size={150} />
      </div>

      <div className="flex-1">
        {q.type === 'audio_pick' && (
          <AudioPickScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'visual_pick' && (
          <VisualPickScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'image_pick' && (
          <ImagePickScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
      </div>
    </main>
  );
}
