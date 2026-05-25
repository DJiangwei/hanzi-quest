'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface MidSceneCtx {
  midScene: boolean;
  setMidScene: (v: boolean) => void;
}

const Ctx = createContext<MidSceneCtx>({
  midScene: false,
  setMidScene: () => undefined,
});

export function MidSceneProvider({ children }: { children: React.ReactNode }) {
  const [midScene, setMidScene] = useState(false);
  return (
    <Ctx.Provider value={{ midScene, setMidScene }}>{children}</Ctx.Provider>
  );
}

export function useMidScene(): MidSceneCtx {
  return useContext(Ctx);
}

/**
 * Mount this inside a section/scene server-component subtree (as a client
 * child) to flip the provider flag to true while the subtree is alive.
 * Restores to false on unmount.
 */
export function MidSceneFlag(): null {
  const { setMidScene } = useMidScene();
  useEffect(() => {
    setMidScene(true);
    return () => setMidScene(false);
  }, [setMidScene]);
  return null;
}
