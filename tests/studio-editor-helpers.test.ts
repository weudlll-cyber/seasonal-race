/**
 * File: tests/studio-editor-helpers.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies studio editor helper behavior for clamping and nearest-point hit testing.
 * Usage: Runs in Vitest as part of the regular test suite.
 * Dependencies: studio-editor-helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  clampToView,
  findNearestPointIndex,
  round3
} from '../apps/web-viewer/src/studio-editor-helpers';

describe('studio editor helpers', () => {
  it('rounds values to three decimals', () => {
    expect(round3(12.34567)).toBe(12.346);
    expect(round3(12.34494)).toBe(12.345);
  });

  it('clamps points to view bounds', () => {
    expect(clampToView(-10, 900, 1160, 720)).toEqual({ x: 0, y: 720 });
    expect(clampToView(240.23456, 610.9999, 1160, 720)).toEqual({ x: 240.235, y: 611 });
  });

  it('finds nearest control point within radius', () => {
    const points = [
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      { x: 200, y: 200 }
    ];

    expect(findNearestPointIndex(points, 102, 101, 8)).toBe(1);
    expect(findNearestPointIndex(points, 170, 170, 8)).toBe(-1);
  });
});
