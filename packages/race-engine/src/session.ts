/**
 * File: packages/race-engine/src/session.ts
 * Purpose: Implements a deterministic-capable race session orchestration layer.
 * Usage: Create sessions through createRaceSession and advance ticks through advanceTick.
 * Dependencies: Shared contracts, RNG utilities, Web Crypto API (globalThis.crypto).
 * Edge cases: Adapter initialization must happen exactly once per session.
 */
import type {
  Participant,
  RaceCameraSettings,
  RaceResult,
  RaceTypeKey,
  TrackDefinition
} from '../../shared-types/src/index';
import { createDeterministicRng, createSecureRng, type EngineRng } from './random';

export interface RaceEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface RaceStateSnapshot {
  tick: number;
  elapsedMs: number;
  seed: string;
}

export interface RaceInitializationContext {
  raceId: string;
  raceType: RaceTypeKey;
  participants: Participant[];
  track: TrackDefinition;
  seed: string;
  rng: EngineRng;
}

export interface RaceTickResult {
  finished: boolean;
  events: RaceEvent[];
}

export interface RaceAdapter {
  readonly raceType: RaceTypeKey;
  initialize(context: RaceInitializationContext): void;
  tick(deltaMs: number): RaceTickResult;
  getState(): RaceStateSnapshot;
  finalize(): RaceResult;
}

export interface RaceSessionConfig {
  raceId: string;
  raceType: RaceTypeKey;
  participants: Participant[];
  track: TrackDefinition;
  seed?: string;
  cameraSettings?: RaceCameraSettings;
}

export interface RaceSession {
  readonly config: RaceSessionConfig;
  readonly seed: string;
  readonly rng: EngineRng;
  getCurrentTick(): number;
  getElapsedMs(): number;
  advanceTick(deltaMs: number): RaceTickResult;
  getState(): RaceStateSnapshot;
  finalize(): RaceResult;
}

function createSeed(): string {
  // Use Web Crypto API — works in browser and Node 22+ without any import
  const buf = new Uint8Array(8);
  globalThis.crypto.getRandomValues(buf);
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `seed-${Date.now().toString(36)}-${hex}`;
}

export function createRaceSession(adapter: RaceAdapter, config: RaceSessionConfig): RaceSession {
  const seed = config.seed ?? createSeed();
  const rng = config.seed ? createDeterministicRng(seed) : createSecureRng();
  let currentTick = 0;
  let elapsedMs = 0;

  adapter.initialize({
    raceId: config.raceId,
    raceType: config.raceType,
    participants: config.participants,
    track: config.track,
    seed,
    rng
  });

  return {
    config,
    seed,
    rng,
    getCurrentTick(): number {
      return currentTick;
    },
    getElapsedMs(): number {
      return elapsedMs;
    },
    advanceTick(deltaMs: number): RaceTickResult {
      if (deltaMs <= 0) {
        throw new Error('deltaMs must be greater than zero');
      }

      currentTick += 1;
      elapsedMs += deltaMs;

      return adapter.tick(deltaMs);
    },
    getState(): RaceStateSnapshot {
      return adapter.getState();
    },
    finalize(): RaceResult {
      return adapter.finalize();
    }
  };
}
