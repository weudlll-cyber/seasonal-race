/**
 * File: apps/web-viewer/src/runtime-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs runtime race-view surface entry independent of studio authoring tools.
 * Usage: Called by the main surface dispatcher when runtime mode is selected.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import { CameraController } from './camera';
import {
  buildRuntimeAutoRacerFrame,
  clampRuntimeRacerCount,
  createRuntimeAutoRacerModels,
  resolveRuntimeRacerBehaviorPreset,
  type RuntimeRacerBehaviorPreset,
  type RuntimeAutoRacerModel
} from './runtime-racer-simulation';
import {
  resolveRuntimeLocalPackLayout,
  resolveRuntimeRenderMinimumSeparation,
  resolveRuntimeSeparationDisplacementCap,
  resolveRuntimeStableTrackLocalPose
} from './runtime-layout';
import {
  fetchRuntimeBootstrap,
  launchRuntimeRaceFromDefaults,
  resolveRuntimeApiBase,
  resolveRuntimeRaceId,
  resolveRuntimeTrackOrientation
} from './runtime-bootstrap-client';
import {
  buildSurfaceEffectSetup,
  drawSurfaceParticles,
  emitSurfaceParticles,
  poseScaleByMotionStyle,
  tickSurfaceParticles,
  type RacerSizeClass,
  type SurfaceParticle
} from './surface-effects';
import {
  buildRuntimeTrackSamplePoints,
  estimateRuntimeTrackCurvature,
  mapRuntimeTrackPointsToViewport,
  sampleRuntimeTrackPosition
} from './runtime-track';
import {
  resolveRuntimeVisualBudget,
  resolveRuntimeVisualQuality,
  type RuntimeVisualQuality
} from './runtime-visual-quality';
import {
  buildRuntimeLeaderboard,
  resolveRuntimeFocusRacer,
  resolveRuntimeRacerRank
} from './runtime-hud';
import { normalizeTrackOrientation, type TrackOrientation } from './track-orientation.js';

const VIEW_WIDTH = 1160;
const VIEW_HEIGHT = 720;
const DEFAULT_RUNTIME_RACER_COUNT = 12;
const DEFAULT_WAVE_SEGMENTS = 22;

type RuntimeCameraMode = 'overview' | 'follow';

interface RuntimeRacerView {
  model: RuntimeAutoRacerModel;
  sprite: Graphics;
  hueShiftRad: number;
  previousPosition: { x: number; y: number };
  hasPoseSample: boolean;
}

interface RuntimeWakeStreak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  size: number;
  intensity: number;
}

interface RuntimeProjectedRacerSample {
  view: RuntimeRacerView;
  frame: ReturnType<typeof buildRuntimeAutoRacerFrame>[number];
  center: { x: number; y: number };
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  previousAlongDistance: number;
  previousLateralDistance: number;
  alongDistance: number;
  lateralDistance: number;
  lateralLimit: number;
  curvature: number;
}

interface RuntimeRenderPlan {
  view: RuntimeRacerView;
  frame: ReturnType<typeof buildRuntimeAutoRacerFrame>[number];
  tangentX: number;
  tangentY: number;
  curvature: number;
  targetX: number;
  targetY: number;
  speedForEffects: number;
}

export async function startRuntimeApp(): Promise<void> {
  const mount = document.getElementById('race-canvas');
  if (!mount) throw new Error('Mount element #race-canvas not found');

  mount.innerHTML = '';

  const app = new Application({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: 0x081018,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2)
  });
  mount.appendChild(app.view as HTMLCanvasElement);

  const world = new Container();
  app.stage.addChild(world);
  const camera = new CameraController(VIEW_WIDTH, VIEW_HEIGHT);

  const waterBackdrop = new Graphics();
  world.addChild(waterBackdrop);

  const lane = new Graphics();
  world.addChild(lane);

  const waveLayer = new Graphics();
  world.addChild(waveLayer);

  const foamLayer = new Graphics();
  world.addChild(foamLayer);

  const rippleLayer = new Graphics();
  world.addChild(rippleLayer);

  const wakeLayer = new Graphics();
  world.addChild(wakeLayer);

  const particleLayer = new Graphics();
  world.addChild(particleLayer);

  const racerLayer = new Container();
  racerLayer.sortableChildren = true;
  world.addChild(racerLayer);

  const label = new Text('Runtime Surface', {
    fontFamily: 'Segoe UI',
    fontSize: 20,
    fill: 0xd6ebff,
    stroke: 0x0b2233,
    strokeThickness: 3
  });
  label.position.set(24, 18);
  app.stage.addChild(label);

  const leaderboardLabel = new Text('', {
    fontFamily: 'Consolas',
    fontSize: 16,
    fill: 0xcdeaff,
    stroke: 0x082337,
    strokeThickness: 2,
    lineHeight: 20
  });
  leaderboardLabel.position.set(VIEW_WIDTH - 360, 22);
  app.stage.addChild(leaderboardLabel);

  const focusLabel = new Text('', {
    fontFamily: 'Consolas',
    fontSize: 15,
    fill: 0xaee7ff,
    stroke: 0x072034,
    strokeThickness: 2
  });
  focusLabel.position.set(24, VIEW_HEIGHT - 38);
  app.stage.addChild(focusLabel);

  const searchParams = new URLSearchParams(window.location.search);

  let runtimeOrientation: TrackOrientation = resolveRuntimeTrackOrientation(window.location.search);
  let runtimeRaceType = 'duck';
  let runtimeRacerCount = clampRuntimeRacerCount(DEFAULT_RUNTIME_RACER_COUNT);
  let behaviorPreset: RuntimeRacerBehaviorPreset = resolveRuntimeRacerBehaviorPreset(
    searchParams.get('behavior')
  );
  let runtimeCameraMode: RuntimeCameraMode = resolveRuntimeCameraMode(searchParams.get('camera'));
  let visualQuality: RuntimeVisualQuality = resolveRuntimeVisualQuality(
    searchParams.get('quality')
  );
  let focusRacerIndex = resolveRuntimeFocusRacer(searchParams.get('focusRacer'), runtimeRacerCount);
  let runtimeRacerBaseScale = resolveRuntimeSpriteBaseScale(runtimeRacerCount);
  let runtimeModelSeed = resolveRuntimeModelSeed(null, runtimeRacerCount, behaviorPreset);
  let runtimeTrackPoints = mapRuntimeTrackPointsToViewport(
    [],
    VIEW_WIDTH,
    VIEW_HEIGHT,
    undefined,
    runtimeOrientation
  );
  const particles: SurfaceParticle[] = [];
  const wakeStreaks: RuntimeWakeStreak[] = [];
  let effectSetup = buildSurfaceEffectSetup({ raceType: runtimeRaceType });
  let autoRacerModels = createRuntimeAutoRacerModels(runtimeRacerCount, {
    behaviorPreset,
    raceSeed: runtimeModelSeed
  });
  let racerViews = buildRuntimeRacerViews(autoRacerModels, racerLayer);

  drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, 0);
  drawTrackLane(lane, runtimeTrackPoints, resolveRuntimeTrackHalfWidth(runtimeRacerCount));
  let lapDurationMs = 55_000;
  drawStartFinishMarkers(lane, runtimeTrackPoints, resolveRuntimeTrackHalfWidth(runtimeRacerCount));

  let activeRaceId = resolveRuntimeRaceId(window.location.search);
  const apiBase = resolveRuntimeApiBase(window.location.search);
  if (!activeRaceId) {
    try {
      activeRaceId = await launchRuntimeRaceFromDefaults(apiBase);
    } catch {
      // Keep preview fallback when local API is not reachable.
    }
  }

  if (activeRaceId) {
    try {
      const bootstrap = await fetchRuntimeBootstrap(activeRaceId, apiBase);
      runtimeRaceType = bootstrap.raceType;
      const requestedOrientation =
        (bootstrap.launch.options?.trackOrientation as unknown) ??
        (bootstrap.launch.options?.orientation as unknown);
      if (requestedOrientation !== undefined && requestedOrientation !== null) {
        runtimeOrientation = normalizeTrackOrientation(requestedOrientation);
      }

      runtimeTrackPoints = mapRuntimeTrackPointsToViewport(
        bootstrap.track.points,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        undefined,
        runtimeOrientation
      );
      lapDurationMs = Math.max(5_000, bootstrap.launch.durationMs);
      runtimeRacerCount = clampRuntimeRacerCount(bootstrap.racerList.racerCount);
      runtimeModelSeed = resolveRuntimeModelSeed(activeRaceId, runtimeRacerCount, behaviorPreset);
      focusRacerIndex = resolveRuntimeFocusRacer(searchParams.get('focusRacer'), runtimeRacerCount);
      runtimeRacerBaseScale = resolveRuntimeSpriteBaseScale(runtimeRacerCount);
      effectSetup = buildSurfaceEffectSetup({
        raceType: bootstrap.raceType,
        ...(bootstrap.track.effectProfileId
          ? { effectProfileId: bootstrap.track.effectProfileId }
          : {}),
        sizeClass: resolveSizeClassFromRacerCount(runtimeRacerCount)
      });
      autoRacerModels = createRuntimeAutoRacerModels(runtimeRacerCount, {
        behaviorPreset,
        raceSeed: runtimeModelSeed
      });
      racerViews = buildRuntimeRacerViews(autoRacerModels, racerLayer);

      drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, 0);
      drawTrackLane(lane, runtimeTrackPoints, resolveRuntimeTrackHalfWidth(runtimeRacerCount));
      drawStartFinishMarkers(
        lane,
        runtimeTrackPoints,
        resolveRuntimeTrackHalfWidth(runtimeRacerCount)
      );

      label.text = `Runtime ${bootstrap.raceType} | race: ${activeRaceId} | profile: ${effectSetup.profile.displayName} | orientation: ${runtimeOrientation} | racers: ${runtimeRacerCount} | behavior: ${behaviorPreset} | seed: ${runtimeModelSeed} | camera: ${runtimeCameraMode} | quality: ${visualQuality} | focus: ${focusRacerIndex === null ? 'off' : focusRacerIndex + 1} | auto-sim: on | duration: ${lapDurationMs}ms`;
    } catch (error) {
      try {
        const recoveredRaceId = await launchRuntimeRaceFromDefaults(apiBase);
        activeRaceId = recoveredRaceId;
        const recoveredBootstrap = await fetchRuntimeBootstrap(recoveredRaceId, apiBase);

        runtimeRaceType = recoveredBootstrap.raceType;
        runtimeTrackPoints = mapRuntimeTrackPointsToViewport(
          recoveredBootstrap.track.points,
          VIEW_WIDTH,
          VIEW_HEIGHT,
          undefined,
          runtimeOrientation
        );
        lapDurationMs = Math.max(5_000, recoveredBootstrap.launch.durationMs);
        runtimeRacerCount = clampRuntimeRacerCount(recoveredBootstrap.racerList.racerCount);
        runtimeModelSeed = resolveRuntimeModelSeed(recoveredRaceId, runtimeRacerCount, behaviorPreset);
        focusRacerIndex = resolveRuntimeFocusRacer(
          searchParams.get('focusRacer'),
          runtimeRacerCount
        );
        runtimeRacerBaseScale = resolveRuntimeSpriteBaseScale(runtimeRacerCount);
        effectSetup = buildSurfaceEffectSetup({
          raceType: recoveredBootstrap.raceType,
          ...(recoveredBootstrap.track.effectProfileId
            ? { effectProfileId: recoveredBootstrap.track.effectProfileId }
            : {}),
          sizeClass: resolveSizeClassFromRacerCount(runtimeRacerCount)
        });
        autoRacerModels = createRuntimeAutoRacerModels(runtimeRacerCount, {
          behaviorPreset,
          raceSeed: runtimeModelSeed
        });
        racerViews = buildRuntimeRacerViews(autoRacerModels, racerLayer);
        drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, 0);
        drawTrackLane(lane, runtimeTrackPoints, resolveRuntimeTrackHalfWidth(runtimeRacerCount));
        drawStartFinishMarkers(
          lane,
          runtimeTrackPoints,
          resolveRuntimeTrackHalfWidth(runtimeRacerCount)
        );

        label.text =
          `Runtime ${recoveredBootstrap.raceType} | race: ${recoveredRaceId} | ` +
          `auto-recovered bootstrap | orientation: ${runtimeOrientation} | racers: ${runtimeRacerCount}`;
      } catch (recoveryError) {
        const errorMessage =
          recoveryError instanceof Error ? recoveryError.message : 'unknown error';
        label.text =
          `Runtime bootstrap failed: ${errorMessage} | ` +
          `check API (${apiBase}) and raceId (${activeRaceId})`;
      }
    }
  }

  let elapsedMs = 0;
  let smoothedFrameMs = 16.7;
  app.ticker.add((delta) => {
    const dtSec = delta / 60;
    const frameMs = dtSec * 1000;
    smoothedFrameMs = smoothedFrameMs * 0.9 + frameMs * 0.1;
    elapsedMs += dtSec * 1000;
    const visualBudget = resolveRuntimeVisualBudget({
      quality: visualQuality,
      racerCount: runtimeRacerCount,
      frameMs: smoothedFrameMs
    });

    const racerFrames = buildRuntimeAutoRacerFrame(autoRacerModels, elapsedMs, lapDurationMs, {
      behaviorPreset
    });
    const topPack = buildRuntimeLeaderboard(racerFrames, 3);
    drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, elapsedMs);
    drawWaterWaves(waveLayer, runtimeTrackPoints, elapsedMs, visualBudget.waveSegments);
    drawWaterFoam(foamLayer, runtimeTrackPoints, elapsedMs, visualBudget.foamSegments);

    const rippleSeeds: Array<{
      x: number;
      y: number;
      speedNorm: number;
      curvature: number;
      phaseRad: number;
    }> = [];
    const cameraRacers: Array<
      { progress: number; position: { x: number; y: number } } | undefined
    > = [];
    const rippleStride = Math.max(
      1,
      Math.ceil(Math.max(1, racerViews.length) / Math.max(1, visualBudget.maxRippleSeeds))
    );

    const orderedViews = [...racerViews].sort((a, b) => {
      const frameA = racerFrames[a.model.index];
      const frameB = racerFrames[b.model.index];
      const progressA = frameA?.progress ?? 0;
      const progressB = frameB?.progress ?? 0;
      if (progressA === progressB) {
        return a.model.index - b.model.index;
      }
      return progressB - progressA;
    });

    const projectedSamples: RuntimeProjectedRacerSample[] = [];
    for (let index = 0; index < orderedViews.length; index += 1) {
      const view = orderedViews[index];
      if (!view) continue;
      const frame = racerFrames[view.model.index];
      if (!frame) {
        continue;
      }

      const center = sampleRuntimeTrackPosition(runtimeTrackPoints, frame.progress);
      const aheadProgress = Math.min(1, frame.progress + 0.0025);
      const behindProgress = Math.max(0, frame.progress - 0.0025);
      const ahead =
        aheadProgress > frame.progress
          ? sampleRuntimeTrackPosition(runtimeTrackPoints, aheadProgress)
          : sampleRuntimeTrackPosition(runtimeTrackPoints, behindProgress);
      const tangentX = ahead.x - center.x;
      const tangentY = ahead.y - center.y;
      const tangentLen = Math.hypot(tangentX, tangentY) || 1;
      const normalX = -tangentY / tangentLen;
      const normalY = tangentX / tangentLen;

      const laneSpread = resolveRuntimeLaneSpread(runtimeRacerBaseScale, racerViews.length);
      const trackHalfWidth = resolveRuntimeTrackHalfWidth(racerViews.length);
      const laneBias = resolveRuntimeLaneBias(view.model.index, racerViews.length);
      const lateralMix = clamp(-1, 1, frame.lateralOffset * 0.62 + laneBias * 0.38);
      const startGridOffset = resolveRuntimeStartGridOffset(
        view.model.index,
        racerViews.length,
        elapsedMs,
        frame.progress,
        laneSpread,
        tangentX / tangentLen,
        tangentY / tangentLen,
        normalX,
        normalY
      );
      const startGridAlongDistance =
        startGridOffset.x * (tangentX / tangentLen) + startGridOffset.y * (tangentY / tangentLen);
      const startGridLateralDistance = startGridOffset.x * normalX + startGridOffset.y * normalY;
      const lateralLimit = Math.max(22, trackHalfWidth - 5);
      const previousAlongDistance = view.hasPoseSample
        ? (view.previousPosition.x - center.x) * (tangentX / tangentLen) +
          (view.previousPosition.y - center.y) * (tangentY / tangentLen)
        : startGridAlongDistance;
      const previousLateralDistance = view.hasPoseSample
        ? (view.previousPosition.x - center.x) * normalX +
          (view.previousPosition.y - center.y) * normalY
        : clamp(-lateralLimit, lateralLimit, startGridLateralDistance);

      let resolvedAlongDistance = view.hasPoseSample
        ? startGridAlongDistance * 0.58 + previousAlongDistance * 0.42
        : startGridAlongDistance;
      let resolvedLateralDistance = clamp(
        -lateralLimit,
        lateralLimit,
        lateralMix * laneSpread + startGridLateralDistance
      );
      if (view.hasPoseSample) {
        resolvedLateralDistance = clamp(
          -lateralLimit,
          lateralLimit,
          previousLateralDistance * 0.38 + resolvedLateralDistance * 0.62
        );
      }

      const curvature = estimateRuntimeTrackCurvature(runtimeTrackPoints, frame.progress);
      projectedSamples.push({
        view,
        frame,
        center,
        tangentX: tangentX / tangentLen,
        tangentY: tangentY / tangentLen,
        normalX,
        normalY,
        previousAlongDistance,
        previousLateralDistance,
        alongDistance: resolvedAlongDistance,
        lateralDistance: resolvedLateralDistance,
        lateralLimit,
        curvature
      });
    }

    const resolvedSamples = resolveRuntimeLocalPackLayout(
      projectedSamples.map((sample) => ({
        id: sample.view.model.id,
        index: sample.view.model.index,
        progress: sample.frame.progress,
        centerX: sample.center.x,
        centerY: sample.center.y,
        tangentX: sample.tangentX,
        tangentY: sample.tangentY,
        normalX: sample.normalX,
        normalY: sample.normalY,
        alongDistance: sample.alongDistance,
        lateralDistance: sample.lateralDistance,
        lateralLimit: sample.lateralLimit,
        preferredLateralSign: Math.sign(sample.lateralDistance) || (sample.view.model.index % 2 === 0 ? -1 : 1)
      })),
      runtimeRacerBaseScale
    );
    const resolvedById = new Map(resolvedSamples.map((sample) => [sample.id, sample]));

    const renderPlans: RuntimeRenderPlan[] = [];
    for (let index = 0; index < projectedSamples.length; index += 1) {
      const sample = projectedSamples[index];
      if (!sample) continue;
      const { view, frame, tangentX, tangentY, curvature } = sample;
      const resolved = resolvedById.get(view.model.id);
      if (!resolved) continue;

      const stableLocalPose = view.hasPoseSample
        ? resolveRuntimeStableTrackLocalPose({
            previousAlongDistance: sample.previousAlongDistance,
            previousLateralDistance: sample.previousLateralDistance,
            targetAlongDistance: resolved.alongDistance,
            targetLateralDistance: resolved.lateralDistance,
            lateralLimit: sample.lateralLimit,
            dtSec,
            speedNorm: frame.speedNorm,
            collisionOffsetPx: Math.abs(resolved.lateralDistance - sample.lateralDistance),
            pairSeparationPressure: Math.hypot(
              resolved.alongDistance - sample.alongDistance,
              resolved.lateralDistance - sample.lateralDistance
            )
          })
        : {
            alongDistance: resolved.alongDistance,
            lateralDistance: resolved.lateralDistance
          };
      const stableTarget = {
        x:
          sample.center.x +
          sample.normalX * stableLocalPose.lateralDistance +
          sample.tangentX * stableLocalPose.alongDistance,
        y:
          sample.center.y +
          sample.normalY * stableLocalPose.lateralDistance +
          sample.tangentY * stableLocalPose.alongDistance
      };

      const stabilizedPosition = resolveRuntimeStableRacerPosition({
        target: stableTarget,
        previous: view.previousPosition,
        dtSec,
        speedNorm: frame.speedNorm,
        hasSample: view.hasPoseSample
      });
      const px = stabilizedPosition.x;
      const py = stabilizedPosition.y;
      const speedForEffects = clamp01((0.32 + frame.speedNorm * 0.68) * (1 + curvature * 0.85));

      renderPlans.push({
        view,
        frame,
        tangentX,
        tangentY,
        curvature,
        targetX: px,
        targetY: py,
        speedForEffects
      });
    }

    const separatedRenderPositions = resolveRuntimeRenderMinimumSeparation(
      renderPlans.map((plan) => ({
        id: plan.view.model.id,
        x: plan.targetX,
        y: plan.targetY,
        anchorX: plan.targetX,
        anchorY: plan.targetY,
        maxDisplacementPx: plan.view.hasPoseSample
          ? resolveRuntimeSeparationDisplacementCap(racerViews.length, runtimeRacerBaseScale)
          : 0
      })),
      runtimeRacerBaseScale
    );

    for (let index = 0; index < renderPlans.length; index += 1) {
      const plan = renderPlans[index];
      if (!plan) continue;
      const { view, frame, tangentX, tangentY, curvature, speedForEffects } = plan;
      const separated = separatedRenderPositions.get(view.model.id);
      const px = separated?.x ?? plan.targetX;
      const py = separated?.y ?? plan.targetY;

      const dx = px - view.previousPosition.x;
      const dy = py - view.previousPosition.y;
      if (view.hasPoseSample) {
        emitSurfaceParticles(particles, effectSetup, {
          x: px,
          y: py + 9,
          dx,
          dy,
          speedNorm: clamp01(speedForEffects * visualBudget.effectIntensityScale),
          dtSec,
          elapsedMs
        });

        emitWakeStreak(wakeStreaks, {
          x: px,
          y: py + 10,
          dx,
          dy,
          speedNorm: frame.speedNorm,
          curvature,
          maxWakeStreaks: visualBudget.maxWakeStreaks
        });
      }

      const pose = poseScaleByMotionStyle(
        effectSetup.motionStyle,
        elapsedMs + view.hueShiftRad * 100,
        frame.speedNorm
      );
      view.sprite.scale.set(
        pose.scaleX * runtimeRacerBaseScale * (0.92 + frame.speedNorm * 0.22),
        pose.scaleY * runtimeRacerBaseScale
      );
      view.sprite.rotation = Math.atan2(tangentY, tangentX) + pose.tiltRad;

      drawRuntimeRacerGlyph(
        view.sprite,
        effectSetup.motionStyle,
        elapsedMs / 1000 + view.hueShiftRad,
        view.model.index,
        racerViews.length,
        focusRacerIndex === view.model.index
      );
      view.sprite.position.set(px, py);
      view.sprite.zIndex = Math.round(py * 10 + frame.progress * 1000);
      cameraRacers[view.model.index] = { progress: frame.progress, position: { x: px, y: py } };

      if (index % rippleStride === 0 && rippleSeeds.length < visualBudget.maxRippleSeeds) {
        rippleSeeds.push({
          x: px,
          y: py,
          speedNorm: frame.speedNorm,
          curvature,
          phaseRad: view.hueShiftRad
        });
      }
      view.previousPosition = { x: px, y: py };
      view.hasPoseSample = true;
    }

    tickSurfaceParticles(particles, effectSetup, dtSec);
    drawSurfaceParticles(particleLayer, particles);
    tickWakeStreaks(wakeStreaks, dtSec);
    drawWakeStreaks(wakeLayer, wakeStreaks);
    drawWaterRipples(rippleLayer, rippleSeeds, elapsedMs);

    const focusCameraRacer = focusRacerIndex !== null ? cameraRacers[focusRacerIndex] : undefined;
    const cameraState = {
      racers: cameraRacers.filter(
        (entry): entry is { progress: number; position: { x: number; y: number } } =>
          entry !== undefined
      ),
      finished: false,
      elapsedSeconds: elapsedMs / 1000,
      focusWeight: focusRacerIndex === null ? 0 : 0.38,
      cameraSettings: {
        expectedDurationMs: lapDurationMs,
        zoomScaleMultiplier: visualBudget.qualityResolved === 'low' ? 0.96 : 1
      },
      ...(focusCameraRacer ? { focusRacer: focusCameraRacer } : {})
    };
    if (runtimeCameraMode === 'follow') {
      camera.update(dtSec, cameraState, world);
    } else {
      world.scale.set(1);
      world.position.set(0, 0);
    }

    leaderboardLabel.text = [
      `Top Pack (${visualBudget.qualityResolved})`,
      ...topPack.map((entry) => {
        const racerNumber = entry.racerIndex + 1;
        const gap = entry.rank === 1 ? 'lead' : `-${(entry.gapToLeader * 100).toFixed(1)}%`;
        return `#${entry.rank} R${racerNumber.toString().padStart(2, '0')} ${(entry.progress * 100).toFixed(1)}% ${gap}`;
      })
    ].join('\n');

    if (focusRacerIndex !== null) {
      const focusFrame = racerFrames[focusRacerIndex];
      const focusRank = resolveRuntimeRacerRank(racerFrames, focusRacerIndex);
      if (focusFrame && focusRank !== null) {
        focusLabel.text = `Focus R${focusRacerIndex + 1} | rank ${focusRank}/${racerFrames.length} | speed ${(focusFrame.speedNorm * 100).toFixed(0)}% | progress ${(focusFrame.progress * 100).toFixed(1)}% | camera ${runtimeCameraMode}`;
      } else {
        focusLabel.text = `Focus R${focusRacerIndex + 1} | no data`;
      }
    } else {
      focusLabel.text = 'Focus off (set ?focusRacer=number)';
    }
  });
}

function drawTrackLane(
  lane: Graphics,
  points: Array<{ x: number; y: number }>,
  halfWidth: number
): void {
  lane.clear();
  const sampledPoints = buildRuntimeTrackSamplePoints(points, 88);

  const first = sampledPoints[0];
  if (!first) {
    return;
  }

  if (sampledPoints.length < 2) {
    lane.lineStyle(6, 0x3ec4e0, 0.9);
    lane.moveTo(first.x, first.y);
    return;
  }

  const width = Math.max(30, Math.min(84, halfWidth));
  const leftEdge: Array<{ x: number; y: number }> = [];
  const rightEdge: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < sampledPoints.length; index += 1) {
    const point = sampledPoints[index];
    if (!point) continue;

    const prev = (index > 0 ? sampledPoints[index - 1] : sampledPoints[index + 1]) ?? point;
    const next =
      (index < sampledPoints.length - 1 ? sampledPoints[index + 1] : sampledPoints[index - 1]) ??
      point;
    const tangentX = next.x - prev.x;
    const tangentY = next.y - prev.y;
    const tangentLen = Math.hypot(tangentX, tangentY) || 1;
    const nx = -tangentY / tangentLen;
    const ny = tangentX / tangentLen;

    leftEdge.push({ x: point.x + nx * width, y: point.y + ny * width });
    rightEdge.push({ x: point.x - nx * width, y: point.y - ny * width });
  }

  const leftStart = leftEdge[0];
  if (!leftStart) {
    return;
  }

  lane.beginFill(0x0b3043, 0.2);
  lane.lineStyle(0);
  lane.moveTo(leftStart.x, leftStart.y);
  for (let index = 1; index < leftEdge.length; index += 1) {
    const point = leftEdge[index];
    if (!point) continue;
    lane.lineTo(point.x, point.y);
  }

  for (let index = rightEdge.length - 1; index >= 0; index -= 1) {
    const point = rightEdge[index];
    if (!point) continue;
    lane.lineTo(point.x, point.y);
  }

  lane.lineTo(leftStart.x, leftStart.y);
  lane.endFill();

  lane.beginFill(0x0f3e58, 0.54);
  lane.lineStyle(0);
  lane.moveTo(leftStart.x, leftStart.y);
  for (let index = 1; index < leftEdge.length; index += 1) {
    const point = leftEdge[index];
    if (!point) continue;
    lane.lineTo(point.x, point.y);
  }

  for (let index = rightEdge.length - 1; index >= 0; index -= 1) {
    const point = rightEdge[index];
    if (!point) continue;
    lane.lineTo(point.x, point.y);
  }

  lane.lineTo(leftStart.x, leftStart.y);
  lane.endFill();

  lane.lineStyle(8, 0x16394d, 0.28);
  const leftFirst = leftEdge[0];
  const rightFirst = rightEdge[0];
  if (leftFirst && rightFirst) {
    lane.moveTo(leftFirst.x, leftFirst.y);
    for (let index = 1; index < leftEdge.length; index += 1) {
      const point = leftEdge[index];
      if (!point) continue;
      lane.lineTo(point.x, point.y);
    }

    lane.moveTo(rightFirst.x, rightFirst.y);
    for (let index = 1; index < rightEdge.length; index += 1) {
      const point = rightEdge[index];
      if (!point) continue;
      lane.lineTo(point.x, point.y);
    }
  }

  lane.lineStyle(4.5, 0x58d7ff, 0.5);
  if (leftFirst && rightFirst) {
    lane.moveTo(leftFirst.x, leftFirst.y);
    for (let index = 1; index < leftEdge.length; index += 1) {
      const point = leftEdge[index];
      if (!point) continue;
      lane.lineTo(point.x, point.y);
    }

    lane.moveTo(rightFirst.x, rightFirst.y);
    for (let index = 1; index < rightEdge.length; index += 1) {
      const point = rightEdge[index];
      if (!point) continue;
      lane.lineTo(point.x, point.y);
    }
  }

  lane.lineStyle(10, 0x2dd1ff, 0.14);
  lane.moveTo(first.x, first.y);
  for (let index = 1; index < sampledPoints.length; index += 1) {
    const point = sampledPoints[index];
    if (!point) {
      continue;
    }
    lane.lineTo(point.x, point.y);
  }

  lane.lineStyle(5, 0x47ddff, 0.48);

  lane.moveTo(first.x, first.y);
  for (let index = 1; index < sampledPoints.length; index += 1) {
    const point = sampledPoints[index];
    if (!point) {
      continue;
    }
    lane.lineTo(point.x, point.y);
  }
}

function buildRuntimeRacerViews(
  models: RuntimeAutoRacerModel[],
  racerLayer: Container
): RuntimeRacerView[] {
  racerLayer.removeChildren();

  return models.map((model) => {
    const sprite = new Graphics();
    const hueShiftRad = ((model.index + 1) / Math.max(1, models.length)) * Math.PI * 2;
    drawRuntimeRacerGlyph(sprite, 'glide', 0, model.index, models.length);
    racerLayer.addChild(sprite);

    return {
      model,
      sprite,
      hueShiftRad,
      previousPosition: { x: 0, y: 0 },
      hasPoseSample: false
    };
  });
}

function drawStartFinishMarkers(
  lane: Graphics,
  points: Array<{ x: number; y: number }>,
  halfWidth: number
): void {
  const sampledPoints = buildRuntimeTrackSamplePoints(points, 88);
  if (sampledPoints.length < 3) {
    return;
  }

  const width = Math.max(30, Math.min(84, halfWidth));
  const start = sampledPoints[0];
  const startNext = sampledPoints[2] ?? start;
  const finish = sampledPoints[sampledPoints.length - 1] ?? start;
  const finishPrev = sampledPoints[sampledPoints.length - 3] ?? finish;
  if (!start || !startNext || !finish || !finishPrev) return;

  drawCrossLine(lane, start, startNext, width, 0x8cff90, 0.92, 5);
  drawCrossLine(lane, finishPrev, finish, width, 0xffce66, 0.92, 5);
}

function drawCrossLine(
  layer: Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  halfWidth: number,
  color: number,
  alpha: number,
  thickness: number
): void {
  const tx = to.x - from.x;
  const ty = to.y - from.y;
  const len = Math.hypot(tx, ty) || 1;
  const nx = -ty / len;
  const ny = tx / len;
  const cx = to.x;
  const cy = to.y;

  layer.lineStyle(thickness, color, alpha);
  layer.moveTo(cx + nx * halfWidth, cy + ny * halfWidth);
  layer.lineTo(cx - nx * halfWidth, cy - ny * halfWidth);
}

function drawRuntimeRacerGlyph(
  racer: Graphics,
  motionStyle: string,
  phaseSeconds: number,
  racerIndex: number,
  totalRacers: number,
  isFocused = false
): void {
  racer.clear();
  const palette = resolveRacerPalette(racerIndex, totalRacers);

  if (isFocused) {
    racer.lineStyle(2.4, 0xf4ff85, 0.95);
    racer.drawCircle(0, 0, 18);
  }

  if (motionStyle === 'gallop') {
    const stride = Math.sin(phaseSeconds * 10);
    racer.beginFill(palette.mainColor);
    racer.drawEllipse(0, 0, 14, 9);
    racer.endFill();
    racer.beginFill(palette.secondaryColor);
    racer.drawCircle(11, -6, 5);
    racer.endFill();
    racer.lineStyle(2, palette.accentColor, 0.95);
    racer.moveTo(-6, 8);
    racer.lineTo(-6 + stride * 3, 14);
    racer.moveTo(2, 8);
    racer.lineTo(2 - stride * 3, 14);
    return;
  }

  if (motionStyle === 'stomp') {
    racer.beginFill(palette.mainColor);
    racer.drawEllipse(0, 0, 16, 10);
    racer.endFill();
    racer.beginFill(palette.secondaryColor);
    racer.drawCircle(12, -4, 6);
    racer.endFill();
    return;
  }

  if (motionStyle === 'sail') {
    racer.beginFill(palette.mainColor);
    racer.drawRoundedRect(-14, 1, 28, 10, 4);
    racer.endFill();
    racer.lineStyle(2, palette.accentColor, 0.95);
    racer.moveTo(0, 1);
    racer.lineTo(0, -16);
    racer.beginFill(palette.secondaryColor, 0.85);
    racer.moveTo(0, -14);
    racer.lineTo(12, -8);
    racer.lineTo(0, -2);
    racer.lineTo(0, -14);
    racer.endFill();
    return;
  }

  if (motionStyle === 'thrust') {
    racer.beginFill(palette.mainColor);
    racer.drawPolygon([-14, -6, 12, 0, -14, 6]);
    racer.endFill();
    racer.beginFill(palette.secondaryColor, 0.9);
    racer.drawPolygon([-16, -4, -24, 0, -16, 4]);
    racer.endFill();
    return;
  }

  racer.beginFill(palette.mainColor);
  racer.drawCircle(0, 0, 11);
  racer.endFill();
  racer.beginFill(palette.secondaryColor);
  racer.drawCircle(9, -7, 5);
  racer.endFill();
  racer.beginFill(palette.accentColor);
  racer.drawPolygon([14, -7, 20, -5, 14, -3]);
  racer.endFill();
}

function drawWaterBackdrop(
  layer: Graphics,
  points: Array<{ x: number; y: number }>,
  elapsedMs: number
): void {
  layer.clear();
  layer.beginFill(0x06121e, 1);
  layer.drawRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  layer.endFill();

  const pulse = 0.08 + Math.sin(elapsedMs / 1800) * 0.03;
  layer.beginFill(0x0c2d44, 0.5 + pulse);
  layer.drawRoundedRect(20, 30, VIEW_WIDTH - 40, VIEW_HEIGHT - 60, 44);
  layer.endFill();

  // Subtle image-free shore glint ring to improve water edge readability.
  layer.lineStyle(2, 0x8fdfff, 0.2 + pulse * 0.45);
  layer.drawRoundedRect(26, 36, VIEW_WIDTH - 52, VIEW_HEIGHT - 72, 40);

  const sampledPoints = buildRuntimeTrackSamplePoints(points, 36);
  const first = sampledPoints[0];
  if (!first) {
    return;
  }

  for (let index = 0; index < sampledPoints.length; index += 4) {
    const point = sampledPoints[index];
    if (!point) continue;
    const radius = 28 + Math.sin(elapsedMs / 1500 + index * 0.4) * 6;
    layer.beginFill(0x0f3850, 0.08);
    layer.drawCircle(point.x, point.y, radius);
    layer.endFill();
  }
}

function drawWaterWaves(
  layer: Graphics,
  points: Array<{ x: number; y: number }>,
  elapsedMs: number,
  segmentCount: number
): void {
  layer.clear();
  const segments = Math.max(6, Math.min(40, segmentCount || DEFAULT_WAVE_SEGMENTS));
  const waveTime = elapsedMs / 1000;
  for (let segment = 0; segment < segments; segment += 1) {
    const tA = segment / segments;
    const tB = (segment + 1) / segments;
    const pA = sampleRuntimeTrackPosition(points, tA);
    const pB = sampleRuntimeTrackPosition(points, tB);
    const normalX = pA.y - pB.y;
    const normalY = pB.x - pA.x;
    const normalLen = Math.hypot(normalX, normalY) || 1;
    const nx = normalX / normalLen;
    const ny = normalY / normalLen;
    const waveOffsetA = Math.sin(waveTime * 2.3 + segment * 0.72) * 18;
    const waveOffsetB = Math.sin(waveTime * 2.3 + (segment + 1) * 0.72) * 18;

    layer.beginFill(0x7ed4ff, 0.08);
    layer.drawCircle(
      (pA.x + pB.x) * 0.5 + nx * ((waveOffsetA + waveOffsetB) * 0.5),
      (pA.y + pB.y) * 0.5 + ny * ((waveOffsetA + waveOffsetB) * 0.5),
      10 + Math.abs(waveOffsetA - waveOffsetB) * 0.18
    );
    layer.endFill();

    layer.beginFill(0x2f9bcc, 0.06);
    layer.drawCircle(
      (pA.x + pB.x) * 0.5 - nx * ((waveOffsetA + waveOffsetB) * 0.5),
      (pA.y + pB.y) * 0.5 - ny * ((waveOffsetA + waveOffsetB) * 0.5),
      8 + Math.abs(waveOffsetA - waveOffsetB) * 0.14
    );
    layer.endFill();
  }
}

function drawWaterFoam(
  layer: Graphics,
  points: Array<{ x: number; y: number }>,
  elapsedMs: number,
  segmentCount: number
): void {
  layer.clear();
  const segments = Math.max(4, Math.min(38, segmentCount || DEFAULT_WAVE_SEGMENTS));
  const time = elapsedMs / 1000;

  for (let segment = 0; segment < segments; segment += 1) {
    const progress = segment / segments;
    const point = sampleRuntimeTrackPosition(points, progress);
    const ahead = sampleRuntimeTrackPosition(points, (progress + 0.006) % 1);
    const tangentX = ahead.x - point.x;
    const tangentY = ahead.y - point.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const tx = tangentX / tangentLength;
    const ty = tangentY / tangentLength;
    const nx = -ty;
    const ny = tx;

    const foamJitter = Math.sin(time * 3.4 + segment * 0.94) * 8;
    const foamSize = 6 + Math.sin(time * 4.2 + segment * 1.6) * 2;
    const foamAlpha = 0.11 + (Math.sin(time * 2.8 + segment * 0.6) * 0.5 + 0.5) * 0.1;

    layer.beginFill(0xd9f7ff, foamAlpha);
    layer.drawCircle(point.x + nx * (8 + foamJitter), point.y + ny * (8 + foamJitter), foamSize);
    layer.endFill();

    layer.beginFill(0x7bd8f3, foamAlpha * 0.72);
    layer.drawCircle(
      point.x - nx * (7 + foamJitter * 0.8) + tx * foamSize * 0.2,
      point.y - ny * (7 + foamJitter * 0.8) + ty * foamSize * 0.2,
      foamSize * 0.74
    );
    layer.endFill();
  }
}

function drawWaterRipples(
  layer: Graphics,
  rippleSeeds: Array<{
    x: number;
    y: number;
    speedNorm: number;
    curvature: number;
    phaseRad: number;
  }>,
  elapsedMs: number
): void {
  layer.clear();
  const t = elapsedMs / 1000;
  for (const seed of rippleSeeds) {
    const baseRadius = 6 + seed.speedNorm * 12 + seed.curvature * 7;
    const pulse = 1 + Math.sin(t * 6 + seed.phaseRad) * 0.25;
    const radiusA = baseRadius * pulse;
    const radiusB = (baseRadius + 8) * (0.8 + pulse * 0.22);

    layer.lineStyle(1.5, 0xc5f3ff, 0.24);
    layer.drawCircle(seed.x, seed.y + 8, radiusA);
    layer.lineStyle(1, 0x7dd6f4, 0.18);
    layer.drawCircle(seed.x, seed.y + 8, radiusB);
  }
}

function emitWakeStreak(
  wakeStreaks: RuntimeWakeStreak[],
  options: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    speedNorm: number;
    curvature: number;
    maxWakeStreaks: number;
  }
): void {
  const length = Math.hypot(options.dx, options.dy) || 1;
  const tx = -options.dx / length;
  const ty = -options.dy / length;
  const strength = 0.3 + options.speedNorm * 0.7 + options.curvature * 0.45;

  wakeStreaks.push({
    x: options.x,
    y: options.y,
    vx: tx * (24 + strength * 38) + (Math.random() - 0.5) * 14,
    vy: ty * (24 + strength * 38) + (Math.random() - 0.5) * 14,
    ageMs: 0,
    lifeMs: 420 + strength * 520,
    size: 3 + strength * 5,
    intensity: strength
  });

  if (wakeStreaks.length > options.maxWakeStreaks) {
    wakeStreaks.splice(0, wakeStreaks.length - options.maxWakeStreaks);
  }
}

function tickWakeStreaks(wakeStreaks: RuntimeWakeStreak[], dtSec: number): void {
  for (let index = wakeStreaks.length - 1; index >= 0; index -= 1) {
    const streak = wakeStreaks[index];
    if (!streak) continue;

    streak.ageMs += dtSec * 1000;
    if (streak.ageMs >= streak.lifeMs) {
      wakeStreaks.splice(index, 1);
      continue;
    }

    const drag = Math.max(0, 1 - dtSec * 1.9);
    streak.vx *= drag;
    streak.vy *= drag;
    streak.x += streak.vx * dtSec;
    streak.y += streak.vy * dtSec;
  }
}

function drawWakeStreaks(layer: Graphics, wakeStreaks: RuntimeWakeStreak[]): void {
  layer.clear();
  for (const streak of wakeStreaks) {
    const life = 1 - streak.ageMs / streak.lifeMs;
    const alpha = 0.05 + life * 0.25 * streak.intensity;
    const radius = streak.size * (0.65 + life * 0.5);

    layer.lineStyle(Math.max(0.8, radius * 0.36), 0xb8f1ff, alpha);
    layer.drawCircle(streak.x, streak.y, radius);
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolveRacerPalette(
  racerIndex: number,
  totalRacers: number
): { mainColor: number; secondaryColor: number; accentColor: number } {
  const hue = (racerIndex / Math.max(1, totalRacers)) % 1;
  return {
    mainColor: hslToHex(hue, 0.68, 0.58),
    secondaryColor: hslToHex((hue + 0.08) % 1, 0.62, 0.72),
    accentColor: hslToHex((hue + 0.46) % 1, 0.74, 0.42)
  };
}

function hslToHex(h: number, s: number, l: number): number {
  const hue = ((h % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, hue + 1 / 3);
  const g = hueToRgb(p, q, hue);
  const b = hueToRgb(p, q, hue - 1 / 3);

  return (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255);
}

function hueToRgb(p: number, q: number, tInput: number): number {
  let t = tInput;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function resolveSizeClassFromRacerCount(racerCount: number): RacerSizeClass {
  if (racerCount <= 8) return 'small';
  if (racerCount <= 20) return 'medium';
  if (racerCount <= 45) return 'large';
  return 'huge';
}

function resolveRuntimeSpriteBaseScale(racerCount: number): number {
  if (racerCount <= 8) return 1.28;
  if (racerCount <= 16) return 0.98;
  if (racerCount <= 28) return 0.86;
  if (racerCount <= 45) return 0.8;
  if (racerCount <= 70) return 0.68;
  if (racerCount <= 100) return 0.58;
  return 0.52;
}

function resolveRuntimeCameraMode(value: string | null): RuntimeCameraMode {
  return value === 'follow' ? 'follow' : 'overview';
}

function resolveRuntimeModelSeed(
  raceId: string | null,
  racerCount: number,
  behaviorPreset: RuntimeRacerBehaviorPreset
): number {
  const basis = `${raceId ?? 'local'}|${racerCount}|${behaviorPreset}`;
  let hash = 2166136261;
  for (let index = 0; index < basis.length; index += 1) {
    hash ^= basis.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveRuntimeLaneBias(racerIndex: number, totalRacers: number): number {
  if (totalRacers <= 1) return 0;
  const slot = (racerIndex * 7) % totalRacers;
  return (slot / Math.max(1, totalRacers - 1)) * 2 - 1;
}

function resolveRuntimeTrackHalfWidth(racerCount: number): number {
  if (racerCount <= 10) return 86;
  if (racerCount <= 20) return 82;
  if (racerCount <= 45) return 76;
  if (racerCount <= 70) return 74;
  if (racerCount <= 100) return 72;
  return 70;
}

function resolveRuntimeLaneSpread(spriteBaseScale: number, racerCount: number): number {
  const baseLaneSpread = 24 + spriteBaseScale * 22;
  const densityBlend = clamp(0, 1, (racerCount - 48) / 52);
  return baseLaneSpread * (1 + densityBlend * 0.24);
}

function resolveRuntimeStartGridOffset(
  racerIndex: number,
  racerCount: number,
  elapsedMs: number,
  progress: number,
  laneSpread: number,
  tangentX: number,
  tangentY: number,
  normalX: number,
  normalY: number
): { x: number; y: number } {
  const columns = resolveRuntimeStartGridColumns(racerCount);
  const row = Math.floor(racerIndex / columns);
  const column = racerIndex % columns;
  const releaseStartMs = 900 + row * 280;
  const releaseDurationMs = 1700;
  const releaseTimeRatio = clamp(0, 1, (elapsedMs - releaseStartMs) / releaseDurationMs);
  const releaseProgressRatio = clamp(0, 1, (progress - row * 0.005) / 0.22);
  const fade = 1 - Math.min(releaseTimeRatio, releaseProgressRatio);
  if (fade <= 0) {
    return { x: 0, y: 0 };
  }

  const lateralSlot = columns <= 1 ? 0 : (column / (columns - 1)) * 2 - 1;
  const alongGap = (28 + laneSpread * 0.38) * row;
  const lateralGap = lateralSlot * laneSpread * 0.66;

  return {
    x: (-tangentX * alongGap + normalX * lateralGap) * fade,
    y: (-tangentY * alongGap + normalY * lateralGap) * fade
  };
}

function resolveRuntimeStartGridColumns(racerCount: number): number {
  if (racerCount <= 6) return 2;
  if (racerCount <= 15) return 3;
  return 4;
}

function resolveRuntimeStableRacerPosition(options: {
  target: { x: number; y: number };
  previous: { x: number; y: number };
  dtSec: number;
  speedNorm: number;
  hasSample: boolean;
}): { x: number; y: number } {
  if (!options.hasSample) {
    return options.target;
  }

  const safeDt = Math.max(1 / 240, Math.min(1 / 20, options.dtSec));
  const smoothing = 0.24 + options.speedNorm * 0.16;
  const blended = {
    x: options.previous.x + (options.target.x - options.previous.x) * smoothing,
    y: options.previous.y + (options.target.y - options.previous.y) * smoothing
  };

  const maxStepPerSecond = 190 + options.speedNorm * 130;
  const maxStep = maxStepPerSecond * safeDt;
  const dx = blended.x - options.previous.x;
  const dy = blended.y - options.previous.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxStep || distance === 0) {
    return blended;
  }

  const scale = maxStep / distance;
  return {
    x: options.previous.x + dx * scale,
    y: options.previous.y + dy * scale
  };
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}
