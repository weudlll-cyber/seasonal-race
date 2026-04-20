/**
 * File: apps/web-viewer/src/studio-paths.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared path resolution helpers for studio preview and replay modes.
 * Usage: Called by studio-app ticker loop to compute render and replay paths.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { buildSmoothedPreviewPath, interpolateTrackPosition } from './track-editor-utils.js';
import { round3 } from './studio-editor-helpers.js';

export type StudioTrackEditMode = 'centerline' | 'boundaries';

interface ResolveStudioPathsInput {
  points: TrackPoint[];
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
  trackEditMode: StudioTrackEditMode;
  smoothingEnabled: boolean;
  mapPointsForLayout: (points: TrackPoint[]) => TrackPoint[];
}

interface ResolveStudioPathsResult {
  renderPoints: TrackPoint[];
  renderLeftBoundaryPoints: TrackPoint[] | null;
  renderRightBoundaryPoints: TrackPoint[] | null;
  previewPath: TrackPoint[];
  replayRacePath: TrackPoint[];
  coastEndPoint: TrackPoint | null;
}

function smoothPath(points: TrackPoint[], smoothingEnabled: boolean): TrackPoint[] {
  return smoothingEnabled ? buildSmoothedPreviewPath(points, 10) : points;
}

export function resolveStudioPaths(input: ResolveStudioPathsInput): ResolveStudioPathsResult {
  const {
    points,
    leftBoundaryPoints,
    rightBoundaryPoints,
    trackEditMode,
    smoothingEnabled,
    mapPointsForLayout
  } = input;

  let renderPoints = mapPointsForLayout(points);
  let renderLeftBoundaryPoints: TrackPoint[] | null = null;
  let renderRightBoundaryPoints: TrackPoint[] | null = null;
  let boundaryCoastPoint: TrackPoint | null = null;
  let raceCenterline: TrackPoint[] | null = null;

  if (
    trackEditMode === 'boundaries' &&
    leftBoundaryPoints.length >= 3 &&
    rightBoundaryPoints.length >= 3
  ) {
    const mappedLeft = mapPointsForLayout(leftBoundaryPoints);
    const mappedRight = mapPointsForLayout(rightBoundaryPoints);
    const leftCoastControl = mappedLeft[mappedLeft.length - 1]!;
    const rightCoastControl = mappedRight[mappedRight.length - 1]!;

    // Convention: first point = start, penultimate = finish line, last = coast-zone end.
    // Build race centerline from boundaries WITHOUT the last (coast) point.
    const raceLeft = mappedLeft.slice(0, -1);
    const raceRight = mappedRight.slice(0, -1);

    boundaryCoastPoint = {
      x: round3((leftCoastControl.x + rightCoastControl.x) * 0.5),
      y: round3((leftCoastControl.y + rightCoastControl.y) * 0.5)
    };

    renderLeftBoundaryPoints = smoothPath(mappedLeft, smoothingEnabled);
    renderRightBoundaryPoints = smoothPath(mappedRight, smoothingEnabled);
    renderPoints = buildCenterlineFromBoundaries(
      renderLeftBoundaryPoints,
      renderRightBoundaryPoints
    );

    const raceLeftSmoothed = smoothPath(raceLeft, smoothingEnabled);
    const raceRightSmoothed = smoothPath(raceRight, smoothingEnabled);
    raceCenterline = buildCenterlineFromBoundaries(raceLeftSmoothed, raceRightSmoothed);
  }

  const previewPath = smoothPath(renderPoints, smoothingEnabled);

  let replayRacePath: TrackPoint[];
  if (trackEditMode === 'boundaries' && raceCenterline) {
    replayRacePath = smoothPath(raceCenterline, smoothingEnabled);
  } else {
    replayRacePath = smoothPath(renderPoints.slice(0, -1), smoothingEnabled);
  }

  const coastEndPoint = boundaryCoastPoint ?? renderPoints[renderPoints.length - 1] ?? null;

  return {
    renderPoints,
    renderLeftBoundaryPoints,
    renderRightBoundaryPoints,
    previewPath,
    replayRacePath,
    coastEndPoint
  };
}

export function buildCenterlineFromBoundaries(
  left: TrackPoint[],
  right: TrackPoint[]
): TrackPoint[] {
  const samples = Math.max(24, Math.min(220, Math.max(left.length, right.length) * 6));
  const centerline: TrackPoint[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const progress = i / samples;
    const l = interpolateTrackPosition(left, progress);
    const r = interpolateTrackPosition(right, progress);
    centerline.push({
      x: round3((l.x + r.x) * 0.5),
      y: round3((l.y + r.y) * 0.5)
    });
  }

  // Keep export/editor manageable while preserving curve fidelity.
  return centerline.filter((_, index) => index % 2 === 0 || index === centerline.length - 1);
}
