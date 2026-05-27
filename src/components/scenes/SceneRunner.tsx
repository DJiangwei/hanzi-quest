'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { EconomyBonus, GrantedTrophy } from '@/lib/actions/play';
import type { PowerupCounts } from '@/lib/db/powerups';
import {
  finishAttemptAction,
  finishLevelAction,
  startSessionAction,
} from '@/lib/actions/play';
import { setAudioMuted } from '@/lib/audio/play';
import { CoinHudContext } from '@/lib/hooks/coin-hud-context';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { BonusToast } from '@/components/play/BonusToast';
import { PowerupTray } from '@/components/play/PowerupTray';
import { TrophyToast } from '@/components/play/TrophyToast';
import { AudioPickScene } from './AudioPickScene';
import { BossScene } from './BossScene';
import { ImageWordScene } from './ImageWordScene';
import { FlashcardScene } from './FlashcardScene';
import { ImagePickScene } from './ImagePickScene';
import { PinyinPickScene } from './PinyinPickScene';
import { SentenceClozeScene } from './SentenceClozeScene';
import { TranslatePickScene } from './TranslatePickScene';
import { VisualPickScene } from './VisualPickScene';
import { WordMatchScene } from './WordMatchScene';
import type { BossQuestionType, Segment, TranslateDirection } from '@/lib/scenes/configs';

const LevelFanfare = dynamic(
  () => import('./fx/LevelFanfare').then((m) => m.LevelFanfare),
  { ssr: false },
);

interface CharacterWord {
  id: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
  imageUrl: string | null;
}

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  words: CharacterWord[];
  sentence: { id: string; text: string; translationEn: string | null } | null;
}

export type SceneType =
  | 'flashcard'
  | 'audio_pick'
  | 'visual_pick'
  | 'image_pick'
  | 'word_match'
  | 'tracing'
  | 'boss'
  | 'pinyin_pick'
  | 'translate_pick'
  | 'sentence_cloze'
  | 'image_word';

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
  pool: CharacterDetail[];
  /** Where to navigate when the runner finishes. Defaults to the island map. */
  exitHref?: string;
  /** Powerup inventory counts at session start. Defaults to all-zero. */
  initialPowerupCounts?: PowerupCounts;
  /** Show a one-shot starter-pack toast when the child first arrives with powerups. */
  showStarterToast?: boolean;
}

export function SceneRunner({
  childId,
  weekId,
  weekLabel,
  levels,
  charactersById,
  pool,
  exitHref,
  initialPowerupCounts = { hint: 0, skip: 0, streak_freeze: 0 },
  showStarterToast = false,
}: Props) {
  const resolvedExitHref = exitHref ?? `/play/${childId}`;
  const router = useRouter();
  const reduced = useReducedMotion();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [coinsThisSession, setCoinsThisSession] = useState(0);
  const [done, setDone] = useState(false);
  const [lastSceneType, setLastSceneType] = useState<SceneType | null>(null);
  const [activeBonuses, setActiveBonuses] = useState<EconomyBonus[]>([]);
  const [activeTrophies, setActiveTrophies] = useState<GrantedTrophy[]>([]);
  const [pending, startTransition] = useTransition();
  const [hintCount, setHintCount] = useState(initialPowerupCounts.hint);
  const [skipCount, setSkipCount] = useState(initialPowerupCounts.skip);
  // Track which level index the hint was activated for, so it auto-clears on level change.
  const [hintActivatedAtIndex, setHintActivatedAtIndex] = useState<number | null>(null);
  const hintRequested = hintActivatedAtIndex === index;
  const [starterDismissed, setStarterDismissed] = useState(false);
  const startedAtRef = useRef<number>(0);
  const coinHudRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setAudioMuted(reduced);
  }, [reduced]);

  useEffect(() => {
    if (showStarterToast && !starterDismissed) {
      const t = setTimeout(() => setStarterDismissed(true), 3500);
      return () => clearTimeout(t);
    }
  }, [showStarterToast, starterDismissed]);

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
      <LevelFanfare
        weekLabel={weekLabel}
        coinsThisSession={coinsThisSession}
        childId={childId}
        weekId={weekId}
        chestAvailable={lastSceneType === 'boss'}
        onContinue={() => router.push(resolvedExitHref)}
      />
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
      const collectedBonuses: EconomyBonus[] = [...result.bonuses];
      const collectedTrophies: GrantedTrophy[] = [...result.trophies];

      setLastSceneType(currentLevel.sceneType);
      const nextIndex = index + 1;
      if (nextIndex >= totalLevels) {
        const elapsedSeconds = Math.round(
          (Date.now() - startedAtRef.current) / 1000,
        );
        const levelResult = await finishLevelAction({
          sessionId,
          childId,
          weekId,
          totalScenesPassed: totalLevels,
          totalScenesInWeek: totalLevels,
          durationSeconds: elapsedSeconds,
        });
        collectedBonuses.push(...levelResult.bonuses);
        collectedTrophies.push(...levelResult.trophies);
        setDone(true);
      } else {
        setIndex(nextIndex);
      }
      if (collectedBonuses.length > 0) {
        setActiveBonuses(collectedBonuses);
      }
      if (collectedTrophies.length > 0) {
        setActiveTrophies(collectedTrophies);
      }
    });
  };

  const segmentLabels: Record<Segment, { zh: string; en: string }> = {
    review: { zh: '汉字回顾', en: 'Character Review' },
    sound: { zh: '听 & 拼', en: 'Sound & Pinyin' },
    sight: { zh: '看 & 配', en: 'Sight & Match' },
    meaning: { zh: '译 & 句', en: 'Meaning & Sentence' },
    boss: { zh: '海怪', en: 'Kraken' },
  };
  const segment = currentLevel.config.segment as Segment | undefined;
  const segmentChip = segment ? segmentLabels[segment] : null;

  const sceneSupportsHint =
    currentLevel.sceneType !== 'flashcard' && currentLevel.sceneType !== 'word_match';

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
        <AudioPickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} hintRequested={hintRequested} />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'visual_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <VisualPickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} hintRequested={hintRequested} />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'image_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <ImagePickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} hintRequested={hintRequested} />
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
        .filter(
          (p): p is { characterId: string; hanzi: string; word: string } => Boolean(p),
        );
      body =
        pairs.length >= 2 ? (
          <WordMatchScene key={currentLevel.id} pairs={pairs} onComplete={advance} />
        ) : (
          <MissingData />
        );
      break;
    }
    case 'boss': {
      const characterIds = (currentLevel.config.characterIds as string[] | undefined) ?? [];
      const questionTypes = (currentLevel.config.questionTypes as BossQuestionType[] | undefined) ?? ['audio_pick'];
      body = (
        <BossScene
          key={currentLevel.id}
          characterIds={characterIds}
          questionTypes={questionTypes}
          pool={pool}
          onComplete={advance}
        />
      );
      break;
    }
    case 'pinyin_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <PinyinPickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} hintRequested={hintRequested} />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'translate_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      const direction = (currentLevel.config.direction as TranslateDirection | undefined) ?? 'cn_to_en';
      body = c ? (
        <TranslatePickScene
          key={currentLevel.id}
          target={c}
          pool={pool}
          direction={direction}
          onComplete={advance}
          hintRequested={hintRequested}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'sentence_cloze': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c && c.sentence ? (
        <SentenceClozeScene
          key={currentLevel.id}
          target={c}
          pool={pool}
          sentenceText={c.sentence.text}
          translationEn={c.sentence.translationEn}
          onComplete={advance}
          hintRequested={hintRequested}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'image_word': {
      const config = currentLevel.config as {
        characterId: string;
        wordId: string;
        distractorWordIds: string[];
      };
      const baseCharDetail = charactersById[config.characterId];
      if (!baseCharDetail) {
        body = <MissingData />;
        break;
      }

      const allWords = new Map<string, CharacterWord>();
      for (const c of pool) {
        for (const w of c.words) allWords.set(w.id, w);
      }
      const correctWord = allWords.get(config.wordId);
      const distractors = config.distractorWordIds
        .map((id) => allWords.get(id))
        .filter((w): w is CharacterWord => w !== undefined);
      if (!correctWord || distractors.length !== 3) {
        body = <MissingData />;
        break;
      }

      body = (
        <ImageWordScene
          key={currentLevel.id}
          baseChar={{ characterId: baseCharDetail.characterId, hanzi: baseCharDetail.hanzi }}
          correctWord={{
            wordId: correctWord.id,
            text: correctWord.text,
            imageHook: correctWord.imageHook,
            meaningEn: correctWord.meaningEn,
            imageUrl: correctWord.imageUrl,
          }}
          distractors={distractors.map((w) => ({
            wordId: w.id,
            text: w.text,
            imageHook: w.imageHook,
            meaningEn: w.meaningEn,
            imageUrl: w.imageUrl,
          }))}
          onComplete={advance}
          hintRequested={hintRequested}
        />
      );
      break;
    }
    default:
      body = <MissingData />;
  }

  return (
    <CoinHudContext.Provider value={{ coinHudRef }}>
      <main className="flex min-h-[80vh] flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-sand-200)] bg-white/50 px-6 py-3 text-sm text-[var(--color-sand-900)] backdrop-blur">
          <span className="font-hanzi font-semibold">{weekLabel}</span>
          <span className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--color-ocean-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-ocean-700)]">
              {index + 1} / {totalLevels}
            </span>
            <span
              ref={coinHudRef as React.RefObject<HTMLSpanElement>}
              className="rounded-full bg-[var(--color-treasure-400)] px-3 py-0.5 text-sm font-bold text-[var(--color-treasure-700)]"
            >
              🪙 {coinsThisSession}
            </span>
          </span>
        </div>
        {segmentChip && (
          <div className="flex justify-center bg-[var(--color-sand-50)] py-2">
            <span
              data-testid="segment-chip"
              className="rounded-full border border-[var(--color-sand-300)] bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-[var(--color-sand-900)] shadow-sm"
            >
              {segmentChip.zh} · {segmentChip.en}
            </span>
          </div>
        )}
        {body}
        {sessionId && (
          <PowerupTray
            childId={childId}
            hintCount={hintCount}
            skipCount={skipCount}
            sceneSupportsHint={sceneSupportsHint}
            weekLevelId={currentLevel.id}
            sessionId={sessionId}
            onHintActivated={() => {
              setHintCount((n) => n - 1);
              setHintActivatedAtIndex(index);
            }}
            onSkipped={() => {
              setSkipCount((n) => n - 1);
              const nextIndex = index + 1;
              if (nextIndex >= levels.length) {
                setLastSceneType(currentLevel.sceneType);
                setDone(true);
              } else {
                setLastSceneType(currentLevel.sceneType);
                setIndex(nextIndex);
              }
            }}
          />
        )}
        {showStarterToast && !starterDismissed && (
          <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-2xl border-4 border-amber-800/40 bg-amber-100 px-4 py-3 text-center text-sm font-bold text-amber-950 shadow-2xl">
            🎁 礼物! / Starter pack!
            <div className="mt-1 text-xs font-semibold text-amber-900">
              💡 + ⏭️ 在你的工具栏 / in your tray
            </div>
          </div>
        )}
        <BonusToast
          bonuses={activeBonuses}
          onDone={() => setActiveBonuses([])}
        />
        <TrophyToast
          trophies={activeTrophies}
          onDone={() => setActiveTrophies([])}
        />
      </main>
    </CoinHudContext.Provider>
  );
}

function MissingData() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center text-[var(--color-bad)]">
      Missing data for this scene — re-publish the week from /parent.
    </main>
  );
}
