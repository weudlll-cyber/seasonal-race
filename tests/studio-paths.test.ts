/**
 * File: tests/studio-paths.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for studio path resolution refactor.
 * Usage: Runs with Vitest as part of viewer studio preview checks.
 */

import { describe, expect, it } from 'vitest';

import {
  buildCenterlineFromBoundaries,
  resolveStudioPaths
} from '../apps/web-viewer/src/studio-paths';

describe('studio path resolution', () => {
  it('uses coast endpoint but excludes it from replay race path in centerline mode', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 }
    ];

    const resolved = resolveStudioPaths({
      points,
      leftBoundaryPoints: [],
      rightBoundaryPoints: [],
      trackEditMode: 'centerline',
      smoothingEnabled: false,
      mapPointsForLayout: (input) => input
    });

    expect(resolved.previewPath).toEqual(points);
    expect(resolved.replayRacePath).toEqual(points.slice(0, -1));
    expect(resolved.coastEndPoint).toEqual({ x: 30, y: 0 });
  });

  it('uses boundary coast point for coast endpoint and finish-only race centerline', () => {
    const left = [
      { x: 0, y: 1 },
      { x: 10, y: 1 },
      { x: 20, y: 1 },
      { x: 30, y: 1 }
    ];
    const right = [
      { x: 0, y: -1 },
      { x: 10, y: -1 },
      { x: 20, y: -1 },
      { x: 30, y: -1 }
    ];

    const resolved = resolveStudioPaths({
      points: buildCenterlineFromBoundaries(left, right),
      leftBoundaryPoints: left,
      rightBoundaryPoints: right,
      trackEditMode: 'boundaries',
      smoothingEnabled: false,
      mapPointsForLayout: (input) => input
    });

    expect(resolved.coastEndPoint).toEqual({ x: 30, y: 0 });
    expect(resolved.previewPath[resolved.previewPath.length - 1]?.x).toBe(30);
    expect(resolved.replayRacePath[resolved.replayRacePath.length - 1]?.x).toBe(20);
  });
});
