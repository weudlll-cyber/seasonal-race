/**
 * File: tests/track-layout-helpers.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies reusable track layout geometry helpers for studio preview and runtime playback.
 * Usage: Runs in Vitest as part of the regular test suite.
 * Dependencies: track-layout-helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  buildLaneBoardBounds,
  computeBackgroundLayoutRect,
  computeTrackNormal,
  mapTrackPointsToCurrentLayout
} from '../apps/web-viewer/src/track-layout-helpers';

describe('track layout helpers', () => {
  it('computes contain and cover rects for background layout', () => {
    const contain = computeBackgroundLayoutRect(2000, 1000, 1000, 1000, false);
    const cover = computeBackgroundLayoutRect(2000, 1000, 1000, 1000, true);

    expect(contain.w).toBe(1000);
    expect(contain.h).toBe(500);
    expect(contain.y).toBe(250);

    expect(cover.w).toBe(2000);
    expect(cover.h).toBe(1000);
    expect(cover.x).toBe(-500);
  });

  it('maps track points between authored and target layout modes', () => {
    const points = [{ x: 500, y: 500 }];

    const mapped = mapTrackPointsToCurrentLayout(
      points,
      2000,
      1000,
      1000,
      1000,
      1000,
      1000,
      false,
      true
    );
    expect(mapped[0]).toEqual({ x: 500, y: 500 });

    const topInContain = [{ x: 500, y: 250 }];
    const mappedTop = mapTrackPointsToCurrentLayout(
      topInContain,
      2000,
      1000,
      1000,
      1000,
      1000,
      1000,
      false,
      true
    );
    expect(mappedTop[0]?.y).toBe(0);
  });

  it('maps points correctly from editor viewport to broadcast viewport', () => {
    const topInEditorContain = [{ x: 580, y: 70 }];
    const mapped = mapTrackPointsToCurrentLayout(
      topInEditorContain,
      2000,
      1000,
      1160,
      720,
      1600,
      720,
      false,
      true
    );

    // Cover layout can extend beyond viewport bounds; expected y is negative overflow here.
    expect(mapped[0]?.y).toBeCloseTo(-40, 6);
  });

  it('builds lane board bounds for valid paths', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 100 }
    ];

    const bounds = buildLaneBoardBounds(points, 12, 10);
    expect(bounds.left).toHaveLength(11);
    expect(bounds.right).toHaveLength(11);
  });

  it('returns empty lane board bounds for short paths', () => {
    const bounds = buildLaneBoardBounds([{ x: 0, y: 0 }], 10, 10);
    expect(bounds.left).toEqual([]);
    expect(bounds.right).toEqual([]);
  });

  it('computes perpendicular normals on straight tracks', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ];

    const normal = computeTrackNormal(points, 0.5);
    expect(normal.x).toBeCloseTo(0, 6);
    expect(normal.y).toBeCloseTo(1, 6);
  });
});
