import type { SceneRegistration, SceneType } from './types';

const registry = new Map<SceneType, SceneRegistration<unknown>>();

export function registerScene<C>(reg: SceneRegistration<C>): void {
  if (registry.has(reg.type)) {
    throw new Error(`Scene type "${reg.type}" already registered`);
  }
  registry.set(reg.type, reg as SceneRegistration<unknown>);
}

export function getScene<C = unknown>(type: SceneType): SceneRegistration<C> {
  const reg = registry.get(type);
  if (!reg) {
    throw new Error(`Scene type "${type}" not registered`);
  }
  return reg as SceneRegistration<C>;
}

export function listScenes(): SceneType[] {
  return Array.from(registry.keys());
}

// Test-only helper. Production code should never need this.
export function __resetSceneRegistry(): void {
  registry.clear();
}
