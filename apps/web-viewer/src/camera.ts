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

/** Track progress at which the dramatic final-sprint zoom kicks in. */
const FINAL_SPRINT_THRESHOLD = 0.88;

/** Camera lerp speed — higher = snappier, lower = smoother. */
const LERP_SPEED = 3.5;

/** Slower camera lerp during intro transition from overview to leader follow. */
const INTRO_LERP_SPEED = 1.6;

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
const ZOOM_MAX = 2.9;

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

    // Intro transition: still follow leader position, but blend zoom from overview slowly.
    const introEnd = settings.introOverviewHoldSeconds + settings.introTransitionSeconds;
    if (state.elapsedSeconds < introEnd) {
      const blend = clamp01(
        (state.elapsedSeconds - settings.introOverviewHoldSeconds) / settings.introTransitionSeconds
      );
      return {
        x: leader.position.x,
        y: leader.position.y,
        scaleX: this.applyZoomScale(lerp(ZOOM_OVERVIEW, ZOOM_FOLLOW, blend), settings),
        scaleY: this.applyZoomScale(lerp(ZOOM_OVERVIEW, ZOOM_FOLLOW, blend), settings)
      };
    }

    // Final sprint — dramatic push-in on the leader
    if (leader.progress >= FINAL_SPRINT_THRESHOLD) {
      return {
        x: leader.position.x,
        y: leader.position.y,
        scaleX: this.applyZoomScale(ZOOM_FINAL, settings),
        scaleY: this.applyZoomScale(ZOOM_FINAL, settings)
      };
    }

    // Check if pack is bunched together
    const last = sorted[sorted.length - 1]!;
    const spread = leader.progress - last.progress;
    const baseZoom = spread < BUNCH_THRESHOLD ? ZOOM_BUNCH : ZOOM_FOLLOW;

    // Runtime-aware cinematic pulses: default count is chosen by expected runtime,
    // but can be overridden via admin race config.
    const pulseZoom = this.computePulseZoom(state, settings);
    const targetZoom = this.applyZoomScale(baseZoom + pulseZoom, settings);

    // Follow the leader's position
    return {
      x: leader.position.x,
      y: leader.position.y,
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

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
