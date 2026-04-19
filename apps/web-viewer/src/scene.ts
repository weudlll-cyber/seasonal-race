/**
 * File: apps/web-viewer/src/scene.ts
 * Model: GPT-5.3-Codex
 * Purpose: Builds and manages the 9-layer PixiJS scene for a race.
 * Usage: *   const scene = await buildScene(app, manifest, effectProfile, track)
 * Dependencies: pixi.js, @sr/shared-types.
 */

import {
  Assets,
  Container,
  DisplacementFilter,
  Graphics,
  Sprite,
  TilingSprite,
  AnimatedSprite,
  Texture,
  WRAP_MODES
} from 'pixi.js';
import type { Application } from 'pixi.js';
import type {
  EffectProfile,
  RaceTypeManifest,
  TrackDefinition,
  TrackPoint
} from '@sr/shared-types';
import { interpolatePosition } from '@sr/race-engine';

// ─── Layer z-index constants (matches ARCHITECTURE.md layer table) ──────────

const Z_BACKGROUND = 0;
const Z_ENV_SURFACE = 1;
const Z_AMBIENT = 2;
const Z_OBSTACLES = 3;
const Z_RACERS = 4;
const Z_RACER_TRAILS = 5;
const Z_FINISH_LINE = 7;

// ─── Placeholder colors used when real assets are not yet available ──────────

const PLACEHOLDER_BG = 0x1a6b3c; // dark green water background
const PLACEHOLDER_ENV = 0x2288bb; // blue water surface
const PLACEHOLDER_FINISH = 0xffffff; // white finish line

export interface RacerView {
  container: Container;
  /** Update position to match normalized progress on the track. */
  setProgress(progress: number, trackPoints: TrackPoint[]): void;
}

export interface SceneHandle {
  /** The world container — attach to stage, moved by CameraController. */
  world: Container;
  /** UI overlay container — attach to stage AFTER world, NOT inside world. */
  ui: Container;
  /** Map of participantId → RacerView for per-tick position updates. */
  racers: Map<string, RacerView>;
  /** Call every animation frame with delta seconds to animate scroll/particles. */
  update(dt: number): void;
}

// ─── Public builder ──────────────────────────────────────────────────────────

/**
 * Builds the full 9-layer scene for a race.
 * Resolves textures (with placeholder fallback), constructs all containers,
 * and returns handles for per-frame updates.
 */
export async function buildScene(
  app: Application,
  manifest: RaceTypeManifest,
  effectProfile: EffectProfile,
  track: TrackDefinition,
  participantIds: string[]
): Promise<SceneHandle> {
  const world = new Container();
  const ui = new Container();

  // ── Layer 0: Background ──────────────────────────────────────────────────
  const bgTexture = await loadTextureSafe(manifest.backgroundPath, PLACEHOLDER_BG, app);
  const background = new Sprite(bgTexture);
  background.zIndex = Z_BACKGROUND;
  world.addChild(background);

  // ── Layer 1+2: Environment surface + DisplacementFilter ─────────────────
  const envTexture = await loadTextureSafe(manifest.environmentTilePath, PLACEHOLDER_ENV, app);
  const envSurface = new TilingSprite(
    envTexture,
    app.screen.width * 3, // wider than viewport so it tiles across zoomed world
    app.screen.height
  );
  envSurface.zIndex = Z_ENV_SURFACE;

  // PixiJS 8: displacement is driven by moving the sprite, not a filter offset property
  let dispSprite: Sprite | null = null;
  if (effectProfile.displacementMapPath) {
    const dispTexture = await loadTextureSafe(effectProfile.displacementMapPath, 0x888888, app);
    dispSprite = new Sprite(dispTexture);
    dispSprite.texture.baseTexture.wrapMode = WRAP_MODES.REPEAT;
    world.addChild(dispSprite);
    const dispFilter = new DisplacementFilter(dispSprite);
    dispFilter.scale.set(18, 18);
    envSurface.filters = [dispFilter];
  }
  world.addChild(envSurface);

  // ── Layer 3: Ambient particle placeholder (real emitters wired in Phase 4) ─
  const ambientLayer = new Container();
  ambientLayer.zIndex = Z_AMBIENT;
  world.addChild(ambientLayer);

  // ── Layer 4: Obstacles ────────────────────────────────────────────────────
  const obstacleLayer = new Container();
  obstacleLayer.zIndex = Z_OBSTACLES;
  for (const obs of effectProfile.obstacles) {
    const obsTexture = await loadTextureSafe(obs.spritePath, 0xee4444, app);
    const obsSprite = new Sprite(obsTexture);
    const pos = interpolatePosition(track.points, obs.progress);
    obsSprite.anchor.set(0.5);
    obsSprite.position.set(pos.x, pos.y);
    obsSprite.name = obs.label ?? '';
    obstacleLayer.addChild(obsSprite);
  }
  world.addChild(obstacleLayer);

  // ── Layer 7: Finish line ─────────────────────────────────────────────────
  const finishTexture = await loadTextureSafe(manifest.finishLinePath, PLACEHOLDER_FINISH, app);
  const finishSprite = new Sprite(finishTexture);
  finishSprite.anchor.set(0.5);
  const finishPos = interpolatePosition(track.points, 1);
  finishSprite.position.set(finishPos.x, finishPos.y);
  finishSprite.zIndex = Z_FINISH_LINE;
  world.addChild(finishSprite);

  // ── Layers 5+6: Racer sprites + trail placeholders ───────────────────────
  const racerLayer = new Container();
  racerLayer.zIndex = Z_RACERS;
  const trailLayer = new Container();
  trailLayer.zIndex = Z_RACER_TRAILS;
  world.addChild(racerLayer);
  world.addChild(trailLayer);

  const racers = new Map<string, RacerView>();
  const colors = [0xffdd00, 0xff5533, 0x33bbff, 0x55dd55, 0xee33ee, 0xff9900, 0x00ddcc, 0xffffff];

  for (let i = 0; i < participantIds.length; i += 1) {
    const id = participantIds[i]!;
    const color = colors[i % colors.length]!;

    let container: Container;
    let setProgress: (progress: number, trackPoints: TrackPoint[]) => void;

    if (i === 0) {
      // Use a public PixiJS bunny AnimatedSprite for the first racer
      // https://pixijs.io/examples/examples/assets/spritesheet/bunnies.json
      // https://pixijs.io/examples/examples/assets/spritesheet/bunnies.png
      const atlasUrl = 'https://pixijs.io/examples/examples/assets/spritesheet/bunnies.json';
      await Assets.load(atlasUrl);
      // The atlas contains frames: 'bunny1', 'bunny2', 'bunny3', 'bunny4'
      const frames = ['bunny1', 'bunny2', 'bunny3', 'bunny4'].map((name) => Texture.from(name));
      const anim = new AnimatedSprite(frames);
      anim.anchor.set(0.5);
      anim.animationSpeed = 0.18;
      anim.play();
      // Name label above racer
      const label = new Graphics();
      label.beginFill(0xffffff);
      label.drawRect(-1, -30, 2, 6);
      label.endFill();
      anim.addChild(label);
      racerLayer.addChild(anim);
      container = anim;
      setProgress = (progress: number, trackPoints: TrackPoint[]) => {
        const pos = interpolatePosition(trackPoints, progress);
        anim.position.set(pos.x, pos.y);
      };
    } else {
      // Placeholder rectangle racer
      const g = new Graphics();
      g.beginFill(color);
      g.drawRect(-16, -24, 32, 32);
      g.endFill();
      // Name label above racer
      g.beginFill(0xffffff);
      g.drawRect(-1, -30, 2, 6);
      g.endFill();
      racerLayer.addChild(g);
      container = g as unknown as Container;
      setProgress = (progress: number, trackPoints: TrackPoint[]) => {
        const pos = interpolatePosition(trackPoints, progress);
        g.position.set(pos.x, pos.y);
      };
    }

    const view: RacerView = {
      container,
      setProgress
    };
    racers.set(id, view);
  }

  // ── Sort world children by zIndex ────────────────────────────────────────
  world.sortableChildren = true;

  // ── Per-frame update closure ─────────────────────────────────────────────
  const scrollSpeed = effectProfile.environmentScrollSpeed ?? 0.3;
  let scrollOffset = 0;

  function update(dt: number): void {
    // Scroll the environment TilingSprite for moving water / dirt effect
    scrollOffset += scrollSpeed * dt * 60; // 60 = approx pixels per second at 1x scale
    envSurface.tilePosition.x = scrollOffset;

    // Move the displacement sprite so the distortion pattern scrolls (PixiJS 8 API)
    if (dispSprite) {
      dispSprite.position.x = scrollOffset * 0.4;
      dispSprite.position.y = scrollOffset * 0.2;
    }
  }

  return { world, ui, racers, update };
}

// ─── Texture loading with placeholder fallback ───────────────────────────────

/**
 * Attempts to load a texture from the given path.
 * If the path is empty, the file is missing, or loading fails,
 * returns a 64x64 solid-color placeholder texture instead.
 * This ensures the viewer always renders something during development.
 */
async function loadTextureSafe(
  path: string,
  placeholderColor: number,
  app: Application
): Promise<Texture> {
  if (!path) return makePlaceholder(placeholderColor, app);

  try {
    const texture = await Assets.load(path);
    return texture as Texture;
  } catch {
    console.warn(`[viewer] Texture not found: "${path}" — using placeholder`);
    return makePlaceholder(placeholderColor, app);
  }
}

function makePlaceholder(color: number, app: Application): Texture {
  const g = new Graphics();
  g.beginFill(color);
  g.drawRect(0, 0, 64, 64);
  g.endFill();
  return app.renderer.generateTexture(g);
}
