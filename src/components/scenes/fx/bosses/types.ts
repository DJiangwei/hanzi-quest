export type BossAnimState = 'intro' | 'idle' | 'damage' | 'defeat';

export interface BossCreatureProps {
  /** Which animation the creature is currently playing. */
  state: BossAnimState;
  /** Square render size in px. Default 200. */
  size?: number;
}
