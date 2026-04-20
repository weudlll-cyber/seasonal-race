/**
 * File: apps/web-viewer/src/studio-app-ticker-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates studio playback ticker branching for no-track, replay, and single-preview modes.
 * Usage: Called once per frame by studio-app after sprite preview rendering.
 */

import type { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import type { NameDisplayMode } from './replay-visual-policy.js';
import type { RecordedRaceData } from './replay-utils.js';
import type { CameraController } from './camera.js';
import { mapTrackPointsToCurrentLayout } from './track-layout-helpers.js';
import { resetWorldTransform } from './world-transform-utils.js';
import {
  resolveRunnerPreviewScale,
  resolveRunnerPreviewTexture
} from './studio-runner-preview-texture.js';
import { resolveTrackPreviewSizePx } from './studio-racer-pack-utils.js';
import { resolveStudioPaths, type StudioTrackEditMode } from './studio-paths.js';
import type { GeneratedRacerSpritePack } from './studio-generators.js';
import type { StudioSpritePreviewState } from './studio-sprite-preview-state.js';

interface ReplaySpriteViewLike {
  visible: boolean;
}

interface StudioReplayRacerViewLike {
  sprite: ReplaySpriteViewLike;
}

interface TickReplayModeResultLike {
  replayTimeMs: number;
  leaderboardTickMs: number;
  replayData: RecordedRaceData;
}

interface TickSinglePreviewModeResultLike {
  previewProgress: number;
  singlePreviewElapsedSeconds: number;
}

type ReplayTickCallback = {
  bivarianceHack(options: unknown): TickReplayModeResultLike;
}['bivarianceHack'];

type SinglePreviewTickCallback = {
  bivarianceHack(options: unknown): TickSinglePreviewModeResultLike;
}['bivarianceHack'];

export interface StudioAppTickerTickInput {
  dt: number;
  points: TrackPoint[];
  leftBoundaryPoints: TrackPoint[];
  rightBoundaryPoints: TrackPoint[];
  trackEditMode: StudioTrackEditMode;
  smoothingEnabled: boolean;
  replayModeEnabled: boolean;
  playingPreview: boolean;
  laneWidthPx: number;
  laneBoardsVisible: boolean;
  nameDisplayMode: NameDisplayMode;
  focusRacerNumber: number;
  replayRacers: StudioReplayRacerViewLike[];
  replayTimeMs: number;
  leaderboardTickMs: number;
  replayData: RecordedRaceData;
  replayRunId: number;
  previewProgress: number;
  singlePreviewElapsedSeconds: number;
  runnerSpeed: number;
  runner: Sprite;
  leaderboardList: HTMLElement;
  laneBoardLayer: Graphics;
  surfaceEffectLayer: Graphics;
  broadcastViewEnabled: boolean;
  camera: CameraController;
  world: Container;
  backgroundSprite: Sprite | null;
  appScreenWidth: number;
  appScreenHeight: number;
  viewWidth: number;
  viewHeight: number;
  generatedRacerPack: GeneratedRacerSpritePack | null;
  trackPreviewTextures: Texture[];
  spritePreviewState: StudioSpritePreviewState;
  defaultRunnerTexture: Texture;
  trackPreviewSizeInputValue: number;
  regenerateReplayData: () => RecordedRaceData;
  applyReplaySpriteSizeFromSlider: () => void;
  applyEditorViewTransform: () => void;
  updateStudioSurfaceEffects: (dtSec: number) => void;
  resetNoTrackTransientState: () => void;
  tickReplayMode: ReplayTickCallback;
  tickSinglePreviewMode: SinglePreviewTickCallback;
}

export interface StudioAppTickerTickResult {
  replayTimeMs: number;
  leaderboardTickMs: number;
  replayData: RecordedRaceData;
  previewProgress: number;
  singlePreviewElapsedSeconds: number;
}

export function tickStudioAppPlaybackFrame(
  input: StudioAppTickerTickInput
): StudioAppTickerTickResult {
  const runReplayMode = input.tickReplayMode;
  const runSinglePreviewMode = input.tickSinglePreviewMode;

  if (input.points.length < 3) {
    input.runner.visible = false;
    for (const rr of input.replayRacers) {
      rr.sprite.visible = false;
    }
    input.laneBoardLayer.clear();
    input.surfaceEffectLayer.clear();
    input.resetNoTrackTransientState();
    if (input.broadcastViewEnabled) {
      resetWorldTransform(input.world);
    } else {
      input.applyEditorViewTransform();
    }

    return {
      replayTimeMs: input.replayTimeMs,
      leaderboardTickMs: input.leaderboardTickMs,
      replayData: input.replayData,
      previewProgress: input.previewProgress,
      singlePreviewElapsedSeconds: input.singlePreviewElapsedSeconds
    };
  }

  const mapPointsForLayout = (sourcePoints: TrackPoint[]): TrackPoint[] => {
    if (!input.backgroundSprite || !input.broadcastViewEnabled) {
      return sourcePoints;
    }
    return mapTrackPointsToCurrentLayout(
      sourcePoints,
      input.backgroundSprite.texture.width,
      input.backgroundSprite.texture.height,
      input.viewWidth,
      input.viewHeight,
      input.appScreenWidth,
      input.appScreenHeight,
      false,
      true
    );
  };

  const {
    renderLeftBoundaryPoints,
    renderRightBoundaryPoints,
    previewPath,
    replayRacePath,
    coastEndPoint
  } = resolveStudioPaths({
    points: input.points,
    leftBoundaryPoints: input.leftBoundaryPoints,
    rightBoundaryPoints: input.rightBoundaryPoints,
    trackEditMode: input.trackEditMode,
    smoothingEnabled: input.smoothingEnabled,
    mapPointsForLayout
  });

  if (input.replayModeEnabled) {
    input.runner.visible = false;
    const replayTick = runReplayMode({
      dt: input.dt,
      playingPreview: input.playingPreview,
      replayTimeMs: input.replayTimeMs,
      leaderboardTickMs: input.leaderboardTickMs,
      replayData: input.replayData,
      replayRacers: input.replayRacers,
      laneWidthPx: input.laneWidthPx,
      laneBoardsVisible: input.laneBoardsVisible,
      racePath: replayRacePath,
      coastEndPoint,
      previewPath,
      leftBoundaryPath: renderLeftBoundaryPoints,
      rightBoundaryPath: renderRightBoundaryPoints,
      laneBoardLayer: input.laneBoardLayer,
      nameDisplayMode: input.nameDisplayMode,
      focusRacerNumber: input.focusRacerNumber,
      leaderboardList: input.leaderboardList,
      broadcastViewEnabled: input.broadcastViewEnabled,
      camera: input.camera,
      world: input.world,
      appScreenWidth: input.appScreenWidth,
      appScreenHeight: input.appScreenHeight,
      backgroundSprite: input.backgroundSprite,
      regenerateReplayData: input.regenerateReplayData,
      replayRunId: input.replayRunId
    });

    input.applyReplaySpriteSizeFromSlider();
    input.updateStudioSurfaceEffects(input.dt);

    return {
      replayTimeMs: replayTick.replayTimeMs,
      leaderboardTickMs: replayTick.leaderboardTickMs,
      replayData: replayTick.replayData,
      previewProgress: input.previewProgress,
      singlePreviewElapsedSeconds: input.singlePreviewElapsedSeconds
    };
  }

  const singleTick = runSinglePreviewMode({
    dt: input.dt,
    playingPreview: input.playingPreview,
    previewProgress: input.previewProgress,
    singlePreviewElapsedSeconds: input.singlePreviewElapsedSeconds,
    runnerSpeed: input.runnerSpeed,
    previewPath,
    runner: input.runner,
    replayRacers: input.replayRacers,
    leaderboardList: input.leaderboardList,
    laneBoardLayer: input.laneBoardLayer,
    broadcastViewEnabled: input.broadcastViewEnabled,
    camera: input.camera,
    world: input.world,
    appScreenWidth: input.appScreenWidth,
    appScreenHeight: input.appScreenHeight,
    backgroundSprite: input.backgroundSprite,
    applyEditorViewTransform: input.applyEditorViewTransform
  });

  const textureSelection = resolveRunnerPreviewTexture({
    generatedPreviewTextures: input.generatedRacerPack ? input.trackPreviewTextures : [],
    previewFrameIndex: input.spritePreviewState.frameIndex,
    defaultTexture: input.defaultRunnerTexture
  });
  const targetRunnerSizePx = resolveTrackPreviewSizePx(input.trackPreviewSizeInputValue);
  input.runner.texture = textureSelection.texture;
  input.runner.scale.set(resolveRunnerPreviewScale(textureSelection.texture, targetRunnerSizePx));

  input.updateStudioSurfaceEffects(input.dt);

  return {
    replayTimeMs: input.replayTimeMs,
    leaderboardTickMs: input.leaderboardTickMs,
    replayData: input.replayData,
    previewProgress: singleTick.previewProgress,
    singlePreviewElapsedSeconds: singleTick.singlePreviewElapsedSeconds
  };
}
