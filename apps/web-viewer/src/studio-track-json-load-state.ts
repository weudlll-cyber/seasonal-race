/**
 * File: apps/web-viewer/src/studio-track-json-load-state.ts
 * Model: GPT-5.3-Codex
 * Purpose: Parses studio track JSON payloads into normalized editor state.
 * Usage: Used by studio-app when loading JSON from the editor preview textarea.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { round3 } from './studio-editor-helpers.js';
import { rotateStudioGeometry } from './studio-geometry-state.js';
import { buildCenterlineFromBoundaries, type StudioTrackEditMode } from './studio-paths.js';
import { normalizeTrackOrientation, type TrackOrientation } from './track-orientation.js';

interface ParsedStudioTrackJsonPayload {
  points?: TrackPoint[];
  id?: string;
  name?: string;
  editorPathMode?: string;
  editorBoundaries?: {
    left?: TrackPoint[];
    right?: TrackPoint[];
  };
  editorTrackOrientation?: string;
}

export interface LoadedStudioTrackJsonState {
  points: TrackPoint[];
  trackEditMode: StudioTrackEditMode;
  trackOrientation: TrackOrientation;
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
  trackId?: string;
  trackName?: string;
}

function toNormalizedPointList(points: TrackPoint[]): TrackPoint[] {
  return points.map((point) => ({
    x: round3(Number(point.x)),
    y: round3(Number(point.y))
  }));
}

export function parseStudioTrackJsonLoadState(jsonPayload: string): LoadedStudioTrackJsonState {
  const parsed = JSON.parse(jsonPayload) as ParsedStudioTrackJsonPayload;

  if (!Array.isArray(parsed.points) || parsed.points.length < 3) {
    throw new Error('points array missing');
  }

  let points = toNormalizedPointList(parsed.points);
  let trackEditMode: StudioTrackEditMode = 'centerline';
  let leftBoundaryPoints: TrackPoint[] = [];
  let rightBoundaryPoints: TrackPoint[] = [];

  if (
    parsed.editorPathMode === 'boundaries' &&
    Array.isArray(parsed.editorBoundaries?.left) &&
    Array.isArray(parsed.editorBoundaries?.right) &&
    parsed.editorBoundaries.left.length >= 3 &&
    parsed.editorBoundaries.right.length >= 3
  ) {
    trackEditMode = 'boundaries';
    leftBoundaryPoints = toNormalizedPointList(parsed.editorBoundaries.left);
    rightBoundaryPoints = toNormalizedPointList(parsed.editorBoundaries.right);
    points = buildCenterlineFromBoundaries(leftBoundaryPoints, rightBoundaryPoints);
  }

  const trackOrientation = normalizeTrackOrientation(parsed.editorTrackOrientation);
  if (trackOrientation === 'top-to-bottom') {
    const rotated = rotateStudioGeometry(
      { points, leftBoundaryPoints, rightBoundaryPoints },
      'left-to-right',
      'top-to-bottom'
    );
    points = rotated.points;
    leftBoundaryPoints = rotated.leftBoundaryPoints;
    rightBoundaryPoints = rotated.rightBoundaryPoints;
  }

  const loadedState: LoadedStudioTrackJsonState = {
    points,
    trackEditMode,
    trackOrientation,
    leftBoundaryPoints,
    rightBoundaryPoints
  };

  if (parsed.id !== undefined) {
    loadedState.trackId = parsed.id;
  }
  if (parsed.name !== undefined) {
    loadedState.trackName = parsed.name;
  }

  return loadedState;
}
