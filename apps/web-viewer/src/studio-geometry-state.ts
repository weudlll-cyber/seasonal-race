/**
 * File: apps/web-viewer/src/studio-geometry-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared geometry-state helpers for rotating authored studio points/boundaries.
 * Usage: Imported by studio-app when orientation changes or legacy data is loaded.
 */

import {
  computeTrackOrientationCenter,
  rotateTrackPointsBetweenOrientations,
  type TrackOrientation
} from './track-orientation.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';

export interface StudioGeometryState {
  points: TrackPoint[];
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
}

export function rotateStudioGeometry(
  state: StudioGeometryState,
  from: TrackOrientation,
  to: TrackOrientation
): StudioGeometryState {
  if (from === to) {
    return state;
  }

  const orientationCenter = computeTrackOrientationCenter(state.points);
  const points = rotateTrackPointsBetweenOrientations(state.points, from, to, orientationCenter);
  const leftBoundaryPoints =
    state.leftBoundaryPoints.length >= 3
      ? rotateTrackPointsBetweenOrientations(state.leftBoundaryPoints, from, to, orientationCenter)
      : state.leftBoundaryPoints;
  const rightBoundaryPoints =
    state.rightBoundaryPoints.length >= 3
      ? rotateTrackPointsBetweenOrientations(state.rightBoundaryPoints, from, to, orientationCenter)
      : state.rightBoundaryPoints;

  return {
    points,
    leftBoundaryPoints,
    rightBoundaryPoints
  };
}

export function orientCenterlinePoints(
  points: TrackPoint[],
  targetOrientation: TrackOrientation
): TrackPoint[] {
  if (targetOrientation === 'left-to-right') {
    return points;
  }

  const orientationCenter = computeTrackOrientationCenter(points);
  return rotateTrackPointsBetweenOrientations(
    points,
    'left-to-right',
    targetOrientation,
    orientationCenter
  );
}
