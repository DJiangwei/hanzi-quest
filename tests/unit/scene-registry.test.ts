import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  __resetSceneRegistry,
  getScene,
  listScenes,
  registerScene,
} from '@/lib/scenes/registry';
import type { SceneRegistration } from '@/lib/scenes/types';

const FlashcardConfig = z.object({ characterId: z.string() });
type FlashcardConfig = z.infer<typeof FlashcardConfig>;

function makeRegistration(): SceneRegistration<FlashcardConfig> {
  return {
    type: 'flashcard',
    configSchema: FlashcardConfig,
    Component: () => null,
  };
}

describe('scene registry', () => {
  beforeEach(() => {
    __resetSceneRegistry();
  });

  it('registers and retrieves a scene by type', () => {
    const reg = makeRegistration();
    registerScene(reg);
    expect(getScene('flashcard')).toBe(reg);
  });

  it('throws when registering the same type twice', () => {
    registerScene(makeRegistration());
    expect(() => registerScene(makeRegistration())).toThrow(/already registered/);
  });

  it('throws when retrieving an unregistered type', () => {
    expect(() => getScene('boss')).toThrow(/not registered/);
  });

  it('lists registered types', () => {
    registerScene(makeRegistration());
    expect(listScenes()).toEqual(['flashcard']);
  });
});
