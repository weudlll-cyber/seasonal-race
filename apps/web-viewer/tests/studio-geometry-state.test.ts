/**
 * File: apps/web-viewer/tests/studio-geometry-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for studio geometry orientation rotation helper.
 * Usage: Runs in Vitest as part of web-viewer tests.
 */

import { describe, expect, it } from 'vitest';
import { rotateStudioGeometry } from '../src/studio-geometry-state.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';

function pointsEqual(a: TrackPoint[], b: TrackPoint[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe('rotateStudioGeometry', () => {
  it('returns input state unchanged for identical orientations', () => {
    const points: TrackPoint[] = [
      { x: 100, y: 200 },
      { x: 300, y: 220 },
      { x: 500, y: 210 }
    ];
    const leftBoundaryPoints: TrackPoint[] = [
      { x: 100, y: 180 },
      { x: 300, y: 200 },
      { x: 500, y: 190 }
    ];
    const rightBoundaryPoints: TrackPoint[] = [
      { x: 100, y: 220 },
      { x: 300, y: 240 },
      { x: 500, y: 230 }
    ];

    const rotated = rotateStudioGeometry(
      { points, leftBoundaryPoints, rightBoundaryPoints },
      'left-to-right',
      'left-to-right'
    );

    expect(rotated.points).toBe(points);
    expect(rotated.leftBoundaryPoints).toBe(leftBoundaryPoints);
    expect(rotated.rightBoundaryPoints).toBe(rightBoundaryPoints);
  });

  it('rotates points and full boundary sets when switching orientation', () => {
    const points: TrackPoint[] = [
      { x: 100, y: 300 },
      { x: 300, y: 300 },
      { x: 500, y: 300 }
    ];
    const leftBoundaryPoints: TrackPoint[] = [
      { x: 100, y: 280 },
      { x: 300, y: 280 },
      { x: 500, y: 280 }
    ];
    const rightBoundaryPoints: TrackPoint[] = [
      { x: 100, y: 320 },
      { x: 300, y: 320 },
      { x: 500, y: 320 }
    ];

    const rotated = rotateStudioGeometry(
      { points, leftBoundaryPoints, rightBoundaryPoints },
      'left-to-right',
      'top-to-bottom'
    );

    expect(pointsEqual(rotated.points, points)).toBe(false);
    expect(pointsEqual(rotated.leftBoundaryPoints, leftBoundaryPoints)).toBe(false);
    expect(pointsEqual(rotated.rightBoundaryPoints, rightBoundaryPoints)).toBe(false);
    expect(rotated.points).toHaveLength(3);
    expect(rotated.leftBoundaryPoints).toHaveLength(3);
    expect(rotated.rightBoundaryPoints).toHaveLength(3);
  });

  it('keeps short boundary arrays unrotated', () => {
    const points: TrackPoint[] = [
      { x: 100, y: 300 },
      { x: 300, y: 300 },
      { x: 500, y: 300 }
    ];
    const leftBoundaryPoints: TrackPoint[] = [
      { x: 100, y: 280 },
      { x: 300, y: 280 }
    ];
    const rightBoundaryPoints: TrackPoint[] = [
      { x: 100, y: 320 },
      { x: 300, y: 320 }
    ];

    const rotated = rotateStudioGeometry(
      { points, leftBoundaryPoints, rightBoundaryPoints },
      'left-to-right',
      'top-to-bottom'
    );

    expect(pointsEqual(rotated.points, points)).toBe(false);
    expect(rotated.leftBoundaryPoints).toBe(leftBoundaryPoints);
    expect(rotated.rightBoundaryPoints).toBe(rightBoundaryPoints);
  });
});
