/**
 * File: apps/web-viewer/src/runtime-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs runtime race-view surface entry independent of studio authoring tools.
 * Usage: Called by the main surface dispatcher when runtime mode is selected.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import {
  buildRuntimeAutoRacerFrame,
  clampRuntimeRacerCount,
  createRuntimeAutoRacerModels,
  resolveRuntimeRacerBehaviorPreset,
  type RuntimeRacerBehaviorPreset,
  type RuntimeAutoRacerModel
} from './runtime-racer-simulation';
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
const WAVE_SEGMENTS = 22;

interface RuntimeRacerView {
  model: RuntimeAutoRacerModel;
  sprite: Graphics;
  hueShiftRad: number;
  previousProgress: number;
  previousPosition: { x: number; y: number };
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

  const waterBackdrop = new Graphics();
  world.addChild(waterBackdrop);

  const lane = new Graphics();
  world.addChild(lane);

  const waveLayer = new Graphics();
  world.addChild(waveLayer);

  const rippleLayer = new Graphics();
  world.addChild(rippleLayer);

  const particleLayer = new Graphics();
  world.addChild(particleLayer);

  const racerLayer = new Container();
  racerLayer.sortableChildren = true;
  world.addChild(racerLayer);

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
  let runtimeRacerCount = clampRuntimeRacerCount(DEFAULT_RUNTIME_RACER_COUNT);
  let behaviorPreset: RuntimeRacerBehaviorPreset = resolveRuntimeRacerBehaviorPreset(
    new URLSearchParams(window.location.search).get('behavior')
  );
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
  let autoRacerModels = createRuntimeAutoRacerModels(runtimeRacerCount, { behaviorPreset });
  let racerViews = buildRuntimeRacerViews(autoRacerModels, racerLayer);

  drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, 0);
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
      runtimeRacerCount = clampRuntimeRacerCount(bootstrap.racerList.racerCount);
      runtimeRacerBaseScale = resolveRuntimeSpriteBaseScale(runtimeRacerCount);
      effectSetup = buildSurfaceEffectSetup({
        raceType: bootstrap.raceType,
        ...(bootstrap.track.effectProfileId
          ? { effectProfileId: bootstrap.track.effectProfileId }
          : {}),
        sizeClass: resolveSizeClassFromRacerCount(runtimeRacerCount)
      });
      autoRacerModels = createRuntimeAutoRacerModels(runtimeRacerCount, { behaviorPreset });
      racerViews = buildRuntimeRacerViews(autoRacerModels, racerLayer);

      drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, 0);

      label.text = `Runtime ${bootstrap.raceType} | profile: ${effectSetup.profile.displayName} | orientation: ${runtimeOrientation} | racers: ${runtimeRacerCount} | behavior: ${behaviorPreset} | auto-sim: on | duration: ${lapDurationMs}ms`;
    } catch (error) {
      label.text = `Runtime bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  let elapsedMs = 0;
  app.ticker.add((delta) => {
    const dtSec = delta / 60;
    elapsedMs += dtSec * 1000;

    const racerFrames = buildRuntimeAutoRacerFrame(autoRacerModels, elapsedMs, lapDurationMs, {
      behaviorPreset
    });
    drawWaterBackdrop(waterBackdrop, runtimeTrackPoints, elapsedMs);
    drawWaterWaves(waveLayer, runtimeTrackPoints, elapsedMs);

    const rippleSeeds: Array<{ x: number; y: number; speedNorm: number; phaseRad: number }> = [];

    for (const view of racerViews) {
      const frame = racerFrames[view.model.index];
      if (!frame) {
        continue;
      }

      const center = sampleRuntimeTrackPosition(runtimeTrackPoints, frame.progress);
      const ahead = sampleRuntimeTrackPosition(runtimeTrackPoints, (frame.progress + 0.0025) % 1);
      const tangentX = ahead.x - center.x;
      const tangentY = ahead.y - center.y;
      const tangentLen = Math.hypot(tangentX, tangentY) || 1;
      const normalX = -tangentY / tangentLen;
      const normalY = tangentX / tangentLen;

      const laneSpread = 24 + runtimeRacerBaseScale * 22;
      const px = center.x + normalX * frame.lateralOffset * laneSpread;
      const py = center.y + normalY * frame.lateralOffset * laneSpread;

      const dx = px - view.previousPosition.x;
      const dy = py - view.previousPosition.y;
      emitSurfaceParticles(particles, effectSetup, {
        x: px,
        y: py + 9,
        dx,
        dy,
        speedNorm: 0.35 + frame.speedNorm * 0.65,
        dtSec,
        elapsedMs
      });

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
        racerViews.length
      );
      view.sprite.position.set(px, py);
      view.sprite.zIndex = Math.round(py * 10 + frame.progress * 1000);

      rippleSeeds.push({ x: px, y: py, speedNorm: frame.speedNorm, phaseRad: view.hueShiftRad });
      view.previousProgress = frame.progress;
      view.previousPosition = { x: px, y: py };
    }

    tickSurfaceParticles(particles, effectSetup, dtSec);
    drawSurfaceParticles(particleLayer, particles);
    drawWaterRipples(rippleLayer, rippleSeeds, elapsedMs);
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
      previousProgress: model.startOffset,
      previousPosition: sampleRuntimeTrackPosition([], model.startOffset)
    };
  });
}

function drawRuntimeRacerGlyph(
  racer: Graphics,
  motionStyle: string,
  phaseSeconds: number,
  racerIndex: number,
  totalRacers: number
): void {
  racer.clear();
  const palette = resolveRacerPalette(racerIndex, totalRacers);

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

  layer.lineStyle(3, 0x1b6b92, 0.42);
  const first = points[0];
  if (!first) {
    return;
  }

  layer.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    layer.lineTo(point.x, point.y);
  }
}

function drawWaterWaves(
  layer: Graphics,
  points: Array<{ x: number; y: number }>,
  elapsedMs: number
): void {
  layer.clear();
  const waveTime = elapsedMs / 1000;
  for (let segment = 0; segment < WAVE_SEGMENTS; segment += 1) {
    const tA = segment / WAVE_SEGMENTS;
    const tB = (segment + 1) / WAVE_SEGMENTS;
    const pA = sampleRuntimeTrackPosition(points, tA);
    const pB = sampleRuntimeTrackPosition(points, tB);
    const normalX = pA.y - pB.y;
    const normalY = pB.x - pA.x;
    const normalLen = Math.hypot(normalX, normalY) || 1;
    const nx = normalX / normalLen;
    const ny = normalY / normalLen;
    const waveOffsetA = Math.sin(waveTime * 2.3 + segment * 0.72) * 18;
    const waveOffsetB = Math.sin(waveTime * 2.3 + (segment + 1) * 0.72) * 18;

    layer.lineStyle(2, 0x7ed4ff, 0.22);
    layer.moveTo(pA.x + nx * waveOffsetA, pA.y + ny * waveOffsetA);
    layer.lineTo(pB.x + nx * waveOffsetB, pB.y + ny * waveOffsetB);

    layer.lineStyle(2, 0x2f9bcc, 0.2);
    layer.moveTo(pA.x - nx * waveOffsetA, pA.y - ny * waveOffsetA);
    layer.lineTo(pB.x - nx * waveOffsetB, pB.y - ny * waveOffsetB);
  }
}

function drawWaterRipples(
  layer: Graphics,
  rippleSeeds: Array<{ x: number; y: number; speedNorm: number; phaseRad: number }>,
  elapsedMs: number
): void {
  layer.clear();
  const t = elapsedMs / 1000;
  for (const seed of rippleSeeds) {
    const baseRadius = 6 + seed.speedNorm * 12;
    const pulse = 1 + Math.sin(t * 6 + seed.phaseRad) * 0.25;
    const radiusA = baseRadius * pulse;
    const radiusB = (baseRadius + 8) * (0.8 + pulse * 0.22);

    layer.lineStyle(1.5, 0xc5f3ff, 0.24);
    layer.drawCircle(seed.x, seed.y + 8, radiusA);
    layer.lineStyle(1, 0x7dd6f4, 0.18);
    layer.drawCircle(seed.x, seed.y + 8, radiusB);
  }
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
  if (racerCount <= 16) return 1.1;
  if (racerCount <= 28) return 0.94;
  if (racerCount <= 45) return 0.8;
  if (racerCount <= 70) return 0.68;
  if (racerCount <= 100) return 0.58;
  return 0.52;
}
