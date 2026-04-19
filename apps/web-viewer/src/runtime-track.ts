/**
 * File: apps/web-viewer/src/runtime-track.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure runtime track helpers for mapping API bootstrap paths into viewport playback geometry.
 * Usage: Consumed by runtime-app and unit tests.
 * Dependencies: Shared track point contracts and interpolation helper.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { interpolateTrackPosition } from './track-editor-utils.js';
import { rotateTrackPointsForOrientation, type TrackOrientation } from './track-orientation.js';

const MIN_RUNTIME_POINTS = 2;
const DEFAULT_PADDING = 72;

export const FALLBACK_RUNTIME_TRACK_POINTS: TrackPoint[] = [
  { x: 90, y: 610 },
  { x: 260, y: 420 },
  { x: 520, y: 380 },
  { x: 720, y: 210 },
  { x: 830, y: 120 },
  { x: 980, y: 150 },
  { x: 1080, y: 80 }
];

export function mapRuntimeTrackPointsToViewport(
  points: TrackPoint[],
  viewportWidth: number,
  viewportHeight: number,
  padding = DEFAULT_PADDING,
  orientation: TrackOrientation = 'left-to-right'
): TrackPoint[] {
  const sourcePoints =
    points.length < MIN_RUNTIME_POINTS
      ? FALLBACK_RUNTIME_TRACK_POINTS
      : rotateTrackPointsForOrientation(points, orientation);

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return sourcePoints.map((point) => ({ x: point.x, y: point.y }));
  }

  const minX = Math.min(...sourcePoints.map((point) => point.x));
  const maxX = Math.max(...sourcePoints.map((point) => point.x));
  const minY = Math.min(...sourcePoints.map((point) => point.y));
  const maxY = Math.max(...sourcePoints.map((point) => point.y));

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const usableWidth = Math.max(1, viewportWidth - padding * 2);
  const usableHeight = Math.max(1, viewportHeight - padding * 2);
  const scale = Math.min(usableWidth / spanX, usableHeight / spanY);

  const mappedWidth = spanX * scale;
  const mappedHeight = spanY * scale;
  const offsetX = (viewportWidth - mappedWidth) / 2;
  const offsetY = (viewportHeight - mappedHeight) / 2;

  return sourcePoints.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale
  }));
}

export function sampleRuntimeTrackPosition(points: TrackPoint[], progress: number): TrackPoint {
  if (points.length < MIN_RUNTIME_POINTS) {
    return interpolateTrackPosition(FALLBACK_RUNTIME_TRACK_POINTS, progress);
  }

  return interpolateTrackPosition(points, progress);
}
