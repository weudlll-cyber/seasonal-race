/**
 * File: tests/runtime-layout.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for runtime local pack layout resolution.
 * Usage: Ensures anti-overlap stays lateral-first and stable for isolated racers.
 */

import { describe, expect, it } from 'vitest';

import {
  resolveRuntimeLocalPackLayout,
  resolveRuntimeRenderMinimumSeparation,
  resolveRuntimeStableTrackLocalPose
} from '../apps/web-viewer/src/runtime-layout';

describe('runtime local pack layout', () => {
  it('pushes close trailing racers laterally away from leaders', () => {
    const resolved = resolveRuntimeLocalPackLayout(
      [
        {
          id: 'lead',
          index: 0,
          progress: 0.55,
          centerX: 100,
          centerY: 200,
          tangentX: 1,
          tangentY: 0,
          normalX: 0,
          normalY: 1,
          alongDistance: 0,
          lateralDistance: 0,
          lateralLimit: 40,
          preferredLateralSign: -1
        },
        {
          id: 'trail',
          index: 1,
          progress: 0.538,
          centerX: 94,
          centerY: 200,
          tangentX: 1,
          tangentY: 0,
          normalX: 0,
          normalY: 1,
          alongDistance: 0,
          lateralDistance: 0,
          lateralLimit: 40,
          preferredLateralSign: 1
        }
      ],
      0.9
    );

    const lead = resolved.find((entry) => entry.id === 'lead');
    const trail = resolved.find((entry) => entry.id === 'trail');
    expect(lead).toBeDefined();
    expect(trail).toBeDefined();
    expect(Math.abs(trail!.lateralDistance)).toBeGreaterThan(4);
    expect(Math.abs(trail!.lateralDistance)).toBeGreaterThan(Math.abs(trail!.alongDistance));
  });

  it('keeps isolated racers close to their authored lane', () => {
    const resolved = resolveRuntimeLocalPackLayout(
      [
        {
          id: 'solo-a',
          index: 0,
          progress: 0.7,
          centerX: 100,
          centerY: 100,
          tangentX: 1,
          tangentY: 0,
          normalX: 0,
          normalY: 1,
          alongDistance: 2,
          lateralDistance: -12,
          lateralLimit: 40,
          preferredLateralSign: -1
        },
        {
          id: 'solo-b',
          index: 1,
          progress: 0.2,
          centerX: 260,
          centerY: 100,
          tangentX: 1,
          tangentY: 0,
          normalX: 0,
          normalY: 1,
          alongDistance: -1,
          lateralDistance: 11,
          lateralLimit: 40,
          preferredLateralSign: 1
        }
      ],
      0.9
    );

    const soloA = resolved.find((entry) => entry.id === 'solo-a');
    const soloB = resolved.find((entry) => entry.id === 'solo-b');
    expect(soloA!.lateralDistance).toBeCloseTo(-12, 4);
    expect(soloB!.lateralDistance).toBeCloseTo(11, 4);
    expect(soloA!.alongDistance).toBeCloseTo(2, 4);
    expect(soloB!.alongDistance).toBeCloseTo(-1, 4);
  });

  it('suppresses weak lateral side flips near the centerline', () => {
    const resolved = resolveRuntimeStableTrackLocalPose({
      previousAlongDistance: 1,
      previousLateralDistance: 14,
      targetAlongDistance: 1.5,
      targetLateralDistance: -5,
      lateralLimit: 36,
      dtSec: 1 / 60,
      speedNorm: 0.62,
      collisionOffsetPx: 4
    });

    expect(resolved.lateralDistance).toBeGreaterThan(0);
    expect(resolved.lateralDistance).toBeGreaterThan(6);
  });

  it('allows stronger lateral moves when collision pressure is high', () => {
    const resolved = resolveRuntimeStableTrackLocalPose({
      previousAlongDistance: 1,
      previousLateralDistance: 14,
      targetAlongDistance: 0,
      targetLateralDistance: -18,
      lateralLimit: 36,
      dtSec: 1 / 60,
      speedNorm: 0.62,
      collisionOffsetPx: 18
    });

    expect(Math.abs(resolved.lateralDistance)).toBeLessThanOrEqual(36);
    expect(resolved.lateralDistance).toBeLessThan(14);
  });

  it('enforces final render minimum spacing with bounded displacement', () => {
    const separated = resolveRuntimeRenderMinimumSeparation(
      [
        { id: 'a', x: 100, y: 100, anchorX: 100, anchorY: 100, maxDisplacementPx: 5 },
        { id: 'b', x: 103, y: 100, anchorX: 103, anchorY: 100, maxDisplacementPx: 5 },
        { id: 'c', x: 106, y: 100, anchorX: 106, anchorY: 100, maxDisplacementPx: 5 }
      ],
      0.9
    );

    const a = separated.get('a');
    const b = separated.get('b');
    const c = separated.get('c');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();

    const dAB = Math.hypot((a!.x - b!.x), (a!.y - b!.y));
    const dBC = Math.hypot((b!.x - c!.x), (b!.y - c!.y));
    expect(Math.min(dAB, dBC)).toBeGreaterThanOrEqual(8);

    expect(Math.hypot(a!.x - 100, a!.y - 100)).toBeLessThanOrEqual(5.001);
    expect(Math.hypot(b!.x - 103, b!.y - 100)).toBeLessThanOrEqual(5.001);
    expect(Math.hypot(c!.x - 106, c!.y - 100)).toBeLessThanOrEqual(5.001);
  });
});
