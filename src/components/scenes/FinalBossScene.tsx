'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { getFinalBoss } from '@/lib/scenes/final-boss-roster';
import type { BossAnimState } from './fx/bosses/types';
import type { FinalBossQuestion, FinalBossCharacter } from '@/lib/play/final-boss';
import { AudioPickScene } from './AudioPickScene';
import { ImagePickScene } from './ImagePickScene';
import { TranslatePickScene } from './TranslatePickScene';
import { SentenceClozeScene } from './SentenceClozeScene';
import { VisualPickScene } from './VisualPickScene';

interface Props {
  packSlug: string;
  mapNameZh: string;
  mapNameEn: string;
  phases: FinalBossQuestion[][];
  onComplete: (won: boolean) => void;
}

type Phase = 'intro' | 'fighting' | 'enrage' | 'defeating' | 'defeated';
const INTRO_MS = 1200;
const ENRAGE_MS = 900;
const DEFEAT_MS = 1400;

export function FinalBossScene({
  packSlug,
  mapNameZh,
  mapNameEn,
  phases,
  onComplete,
}: Props) {
  // NOTE: every hook must run before any early return to satisfy
  // react-hooks/rules-of-hooks (correction over the plan snippet, which
  // computed `pool` after the early returns).
  const overlord = useMemo(() => getFinalBoss(packSlug), [packSlug]);
  const total = useMemo(() => phases.reduce((s, p) => s + p.length, 0), [phases]);
  const pool: FinalBossCharacter[] = useMemo(
    () => phases.flat().map((x) => x.target),
    [phases],
  );

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<Phase>('intro');
  const [anim, setAnim] = useState<BossAnimState>('intro');
  const enrageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Cleanup pending timers on unmount.
  useEffect(
    () => () => {
      if (enrageTimer.current) clearTimeout(enrageTimer.current);
      if (winTimer.current) clearTimeout(winTimer.current);
    },
    [],
  );

  if (!overlord) {
    return (
      <main className="flex flex-1 items-center justify-center text-[var(--color-bad)]">
        No overlord for this map.
      </main>
    );
  }
  const Creature = overlord.Component;

  const answeredSoFar =
    phases.slice(0, phaseIdx).reduce((s, p) => s + p.length, 0) + qIdx;

  const win = () => {
    setPhase('defeating');
    setAnim('defeat');
    winTimer.current = setTimeout(() => onComplete(true), DEFEAT_MS);
  };

  const advanceWithinOrAcrossPhase = () => {
    const curr = phases[phaseIdx];
    if (qIdx + 1 < curr.length) {
      setQIdx(qIdx + 1);
      return;
    }
    // phase cleared
    if (phaseIdx + 1 >= phases.length) {
      win();
      return;
    }
    setPhase('enrage');
    setAnim('damage');
    enrageTimer.current = setTimeout(() => {
      setPhaseIdx(phaseIdx + 1);
      setQIdx(0);
      setAnim('idle');
      setPhase('fighting');
    }, ENRAGE_MS);
  };

  const handleAnswer = (correct: boolean) => {
    if (!correct) {
      const remaining = lives - 1;
      setLives(remaining);
      if (remaining === 0) {
        setPhase('defeated');
        setAnim('idle');
        return;
      }
    }
    advanceWithinOrAcrossPhase();
  };

  const reset = () => {
    setPhaseIdx(0);
    setQIdx(0);
    setLives(3);
    setAnim('intro');
    setPhase('intro');
  };

  if (phase === 'defeating') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Creature state="defeat" size={240} />
        <h2 className="font-hanzi text-3xl font-bold text-[var(--color-good)]">
          胜利！/ Victory!
        </h2>
        <p className="text-base">
          {mapNameZh} 霸主已被击败 / {mapNameEn} overlord defeated
        </p>
      </main>
    );
  }

  if (phase === 'defeated') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Creature state="idle" size={200} />
        <h2 className="font-hanzi text-2xl font-bold text-[var(--color-bad)]">
          霸主太强了！
          <span className="mt-1 block text-base font-semibold opacity-80">
            The overlord is too strong!
          </span>
        </h2>
        <p className="text-base">
          重新开始,从第一阶段再战。
          <span className="block text-sm opacity-75">Start over from Phase 1.</span>
        </p>
        <WoodSignButton size="lg" onClick={reset}>
          ⚓ 再战 (免费) / Fight again (free)
        </WoodSignButton>
      </main>
    );
  }

  if (phase === 'enrage') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Creature state="damage" size={170} />
        <h2 className="font-hanzi text-2xl font-extrabold text-[var(--color-sunset-600)]">
          第 {phaseIdx + 2} 阶段！
          <span className="block text-base">Phase {phaseIdx + 2}!</span>
        </h2>
      </main>
    );
  }

  const q = phases[phaseIdx]?.[qIdx];
  if (!q) return null;

  return (
    <main className="flex min-h-[80vh] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-sand-200)] bg-white/50 px-6 py-3 text-sm backdrop-blur">
        <span data-testid="boss-lives" className="font-bold text-[var(--color-bad)]">
          {'⚓'.repeat(lives)}
          {'·'.repeat(3 - lives)}
        </span>
        <span
          data-testid="phase-pips"
          className="font-bold text-[var(--color-ocean-700)]"
        >
          {Array.from({ length: phases.length }, (_, i) =>
            i < phaseIdx ? '●' : i === phaseIdx ? '◉' : '○',
          ).join(' ')}
        </span>
        <span className="rounded-full bg-[var(--color-ocean-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-ocean-700)]">
          {answeredSoFar + 1} / {total}
        </span>
      </div>
      <div className="flex justify-center pt-4">
        <Creature state={anim} size={150} />
      </div>
      <div className="flex-1">
        {q.type === 'audio_pick' && (
          <AudioPickScene
            key={`fb-${phaseIdx}-${qIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'image_pick' && (
          <ImagePickScene
            key={`fb-${phaseIdx}-${qIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'visual_pick' && (
          <VisualPickScene
            key={`fb-${phaseIdx}-${qIdx}`}
            target={q.target}
            pool={pool}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'translate_pick' && (
          <TranslatePickScene
            key={`fb-${phaseIdx}-${qIdx}`}
            target={q.target}
            pool={pool}
            direction={qIdx % 2 === 0 ? 'cn_to_en' : 'en_to_cn'}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'sentence_cloze' && q.target.sentence && (
          <SentenceClozeScene
            key={`fb-${phaseIdx}-${qIdx}`}
            target={q.target}
            pool={pool}
            sentenceText={q.target.sentence.text}
            translationEn={q.target.sentence.translationEn}
            onComplete={handleAnswer}
          />
        )}
        {q.type === 'sentence_cloze' && !q.target.sentence && (
          <TranslatePickScene
            key={`fb-${phaseIdx}-${qIdx}`}
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
