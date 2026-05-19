// Pure error classes for the shop flow.
//
// Mirrors gacha-errors.ts: lives outside @/lib/db/shop (postgres-importing,
// not safe in browser bundles) and outside @/lib/actions/shop ('use server',
// async-only exports). Client components throw/catch these alongside the
// server actions they call.

export class InsufficientCoinsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient coins: need ${required}, have ${available}`);
    this.name = 'InsufficientCoinsError';
  }
}

export class AlreadyOwnedError extends Error {
  constructor(public readonly shopItemId: string) {
    super(`Shop item ${shopItemId} already owned`);
    this.name = 'AlreadyOwnedError';
  }
}

export class ShopItemNotFoundError extends Error {
  constructor(public readonly shopItemId: string) {
    super(`Shop item ${shopItemId} not found or inactive`);
    this.name = 'ShopItemNotFoundError';
  }
}

export class ItemNotPurchasableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemNotPurchasableError';
  }
}

export class NotOwnedError extends Error {
  constructor(public readonly avatarItemId: string) {
    super(`Avatar item ${avatarItemId} not in child inventory — cannot equip`);
    this.name = 'NotOwnedError';
  }
}
