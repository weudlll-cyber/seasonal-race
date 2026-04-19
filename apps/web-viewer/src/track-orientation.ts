/**
 * File: apps/web-viewer/src/track-orientation.ts
 * Model: GPT-5.3-Codex
 * Purpose: Normalizes race orientation inputs and rotates track points for alternate runtime direction.
 * Usage: Used by runtime bootstrap/query handling and track-mapping helpers.
 * Dependencies: Shared TrackPoint contract only.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';

export type TrackOrientation = 'left-to-right' | 'top-to-bottom';

export interface TrackOrientationCenter {
  x: number;
  y: number;
}

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
  orientation: TrackOrientation,
  center?: TrackOrientationCenter
): TrackPoint[] {
  if (orientation === 'left-to-right' || points.length === 0) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const resolvedCenter = center ?? computeTrackOrientationCenter(points);
  const centerX = resolvedCenter.x;
  const centerY = resolvedCenter.y;

  return points.map((point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;

    return {
      x: centerX - dy,
      y: centerY + dx
    };
  });
}

export function rotateTrackPointsBetweenOrientations(
  points: TrackPoint[],
  from: TrackOrientation,
  to: TrackOrientation,
  center?: TrackOrientationCenter
): TrackPoint[] {
  if (from === to || points.length === 0) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const resolvedCenter = center ?? computeTrackOrientationCenter(points);

  if (from === 'left-to-right' && to === 'top-to-bottom') {
    return rotateTrackPointsForOrientation(points, 'top-to-bottom', resolvedCenter);
  }

  // Inverse of +90deg is -90deg. Apply 3x +90deg to avoid duplicate inverse math.
  let rotated = points.map((point) => ({ x: point.x, y: point.y }));
  for (let i = 0; i < 3; i += 1) {
    rotated = rotateTrackPointsForOrientation(rotated, 'top-to-bottom', resolvedCenter);
  }
  return rotated;
}

export function computeTrackOrientationCenter(points: TrackPoint[]): TrackOrientationCenter {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5
  };
}
