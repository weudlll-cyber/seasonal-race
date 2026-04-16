/**
 * File: apps/web-viewer/src/studio-editor-helpers.ts
 * Model: GPT-5.3-Codex
 * Purpose: Small reusable editor helper functions for point clamp and hit testing.
 * Usage: Used by studio app event handlers and tested independently.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function clampToView(
  x: number,
  y: number,
  viewWidth: number,
  viewHeight: number
): TrackPoint {
  return {
    x: round3(Math.max(0, Math.min(viewWidth, x))),
    y: round3(Math.max(0, Math.min(viewHeight, y)))
  };
}

export function findNearestPointIndex(
  points: TrackPoint[],
  x: number,
  y: number,
  radius: number
): number {
  let nearest = -1;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      nearest = i;
    }
  }

  return nearest;
}
