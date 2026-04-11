/**
 * File: packages/race-types/src/index.ts
 * Purpose: Central registration entry for race-type adapters.
 * Usage: API layer imports this module to discover available race types.
 * Dependencies: Race engine adapter contract.
 * Edge cases: Registry must remain additive for plugin-like growth.
 */

import type { RaceAdapter } from '../../race-engine/src/index';

export const raceTypeRegistry: RaceAdapter[] = [];
