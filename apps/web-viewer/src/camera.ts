/**
 * File: apps/web-viewer/src/camera.ts
 * Model: GPT-5.3-Codex
 * Purpose: CameraController — moves and scales the world container each frame
 * Usage: Create one instance, call update(dt, state) every animation frame.
 * Dependencies: pixi.js Container and Point.
 */

import type { Container } from 'pixi.js';
import type { RaceCameraSettings, TrackPoint } from '../../../packages/shared-types/src/index.js';

// ─── Tuning constants ────────────────────────────────────────────────────────

/** Normal follow zoom — shows roughly 40% of the track width. */
const ZOOM_FOLLOW = 1.3;

/** Zoom when racers bunch within BUNCH_THRESHOLD of each other. */
const ZOOM_BUNCH = 1.6;

/** Dramatic zoom for the final sprint (last FINAL_SPRINT_THRESHOLD of track). */
const ZOOM_FINAL = 1.9;

/** Zoom-out overview shown at race start and at finish. */
const ZOOM_OVERVIEW = 0.7;

/** Progress range [0,1] within which racers are considered "bunched". */
const BUNCH_THRESHOLD = 0.08;

/** Camera density behavior starts blending in from this racer count. */
const DENSE_FIELD_RACER_THRESHOLD = 40;

/** Full density blend is reached at this racer count. */
const DENSE_FIELD_RACER_MAX = 100;

/** Track progress at which the dramatic final-sprint zoom kicks in. */
const FINAL_SPRINT_THRESHOLD = 0.88;

/** Camera lerp speed — higher = snappier, lower = smoother. */
const LERP_SPEED = 1.05;

/** Slower camera lerp during intro transition from overview to leader follow. */
const INTRO_LERP_SPEED = 0.52;

/** How many seconds the overview zoom is held at race start. */
const OVERVIEW_HOLD_SECONDS = 2.0;

/** How many seconds the intro transition takes before normal follow begins. */
const INTRO_TRANSITION_SECONDS = 2.6;

/** Default expected race duration if no metadata is provided. */
const DEFAULT_EXPECTED_DURATION_SECONDS = 75;

/** Default intensity for scheduled mid-race cinematic zoom pulses. */
const DEFAULT_PULSE_STRENGTH = 0.16;
const DEFAULT_ZOOM_SCALE_MULTIPLIER = 1;

/** Clamp bounds for safe camera zoom values. */
const ZOOM_MIN = 0.62;
const ZOOM_MAX = 5.2;

export interface CameraRacerState {
  progress: number; // normalized [0,1]
  position: TrackPoint;
}

export interface CameraState {
  racers: CameraRacerState[];
  /** True once all racers have finished. */
  finished: boolean;
  /** Wall-clock seconds since race start. */
  elapsedSeconds: number;
  /** Optional camera hint for keeping a selected racer more readable. */
  focusRacer?: CameraRacerState;
  /** Optional blend weight [0,1] from leader to focus anchor. */
  focusWeight?: number;
  /** Optional admin-overridable camera settings for this race. */
  cameraSettings?: RaceCameraSettings;
}

/** Target values the camera eases toward each frame. */
interface CameraTarget {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export class CameraController {
  private readonly viewW: number;
  private readonly viewH: number;

  /** Current (interpolated) camera values applied to worldContainer. */
  private currentX: number;
  private currentY: number;
  private currentScale: number;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewW = viewportWidth;
    this.viewH = viewportHeight;
    this.currentX = viewportWidth / 2;
    this.currentY = viewportHeight / 2;
    this.currentScale = ZOOM_OVERVIEW;
  }

  /**
   * Called once per animation frame.
   * Reads race state, computes target camera position+scale, lerps toward it,
   * then writes the result onto worldContainer.
   *
   * @param dt        Delta time in seconds since last frame.
   * @param state     Current race state from the race adapter / viewer model.
   * @param world     The PixiJS Container that holds all race layers.
   */
  update(dt: number, state: CameraState, world: Container): void {
    const target = this.computeTarget(state);
    const alpha = Math.min(1, this.resolveLerpSpeed(state) * dt);

    this.currentX = lerp(this.currentX, target.x, alpha);
    this.currentY = lerp(this.currentY, target.y, alpha);
    this.currentScale = lerp(this.currentScale, target.scaleX, alpha);

    world.scale.set(this.currentScale);
    // Offset so the target world point ends up at screen centre
    world.position.set(
      this.viewW / 2 - this.currentX * this.currentScale,
      this.viewH / 2 - this.currentY * this.currentScale
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private computeTarget(state: CameraState): CameraTarget {
    if (state.racers.length === 0) {
      return this.overviewTarget();
    }

    const settings = this.resolveCameraSettings(state.cameraSettings);

    // Overview hold at race start
    if (state.elapsedSeconds < settings.introOverviewHoldSeconds) {
      return this.overviewTarget();
    }

    // Winner just finished — zoom back out to overview
    if (state.finished) {
      return this.overviewTarget();
    }

    const sorted = [...state.racers].sort((a, b) => b.progress - a.progress);
    const leader = sorted[0]!;
    const trailer = sorted[sorted.length - 1]!;
    const spread = Math.max(0, leader.progress - trailer.progress);
    const densityBlend = resolveDenseFieldBlend(state.racers.length);
    const focusWeight = resolveCameraFocusWeight(state.focusWeight);
    const focusRacer = state.focusRacer;
    const focusGap = resolveCameraFocusGap(leader, focusRacer);
    const densePackAnchor = resolveDensePackAnchor(sorted, 4);
    const anchorBlendWeight = densityBlend * (focusRacer ? 0.18 : 0.42);

    // Intro transition: still follow leader position, but blend zoom from overview slowly.
    const introEnd = settings.introOverviewHoldSeconds + settings.introTransitionSeconds;
    if (state.elapsedSeconds < introEnd) {
      const blend = clamp01(
        (state.elapsedSeconds - settings.introOverviewHoldSeconds) / settings.introTransitionSeconds
      );
      const anchor = blendTrackPoints(
        resolveCameraAnchorPoint(leader, focusRacer, focusWeight),
        densePackAnchor,
        anchorBlendWeight
      );
      const introZoom = applyFocusAwareZoom(lerp(ZOOM_OVERVIEW, ZOOM_FOLLOW, blend), focusGap);
      return {
        x: anchor.x,
        y: anchor.y,
        scaleX: this.applyZoomScale(
          applyDensityAwareZoom(introZoom, densityBlend, spread),
          settings
        ),
        scaleY: this.applyZoomScale(
          applyDensityAwareZoom(introZoom, densityBlend, spread),
          settings
        )
      };
    }

    // Final sprint — dramatic push-in on the leader
    if (leader.progress >= FINAL_SPRINT_THRESHOLD) {
      const anchor = blendTrackPoints(
        resolveCameraAnchorPoint(leader, focusRacer, focusWeight),
        densePackAnchor,
        anchorBlendWeight
      );
      const finalZoom = applyFocusAwareZoom(ZOOM_FINAL, focusGap);
      return {
        x: anchor.x,
        y: anchor.y,
        scaleX: this.applyZoomScale(
          applyDensityAwareZoom(finalZoom, densityBlend, spread),
          settings
        ),
        scaleY: this.applyZoomScale(
          applyDensityAwareZoom(finalZoom, densityBlend, spread),
          settings
        )
      };
    }

    // Check if pack is bunched together
    const baseZoom = spread < BUNCH_THRESHOLD ? ZOOM_BUNCH : ZOOM_FOLLOW;

    // Runtime-aware cinematic pulses: default count is chosen by expected runtime,
    // but can be overridden via admin race config.
    const pulseZoom = this.computePulseZoom(state, settings);
    const targetZoom = this.applyZoomScale(
      applyDensityAwareZoom(
        applyFocusAwareZoom(baseZoom + pulseZoom, focusGap),
        densityBlend,
        spread
      ),
      settings
    );
    const anchor = blendTrackPoints(
      resolveCameraAnchorPoint(leader, focusRacer, focusWeight),
      densePackAnchor,
      anchorBlendWeight
    );

    // Follow the leader, but blend toward the focus racer when one is selected.
    return {
      x: anchor.x,
      y: anchor.y,
      scaleX: targetZoom,
      scaleY: targetZoom
    };
  }

  private overviewTarget(): CameraTarget {
    return {
      x: this.viewW / 2 / ZOOM_OVERVIEW,
      y: this.viewH / 2 / ZOOM_OVERVIEW,
      scaleX: ZOOM_OVERVIEW,
      scaleY: ZOOM_OVERVIEW
    };
  }

  private resolveLerpSpeed(state: CameraState): number {
    const settings = this.resolveCameraSettings(state.cameraSettings);
    const introEnd = settings.introOverviewHoldSeconds + settings.introTransitionSeconds;
    return state.elapsedSeconds < introEnd ? INTRO_LERP_SPEED : LERP_SPEED;
  }

  private resolveCameraSettings(settings?: RaceCameraSettings): Required<RaceCameraSettings> {
    const expectedDurationMs =
      settings?.expectedDurationMs ?? DEFAULT_EXPECTED_DURATION_SECONDS * 1000;
    const expectedDurationSeconds = Math.max(10, expectedDurationMs / 1000);
    const defaultPulseCount = defaultZoomPulseCountForExpectedDuration(expectedDurationSeconds);

    return {
      expectedDurationMs,
      zoomPulseCount: settings?.zoomPulseCount ?? defaultPulseCount,
      zoomPulseStrength: settings?.zoomPulseStrength ?? DEFAULT_PULSE_STRENGTH,
      introOverviewHoldSeconds: settings?.introOverviewHoldSeconds ?? OVERVIEW_HOLD_SECONDS,
      introTransitionSeconds: settings?.introTransitionSeconds ?? INTRO_TRANSITION_SECONDS,
      zoomScaleMultiplier: settings?.zoomScaleMultiplier ?? DEFAULT_ZOOM_SCALE_MULTIPLIER
    };
  }

  private applyZoomScale(baseZoom: number, settings: Required<RaceCameraSettings>): number {
    return clamp(baseZoom * settings.zoomScaleMultiplier, ZOOM_MIN, ZOOM_MAX);
  }

  private computePulseZoom(state: CameraState, settings: Required<RaceCameraSettings>): number {
    const pulses = Math.max(0, settings.zoomPulseCount);
    if (pulses === 0) return 0;

    // Pulse window excludes start overview+transition and final sprint section.
    const runtimeSeconds = Math.max(10, settings.expectedDurationMs / 1000);
    const pulseStart = settings.introOverviewHoldSeconds + settings.introTransitionSeconds;
    const pulseEnd = Math.max(pulseStart + 1, runtimeSeconds * 0.86);

    if (state.elapsedSeconds <= pulseStart || state.elapsedSeconds >= pulseEnd) {
      return 0;
    }

    const u = clamp01((state.elapsedSeconds - pulseStart) / (pulseEnd - pulseStart));
    const sine = Math.sin(u * pulses * Math.PI * 2);
    return sine * settings.zoomPulseStrength;
  }
}

/**
 * Default pulse count by expected runtime bucket.
 * Short races get fewer pulses, long races get more camera moments.
 */
export function defaultZoomPulseCountForExpectedDuration(expectedDurationSeconds: number): number {
  if (expectedDurationSeconds <= 30) return 1;
  if (expectedDurationSeconds <= 60) return 2;
  if (expectedDurationSeconds <= 120) return 3;
  return 4;
}

export function resolveCameraAnchorPoint(
  leader: CameraRacerState,
  focusRacer?: CameraRacerState,
  focusWeight = 0.34
): TrackPoint {
  if (!focusRacer) {
    return { x: leader.position.x, y: leader.position.y };
  }

  const weight = resolveCameraFocusWeight(focusWeight);
  return {
    x: lerp(leader.position.x, focusRacer.position.x, weight),
    y: lerp(leader.position.y, focusRacer.position.y, weight)
  };
}

export function resolveCameraFocusGap(
  leader: CameraRacerState,
  focusRacer?: CameraRacerState
): number {
  if (!focusRacer) {
    return 0;
  }
  return clamp01(Math.max(0, leader.progress - focusRacer.progress));
}

export function applyFocusAwareZoom(baseZoom: number, focusGap: number): number {
  const gapPenalty = Math.min(0.22, Math.max(0, focusGap) * 0.42);
  return Math.max(ZOOM_MIN, baseZoom - gapPenalty);
}

function applyDensityAwareZoom(baseZoom: number, densityBlend: number, spread: number): number {
  const bunchFactor = clamp01((BUNCH_THRESHOLD - spread) / BUNCH_THRESHOLD);
  const densePenalty = densityBlend * (0.14 + bunchFactor * 0.08);
  return Math.max(ZOOM_MIN, baseZoom - densePenalty);
}

function resolveDenseFieldBlend(racerCount: number): number {
  return clamp01(
    (racerCount - DENSE_FIELD_RACER_THRESHOLD) /
      (DENSE_FIELD_RACER_MAX - DENSE_FIELD_RACER_THRESHOLD)
  );
}

function resolveDensePackAnchor(racers: CameraRacerState[], maxRacers: number): TrackPoint {
  const count = Math.max(1, Math.min(maxRacers, racers.length));
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < count; index += 1) {
    const racer = racers[index];
    if (!racer) continue;
    sumX += racer.position.x;
    sumY += racer.position.y;
  }
  return {
    x: sumX / count,
    y: sumY / count
  };
}

function blendTrackPoints(a: TrackPoint, b: TrackPoint, weight: number): TrackPoint {
  const t = clamp01(weight);
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t)
  };
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function resolveCameraFocusWeight(focusWeight = 0.34): number {
  return clamp01(focusWeight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
