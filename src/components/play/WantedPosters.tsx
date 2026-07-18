'use client';

// T2 通缉令 — daily wanted-character posters. The hanzi is the quarry (no
// pinyin/meaning shown); correct answers anywhere tick the poster; a full
// poster pays coins, and clearing all three pays a bounty card.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { claimBountyAction } from '@/lib/actions/bounty';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { BOUNTY_REWARD_COINS } from '@/lib/bounty/ranking';
import type { BountyPosterView } from '@/lib/db/bounties';
import type { RevealCard } from '@/lib/play/reveal-card';

interface Props {
  childId: string;
  posters: BountyPosterView[];
}

export function WantedPosters({ childId, posters: initial }: Props) {
  const router = useRouter();
  const [posters, setPosters] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<RevealCard[] | null>(null);

  if (posters.length === 0) return null;

  const claim = (characterId: string) => {
    startTransition(async () => {
      const outcome = await claimBountyAction(childId, characterId);
      if (outcome.ok) {
        setPosters((prev) =>
          prev.map((p) => (p.characterId === characterId ? { ...p, claimed: true } : p)),
        );
        if (outcome.card) setReveal([outcome.card]);
        else router.refresh();
      } else if (outcome.reason === 'already_claimed') {
        setPosters((prev) =>
          prev.map((p) => (p.characterId === characterId ? { ...p, claimed: true } : p)),
        );
      }
    });
  };

  return (
    <section
      data-testid="wanted-posters"
      className="rounded-3xl border-2 border-amber-900/25 bg-gradient-to-b from-amber-100 to-amber-200/70 p-4 shadow-md"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-hanzi text-lg font-extrabold text-amber-950">
          🏴‍☠️ 通缉令 <span className="text-sm font-semibold opacity-80">/ Wanted</span>
        </h2>
        <span className="text-xs font-semibold text-amber-900/70">
          全部拿下有惊喜 / Clear all 3 for a card
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {posters.map((p) => {
          const done = p.progress >= p.required;
          return (
            <div
              key={p.characterId}
              data-testid={`bounty-poster-${p.hanzi}`}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-[#f6ead2] p-2 text-center shadow-sm ${
                p.claimed ? 'border-emerald-600/40 opacity-70' : 'border-amber-900/30'
              }`}
            >
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-900/70">
                通缉 · Wanted
              </span>
              {p.claimed || !p.weekId ? (
                <span className="font-hanzi text-4xl font-bold text-amber-950">{p.hanzi}</span>
              ) : (
                <Link
                  href={`/play/${childId}/week/${p.weekId}`}
                  className="font-hanzi text-4xl font-bold text-amber-950 underline-offset-4 hover:underline"
                  aria-label={`去第${p.weekNumber}周练习 ${p.hanzi} / Practice ${p.hanzi} in week ${p.weekNumber}`}
                >
                  {p.hanzi}
                </Link>
              )}
              <span aria-hidden="true" className="text-xs tracking-widest text-amber-900">
                {Array.from({ length: p.required }, (_, i) => (i < p.progress ? '●' : '○')).join('')}
              </span>
              {p.claimed ? (
                <span className="text-[10px] font-bold text-emerald-700">✓ 已领 / Claimed</span>
              ) : done ? (
                <button
                  type="button"
                  data-testid={`bounty-claim-${p.hanzi}`}
                  disabled={pending}
                  onClick={() => claim(p.characterId)}
                  className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-extrabold text-white shadow disabled:opacity-50"
                >
                  领赏 🪙{BOUNTY_REWARD_COINS} / Claim
                </button>
              ) : (
                <span className="text-[10px] font-semibold text-amber-900/80">
                  赏金 🪙{BOUNTY_REWARD_COINS} / Bounty
                </span>
              )}
            </div>
          );
        })}
      </div>

      {reveal && (
        <CardChestReveal
          cards={reveal}
          onDone={() => {
            setReveal(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
