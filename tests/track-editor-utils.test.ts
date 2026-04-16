/**
 * File: tests/track-editor-utils.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Validates track editor utility functions for flexible point-based tracks.
 * Usage: Runs in Vitest as part of the regular test suite.
 * Dependencies: track-editor-utils.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSmoothedPreviewPath,
  buildTrackDefinition,
  DEFAULT_EDITOR_TRACK_ID,
  DEFAULT_EDITOR_TRACK_NAME,
  interpolateTrackPosition,
  polylineLength
} from '../apps/web-viewer/src/track-editor-utils';

describe('track editor utils', () => {
  it('computes polyline length for an L-shape', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ];

    expect(polylineLength(points)).toBe(200);
  });

  it('builds fallback id and name when metadata is blank', () => {
    const track = buildTrackDefinition({ id: ' ', name: ' ' }, []);

    expect(track.id).toBe(DEFAULT_EDITOR_TRACK_ID);
    expect(track.name).toBe(DEFAULT_EDITOR_TRACK_NAME);
    expect(track.length).toBe(0);
    expect(track.points).toEqual([]);
  });

  it('slugifies custom track id from name when id is not provided', () => {
    const track = buildTrackDefinition(
      {
        name: 'Horse Arena Curvy 01',
        effectProfileId: 'horse-dust-v1'
      },
      [
        { x: 0, y: 0 },
        { x: 50, y: 50 }
      ]
    );

    expect(track.id).toBe('horse-arena-curvy-01');
    expect(track.effectProfileId).toBe('horse-dust-v1');
  });

  it('interpolates and clamps progress on a polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ];

    expect(interpolateTrackPosition(points, -1)).toEqual({ x: 0, y: 0 });
    expect(interpolateTrackPosition(points, 0.5)).toEqual({ x: 100, y: 0 });
    expect(interpolateTrackPosition(points, 2)).toEqual({ x: 100, y: 100 });
  });

  it('builds a denser path when smoothing is enabled', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 120, y: 60 },
      { x: 180, y: 120 }
    ];

    const smoothed = buildSmoothedPreviewPath(points, 8);
    expect(smoothed.length).toBeGreaterThan(points.length);
    expect(smoothed[0]).toEqual(points[0]);
    expect(smoothed[smoothed.length - 1]).toEqual(points[points.length - 1]);
  });

  it('returns original points for short tracks in smoothing mode', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ];

    const smoothed = buildSmoothedPreviewPath(points, 8);
    expect(smoothed).toEqual(points);
  });
});
