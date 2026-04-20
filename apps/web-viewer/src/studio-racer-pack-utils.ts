/**
 * File: apps/web-viewer/src/studio-racer-pack-utils.ts
 * Model: GPT-5.3-Codex
 * Purpose: Runtime racer-pack fallback, sprite extraction, and preview-size helpers.
 * Usage: Imported by studio-app replay/sprite preview flows.
 */

import { Sprite } from 'pixi.js';
import {
  generateRacerSpritePackFromImage,
  type GeneratedRacerSpritePack
} from './studio-generators.js';

interface ResolveRuntimeRacerPackInput {
  requiredRacerCount: number;
  generatedRacerPack: GeneratedRacerSpritePack | null;
  fallbackRuntimeRacerPack: GeneratedRacerSpritePack | null;
  fallbackRuntimeRacerPackKey: string;
  defaultRuntimePackFrameCount: number;
}

interface ResolveRuntimeRacerPackResult {
  runtimeRacerPack: GeneratedRacerSpritePack;
  fallbackRuntimeRacerPack: GeneratedRacerSpritePack | null;
  fallbackRuntimeRacerPackKey: string;
}

function buildDefaultRacerSourceImage(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for default racer source.');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(32, 35, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(41, 29, 9, 8, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#eaf3ff';
  ctx.fillRect(22, 23, 12, 6);

  ctx.fillStyle = '#111d2b';
  ctx.beginPath();
  ctx.arc(45, 27, 1.9, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

export function resolveRuntimeRacerPack(
  input: ResolveRuntimeRacerPackInput
): ResolveRuntimeRacerPackResult {
  const {
    requiredRacerCount,
    generatedRacerPack,
    fallbackRuntimeRacerPack,
    fallbackRuntimeRacerPackKey,
    defaultRuntimePackFrameCount
  } = input;

  if (generatedRacerPack) {
    return {
      runtimeRacerPack: generatedRacerPack,
      fallbackRuntimeRacerPack,
      fallbackRuntimeRacerPackKey
    };
  }

  const key = `${requiredRacerCount}`;
  if (fallbackRuntimeRacerPack && fallbackRuntimeRacerPackKey === key) {
    return {
      runtimeRacerPack: fallbackRuntimeRacerPack,
      fallbackRuntimeRacerPack,
      fallbackRuntimeRacerPackKey
    };
  }

  const defaultSourceImage = buildDefaultRacerSourceImage();
  const nextFallbackRuntimeRacerPack = generateRacerSpritePackFromImage(
    defaultSourceImage,
    defaultSourceImage.width,
    defaultSourceImage.height,
    {
      frameCount: defaultRuntimePackFrameCount,
      racerVariantCount: requiredRacerCount,
      frameDurationMs: 90,
      outputScale: 1,
      paddingPx: 6
    }
  );

  return {
    runtimeRacerPack: nextFallbackRuntimeRacerPack,
    fallbackRuntimeRacerPack: nextFallbackRuntimeRacerPack,
    fallbackRuntimeRacerPackKey: key
  };
}

export function createRacerSpriteFromPack(
  pack: GeneratedRacerSpritePack,
  racerIndex: number,
  desiredSize: number
): Sprite {
  const variantCount = Math.max(1, pack.meta.racerVariantCount);
  const variantIndex = racerIndex % variantCount;
  const frameMetaIndex = variantIndex * pack.meta.frameCount;
  const frame = pack.meta.frames[frameMetaIndex]!;

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = frame.width;
  frameCanvas.height = frame.height;
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) {
    throw new Error('Canvas 2D context unavailable for runtime racer sprite extraction.');
  }

  frameCtx.drawImage(
    pack.sheetCanvas,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height
  );

  const sprite = Sprite.from(frameCanvas);
  sprite.anchor.set(0.5);
  const scale = desiredSize / Math.max(frame.width, frame.height);
  sprite.scale.set(Math.max(0.2, scale));
  return sprite;
}

export function resolveTrackPreviewSizePx(rawValue: number): number {
  if (!Number.isFinite(rawValue)) return 34;
  return Math.max(16, Math.min(96, rawValue));
}
