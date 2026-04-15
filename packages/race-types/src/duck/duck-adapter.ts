/**
 * File: packages/race-types/src/duck/duck-adapter.ts
 * Purpose: Duck-race adapter — simulates rubber ducks racing along a curved water track.
 * Usage: Instantiate DuckAdapter and pass to createRaceSession; call initialize() exactly once.
 *        initialize() fully resets state so an instance can be reused across sequential races.
 * Dependencies: race-engine RaceAdapter contracts, shared-types, track-path interpolation.
 * Edge cases:
 *   - tick() and finalize() throw if called before initialize().
 *   - finalize() assigns finish times to any duck that never crossed the line.
 *   - Deterministic seeds produce the same race outcome for identical participant lists.
 */

import type {
  EngineRng,
  RaceAdapter,
  RaceInitializationContext,
  RaceTickResult
} from '../../../race-engine/src/index';
import { interpolatePosition } from '../../../race-engine/src/track-path';
import type { RaceResult, TrackPoint } from '../../../shared-types/src/index';

/** Slowest possible duck — finishes in ~25 s at a constant tick rate of 100 ms/tick. */
const MIN_SPEED_PER_MS = 0.00004;

/** Fastest possible duck — finishes in ~15 s at a constant tick rate of 100 ms/tick. */
const MAX_SPEED_PER_MS = 0.000067;

/**
 * Random variance amplitude applied to base speed each tick.
 * A value of 0.4 means up to ±20% of baseSpeed variation per tick.
 */
const SPEED_VARIANCE_FACTOR = 0.4;

interface DuckState {
  participantId: string;
  /** Normalized race progress in [0, 1]. 1.0 means the duck has crossed the finish line. */
  progress: number;
  /** Base progression speed in normalized units per millisecond. */
  baseSpeed: number;
  finished: boolean;
  /** Wall-clock ms since race start when this duck finished; null until finished. */
  finishTimeMs: number | null;
  /** Last interpolated 2D position on the track (for rendering). */
  position: TrackPoint;
}

export class DuckAdapter implements RaceAdapter {
  public readonly raceType = 'duck' as const;

  private ctx: RaceInitializationContext | null = null;
  private ducks: DuckState[] = [];
  private elapsedMs = 0;
  private tickCount = 0;

  initialize(context: RaceInitializationContext): void {
    this.ctx = context;
    this.elapsedMs = 0;
    this.tickCount = 0;

    // Default starting position — beginning of the track
    const startPoint: TrackPoint =
      context.track.points.length > 0 && context.track.points[0] !== undefined
        ? context.track.points[0]
        : { x: 0, y: 0 };

    this.ducks = context.participants.map((participant) => ({
      participantId: participant.id,
      progress: 0,
      baseSpeed: this.rollBaseSpeed(context.rng),
      finished: false,
      finishTimeMs: null,
      position: { x: startPoint.x, y: startPoint.y }
    }));
  }

  tick(deltaMs: number): RaceTickResult {
    if (!this.ctx) throw new Error('DuckAdapter.tick() called before initialize()');

    this.elapsedMs += deltaMs;
    this.tickCount += 1;

    const { rng, track } = this.ctx;

    for (const duck of this.ducks) {
      if (duck.finished) continue;

      // Apply per-tick random variance for a natural-looking spread between ducks
      const variance = (rng.next() - 0.5) * SPEED_VARIANCE_FACTOR * duck.baseSpeed;
      const effectiveSpeed = Math.max(0, duck.baseSpeed + variance);

      duck.progress = Math.min(1, duck.progress + effectiveSpeed * deltaMs);
      duck.position = interpolatePosition(track.points, duck.progress);

      if (duck.progress >= 1) {
        duck.finished = true;
        duck.finishTimeMs = this.elapsedMs;
      }
    }

    const allFinished = this.ducks.every((d) => d.finished);

    return {
      finished: allFinished,
      events: [
        {
          type: 'duck.tick',
          payload: {
            elapsedMs: this.elapsedMs,
            positions: this.ducks.map((d) => ({
              participantId: d.participantId,
              progress: d.progress,
              position: d.position,
              finished: d.finished
            }))
          }
        }
      ]
    };
  }

  getState() {
    return {
      tick: this.tickCount,
      elapsedMs: this.elapsedMs,
      seed: this.ctx?.seed ?? 'uninitialized'
    };
  }

  finalize(): RaceResult {
    if (!this.ctx) throw new Error('DuckAdapter.finalize() called before initialize()');

    // Assign finish time to any duck that never formally crossed the line
    for (const duck of this.ducks) {
      if (!duck.finished) {
        duck.finishTimeMs = this.elapsedMs;
        duck.finished = true;
      }
    }

    // Rank by finish time ascending; ties keep insertion order (stable sort in V8)
    const ranked = [...this.ducks].sort((a, b) => (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0));

    return {
      raceId: this.ctx.raceId,
      raceType: this.raceType,
      seed: this.ctx.seed,
      durationMs: this.elapsedMs,
      placements: ranked.map((duck, index) => ({
        participantId: duck.participantId,
        rank: index + 1,
        finishTimeMs: duck.finishTimeMs ?? this.elapsedMs
      }))
    };
  }

  /**
   * Rolls a base speed for one duck using the seeded RNG.
   * Result is uniformly distributed between MIN_SPEED_PER_MS and MAX_SPEED_PER_MS.
   */
  private rollBaseSpeed(rng: EngineRng): number {
    return rng.next() * (MAX_SPEED_PER_MS - MIN_SPEED_PER_MS) + MIN_SPEED_PER_MS;
  }
}

/**
 * Shared DuckAdapter instance for registry use.
 * Production code should register this via registerDefaultAdapters().
 * Tests create fresh DuckAdapter instances directly for isolation.
 */
export const duckAdapter = new DuckAdapter();
