/**
 * File: apps/web-viewer/src/track-editor-utils.ts
 * Purpose: Shared utility functions for interactive track editing and export.
 * Usage: Used by the PixiJS editor UI to build TrackDefinition JSON and preview movement.
 * Dependencies: Shared track point contract only.
 * Edge cases:
 *   - Handles empty and single-point tracks safely.
 *   - Clamps interpolation progress to [0,1].
 */

import type { TrackDefinition, TrackPoint } from '../../../packages/shared-types/src/index.js';

export const DEFAULT_EDITOR_TRACK_ID = 'custom-track';
export const DEFAULT_EDITOR_TRACK_NAME = 'Custom Track';

export interface TrackEditorMeta {
  id?: string;
  name?: string;
  effectProfileId?: string;
}

/**
 * Creates a denser preview path using Catmull-Rom interpolation.
 * The original points remain unchanged and are still used for export.
 */
export function buildSmoothedPreviewPath(
  points: TrackPoint[],
  samplesPerSegment = 10
): TrackPoint[] {
  if (points.length < 3 || samplesPerSegment < 2) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  const result: TrackPoint[] = [{ x: points[0]!.x, y: points[0]!.y }];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    for (let s = 1; s <= samplesPerSegment; s += 1) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      result.push({ x: round3(x), y: round3(y) });
    }
  }

  return result;
}

/**
 * Builds a serializable TrackDefinition from editor metadata and point list.
 */
export function buildTrackDefinition(meta: TrackEditorMeta, points: TrackPoint[]): TrackDefinition {
  const normalizedName = normalizeTrackName(meta.name);
  const normalizedId = normalizeTrackId(meta.id, normalizedName);

  const track: TrackDefinition = {
    id: normalizedId,
    name: normalizedName,
    length: polylineLength(points),
    points: points.map((p) => ({ x: round3(p.x), y: round3(p.y) }))
  };

  if (meta.effectProfileId?.trim()) {
    track.effectProfileId = meta.effectProfileId.trim();
  }

  return track;
}

/**
 * Interpolates world position along a point polyline with normalized progress in [0,1].
 */
export function interpolateTrackPosition(points: TrackPoint[], progress: number): TrackPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;

  const clamped = clamp(progress, 0, 1);
  const totalLength = polylineLength(points);
  if (totalLength === 0) return points[0]!;

  const target = totalLength * clamped;
  let walked = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = distance(a, b);
    if (seg <= 0) continue;

    if (walked + seg >= target) {
      const local = (target - walked) / seg;
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local
      };
    }

    walked += seg;
  }

  return points[points.length - 1]!;
}

/**
 * Computes Euclidean polyline length.
 */
export function polylineLength(points: TrackPoint[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1]!, points[i]!);
  }
  return round3(total);
}

function normalizeTrackName(name?: string): string {
  const value = name?.trim();
  return value && value.length > 0 ? value : DEFAULT_EDITOR_TRACK_NAME;
}

function normalizeTrackId(id: string | undefined, normalizedName: string): string {
  const raw = id?.trim() || normalizedName;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : DEFAULT_EDITOR_TRACK_ID;
}

function distance(a: TrackPoint, b: TrackPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
