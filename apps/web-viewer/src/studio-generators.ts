/**
 * File: apps/web-viewer/src/studio-generators.ts
 * Model: GPT-5.3-Codex
 * Purpose: Provides auto-generation helpers for track templates and sprite sheets in studio mode.
 * Usage: Imported by studio app to support one-click content generation workflows.
 */

import type { TrackPoint } from '../../../packages/shared-types/src/index.js';
import { round3 } from './studio-editor-helpers';

export type TrackTemplateKind = 's-curve' | 'oval' | 'zigzag' | 'river-bend';

export interface GenerateTrackTemplateOptions {
  kind: TrackTemplateKind;
  controlPointCount: number;
  width: number;
  height: number;
  margin?: number;
}

export interface GeneratedSpriteFrameMeta {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number;
}

export interface GeneratedSpriteSheetMeta {
  generator: 'studio-auto-sprite-v1';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sourceWidth: number;
  sourceHeight: number;
  frames: GeneratedSpriteFrameMeta[];
}

export interface GenerateSpriteSheetOptions {
  frameCount: number;
  frameDurationMs?: number;
  outputScale?: number;
  paddingPx?: number;
}

export type RacerPatternKind = 'stripes' | 'dots' | 'chevron' | 'split';

export interface RacerVariantDescriptor {
  racerId: string;
  label: string;
  tintHex: string;
  pattern: RacerPatternKind;
}

export interface GenerateRacerSpritePackOptions extends GenerateSpriteSheetOptions {
  racerVariantCount: number;
}

export interface GeneratedRacerSpritePackMeta {
  generator: 'studio-auto-racer-pack-v1';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  racerVariantCount: number;
  sourceWidth: number;
  sourceHeight: number;
  variants: RacerVariantDescriptor[];
  frames: GeneratedSpriteFrameMeta[];
}

export interface GeneratedRacerSpritePack {
  sheetDataUrl: string;
  sheetCanvas: HTMLCanvasElement;
  meta: GeneratedRacerSpritePackMeta;
}

export interface GeneratedSpriteSheet {
  sheetDataUrl: string;
  sheetCanvas: HTMLCanvasElement;
  meta: GeneratedSpriteSheetMeta;
}

const PATTERN_SEQUENCE: RacerPatternKind[] = ['stripes', 'dots', 'chevron', 'split'];

export function generateTrackTemplate(options: GenerateTrackTemplateOptions): TrackPoint[] {
  const width = Math.max(200, options.width);
  const height = Math.max(200, options.height);
  const margin = Math.max(20, options.margin ?? 80);
  const pointCount = Math.max(3, Math.min(40, Math.floor(options.controlPointCount)));
  const points: TrackPoint[] = [];

  for (let i = 0; i < pointCount; i += 1) {
    const t = pointCount === 1 ? 0 : i / (pointCount - 1);

    let x = margin + t * (width - margin * 2);
    let y = height * 0.5;

    if (options.kind === 's-curve') {
      const a = (height - margin * 2) * 0.28;
      y = height * 0.5 + Math.sin(t * Math.PI * 2) * a * (0.85 + 0.15 * Math.cos(t * Math.PI));
    } else if (options.kind === 'oval') {
      const angle = t * Math.PI * 2;
      const rx = (width - margin * 2) * 0.48;
      const ry = (height - margin * 2) * 0.34;
      x = width * 0.5 + Math.cos(angle) * rx;
      y = height * 0.5 + Math.sin(angle) * ry;
    } else if (options.kind === 'zigzag') {
      const steps = Math.max(2, Math.floor(pointCount / 2));
      const segmentT = t * steps;
      const wave = segmentT - Math.floor(segmentT);
      const zig = wave < 0.5 ? wave * 2 : (1 - wave) * 2;
      const range = (height - margin * 2) * 0.42;
      y = margin + zig * range;
    } else {
      const base = Math.sin(t * Math.PI * 1.5) * 0.25 + Math.sin(t * Math.PI * 4) * 0.08;
      y = height * 0.5 + base * (height - margin * 2);
      x = margin + (t + Math.sin(t * Math.PI * 2) * 0.03) * (width - margin * 2);
    }

    points.push({
      x: round3(clamp(x, margin, width - margin)),
      y: round3(clamp(y, margin, height - margin))
    });
  }

  return points;
}

export function generateSpriteSheetFromImage(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: GenerateSpriteSheetOptions
): GeneratedSpriteSheet {
  const frameCount = Math.max(4, Math.min(24, Math.floor(options.frameCount)));
  const frameDurationMs = Math.max(40, Math.min(300, Math.floor(options.frameDurationMs ?? 100)));
  const outputScale = clamp(options.outputScale ?? 1, 0.5, 3);
  const padding = Math.max(2, Math.floor(options.paddingPx ?? 10));

  const baseWidth = Math.max(8, Math.floor(sourceWidth * outputScale));
  const baseHeight = Math.max(8, Math.floor(sourceHeight * outputScale));
  const frameWidth = baseWidth + padding * 2;
  const frameHeight = baseHeight + padding * 2;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = frameWidth * frameCount;
  sheetCanvas.height = frameHeight;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) {
    throw new Error('Canvas 2D context unavailable for sprite generation.');
  }

  const frames: GeneratedSpriteFrameMeta[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    const phase = (i / frameCount) * Math.PI * 2;
    const bob = Math.sin(phase) * 0.06;
    const stretchY = 1 + Math.sin(phase + Math.PI * 0.4) * 0.08;
    const stretchX = 1 - Math.sin(phase + Math.PI * 0.4) * 0.05;
    const tilt = Math.sin(phase) * 0.12;

    const frameX = i * frameWidth;
    const cx = frameX + frameWidth * 0.5;
    const cy = frameHeight * 0.5;

    sheetCtx.save();

    // Ground shadow helps readability and gives subtle movement depth.
    sheetCtx.fillStyle = 'rgba(8, 15, 25, 0.28)';
    sheetCtx.beginPath();
    sheetCtx.ellipse(
      cx,
      frameHeight - padding * 0.72,
      baseWidth * 0.34,
      baseHeight * 0.1,
      0,
      0,
      Math.PI * 2
    );
    sheetCtx.fill();

    sheetCtx.translate(cx, cy + bob * baseHeight);
    sheetCtx.rotate(tilt);
    sheetCtx.scale(stretchX, stretchY);

    sheetCtx.drawImage(sourceImage, -baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);

    sheetCtx.restore();

    frames.push({
      name: `frame_${String(i + 1).padStart(2, '0')}`,
      x: frameX,
      y: 0,
      width: frameWidth,
      height: frameHeight,
      durationMs: frameDurationMs
    });
  }

  return {
    sheetDataUrl: sheetCanvas.toDataURL('image/png'),
    sheetCanvas,
    meta: {
      generator: 'studio-auto-sprite-v1',
      frameWidth,
      frameHeight,
      frameCount,
      sourceWidth,
      sourceHeight,
      frames
    }
  };
}

export function generateRacerVariantDescriptors(
  racerVariantCount: number
): RacerVariantDescriptor[] {
  const count = Math.max(2, Math.min(60, Math.floor(racerVariantCount)));
  const variants: RacerVariantDescriptor[] = [];

  for (let i = 0; i < count; i += 1) {
    const hue = Math.round((i * 137.5 + 24) % 360);
    const sat = 72;
    const light = 56;
    variants.push({
      racerId: `racer-${String(i + 1).padStart(2, '0')}`,
      label: `R${i + 1}`,
      tintHex: hslToHex(hue, sat, light),
      pattern: PATTERN_SEQUENCE[i % PATTERN_SEQUENCE.length]!
    });
  }

  return variants;
}

export function generateRacerSpritePackFromImage(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: GenerateRacerSpritePackOptions
): GeneratedRacerSpritePack {
  const frameCount = Math.max(4, Math.min(24, Math.floor(options.frameCount)));
  const frameDurationMs = Math.max(40, Math.min(300, Math.floor(options.frameDurationMs ?? 100)));
  const outputScale = clamp(options.outputScale ?? 1, 0.5, 3);
  const padding = Math.max(2, Math.floor(options.paddingPx ?? 10));
  const variants = generateRacerVariantDescriptors(options.racerVariantCount);

  const baseWidth = Math.max(8, Math.floor(sourceWidth * outputScale));
  const baseHeight = Math.max(8, Math.floor(sourceHeight * outputScale));
  const frameWidth = baseWidth + padding * 2;
  const frameHeight = baseHeight + padding * 2;

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = frameWidth * frameCount;
  sheetCanvas.height = frameHeight * variants.length;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) {
    throw new Error('Canvas 2D context unavailable for racer sprite generation.');
  }

  const frames: GeneratedSpriteFrameMeta[] = [];

  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const variant = variants[variantIndex]!;
    const variantOffsetY = variantIndex * frameHeight;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const phase = (frameIndex / frameCount) * Math.PI * 2;
      const bob = Math.sin(phase) * 0.06;
      const stretchY = 1 + Math.sin(phase + Math.PI * 0.4) * 0.08;
      const stretchX = 1 - Math.sin(phase + Math.PI * 0.4) * 0.05;
      const tilt = Math.sin(phase) * 0.12;

      const frameX = frameIndex * frameWidth;
      const frameY = variantOffsetY;
      const cx = frameX + frameWidth * 0.5;
      const cy = frameY + frameHeight * 0.5;

      sheetCtx.save();

      sheetCtx.fillStyle = 'rgba(8, 15, 25, 0.24)';
      sheetCtx.beginPath();
      sheetCtx.ellipse(
        cx,
        frameY + frameHeight - padding * 0.72,
        baseWidth * 0.34,
        baseHeight * 0.1,
        0,
        0,
        Math.PI * 2
      );
      sheetCtx.fill();

      sheetCtx.translate(cx, cy + bob * baseHeight);
      sheetCtx.rotate(tilt);
      sheetCtx.scale(stretchX, stretchY);
      sheetCtx.drawImage(sourceImage, -baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);

      sheetCtx.globalCompositeOperation = 'source-atop';
      sheetCtx.fillStyle = hexToRgba(variant.tintHex, 0.56);
      sheetCtx.fillRect(-baseWidth * 0.5, -baseHeight * 0.5, baseWidth, baseHeight);

      drawVariantPattern(sheetCtx, variant.pattern, baseWidth, baseHeight, variant.tintHex);

      sheetCtx.restore();

      frames.push({
        name: `${variant.racerId}_frame_${String(frameIndex + 1).padStart(2, '0')}`,
        x: frameX,
        y: frameY,
        width: frameWidth,
        height: frameHeight,
        durationMs: frameDurationMs
      });
    }
  }

  return {
    sheetDataUrl: sheetCanvas.toDataURL('image/png'),
    sheetCanvas,
    meta: {
      generator: 'studio-auto-racer-pack-v1',
      frameWidth,
      frameHeight,
      frameCount,
      racerVariantCount: variants.length,
      sourceWidth,
      sourceHeight,
      variants,
      frames
    }
  };
}

function drawVariantPattern(
  ctx: CanvasRenderingContext2D,
  pattern: RacerPatternKind,
  width: number,
  height: number,
  tintHex: string
): void {
  ctx.globalCompositeOperation = 'source-atop';

  if (pattern === 'stripes') {
    ctx.strokeStyle = hexToRgba(shiftHexLightness(tintHex, -22), 0.48);
    ctx.lineWidth = Math.max(2, width * 0.05);
    for (let x = -width; x < width * 1.2; x += Math.max(6, width * 0.2)) {
      ctx.beginPath();
      ctx.moveTo(x, -height * 0.55);
      ctx.lineTo(x + width * 0.45, height * 0.55);
      ctx.stroke();
    }
    return;
  }

  if (pattern === 'dots') {
    ctx.fillStyle = hexToRgba(shiftHexLightness(tintHex, -26), 0.52);
    const step = Math.max(5, width * 0.18);
    const radius = Math.max(1.5, width * 0.055);
    for (let y = -height * 0.42; y <= height * 0.42; y += step) {
      for (let x = -width * 0.42; x <= width * 0.42; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (pattern === 'chevron') {
    ctx.strokeStyle = hexToRgba(shiftHexLightness(tintHex, -18), 0.5);
    ctx.lineWidth = Math.max(2, width * 0.045);
    const step = Math.max(7, width * 0.22);
    for (let y = -height * 0.45; y < height * 0.45; y += step) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.45, y);
      ctx.lineTo(0, y + step * 0.5);
      ctx.lineTo(width * 0.45, y);
      ctx.stroke();
    }
    return;
  }

  ctx.fillStyle = hexToRgba(shiftHexLightness(tintHex, -30), 0.43);
  ctx.fillRect(-width * 0.5, -height * 0.5, width * 0.5, height);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) {
    r = chroma;
    g = x;
  } else if (hp >= 1 && hp < 2) {
    r = x;
    g = chroma;
  } else if (hp >= 2 && hp < 3) {
    g = chroma;
    b = x;
  } else if (hp >= 3 && hp < 4) {
    g = x;
    b = chroma;
  } else if (hp >= 4 && hp < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const m = light - chroma / 2;
  const toByte = (channel: number): string =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function shiftHexLightness(hex: string, delta: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  const shifted = {
    r: clamp(rgb.r + delta, 0, 255),
    g: clamp(rgb.g + delta, 0, 255),
    b: clamp(rgb.b + delta, 0, 255)
  };
  return rgbToHex(shifted.r, shifted.g, shifted.b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number): string =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 255, g: 255, b: 255 };
  const a = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}
