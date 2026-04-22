/**
 * File: tests/runtime-track.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies runtime-track helpers that map bootstrap geometry into viewport playback coordinates.
 * Usage: Runs in Vitest as part of runtime viewer regression coverage.
 * Dependencies: runtime-track helper module.
 */

import { describe, expect, it } from 'vitest';

import {
  estimateRuntimeTrackCurvature,
  FALLBACK_RUNTIME_TRACK_POINTS,
  mapRuntimeTrackPointsToViewport,
  sampleRuntimeTrackPosition,
  sampleRuntimeTrackTangent
} from '../apps/web-viewer/src/runtime-track';

describe('runtime track helpers', () => {
  it('maps bootstrap points into viewport bounds with padding', () => {
    const points = [
      { x: 1000, y: 1000 },
      { x: 2000, y: 1000 },
      { x: 2000, y: 2000 }
    ];

    const mapped = mapRuntimeTrackPointsToViewport(points, 1160, 720, 80);

    expect(mapped).toHaveLength(3);
    for (const point of mapped) {
      expect(point.x).toBeGreaterThanOrEqual(80);
      expect(point.x).toBeLessThanOrEqual(1080);
      expect(point.y).toBeGreaterThanOrEqual(80);
      expect(point.y).toBeLessThanOrEqual(640);
    }
  });

  it('falls back to default path for insufficient points', () => {
    const mapped = mapRuntimeTrackPointsToViewport([{ x: 50, y: 50 }], 1160, 720);

    expect(mapped).toHaveLength(FALLBACK_RUNTIME_TRACK_POINTS.length);

    const xs = mapped.map((point) => point.x);
    const ys = mapped.map((point) => point.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(72);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1088);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(72);
    expect(Math.max(...ys)).toBeLessThanOrEqual(648);
  });

  it('samples endpoints correctly across normalized progress', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ];

    expect(sampleRuntimeTrackPosition(points, 0)).toEqual({ x: 0, y: 0 });
    expect(sampleRuntimeTrackPosition(points, 1)).toEqual({ x: 200, y: 0 });
  });

  it('maps track in top-to-bottom orientation when requested', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ];

    const mapped = mapRuntimeTrackPointsToViewport(points, 1160, 720, 80, 'top-to-bottom');

    const xs = mapped.map((point) => point.x);
    const ys = mapped.map((point) => point.y);

    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);

    expect(spanY).toBeGreaterThan(spanX);
  });

  it('samples a normalized tangent vector', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ];

    const tangent = sampleRuntimeTrackTangent(points, 0.5);
    expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1, 5);
    expect(tangent.x).toBeGreaterThan(0.9);
    expect(Math.abs(tangent.y)).toBeLessThan(0.1);
  });

  it('estimates stronger curvature on turns than on straight lines', () => {
    const straight = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 0 }
    ];
    const curved = [
      { x: 0, y: 0 },
      { x: 80, y: 40 },
      { x: 120, y: 140 },
      { x: 170, y: 240 }
    ];

    const probeProgress = [0.12, 0.24, 0.36, 0.48, 0.62, 0.76, 0.88];
    const straightCurvature = Math.max(
      ...probeProgress.map((progress) => estimateRuntimeTrackCurvature(straight, progress, 0.08))
    );
    const curvedCurvature = Math.max(
      ...probeProgress.map((progress) => estimateRuntimeTrackCurvature(curved, progress, 0.08))
    );

    expect(straightCurvature).toBeGreaterThanOrEqual(0);
    expect(straightCurvature).toBeLessThan(0.05);
    expect(curvedCurvature).toBeGreaterThan(straightCurvature + 0.02);
  });
});
