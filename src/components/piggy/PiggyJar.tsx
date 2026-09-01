'use client';

import { useId } from 'react';
import { formatPence } from '@/lib/piggy/money';

interface Props {
  balancePence: number;
  /** Compact variant for the home-page card. */
  compact?: boolean;
}

/**
 * Procedural SVG, deliberately not generated art: the Blob free tier is 2,000
 * advanced operations a month, and a jar that re-renders at several fill levels
 * is exactly the wrong thing to spend them on.
 *
 * £0 says 攒钱中 / Saving up. It NEVER says "earned nothing" — this product
 * pays boss_courage on a FAILED boss and keeps question progress on retry
 * precisely because the child was avoiding hard fights, and a scolding empty
 * state would undo that.
 */
export function PiggyJar({ balancePence, compact = false }: Props) {
  const empty = balancePence <= 0;
  // Fill rises with the balance but saturates — a full jar at £20 keeps the
  // art readable without implying a target she is failing to hit.
  const fill = Math.min(1, Math.max(0, balancePence / 2000));
  // useId(), not a hardcoded id: `compact` is explicitly meant to sit beside
  // a full jar (home-page card) or repeat across several children on one
  // page, and SVG ids are document-global — a hardcoded id lets a second
  // instance's fill clip against the first's path. See AvatarRender for the
  // same pattern.
  const clipId = useId();

  return (
    <div
      data-testid="piggy-jar"
      className={`flex items-center gap-3 ${compact ? '' : 'flex-col text-center'}`}
    >
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="存钱罐 / Piggy bank"
        className={compact ? 'h-12 w-12' : 'h-24 w-24'}
      >
        <defs>
          <clipPath id={clipId}>
            <path d="M14 26 h36 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-36 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z" />
          </clipPath>
        </defs>
        <path
          d="M14 26 h36 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-36 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z"
          fill="var(--color-sand-100)"
          stroke="var(--color-sunset-400)"
          strokeWidth="2"
        />
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="10"
            y={54 - 28 * fill}
            width="44"
            height={28 * fill}
            fill="var(--color-treasure-400)"
          />
        </g>
        <rect x="26" y="20" width="12" height="4" rx="2" fill="var(--color-sunset-400)" />
        <circle cx="22" cy="38" r="2" fill="var(--color-sand-700)" />
      </svg>

      <div className={compact ? '' : 'flex flex-col items-center'}>
        <p className="text-[11px] font-semibold text-[var(--color-sand-700)]">
          <span className="font-hanzi">存钱罐</span>{' '}
          <span className="italic">/ Piggy Bank</span>
        </p>
        <p
          data-testid="piggy-balance"
          className={`font-bold text-[var(--color-sand-900)] ${compact ? 'text-xl' : 'text-4xl'}`}
        >
          {formatPence(balancePence)}
        </p>
        {empty && (
          <p className="text-[11px] text-[var(--color-sand-700)]">
            <span className="font-hanzi">攒钱中…</span>{' '}
            <span className="italic">/ Saving up</span>
          </p>
        )}
      </div>
    </div>
  );
}
