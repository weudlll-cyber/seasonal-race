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
import {
  drawReplayBoundaryLines,
  drawReplayFinishGuides,
  drawReplayLaneBoards,
  renderLeaderboardRows
} from './studio-render';
import {
  applyReplayLabelDecisions,
  applyReplaySpriteSeparation,
  buildReplayRunPathState,
  buildFrameProgressById,
  buildReplayCinematicPlan,
  clamp,
  clamp01,
  computeBoundaryHalfWidthAtProgress,
  computeCoastStopProgress,
  computeFreeSwimPersonalBias,
  computeReplayRankScore,
  computeStartLaneSlot,
  computeTrackTangentAtProgress,
  lerp,
  lerpPoint,
  mapCameraRacersToCenterline,
  normalize,
  resetReplayRacerTransientState,
  resolveReplayRacerProgress,
  resolveReplayZoomScale,
  selectReplayCameraInputRacers,
  smoothstep,
  smoothWindow
} from './studio-replay-utils';

const START_FORMATION_BLEND_MS = 3200;
const PRESTART_HOLD_MS = 2200;
const FINISH_WIDE_PHASE_START = 0.9;
const FINISH_COAST_MS = 12000;
const COAST_DEFAULT_EXTEND_PX = 220;
const FINISH_CLIP_FREEZE_PROGRESS = 0.91;

export interface StudioReplayRacerView {
  id: string;
  index: number;
  sprite: Container;
  marker: Graphics;
  bodySprite?: Sprite;
  bodyBaseScaleX?: number;
  bodyBaseScaleY?: number;
  labelBg: Graphics;
  labelText: Text;
  progress: number;
  hovered: boolean;
  finishTimeMs?: number;
  finishOrder?: number;
  finishApproachRatePerSec?: number;
  lockedTopFiveRank?: number;
  terminalCruiseRatePerSec?: number;
  coastEntryRatePerSec?: number;
  coastStartTimeMs?: number;
  coastStopProgress?: number;
  freeSwimOffsetNorm?: number;
  freeSwimVelocityNorm?: number;
  frozenX?: number;
  frozenY?: number;
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
  racePath: TrackPoint[];
  coastEndPoint: TrackPoint | null;
  previewPath: TrackPoint[];
  leftBoundaryPath?: TrackPoint[] | null;
  rightBoundaryPath?: TrackPoint[] | null;
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
  replayRunId: number;
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
    racePath,
    coastEndPoint,
    previewPath,
    leftBoundaryPath,
    rightBoundaryPath,
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
    regenerateReplayData,
    replayRunId
  } = options;

  let replayTimeMs = options.replayTimeMs;
  let leaderboardTickMs = options.leaderboardTickMs;
  let replayData = options.replayData;

  for (const rr of replayRacers) {
    rr.sprite.visible = true;
  }

  if (playingPreview) {
    replayTimeMs += dt * 1000;
    if (replayTimeMs > PRESTART_HOLD_MS + replayData.durationMs + FINISH_COAST_MS) {
      replayTimeMs = 0;
      replayData = regenerateReplayData();
      for (const rr of replayRacers) {
        resetReplayRacerTransientState(rr);
      }
    }
  }

  const raceTimeMs = Math.max(0, replayTimeMs - PRESTART_HOLD_MS);
  const preStartActive = replayTimeMs < PRESTART_HOLD_MS;
  const sampleTimeMs = Math.min(raceTimeMs, Math.max(0, replayData.durationMs));
  const frame = sampleReplayAtTime(replayData, sampleTimeMs);
  const frameProgressById = buildFrameProgressById(frame.racers);
  const elapsedSeconds = raceTimeMs / 1000;
  const racePhase = clamp01(raceTimeMs / replayData.durationMs);
  const cinematicPlan = buildReplayCinematicPlan(replayRunId);
  const beatResponses = cinematicPlan.beats
    .map((beat) => ({ beat, intensity: smoothWindow(racePhase, beat.startPhase, beat.endPhase) }))
    .filter((entry) => entry.intensity > 0.001);
  const focusBeatIntensity = Math.max(
    0,
    ...beatResponses.filter((entry) => entry.beat.focusTopPack).map((entry) => entry.intensity)
  );
  const spotlightTopPack = focusBeatIntensity > 0.18 && racePhase < FINISH_WIDE_PHASE_START;
  const inStartBlend = raceTimeMs < START_FORMATION_BLEND_MS;
  const startBlend = clamp01(raceTimeMs / START_FORMATION_BLEND_MS);

  const packLayout = buildReplayPackLayout(replayRacers.length, laneWidthPx);
  const { columns, rowLagProgress, halfWidth } = packLayout;

  const startPoint = interpolateTrackPosition(racePath, 0);
  const startAhead = interpolateTrackPosition(racePath, 0.01);
  const startTangent = normalize(startAhead.x - startPoint.x, startAhead.y - startPoint.y);
  const startNormal = computeTrackNormal(racePath, 0);

  const endPoint = interpolateTrackPosition(racePath, 1);
  const endBehind = interpolateTrackPosition(racePath, 0.99);
  const endTangent = normalize(endPoint.x - endBehind.x, endPoint.y - endBehind.y);
  const endNormal = computeTrackNormal(racePath, 1);
  const { safeCoastEnd, fullRunPath, finishProgressOnFullRun } = buildReplayRunPathState(
    racePath,
    endPoint,
    endTangent,
    coastEndPoint,
    COAST_DEFAULT_EXTEND_PX
  );
  const hasBoundaryPaths =
    (leftBoundaryPath?.length ?? 0) >= 2 && (rightBoundaryPath?.length ?? 0) >= 2;

  const finishHalfWidth = hasBoundaryPaths
    ? computeBoundaryHalfWidthAtProgress(
        leftBoundaryPath!,
        rightBoundaryPath!,
        1,
        endNormal,
        halfWidth
      )
    : halfWidth;

  if (laneBoardsVisible) {
    if (hasBoundaryPaths) {
      drawReplayBoundaryLines(laneBoardLayer, leftBoundaryPath!, rightBoundaryPath!);
    } else {
      drawReplayLaneBoards(previewPath, laneBoardLayer, halfWidth);
    }
  } else {
    laneBoardLayer.clear();
  }
  if (broadcastViewEnabled) {
    drawReplayFinishGuides(laneBoardLayer, endPoint, endNormal, safeCoastEnd, finishHalfWidth);
  }

  const cameraRacers: Array<{ progress: number; position: TrackPoint }> = [];
  for (const rr of replayRacers) {
    const rawProgress = clamp01(frameProgressById.get(rr.id) ?? 0) * finishProgressOnFullRun;
    const col = rr.index % columns;
    const row = Math.floor(rr.index / columns);
    // Use stronger row lag early for readability, then fade it out so late-race leaders
    // are driven by race performance rather than static index-row offsets.
    const rowLagFade = 1 - smoothstep(clamp01((racePhase - 0.04) / 0.26));
    const adjustedProgress = Math.max(0, rawProgress - row * rowLagProgress * rowLagFade * 0.45);
    const alreadyFinished = rr.finishTimeMs !== undefined;
    let raceProgress = alreadyFinished ? rr.progress : adjustedProgress;
    const baseProgressSpeed = finishProgressOnFullRun / Math.max(10, replayData.durationMs / 1000);

    // Track local rate from replay frame deltas.
    const localRatePerSec =
      adjustedProgress > rr.progress ? (adjustedProgress - rr.progress) / Math.max(0.001, dt) : 0;

    // Finish detection uses raw progress, not visual row-lag adjusted progress.
    const crossedFinishLine =
      !preStartActive &&
      (rawProgress >= finishProgressOnFullRun || rr.progress >= finishProgressOnFullRun);

    if (crossedFinishLine && rr.coastStopProgress === undefined) {
      const crossIndex =
        1 + replayRacers.filter((candidate) => candidate.coastStopProgress !== undefined).length;
      rr.coastStopProgress = computeCoastStopProgress(
        finishProgressOnFullRun,
        crossIndex,
        replayRacers.length,
        rr.index
      );
    }

    const coastStopProgress = rr.coastStopProgress ?? 1;
    const effectiveCoastStop = coastStopProgress;

    // If this racer is already frozen at its final position, skip all movement.
    if (rr.frozenX !== undefined && rr.frozenY !== undefined) {
      rr.sprite.position.set(rr.frozenX, rr.frozenY);
      // progress stays as-is
      cameraRacers.push({ progress: rr.progress, position: { x: rr.frozenX, y: rr.frozenY } });
      continue;
    }
    const progressResult = resolveReplayRacerProgress({
      racer: rr,
      dt,
      raceTimeMs,
      replayDurationMs: replayData.durationMs,
      adjustedProgress,
      rawProgress,
      baseProgressSpeed,
      localRatePerSec,
      finishProgressOnFullRun,
      effectiveCoastStop,
      alreadyFinished,
      crossedFinishLine,
      clipFreezeProgress: FINISH_CLIP_FREEZE_PROGRESS
    });
    raceProgress = progressResult.raceProgress;
    const shouldFreeze = progressResult.shouldFreeze;
    const coastLateralBlend = progressResult.coastLateralBlend;

    const pendingFinish =
      !preStartActive &&
      rr.finishTimeMs === undefined &&
      raceProgress >= effectiveCoastStop - 0.0005;
    const trackPos = interpolateTrackPosition(fullRunPath, raceProgress);
    const normal = computeTrackNormal(fullRunPath, raceProgress);
    const boundaryHalfWidthAtProgress = hasBoundaryPaths
      ? computeBoundaryHalfWidthAtProgress(
          leftBoundaryPath!,
          rightBoundaryPath!,
          raceProgress,
          normal,
          halfWidth
        )
      : halfWidth;
    const startLaneSlot = computeStartLaneSlot(col, columns);
    const personalBias = computeFreeSwimPersonalBias(rr.index);
    if (rr.freeSwimOffsetNorm === undefined) {
      rr.freeSwimOffsetNorm = startLaneSlot;
    }
    if (rr.freeSwimVelocityNorm === undefined) {
      rr.freeSwimVelocityNorm = 0;
    }

    // Keep sorted lanes at race start, then gradually release into free-swim.
    const freeSwimRelease = smoothstep(clamp01((racePhase - 0.1) / 0.28));

    // True free-swim movement: continuous steering field, no discrete lane hops.
    const waveA = Math.sin(elapsedSeconds * (0.28 + (rr.index % 11) * 0.016) + rr.index * 0.93);
    const waveB = Math.sin(elapsedSeconds * (0.46 + (rr.index % 7) * 0.014) + rr.index * 1.71);
    const finishCalmFactor =
      alreadyFinished || crossedFinishLine ? lerp(0.55, 0.22, coastLateralBlend) : 1;
    // Increased amplitudes so racers naturally reach the full track width
    // during the race (the boundary lines are fully driveable).
    const swimWander =
      (waveA * 0.28 + waveB * 0.18 + personalBias * 0.38) * freeSwimRelease * finishCalmFactor;

    const offsetNow = rr.freeSwimOffsetNorm ?? startLaneSlot;
    const freeSwimTarget = startLaneSlot * 0.22 + swimWander;
    // Always allow up to the boundary; the same clamp applies during race and coast.
    const offsetClamp = 0.999;
    let desiredOffsetNorm = clamp(
      lerp(startLaneSlot, freeSwimTarget, freeSwimRelease),
      -offsetClamp,
      offsetClamp
    );
    // In coast, collapse lateral spring force toward the current offset.
    desiredOffsetNorm = clamp(
      lerp(desiredOffsetNorm, offsetNow, smoothstep(coastLateralBlend)),
      -offsetClamp,
      offsetClamp
    );

    // Second-order lateral response (velocity + damping).
    const velocityNow = rr.freeSwimVelocityNorm ?? 0;
    // In deep coast, aggressively damp lateral motion to settle cleanly.
    const settleBlend = clamp01((coastLateralBlend - 0.8) / 0.2);
    const stiffness = (1.5 + freeSwimRelease * 1.05) * (1 - settleBlend);
    const maxAccel = (0.72 + freeSwimRelease * 1.1) * (1 - settleBlend);
    const maxVelocity = (0.2 + freeSwimRelease * 0.42) * (1 - settleBlend * 0.95);
    const dampingFactor = lerp(0.94, 0.6, settleBlend);
    const accel = clamp(
      (desiredOffsetNorm - offsetNow) * stiffness - velocityNow * 0.9,
      -maxAccel,
      maxAccel
    );
    const velocityNext = clamp(
      (velocityNow + accel * dt) * dampingFactor,
      -maxVelocity,
      maxVelocity
    );
    const offsetNext = clamp(offsetNow + velocityNext * dt, -offsetClamp, offsetClamp);
    rr.freeSwimVelocityNorm = velocityNext;
    rr.freeSwimOffsetNorm = offsetNext;

    // Use the full boundary width at all times — both during the race and rollout.
    const maxLaneOffset = Math.max(laneWidthPx * 2.2, boundaryHalfWidthAtProgress * 0.999);
    const laneOffset = clamp(offsetNext * maxLaneOffset, -maxLaneOffset, maxLaneOffset);
    rr.freeSwimOffsetNorm = maxLaneOffset > 0.0001 ? laneOffset / maxLaneOffset : 0;

    const formationPos = {
      x: startPoint.x + startTangent.x * -(row * 11 + 6) + startNormal.x * laneOffset,
      y: startPoint.y + startTangent.y * -(row * 11 + 6) + startNormal.y * laneOffset
    };

    const trackLanePos = {
      x: trackPos.x + normal.x * laneOffset,
      y: trackPos.y + normal.y * laneOffset
    };
    const trackTangent = computeTrackTangentAtProgress(fullRunPath, raceProgress);
    const earlySpreadFade = 1 - smoothstep(clamp01((racePhase - 0.08) / 0.46));
    const longitudinalSpreadPx = row * (6 + laneWidthPx * 0.55) * earlySpreadFade;
    const spreadTrackLanePos = {
      x: trackLanePos.x - trackTangent.x * longitudinalSpreadPx,
      y: trackLanePos.y - trackTangent.y * longitudinalSpreadPx
    };

    if (pendingFinish) {
      rr.finishTimeMs = raceTimeMs;
      rr.finishOrder =
        1 +
        replayRacers.filter(
          (candidate) => candidate.id !== rr.id && candidate.finishTimeMs !== undefined
        ).length;
    }

    if (crossedFinishLine && rr.lockedTopFiveRank === undefined) {
      rr.lockedTopFiveRank =
        1 + replayRacers.filter((candidate) => candidate.lockedTopFiveRank !== undefined).length;
    }

    const pos = inStartBlend
      ? lerpPoint(formationPos, spreadTrackLanePos, startBlend)
      : spreadTrackLanePos;

    // Freeze racer at this position permanently once it should stop.
    if (shouldFreeze && rr.frozenX === undefined) {
      rr.frozenX = pos.x;
      rr.frozenY = pos.y;
    }
    const finalX = rr.frozenX ?? pos.x;
    const finalY = rr.frozenY ?? pos.y;
    rr.sprite.position.set(finalX, finalY);
    rr.progress = raceProgress;
    cameraRacers.push({ progress: rr.progress, position: { x: finalX, y: finalY } });
  }

  applyReplaySpriteSeparation(
    replayRacers,
    fullRunPath,
    finishProgressOnFullRun,
    laneWidthPx,
    halfWidth
  );
  // Rebuild camera positions after separation.
  cameraRacers.length = 0;
  for (const rr of replayRacers) {
    cameraRacers.push({
      progress: rr.progress,
      position: { x: rr.sprite.position.x, y: rr.sprite.position.y }
    });
  }

  const visualSnapshot = buildReplayVisualSnapshot(
    replayRacers.map((rr) => ({
      id: rr.id,
      index: rr.index,
      progress: rr.progress,
      rankScore: computeReplayRankScore(rr.progress, rr.finishOrder, rr.lockedTopFiveRank),
      displayProgress: rr.progress,
      hovered: rr.hovered,
      visible: rr.sprite.visible
    })),
    nameDisplayMode,
    focusRacerNumber
  );
  applyReplayLabelDecisions(replayRacers, visualSnapshot.labelDecisions);

  leaderboardTickMs += dt * 1000;
  if (leaderboardTickMs >= 150) {
    renderLeaderboardRows(leaderboardList, visualSnapshot.leaderboardRows);
    leaderboardTickMs = 0;
  }

  const finishFramingActive =
    racePhase >= 0.84 && replayRacers.some((rr) => rr.progress < finishProgressOnFullRun);

  // Keep finish camera steady by using centerline positions from progress.
  const finishCameraRacers = finishFramingActive
    ? mapCameraRacersToCenterline(cameraRacers, fullRunPath)
    : cameraRacers;

  const cameraInputRacers = selectReplayCameraInputRacers(
    preStartActive,
    finishFramingActive,
    spotlightTopPack,
    finishProgressOnFullRun,
    finishCameraRacers
  );

  const cinematicDrift = Math.sin(elapsedSeconds * 0.28 + cinematicPlan.phaseOffset) * 0.06;
  const baseReplayZoom = 1.52 + cinematicDrift;
  const beatWeightTotal = beatResponses.reduce((sum, entry) => sum + entry.intensity, 0);
  const beatZoomWeighted = beatResponses.reduce(
    (sum, entry) => sum + entry.beat.zoomScale * entry.intensity,
    0
  );
  const beatZoom = beatWeightTotal > 0 ? beatZoomWeighted / beatWeightTotal : baseReplayZoom;
  const beatBlend = clamp01(beatWeightTotal);
  const blendedReplayZoom = lerp(baseReplayZoom, beatZoom, beatBlend);

  if (broadcastViewEnabled) {
    const zoomScaleMultiplier = resolveReplayZoomScale(
      preStartActive,
      finishFramingActive,
      spotlightTopPack,
      blendedReplayZoom
    );

    camera.update(
      dt,
      {
        racers: cameraInputRacers,
        // Keep finish framing controlled by zoom scale, not hard overview snap.
        finished: false,
        elapsedSeconds,
        cameraSettings: {
          expectedDurationMs: replayData.durationMs + FINISH_COAST_MS,
          zoomPulseCount: 1,
          zoomPulseStrength: 0.03,
          introOverviewHoldSeconds: 0,
          introTransitionSeconds: 0,
          zoomScaleMultiplier
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
