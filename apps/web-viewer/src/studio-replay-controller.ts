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
        rr.progress = 0;
        delete rr.finishTimeMs;
        delete rr.finishOrder;
        delete rr.finishApproachRatePerSec;
        delete rr.lockedTopFiveRank;
        delete rr.terminalCruiseRatePerSec;
        delete rr.coastEntryRatePerSec;
        delete rr.coastStartTimeMs;
        delete rr.coastStopProgress;
        delete rr.freeSwimOffsetNorm;
        delete rr.freeSwimVelocityNorm;
        delete rr.frozenX;
        delete rr.frozenY;
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
  // Coast endpoint: use the authored point directly if provided (studio-app now
  // guarantees it lies beyond the finish line). Fall back to tangent extension.
  const coastEndBasePoint = coastEndPoint ?? {
    x: endPoint.x + endTangent.x * COAST_DEFAULT_EXTEND_PX,
    y: endPoint.y + endTangent.y * COAST_DEFAULT_EXTEND_PX
  };
  // Safety: if the coast point somehow ended up behind the race path end,
  // project it forward along the tangent using the authored distance.
  const coastDot =
    (coastEndBasePoint.x - endPoint.x) * endTangent.x +
    (coastEndBasePoint.y - endPoint.y) * endTangent.y;
  const safeCoastEnd =
    coastDot > 5
      ? coastEndBasePoint
      : {
          x:
            endPoint.x +
            endTangent.x *
              Math.max(
                COAST_DEFAULT_EXTEND_PX,
                Math.hypot(coastEndBasePoint.x - endPoint.x, coastEndBasePoint.y - endPoint.y)
              ),
          y:
            endPoint.y +
            endTangent.y *
              Math.max(
                COAST_DEFAULT_EXTEND_PX,
                Math.hypot(coastEndBasePoint.x - endPoint.x, coastEndBasePoint.y - endPoint.y)
              )
        };
  const baseRaceLengthPx = computePathLength(racePath);
  const coastLengthPx = Math.max(
    1,
    Math.hypot(safeCoastEnd.x - endPoint.x, safeCoastEnd.y - endPoint.y)
  );
  const fullRunLengthPx = baseRaceLengthPx + coastLengthPx;
  const finishProgressOnFullRun = baseRaceLengthPx / Math.max(1, fullRunLengthPx);
  const fullRunPath = [...racePath, safeCoastEnd];
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
    const coastWindow = Math.max(0.0005, 1 - finishProgressOnFullRun);
    // Coast blend uses last committed progress for stable progression.
    const coastDepth = clamp01((rr.progress - finishProgressOnFullRun) / coastWindow);
    const coastLateralBlend = smoothstep(coastDepth);

    // If this racer is already frozen at its final position, skip all movement.
    if (rr.frozenX !== undefined && rr.frozenY !== undefined) {
      rr.sprite.position.set(rr.frozenX, rr.frozenY);
      // progress stays as-is
      cameraRacers.push({ progress: rr.progress, position: { x: rr.frozenX, y: rr.frozenY } });
      continue;
    }

    // Freeze guard. Coast block can force this true when coast time is complete.
    let shouldFreeze = rr.progress >= effectiveCoastStop - 0.0002;

    if (alreadyFinished || crossedFinishLine) {
      // Time-based linear-decay coast model.
      if (rr.coastEntryRatePerSec === undefined) {
        // finishApproachRatePerSec was frozen at 91% of the finish (before the
        // replay sim clips at 1.0) so it holds the true race speed.
        rr.coastEntryRatePerSec = Math.max(
          rr.finishApproachRatePerSec ?? baseProgressSpeed * 0.85,
          baseProgressSpeed * 0.7
        );
        // Backdate by one frame so the first coast tick already advances.
        rr.coastStartTimeMs = raceTimeMs - dt * 1000;
      }

      const p0 = finishProgressOnFullRun;
      const p1 = effectiveCoastStop;
      const dist = Math.max(0.0004, p1 - p0);
      const v0 = rr.coastEntryRatePerSec;
      const elapsed = Math.max(0, (raceTimeMs - (rr.coastStartTimeMs ?? raceTimeMs)) / 1000);
      const { coastFrac, currentV } = computeLinearDecayCoast(v0, dist, elapsed);
      rr.terminalCruiseRatePerSec = currentV;

      // Stop when coast time has elapsed, even if tiny integration drift remains.
      if (coastFrac >= 1) {
        shouldFreeze = true;
      }

      if (!shouldFreeze && rr.progress < effectiveCoastStop) {
        // Integrate velocity directly to avoid absolute-position jump artifacts.
        raceProgress = Math.min(p1, rr.progress + currentV * dt);
      } else {
        // Never snap to stop-progress; freeze at the current world position.
        raceProgress = rr.progress;
      }
    } else if (raceTimeMs > replayData.durationMs) {
      // If replay data ended before this racer crossed, keep pushing hard to the finish line.
      const carriedApproachRate =
        rr.finishApproachRatePerSec ?? Math.max(localRatePerSec, baseProgressSpeed * 0.82);
      rr.finishApproachRatePerSec = Math.min(
        baseProgressSpeed * 1.08,
        Math.max(baseProgressSpeed * 0.72, carriedApproachRate * 1.002)
      );
      delete rr.terminalCruiseRatePerSec;
      raceProgress = Math.min(
        finishProgressOnFullRun,
        rr.progress + rr.finishApproachRatePerSec * dt
      );
    } else {
      // Normal replay-driven phase; freeze approach rate before replay clip-at-1.0.
      const inClipZone = rawProgress >= finishProgressOnFullRun * FINISH_CLIP_FREEZE_PROGRESS;
      if (localRatePerSec > 0 && !inClipZone) {
        rr.finishApproachRatePerSec = localRatePerSec;
      } else if (rr.finishApproachRatePerSec === undefined) {
        rr.finishApproachRatePerSec = baseProgressSpeed * 0.78;
      }
      if (inClipZone && rr.finishApproachRatePerSec !== undefined) {
        // Advance at the frozen race speed; no cap at the finish line.
        raceProgress = Math.max(adjustedProgress, rr.progress + rr.finishApproachRatePerSec * dt);
      } else {
        raceProgress = adjustedProgress;
      }
    }

    // Strict monotonicity: progress must never decrease.
    raceProgress = Math.max(rr.progress, raceProgress);

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

  // --- Pixel-space collision: sprites must not overlap ---
  // Each pair is checked; overlapping sprites are pushed apart by half the
  // overlap each. Displacement is capped per frame to avoid visual jumps,
  // and fed back into the free-swim offset so steering adapts next frame.
  const racerCount = replayRacers.length;
  const spriteRadius = racerCount >= 90 ? 4 : racerCount >= 70 ? 5 : racerCount >= 45 ? 6 : 9;
  const minSep = spriteRadius * 2;
  const maxPushPerFrame = spriteRadius * 1.6;
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < racerCount; i++) {
      const a = replayRacers[i]!;
      if (a.frozenX !== undefined) continue;
      // In finish approach, suppress tangential collision push.
      const inFinishApproach = a.progress >= finishProgressOnFullRun - 0.025;
      let ax = a.sprite.position.x;
      let ay = a.sprite.position.y;
      let totalDx = 0;
      let totalDy = 0;
      for (let j = 0; j < racerCount; j++) {
        if (i === j) continue;
        const b = replayRacers[j]!;
        const bx = b.frozenX ?? b.sprite.position.x;
        const by = b.frozenY ?? b.sprite.position.y;
        const dx = ax - bx;
        const dy = ay - by;
        const inDeepCoast =
          a.progress >= finishProgressOnFullRun + 0.015 &&
          b.progress >= finishProgressOnFullRun + 0.015;
        const effectiveMinSep = minSep * (inDeepCoast ? 1.2 : 1);
        const distSq = dx * dx + dy * dy;
        if (distSq >= effectiveMinSep * effectiveMinSep) continue;
        const dist = Math.sqrt(distSq);
        if (dist < 0.01) {
          const angle = (a.index * 2.399) % (Math.PI * 2);
          totalDx += Math.cos(angle) * effectiveMinSep * 0.5;
          totalDy += Math.sin(angle) * effectiveMinSep * 0.5;
        } else {
          const overlap = effectiveMinSep - dist;
          const pushStrength = b.frozenX !== undefined ? 1.0 : 0.5;
          totalDx += (dx / dist) * overlap * pushStrength;
          totalDy += (dy / dist) * overlap * pushStrength;
        }
      }
      // Keep finish-approach collision lateral-only.
      if (inFinishApproach) {
        const coastDepthA = clamp01(
          (a.progress - finishProgressOnFullRun) / Math.max(0.0005, 1 - finishProgressOnFullRun)
        );
        const aTangent = computeTrackTangentAtProgress(fullRunPath, a.progress);
        const tangential = totalDx * aTangent.x + totalDy * aTangent.y;
        const lateralX = totalDx - tangential * aTangent.x;
        const lateralY = totalDy - tangential * aTangent.y;
        const lateralScale = lerp(0.72, 1.04, Math.max(0, coastDepthA));
        totalDx = lateralX * lateralScale;
        totalDy = lateralY * lateralScale;
      }
      const pushLen = Math.hypot(totalDx, totalDy);
      // Smoothly ramp collision push cap through finish approach.
      const finishProximity = clamp01((a.progress - (finishProgressOnFullRun - 0.025)) / 0.05);
      const coastDepthA = clamp01(
        (a.progress - finishProgressOnFullRun) / Math.max(0.0005, 1 - finishProgressOnFullRun)
      );
      const localMaxPush =
        maxPushPerFrame *
        lerp(
          1.0,
          lerp(0.36, lerp(0.55, 0.9, coastDepthA), clamp01(coastDepthA * 4)),
          finishProximity
        );
      if (pushLen > localMaxPush) {
        const scale = localMaxPush / pushLen;
        totalDx *= scale;
        totalDy *= scale;
      }
      if (pushLen > 0.01) {
        ax += totalDx;
        ay += totalDy;
        a.sprite.position.set(ax, ay);
        // Feed lateral component back into free-swim offset so steering
        // does not undo the separation on the next frame.
        const aN = computeTrackNormal(fullRunPath, a.progress);
        const lateralPx = totalDx * aN.x + totalDy * aN.y;
        const approxMaxLane = Math.max(laneWidthPx * 2.2, halfWidth * 0.995);
        const feedbackScale =
          a.progress >= finishProgressOnFullRun ? lerp(0.6, 0.95, coastDepthA) : 0.5;
        if (approxMaxLane > 0.001) {
          a.freeSwimOffsetNorm = clamp(
            (a.freeSwimOffsetNorm ?? 0) + (lateralPx / approxMaxLane) * feedbackScale,
            -0.999,
            0.999
          );
        }
      }
    }
  }
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
    if (rr.bodySprite) {
      rr.bodySprite.alpha = decision.markerAlpha;
    }
    rr.sprite.zIndex = decision.zIndex + (decision.showLabel ? 2000 : 0);

    // Labels live on a dedicated overlay layer, so keep explicit world-space placement.
    const markerRadius = Math.max(2, rr.marker.width * 0.5 * rr.sprite.scale.y);
    const labelAnchorY = rr.sprite.position.y - markerRadius - 2;
    rr.labelBg.position.set(rr.sprite.position.x, labelAnchorY);
    rr.labelText.position.set(rr.sprite.position.x, labelAnchorY);
    rr.labelBg.zIndex = rr.sprite.zIndex + 10_000;
    rr.labelText.zIndex = rr.sprite.zIndex + 10_001;
  }

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

  const uncrossedCameraRacers = finishFramingActive
    ? finishCameraRacers.filter((r) => r.progress < finishProgressOnFullRun)
    : [];

  const cameraInputRacers = preStartActive
    ? [...finishCameraRacers].sort((a, b) => b.progress - a.progress).slice(0, 6)
    : finishFramingActive && uncrossedCameraRacers.length >= 2
      ? uncrossedCameraRacers
      : spotlightTopPack
        ? [...finishCameraRacers].sort((a, b) => b.progress - a.progress).slice(0, 2)
        : finishCameraRacers;

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
    const zoomScaleMultiplier = preStartActive
      ? 2.15
      : finishFramingActive
        ? Math.min(blendedReplayZoom, 2.2)
        : spotlightTopPack
          ? Math.max(4.95, blendedReplayZoom)
          : blendedReplayZoom;

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

interface ReplayCameraBeat {
  startPhase: number;
  endPhase: number;
  zoomScale: number;
  focusTopPack: boolean;
}

interface ReplayCinematicPlan {
  beats: ReplayCameraBeat[];
  phaseOffset: number;
}

function buildReplayCinematicPlan(runId: number): ReplayCinematicPlan {
  const rng = seededRng(runId * 7919 + 17);

  const beats: ReplayCameraBeat[] = [
    createBeat(0.1 + rng() * 0.05, 0.18 + rng() * 0.04, 3.7 + rng() * 0.26, true),
    createBeat(0.36 + rng() * 0.08, 0.17 + rng() * 0.04, 1.08 + rng() * 0.08, false),
    createBeat(0.6 + rng() * 0.08, 0.18 + rng() * 0.04, 3.8 + rng() * 0.24, true)
  ];

  if (rng() > 0.55) {
    beats.push(createBeat(0.78 + rng() * 0.06, 0.14 + rng() * 0.03, 3.45 + rng() * 0.24, true));
  }

  return {
    beats: beats.sort((a, b) => a.startPhase - b.startPhase),
    phaseOffset: rng() * Math.PI * 2
  };
}

function createBeat(
  startPhase: number,
  duration: number,
  zoomScale: number,
  focusTopPack: boolean
): ReplayCameraBeat {
  const start = clamp01(startPhase);
  const end = clamp01(start + duration);
  return {
    startPhase: start,
    endPhase: Math.max(start + 0.03, end),
    zoomScale,
    focusTopPack
  };
}

function seededRng(seedInput: number): () => number {
  let seed = seedInput >>> 0;
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223;
    return (seed >>> 0) / 0xffffffff;
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothWindow(value: number, start: number, end: number): number {
  if (value <= start || value >= end) return 0;
  const t = (value - start) / Math.max(0.0001, end - start);
  const rise = smoothstep(clamp01(t / 0.78));
  const fall = smoothstep(clamp01((1 - t) / 0.78));
  return Math.min(rise, fall);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeStartLaneSlot(columnIndex: number, columns: number): number {
  if (columns <= 1) return 0;
  return clamp(((columnIndex / Math.max(1, columns - 1)) * 2 - 1) * 0.86, -0.86, 0.86);
}

function computeFreeSwimPersonalBias(racerIndex: number): number {
  const raw = Math.sin((racerIndex + 1) * 12.9898) * 43758.5453;
  const unit = raw - Math.floor(raw);
  return unit * 2 - 1;
}

function buildFrameProgressById(
  racers: Array<{ id: string; progress: number }>
): Map<string, number> {
  return new Map(racers.map((r) => [r.id, r.progress]));
}

function computeLinearDecayCoast(
  entryRatePerSec: number,
  coastDistanceNorm: number,
  elapsedSeconds: number
): { coastFrac: number; currentV: number } {
  // T = 2*dist/v0 keeps area(velocity-time) equal to coast distance.
  const coastDurationSec = Math.max(
    0.1,
    (2 * coastDistanceNorm) / Math.max(0.0001, entryRatePerSec)
  );
  const coastFrac = clamp01(elapsedSeconds / coastDurationSec);
  const currentV = entryRatePerSec * Math.max(0, 1 - coastFrac);
  return { coastFrac, currentV };
}

function mapCameraRacersToCenterline(
  racers: Array<{ progress: number; position: TrackPoint }>,
  path: TrackPoint[]
): Array<{ progress: number; position: TrackPoint }> {
  return racers.map((r) => ({
    progress: r.progress,
    position: interpolateTrackPosition(path, clamp01(r.progress))
  }));
}

function computeBoundaryHalfWidthAtProgress(
  leftBoundaryPath: TrackPoint[],
  rightBoundaryPath: TrackPoint[],
  progress: number,
  normal: TrackPoint,
  fallbackHalfWidth: number
): number {
  if (leftBoundaryPath.length < 2 || rightBoundaryPath.length < 2) {
    return fallbackHalfWidth;
  }

  const left = interpolateTrackPosition(leftBoundaryPath, clamp01(progress));
  const right = interpolateTrackPosition(rightBoundaryPath, clamp01(progress));
  const projected = Math.abs((left.x - right.x) * normal.x + (left.y - right.y) * normal.y) * 0.5;
  if (!Number.isFinite(projected) || projected < 2) {
    return fallbackHalfWidth;
  }
  return Math.max(10, projected);
}

function computeCoastStopProgress(
  finishProgressOnFullRun: number,
  crossIndex: number,
  racerCount: number,
  _racerIndex: number
): number {
  // Use almost the full authored coast zone for stop distribution.
  // First finisher stops near coast-end; later finishers progressively closer to finish.
  const coastWindow = Math.max(0.0005, 1 - finishProgressOnFullRun);
  const minStop = Math.min(0.999, finishProgressOnFullRun + coastWindow * 0.06);
  const maxStop = Math.min(0.9995, finishProgressOnFullRun + coastWindow * 0.99);
  const normalizedRank = (crossIndex - 1) / Math.max(1, racerCount - 1);
  const easedRank = Math.pow(normalizedRank, 1.12);
  const baseStop = maxStop - (maxStop - minStop) * easedRank;
  return Math.max(minStop, Math.min(maxStop, baseStop));
}

function computePathLength(points: TrackPoint[]): number {
  if (points.length < 2) return 1;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.max(1, total);
}

function computeTrackTangentAtProgress(path: TrackPoint[], progress: number): TrackPoint {
  const p0 = interpolateTrackPosition(path, clamp01(progress - 0.003));
  const p1 = interpolateTrackPosition(path, clamp01(progress + 0.003));
  return normalize(p1.x - p0.x, p1.y - p0.y);
}

function normalize(dx: number, dy: number): TrackPoint {
  const len = Math.hypot(dx, dy);
  if (len <= 0.00001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function lerpPoint(a: TrackPoint, b: TrackPoint, t: number): TrackPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function computeReplayRankScore(
  progress: number,
  finishOrder: number | undefined,
  lockedTopFiveRank: number | undefined
): number {
  if (lockedTopFiveRank !== undefined) {
    // Keep podium/top-five stable after they cross.
    return 2 - lockedTopFiveRank * 0.01;
  }

  if (finishOrder !== undefined) {
    // Remaining finishers stay below locked top-five and keep natural order among themselves.
    return 1.1 - finishOrder * 0.001;
  }

  return progress;
}
