/**
 * File: tests/studio-track-edit-helpers.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted studio track-edit helper functions.
 * Usage: Runs with Vitest as part of studio refactor parity checks.
 */

import { describe, expect, it } from 'vitest';

import {
  applyEditablePointsUpdate,
  ensureBoundaryPointsFromCenterline,
  getEditablePoints,
  resolveCenterlinePoints
} from '../apps/web-viewer/src/studio-track-edit-helpers';

describe('studio track edit helpers', () => {
  it('resolves centerline from boundary mode when both boundaries exist', () => {
    const left = [
      { x: 0, y: 2 },
      { x: 10, y: 2 },
      { x: 20, y: 2 }
    ];
    const right = [
      { x: 0, y: -2 },
      { x: 10, y: -2 },
      { x: 20, y: -2 }
    ];

    const centerline = resolveCenterlinePoints('boundaries', [{ x: 1, y: 1 }], left, right);
    expect(centerline[0]).toEqual({ x: 0, y: 0 });
    expect(centerline[centerline.length - 1]?.x).toBe(20);
  });

  it('generates missing boundary points from centerline fallback', () => {
    const ensured = ensureBoundaryPointsFromCenterline({
      leftBoundaryPoints: [],
      rightBoundaryPoints: [],
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ],
      fallbackPoints: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 }
      ],
      halfWidthPx: 4
    });

    expect(ensured.leftBoundaryPoints.length).toBe(3);
    expect(ensured.rightBoundaryPoints.length).toBe(3);
  });

  it('returns active editable side and applies point updates with centerline refresh', () => {
    const left = [
      { x: 0, y: 2 },
      { x: 10, y: 2 },
      { x: 20, y: 2 }
    ];
    const right = [
      { x: 0, y: -2 },
      { x: 10, y: -2 },
      { x: 20, y: -2 }
    ];
    const editable = getEditablePoints('boundaries', 'left', [{ x: 0, y: 0 }], left, right);
    expect(editable).toEqual(left);

    const updated = applyEditablePointsUpdate({
      trackEditMode: 'boundaries',
      boundaryEditSide: 'right',
      nextPoints: [
        { x: 0, y: -3 },
        { x: 10, y: -3 },
        { x: 20, y: -3 }
      ],
      points: [{ x: 0, y: 0 }],
      leftBoundaryPoints: left,
      rightBoundaryPoints: right
    });

    expect(updated.rightBoundaryPoints[0]?.y).toBe(-3);
    expect(updated.points[0]).toEqual({ x: 0, y: -0.5 });
  });
});
