/**
 * File: tests/studio-app-ticker-controller.test.ts
 * Model: GPT-5.3-Codex
 * Purpose: Regression tests for extracted studio app playback ticker controller behavior.
 * Usage: Runs with Vitest as part of studio orchestration parity checks.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  tickStudioAppPlaybackFrame,
  type StudioAppTickerTickInput
} from '../apps/web-viewer/src/studio-app-ticker-controller';

function createBaseInput(): StudioAppTickerTickInput {
  const clearLaneBoardLayer = vi.fn();
  const clearSurfaceEffectLayer = vi.fn();
  const runnerScaleSet = vi.fn();

  return {
    dt: 1 / 60,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ],
    leftBoundaryPoints: [],
    rightBoundaryPoints: [],
    trackEditMode: 'centerline',
    smoothingEnabled: false,
    replayModeEnabled: false,
    playingPreview: true,
    laneWidthPx: 8,
    laneBoardsVisible: false,
    nameDisplayMode: 'all',
    focusRacerNumber: 1,
    replayRacers: [
      { sprite: { visible: true } } as unknown as StudioAppTickerTickInput['replayRacers'][number]
    ],
    replayTimeMs: 120,
    leaderboardTickMs: 80,
    replayData: {
      durationMs: 1000,
      frames: [{ timeMs: 0, finished: false, racers: [{ id: 'r-1', progress: 0 }] }]
    },
    replayRunId: 7,
    previewProgress: 0.2,
    singlePreviewElapsedSeconds: 1.4,
    runnerSpeed: 0.09,
    runner: {
      visible: true,
      texture: { width: 64, height: 64 },
      scale: { set: runnerScaleSet }
    } as unknown as StudioAppTickerTickInput['runner'],
    leaderboardList: { innerHTML: '' } as unknown as HTMLElement,
    laneBoardLayer: {
      clear: clearLaneBoardLayer
    } as unknown as StudioAppTickerTickInput['laneBoardLayer'],
    surfaceEffectLayer: {
      clear: clearSurfaceEffectLayer
    } as unknown as StudioAppTickerTickInput['surfaceEffectLayer'],
    broadcastViewEnabled: false,
    camera: {} as StudioAppTickerTickInput['camera'],
    world: {} as StudioAppTickerTickInput['world'],
    backgroundSprite: null,
    appScreenWidth: 1160,
    appScreenHeight: 720,
    viewWidth: 1160,
    viewHeight: 720,
    generatedRacerPack: null,
    trackPreviewTextures: [],
    spritePreviewState: {
      frameIndex: 0,
      frameElapsedMs: 0,
      variantIndex: 0,
      variantElapsedMs: 0
    },
    defaultRunnerTexture: {
      width: 50,
      height: 50
    } as StudioAppTickerTickInput['defaultRunnerTexture'],
    trackPreviewSizeInputValue: 74,
    regenerateReplayData: () =>
      ({
        durationMs: 1000,
        frames: [{ timeMs: 0, finished: false, racers: [{ id: 'r-1', progress: 0 }] }]
      }) as StudioAppTickerTickInput['replayData'],
    applyReplaySpriteSizeFromSlider: vi.fn(),
    applyEditorViewTransform: vi.fn(),
    updateStudioSurfaceEffects: vi.fn(),
    resetNoTrackTransientState: vi.fn(),
    tickReplayMode: vi.fn(() => ({
      replayTimeMs: 0,
      leaderboardTickMs: 0,
      replayData: {
        durationMs: 1000,
        frames: [{ timeMs: 0, finished: false, racers: [{ id: 'r-1', progress: 0 }] }]
      }
    })),
    tickSinglePreviewMode: vi.fn(() => ({
      previewProgress: 0,
      singlePreviewElapsedSeconds: 0
    }))
  };
}

describe('studio app ticker controller', () => {
  it('resets visual state in no-track branch', () => {
    const input = createBaseInput();
    input.points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ];

    const result = tickStudioAppPlaybackFrame(input);

    expect(input.runner.visible).toBe(false);
    expect(input.replayRacers[0]!.sprite.visible).toBe(false);
    expect(input.laneBoardLayer.clear).toHaveBeenCalledTimes(1);
    expect(input.surfaceEffectLayer.clear).toHaveBeenCalledTimes(1);
    expect(input.resetNoTrackTransientState).toHaveBeenCalledTimes(1);
    expect(input.applyEditorViewTransform).toHaveBeenCalledTimes(1);
    expect(result.replayTimeMs).toBe(input.replayTimeMs);
    expect(result.previewProgress).toBe(input.previewProgress);
  });

  it('uses replay branch and returns replay tick state', () => {
    const input = createBaseInput();
    input.replayModeEnabled = true;

    const replayTickMock = vi.fn(() => ({
      replayTimeMs: 444,
      leaderboardTickMs: 333,
      replayData: {
        durationMs: 2000,
        frames: [{ timeMs: 0, finished: false, racers: [{ id: 'r-1', progress: 0.1 }] }]
      }
    }));

    input.tickReplayMode = replayTickMock;
    const result = tickStudioAppPlaybackFrame(input);

    expect(replayTickMock).toHaveBeenCalledTimes(1);
    expect(input.applyReplaySpriteSizeFromSlider).toHaveBeenCalledTimes(1);
    expect(input.updateStudioSurfaceEffects).toHaveBeenCalledWith(input.dt);
    expect(result.replayTimeMs).toBe(444);
    expect(result.leaderboardTickMs).toBe(333);
  });

  it('uses single-preview branch and applies runner preview texture scale', () => {
    const input = createBaseInput();
    input.generatedRacerPack = {
      sheetDataUrl: 'data:image/png;base64,abc',
      sheetCanvas: {} as HTMLCanvasElement,
      meta: {
        generator: 'studio-auto-racer-pack-v1',
        appliedOutputScale: 1,
        frameWidth: 48,
        frameHeight: 48,
        frameCount: 4,
        racerVariantCount: 1,
        sourceWidth: 48,
        sourceHeight: 48,
        variants: [],
        frames: []
      }
    };
    input.trackPreviewTextures = [
      { width: 80, height: 40 } as StudioAppTickerTickInput['defaultRunnerTexture']
    ];

    const singleTickMock = vi.fn(() => ({
      previewProgress: 0.66,
      singlePreviewElapsedSeconds: 9.2
    }));

    input.tickSinglePreviewMode = singleTickMock;
    const result = tickStudioAppPlaybackFrame(input);

    expect(singleTickMock).toHaveBeenCalledTimes(1);
    expect(input.runner.texture).toBe(input.trackPreviewTextures[0]);
    expect(input.runner.scale.set).toHaveBeenCalledTimes(1);
    expect(input.updateStudioSurfaceEffects).toHaveBeenCalledWith(input.dt);
    expect(result.previewProgress).toBe(0.66);
    expect(result.singlePreviewElapsedSeconds).toBe(9.2);
  });
});
