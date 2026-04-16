/**
 * File: apps/web-viewer/src/studio-replay-controller.ts
 * Model: GPT-5.3-Codex
 * Purpose: Encapsulates replay-mode ticker logic for studio broadcast/leaderboard/racer visuals.
 * Usage: Call on each frame when replay mode is active, then apply returned timer/data state.
 */

import type { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import type { CameraController } from './camera';
import {
  buildReplayPackLayout,
  buildReplayVisualSnapshot,
  type NameDisplayMode
} from './replay-visual-policy';
import type { RecordedRaceData } from './replay-utils';
import { sampleReplayAtTime } from './replay-utils';
import { interpolateTrackPosition } from './track-editor-utils';
import { computeTrackNormal } from './track-layout-helpers';
import { clampWorldToBackground, resetWorldTransform } from './world-transform-utils';
import { drawReplayLaneBoards, renderLeaderboardRows } from './studio-render';

export interface StudioReplayRacerView {
  id: string;
  index: number;
  sprite: Container;
  marker: Graphics;
  labelBg: Graphics;
  labelText: Text;
  progress: number;
  hovered: boolean;
}

export interface StudioReplayTickOptions {
  dt: number;
  playingPreview: boolean;
  replayTimeMs: number;
  leaderboardTickMs: number;
  replayData: RecordedRaceData;
  replayRacers: StudioReplayRacerView[];
  laneWidthPx: number;
  laneBoardsVisible: boolean;
  previewPath: TrackPoint[];
  laneBoardLayer: Graphics;
  nameDisplayMode: NameDisplayMode;
  focusRacerNumber: number;
  leaderboardList: HTMLElement;
  broadcastViewEnabled: boolean;
  camera: CameraController;
  world: Container;
  appScreenWidth: number;
  appScreenHeight: number;
  backgroundSprite: Sprite | null;
  regenerateReplayData: () => RecordedRaceData;
}

export interface StudioReplayTickResult {
  replayTimeMs: number;
  leaderboardTickMs: number;
  replayData: RecordedRaceData;
}

export function tickStudioReplayMode(options: StudioReplayTickOptions): StudioReplayTickResult {
  const {
    dt,
    playingPreview,
    laneWidthPx,
    laneBoardsVisible,
    previewPath,
    laneBoardLayer,
    nameDisplayMode,
    focusRacerNumber,
    leaderboardList,
    broadcastViewEnabled,
    camera,
    world,
    appScreenWidth,
    appScreenHeight,
    backgroundSprite,
    replayRacers,
    regenerateReplayData
  } = options;

  let replayTimeMs = options.replayTimeMs;
  let leaderboardTickMs = options.leaderboardTickMs;
  let replayData = options.replayData;

  for (const rr of replayRacers) {
    rr.sprite.visible = true;
  }

  if (playingPreview) {
    replayTimeMs += dt * 1000;
    if (replayTimeMs > replayData.durationMs) {
      replayTimeMs = 0;
      replayData = regenerateReplayData();
    }
  }

  const frame = sampleReplayAtTime(replayData, replayTimeMs);
  const elapsedSeconds = frame.timeMs / 1000;

  const packLayout = buildReplayPackLayout(replayRacers.length, laneWidthPx);
  const { columns, rowLagProgress, halfWidth } = packLayout;

  if (laneBoardsVisible) {
    drawReplayLaneBoards(previewPath, laneBoardLayer, halfWidth);
  } else {
    laneBoardLayer.clear();
  }

  const cameraRacers: Array<{ progress: number; position: TrackPoint }> = [];
  for (const rr of replayRacers) {
    const racerFrame = frame.racers.find((r) => r.id === rr.id);
    const progress = racerFrame?.progress ?? 0;
    const col = rr.index % columns;
    const row = Math.floor(rr.index / columns);
    // Apply row lag so dense formations stay readable instead of collapsing into one clump.
    const adjustedProgress = Math.max(0, progress - row * rowLagProgress);
    const pos = interpolateTrackPosition(previewPath, adjustedProgress);
    const normal = computeTrackNormal(previewPath, adjustedProgress);
    const laneOffset = (col - (columns - 1) / 2) * laneWidthPx;
    rr.sprite.position.set(pos.x + normal.x * laneOffset, pos.y + normal.y * laneOffset);
    rr.progress = adjustedProgress;
    cameraRacers.push({ progress: adjustedProgress, position: { x: pos.x, y: pos.y } });
  }

  const visualSnapshot = buildReplayVisualSnapshot(
    replayRacers.map((rr) => ({
      id: rr.id,
      index: rr.index,
      progress: rr.progress,
      hovered: rr.hovered,
      visible: rr.sprite.visible
    })),
    nameDisplayMode,
    focusRacerNumber
  );

  const decisionById = new Map(
    visualSnapshot.labelDecisions.map((decision) => [decision.id, decision])
  );
  for (const rr of replayRacers) {
    const decision = decisionById.get(rr.id);
    if (!decision) continue;
    rr.labelBg.visible = decision.showLabel;
    rr.labelText.visible = decision.showLabel;
    rr.sprite.scale.set(decision.scale);
    rr.marker.alpha = decision.markerAlpha;
    rr.sprite.zIndex = decision.zIndex;
  }

  leaderboardTickMs += dt * 1000;
  if (leaderboardTickMs >= 150) {
    renderLeaderboardRows(leaderboardList, visualSnapshot.leaderboardRows);
    leaderboardTickMs = 0;
  }

  if (broadcastViewEnabled) {
    camera.update(
      dt,
      {
        racers: cameraRacers,
        // Keep broadcast framed on race action; avoid finish overview zoom-out.
        finished: false,
        elapsedSeconds,
        cameraSettings: {
          expectedDurationMs: replayData.durationMs,
          zoomPulseCount: 3,
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
    replayTimeMs,
    leaderboardTickMs,
    replayData
  };
}
