/**
 * File: apps/web-viewer/src/studio-replay-utils.ts
 * Model: GPT-5.3-Codex
 * Purpose: Pure helper utilities shared by studio replay controller internals.
 * Usage: Imported by studio-replay-controller for cinematic/math/path support.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { interpolateTrackPosition } from './track-editor-utils.js';
import { computeTrackNormal } from './track-layout-helpers.js';
import {
  clamp,
  clamp01,
  computePathLength,
  computeTrackTangentAtProgress,
  lerp,
  lerpPoint,
  normalize,
  smoothstep
} from './studio-replay-math.js';

export { clamp, clamp01, computeTrackTangentAtProgress, lerp, lerpPoint, normalize, smoothstep };

export interface ReplayCameraBeat {
  startPhase: number;
  endPhase: number;
  zoomScale: number;
  focusTopPack: boolean;
}

export interface ReplayCinematicPlan {
  beats: ReplayCameraBeat[];
  phaseOffset: number;
}

export function buildReplayCinematicPlan(runId: number): ReplayCinematicPlan {
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

export function smoothWindow(value: number, start: number, end: number): number {
  if (value <= start || value >= end) return 0;
  const t = (value - start) / Math.max(0.0001, end - start);
  const rise = smoothstep(clamp01(t / 0.78));
  const fall = smoothstep(clamp01((1 - t) / 0.78));
  return Math.min(rise, fall);
}

export function computeStartLaneSlot(columnIndex: number, columns: number): number {
  if (columns <= 1) return 0;
  return clamp(((columnIndex / Math.max(1, columns - 1)) * 2 - 1) * 0.86, -0.86, 0.86);
}

export function computeFreeSwimPersonalBias(racerIndex: number): number {
  const raw = Math.sin((racerIndex + 1) * 12.9898) * 43758.5453;
  const unit = raw - Math.floor(raw);
  return unit * 2 - 1;
}

export interface ReplayTransientStateRacer {
  progress: number;
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

export function resetReplayRacerTransientState(racer: ReplayTransientStateRacer): void {
  racer.progress = 0;
  delete racer.finishTimeMs;
  delete racer.finishOrder;
  delete racer.finishApproachRatePerSec;
  delete racer.lockedTopFiveRank;
  delete racer.terminalCruiseRatePerSec;
  delete racer.coastEntryRatePerSec;
  delete racer.coastStartTimeMs;
  delete racer.coastStopProgress;
  delete racer.freeSwimOffsetNorm;
  delete racer.freeSwimVelocityNorm;
  delete racer.frozenX;
  delete racer.frozenY;
}

export interface ReplayLabelDecision {
  id: string;
  showLabel: boolean;
  scale: number;
  markerAlpha: number;
  zIndex: number;
}

export interface ReplayLabelRenderable {
  id: string;
  marker: { alpha: number; width: number };
  bodySprite?: { alpha: number };
  sprite: {
    scale: { y: number; set: (value: number) => void };
    position: { x: number; y: number };
    zIndex: number;
  };
  labelBg: {
    visible: boolean;
    position: { set: (x: number, y: number) => void };
    zIndex: number;
  };
  labelText: {
    visible: boolean;
    position: { set: (x: number, y: number) => void };
    zIndex: number;
  };
}

export interface ReplayProgressRacer {
  progress: number;
  finishApproachRatePerSec?: number;
  coastEntryRatePerSec?: number;
  coastStartTimeMs?: number;
  terminalCruiseRatePerSec?: number;
}

export interface ResolveReplayRacerProgressInput {
  racer: ReplayProgressRacer;
  dt: number;
  raceTimeMs: number;
  replayDurationMs: number;
  adjustedProgress: number;
  rawProgress: number;
  baseProgressSpeed: number;
  localRatePerSec: number;
  finishProgressOnFullRun: number;
  effectiveCoastStop: number;
  alreadyFinished: boolean;
  crossedFinishLine: boolean;
  clipFreezeProgress: number;
}

export interface ResolveReplayRacerProgressResult {
  raceProgress: number;
  shouldFreeze: boolean;
  coastLateralBlend: number;
}

export function resolveReplayRacerProgress(
  input: ResolveReplayRacerProgressInput
): ResolveReplayRacerProgressResult {
  const {
    racer,
    dt,
    raceTimeMs,
    replayDurationMs,
    adjustedProgress,
    rawProgress,
    baseProgressSpeed,
    localRatePerSec,
    finishProgressOnFullRun,
    effectiveCoastStop,
    alreadyFinished,
    crossedFinishLine,
    clipFreezeProgress
  } = input;

  const coastWindow = Math.max(0.0005, 1 - finishProgressOnFullRun);
  // Coast blend uses last committed progress for stable progression.
  const coastDepth = clamp01((racer.progress - finishProgressOnFullRun) / coastWindow);
  const coastLateralBlend = smoothstep(coastDepth);

  // Freeze guard. Coast block can force this true when coast time is complete.
  let shouldFreeze = racer.progress >= effectiveCoastStop - 0.0002;
  let raceProgress = alreadyFinished ? racer.progress : adjustedProgress;

  if (alreadyFinished || crossedFinishLine) {
    // Time-based linear-decay coast model.
    if (racer.coastEntryRatePerSec === undefined) {
      // finishApproachRatePerSec was frozen at 91% of the finish (before the
      // replay sim clips at 1.0) so it holds the true race speed.
      racer.coastEntryRatePerSec = Math.max(
        racer.finishApproachRatePerSec ?? baseProgressSpeed * 0.85,
        baseProgressSpeed * 0.7
      );
      // Backdate by one frame so the first coast tick already advances.
      racer.coastStartTimeMs = raceTimeMs - dt * 1000;
    }

    const p0 = finishProgressOnFullRun;
    const p1 = effectiveCoastStop;
    const dist = Math.max(0.0004, p1 - p0);
    const v0 = racer.coastEntryRatePerSec;
    const elapsed = Math.max(0, (raceTimeMs - (racer.coastStartTimeMs ?? raceTimeMs)) / 1000);
    const { coastFrac, currentV } = computeLinearDecayCoast(v0, dist, elapsed);
    racer.terminalCruiseRatePerSec = currentV;

    // Stop when coast time has elapsed, even if tiny integration drift remains.
    if (coastFrac >= 1) {
      shouldFreeze = true;
    }

    if (!shouldFreeze && racer.progress < effectiveCoastStop) {
      // Integrate velocity directly to avoid absolute-position jump artifacts.
      raceProgress = Math.min(p1, racer.progress + currentV * dt);
    } else {
      // Never snap to stop-progress; freeze at the current world position.
      raceProgress = racer.progress;
    }
  } else if (raceTimeMs > replayDurationMs) {
    // If replay data ended before this racer crossed, keep pushing hard to the finish line.
    const carriedApproachRate =
      racer.finishApproachRatePerSec ?? Math.max(localRatePerSec, baseProgressSpeed * 0.82);
    racer.finishApproachRatePerSec = Math.min(
      baseProgressSpeed * 1.08,
      Math.max(baseProgressSpeed * 0.72, carriedApproachRate * 1.002)
    );
    delete racer.terminalCruiseRatePerSec;
    raceProgress = Math.min(
      finishProgressOnFullRun,
      racer.progress + racer.finishApproachRatePerSec * dt
    );
  } else {
    // Normal replay-driven phase; freeze approach rate before replay clip-at-1.0.
    const inClipZone = rawProgress >= finishProgressOnFullRun * clipFreezeProgress;
    if (localRatePerSec > 0 && !inClipZone) {
      racer.finishApproachRatePerSec = localRatePerSec;
    } else if (racer.finishApproachRatePerSec === undefined) {
      racer.finishApproachRatePerSec = baseProgressSpeed * 0.78;
    }
    if (inClipZone && racer.finishApproachRatePerSec !== undefined) {
      // Advance at the frozen race speed; no cap at the finish line.
      raceProgress = Math.max(
        adjustedProgress,
        racer.progress + racer.finishApproachRatePerSec * dt
      );
    } else {
      raceProgress = adjustedProgress;
    }
  }

  // Strict monotonicity: progress must never decrease.
  raceProgress = Math.max(racer.progress, raceProgress);

  return {
    raceProgress,
    shouldFreeze,
    coastLateralBlend
  };
}

export function applyReplayLabelDecisions(
  replayRacers: ReplayLabelRenderable[],
  labelDecisions: ReplayLabelDecision[]
): void {
  const decisionById = new Map(labelDecisions.map((decision) => [decision.id, decision]));
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
}

export function buildFrameProgressById(
  racers: Array<{ id: string; progress: number }>
): Map<string, number> {
  return new Map(racers.map((r) => [r.id, r.progress]));
}

export function computeLinearDecayCoast(
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

export function mapCameraRacersToCenterline(
  racers: Array<{ progress: number; position: TrackPoint }>,
  path: TrackPoint[]
): Array<{ progress: number; position: TrackPoint }> {
  return racers.map((r) => ({
    progress: r.progress,
    position: interpolateTrackPosition(path, clamp01(r.progress))
  }));
}

export interface ReplayRunPathState {
  safeCoastEnd: TrackPoint;
  fullRunPath: TrackPoint[];
  finishProgressOnFullRun: number;
}

export function buildReplayRunPathState(
  racePath: TrackPoint[],
  endPoint: TrackPoint,
  endTangent: TrackPoint,
  coastEndPoint: TrackPoint | null,
  defaultExtendPx: number
): ReplayRunPathState {
  const coastEndBasePoint = coastEndPoint ?? {
    x: endPoint.x + endTangent.x * defaultExtendPx,
    y: endPoint.y + endTangent.y * defaultExtendPx
  };
  const authoredDistance = Math.hypot(
    coastEndBasePoint.x - endPoint.x,
    coastEndBasePoint.y - endPoint.y
  );
  const coastDot =
    (coastEndBasePoint.x - endPoint.x) * endTangent.x +
    (coastEndBasePoint.y - endPoint.y) * endTangent.y;
  const safeCoastEnd =
    coastDot > 5
      ? coastEndBasePoint
      : {
          x: endPoint.x + endTangent.x * Math.max(defaultExtendPx, authoredDistance),
          y: endPoint.y + endTangent.y * Math.max(defaultExtendPx, authoredDistance)
        };
  const baseRaceLengthPx = computePathLength(racePath);
  const coastLengthPx = Math.max(
    1,
    Math.hypot(safeCoastEnd.x - endPoint.x, safeCoastEnd.y - endPoint.y)
  );
  const fullRunLengthPx = baseRaceLengthPx + coastLengthPx;
  const finishProgressOnFullRun = baseRaceLengthPx / Math.max(1, fullRunLengthPx);
  return {
    safeCoastEnd,
    fullRunPath: [...racePath, safeCoastEnd],
    finishProgressOnFullRun
  };
}

export function selectReplayCameraInputRacers(
  preStartActive: boolean,
  finishFramingActive: boolean,
  spotlightTopPack: boolean,
  finishProgressOnFullRun: number,
  finishCameraRacers: Array<{ progress: number; position: TrackPoint }>
): Array<{ progress: number; position: TrackPoint }> {
  const uncrossedCameraRacers = finishFramingActive
    ? finishCameraRacers.filter((r) => r.progress < finishProgressOnFullRun)
    : [];

  if (preStartActive) {
    return [...finishCameraRacers].sort((a, b) => b.progress - a.progress).slice(0, 6);
  }

  if (finishFramingActive && uncrossedCameraRacers.length >= 2) {
    return uncrossedCameraRacers;
  }

  if (spotlightTopPack) {
    return [...finishCameraRacers].sort((a, b) => b.progress - a.progress).slice(0, 2);
  }

  return finishCameraRacers;
}

export function resolveReplayZoomScale(
  preStartActive: boolean,
  finishFramingActive: boolean,
  spotlightTopPack: boolean,
  blendedReplayZoom: number
): number {
  if (preStartActive) {
    return 2.15;
  }
  if (finishFramingActive) {
    return Math.min(blendedReplayZoom, 2.2);
  }
  if (spotlightTopPack) {
    return Math.max(4.95, blendedReplayZoom);
  }
  return blendedReplayZoom;
}

export interface ReplayCollisionPosition {
  x: number;
  y: number;
  set: (x: number, y: number) => void;
}

export interface ReplayCollisionRacer {
  index: number;
  progress: number;
  frozenX?: number;
  frozenY?: number;
  freeSwimOffsetNorm?: number;
  sprite: {
    position: ReplayCollisionPosition;
  };
}

export function applyReplaySpriteSeparation(
  replayRacers: ReplayCollisionRacer[],
  fullRunPath: TrackPoint[],
  finishProgressOnFullRun: number,
  laneWidthPx: number,
  halfWidth: number
): void {
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
}

export function computeBoundaryHalfWidthAtProgress(
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

export function computeCoastStopProgress(
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

export function computeReplayRankScore(
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
