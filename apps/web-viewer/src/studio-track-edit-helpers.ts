/**
 * File: apps/web-viewer/src/studio-track-edit-helpers.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure helpers for studio centerline/boundary edit-state transformations.
 * Usage: Imported by studio-app to keep orchestration code compact.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { computeTrackNormal } from './track-layout-helpers.js';
import { buildCenterlineFromBoundaries, type StudioTrackEditMode } from './studio-paths.js';
import { round3 } from './studio-editor-helpers.js';
import type { BoundarySide } from './studio-preset-store.js';

interface EnsureBoundaryPointsInput {
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
  points: TrackPoint[];
  fallbackPoints: TrackPoint[];
  halfWidthPx: number;
}

interface EditablePointsUpdateInput {
  trackEditMode: StudioTrackEditMode;
  boundaryEditSide: BoundarySide;
  nextPoints: TrackPoint[];
  points: TrackPoint[];
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
}

export function resolveCenterlinePoints(
  trackEditMode: StudioTrackEditMode,
  points: TrackPoint[],
  leftBoundaryPoints: TrackPoint[],
  rightBoundaryPoints: TrackPoint[]
): TrackPoint[] {
  if (
    trackEditMode === 'boundaries' &&
    leftBoundaryPoints.length >= 3 &&
    rightBoundaryPoints.length >= 3
  ) {
    return buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
  }
  return points;
}

export function ensureBoundaryPointsFromCenterline(input: EnsureBoundaryPointsInput): {
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
} {
  const { leftBoundaryPoints, rightBoundaryPoints, points, fallbackPoints, halfWidthPx } = input;
  if (leftBoundaryPoints.length >= 3 && rightBoundaryPoints.length >= 3) {
    return { leftBoundaryPoints, rightBoundaryPoints };
  }

  const source = points.length >= 3 ? points : fallbackPoints;
  return buildBoundaryPairFromCenterline(source, halfWidthPx);
}

export function getEditablePoints(
  trackEditMode: StudioTrackEditMode,
  boundaryEditSide: BoundarySide,
  points: TrackPoint[],
  leftBoundaryPoints: TrackPoint[],
  rightBoundaryPoints: TrackPoint[]
): TrackPoint[] {
  if (trackEditMode !== 'boundaries') return points;
  return boundaryEditSide === 'left' ? leftBoundaryPoints : rightBoundaryPoints;
}

export function applyEditablePointsUpdate(input: EditablePointsUpdateInput): {
  points: TrackPoint[];
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
} {
  const {
    trackEditMode,
    boundaryEditSide,
    nextPoints,
    points,
    leftBoundaryPoints,
    rightBoundaryPoints
  } = input;

  if (trackEditMode !== 'boundaries') {
    return {
      points: nextPoints,
      leftBoundaryPoints,
      rightBoundaryPoints
    };
  }

  const nextLeft = boundaryEditSide === 'left' ? nextPoints : leftBoundaryPoints;
  const nextRight = boundaryEditSide === 'right' ? nextPoints : rightBoundaryPoints;

  let nextCenterline = points;
  if (nextLeft.length >= 3 && nextRight.length >= 3) {
    nextCenterline = buildCenterlineFromBoundaries(nextLeft, nextRight);
  }

  return {
    points: nextCenterline,
    leftBoundaryPoints: nextLeft,
    rightBoundaryPoints: nextRight
  };
}

export function buildBoundaryPairFromCenterline(
  centerline: TrackPoint[],
  halfWidth: number
): { leftBoundaryPoints: TrackPoint[]; rightBoundaryPoints: TrackPoint[] } {
  const leftBoundaryPoints: TrackPoint[] = [];
  const rightBoundaryPoints: TrackPoint[] = [];
  for (let i = 0; i < centerline.length; i += 1) {
    const progress = centerline.length <= 1 ? 0 : i / (centerline.length - 1);
    const p = centerline[i]!;
    const n = computeTrackNormal(centerline, progress);
    leftBoundaryPoints.push({ x: round3(p.x + n.x * halfWidth), y: round3(p.y + n.y * halfWidth) });
    rightBoundaryPoints.push({
      x: round3(p.x - n.x * halfWidth),
      y: round3(p.y - n.y * halfWidth)
    });
  }
  return { leftBoundaryPoints, rightBoundaryPoints };
}
