/**
 * File: packages/race-engine/src/index.ts
 * Purpose: Public exports for race-engine contracts and session orchestration.
 * Usage: Import engine interfaces and helpers from this module in other packages.
 * Dependencies: Session and RNG modules.
 * Edge cases: Keep exports backward compatible for extension packages.
 */

export {
  createRaceSession,
  type RaceAdapter,
  type RaceEvent,
  type RaceInitializationContext,
  type RaceSession,
  type RaceSessionConfig,
  type RaceStateSnapshot,
  type RaceTickResult
} from './session';
export { createDeterministicRng, createSecureRng, type EngineRng } from './random';
export { interpolatePosition, polylineLength } from './track-path';
