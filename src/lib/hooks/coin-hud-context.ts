'use client';

import { createContext, useContext, type RefObject } from 'react';

interface CoinHudValue {
  coinHudRef: RefObject<HTMLElement | null>;
}

const defaultValue: CoinHudValue = {
  coinHudRef: { current: null },
};

export const CoinHudContext = createContext<CoinHudValue>(defaultValue);

export function useCoinHud(): CoinHudValue {
  return useContext(CoinHudContext);
}
