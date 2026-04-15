/**
 * File: packages/race-engine/src/track-path.ts
 * Purpose: Linear interpolation along a polyline track path for participant position rendering.
 * Usage: Pass TrackPoint[] and a normalized progress value t ∈ [0,1] to get a 2D coordinate.
 * Dependencies: shared-types TrackPoint.
 * Edge cases:
 *   - Empty arrays return the origin {x:0,y:0}.
 *   - Single-point arrays return that point regardless of t.
 *   - t is clamped to [0,1] before processing.
 *   - Zero-length polylines (all points coincident) return the first point.
 */

import type { TrackPoint } from '../../shared-types/src/index';

/**
 * Returns the total Euclidean length of a polyline defined by an ordered array of points.
 * Returns 0 for arrays with fewer than 2 points.
 */
export function polylineLength(points: readonly TrackPoint[]): number {
  if (points.length < 2) return 0;

  let total = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];

    // Both indices are within bounds — loop condition guarantees i < points.length
    if (prev === undefined || curr === undefined) break;

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;

    total += Math.sqrt(dx * dx + dy * dy);
  }

  return total;
}

/**
 * Maps a normalized progress value t ∈ [0,1] to a 2D position along the polyline.
 * t=0 → first point; t=1 → last point.
 * Useful for placing race participants on a curved track for rendering.
 */
export function interpolatePosition(points: readonly TrackPoint[], t: number): TrackPoint {
  if (points.length === 0) return { x: 0, y: 0 };

  const first = points[0];
  const last = points[points.length - 1];

  // Single-element array or undefined guard
  if (first === undefined) return { x: 0, y: 0 };
  if (points.length === 1 || last === undefined) return { x: first.x, y: first.y };

  const clamped = Math.max(0, Math.min(1, t));

  if (clamped <= 0) return { x: first.x, y: first.y };
  if (clamped >= 1) return { x: last.x, y: last.y };

  const total = polylineLength(points);

  // All points coincident — return first to avoid NaN from division by zero
  if (total === 0) return { x: first.x, y: first.y };

  const targetDist = clamped * total;
  let accumulated = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];

    if (prev === undefined || curr === undefined) break;

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (accumulated + segLen >= targetDist) {
      // Target lies within this segment — lerp along it
      const localT = segLen === 0 ? 0 : (targetDist - accumulated) / segLen;

      return {
        x: prev.x + localT * dx,
        y: prev.y + localT * dy
      };
    }

    accumulated += segLen;
  }

  // Floating-point rounding may miss the last segment by epsilon — clamp to last point
  return { x: last.x, y: last.y };
}
