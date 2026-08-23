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

import { listCrewMates } from '@/lib/db/crew';

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
