/**
 * File: apps/web-viewer/src/camera.ts
 * Purpose: CameraController — moves and scales the world container each frame
 *          to follow the leading racer, zoom to pack density, and dramatize the finish.
 * Usage: Create one instance, call update(dt, state) every animation frame.
 *        Attach worldContainer as a child of the PixiJS stage.
 * Dependencies: pixi.js Container and Point.
 * Edge cases:
 *   - All transitions use lerp (linear interpolation) so no instant jumps.
 *   - The controller never reads from the DOM — viewport size is passed in on construction.
 *   - If leadProgress is 0 (no tick yet), camera stays at start position.
 */

import type { Container } from 'pixi.js';
import type { TrackPoint } from '@sr/shared-types';

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

/** How many seconds the overview zoom is held at race start. */
const OVERVIEW_HOLD_SECONDS = 2.0;

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
    const alpha = Math.min(1, LERP_SPEED * dt);

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

    // Overview hold at race start
    if (state.elapsedSeconds < OVERVIEW_HOLD_SECONDS) {
      return this.overviewTarget();
    }

    // Winner just finished — zoom back out to overview
    if (state.finished) {
      return this.overviewTarget();
    }

    const sorted = [...state.racers].sort((a, b) => b.progress - a.progress);
    const leader = sorted[0]!;

    // Final sprint — dramatic push-in on the leader
    if (leader.progress >= FINAL_SPRINT_THRESHOLD) {
      return {
        x: leader.position.x,
        y: leader.position.y,
        scaleX: ZOOM_FINAL,
        scaleY: ZOOM_FINAL
      };
    }

    // Check if pack is bunched together
    const last = sorted[sorted.length - 1]!;
    const spread = leader.progress - last.progress;
    const targetZoom = spread < BUNCH_THRESHOLD ? ZOOM_BUNCH : ZOOM_FOLLOW;

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
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}
