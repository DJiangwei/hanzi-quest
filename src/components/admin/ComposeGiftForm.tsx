'use client';

import { useState } from 'react';
import {
  sendAdminGiftAction,
  type GiftResult,
} from '@/lib/actions/admin';
import { WELCOME_GIFT_DEFAULT, type GiftBundle } from '@/lib/admin/bundle';

const SHOP_KINDS = ['avatar', 'pet', 'sound_theme', 'decor', 'home'] as const;
type ShopKind = (typeof SHOP_KINDS)[number];

const KIND_LABEL: Record<ShopKind, string> = {
  avatar: 'Avatar / 装扮',
  pet: 'Pet / 宠物',
  sound_theme: 'Sound Theme / 音效',
  decor: 'Decoration / 装饰',
  home: 'Home / 家具',
};

interface ShopCatalogItem {
  id: string;
  kind: string;
  label: string;
}

interface CardCatalogItem {
  id: string;
  label: string;
}

interface Props {
  childId: string;
  cards: CardCatalogItem[];
  shopCatalog: ShopCatalogItem[];
}

type Status =
  | { phase: 'idle' }
  | { phase: 'confirming' }
  | { phase: 'sending' }
  | { phase: 'done'; result: GiftResult }
  | { phase: 'error'; message: string };

// ---------------------------------------------------------------------------
// Initial state seeded from WELCOME_GIFT_DEFAULT
// ---------------------------------------------------------------------------

function defaultCoins(): string {
  return String(WELCOME_GIFT_DEFAULT.coins ?? 0);
}

function defaultXp(): string {
  return String(WELCOME_GIFT_DEFAULT.xp ?? 0);
}

function defaultGiftPack(): boolean {
  return WELCOME_GIFT_DEFAULT.giftPack ?? false;
}

// ---------------------------------------------------------------------------
// Helper: group shop catalog by kind
// ---------------------------------------------------------------------------

function groupByKind(
  catalog: ShopCatalogItem[],
): Record<ShopKind, ShopCatalogItem[]> {
  const grouped = {} as Record<ShopKind, ShopCatalogItem[]>;
  for (const kind of SHOP_KINDS) grouped[kind] = [];
  for (const item of catalog) {
    const k = item.kind as ShopKind;
    if (SHOP_KINDS.includes(k)) grouped[k].push(item);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComposeGiftForm({ childId, cards, shopCatalog }: Props) {
  const shopByKind = groupByKind(shopCatalog);

  // Numeric fields
  const [coins, setCoins] = useState(defaultCoins);
  const [xp, setXp] = useState(defaultXp);
  const [shards, setShards] = useState('0');
  const [hintCount, setHintCount] = useState('0');
  const [skipCount, setSkipCount] = useState('0');
  const [freezeCount, setFreezeCount] = useState('0');

  // Toggles
  const [giftPack, setGiftPack] = useState(defaultGiftPack);

  // Card multi-select
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set(),
  );

  // Shop: per-kind "unlock all" and per-item selection
  const [shopUnlockAll, setShopUnlockAll] = useState<Set<ShopKind>>(new Set());
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(
    new Set(),
  );

  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  // ---------------------------------------------------------------------------
  // Build the bundle from current form state
  // ---------------------------------------------------------------------------
  function buildBundle(): GiftBundle {
    const bundle: GiftBundle = {};

    const coinsVal = parseInt(coins, 10);
    if (!isNaN(coinsVal) && coinsVal !== 0) bundle.coins = coinsVal;

    const xpVal = parseInt(xp, 10);
    if (!isNaN(xpVal) && xpVal > 0) bundle.xp = xpVal;

    const shardsVal = parseInt(shards, 10);
    if (!isNaN(shardsVal) && shardsVal > 0) bundle.shards = shardsVal;

    const powerups: GiftBundle['powerups'] = {};
    const hint = parseInt(hintCount, 10);
    const skip = parseInt(skipCount, 10);
    const freeze = parseInt(freezeCount, 10);
    if (!isNaN(hint) && hint > 0) powerups.hint = hint;
    if (!isNaN(skip) && skip > 0) powerups.skip = skip;
    if (!isNaN(freeze) && freeze > 0) powerups.streak_freeze = freeze;
    if (Object.keys(powerups).length > 0) bundle.powerups = powerups;

    if (giftPack) bundle.giftPack = true;

    const cardArr = Array.from(selectedCardIds);
    if (cardArr.length > 0) bundle.cardItemIds = cardArr;

    const shopArr = Array.from(selectedShopIds);
    if (shopArr.length > 0) bundle.shopItemIds = shopArr;

    const unlockAllArr = Array.from(shopUnlockAll) as ShopKind[];
    if (unlockAllArr.length > 0) bundle.shopUnlockAll = unlockAllArr;

    return bundle;
  }

  // ---------------------------------------------------------------------------
  // Submit flow
  // ---------------------------------------------------------------------------
  async function handleConfirm() {
    setStatus({ phase: 'sending' });
    try {
      const bundle = buildBundle();
      const res = await sendAdminGiftAction(childId, bundle);
      if (res.ok) {
        setStatus({ phase: 'done', result: res.result });
      } else {
        setStatus({ phase: 'error', message: (res as { reason: string }).reason });
      }
    } catch (err) {
      setStatus({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function handleReset() {
    setCoins(defaultCoins());
    setXp(defaultXp());
    setShards('0');
    setHintCount('0');
    setSkipCount('0');
    setFreezeCount('0');
    setGiftPack(defaultGiftPack());
    setSelectedCardIds(new Set());
    setSelectedShopIds(new Set());
    setShopUnlockAll(new Set());
    setStatus({ phase: 'idle' });
  }

  // ---------------------------------------------------------------------------
  // Card toggle
  // ---------------------------------------------------------------------------
  function toggleCard(id: string) {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Shop helpers
  // ---------------------------------------------------------------------------
  function toggleShopUnlockAll(kind: ShopKind) {
    setShopUnlockAll((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
        // Clear individual picks for this kind when unlock-all is enabled
        setSelectedShopIds((ids) => {
          const cleaned = new Set(ids);
          for (const item of shopByKind[kind]) cleaned.delete(item.id);
          return cleaned;
        });
      }
      return next;
    });
  }

  function toggleShopItem(id: string) {
    setSelectedShopIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const inputCls =
    'w-24 rounded-lg border border-[var(--color-sand-200)] bg-[var(--color-sand-50)] px-2 py-1 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-ocean-400)]';

  const labelCls = 'text-sm font-medium text-[var(--color-sand-900)]';

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------
  if (status.phase === 'done') {
    const r = status.result;
    return (
      <section
        data-testid="gift-form-success"
        className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm"
      >
        <h2 className="mb-2 text-base font-bold text-green-800">
          ✅ Gift sent! / 礼物已发放
        </h2>
        <ul className="flex flex-col gap-1 text-sm text-green-700">
          {r.coins != null && <li>🪙 Coins: {r.coins > 0 ? '+' : ''}{r.coins}</li>}
          {r.xp != null && <li>⭐ XP: +{r.xp}</li>}
          {r.shards != null && <li>🔹 Shards: +{r.shards}</li>}
          {r.powerups?.hint != null && <li>💡 Hints: +{r.powerups.hint}</li>}
          {r.powerups?.skip != null && <li>⏭️ Skips: +{r.powerups.skip}</li>}
          {r.powerups?.streak_freeze != null && (
            <li>🧊 Streak-Freeze: +{r.powerups.streak_freeze}</li>
          )}
          {r.cardItemIds.length > 0 && (
            <li>🎴 Cards: {r.cardItemIds.length} granted</li>
          )}
          {r.shopItemIds.length > 0 && (
            <li>🛒 Shop items newly owned: {r.shopItemIds.length}</li>
          )}
        </ul>
        <button
          onClick={handleReset}
          className="mt-4 rounded-full bg-[var(--color-ocean-700)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--color-ocean-800)]"
        >
          Send another / 再发一份
        </button>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Confirm dialog overlay
  // ---------------------------------------------------------------------------
  const showConfirm = status.phase === 'confirming';
  const sending = status.phase === 'sending';

  return (
    <section
      data-testid="compose-gift-form"
      className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        Compose Gift / 编辑礼物
      </h2>

      <div className="flex flex-col gap-5">
        {/* Economy */}
        <fieldset className="rounded-xl border border-[var(--color-sand-100)] p-4">
          <legend className="px-1 text-xs font-semibold text-[var(--color-sand-600)]">
            Economy / 经济
          </legend>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2">
              <span className={labelCls}>🪙 Coins</span>
              <input
                type="number"
                data-testid="input-coins"
                value={coins}
                onChange={(e) => setCoins(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={labelCls}>⭐ XP</span>
              <input
                type="number"
                data-testid="input-xp"
                value={xp}
                min="0"
                onChange={(e) => setXp(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={labelCls}>🔹 Shards</span>
              <input
                type="number"
                data-testid="input-shards"
                value={shards}
                min="0"
                onChange={(e) => setShards(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </fieldset>

        {/* Powerups */}
        <fieldset className="rounded-xl border border-[var(--color-sand-100)] p-4">
          <legend className="px-1 text-xs font-semibold text-[var(--color-sand-600)]">
            Powerups / 道具
          </legend>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2">
              <span className={labelCls}>💡 Hints</span>
              <input
                type="number"
                data-testid="input-hint"
                value={hintCount}
                min="0"
                onChange={(e) => setHintCount(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={labelCls}>⏭️ Skip</span>
              <input
                type="number"
                data-testid="input-skip"
                value={skipCount}
                min="0"
                onChange={(e) => setSkipCount(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={labelCls}>🧊 Streak-Freeze</span>
              <input
                type="number"
                data-testid="input-freeze"
                value={freezeCount}
                min="0"
                onChange={(e) => setFreezeCount(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </fieldset>

        {/* Gift pack */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            data-testid="checkbox-gift-pack"
            checked={giftPack}
            onChange={(e) => setGiftPack(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--color-ocean-600)]"
          />
          <span className={labelCls}>
            🎁 Gift Pack (one card per active gacha-eligible pack) / 大礼包
          </span>
        </label>

        {/* Specific cards */}
        {cards.length > 0 && (
          <fieldset className="rounded-xl border border-[var(--color-sand-100)] p-4">
            <legend className="px-1 text-xs font-semibold text-[var(--color-sand-600)]">
              Specific Cards / 指定卡片 ({selectedCardIds.size} selected)
            </legend>
            <div
              data-testid="card-list"
              className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto"
            >
              {cards.map((card) => (
                <label
                  key={card.id}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedCardIds.has(card.id)}
                    onChange={() => toggleCard(card.id)}
                    className="h-3.5 w-3.5 accent-[var(--color-ocean-600)]"
                  />
                  <span className="text-xs text-[var(--color-sand-800)]">
                    {card.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Shop items */}
        <fieldset className="rounded-xl border border-[var(--color-sand-100)] p-4">
          <legend className="px-1 text-xs font-semibold text-[var(--color-sand-600)]">
            Shop Items / 商店道具
          </legend>
          <div className="mt-2 flex flex-col gap-4">
            {SHOP_KINDS.map((kind) => {
              const items = shopByKind[kind];
              if (items.length === 0) return null;
              const allUnlocked = shopUnlockAll.has(kind);
              return (
                <div key={kind}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      data-testid={`unlock-all-${kind}`}
                      checked={allUnlocked}
                      onChange={() => toggleShopUnlockAll(kind)}
                      className="h-4 w-4 accent-[var(--color-treasure-500)]"
                    />
                    <span className="text-sm font-semibold text-[var(--color-sand-800)]">
                      Unlock all {KIND_LABEL[kind]} ({items.length} items)
                    </span>
                  </label>
                  {!allUnlocked && (
                    <div className="ml-6 mt-1 flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                      {items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={selectedShopIds.has(item.id)}
                            onChange={() => toggleShopItem(item.id)}
                            className="h-3 w-3 accent-[var(--color-ocean-600)]"
                          />
                          <span className="text-xs text-[var(--color-sand-700)]">
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* Error */}
        {status.phase === 'error' && (
          <p
            data-testid="gift-form-error"
            className="text-sm font-semibold text-red-600"
          >
            Error: {status.message}
          </p>
        )}

        {/* Submit */}
        <button
          data-testid="btn-send-gift"
          onClick={() => setStatus({ phase: 'confirming' })}
          disabled={sending}
          className="self-start rounded-full bg-[var(--color-treasure-400)] px-6 py-2 text-sm font-bold text-[var(--color-treasure-700)] shadow-sm transition-transform hover:bg-[var(--color-treasure-500)] active:scale-95 disabled:opacity-50"
        >
          Send Gift / 发放礼物 →
        </button>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm gift"
          data-testid="confirm-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--color-ocean-900)]">
              Confirm Gift / 确认发放
            </h3>
            <p className="text-sm text-[var(--color-sand-700)]">
              This will immediately grant the composed bundle to the selected
              child. The grant is logged and undoable.
            </p>
            <div className="flex gap-3">
              <button
                data-testid="btn-confirm"
                onClick={handleConfirm}
                disabled={sending}
                className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Confirm / 确认'}
              </button>
              <button
                data-testid="btn-cancel"
                onClick={() => setStatus({ phase: 'idle' })}
                disabled={sending}
                className="flex-1 rounded-full border border-[var(--color-sand-200)] px-4 py-2 text-sm font-semibold text-[var(--color-sand-700)] hover:bg-[var(--color-sand-50)] disabled:opacity-50"
              >
                Cancel / 取消
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
