

import { Application, Sprite } from 'pixi.js';

console.log('PixiJS main.ts wird ausgeführt');

async function main(): Promise<void> {
  const app = new Application({
    width: 400,
    height: 400,
    backgroundColor: 0x222222
  });
  const mount = document.getElementById('race-canvas');
  if (!mount) throw new Error('Mount element #race-canvas not found');
  mount.appendChild(app.view);


  // S-Kurven-Demo: Sprite (Bunny) fährt animiert über eine S-förmige Bahn
  const path = [
    { x: 50, y: 350 },
    { x: 150, y: 50 },
    { x: 250, y: 350 },
    { x: 350, y: 50 }
  ];

  function interpolate(t: number) {
    const n = path.length - 1;
    const total = n;
    const f = t * total;
    const i = Math.floor(f);
    const localT = f - i;
    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[i];
    const p2 = path[Math.min(i + 1, n)];
    const p3 = path[Math.min(i + 2, n)];
    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * localT + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * localT*localT + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * localT*localT*localT);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * localT + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * localT*localT + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * localT*localT*localT);
    return { x, y };
  }

  // Beispiel-Sprite: PixiJS-Bunny (aus public/bunny.png oder extern)
  const sprite = Sprite.from('https://pixijs.io/examples/examples/assets/bunny.png');
  sprite.anchor.set(0.5);
  app.stage.addChild(sprite);

  let t = 0;
  app.ticker.add((delta) => {
    t += 0.0015 * delta;
    if (t > 1) t = 0;
    const pos = interpolate(t);
    sprite.x = pos.x;
    sprite.y = pos.y;
  });
}

main().catch(console.error);
