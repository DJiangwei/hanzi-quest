'use client';

import { useEffect, useState } from 'react';
import type { MasteryState } from '@/lib/mastery/mastery';
import { SpeakButton } from '@/components/play/SpeakButton';
import { hanziNumber } from '@/lib/i18n/hanzi-number';

export interface LogbookTile {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  firstWord: string | null;
  sentence: string | null;
  state: MasteryState;
  /** Which sea taught it. The Logbook spans every map she has entered, and
   *  week numbers repeat across maps, so the tiles arrive grouped. */
  packId: string;
  mapNameZh: string;
  mapNameEn: string;
}

/**
 * 熟练 is the only decorated state. `learning` and `unrated` are deliberately
 * quiet — no colour, no percentage, no "needs work". A badge she has not
 * earned is a false signal, and a page that marks two thirds of her characters
 * as lacking is a report card, which this product is not.
 */
const BADGE: Record<MasteryState, { zh: string; en: string; cls: string } | null> = {
  proficient: {
    zh: '熟练',
    en: 'Solid',
    cls: 'bg-amber-300 text-amber-950 border-amber-400',
  },
  learning: {
    zh: '学习中',
    en: 'Learning',
    cls: 'bg-stone-100 text-stone-600 border-stone-300',
  },
  unrated: null,
};

export function LogbookGrid({ tiles }: { tiles: LogbookTile[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tiles.find((t) => t.characterId === openId) ?? null;

  // Grouping preserves arrival order rather than re-sorting: getLogbookEntries
  // already ordered by map (curriculum_packs.created_at), then week, then
  // teaching position — the same order the voyage board uses. Re-deriving it
  // here would give the Logbook a second opinion about how maps are ordered.
  const groups: { packId: string; mapNameZh: string; mapNameEn: string; tiles: LogbookTile[] }[] = [];
  for (const t of tiles) {
    const last = groups[groups.length - 1];
    if (last && last.packId === t.packId) last.tiles.push(t);
    else groups.push({ packId: t.packId, mapNameZh: t.mapNameZh, mapNameEn: t.mapNameEn, tiles: [t] });
  }

  // Same dismissal contract as CardDetailDialog: Escape closes the overlay
  // from anywhere on the page, not just via the backdrop/close button.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  return (
    <div className="w-full" data-testid="logbook-grid">
      {groups.map((g) => (
        <section key={g.packId} className="mb-4 last:mb-0">
          {/* The heading appears only when there is more than one sea. A single
              map does not need a divider announcing itself, and the header
              already counts the characters. */}
          {groups.length > 1 ? (
            <h2
              data-testid={`logbook-map-${g.packId}`}
              className="mb-1.5 flex items-baseline gap-1.5 border-b border-stone-200 pb-1 text-sm"
            >
              <span className="font-hanzi font-extrabold text-stone-700">{g.mapNameZh}</span>
              <span className="text-xs italic text-stone-500">{g.mapNameEn}</span>
              <span className="ml-auto font-hanzi text-xs text-stone-500">
                {hanziNumber(g.tiles.length)} 个字
              </span>
            </h2>
          ) : null}
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {g.tiles.map((t) => {
          const badge = BADGE[t.state];
          const selected = t.characterId === openId;
          return (
            <li key={t.characterId}>
              <button
                type="button"
                data-testid={`logbook-tile-${t.characterId}`}
                onClick={() => setOpenId(t.characterId)}
                aria-label={`${t.hanzi} ${t.pinyin.join(' ')}`}
                aria-pressed={selected}
                className={`flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 bg-white/90 px-1 py-2 transition hover:-translate-y-0.5 hover:border-amber-300 ${
                  selected ? 'border-amber-400 ring-2 ring-amber-300' : 'border-stone-200'
                }`}
              >
                <span className="font-hanzi text-3xl leading-none text-stone-800">{t.hanzi}</span>
                <span className="text-[10px] text-stone-500">{t.pinyin.join(' ')}</span>
                {badge ? (
                  <span
                    data-testid={`logbook-badge-${t.characterId}`}
                    className={`mt-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold ${badge.cls}`}
                  >
                    <span className="font-hanzi">{badge.zh}</span>{' '}
                    <span className="italic">{badge.en}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
        </section>
      ))}

      {/*
        Below-the-fold fix: with production's ~96 unlocked characters the grid
        runs to ~24 rows, so a detail panel appended after the <ul> is off
        screen for almost every tap. Match Backpack's CardDetailDialog
        instead — she already knows "tap a tile → overlay" from there, and
        that component already solved backdrop + dismissal + layering.
      */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          onClick={() => setOpenId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${open.hanzi} ${open.pinyin.join(' ')}`}
        >
          <div
            data-testid="logbook-detail"
            className="w-full max-w-sm rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-hanzi text-6xl text-stone-800">{open.hanzi}</div>
            <div className="mt-1 text-sm text-stone-600">{open.pinyin.join(' ')}</div>
            {open.meaningEn ? (
              <div className="mt-1 text-base font-semibold text-stone-800">{open.meaningEn}</div>
            ) : null}
            {open.firstWord ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="font-hanzi text-xl text-stone-800">{open.firstWord}</span>
                <SpeakButton text={open.firstWord} />
              </div>
            ) : null}
            {open.sentence ? (
              <p className="mt-2 font-hanzi text-sm text-stone-700">{open.sentence}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="mt-4 rounded-full border-2 border-stone-300 bg-white px-4 py-1.5 text-sm font-semibold text-stone-700"
            >
              <span className="font-hanzi">关闭</span> <span className="italic">/ Close</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
