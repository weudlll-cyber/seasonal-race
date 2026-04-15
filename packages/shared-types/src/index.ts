/**
 * File: packages/shared-types/src/index.ts
 * Purpose: Holds shared contracts consumed by apps and domain packages.
 * Usage: Import DTOs and identifiers from this package instead of duplicating shapes.
 * Dependencies: TypeScript only.
 * Edge cases: Keep backward compatibility for versioned API contracts.
 */

/**
 * Open string type so new race types can be registered without touching this file.
 * Use KNOWN_RACE_TYPES for the built-in set; third-party adapters supply their own key.
 */
export type RaceTypeKey = string;

/**
 * Built-in race type identifiers shipped with the platform.
 * External plugins use their own unique string keys (e.g. 'camel', 'snail').
 */
export const KNOWN_RACE_TYPES = {
  DUCK: 'duck',
  HORSE: 'horse',
  ROCKET: 'rocket'
} as const;

export type ResultExportFormat = 'json' | 'csv' | 'webhook';

export type IntegrationEventType =
  | 'race.started'
  | 'race.tick'
  | 'race.finished'
  | 'race.result.exported';

export interface Participant {
  id: string;
  displayName: string;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackDefinition {
  id: string;
  name: string;
  length: number;
  points: TrackPoint[];
  effectProfileId?: string;
}

/**
 * Optional viewer camera settings stored with race configuration.
 * Admin can override defaults per race without touching viewer code.
 */
export interface RaceCameraSettings {
  /** Expected race runtime used for runtime-aware zoom scheduling. */
  expectedDurationMs?: number;
  /** Number of mid-race cinematic zoom pulses (in/out) before final sprint. */
  zoomPulseCount?: number;
  /** Pulse intensity added to the base follow zoom (recommended 0.05..0.35). */
  zoomPulseStrength?: number;
  /** Seconds to hold wide overview at race start. */
  introOverviewHoldSeconds?: number;
  /** Seconds for the slower intro transition from overview to leader follow. */
  introTransitionSeconds?: number;
}

export interface NameList {
  id: string;
  name: string;
  names: string[];
}

export interface RacePlacement {
  participantId: string;
  rank: number;
  finishTimeMs: number;
}

export interface RaceResult {
  raceId: string;
  raceType: RaceTypeKey;
  seed: string;
  durationMs: number;
  placements: RacePlacement[];
}

export interface IntegrationEvent<TPayload = unknown> {
  type: IntegrationEventType;
  occurredAt: string;
  payload: TPayload;
}

export interface NameListProvider {
  readonly providerId: string;
  importNames(input: string): Promise<NameList>;
}

export interface ResultExporter {
  readonly format: ResultExportFormat;
  exportResult(result: RaceResult): Promise<string>;
}

export interface IntegrationConnector {
  readonly connectorId: string;
  publish(event: IntegrationEvent): Promise<void>;
}

// ─── Race Type Manifest ─────────────────────────────────────────────────────
// Ties a race type key to all its viewer-side assets and default settings.
// The engine never reads this — it is purely a viewer/admin contract.

/**
 * Spritesheet animation set names expected per racer.
 * The viewer picks the right set based on race state.
 */
export interface RacerAnimationSet {
  /** Frames to loop while racer is waiting for race start. */
  idle: string;
  /** Frames to loop while racer is actively racing. */
  racing: string;
  /** Frames to play once when a racer crosses the finish line. */
  celebrating: string;
}

/**
 * Complete asset + configuration manifest for one race type.
 * Register one per race type via RaceTypeManifestProvider.
 * Adding a new race type = create a new manifest + adapter; no core file changes needed.
 */
export interface RaceTypeManifest {
  /** Must match the RaceTypeKey used by the corresponding RaceAdapter. */
  raceTypeKey: RaceTypeKey;
  /** Human-readable name shown in admin UI and overlays. */
  displayName: string;
  /** Path to the 1920×1080 background scene image, relative to asset root. */
  backgroundPath: string;
  /**
   * Tileable environment surface texture (water, dirt, grass...).
   * Displayed as a TilingSprite above the background.
   */
  environmentTilePath: string;
  /**
   * Racer spritesheet image path and atlas JSON path relative to asset root.
   * One base spritesheet for all racers; runtime tinting provides color variants.
   */
  racerSpritesheetPath: string;
  racerAtlasPath: string;
  /** Animation set names matching frames in the spritesheet atlas. */
  racerAnimations: RacerAnimationSet;
  /** Finish banner/flag sprite path. */
  finishLinePath: string;
  /**
   * ID of the default EffectProfile to use when a track does not specify one.
   * Must match an EffectProfile registered with EffectProfileProvider.
   */
  defaultEffectProfileId: string;
}

/**
 * Provider that resolves a RaceTypeManifest by race type key.
 * Implement as a static registry (bundled) or an API call.
 */
export interface RaceTypeManifestProvider {
  readonly providerId: string;
  getManifest(raceTypeKey: RaceTypeKey): Promise<RaceTypeManifest>;
  listManifests(): Promise<RaceTypeManifest[]>;
}

// ─── Visual Effect Contracts ────────────────────────────────────────────────
// These types are consumed exclusively by the viewer layer.
// The engine and race adapters are fully unaware of visual effects.

/**
 * Configuration for a single particle emitter powered by @pixi/particle-emitter.
 * Store emitterConfig as the raw JSON from the emitter editor at:
 * https://pixijs.io/particle-emitter/docs/
 */
export interface ParticleEffectConfig {
  /** Unique identifier, e.g. 'duck-wake', 'horse-dust-ambient'. */
  id: string;
  /** Texture paths relative to the asset root (at least one required). */
  texturePaths: string[];
  /** Raw @pixi/particle-emitter configuration object. */
  emitterConfig: Record<string, unknown>;
}

/**
 * A static visual obstacle or decoration placed at a fixed normalized position
 * along the track path.  Examples: hurdle for horse, buoy marker for duck.
 */
export interface TrackObstacle {
  /** Normalized position along the track path [0, 1]. */
  progress: number;
  /** Sprite path relative to the asset root. */
  spritePath: string;
  /** Optional display label shown near the obstacle (e.g. hurdle number). */
  label?: string;
}

/**
 * Full visual effect profile for a race-type / track combination.
 *
 * PixiJS technique map:
 *  - displacementMapPath   → DisplacementFilter: scrolling distorts env layer
 *                            (water wobble, heat shimmer — no extra art needed beyond
 *                             a single grayscale 256×256 displacement map PNG)
 *  - environmentScrollSpeed → TilingSprite offset advanced each frame for moving water
 *  - ambientEffects        → always-on @pixi/particle-emitter instances
 *                            (bubbles rising, foam, floating dust in air)
 *  - racerTrailEffect      → one emitter per racer, spawned at their track position
 *                            (wake trail behind duck, sand cloud behind horse)
 *  - burstEffects          → short one-shot emitters triggered by engine event type
 *                            (splash on duck acceleration, hoofstrike on horse kick)
 *  - obstacles             → static sprites positioned via interpolatePosition()
 *                            (hurdles for horse, buoy markers for duck)
 */
export interface EffectProfile {
  id: string;
  /**
   * Grayscale displacement map texture path.
   * Scroll its x/y offset each frame via DisplacementFilter to animate distortion.
   */
  displacementMapPath?: string;
  /**
   * Horizontal scroll speed for the environment / water surface TilingSprite.
   * Unit: normalized track units per second. Negative = right-to-left.
   */
  environmentScrollSpeed?: number;
  /** Always-on ambient particle emitters running from race start to finish. */
  ambientEffects: ParticleEffectConfig[];
  /**
   * Per-racer trail/wake emitter.
   * One instance is created per racer; its spawn position follows the racer each tick.
   */
  racerTrailEffect?: ParticleEffectConfig;
  /**
   * Event-triggered short burst emitters.
   * Key = engine event type (e.g. 'duck.tick', 'horse.hoofstrike').
   * Burst fires once at the racer position when the event is received.
   */
  burstEffects: Record<string, ParticleEffectConfig>;
  /** Static obstacles / decorations along the track. */
  obstacles: TrackObstacle[];
}

/**
 * Provider that resolves an EffectProfile by ID.
 * Implement and register per deployment (file-based, API-based, or bundled).
 */
export interface EffectProfileProvider {
  readonly providerId: string;
  getEffectProfile(id: string): Promise<EffectProfile>;
}
