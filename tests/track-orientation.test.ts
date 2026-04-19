/**
 * File: tests/track-orientation.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies orientation normalization and point-rotation helpers for runtime race direction variants.
 * Usage: Runs in Vitest as part of viewer helper coverage.
 * Dependencies: track-orientation helper module.
 */

import { describe, expect, it } from 'vitest';

import {
  computeTrackOrientationCenter,
  normalizeTrackOrientation,
  resolveTrackOrientationFromSearch,
  rotateTrackPointsBetweenOrientations,
  rotateTrackPointsForOrientation
} from '../apps/web-viewer/src/track-orientation';

describe('track orientation helpers', () => {
  it('normalizes known orientation values and defaults safely', () => {
    expect(normalizeTrackOrientation('top-to-bottom')).toBe('top-to-bottom');
    expect(normalizeTrackOrientation('vertical')).toBe('top-to-bottom');
    expect(normalizeTrackOrientation('tb')).toBe('top-to-bottom');
    expect(normalizeTrackOrientation('left-to-right')).toBe('left-to-right');
    expect(normalizeTrackOrientation('unknown')).toBe('left-to-right');
    expect(normalizeTrackOrientation(undefined)).toBe('left-to-right');
  });

  it('parses orientation from URL query', () => {
    expect(resolveTrackOrientationFromSearch('?orientation=top-to-bottom')).toBe('top-to-bottom');
    expect(resolveTrackOrientationFromSearch('?orientation=vertical')).toBe('top-to-bottom');
    expect(resolveTrackOrientationFromSearch('?orientation=left-to-right')).toBe('left-to-right');
    expect(resolveTrackOrientationFromSearch('')).toBe('left-to-right');
  });

  it('rotates points 90 degrees around bounds center for vertical mode', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ];

    const rotated = rotateTrackPointsForOrientation(points, 'top-to-bottom');

    expect(rotated[0]?.x).toBeCloseTo(100, 6);
    expect(rotated[2]?.x).toBeCloseTo(100, 6);
    expect(rotated[0]?.y).toBeLessThan(rotated[2]!.y);
  });

  it('can rotate with an explicitly provided center', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 20, y: 10 }
    ];

    const center = computeTrackOrientationCenter([
      { x: 0, y: 0 },
      { x: 40, y: 40 }
    ]);

    const rotated = rotateTrackPointsForOrientation(points, 'top-to-bottom', center);
    expect(rotated[0]?.x).toBeCloseTo(30, 6);
    expect(rotated[0]?.y).toBeCloseTo(10, 6);
  });

  it('rotates between orientations and preserves geometry on round-trip', () => {
    const points = [
      { x: 80, y: 630 },
      { x: 220, y: 500 },
      { x: 360, y: 280 },
      { x: 520, y: 140 }
    ];

    const rotated = rotateTrackPointsBetweenOrientations(points, 'left-to-right', 'top-to-bottom');
    const restored = rotateTrackPointsBetweenOrientations(
      rotated,
      'top-to-bottom',
      'left-to-right'
    );

    for (let i = 0; i < points.length; i += 1) {
      expect(restored[i]?.x).toBeCloseTo(points[i]!.x, 6);
      expect(restored[i]?.y).toBeCloseTo(points[i]!.y, 6);
    }
  });
});
