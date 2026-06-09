'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { BossQuestionType } from '@/lib/scenes/configs';
import { getBossCreature } from '@/lib/scenes/boss-roster';
import type { BossAnimState } from './fx/bosses/types';
import { AudioPickScene } from './AudioPickScene';
import { ImagePickScene } from './ImagePickScene';
import { PinyinPickScene } from './PinyinPickScene';
import { SentenceClozeScene } from './SentenceClozeScene';
import { TranslatePickScene } from './TranslatePickScene';
import { VisualPickScene } from './VisualPickScene';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  sentence: { id: string; text: string; translationEn: string | null } | null;
}

interface Props {
  weekNumber: number;
  characterIds: string[];
  questionTypes: BossQuestionType[];
  pool: CharacterDetail[];
  onComplete: (won: boolean) => void;
}

type Phase = 'intro' | 'fighting' | 'defeating' | 'defeated' | 'victory';

interface Question {
  type: BossQuestionType;
  target: CharacterDetail;
}

const INTRO_MS = 1200;
const DAMAGE_MS = 400;
const DEFEAT_MS = 1200;

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

export function BossScene({ weekNumber, characterIds, questionTypes, pool, onComplete }: Props) {
  const questions = useMemo(
    () => buildQuestions(characterIds, questionTypes, pool),
    [characterIds, questionTypes, pool],
  );
  const totalQuestions = questions.length;

  const creature = useMemo(() => getBossCreature(weekNumber), [weekNumber]);
  const Creature = creature.Component;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<Phase>('intro');
  const [anim, setAnim] = useState<BossAnimState>('intro');
  const damageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Intro effect: transitions from 'intro' → 'fighting' after INTRO_MS.
  // Re-arms on reset (which sets phase back to 'intro').
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => {
      setPhase('fighting');
      setAnim('idle');
    }, INTRO_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Cleanup pending timers on unmount (so onComplete can't fire for an
  // abandoned fight if the kid leaves during the defeat animation).
  useEffect(() => () => {
    if (damageTimer.current) clearTimeout(damageTimer.current);
    if (winTimer.current) clearTimeout(winTimer.current);
  }, []);

  const win = () => {
    setPhase('defeating');
    setAnim('defeat');
    winTimer.current = setTimeout(() => onComplete(true), DEFEAT_MS);
  };

  const flinch = () => {
    setAnim('damage');
    if (damageTimer.current) clearTimeout(damageTimer.current);
    damageTimer.current = setTimeout(() => setAnim('idle'), DAMAGE_MS);
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) {
      const next = currentIdx + 1;
      if (next >= totalQuestions) {
        win();
      } else {
        flinch();
        setCurrentIdx(next);
      }
    } else {
      const remaining = lives - 1;
      setLives(remaining);
      if (remaining === 0) {
        setPhase('defeated');
        setAnim('idle');
      } else {
        // Wrong but still alive — advance to next question to keep gauntlet pace.
        const next = currentIdx + 1;
        if (next >= totalQuestions) {
          win();
        } else {
          setCurrentIdx(next);
        }
      }
    }
  };

  const reset = () => {
    setCurrentIdx(0);
    setLives(3);
    setAnim('intro');
    setPhase('intro');
  };

  if (phase === 'defeating') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Creature state="defeat" size={220} />
        <h2 className="font-hanzi text-3xl font-bold text-[var(--color-good)]">胜利！/ Victory!</h2>
      </main>
    );
  }

  if (phase === 'defeated') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Creature state="idle" size={200} />
        <h2 className="font-hanzi text-3xl font-bold text-[var(--color-bad)]">
          海怪赢了这局！
          <span className="mt-1 block text-base font-semibold opacity-80">
            The sea beast won this round!
          </span>
        </h2>
        <p className="text-base text-[var(--color-sand-900)]">
          你的勇气未变，重新再战吧。
          <span className="mt-0.5 block text-sm opacity-75">
            Your courage is unshaken — fight again.
          </span>
        </p>
        <WoodSignButton size="lg" onClick={reset}>
          ⚓ 再战 (免费) / Fight again (free)
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
        <Creature state={anim} size={150} />
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
        {q.type === 'pinyin_pick' && (
          <PinyinPickScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'translate_pick' && (
          <TranslatePickScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            direction={currentIdx % 2 === 0 ? 'cn_to_en' : 'en_to_cn'}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'sentence_cloze' && q.target.sentence && (
          <SentenceClozeScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            sentenceText={q.target.sentence.text}
            translationEn={q.target.sentence.translationEn}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'sentence_cloze' && !q.target.sentence && (
          <TranslatePickScene
            key={`boss-${currentIdx}`}
            target={q.target}
            pool={pool}
            direction="cn_to_en"
            onComplete={handleAnswer}
          />
        )}
      </div>
    </main>
  );
}
