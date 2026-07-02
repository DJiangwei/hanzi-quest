import { describe, expect, it } from 'vitest';
import { latestChampionTitle } from '@/lib/collections/championsData';
import { mapOrderIndex } from '@/lib/play/map-order';

const SLUGS: Record<string, string> = {
  pack1: 'pirate-class-level-1',
  pack2: 'pirate-class-level-2',
};
const slugFor = (id: string) => SLUGS[id];

describe('latestChampionTitle', () => {
  it('returns null when no maps beaten', () => {
    expect(latestChampionTitle([], slugFor, mapOrderIndex)).toBeNull();
  });

  it('returns null when beaten maps have no champion title', () => {
    // pack2 (level-2) has no CHAMPION_TITLES entry yet
    expect(latestChampionTitle(['pack2'], slugFor, mapOrderIndex)).toBeNull();
  });

  it('returns the title of the only beaten titled map', () => {
    expect(latestChampionTitle(['pack1'], slugFor, mapOrderIndex)).toEqual({
      zh: '加勒比海霸主',
      en: 'Lord of the Caribbean',
    });
  });

  it('skips unknown packIds', () => {
    expect(latestChampionTitle(['unknown', 'pack1'], slugFor, mapOrderIndex)).toEqual({
      zh: '加勒比海霸主',
      en: 'Lord of the Caribbean',
    });
  });
});
