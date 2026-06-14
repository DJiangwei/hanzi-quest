'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { EconomyBonus, GrantedTrophy, CardSkipReason } from '@/lib/actions/play';
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
import { XpGainToast } from '@/components/play/XpGainToast';
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
import { LianliankanScene } from './LianliankanScene';
import type { BossQuestionType, Segment, TranslateDirection } from '@/lib/scenes/configs';
import type { RevealCard } from '@/lib/play/reveal-card';

const LevelFanfare = dynamic(
  () => import('./fx/LevelFanfare').then((m) => m.LevelFanfare),
  { ssr: false },
);

const CardChestReveal = dynamic(
  () => import('./fx/CardChestReveal').then((m) => m.CardChestReveal),
  { ssr: false },
);

interface CharacterWord {
  id: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
  imageUrl: string | null;
  audioUrl?: string | null;
}

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  audioUrl?: string | null;
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
  | 'image_word'
  | 'lianliankan';

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
  /** 1-based week number used for boss creature selection. Defaults to 1. */
  weekNumber?: number;
  /** Which section this run plays — drives boss detection + per-section card grants. */
  section?: 'review' | 'practice' | 'boss';
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
  weekNumber = 1,
  section = 'boss',
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
  const [revealCards, setRevealCards] = useState<RevealCard[]>([]);
  const [cardMessage, setCardMessage] = useState<CardSkipReason | null>(null);
  const [activeBonuses, setActiveBonuses] = useState<EconomyBonus[]>([]);
  const [activeTrophies, setActiveTrophies] = useState<GrantedTrophy[]>([]);
  const [activeXp, setActiveXp] = useState<{ gained: number; level: number; leveledUp: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [skipCount, setSkipCount] = useState(initialPowerupCounts.skip);
  // Hint is FREE in practice (2026-06-07): no token, no server call. Track which
  // level index it was activated for, so it auto-clears on level change.
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
      <>
        <LevelFanfare
          weekLabel={weekLabel}
          coinsThisSession={coinsThisSession}
          childId={childId}
          weekId={weekId}
          chestAvailable={lastSceneType === 'boss'}
          cardMessage={cardMessage}
          onContinue={() => router.push(resolvedExitHref)}
        />
        {revealCards.length > 0 ? (
          <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} />
        ) : null}
      </>
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
      if (result.giftPack?.cards?.length) {
        setRevealCards((q) => [
          ...q,
          ...result.giftPack!.cards.map((c) => ({
            id: c.itemId,
            slug: c.slug,
            packSlug: c.packSlug,
            nameZh: c.nameZh,
            nameEn: c.nameEn,
            loreZh: c.loreZh,
            loreEn: c.loreEn,
            isDupe: c.isDupe,
            shardsAfter: c.shardsAfter,
          })),
        ]);
      }
      const collectedBonuses: EconomyBonus[] = [...result.bonuses];
      const collectedTrophies: GrantedTrophy[] = [...result.trophies];
      let collectedXp = result.xp.gained > 0 || result.xp.leveledUp ? result.xp : null;

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
          section,
          totalScenesPassed: totalLevels,
          totalScenesInWeek: totalLevels,
          durationSeconds: elapsedSeconds,
        });
        collectedBonuses.push(...levelResult.bonuses);
        collectedTrophies.push(...levelResult.trophies);
        if (levelResult.cardGrants.length) {
          setRevealCards((q) => [...q, ...levelResult.cardGrants]);
        }
        if (levelResult.cardMessage) {
          setCardMessage(levelResult.cardMessage);
        }
        // Accumulate level XP — prefer the level-up signal from finishLevelAction
        if (levelResult.xp.gained > 0 || levelResult.xp.leveledUp) {
          const gained = (collectedXp?.gained ?? 0) + levelResult.xp.gained;
          collectedXp = {
            gained,
            level: levelResult.xp.leveledUp ? levelResult.xp.level : (collectedXp?.level ?? levelResult.xp.level),
            leveledUp: (collectedXp?.leveledUp ?? false) || levelResult.xp.leveledUp,
          };
        }
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
      if (collectedXp) {
        setActiveXp(collectedXp);
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

  // Hint is free in practice but NOT offered during the boss (David, 2026-06-07).
  const sceneSupportsHint =
    currentLevel.sceneType !== 'flashcard' &&
    currentLevel.sceneType !== 'word_match' &&
    currentLevel.sceneType !== 'boss';

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
            hanziAudioUrl: c.audioUrl ?? null,
            pinyin: c.pinyinArray,
            meaningEn: c.meaningEn,
            meaningZh: c.meaningZh,
            imageHook: c.imageHook,
            firstWord: c.firstWord,
            firstWordAudioUrl: c.words[0]?.audioUrl ?? null,
            firstSentence: c.sentence?.text ?? null,
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
      // 看图找字: show a picture from one of the char's words (reusing the word
      // images) and ask which character it is. Falls back to the imageHook text
      // card inside ImagePickScene when no word image exists.
      const stimulusImageUrl = c?.words.find((w) => w.imageUrl)?.imageUrl ?? null;
      body = c ? (
        <ImagePickScene
          key={currentLevel.id}
          target={c}
          imageUrl={stimulusImageUrl}
          pool={pool}
          onComplete={advance}
          hintRequested={hintRequested}
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
          weekNumber={weekNumber}
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
          weekChars={pool.map((c) => c.hanzi)}
          correctWord={{
            wordId: correctWord.id,
            text: correctWord.text,
            imageHook: correctWord.imageHook,
            meaningEn: correctWord.meaningEn,
            imageUrl: correctWord.imageUrl,
            audioUrl: correctWord.audioUrl ?? null,
          }}
          distractors={distractors.map((w) => ({
            wordId: w.id,
            text: w.text,
            imageHook: w.imageHook,
            meaningEn: w.meaningEn,
            imageUrl: w.imageUrl,
            audioUrl: w.audioUrl ?? null,
          }))}
          onComplete={advance}
          hintRequested={hintRequested}
        />
      );
      break;
    }
    case 'lianliankan': {
      const characterIds = currentLevel.config.characterIds as string[] | undefined;
      if (!characterIds || characterIds.length !== 4) {
        body = <MissingData />;
        break;
      }
      const resolved = characterIds
        .map((id) => charactersById[id])
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      body =
        resolved.length === 4 ? (
          <LianliankanScene
            key={currentLevel.id}
            chars={resolved.map((c) => ({
              characterId: c.characterId,
              hanzi: c.hanzi,
              meaningEn: c.meaningEn ?? '',
            }))}
            onComplete={advance}
            hintRequested={hintRequested}
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
            hintActive={hintRequested}
            skipCount={skipCount}
            sceneSupportsHint={sceneSupportsHint}
            weekLevelId={currentLevel.id}
            sessionId={sessionId}
            onHintActivated={() => {
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
              ⏭️ 跳过道具在工具栏 · 💡 提示免费 / Skip in your tray · hints are free
            </div>
          </div>
        )}
        {revealCards.length > 0 ? (
          <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} />
        ) : null}
        <BonusToast
          bonuses={activeBonuses}
          onDone={() => setActiveBonuses([])}
        />
        <TrophyToast
          trophies={activeTrophies}
          onDone={() => setActiveTrophies([])}
        />
        {activeXp && (
          <XpGainToast
            gained={activeXp.gained}
            leveledUp={activeXp.leveledUp}
            level={activeXp.level}
            onDone={() => setActiveXp(null)}
          />
        )}
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
