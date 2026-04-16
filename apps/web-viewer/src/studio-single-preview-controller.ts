/**
 * File: apps/web-viewer/src/studio-single-preview-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates single-runner preview ticker logic used when replay mode is disabled.
 * Usage: Call once per frame in studio ticker and apply returned progress/elapsed state.
 */

import type { Container, Graphics, Sprite } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import type { CameraController } from './camera';
import { interpolateTrackPosition } from './track-editor-utils';
import { clampWorldToBackground, resetWorldTransform } from './world-transform-utils';
import type { StudioReplayRacerView } from './studio-replay-controller';

export interface StudioSinglePreviewTickOptions {
  dt: number;
  playingPreview: boolean;
  previewProgress: number;
  singlePreviewElapsedSeconds: number;
  runnerSpeed: number;
  previewPath: TrackPoint[];
  runner: Sprite;
  replayRacers: StudioReplayRacerView[];
  leaderboardList: HTMLElement;
  laneBoardLayer: Graphics;
  broadcastViewEnabled: boolean;
  camera: CameraController;
  world: Container;
  appScreenWidth: number;
  appScreenHeight: number;
  backgroundSprite: Sprite | null;
}

export interface StudioSinglePreviewTickResult {
  previewProgress: number;
  singlePreviewElapsedSeconds: number;
}

export function tickStudioSinglePreviewMode(
  options: StudioSinglePreviewTickOptions
): StudioSinglePreviewTickResult {
  const {
    dt,
    playingPreview,
    runner,
    replayRacers,
    leaderboardList,
    laneBoardLayer,
    previewPath,
    runnerSpeed,
    broadcastViewEnabled,
    camera,
    world,
    appScreenWidth,
    appScreenHeight,
    backgroundSprite
  } = options;

  let previewProgress = options.previewProgress;
  let singlePreviewElapsedSeconds = options.singlePreviewElapsedSeconds;

  for (const rr of replayRacers) {
    rr.sprite.visible = false;
    rr.labelBg.visible = false;
    rr.labelText.visible = false;
  }
  leaderboardList.innerHTML = '';
  laneBoardLayer.clear();
  runner.visible = true;

  if (playingPreview) {
    singlePreviewElapsedSeconds += dt;
    previewProgress += runnerSpeed * dt;
    // Keep movement in normalized [0..1] loop for continuous preview playback.
    if (previewProgress > 1) previewProgress -= 1;
  }

  const pos = interpolateTrackPosition(previewPath, previewProgress);
  runner.position.set(pos.x, pos.y);

  if (broadcastViewEnabled) {
    camera.update(
      dt,
      {
        racers: [{ progress: previewProgress, position: { x: pos.x, y: pos.y } }],
        finished: false,
        elapsedSeconds: singlePreviewElapsedSeconds,
        cameraSettings: {
          expectedDurationMs: 50_000,
          zoomPulseCount: 2,
          zoomPulseStrength: 0.08,
          introOverviewHoldSeconds: 0,
          introTransitionSeconds: 0.2,
          zoomScaleMultiplier: 1.7
        }
      },
      world
    );
    if (backgroundSprite) {
      clampWorldToBackground(world, backgroundSprite, appScreenWidth, appScreenHeight);
    }
  } else {
    resetWorldTransform(world);
  }

  return {
    previewProgress,
    singlePreviewElapsedSeconds
  };
}
