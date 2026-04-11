/**
 * File: packages/race-engine/src/index.ts
 * Purpose: Declares the core race-engine adapter contract.
 * Usage: Race-type modules implement this interface to plug into the engine.
 * Dependencies: Shared types package.
 * Edge cases: Methods must stay deterministic when a seed is provided.
 */

import type { Participant, RaceTypeKey } from '../../shared-types/src/index';

export interface RaceAdapter {
  readonly raceType: RaceTypeKey;
  initialize(participants: Participant[], seed?: string): void;
}
