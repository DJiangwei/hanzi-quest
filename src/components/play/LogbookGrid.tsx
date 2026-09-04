'use client';

import { useState } from 'react';
import type { MasteryState } from '@/lib/mastery/mastery';
import { SpeakButton } from '@/components/play/SpeakButton';

export interface LogbookTile {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  firstWord: string | null;
  sentence: string | null;
  state: MasteryState;
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

  return (
    <div className="w-full" data-testid="logbook-grid">
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {tiles.map((t) => {
          const badge = BADGE[t.state];
          return (
            <li key={t.characterId}>
              <button
                type="button"
                data-testid={`logbook-tile-${t.characterId}`}
                onClick={() => setOpenId(t.characterId)}
                aria-label={`${t.hanzi} ${t.pinyin.join(' ')}`}
                className="flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 border-stone-200 bg-white/90 px-1 py-2 transition hover:-translate-y-0.5 hover:border-amber-300"
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

      {open ? (
        <div
          data-testid="logbook-detail"
          className="mt-4 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-center"
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
      ) : null}
    </div>
  );
}
