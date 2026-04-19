/**
 * File: tests/runtime-track.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies runtime-track helpers that map bootstrap geometry into viewport playback coordinates.
 * Usage: Runs in Vitest as part of runtime viewer regression coverage.
 * Dependencies: runtime-track helper module.
 */

import { describe, expect, it } from 'vitest';

import {
  FALLBACK_RUNTIME_TRACK_POINTS,
  mapRuntimeTrackPointsToViewport,
  sampleRuntimeTrackPosition
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

    expect(mapped).toEqual(FALLBACK_RUNTIME_TRACK_POINTS);
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
});
