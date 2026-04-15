import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { CameraController } from './camera';

console.log('PixiJS main.ts wird ausgeführt');

async function main(): Promise<void> {
  const app = new Application({
    width: 900,
    height: 520,
    backgroundColor: 0x222222
  });
  const mount = document.getElementById('race-canvas');
  if (!mount) throw new Error('Mount element #race-canvas not found');
  mount.appendChild(app.view as HTMLCanvasElement);

  const world = new Container();
  app.stage.addChild(world);

  const camera = new CameraController(app.screen.width, app.screen.height);

  // Draw a simple guide track for visual camera-follow testing.
  const trackGuide = new Graphics();
  trackGuide.lineStyle(10, 0x4dd0e1, 0.5);

  // S-Kurven-Demo: Sprite (Bunny) fahrt animiert uber eine S-formige Bahn
  const path = [
    { x: 80, y: 420 },
    { x: 360, y: 100 },
    { x: 720, y: 430 },
    { x: 1080, y: 90 },
    { x: 1460, y: 380 },
    { x: 1760, y: 120 }
  ];

  trackGuide.moveTo(path[0]!.x, path[0]!.y);
  for (let i = 1; i < path.length; i += 1) {
    trackGuide.lineTo(path[i]!.x, path[i]!.y);
  }
  world.addChild(trackGuide);

  function interpolate(t: number) {
    const n = path.length - 1;
    const total = n;
    const f = t * total;
    const i = Math.floor(f);
    const localT = f - i;
    const at = (index: number) => path[Math.max(0, Math.min(index, n))]!;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * localT +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * localT * localT +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * localT * localT * localT);
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * localT +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * localT * localT +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * localT * localT * localT);
    return { x, y };
  }

  // Beispiel-Sprite: PixiJS-Bunny (externes Demo-Asset)
  const sprite = Sprite.from('https://pixijs.io/examples/examples/assets/bunny.png');
  sprite.anchor.set(0.5);
  world.addChild(sprite);

  let t = 0;
  let elapsedSeconds = 0;
  app.ticker.add((delta) => {
    const dt = delta / 60;
    elapsedSeconds += dt;
    t += 0.08 * dt;
    if (t > 1) t -= 1;

    const pos = interpolate(t);
    sprite.x = pos.x;
    sprite.y = pos.y;

    camera.update(
      dt,
      {
        racers: [
          {
            progress: t,
            position: { x: pos.x, y: pos.y }
          }
        ],
        finished: false,
        elapsedSeconds,
        cameraSettings: {
          expectedDurationMs: 95_000,
          zoomPulseCount: 3,
          zoomPulseStrength: 0.14,
          introOverviewHoldSeconds: 2.2,
          introTransitionSeconds: 3.2
        }
      },
      world
    );
  });
}

main().catch(console.error);
