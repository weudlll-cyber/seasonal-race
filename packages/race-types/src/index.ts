/**
 * File: packages/race-types/src/index.ts
 * Purpose: Central registration entry for race-type adapters.
 * Usage: API layer imports this module to discover available race types.
 * Dependencies: Race engine adapter contract.
 * Edge cases: Registry must remain additive for plugin-like growth.
 */

import type { RaceAdapter } from '../../race-engine/src/index';
import type { RaceTypeKey } from '../../shared-types/src/index';

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
