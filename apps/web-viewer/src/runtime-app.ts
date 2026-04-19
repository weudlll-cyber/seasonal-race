/**
 * File: apps/web-viewer/src/runtime-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs runtime race-view surface entry independent of studio authoring tools.
 * Usage: Called by the main surface dispatcher when runtime mode is selected.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import {
  fetchRuntimeBootstrap,
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
import { mapRuntimeTrackPointsToViewport, sampleRuntimeTrackPosition } from './runtime-track';
import { normalizeTrackOrientation, type TrackOrientation } from './track-orientation.js';

const VIEW_WIDTH = 1160;
const VIEW_HEIGHT = 720;
const DEFAULT_RUNTIME_RACER_COUNT = 12;

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

  const lane = new Graphics();
  world.addChild(lane);

  const particleLayer = new Graphics();
  world.addChild(particleLayer);

  const racer = new Graphics();
  drawRuntimeRacerGlyph(racer, 'glide', 0);
  world.addChild(racer);

  const label = new Text('Runtime Surface (preview entry)', {
    fontFamily: 'Segoe UI',
    fontSize: 20,
    fill: 0xd6ebff,
    stroke: 0x0b2233,
    strokeThickness: 3
  });
  label.position.set(24, 18);
  app.stage.addChild(label);

  let runtimeOrientation: TrackOrientation = resolveRuntimeTrackOrientation(window.location.search);
  let runtimeRaceType = 'duck';
  let runtimeRacerCount = DEFAULT_RUNTIME_RACER_COUNT;
  let runtimeRacerBaseScale = resolveRuntimeSpriteBaseScale(runtimeRacerCount);
  let runtimeTrackPoints = mapRuntimeTrackPointsToViewport(
    [],
    VIEW_WIDTH,
    VIEW_HEIGHT,
    undefined,
    runtimeOrientation
  );
  const particles: SurfaceParticle[] = [];
  let effectSetup = buildSurfaceEffectSetup({ raceType: runtimeRaceType });
  drawTrackLane(lane, runtimeTrackPoints);
  let lapDurationMs = 55_000;

  const raceId = resolveRuntimeRaceId(window.location.search);
  if (raceId) {
    const apiBase = resolveRuntimeApiBase(window.location.search);
    try {
      const bootstrap = await fetchRuntimeBootstrap(raceId, apiBase);
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
      drawTrackLane(lane, runtimeTrackPoints);
      lapDurationMs = Math.max(5_000, bootstrap.launch.durationMs);
      runtimeRacerCount = Math.max(1, bootstrap.racerList.racerCount);
      runtimeRacerBaseScale = resolveRuntimeSpriteBaseScale(runtimeRacerCount);
      effectSetup = buildSurfaceEffectSetup({
        raceType: bootstrap.raceType,
        ...(bootstrap.track.effectProfileId
          ? { effectProfileId: bootstrap.track.effectProfileId }
          : {}),
        sizeClass: resolveSizeClassFromRacerCount(runtimeRacerCount)
      });

      label.text = `Runtime ${bootstrap.raceType} | profile: ${effectSetup.profile.displayName} | orientation: ${runtimeOrientation} | racers: ${runtimeRacerCount} | duration: ${lapDurationMs}ms`;
    } catch (error) {
      label.text = `Runtime bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  let elapsedMs = 0;
  let previousProgress = 0;
  let previousPosition = sampleRuntimeTrackPosition(runtimeTrackPoints, 0);
  app.ticker.add((delta) => {
    const dtSec = delta / 60;
    elapsedMs += dtSec * 1000;
    const loopProgress = (elapsedMs % lapDurationMs) / lapDurationMs;

    const p = sampleRuntimeTrackPosition(runtimeTrackPoints, loopProgress);
    const progressDelta =
      loopProgress >= previousProgress
        ? loopProgress - previousProgress
        : 1 - previousProgress + loopProgress;
    const speedNorm = Math.max(0.25, Math.min(1, progressDelta * 120));

    const dx = p.x - previousPosition.x;
    const dy = p.y - previousPosition.y;
    emitSurfaceParticles(particles, effectSetup, {
      x: p.x,
      y: p.y + 10,
      dx,
      dy,
      speedNorm,
      dtSec,
      elapsedMs
    });
    tickSurfaceParticles(particles, effectSetup, dtSec);
    drawSurfaceParticles(particleLayer, particles);

    const pose = poseScaleByMotionStyle(effectSetup.motionStyle, elapsedMs, speedNorm);
    racer.scale.set(pose.scaleX * runtimeRacerBaseScale, pose.scaleY * runtimeRacerBaseScale);
    racer.rotation = pose.tiltRad;
    drawRuntimeRacerGlyph(racer, effectSetup.motionStyle, elapsedMs / 1000);
    racer.position.set(p.x, p.y);
    previousProgress = loopProgress;
    previousPosition = p;
  });
}

function drawTrackLane(lane: Graphics, points: Array<{ x: number; y: number }>): void {
  lane.clear();
  lane.lineStyle(6, 0x3ec4e0, 0.9);

  const first = points[0];
  if (!first) {
    return;
  }

  lane.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point) {
      continue;
    }
    lane.lineTo(point.x, point.y);
  }
}

function drawRuntimeRacerGlyph(racer: Graphics, motionStyle: string, phaseSeconds: number): void {
  racer.clear();

  if (motionStyle === 'gallop') {
    const stride = Math.sin(phaseSeconds * 10);
    racer.beginFill(0xb06f3a);
    racer.drawEllipse(0, 0, 14, 9);
    racer.endFill();
    racer.beginFill(0x8b5529);
    racer.drawCircle(11, -6, 5);
    racer.endFill();
    racer.lineStyle(2, 0x50301a, 0.95);
    racer.moveTo(-6, 8);
    racer.lineTo(-6 + stride * 3, 14);
    racer.moveTo(2, 8);
    racer.lineTo(2 - stride * 3, 14);
    return;
  }

  if (motionStyle === 'stomp') {
    racer.beginFill(0x8b8b95);
    racer.drawEllipse(0, 0, 16, 10);
    racer.endFill();
    racer.beginFill(0x6f6f79);
    racer.drawCircle(12, -4, 6);
    racer.endFill();
    return;
  }

  if (motionStyle === 'sail') {
    racer.beginFill(0x4fa8d4);
    racer.drawRoundedRect(-14, 1, 28, 10, 4);
    racer.endFill();
    racer.lineStyle(2, 0xe6f2ff, 0.95);
    racer.moveTo(0, 1);
    racer.lineTo(0, -16);
    racer.beginFill(0xe6f2ff, 0.85);
    racer.moveTo(0, -14);
    racer.lineTo(12, -8);
    racer.lineTo(0, -2);
    racer.lineTo(0, -14);
    racer.endFill();
    return;
  }

  if (motionStyle === 'thrust') {
    racer.beginFill(0xbec6d8);
    racer.drawPolygon([-14, -6, 12, 0, -14, 6]);
    racer.endFill();
    racer.beginFill(0x7df4ff, 0.9);
    racer.drawPolygon([-16, -4, -24, 0, -16, 4]);
    racer.endFill();
    return;
  }

  racer.beginFill(0xffd96f);
  racer.drawCircle(0, 0, 11);
  racer.endFill();
  racer.beginFill(0xffd96f);
  racer.drawCircle(9, -7, 5);
  racer.endFill();
  racer.beginFill(0xf2913d);
  racer.drawPolygon([14, -7, 20, -5, 14, -3]);
  racer.endFill();
}

function resolveSizeClassFromRacerCount(racerCount: number): RacerSizeClass {
  if (racerCount <= 8) return 'small';
  if (racerCount <= 20) return 'medium';
  if (racerCount <= 45) return 'large';
  return 'huge';
}

function resolveRuntimeSpriteBaseScale(racerCount: number): number {
  if (racerCount <= 8) return 1.28;
  if (racerCount <= 16) return 1.1;
  if (racerCount <= 28) return 0.94;
  if (racerCount <= 45) return 0.8;
  if (racerCount <= 70) return 0.68;
  if (racerCount <= 100) return 0.58;
  return 0.52;
}
