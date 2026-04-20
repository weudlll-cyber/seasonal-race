/**
 * File: tests/studio-preset-actions.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Verifies extracted studio preset action/state helpers.
 * Usage: Runs with Vitest to guard preset lifecycle refactors.
 */

import { describe, expect, it } from 'vitest';

import {
  buildStudioPresetFromState,
  normalizeLoadedStudioPreset
} from '../apps/web-viewer/src/studio-preset-actions';

describe('studio preset actions', () => {
  it('builds a rounded preset snapshot with background payload', () => {
    const preset = buildStudioPresetFromState({
      trackId: '  custom-track  ',
      trackName: '  Custom Name  ',
      effectProfileId: '  sand-dry  ',
      points: [
        { x: 10.1239, y: 20.9876 },
        { x: 30.5555, y: 40.1111 },
        { x: 50.4567, y: 60.6543 }
      ],
      trackEditMode: 'centerline',
      trackOrientation: 'left-to-right',
      boundaryEditSide: 'left',
      leftBoundaryPoints: [],
      rightBoundaryPoints: [],
      laneWidthPx: 7,
      replayRacerCount: 12,
      nameDisplayMode: 'leaders-focus',
      focusRacerNumber: 2,
      playingPreview: true,
      smoothingEnabled: true,
      replayModeEnabled: false,
      laneBoardsVisible: false,
      backgroundImageDataUrl: 'data:image/png;base64,abc',
      fallbackTrackId: 'fallback-id',
      fallbackTrackName: 'Fallback Name'
    });

    expect(preset.trackId).toBe('custom-track');
    expect(preset.trackName).toBe('Custom Name');
    expect(preset.effectProfileId).toBe('sand-dry');
    expect(preset.points[0]).toEqual({ x: 10.124, y: 20.988 });
    expect(preset.backgroundImageDataUrl).toContain('data:image/png;base64');
  });

  it('normalizes loaded preset state with defaults and clamps', () => {
    const loaded = normalizeLoadedStudioPreset({
      parsed: {
        points: [
          { x: 100, y: 100 },
          { x: 220, y: 140 },
          { x: 340, y: 180 }
        ],
        trackId: '  loaded-id ',
        trackName: '  loaded name ',
        effectProfileId: ' water-calm ',
        laneWidthPx: 999,
        replayRacerCount: 1,
        focusRacerNumber: 40,
        playingPreview: false,
        smoothingEnabled: false,
        replayModeEnabled: true,
        laneBoardsVisible: true,
        hasBackgroundImage: true
      },
      fallbackPoints: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 }
      ],
      defaults: {
        laneWidthPx: 6,
        replayRacerCount: 12,
        nameDisplayMode: 'leaders-focus',
        focusRacerNumber: 1,
        fallbackTrackId: 'fallback-track',
        fallbackTrackName: 'Fallback Track'
      }
    });

    expect(loaded.trackEditMode).toBe('centerline');
    expect(loaded.trackId).toBe('loaded-id');
    expect(loaded.trackName).toBe('loaded name');
    expect(loaded.effectProfileId).toBe('water-calm');
    expect(loaded.laneWidthPx).toBe(24);
    expect(loaded.replayRacerCount).toBe(2);
    expect(loaded.focusRacerNumber).toBe(2);
    expect(loaded.playingPreview).toBe(false);
    expect(loaded.smoothingEnabled).toBe(false);
    expect(loaded.replayModeEnabled).toBe(true);
    expect(loaded.laneBoardsVisible).toBe(true);
    expect(loaded.hasBackgroundImage).toBe(true);
  });

  it('normalizes boundaries mode and applies legacy orientation rotation', () => {
    const loaded = normalizeLoadedStudioPreset({
      parsed: {
        points: [
          { x: 120, y: 120 },
          { x: 240, y: 120 },
          { x: 360, y: 120 }
        ],
        trackEditMode: 'boundaries',
        leftBoundaryPoints: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 300, y: 100 }
        ],
        rightBoundaryPoints: [
          { x: 100, y: 160 },
          { x: 200, y: 160 },
          { x: 300, y: 160 }
        ],
        trackOrientation: 'top-to-bottom'
      },
      fallbackPoints: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 }
      ],
      defaults: {
        laneWidthPx: 8,
        replayRacerCount: 12,
        nameDisplayMode: 'leaders-focus',
        focusRacerNumber: 1,
        fallbackTrackId: 'fallback-track',
        fallbackTrackName: 'Fallback Track'
      }
    });

    expect(loaded.trackEditMode).toBe('boundaries');
    expect(loaded.trackOrientation).toBe('top-to-bottom');
    expect(loaded.leftBoundaryPoints.length).toBeGreaterThanOrEqual(3);
    expect(loaded.rightBoundaryPoints.length).toBeGreaterThanOrEqual(3);
    expect(loaded.points.length).toBeGreaterThan(3);
  });
});
