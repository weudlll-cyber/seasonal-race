/**
 * File: apps/web-viewer/src/track-orientation.ts
 * Model: GPT-5.3-Codex
 * Purpose: Normalizes race orientation inputs and rotates track points for alternate runtime direction.
 * Usage: Used by runtime bootstrap/query handling and track-mapping helpers.
 * Dependencies: Shared TrackPoint contract only.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';

export type TrackOrientation = 'left-to-right' | 'top-to-bottom';

export function normalizeTrackOrientation(value: unknown): TrackOrientation {
  if (typeof value !== 'string') {
    return 'left-to-right';
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'top-to-bottom' ||
    normalized === 'top-bottom' ||
    normalized === 'vertical' ||
    normalized === 'tb'
  ) {
    return 'top-to-bottom';
  }

  return 'left-to-right';
}

export function resolveTrackOrientationFromSearch(search: string): TrackOrientation {
  const params = new URLSearchParams(search);
  return normalizeTrackOrientation(params.get('orientation'));
}

export function rotateTrackPointsForOrientation(
  points: TrackPoint[],
  orientation: TrackOrientation
): TrackPoint[] {
  if (orientation === 'left-to-right' || points.length === 0) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;

  return points.map((point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;

    return {
      x: centerX - dy,
      y: centerY + dx
    };
  });
}
