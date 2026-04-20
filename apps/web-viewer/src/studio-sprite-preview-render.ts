/**
 * File: apps/web-viewer/src/studio-sprite-preview-render.ts
 * Model: GPT-5.3-Codex
 * Purpose: Shared sprite-preview drawing and texture extraction helpers for studio UI.
 * Usage: Used by studio-app to keep canvas drawing logic out of orchestration flow.
 */

import { Texture } from 'pixi.js';

import type { GeneratedRacerSpritePack } from './studio-generators';
import { normalizeSpritePreviewVariantIndex } from './studio-sprite-preview-state';

export function rebuildTrackPreviewTextures(
  pack: GeneratedRacerSpritePack,
  variantIndex: number
): Texture[] {
  const variantCount = Math.max(1, pack.meta.racerVariantCount);
  const normalizedVariantIndex = normalizeSpritePreviewVariantIndex(variantIndex, variantCount);
  const textures: Texture[] = [];
  for (let frameIndex = 0; frameIndex < pack.meta.frameCount; frameIndex += 1) {
    const frameMetaIndex = normalizedVariantIndex * pack.meta.frameCount + frameIndex;
    const frame = pack.meta.frames[frameMetaIndex];
    if (!frame) continue;

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = frame.width;
    frameCanvas.height = frame.height;
    const frameCtx = frameCanvas.getContext('2d');
    if (!frameCtx) continue;

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
    textures.push(Texture.from(frameCanvas));
  }

  return textures;
}

export function drawSpritePreviewPlaceholder(
  canvas: HTMLCanvasElement,
  message: string,
  isLarge: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#071522';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(131, 165, 199, 0.22)';
  for (let x = 0; x < canvas.width; x += isLarge ? 36 : 28) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += isLarge ? 36 : 28) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  ctx.fillStyle = '#b7d5ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = isLarge ? '18px Segoe UI' : '13px Segoe UI';
  ctx.fillText(message, canvas.width * 0.5, canvas.height * 0.5);
}

export function drawSpritePreviewSingle(
  canvas: HTMLCanvasElement,
  pack: GeneratedRacerSpritePack,
  frameIndex: number,
  variantIndex: number,
  isLarge: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#071522';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const variantCount = pack.meta.racerVariantCount;
  if (variantCount <= 0) {
    drawSpritePreviewPlaceholder(canvas, 'No variants available.', isLarge);
    return;
  }

  const normalizedVariantIndex = normalizeSpritePreviewVariantIndex(variantIndex, variantCount);
  const frameMetaIndex = normalizedVariantIndex * pack.meta.frameCount + frameIndex;
  const frame = pack.meta.frames[frameMetaIndex];
  if (!frame) {
    drawSpritePreviewPlaceholder(canvas, 'Preview frame missing.', isLarge);
    return;
  }

  const targetW = Math.min(
    canvas.width * (isLarge ? 0.78 : 0.72),
    frame.width * (isLarge ? 4.4 : 3)
  );
  const targetH = (frame.height / frame.width) * targetW;
  const dx = (canvas.width - targetW) * 0.5;
  const dy = (canvas.height - targetH) * 0.55;

  ctx.fillStyle = 'rgba(8, 16, 24, 0.28)';
  ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.drawImage(
    pack.sheetCanvas,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    dx,
    dy,
    targetW,
    targetH
  );

  const variant = pack.meta.variants[normalizedVariantIndex];
  if (variant) {
    const chipWidth = isLarge ? 200 : 160;
    const chipHeight = isLarge ? 30 : 24;
    ctx.fillStyle = 'rgba(5, 16, 28, 0.8)';
    ctx.fillRect(10, 10, chipWidth, chipHeight);
    ctx.fillStyle = '#cfe5ff';
    ctx.font = isLarge ? '14px Segoe UI' : '12px Segoe UI';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Preview ${variant.label} - ${variant.pattern}`, 18, 10 + chipHeight * 0.52);
  }
}
