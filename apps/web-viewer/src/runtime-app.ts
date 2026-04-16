/**
 * File: apps/web-viewer/src/runtime-app.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runs runtime race-view surface entry independent of studio authoring tools.
 * Usage: Called by the main surface dispatcher when runtime mode is selected.
 */

import { Application, Container, Graphics, Text } from 'pixi.js';

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
  lane.lineStyle(6, 0x3ec4e0, 0.9);
  lane.moveTo(90, 610);
  lane.bezierCurveTo(260, 420, 520, 380, 720, 210);
  lane.bezierCurveTo(830, 120, 980, 150, 1080, 80);
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

  let t = 0;
  app.ticker.add((delta) => {
    t += (delta / 60) * 0.16;
    if (t > 1) t -= 1;

    const p = sampleBezierPath(t);
    racer.position.set(p.x, p.y);
  });
}

function sampleBezierPath(t: number): { x: number; y: number } {
  if (t < 0.5) {
    const local = t * 2;
    return cubicBezier(
      { x: 90, y: 610 },
      { x: 260, y: 420 },
      { x: 520, y: 380 },
      { x: 720, y: 210 },
      local
    );
  }

  const local = (t - 0.5) * 2;
  return cubicBezier(
    { x: 720, y: 210 },
    { x: 830, y: 120 },
    { x: 980, y: 150 },
    { x: 1080, y: 80 },
    local
  );
}

function cubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  };
}
