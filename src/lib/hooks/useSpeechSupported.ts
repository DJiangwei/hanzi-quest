'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

const getSnapshot = (): boolean =>
  typeof window !== 'undefined' && window.speechSynthesis != null;

const getServerSnapshot = (): boolean => false;

export function useSpeechSupported(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
