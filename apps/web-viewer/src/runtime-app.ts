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
  resolveRuntimeRaceId
} from './runtime-bootstrap-client';
import { mapRuntimeTrackPointsToViewport, sampleRuntimeTrackPosition } from './runtime-track';

const VIEW_WIDTH = 1160;
const VIEW_HEIGHT = 720;

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

  const racer = new Graphics();
  racer.beginFill(0xffd96f);
  racer.drawCircle(0, 0, 12);
  racer.endFill();
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

  let runtimeTrackPoints = mapRuntimeTrackPointsToViewport([], VIEW_WIDTH, VIEW_HEIGHT);
  drawTrackLane(lane, runtimeTrackPoints);
  let lapDurationMs = 55_000;

  const raceId = resolveRuntimeRaceId(window.location.search);
  if (raceId) {
    const apiBase = resolveRuntimeApiBase(window.location.search);
    try {
      const bootstrap = await fetchRuntimeBootstrap(raceId, apiBase);
      runtimeTrackPoints = mapRuntimeTrackPointsToViewport(
        bootstrap.track.points,
        VIEW_WIDTH,
        VIEW_HEIGHT
      );
      drawTrackLane(lane, runtimeTrackPoints);
      lapDurationMs = Math.max(5_000, bootstrap.launch.durationMs);

      label.text = `Runtime Race ${bootstrap.raceId} | ${bootstrap.raceType} | racers: ${bootstrap.racerList.racerCount} | winners: ${bootstrap.launch.winnerCount} | duration: ${lapDurationMs}ms`;
    } catch (error) {
      label.text = `Runtime bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  let elapsedMs = 0;
  app.ticker.add((delta) => {
    elapsedMs += (delta / 60) * 1000;
    const loopProgress = (elapsedMs % lapDurationMs) / lapDurationMs;

    const p = sampleRuntimeTrackPosition(runtimeTrackPoints, loopProgress);
    racer.position.set(p.x, p.y);
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
