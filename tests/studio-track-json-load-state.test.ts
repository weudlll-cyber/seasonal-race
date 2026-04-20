/**
 * File: tests/studio-track-json-load-state.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies studio JSON-load state parsing and normalization behavior.
 * Usage: Runs in Vitest to protect editor JSON import behavior during refactors.
 */

import { describe, expect, it } from 'vitest';

import { parseStudioTrackJsonLoadState } from '../apps/web-viewer/src/studio-track-json-load-state';

describe('studio track json load state', () => {
  it('loads centerline payload with defaults', () => {
    const loaded = parseStudioTrackJsonLoadState(
      JSON.stringify({
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 60 }
        ]
      })
    );

    expect(loaded.trackEditMode).toBe('centerline');
    expect(loaded.trackOrientation).toBe('left-to-right');
    expect(loaded.points).toHaveLength(3);
    expect(loaded.leftBoundaryPoints).toHaveLength(0);
    expect(loaded.rightBoundaryPoints).toHaveLength(0);
  });

  it('loads boundary payload and derives centerline path', () => {
    const loaded = parseStudioTrackJsonLoadState(
      JSON.stringify({
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 }
        ],
        editorPathMode: 'boundaries',
        editorBoundaries: {
          left: [
            { x: 100, y: 120 },
            { x: 220, y: 240 },
            { x: 340, y: 360 }
          ],
          right: [
            { x: 160, y: 120 },
            { x: 280, y: 240 },
            { x: 400, y: 360 }
          ]
        }
      })
    );

    expect(loaded.trackEditMode).toBe('boundaries');
    expect(loaded.leftBoundaryPoints).toHaveLength(3);
    expect(loaded.rightBoundaryPoints).toHaveLength(3);
    expect(loaded.points.length).toBeGreaterThan(3);
  });

  it('applies top-to-bottom orientation rotation on load', () => {
    const loaded = parseStudioTrackJsonLoadState(
      JSON.stringify({
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 300, y: 100 }
        ],
        editorTrackOrientation: 'top-to-bottom'
      })
    );

    expect(loaded.trackOrientation).toBe('top-to-bottom');
    expect(loaded.points[0]).not.toEqual({ x: 100, y: 100 });
  });

  it('throws when payload has no valid points array', () => {
    expect(() => parseStudioTrackJsonLoadState(JSON.stringify({ points: [] }))).toThrow();
    expect(() => parseStudioTrackJsonLoadState(JSON.stringify({ foo: 'bar' }))).toThrow();
  });
});
