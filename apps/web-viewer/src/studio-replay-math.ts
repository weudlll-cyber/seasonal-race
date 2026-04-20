/**
 * File: apps/web-viewer/src/studio-replay-math.ts
 * Model: GPT-5.3-Codex
 * Purpose: Collects reusable replay math/path helpers.
 * Usage: Shared by studio-replay-utils and replay controllers.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { interpolateTrackPosition } from './track-editor-utils.js';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computePathLength(points: TrackPoint[]): number {
  if (points.length < 2) return 1;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.max(1, total);
}

export function normalize(dx: number, dy: number): TrackPoint {
  const len = Math.hypot(dx, dy);
  if (len <= 0.00001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

export function computeTrackTangentAtProgress(path: TrackPoint[], progress: number): TrackPoint {
  const p0 = interpolateTrackPosition(path, clamp01(progress - 0.003));
  const p1 = interpolateTrackPosition(path, clamp01(progress + 0.003));
  return normalize(p1.x - p0.x, p1.y - p0.y);
}

export function lerpPoint(a: TrackPoint, b: TrackPoint, t: number): TrackPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}
