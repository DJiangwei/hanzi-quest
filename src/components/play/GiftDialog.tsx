'use client';

import { useState } from 'react';
import { AvatarRender } from '@/components/play/AvatarRender';
import { giftCardAction, type GiftActionOutcome } from '@/lib/actions/crew';
import { GIFTS_SENT_PER_DAY } from '@/lib/crew/gift-config';
import type { CrewMate } from '@/lib/db/crew';

type FailureReason = Extract<GiftActionOutcome, { ok: false }>['reason'];

/**
 * Bilingual, ZH-first copy for every way a gift can fail to send.
 *
 * `already_gifted_today` is NOT a mistake the child made — it just means
 * they already sent this exact friend a gift today — so it reads warm, not
 * like an error. None of these name the crewmate or compare children; they
 * describe only the giver's own situation or the item itself.
 */
const FAILURE_COPY: Record<FailureReason, string> = {
  no_duplicate: '这张卡的备用份用完啦 / No spare copies of this card left',
  already_owned: '船员已经有这张卡啦 / They already have this card',
  send_cap_reached: '今天的礼物送完啦，明天再来吧 / You are out of gifts for today — come back tomorrow',
  already_gifted_today: '今天已经送过他啦 / You already sent them one today',
  receive_cap_reached: '船员今天收到的礼物有点多，明天再送吧 / They have received a lot today — try again tomorrow',
  self_gift: '不能送给自己哦 / You cannot gift yourself a card',
  recipient_not_found: '找不到这位船员，请再试一次 / Could not find that crewmate — please try again',
};

interface GiftDialogProps {
  open: boolean;
  onClose: () => void;
  fromChildId: string;
  itemId: string;
  itemNameZh: string;
  itemNameEn: string;
  /** Everyone else in the deployment — plain data, never a real name. */
  crew: CrewMate[];
  /** childIds of crewmates who already own this card. */
  ownerIds: string[];
  giftsSentToday: number;
  /** Fired once `giftCardAction` returns `ok: true`. */
  onSent: () => void;
}

/**
 * The crewmate picker opened from `CardDetailDialog`'s 🎁 button.
 *
 * A crewmate who already owns the card is greyed out and labelled 已经有了
 * — not an error state, but the whole point of the feature: it shows the
 * child exactly what their friend is missing. Remaining capacity is the
 * GIVER's own number only; nothing here ever shows a received count, a
 * rank, or another child's real name (crewmates are nickname + avatar only).
 */
export function GiftDialog({
  open,
  onClose,
  fromChildId,
  itemId,
  itemNameZh,
  itemNameEn,
  crew,
  ownerIds,
  giftsSentToday,
  onSent,
}: GiftDialogProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailureReason | null>(null);

  if (!open) return null;

  const ownerSet = new Set(ownerIds);
  const remaining = Math.max(0, GIFTS_SENT_PER_DAY - giftsSentToday);

  async function handleGift(toChildId: string) {
    setFailure(null);
    setPendingId(toChildId);
    try {
      const outcome = await giftCardAction({ fromChildId, toChildId, itemId });
      if (outcome.ok) {
        onSent();
      } else {
        setFailure(outcome.reason);
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div
      data-testid="gift-dialog"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="送给船员 / Gift to a crewmate"
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-6 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-stone-900">
          送给船员 / Gift to a crewmate
        </h2>
        <p className="text-sm text-stone-600">
          {itemNameZh} / {itemNameEn}
        </p>
        <p data-testid="gift-remaining" className="text-xs font-semibold text-sky-700">
          今天还能送 {remaining} 张 / {remaining} gifts left today
        </p>

        {failure && (
          <p
            data-testid="gift-failure"
            className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
          >
            {FAILURE_COPY[failure]}
          </p>
        )}

        {crew.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">
            船上还没有别的船员 / No other crewmates yet
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {crew.map((mate) => {
              const alreadyOwns = ownerSet.has(mate.childId);
              const isPending = pendingId === mate.childId;
              return (
                <li key={mate.childId}>
                  <button
                    type="button"
                    data-testid={`gift-mate-${mate.childId}`}
                    disabled={alreadyOwns || pendingId !== null}
                    onClick={() => handleGift(mate.childId)}
                    aria-label={
                      alreadyOwns
                        ? `${mate.nickname.zh} / ${mate.nickname.en} — 已经有了 / already has it`
                        : `${mate.nickname.zh} / ${mate.nickname.en}`
                    }
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition-colors',
                      alreadyOwns
                        ? 'cursor-not-allowed border-stone-200 bg-stone-100 opacity-60'
                        : 'border-sky-300 bg-sky-50 hover:bg-sky-100',
                    ].join(' ')}
                  >
                    <AvatarRender equipped={mate.equipped} size={48} label="" />
                    <span className="flex flex-1 flex-col">
                      <span className="font-hanzi text-base font-bold text-stone-900">
                        {mate.nickname.zh}
                      </span>
                      <span className="text-xs text-stone-600">{mate.nickname.en}</span>
                    </span>
                    {alreadyOwns ? (
                      <span className="text-xs font-semibold text-stone-500">
                        已经有了 / already has it
                      </span>
                    ) : isPending ? (
                      <span className="text-xs font-semibold text-sky-600">
                        送出中… / Sending…
                      </span>
                    ) : (
                      <span aria-hidden className="text-xl">
                        🎁
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-1 rounded-full bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-900"
        >
          取消 / Cancel
        </button>
      </div>
    </div>
  );
}
