import type { ComponentType } from 'react';
import type { AnchorSlug } from './anchors';
import { Sailboat } from '@/components/play/decorations/Sailboat';
import { SeagullPair } from '@/components/play/decorations/SeagullPair';
import { Hibiscus } from '@/components/play/decorations/Hibiscus';
import { FishSchool } from '@/components/play/decorations/FishSchool';
import { CompassRose } from '@/components/play/decorations/CompassRose';
import { Rainbow } from '@/components/play/decorations/Rainbow';
import { PirateFlag } from '@/components/play/decorations/PirateFlag';
import { WhaleTail } from '@/components/play/decorations/WhaleTail';
import { Lighthouse } from '@/components/play/decorations/Lighthouse';
import { TreasureChest } from '@/components/play/decorations/TreasureChest';

export interface DecorCatalogEntry {
  anchor: AnchorSlug;
  Component: ComponentType;
}

export const DECOR_CATALOG: Record<string, DecorCatalogEntry> = {
  'sailboat':       { anchor: 'top-right',        Component: Sailboat },
  'seagull-pair':   { anchor: 'top-left',         Component: SeagullPair },
  'hibiscus':       { anchor: 'left-margin-mid',  Component: Hibiscus },
  'fish-school':    { anchor: 'between-2-3',      Component: FishSchool },
  'compass-rose':   { anchor: 'bottom-center',    Component: CompassRose },
  'rainbow':        { anchor: 'between-4-5',      Component: Rainbow },
  'pirate-flag':    { anchor: 'left-margin-low',  Component: PirateFlag },
  'whale-tail':     { anchor: 'right-margin-mid', Component: WhaleTail },
  'lighthouse':     { anchor: 'between-6-7',      Component: Lighthouse },
  'treasure-chest': { anchor: 'between-8-9',      Component: TreasureChest },
};
