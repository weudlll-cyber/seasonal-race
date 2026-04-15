/**
 * File: packages/race-types/src/index.ts
 * Purpose: Central registration entry for race-type adapters.
 * Usage: API layer imports this module to discover available race types.
 *        Call registerDefaultAdapters() once at application startup to activate built-in adapters.
 * Dependencies: Race engine adapter contract, duck adapter.
 * Edge cases: Registry must remain additive for plugin-like growth.
 */

import type { RaceAdapter } from '../../race-engine/src/index';
import type { RaceTypeKey } from '../../shared-types/src/index';

// Import built-in adapters; duckAdapter is also used locally in registerDefaultAdapters()
import { DuckAdapter, duckAdapter } from './duck/duck-adapter';

export { DuckAdapter, duckAdapter };

const raceTypeRegistry = new Map<RaceTypeKey, RaceAdapter>();

export function registerRaceAdapter(adapter: RaceAdapter): void {
  if (raceTypeRegistry.has(adapter.raceType)) {
    throw new Error(`Race adapter '${adapter.raceType}' is already registered`);
  }

  raceTypeRegistry.set(adapter.raceType, adapter);
}

export function getRaceAdapter(raceType: RaceTypeKey): RaceAdapter {
  const adapter = raceTypeRegistry.get(raceType);

  if (!adapter) {
    throw new Error(`Race adapter '${raceType}' is not registered`);
  }

  return adapter;
}

export function listRaceAdapters(): RaceAdapter[] {
  return Array.from(raceTypeRegistry.values());
}

export function clearRaceTypeRegistry(): void {
  raceTypeRegistry.clear();
}

/**
 * Registers all built-in race adapters.
 * Call once at application startup before creating any race sessions.
 * Safe to call again after clearRaceTypeRegistry().
 */
export function registerDefaultAdapters(): void {
  registerRaceAdapter(duckAdapter);
}
