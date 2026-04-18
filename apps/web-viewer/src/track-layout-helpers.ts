/**
 * File: apps/web-viewer/src/track-layout-helpers.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure geometry helpers for track mapping, lane-board bounds, and path normals.
 * Usage: Shared by studio preview and runtime playback modules.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { interpolateTrackPosition } from './track-editor-utils.js';

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaneBoardBounds {
  left: TrackPoint[];
  right: TrackPoint[];
}

export function computeTrackNormal(points: TrackPoint[], progress: number): TrackPoint {
  if (points.length < 2) return { x: 0, y: 1 };

  const eps = 0.006;
  const a = interpolateTrackPosition(points, Math.max(0, progress - eps));
  const b = interpolateTrackPosition(points, Math.min(1, progress + eps));
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const len = Math.hypot(tx, ty);
  if (len <= 0.0001) return { x: 0, y: 1 };

  return {
    x: -ty / len,
    y: tx / len
  };
}

export function computeBackgroundLayoutRect(
  textureWidth: number,
  textureHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  coverMode: boolean
): LayoutRect {
  const scale = coverMode
    ? Math.max(viewportWidth / textureWidth, viewportHeight / textureHeight)
    : Math.min(viewportWidth / textureWidth, viewportHeight / textureHeight);

  const w = textureWidth * scale;
  const h = textureHeight * scale;
  return {
    x: (viewportWidth - w) / 2,
    y: (viewportHeight - h) / 2,
    w,
    h
  };
}

export function mapTrackPointsToCurrentLayout(
  points: TrackPoint[],
  textureWidth: number,
  textureHeight: number,
  authoredViewportWidth: number,
  authoredViewportHeight: number,
  targetViewportWidth: number,
  targetViewportHeight: number,
  authoredCoverMode: boolean,
  targetCoverMode: boolean
): TrackPoint[] {
  if (points.length === 0 || textureWidth <= 0 || textureHeight <= 0) {
    return points;
  }

  const authoredLayout = computeBackgroundLayoutRect(
    textureWidth,
    textureHeight,
    authoredViewportWidth,
    authoredViewportHeight,
    authoredCoverMode
  );
  const targetLayout = computeBackgroundLayoutRect(
    textureWidth,
    textureHeight,
    targetViewportWidth,
    targetViewportHeight,
    targetCoverMode
  );

  return points.map((p) => {
    const u = (p.x - authoredLayout.x) / authoredLayout.w;
    const v = (p.y - authoredLayout.y) / authoredLayout.h;
    return {
      x: targetLayout.x + u * targetLayout.w,
      y: targetLayout.y + v * targetLayout.h
    };
  });
}

export function buildLaneBoardBounds(
  points: TrackPoint[],
  halfWidth: number,
  samples = 140
): LaneBoardBounds {
  if (points.length < 2) {
    return { left: [], right: [] };
  }

  const left: TrackPoint[] = [];
  const right: TrackPoint[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const progress = i / samples;
    const pos = interpolateTrackPosition(points, progress);
    const normal = computeTrackNormal(points, progress);
    left.push({ x: pos.x + normal.x * halfWidth, y: pos.y + normal.y * halfWidth });
    right.push({ x: pos.x - normal.x * halfWidth, y: pos.y - normal.y * halfWidth });
  }

  return { left, right };
}
