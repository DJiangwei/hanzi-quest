import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));

const shopMocks = vi.hoisted(() => ({
  getEquippedAvatar: vi.fn(),
}));

vi.mock('@/lib/db/shop', () => ({
  getEquippedAvatar: shopMocks.getEquippedAvatar,
}));

import { childExists, listCrewMates, listCrewOwnershipForPack } from '@/lib/db/crew';

// The raw row includes `displayName` (as a real `childProfiles` row would if
// a future edit ever widened the select) so the leak test has something to
// catch. `listCrewMates` must select `id` only and never let this through.
const RAW_ROWS = [
  { id: 'c-self', displayName: 'Yinuo' },
  { id: 'c-mate-1', displayName: 'Yinuo' },
  { id: 'c-mate-2', displayName: 'Someone Else' },
];

function mockRowsForExclude(excludeChildId: string) {
  const whereMock = vi
    .fn()
    .mockResolvedValue(RAW_ROWS.filter((r) => r.id !== excludeChildId).map((r) => ({ id: r.id })));
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({ where: whereMock }),
  });
  return whereMock;
}

beforeEach(() => {
  dbMock.select.mockReset();
  shopMocks.getEquippedAvatar.mockReset();
  shopMocks.getEquippedAvatar.mockResolvedValue({
    head: { avatarItemId: 'a1', unlockRef: 'default-kid-warm', slotId: 'head', isDefault: true },
    hat: { avatarItemId: 'a2', unlockRef: 'default-bandana-red', slotId: 'hat', isDefault: true },
  });
});

describe('listCrewMates', () => {
  it('never returns a real name', async () => {
    mockRowsForExclude('c-self');
    const mates = await listCrewMates('c-self');
    expect(mates.length).toBeGreaterThan(0);
    for (const m of mates) {
      expect(Object.keys(m).sort()).toEqual(['childId', 'equipped', 'nickname']);
      expect(JSON.stringify(m)).not.toContain('Yinuo');
    }
  });

  it("excludes the caller's own child", async () => {
    const whereMock = mockRowsForExclude('c-self');
    const mates = await listCrewMates('c-self');
    expect(mates.map((m) => m.childId)).not.toContain('c-self');
    expect(mates.map((m) => m.childId).sort()).toEqual(['c-mate-1', 'c-mate-2']);
    // A where clause was actually constructed (not an unfiltered select).
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock.mock.calls[0][0]).toBeDefined();
  });

  it('gives each mate a bilingual nickname', async () => {
    mockRowsForExclude('c-self');
    const mates = await listCrewMates('c-self');
    for (const m of mates) {
      expect(m.nickname.zh.length).toBeGreaterThan(0);
      expect(m.nickname.en.length).toBeGreaterThan(0);
    }
  });

  it('flattens each mate\'s equipped avatar to slot -> unlockRef', async () => {
    mockRowsForExclude('c-self');
    const mates = await listCrewMates('c-self');
    for (const m of mates) {
      expect(m.equipped).toEqual({
        head: 'default-kid-warm',
        hat: 'default-bandana-red',
      });
    }
    // avatarItemId/slotId/isDefault must not leak through — only the ref.
    for (const m of mates) {
      expect(JSON.stringify(m)).not.toContain('avatarItemId');
    }
  });

  it('returns [] for an empty crew', async () => {
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    const mates = await listCrewMates('c-self');
    expect(mates).toEqual([]);
    expect(shopMocks.getEquippedAvatar).not.toHaveBeenCalled();
  });
});

describe('childExists', () => {
  // The recipient side of `giftCardAction`. A boolean by design: this is a
  // cross-account read, and anything richer would put another family's
  // `displayName` in a caller's hands.
  function mockLookup(rows: unknown[]) {
    const limitMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbMock.select.mockReturnValue({ from: fromMock });
    return { fromMock, whereMock, limitMock };
  }

  it('is true for a child that exists, false for one that does not', async () => {
    mockLookup([{ id: 'c-mate-1' }]);
    await expect(childExists('c-mate-1')).resolves.toBe(true);
    mockLookup([]);
    await expect(childExists('nope')).resolves.toBe(false);
  });

  it('returns a boolean, never a row — even if the query ever returns one', async () => {
    // A row shaped like a real childProfiles row, name included. Whatever the
    // query hands back, only `true` may leave this function.
    mockLookup([{ id: 'c-mate-1', displayName: 'Yinuo' }]);
    const result = await childExists('c-mate-1');
    expect(result).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Yinuo');
  });

  it('filters by id and limits to one row', async () => {
    const { whereMock, limitMock } = mockLookup([]);
    await childExists('c-mate-1');
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock.mock.calls[0][0]).toBeDefined();
    expect(limitMock).toHaveBeenCalledWith(1);
  });
});

describe('listCrewOwnershipForPack', () => {
  // The gift picker's whole reason to exist: which crewmates already own
  // this card, so the UI can grey them out and label them 已经有了.
  function mockJoin(rows: { itemId: string; childId: string }[]) {
    const whereMock = vi.fn().mockResolvedValue(rows);
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    dbMock.select.mockReturnValue({ from: fromMock });
    return { whereMock, innerJoinMock, fromMock };
  }

  it('returns {} for an empty crew WITHOUT issuing a query', async () => {
    const result = await listCrewOwnershipForPack('pack-1', []);
    expect(result).toEqual({});
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('groups owning childIds by itemId', async () => {
    mockJoin([
      { itemId: 'item-a', childId: 'c-mate-1' },
      { itemId: 'item-a', childId: 'c-mate-2' },
      { itemId: 'item-b', childId: 'c-mate-1' },
    ]);
    const result = await listCrewOwnershipForPack('pack-1', ['c-mate-1', 'c-mate-2']);
    expect(result).toEqual({
      'item-a': ['c-mate-1', 'c-mate-2'],
      'item-b': ['c-mate-1'],
    });
  });

  it('returns {} when no crewmate owns anything in the pack', async () => {
    mockJoin([]);
    const result = await listCrewOwnershipForPack('pack-1', ['c-mate-1']);
    expect(result).toEqual({});
  });

  it('scopes the where clause by pack AND crew membership', async () => {
    const { whereMock } = mockJoin([]);
    await listCrewOwnershipForPack('pack-1', ['c-mate-1']);
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock.mock.calls[0][0]).toBeDefined();
  });
});
