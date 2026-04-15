/**
 * File: tests/phase2-duck-adapter.test.ts
 * Purpose: Validates duck-race adapter behavior and track-path interpolation utilities.
 * Usage: Run as part of the full test suite — covers determinism, position math, and lifecycle guards.
 * Dependencies: Vitest, race-engine, race-types, shared-types.
 * Edge cases:
 *   - Verifies that identical seeds produce identical race outcomes.
 *   - Verifies that interpolation edge cases (t=0, t=1, empty array) are handled safely.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createRaceSession,
  interpolatePosition,
  polylineLength
} from '../packages/race-engine/src/index';
import {
  DuckAdapter,
  clearRaceTypeRegistry,
  listRaceAdapters,
  registerDefaultAdapters
} from '../packages/race-types/src/index';
import type {
  Participant,
  RaceResult,
  TrackDefinition,
  TrackPoint
} from '../packages/shared-types/src/index';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const participants: Participant[] = [
  { id: 'p1', displayName: 'Quacky' },
  { id: 'p2', displayName: 'Splasher' },
  { id: 'p3', displayName: 'Waddler' }
];

/**
 * L-shaped track: two equal-length segments of 100 units each → total polyline length = 200.
 * Easy to verify: t=0.5 lands exactly at the corner {x:100, y:0}.
 */
const lTrack: TrackDefinition = {
  id: 'l-track',
  name: 'L Track',
  length: 200,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 }
  ]
};

/**
 * Longer curved track used for full race simulations.
 * Abstract length = 1200 matches the engine test fixture.
 */
const curvedTrack: TrackDefinition = {
  id: 'curved-1',
  name: 'Curved Canal',
  length: 1200,
  points: [
    { x: 0, y: 0 },
    { x: 400, y: 80 },
    { x: 800, y: -50 },
    { x: 1200, y: 20 }
  ]
};

// ─── polylineLength ─────────────────────────────────────────────────────────

describe('polylineLength', () => {
  it('returns 0 for an empty array', () => {
    expect(polylineLength([])).toBe(0);
  });

  it('returns 0 for a single-point array', () => {
    expect(polylineLength([{ x: 10, y: 20 }])).toBe(0);
  });

  it('computes correct length for a straight horizontal segment', () => {
    const points: TrackPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 }
    ];
    expect(polylineLength(points)).toBeCloseTo(50);
  });

  it('sums multiple segments correctly for the L-track', () => {
    // segment 1: 100, segment 2: 100 → total 200
    expect(polylineLength(lTrack.points)).toBeCloseTo(200);
  });
});

// ─── interpolatePosition ────────────────────────────────────────────────────

describe('interpolatePosition', () => {
  it('returns origin for an empty points array', () => {
    expect(interpolatePosition([], 0.5)).toEqual({ x: 0, y: 0 });
  });

  it('returns the only point for a single-element array regardless of t', () => {
    const p: TrackPoint = { x: 42, y: 7 };
    expect(interpolatePosition([p], 0)).toEqual({ x: 42, y: 7 });
    expect(interpolatePosition([p], 1)).toEqual({ x: 42, y: 7 });
  });

  it('returns first point at t=0', () => {
    const result = interpolatePosition(lTrack.points, 0);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('returns last point at t=1', () => {
    const result = interpolatePosition(lTrack.points, 1);
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it('clamps t below 0 to the first point', () => {
    expect(interpolatePosition(lTrack.points, -0.5)).toEqual({ x: 0, y: 0 });
  });

  it('clamps t above 1 to the last point', () => {
    expect(interpolatePosition(lTrack.points, 2)).toEqual({ x: 100, y: 100 });
  });

  it('returns the corner point at t=0.5 on the L-track (equal segments)', () => {
    // t=0.5 → targetDist=100 → exactly the corner between segment 1 and 2
    const result = interpolatePosition(lTrack.points, 0.5);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(0);
  });

  it('returns midpoint of first segment at t=0.25', () => {
    // t=0.25 → targetDist=50 → middle of horizontal segment
    const result = interpolatePosition(lTrack.points, 0.25);
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(0);
  });

  it('returns midpoint of second segment at t=0.75', () => {
    // t=0.75 → targetDist=150 → middle of vertical segment
    const result = interpolatePosition(lTrack.points, 0.75);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(50);
  });
});

// ─── DuckAdapter lifecycle guards ───────────────────────────────────────────

describe('DuckAdapter lifecycle guards', () => {
  it('throws if tick() is called before initialize()', () => {
    const adapter = new DuckAdapter();
    expect(() => adapter.tick(100)).toThrow('initialize');
  });

  it('throws if finalize() is called before initialize()', () => {
    const adapter = new DuckAdapter();
    expect(() => adapter.finalize()).toThrow('initialize');
  });
});

// ─── DuckAdapter simulation ──────────────────────────────────────────────────

describe('DuckAdapter simulation', () => {
  it('reports all ducks at progress 0 after initialization', () => {
    const adapter = new DuckAdapter();
    const session = createRaceSession(adapter, {
      raceId: 'test-init',
      raceType: 'duck',
      participants,
      track: curvedTrack,
      seed: 'init-check'
    });

    const state = adapter.getState();
    expect(state.tick).toBe(0);
    expect(state.elapsedMs).toBe(0);
    expect(state.seed).toBe('init-check');
    // Session is freshly created — no ticks yet
    expect(session.getCurrentTick()).toBe(0);
  });

  it('eventually finishes when ticked enough times with a fixed seed', () => {
    const adapter = new DuckAdapter();
    const session = createRaceSession(adapter, {
      raceId: 'test-finish',
      raceType: 'duck',
      participants,
      track: curvedTrack,
      seed: 'finish-seed'
    });

    let result: ReturnType<typeof session.advanceTick> | null = null;
    // 500 ticks × 100 ms = 50 s — well above the maximum duck race duration
    for (let i = 0; i < 500; i += 1) {
      result = session.advanceTick(100);
      if (result.finished) break;
    }

    expect(result?.finished).toBe(true);
  });

  it('produces correctly ranked placements after finalize()', () => {
    const adapter = new DuckAdapter();
    createRaceSession(adapter, {
      raceId: 'test-rank',
      raceType: 'duck',
      participants,
      track: curvedTrack,
      seed: 'rank-seed'
    });

    for (let i = 0; i < 500; i += 1) {
      if (adapter.tick(100).finished) break;
    }

    const result = adapter.finalize();
    expect(result.placements).toHaveLength(participants.length);

    // Ranks must be 1-based, contiguous, and ascending by finishTimeMs
    const ranks = result.placements.map((p) => p.rank);
    expect(ranks).toEqual([1, 2, 3]);

    for (let i = 1; i < result.placements.length; i += 1) {
      const prev = result.placements[i - 1];
      const curr = result.placements[i];
      if (prev !== undefined && curr !== undefined) {
        expect(curr.finishTimeMs).toBeGreaterThanOrEqual(prev.finishTimeMs);
      }
    }
  });

  it('produces identical outcomes for the same seed (determinism)', () => {
    function runRace(seed: string): RaceResult {
      const adapter = new DuckAdapter();
      createRaceSession(adapter, {
        raceId: 'det-race',
        raceType: 'duck',
        participants,
        track: curvedTrack,
        seed
      });
      for (let i = 0; i < 500; i += 1) {
        if (adapter.tick(100).finished) break;
      }
      return adapter.finalize();
    }

    const run1 = runRace('determinism-test');
    const run2 = runRace('determinism-test');

    expect(run1.placements).toEqual(run2.placements);
    expect(run1.durationMs).toBe(run2.durationMs);
  });

  it('produces different outcomes for different seeds', () => {
    function runRaceWinner(seed: string): string {
      const adapter = new DuckAdapter();
      createRaceSession(adapter, {
        raceId: 'seed-diff',
        raceType: 'duck',
        participants: [
          { id: 'pa', displayName: 'Alpha' },
          { id: 'pb', displayName: 'Beta' },
          { id: 'pc', displayName: 'Gamma' },
          { id: 'pd', displayName: 'Delta' },
          { id: 'pe', displayName: 'Epsilon' }
        ],
        track: curvedTrack,
        seed
      });
      for (let i = 0; i < 500; i += 1) {
        if (adapter.tick(100).finished) break;
      }
      const result = adapter.finalize();
      return result.placements[0]?.participantId ?? '';
    }

    // With 5 ducks and 10 different seeds, it is statistically very likely
    // that at least two seeds produce different winners
    const winners = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'].map(runRaceWinner)
    );
    expect(winners.size).toBeGreaterThan(1);
  });
});

// ─── registerDefaultAdapters ────────────────────────────────────────────────

describe('registerDefaultAdapters', () => {
  beforeEach(() => {
    clearRaceTypeRegistry();
  });

  it('registers the duck adapter so it appears in listRaceAdapters()', () => {
    registerDefaultAdapters();
    const adapters = listRaceAdapters();
    expect(adapters.map((a) => a.raceType)).toContain('duck');
  });
});
