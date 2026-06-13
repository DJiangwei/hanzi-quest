import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ queue: [] as unknown[][] }));

vi.mock('@/db', () => {
  function makeNode() {
    const val = state.queue.shift() ?? [];
    const node: Record<string, unknown> = {};
    node.from = () => node;
    node.innerJoin = () => node;
    node.where = () => node;
    node.limit = () => Promise.resolve(val);
    node.then = (r: (v: unknown) => void, j: (e: unknown) => void) =>
      Promise.resolve(val).then(r, j);
    return node;
  }
  return { db: { select: () => makeNode() } };
});

import { getEquippedAvatar } from '@/lib/db/shop';

const heads = [
  { id: 'h-warm', unlockRef: 'default-kid-warm', slotId: 'head', unlockVia: 'default' },
  { id: 'h-boy', unlockRef: 'default-kid-boy', slotId: 'head', unlockVia: 'default' },
  { id: 'h-girl', unlockRef: 'default-kid-girl', slotId: 'head', unlockVia: 'default' },
];
const hat = { id: 'hat1', unlockRef: 'default-bandana-red', slotId: 'hat', unlockVia: 'default' };

beforeEach(() => {
  state.queue = [];
});

describe('getEquippedAvatar — gendered head default', () => {
  it('picks the girl head when gender is girl', async () => {
    // call order: listDefaultAvatarItems → gender → equip rows
    state.queue = [[...heads, hat], [{ gender: 'girl' }], []];
    const res = await getEquippedAvatar('c1');
    expect(res.head.unlockRef).toBe('default-kid-girl');
    expect(res.hat.unlockRef).toBe('default-bandana-red');
  });

  it('picks the boy head when gender is boy', async () => {
    state.queue = [[...heads, hat], [{ gender: 'boy' }], []];
    const res = await getEquippedAvatar('c1');
    expect(res.head.unlockRef).toBe('default-kid-boy');
  });

  it('falls back to the neutral head when gender is null', async () => {
    state.queue = [[...heads, hat], [{ gender: null }], []];
    const res = await getEquippedAvatar('c1');
    expect(res.head.unlockRef).toBe('default-kid-warm');
  });
});
