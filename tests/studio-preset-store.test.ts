/**
 * File: tests/studio-preset-store.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted studio preset store helpers.
 * Usage: Runs with Vitest as part of studio refactor parity checks.
 */

import { describe, expect, it } from 'vitest';

import { clampInteger, parsePresetStore } from '../apps/web-viewer/src/studio-preset-store';

describe('studio preset store helpers', () => {
  it('parses valid preset stores and keeps last-used value', () => {
    const parsed = parsePresetStore(
      JSON.stringify({
        version: 2,
        lastUsedPresetName: 'alpha',
        presets: {
          alpha: {
            version: 1,
            trackId: 't1',
            trackName: 'Track 1',
            effectProfileId: 'water-calm',
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 20, y: 0 }
            ],
            laneWidthPx: 7,
            replayRacerCount: 12,
            nameDisplayMode: 'leaders-focus',
            focusRacerNumber: 1,
            playingPreview: true,
            smoothingEnabled: true,
            replayModeEnabled: false,
            laneBoardsVisible: false
          }
        }
      })
    );

    expect(parsed.version).toBe(2);
    expect(parsed.lastUsedPresetName).toBe('alpha');
    expect(parsed.presets.alpha?.trackId).toBe('t1');
  });

  it('returns empty store for invalid or mismatched payloads', () => {
    expect(parsePresetStore(null).presets).toEqual({});
    expect(parsePresetStore('{oops').presets).toEqual({});
    expect(parsePresetStore(JSON.stringify({ version: 1, presets: {} })).presets).toEqual({});
  });

  it('clamps and floors integer values with fallback for non-finite input', () => {
    expect(clampInteger(8.9, 1, 10, 5)).toBe(8);
    expect(clampInteger(42, 1, 10, 5)).toBe(10);
    expect(clampInteger(-3, 1, 10, 5)).toBe(1);
    expect(clampInteger(Number.NaN, 1, 10, 5)).toBe(5);
  });
});
